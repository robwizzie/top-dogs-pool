"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  daysSinceLastAttempt,
  useAllShotStats,
} from "@/lib/kinister/useShotStats";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Dog,
  Minus,
  PawPrint,
  Plus,
  Search,
  Shuffle,
  Sparkles,
  X,
} from "lucide-react";
import type { Difficulty, KinisterShot } from "@/lib/kinister/shots";
import { PoolTable } from "./PoolTable";
import { AttemptTracker } from "./AttemptTracker";
import { describePosition, pocketLabel } from "@/lib/kinister/setup";
import {
  discardActiveSession,
  endActiveSession,
  getSession,
  readActiveSessionId,
  startSession,
  type Session as TrackedSession,
} from "@/lib/kinister/useSession";
import { showToast } from "@/components/ui/Toaster";
import { PageHeader } from "@/components/ui/Section";
import {
  DifficultyPill,
  GHOST_PILL,
  HeaderBackLink,
  HeaderChip,
  LampStage,
  PILL_TOGGLE,
  PILL_TRACK,
  PanelLabel,
} from "./TrainingUI";
import { cn } from "@/lib/utils";

type Preset = {
  id: string;
  label: string;
  description: string;
  pick: (shots: KinisterShot[]) => KinisterShot[];
};

const PRESETS: Preset[] = [
  {
    id: "foundational",
    label: "Foundational core",
    description: "Every Foundational shot in catalog order.",
    pick: (shots) => shots.filter((s) => s.difficulty === "Foundational"),
  },
  {
    id: "intermediate",
    label: "Intermediate set",
    description: "All Intermediate shots end to end.",
    pick: (shots) => shots.filter((s) => s.difficulty === "Intermediate"),
  },
  {
    id: "advanced",
    label: "Advanced gauntlet",
    description: "Every Advanced shot in the workout.",
    pick: (shots) => shots.filter((s) => s.difficulty === "Advanced"),
  },
  {
    id: "random5",
    label: "Random 5",
    description: "Five shots picked at random from the full catalog.",
    pick: (shots) => shuffle(shots).slice(0, 5),
  },
  {
    id: "random10",
    label: "Random 10",
    description: "Ten shots picked at random across all difficulties.",
    pick: (shots) => shuffle(shots).slice(0, 10),
  },
];

const REP_OPTIONS = [3, 5, 10];

/**
 * Page-top hero for the builder. Exported so the page's Suspense fallback
 * can render the identical header while the runner hydrates.
 */
export function DawgDrillHeader({
  shotCount,
  repCount,
}: {
  shotCount?: number;
  repCount?: number;
}) {
  return (
    <PageHeader
      eyebrow="Training · Dawg Drill"
      title={
        <>
          Build a <span className="pm-foil">Dawg Drill</span>
        </>
      }
      subtitle="Pick the shots you want to drill and how many reps you'll take of each. Tap a preset to fill the drill quickly, or build it from scratch — every shot in the catalog is fair game."
    >
      <div className="flex flex-wrap items-center gap-2">
        <HeaderBackLink href="/shots">All shots</HeaderBackLink>
        <HeaderChip>
          <Dog size={13} className="text-[var(--color-brass-bright)]" />
          <span className="font-[family-name:var(--font-display)] text-base leading-none tracking-wide text-[var(--color-brass-bright)]">
            {shotCount ?? 0}
          </span>
          shots ·
          <span className="font-[family-name:var(--font-display)] text-base leading-none tracking-wide text-[var(--color-brass-bright)]">
            {repCount ?? 0}
          </span>
          reps queued
        </HeaderChip>
      </div>
    </PageHeader>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Each item in the active session: a shot and how many reps the player
 * wants to take on it. The session walks through items in order; the
 * AttemptTracker on the shot detail card handles the rep logging itself.
 */
type SessionItem = { shot: KinisterShot; reps: number };
type SessionState = { items: SessionItem[]; index: number };

const SESSION_STORAGE_KEY = "topdogs:dawg-drill-session";

/** Serialized form on disk — just IDs + reps + index. */
type SerializedSession = {
  items: { shotId: string; reps: number }[];
  index: number;
};

function persistSession(session: SessionState | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  const ser: SerializedSession = {
    items: session.items.map((i) => ({ shotId: i.shot.id, reps: i.reps })),
    index: session.index,
  };
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(ser));
}

function readPersistedSession(shots: KinisterShot[]): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: SerializedSession = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) return null;
    const items: SessionItem[] = [];
    for (const entry of parsed.items) {
      const shot = shots.find((s) => s.id === entry.shotId);
      if (shot) items.push({ shot, reps: entry.reps });
    }
    if (items.length === 0) return null;
    const index = Math.max(0, Math.min(items.length - 1, parsed.index ?? 0));
    return { items, index };
  } catch {
    return null;
  }
}

