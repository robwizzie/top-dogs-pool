"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

export function DawgDrillRunner({ shots }: { shots: KinisterShot[] }) {
  const [session, setSession] = useState<SessionState | null>(null);

  if (session) {
    return (
      <SessionView
        session={session}
        onAdvance={(i) => setSession({ ...session, index: i })}
        onFinish={() => setSession(null)}
      />
    );
  }
  return <BuilderView shots={shots} onStart={(s) => setSession(s)} />;
}

function BuilderView({
  shots,
  onStart,
}: {
  shots: KinisterShot[];
  onStart: (s: SessionState) => void;
}) {
  // Map of shotId → rep count. Reps of 0 (or absent) = not in the drill.
  const [reps, setReps] = useState<Record<string, number>>({});
  // What rep count to apply when adding a new shot or applying a preset.
  const [defaultReps, setDefaultReps] = useState<number>(5);
  // Catalog filters for the "Pick more shots" panel.
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [query, setQuery] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(true);

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
  const totalReps = session.items.reduce((sum, i) => sum + i.reps, 0);
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-20 text-center">
      <CheckCircle2 size={64} className="text-[var(--color-felt-bright)]" />
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Dawg Drill complete
      </h1>
      <p className="text-[var(--fg-dim)]">
        {session.items.length} shots · {totalReps} reps. Open any of them in
        the catalog to see how your make-rate sparkline moved.
      </p>
      <div className="flex flex-wrap gap-2">
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
