"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Dumbbell,
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

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type SessionState = {
  shots: KinisterShot[];
  reps: number;
  index: number;
};

export function WorkoutRunner({ shots }: { shots: KinisterShot[] }) {
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
  return <SetupView shots={shots} onStart={(s) => setSession(s)} />;
}

function SetupView({
  shots,
  onStart,
}: {
  shots: KinisterShot[];
  onStart: (s: SessionState) => void;
}) {
  const [preset, setPreset] = useState<string>("foundational");
  const [reps, setReps] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");

  const selected = useMemo(() => {
    if (preset === "custom") {
      if (difficulty === "all") return shots;
      return shots.filter((s) => s.difficulty === difficulty);
    }
    const p = PRESETS.find((p) => p.id === preset);
    return p ? p.pick(shots) : shots;
  }, [shots, preset, difficulty]);

  return (
    <>
      <header className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <Link
            href="/shots"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
          >
            <ArrowLeft size={14} />
            All Shots
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <Dumbbell
              size={28}
              className="text-[var(--color-brass-bright)]"
            />
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-5xl">
              Workout Session
            </h1>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fg-dim)]">
            Pick a set, pick how many reps you&apos;ll take per shot, then
            walk through the catalog one shot at a time. Use the Made /
            Missed buttons in the tracker as you shoot — your make rate is
            saved.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="space-y-6">
          <section className="surface p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              1. Pick a set
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {PRESETS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPreset(p.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                      preset === p.id
                        ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10"
                        : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]",
                    )}
                    aria-pressed={preset === p.id}
                  >
                    <span className="font-semibold tracking-wide text-[var(--fg)]">
                      {p.label}
                    </span>
                    <span className="text-xs leading-relaxed text-[var(--fg-dim)]">
                      {p.description}
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setPreset("custom")}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                    preset === "custom"
                      ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10"
                      : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]",
                  )}
                  aria-pressed={preset === "custom"}
                >
                  <span className="font-semibold tracking-wide text-[var(--fg)]">
                    Custom
                  </span>
                  <span className="text-xs leading-relaxed text-[var(--fg-dim)]">
                    Filter to a single difficulty band.
                  </span>
                </button>
              </li>
            </ul>
            {preset === "custom" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  ["all", "Foundational", "Intermediate", "Advanced"] as const
                ).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors",
                      difficulty === d
                        ? "border-[var(--color-brass)] bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)]"
                        : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-dim)] hover:text-[var(--fg)]",
                    )}
                    aria-pressed={difficulty === d}
                  >
                    {d === "all" ? "All difficulties" : d}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="surface p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              2. Reps per shot
            </p>
            <div className="mt-3 flex gap-2">
              {REP_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReps(r)}
                  className={cn(
                    "h-10 w-20 rounded-full border text-sm font-semibold tracking-wide transition-colors",
                    reps === r
                      ? "border-[var(--color-brass)] bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)]"
                      : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-dim)] hover:text-[var(--fg)]",
                  )}
                  aria-pressed={reps === r}
                >
                  {r}×
                </button>
              ))}
            </div>
          </section>

          <section className="surface p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              Your session
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-dim)]">
              <span className="font-semibold text-[var(--fg)]">
                {selected.length}
              </span>{" "}
              shots ×{" "}
              <span className="font-semibold text-[var(--fg)]">{reps}</span>{" "}
              reps ={" "}
              <span className="font-semibold text-[var(--color-brass-bright)]">
                {selected.length * reps}
              </span>{" "}
              attempts total
            </p>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() =>
                onStart({ shots: selected, reps, index: 0 })
              }
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-5 text-sm font-semibold tracking-wide text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start session
              <ArrowRight size={14} />
            </button>
          </section>
        </div>
      </div>
    </>
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
  const shot = session.shots[session.index];
  const total = session.shots.length;
  const isLast = session.index >= total - 1;
  const progressPct = Math.round(((session.index + 1) / total) * 100);

  if (!shot) {
    return (
      <Complete onFinish={onFinish} reps={session.reps} total={total} />
    );
  }

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
              End session
            </button>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
              {session.index + 1} / {total} · {session.reps} reps
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
                {isLast ? "Finish session" : "Next shot"}
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
                onAdvance(Math.floor(Math.random() * session.shots.length))
              }
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-xs font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
            >
              <Shuffle size={12} />
              Jump to random shot
            </button>
          </aside>
        </div>
      </div>
    </>
  );
}

function Complete({
  onFinish,
  reps,
  total,
}: {
  onFinish: () => void;
  reps: number;
  total: number;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-20 text-center">
      <CheckCircle2
        size={64}
        className="text-[var(--color-felt-bright)]"
      />
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Session complete
      </h1>
      <p className="text-[var(--fg-dim)]">
        {total} shots × {reps} reps. Open any shot above to check your make
        rate sparkline.
      </p>
      <button
        type="button"
        onClick={onFinish}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-5 text-sm font-semibold tracking-wide text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)]"
      >
        Back to setup
      </button>
    </div>
  );
}