export function DawgDrillRunner({ shots }: { shots: KinisterShot[] }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [resumeCandidate, setResumeCandidate] = useState<SessionState | null>(
    null,
  );

  // On mount, check for an in-progress drill to offer to resume. We don't
  // auto-resume — show a banner so the player can choose.
  useEffect(() => {
    const persisted = readPersistedSession(shots);
    if (persisted) setResumeCandidate(persisted);
  }, [shots]);

  // Mirror the active session to localStorage so a refresh / accidental
  // close doesn't lose progress.
  useEffect(() => {
    persistSession(session);
  }, [session]);

  function start(next: SessionState) {
    setResumeCandidate(null);
    // Begin a tracked session so per-shot make/miss + AI critiques get
    // attributed to this drill, not just the all-time stats.
    startSession(
      next.items.map((it) => ({ shotId: it.shot.id, reps: it.reps })),
    );
    setSession(next);
  }

  function endSession() {
    // Finalize the active session — keep the record so it shows up in
    // session history, but stop attaching new attempts to it.
    endActiveSession();
    setSession(null);
    persistSession(null);
  }

  if (session) {
    return (
      <SessionView
        session={session}
        onAdvance={(i) => setSession({ ...session, index: i })}
        onFinish={endSession}
      />
    );
  }
  return (
    <BuilderView
      shots={shots}
      onStart={start}
      resumeCandidate={resumeCandidate}
      onResume={() => {
        if (resumeCandidate) {
          // If the session record from the original start() got
          // dropped (e.g. localStorage cleared), recreate one now so
          // attempts logged during the resumed drill are tracked.
          if (!readActiveSessionId()) {
            startSession(
              resumeCandidate.items.map((it) => ({
                shotId: it.shot.id,
                reps: it.reps,
              })),
            );
          }
          setSession(resumeCandidate);
          setResumeCandidate(null);
        }
      }}
      onDiscardResume={() => {
        // Throw away the half-finished drill AND the session record
        // attached to it — the player explicitly said they don't want
        // it anymore.
        discardActiveSession();
        setResumeCandidate(null);
        persistSession(null);
      }}
    />
  );
}

