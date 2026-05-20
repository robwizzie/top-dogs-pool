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
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Dog,
  Minus,
  PawPrint,
  Plus,
  Search,
  Shuffle,
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

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Foundational:
    "border-[var(--color-felt-bright)]/40 text-[var(--color-felt-bright)] bg-[var(--color-felt-deep)]/40",
  Intermediate:
    "border-[var(--color-brass)]/40 text-[var(--color-brass-bright)] bg-[var(--color-brass)]/10",
  Advanced:
    "border-[var(--color-pop)]/40 text-[var(--color-pop-bright)] bg-[var(--color-pop)]/10",
};

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
      <header className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <Link
            href="/shots"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
          >
            <ArrowLeft size={14} />
            All Shots
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <Dog
              size={28}
              className="text-[var(--color-brass-bright)]"
            />
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-5xl">
              Build a Dawg Drill
            </h1>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fg-dim)]">
            Pick the shots you want to drill and how many reps you&apos;ll
            take of each. Tap a preset to fill the drill quickly, or build
            it from scratch — every shot in the catalog is fair game.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {resumeCandidate && (
          <div className="surface flex flex-col gap-3 border-[var(--color-brass)]/55 bg-[var(--color-brass)]/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass-bright)]">
                Resume your drill?
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--fg)]">
                You had {resumeCandidate.items.length} shots queued up — on
                shot{" "}
                <span className="font-semibold">
                  {resumeCandidate.index + 1}
                </span>{" "}
                of {resumeCandidate.items.length}. Pick up where you left
                off?
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onResume}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)]"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={onDiscardResume}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 text-xs font-semibold uppercase tracking-wider text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Quick presets + default reps */}
        <section className="surface p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Quick fill
          </p>
          <p className="mt-1 text-xs text-[var(--fg-dim)]">
            Tap a preset to start fresh with those shots at the default rep
            count below. Replaces whatever you already have — fine-tune
            from there.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:border-[var(--color-brass)]/60 hover:text-[var(--color-brass-bright)]"
                  title={p.description}
                >
                  <PawPrint size={12} />
                  {p.label}
                </button>
              </li>
            ))}
            {selected.length > 0 && (
              <li>
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--color-pop)]/40 bg-[var(--color-pop)]/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-[var(--color-pop-bright)] transition-colors hover:bg-[var(--color-pop)]/15"
                >
                  <X size={12} />
                  Clear drill
                </button>
              </li>
            )}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
              Default reps when adding
            </p>
            <div
              className="inline-flex h-8 items-stretch overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-xs font-semibold"
              role="group"
            >
              {REP_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDefaultReps(r)}
                  className={cn(
                    "px-3 transition-colors",
                    defaultReps === r
                      ? "bg-[var(--color-brass)] text-[var(--color-ink)]"
                      : "text-[var(--fg-dim)] hover:text-[var(--fg)]",
                  )}
                  aria-pressed={defaultReps === r}
                >
                  {r}×
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Your drill — selected shots */}
        <section className="surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PawPrint
                size={16}
                className="text-[var(--color-brass-bright)]"
              />
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                Your drill
              </p>
            </div>
            <p className="text-xs text-[var(--fg-dim)]">
              <span className="font-semibold text-[var(--fg)]">
                {selected.length}
              </span>{" "}
              shots ·{" "}
              <span className="font-semibold text-[var(--color-brass-bright)]">
                {totalAttempts}
              </span>{" "}
              total reps
            </p>
          </div>

          {selected.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--fg-dim)]">
              No shots in the drill yet. Use a quick preset above or pick
              shots from the catalog below to get started.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border)]">
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
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-5 text-sm font-semibold tracking-wide text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start the Dawg Drill
            <ArrowRight size={14} />
          </button>
        </section>

        {/* Catalog — collapse/expand */}
        <section className="surface overflow-hidden">
          <button
            type="button"
            onClick={() => setCatalogOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3 text-left"
            aria-expanded={catalogOpen}
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                Pick more shots
              </p>
              <p className="mt-0.5 text-xs text-[var(--fg-dim)]">
                The whole catalog — tap Add to drop one into your drill.
              </p>
            </div>
            {catalogOpen ? (
              <ChevronUp size={16} className="text-[var(--fg-dim)]" />
            ) : (
              <ChevronDown size={16} className="text-[var(--fg-dim)]" />
            )}
          </button>

          {catalogOpen && (
            <div className="space-y-3 p-5">
              <div className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5">
                <Search size={14} className="shrink-0 text-[var(--fg-dim)]" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a shot by name or technique"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-xs font-semibold text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  ["all", "Foundational", "Intermediate", "Advanced"] as const
                ).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors",
                      difficulty === d
                        ? "border-[var(--color-brass)] bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)]"
                        : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-dim)] hover:text-[var(--fg)]",
                    )}
                    aria-pressed={difficulty === d}
                  >
                    {d === "all" ? "All" : d}
                  </button>
                ))}
              </div>

              {filteredCatalog.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--fg-dim)]">
                  No shots match those filters.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="w-full overflow-hidden rounded-xl border border-[var(--color-brass)]/40 sm:w-64">
        <PoolTable shot={shot} preview />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--fg)]">
          <span className="text-[var(--fg-dim)]">
            {String(shot.number).padStart(2, "0")} ·{" "}
          </span>
          {shot.name}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--fg-dim)]">
          {shot.difficulty} · {shot.series}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <RepStepper value={reps} onChange={onChange} />
        <button
          type="button"
          onClick={() => onChange(0)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-dim)] transition-colors hover:border-[var(--color-pop)]/40 hover:text-[var(--color-pop-bright)]"
          aria-label={`Remove ${shot.name} from drill`}
          title="Remove from drill"
        >
          <X size={13} />
        </button>
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
        "surface flex flex-col gap-3 overflow-hidden p-3 transition-colors",
        inDrill && "border-[var(--color-brass)]/55",
      )}
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl border",
          inDrill
            ? "border-[var(--color-brass)]/45"
            : "border-[var(--border)]",
        )}
      >
        <PoolTable shot={shot} preview />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
            Shot {String(shot.number).padStart(2, "0")}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-[var(--fg)]">
            {shot.name}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            DIFFICULTY_STYLES[shot.difficulty],
          )}
        >
          {shot.difficulty.slice(0, 4)}
        </span>
      </div>
      {inDrill ? (
        <RepStepper value={reps} onChange={onChange} fullWidth />
      ) : (
        <button
          type="button"
          onClick={() => onChange(defaultReps)}
          className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-xs font-semibold tracking-wide text-[var(--color-brass-bright)] transition-colors hover:border-[var(--color-brass)]/60 hover:bg-[var(--color-brass)]/10"
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
}: {
  value: number;
  onChange: (n: number) => void;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-stretch overflow-hidden rounded-full border border-[var(--color-brass)]/55 bg-[var(--color-brass)]/10",
        fullWidth && "w-full",
      )}
      role="group"
      aria-label="Reps for this shot"
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        className="flex w-9 items-center justify-center text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/20 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Fewer reps"
      >
        <Minus size={13} />
      </button>
      <span
        className={cn(
          "flex items-center justify-center text-sm font-mono font-semibold text-[var(--color-brass-bright)]",
          fullWidth ? "flex-1" : "min-w-[2.75rem]",
        )}
      >
        {value}×
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= 99}
        className="flex w-9 items-center justify-center text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/20 disabled:cursor-not-allowed disabled:opacity-40"
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
      <header className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onFinish}
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-pop-bright)]"
            >
              <X size={14} />
              End the drill
            </button>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
              {session.index + 1} / {total} · {reps} reps
            </p>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full bg-[var(--color-brass-bright)] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">
            {shot.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-dim)]">
            Shot {String(shot.number).padStart(2, "0")} · {shot.difficulty}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <PoolTable shot={shot} interactive />

            {!shot.sequence && (
              <div className="surface p-4 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
                  Rack
                </p>
                <ul className="mt-2 space-y-1 text-[var(--fg)]">
                  <li>
                    <span className="font-semibold">Cue ball:</span>{" "}
                    {describePosition(shot.cueBall)}
                  </li>
                  <li>
                    <span className="font-semibold">Object ball:</span>{" "}
                    {describePosition(shot.objectBall)}
                  </li>
                  {shot.targetPocket && (
                    <li>
                      <span className="font-semibold">Target:</span>{" "}
                      {pocketLabel(shot.targetPocket)}
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="surface p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
                Hit it
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg)]">
                {shot.technique}
              </p>
            </div>
          </div>

          <aside className="space-y-5">
            <AttemptTracker shotId={shot.id} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAdvance(Math.max(0, session.index - 1))}
                disabled={session.index === 0}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 text-sm font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={14} />
                Previous
              </button>
              <button
                type="button"
                onClick={() => onAdvance(session.index + 1)}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-4 text-sm font-semibold tracking-wide text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)]"
              >
                {isLast ? "Finish the drill" : "Next shot"}
                <ArrowRight size={14} />
              </button>
            </div>
            <Link
              href={`/shots/${shot.id}`}
              className="block text-center text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
            >
              Open full shot detail →
            </Link>
            <button
              type="button"
              onClick={() =>
                onAdvance(Math.floor(Math.random() * session.items.length))
              }
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-xs font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
            >
              <Shuffle size={12} />
              Jump to a random shot in the drill
            </button>
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12 sm:py-16">
      <header className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 size={56} className="text-[var(--color-felt-bright)]" />
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
          Dawg Drill complete
        </h1>
        {summary.totalAttempts > 0 ? (
          <p className="text-[var(--fg)]">
            <span className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-brass-bright)]">
              {summary.totalMakes}
              <span className="text-[var(--fg-dim)]">/{summary.totalAttempts}</span>
            </span>
            <span className="ml-3 text-sm text-[var(--fg-dim)]">
              ({summary.makePct}% made)
            </span>
          </p>
        ) : (
          <p className="text-sm text-[var(--fg-dim)]">
            No reps logged this session — tap{" "}
            <span className="font-semibold text-[var(--fg)]">Made</span> or{" "}
            <span className="font-semibold text-[var(--fg)]">Missed</span> on
            each rep next time and the summary fills in.
          </p>
        )}
      </header>

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
      <section className="surface overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Shot-by-shot
          </p>
        </div>
        <ul className="divide-y divide-[var(--border)]">
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
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]/50">
                  <div
                    className="h-full bg-[var(--color-felt-bright)] transition-all"
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
        <section className="surface p-5">
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

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onFinish}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-5 text-sm font-semibold tracking-wide text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)]"
        >
          Build another drill
        </button>
        <Link
          href="/stats"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-5 text-sm font-semibold tracking-wide text-[var(--fg)] transition-colors hover:text-[var(--color-brass-bright)]"
        >
          See your stats
        </Link>
      </div>
    </div>
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
    tone === "felt"
      ? "border-[var(--color-felt-bright)]/45 text-[var(--color-felt-bright)]"
      : "border-[var(--color-pop)]/45 text-[var(--color-pop-bright)]";
  const pct =
    attempts > 0 ? Math.round((makes / attempts) * 100) : 0;
  return (
    <div className={cn("surface flex flex-col gap-1 border p-4", accent)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.32em]">
        {label}
      </p>
      <p className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--fg)]">
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