function BuilderView({
  shots,
  onStart,
  resumeCandidate,
  onResume,
  onDiscardResume,
}: {
  shots: KinisterShot[];
  onStart: (s: SessionState) => void;
  resumeCandidate: SessionState | null;
  onResume: () => void;
  onDiscardResume: () => void;
}) {
  // Map of shotId → rep count. Reps of 0 (or absent) = not in the drill.
  const [reps, setReps] = useState<Record<string, number>>({});
  // What rep count to apply when adding a new shot or applying a preset.
  const [defaultReps, setDefaultReps] = useState<number>(5);
  // Catalog filters for the "Pick more shots" panel.
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [query, setQuery] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(true);

  // Read URL params for deep-linking:
  //   /dawg-drill?preset=today  → due-for-practice + untried shots
  //   /dawg-drill?shots=id1,id2 → explicit shot list (each at default reps)
  const searchParams = useSearchParams();
  const allStats = useAllShotStats();
  const presetParam = searchParams?.get("preset");
  const shotsParam = searchParams?.get("shots");
  // Only honor the URL pre-fill once per mount so users can clear the drill
  // afterward without it snapping back.
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled) return;
    if (presetParam === "today") {
      const due: string[] = [];
      const untried: string[] = [];
      for (const shot of shots) {
        const s = allStats[shot.id];
        if (!s || s.totalAttempts === 0) {
          untried.push(shot.id);
        } else {
          const days = daysSinceLastAttempt(s);
          if (days !== null && days >= 3) due.push(shot.id);
        }
      }
      // Prefer the most-due shots; pad with up to 3 untried ones so the
      // player always has something to work on.
      const picks = [...due, ...untried.slice(0, 3)].slice(0, 8);
      if (picks.length > 0) {
        const next: Record<string, number> = {};
        for (const id of picks) next[id] = defaultReps;
        setReps(next);
        setPrefilled(true);
      }
    } else if (shotsParam) {
      const ids = shotsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const next: Record<string, number> = {};
      for (const id of ids) {
        if (shots.some((s) => s.id === id)) next[id] = defaultReps;
      }
      if (Object.keys(next).length > 0) {
        setReps(next);
        setPrefilled(true);
      }
    }
  }, [presetParam, shotsParam, shots, allStats, defaultReps, prefilled]);

  // Selected shots, in catalog order (stable ordering through edits).
  const selected = useMemo(
    () => shots.filter((s) => (reps[s.id] ?? 0) > 0),
    [shots, reps],
  );

  const totalAttempts = useMemo(
    () => selected.reduce((sum, s) => sum + (reps[s.id] ?? 0), 0),
    [selected, reps],
  );

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shots.filter((s) => {
      if (difficulty !== "all" && s.difficulty !== difficulty) return false;
      if (q) {
        const hay = `${s.name} ${s.shortName} ${s.technique} ${s.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [shots, query, difficulty]);

  function setRepsFor(id: string, n: number) {
    setReps((prev) => {
      const next = { ...prev };
      if (n <= 0) delete next[id];
      else next[id] = Math.min(99, n);
      return next;
    });
  }

  function applyPreset(p: Preset) {
    // Replace, don't merge: tapping a preset always starts a fresh drill
    // with exactly that preset's shots at the default rep count.
    const picks = p.pick(shots);
    const next: Record<string, number> = {};
    for (const s of picks) {
      next[s.id] = defaultReps;
    }
    setReps(next);
  }

  function clearAll() {
    setReps({});
  }

  function start() {
    const items = selected.map((shot) => ({ shot, reps: reps[shot.id] ?? 0 }));
    if (items.length === 0) return;
    onStart({ items, index: 0 });
  }

  return (
    <>
      <DawgDrillHeader shotCount={selected.length} repCount={totalAttempts} />

      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-12 pt-4 sm:px-6 sm:pb-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:px-8">
        {resumeCandidate && (
          <div className="pm-glass relative isolate flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
            <div
              className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_120%_at_0%_50%,rgba(224,190,107,0.18),transparent_70%)]"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass-bright)]">
                Resume your drill?
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-cream)]">
                You had {resumeCandidate.items.length} shots queued up — on
                shot{" "}
                <span className="font-semibold">
                  {resumeCandidate.index + 1}
                </span>{" "}
                of {resumeCandidate.items.length}. Pick up where you left
                off?
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={onResume} className="pm-btn !py-2.5">
                Resume
                <ArrowRight size={14} />
              </button>
              <button type="button" onClick={onDiscardResume} className={GHOST_PILL}>
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Quick presets + default reps */}
        <section className="pm-glass relative isolate overflow-hidden p-5 sm:p-6 lg:col-start-1">
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_120%_at_0%_0%,rgba(46,139,87,0.16),transparent_60%)]"
            aria-hidden
          />
          <PanelLabel icon={<Sparkles size={14} className="text-[var(--color-brass-bright)]" />}>
            Quick fill
          </PanelLabel>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-cream)]/55">
            Tap a preset to start fresh with those shots at the default rep
            count below. Replaces whatever you already have — fine-tune
            from there.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5 [&>li:last-child]:col-span-2 sm:[&>li:last-child]:col-span-1">
            {PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="group flex h-full w-full flex-col items-start gap-1.5 rounded-2xl bg-black/35 px-3.5 py-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-all hover:-translate-y-0.5 hover:bg-[var(--color-brass)]/10 hover:shadow-[inset_0_0_0_1px_rgba(224,190,107,0.45)]"
                  title={p.description}
                >
                  <PawPrint size={14} className="text-[var(--color-brass)] transition-colors group-hover:text-[var(--color-brass-bright)]" />
                  <span className="font-[family-name:var(--font-display)] text-lg leading-none tracking-wide text-[var(--color-cream)]">
                    {p.label}
                  </span>
                  <span className="text-[11px] leading-snug text-[var(--color-cream)]/45">
                    {p.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--color-cream)]/[0.07] pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/45">
              Default reps when adding
            </p>
            <div className={PILL_TRACK} role="group">
              {REP_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDefaultReps(r)}
                  data-active={defaultReps === r}
                  className={cn(PILL_TOGGLE, "tabular-nums")}
                  aria-pressed={defaultReps === r}
                >
                  {r}×
                </button>
              ))}
            </div>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/45 transition-colors hover:text-[var(--color-pop-bright)]"
              >
                <X size={12} />
                Clear drill
              </button>
            )}
          </div>
        </section>

        {/* Your drill — selected shots: a ticket that rides along on desktop */}
        {/* .pm-glass forces position:relative, so stickiness lives on a wrapper */}
        <div className="self-start lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <section className="pm-glass relative isolate overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(255,226,160,0.12),transparent_70%)]"
            aria-hidden
          />
          <div className="p-5 sm:p-6">
            <PanelLabel icon={<PawPrint size={14} className="text-[var(--color-brass-bright)]" />}>
              Your drill
            </PanelLabel>
            <div className="pm-rail mt-5 grid grid-cols-2">
              <span className="pm-diamond left-1/2 top-1/2" aria-hidden />
              <div className="px-4 py-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/50">
                  Shots
                </p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-5xl leading-[0.85] tracking-wide tabular-nums text-[var(--color-cream)]">
                  {selected.length}
                </p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/50">
                  Total reps
                </p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-5xl leading-[0.85] tracking-wide tabular-nums">
                  <span className={totalAttempts > 0 ? "pm-foil" : "text-[var(--color-cream)]"}>
                    {totalAttempts}
                  </span>
                </p>
              </div>
            </div>

            {selected.length === 0 ? (
              <p className="mt-5 text-sm leading-relaxed text-[var(--color-cream)]/55">
                <span className="pm-serif mr-1 text-lg text-[var(--color-cream)]/80">
                  Empty rack.
                </span>
                No shots in the drill yet. Use a quick preset or pick shots
                from the catalog to get started.
              </p>
            ) : (
              <ul className="mt-4 max-h-[min(52vh,30rem)] divide-y divide-[var(--color-cream)]/[0.07] overflow-y-auto pr-1 lg:max-h-[calc(100vh-26rem)]">
                {selected.map((s) => (
                  <SelectedRow
                    key={s.id}
                    shot={s}
                    reps={reps[s.id] ?? 0}
                    onChange={(n) => setRepsFor(s.id, n)}
                  />
                ))}
              </ul>
            )}

            <button
              type="button"
              disabled={selected.length === 0}
              onClick={start}
              className="pm-btn mt-5 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              Start the Dawg Drill
              <ArrowRight size={14} />
            </button>
          </div>
        </section>
        </div>

        {/* Catalog — collapse/expand */}
        <section className="pm-glass overflow-hidden lg:col-start-1">
          <button
            type="button"
            onClick={() => setCatalogOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6"
            aria-expanded={catalogOpen}
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                Pick more shots
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide text-[var(--color-cream)]">
                The whole catalog
              </p>
              <p className="mt-1 text-xs text-[var(--color-cream)]/50">
                Tap Add to drop one into your drill.
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-cream)]/10 bg-black/30 text-[var(--color-cream)]/60">
              {catalogOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {catalogOpen && (
            <div className="space-y-4 border-t border-[var(--color-cream)]/[0.07] p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="group flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full bg-black/45 px-4 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.06)] focus-within:shadow-[inset_0_1px_3px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(224,190,107,0.5)]">
                  <Search size={14} className="shrink-0 text-[var(--color-cream)]/40 group-focus-within:text-[var(--color-brass-bright)]" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a shot by name or technique"
                    className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-cream)] placeholder:text-[var(--color-cream)]/35 focus:outline-none"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/50 transition-colors hover:text-[var(--color-brass-bright)]"
                    >
                      Clear
                    </button>
                  )}
                </label>

                <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className={cn(PILL_TRACK, "w-max")} role="group" aria-label="Difficulty">
                    {(
                      ["all", "Foundational", "Intermediate", "Advanced"] as const
                    ).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        data-active={difficulty === d}
                        className={PILL_TOGGLE}
                        aria-pressed={difficulty === d}
                      >
                        {d === "all" ? "All" : d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredCatalog.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--color-cream)]/55">
                  No shots match those filters.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                  {filteredCatalog.map((s) => (
                    <CatalogCard
                      key={s.id}
                      shot={s}
                      reps={reps[s.id] ?? 0}
                      defaultReps={defaultReps}
                      onChange={(n) => setRepsFor(s.id, n)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function SelectedRow({
  shot,
  reps,
  onChange,
}: {
  shot: KinisterShot;
  reps: number;
  onChange: (n: number) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="w-20 shrink-0 overflow-hidden rounded-lg">
        <PoolTable shot={shot} preview />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-cream)]">
          <span className="font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--color-brass)]">
            {String(shot.number).padStart(2, "0")}{" "}
          </span>
          {shot.name}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <RepStepper value={reps} onChange={onChange} size="sm" />
          <button
            type="button"
            onClick={() => onChange(0)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-cream)]/40 transition-colors hover:bg-[var(--color-pop)]/10 hover:text-[var(--color-pop-bright)]"
            aria-label={`Remove ${shot.name} from drill`}
            title="Remove from drill"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </li>
  );
}

function CatalogCard({
  shot,
  reps,
  defaultReps,
  onChange,
}: {
  shot: KinisterShot;
  reps: number;
  defaultReps: number;
  onChange: (n: number) => void;
}) {
  const inDrill = reps > 0;
  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-black/30 p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-shadow sm:p-3",
        inDrill &&
          "bg-[var(--color-brass)]/[0.07] shadow-[inset_0_0_0_1px_rgba(224,190,107,0.5),0_14px_30px_-18px_rgba(201,162,74,0.7)]",
      )}
    >
      <div className="overflow-hidden rounded-xl">
        <PoolTable shot={shot} preview />
      </div>
      <div className="flex items-start justify-between gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
            Shot {String(shot.number).padStart(2, "0")}
          </p>
          <p className="mt-0.5 truncate font-[family-name:var(--font-display)] text-lg leading-tight tracking-wide text-[var(--color-cream)]">
            {shot.name}
          </p>
        </div>
        <DifficultyPill difficulty={shot.difficulty} short className="hidden sm:inline-flex" />
      </div>
      {inDrill ? (
        <RepStepper value={reps} onChange={onChange} fullWidth />
      ) : (
        <button
          type="button"
          onClick={() => onChange(defaultReps)}
          className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-[var(--color-brass)]/35 bg-black/30 text-xs font-semibold tracking-wide text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10"
          aria-label={`Add ${shot.name} to drill`}
        >
          <Plus size={12} />
          Add to drill
        </button>
      )}
    </article>
  );
}

function RepStepper({
  value,
  onChange,
  fullWidth = false,
  size = "md",
}: {
  value: number;
  onChange: (n: number) => void;
  fullWidth?: boolean;
  size?: "sm" | "md";
}) {
  const btn = size === "sm" ? "w-7" : "w-9";
  return (
    <div
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-full bg-black/45 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(224,190,107,0.4)]",
        size === "sm" ? "h-7" : "h-9",
        fullWidth && "w-full",
      )}
      role="group"
      aria-label="Reps for this shot"
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        className={cn(
          "flex items-center justify-center text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/20 disabled:cursor-not-allowed disabled:opacity-40",
          btn,
        )}
        aria-label="Fewer reps"
      >
        <Minus size={13} />
      </button>
      <span
        className={cn(
          "flex items-center justify-center font-[family-name:var(--font-display)] tracking-wide tabular-nums text-[var(--color-brass-bright)]",
          size === "sm" ? "text-base" : "text-lg",
          fullWidth ? "flex-1" : "min-w-[2.5rem]",
        )}
      >
        {value}×
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= 99}
        className={cn(
          "flex items-center justify-center text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/20 disabled:cursor-not-allowed disabled:opacity-40",
          btn,
        )}
        aria-label="More reps"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}

function SessionView({
  session,
  onAdvance,
  onFinish,
}: {
  session: SessionState;
  onAdvance: (index: number) => void;
  onFinish: () => void;
}) {
  const item = session.items[session.index];
  const total = session.items.length;
  const isLast = session.index >= total - 1;
  const progressPct = Math.round(((session.index + 1) / total) * 100);

  if (!item) {
    return <Complete onFinish={onFinish} session={session} />;
  }

  const { shot, reps } = item;

  return (
    <>
      <PageHeader
        eyebrow={`Dawg Drill · Shot ${session.index + 1} of ${total} · ${reps} reps`}
        title={shot.name}
        subtitle={`Shot ${String(shot.number).padStart(2, "0")} · ${shot.difficulty}`}
      >
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-felt-bright)] via-[var(--color-brass)] to-[var(--color-brass-bright)] shadow-[0_0_12px_rgba(224,190,107,0.6)] transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="font-[family-name:var(--font-display)] text-xl leading-none tracking-wide tabular-nums text-[var(--color-brass-bright)]">
              {progressPct}%
            </span>
          </div>
          <div>
            <button
              type="button"
              onClick={onFinish}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-cream)]/70 backdrop-blur-sm transition-colors hover:border-[var(--color-pop)]/50 hover:text-[var(--color-pop-bright)]"
            >
              <X size={13} />
              End the drill
            </button>
          </div>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
          <div className="space-y-6">
            <LampStage>
              <PoolTable shot={shot} interactive />
            </LampStage>

            {!shot.sequence && (
              <div className="pm-glass p-5 text-sm">
                <PanelLabel>Rack</PanelLabel>
                <dl className="mt-3 grid gap-2.5">
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.22em] leading-5 text-[var(--color-cream)]/45">
                      Cue ball
                    </dt>
                    <dd className="text-[var(--color-cream)]">{describePosition(shot.cueBall)}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.22em] leading-5 text-[var(--color-cream)]/45">
                      Object ball
                    </dt>
                    <dd className="text-[var(--color-cream)]">{describePosition(shot.objectBall)}</dd>
                  </div>
                  {shot.targetPocket && (
                    <div className="flex gap-3">
                      <dt className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-[0.22em] leading-5 text-[var(--color-cream)]/45">
                        Target
                      </dt>
                      <dd className="text-[var(--color-cream)]">{pocketLabel(shot.targetPocket)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            <div className="pm-glass p-5">
              <PanelLabel>Hit it</PanelLabel>
              <p className="mt-2 text-base leading-relaxed text-[var(--color-cream)]">
                {shot.technique}
              </p>
            </div>
          </div>

          <aside className="space-y-4">
            <AttemptTracker shotId={shot.id} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAdvance(Math.max(0, session.index - 1))}
                disabled={session.index === 0}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--color-cream)]/10 bg-black/30 px-5 text-sm font-semibold tracking-wide text-[var(--color-cream)]/65 transition-colors hover:text-[var(--color-cream)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={14} />
                Previous
              </button>
              <button
                type="button"
                onClick={() => onAdvance(session.index + 1)}
                className="pm-btn h-12 flex-1 justify-center"
              >
                {isLast ? "Finish the drill" : "Next shot"}
                <ArrowRight size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                onAdvance(Math.floor(Math.random() * session.items.length))
              }
              className={cn(GHOST_PILL, "w-full")}
            >
              <Shuffle size={12} />
              Jump to a random shot in the drill
            </button>
            <Link
              href={`/shots/${shot.id}`}
              className="block pt-1 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/45 transition-colors hover:text-[var(--color-brass-bright)]"
            >
              Open full shot detail →
            </Link>
          </aside>
        </div>
      </div>
    </>
  );
}

function Complete({
  onFinish,
  session,
}: {
  onFinish: () => void;
  session: SessionState;
}) {
  // The active session in localStorage carries the actual rep results —
  // attempts, makes, and AI critiques per shot. Snapshot it on first
  // mount and THEN finalize, so the summary keeps showing real data
  // even if the player navigates between Complete and /stats and back.
  const [activeSession, setActiveSession] = useState<TrackedSession | null>(
    null,
  );
  useEffect(() => {
    const id = readActiveSessionId();
    if (id) {
      const snap = getSession(id);
      setActiveSession(snap);
      // Finalize the session record (so /stats history shows it as
      // completed) but leave the snapshot for this view.
      endActiveSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targetReps = session.items.reduce((sum, i) => sum + i.reps, 0);
  const summary = useMemo(() => {
    if (!activeSession) {
      return {
        totalAttempts: 0,
        totalMakes: 0,
        makePct: null as number | null,
        perShot: session.items.map((it) => ({
          shot: it.shot,
          target: it.reps,
          attempts: 0,
          makes: 0,
          critiques: [] as { verdict: string; summary: string }[],
        })),
      };
    }
    const perShot = session.items.map((it) => {
      const entry = activeSession.shots.find(
        (e) => e.shotId === it.shot.id,
      );
      return {
        shot: it.shot,
        target: it.reps,
        attempts: entry?.attempts ?? 0,
        makes: entry?.makes ?? 0,
        critiques:
          entry?.critiques.map((c) => ({
            verdict: c.verdict,
            summary: c.summary,
          })) ?? [],
      };
    });
    const totalAttempts = perShot.reduce((s, p) => s + p.attempts, 0);
    const totalMakes = perShot.reduce((s, p) => s + p.makes, 0);
    return {
      totalAttempts,
      totalMakes,
      makePct:
        totalAttempts > 0
          ? Math.round((totalMakes / totalAttempts) * 100)
          : null,
      perShot,
    };
  }, [activeSession, session.items]);

  // Single celebratory toast on first mount of the complete screen.
  useEffect(() => {
    showToast({
      message: "Dawg Drill complete",
      detail:
        summary.totalAttempts > 0
          ? `${summary.totalMakes}/${summary.totalAttempts} made`
          : `${session.items.length} shots · ${targetReps} reps`,
      kind: "success",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Best + toughest shot by make rate (only counting shots with attempts).
  const ranked = summary.perShot
    .filter((p) => p.attempts > 0)
    .map((p) => ({ ...p, pct: p.makes / p.attempts }));
  const best = ranked.length
    ? [...ranked].sort((a, b) => b.pct - a.pct)[0]
    : null;
  const tough =
    ranked.length > 1
      ? [...ranked].sort((a, b) => a.pct - b.pct)[0]
      : null;

  // Collect all "needs work" critiques across the session — the bits a
  // player most wants to read at the end.
  const lessonsLearned = summary.perShot.flatMap((p) =>
    p.critiques
      .filter((c) => c.verdict === "needs work")
      .map((c) => ({ shot: p.shot, summary: c.summary })),
  );

  return (
    <>
    <PageHeader
      eyebrow="Dawg Drill complete"
      title={
        summary.totalAttempts > 0 ? (
          <>
            <span className="pm-foil">{summary.totalMakes}</span>
            <span className="text-[var(--color-cream)]/35">/{summary.totalAttempts}</span>{" "}
            <span className="pm-serif text-[0.45em] text-[var(--color-cream)]/75">
              {summary.makePct}% made
            </span>
          </>
        ) : (
          "Drill complete"
        )
      }
      subtitle={
        summary.totalAttempts > 0 ? (
          `${session.items.length} shots · ${targetReps} reps planned. Nice work — here's how it went.`
        ) : (
          <>
            No reps logged this session — tap{" "}
            <span className="font-semibold text-[var(--color-cream)]">Made</span> or{" "}
            <span className="font-semibold text-[var(--color-cream)]">Missed</span> on
            each rep next time and the summary fills in.
          </>
        )
      }
    >
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={onFinish} className="pm-btn">
          Build another drill
          <ArrowRight size={14} />
        </button>
        <Link href="/stats" className="inline-flex h-12 items-center gap-2 rounded-full border border-[var(--color-brass)]/40 bg-black/30 px-5 text-sm font-semibold text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10">
          See your stats
        </Link>
      </div>
    </PageHeader>
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-12 pt-4 sm:pb-16">
      {/* Best / tough callouts */}
      {(best || tough) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {best && (
            <CalloutCard
              tone="felt"
              label="Strongest"
              shotName={best.shot.name}
              shotNumber={best.shot.number}
              makes={best.makes}
              attempts={best.attempts}
            />
          )}
          {tough && tough !== best && (
            <CalloutCard
              tone="pop"
              label="Toughest"
              shotName={tough.shot.name}
              shotNumber={tough.shot.number}
              makes={tough.makes}
              attempts={tough.attempts}
            />
          )}
        </div>
      )}

      {/* Per-shot breakdown */}
      <section className="pm-glass overflow-hidden">
        <div className="px-5 pb-2 pt-5">
          <PanelLabel>Shot-by-shot</PanelLabel>
        </div>
        <ul className="divide-y divide-[var(--color-cream)]/[0.07]">
          {summary.perShot.map((p) => {
            const pct =
              p.attempts > 0
                ? Math.round((p.makes / p.attempts) * 100)
                : null;
            return (
              <li key={p.shot.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/shots/${p.shot.id}`}
                    className="text-sm font-semibold text-[var(--fg)] hover:text-[var(--color-brass-bright)]"
                  >
                    <span className="text-[var(--fg-dim)]">
                      {String(p.shot.number).padStart(2, "0")} ·{" "}
                    </span>
                    {p.shot.name}
                  </Link>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-[var(--fg)]">
                      {p.makes}/{p.attempts}
                      <span className="text-[var(--fg-dim)]"> of {p.target}</span>
                    </span>
                    {pct !== null && (
                      <span
                        className={cn(
                          "font-semibold",
                          pct >= 70
                            ? "text-[var(--color-felt-bright)]"
                            : pct >= 40
                              ? "text-[var(--color-brass-bright)]"
                              : "text-[var(--color-pop-bright)]",
                        )}
                      >
                        {pct}%
                      </span>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--color-felt-bright)] to-[#5fc48a] transition-all"
                    style={{
                      width:
                        p.target > 0
                          ? `${Math.min(100, (p.attempts / p.target) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
                {p.critiques.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {p.critiques.map((c, i) => (
                      <li
                        key={i}
                        className="border-l-2 border-[var(--color-brass)]/45 pl-2 text-[12px] leading-relaxed text-[var(--fg-dim)]"
                      >
                        <span
                          className={cn(
                            "mr-1 font-semibold uppercase tracking-wider",
                            c.verdict === "looked great"
                              ? "text-[var(--color-felt-bright)]"
                              : c.verdict === "needs work"
                                ? "text-[var(--color-pop-bright)]"
                                : "text-[var(--fg)]",
                          )}
                        >
                          AI · {c.verdict}
                        </span>
                        {c.summary}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Lessons learned — the "needs work" highlights pulled together. */}
      {lessonsLearned.length > 0 && (
        <section className="pm-glass p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-pop-bright)]">
            What to work on next
          </p>
          <ul className="mt-3 space-y-2">
            {lessonsLearned.map((l, i) => (
              <li
                key={i}
                className="border-l-2 border-[var(--color-pop)]/55 pl-3 text-sm leading-relaxed text-[var(--fg)]"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
                  {l.shot.name}
                </span>
                <p>{l.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
    </>
  );
}

function CalloutCard({
  tone,
  label,
  shotName,
  shotNumber,
  makes,
  attempts,
}: {
  tone: "felt" | "pop";
  label: string;
  shotName: string;
  shotNumber: number;
  makes: number;
  attempts: number;
}) {
  const accent =
    tone === "felt" ? "text-[#5fc48a]" : "text-[var(--color-pop-bright)]";
  const glow =
    tone === "felt"
      ? "bg-[radial-gradient(80%_120%_at_0%_0%,rgba(46,139,87,0.22),transparent_70%)]"
      : "bg-[radial-gradient(80%_120%_at_0%_0%,rgba(232,82,72,0.18),transparent_70%)]";
  const pct =
    attempts > 0 ? Math.round((makes / attempts) * 100) : 0;
  return (
    <div className={cn("pm-glass relative isolate flex flex-col gap-1 overflow-hidden p-5", accent)}>
      <div className={cn("pointer-events-none absolute inset-0 -z-10", glow)} aria-hidden />
      <p className="text-[10px] font-semibold uppercase tracking-[0.32em]">
        {label}
      </p>
      <p className="font-[family-name:var(--font-display)] text-2xl leading-[0.95] tracking-wide text-[var(--color-cream)]">
        <span className="text-[var(--fg-dim)]">
          {String(shotNumber).padStart(2, "0")} ·{" "}
        </span>
        {shotName}
      </p>
      <p className="text-sm text-[var(--fg-dim)]">
        {makes}/{attempts} made · {pct}%
      </p>
    </div>
  );
}
