"use client";

import { CornerDownLeft, Plus, Target, X } from "lucide-react";
import { useShotStats } from "@/lib/kinister/useShotStats";
import { cn } from "@/lib/utils";

export function AttemptTracker({ shotId }: { shotId: string }) {
  const { stats, todaySession, logMake, logMiss, undo, reset } =
    useShotStats(shotId);

  const allTimePct =
    stats.totalAttempts > 0
      ? Math.round((stats.totalMakes / stats.totalAttempts) * 100)
      : null;
  const todayPct =
    todaySession.attempts > 0
      ? Math.round((todaySession.makes / todaySession.attempts) * 100)
      : null;

  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-[var(--color-brass-bright)]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Practice tracker
          </p>
        </div>
        {stats.totalAttempts > 0 && (
          <button
            type="button"
            onClick={reset}
            className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
          >
            Reset
          </button>
        )}
      </div>

      {/* Today's session + all-time totals */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
            Today
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide">
            {todaySession.makes}
            <span className="text-[var(--fg-dim)]">/{todaySession.attempts}</span>
          </p>
          <p className="mt-1 text-[11px] text-[var(--fg-dim)]">
            {todayPct === null ? "no attempts yet" : `${todayPct}% made`}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
            All time
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide">
            {stats.totalMakes}
            <span className="text-[var(--fg-dim)]">/{stats.totalAttempts}</span>
          </p>
          <p className="mt-1 text-[11px] text-[var(--fg-dim)]">
            {allTimePct === null ? "no attempts yet" : `${allTimePct}% made`}
          </p>
        </div>
      </div>

      {/* +Make / +Miss buttons */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={logMake}
          className={cn(
            "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-felt-bright)]/60 bg-[var(--color-felt-deep)]/40 text-sm font-semibold tracking-wide text-[var(--color-felt-bright)] transition-colors hover:bg-[var(--color-felt-deep)]/70",
          )}
          aria-label="Log a make"
        >
          <Plus size={14} /> Made
        </button>
        <button
          type="button"
          onClick={logMiss}
          className={cn(
            "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-pop)]/55 bg-[var(--color-pop)]/10 text-sm font-semibold tracking-wide text-[var(--color-pop-bright)] transition-colors hover:bg-[var(--color-pop)]/20",
          )}
          aria-label="Log a miss"
        >
          <X size={14} /> Missed
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={todaySession.attempts === 0}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Undo last attempt"
          title="Undo last attempt"
        >
          <CornerDownLeft size={14} />
        </button>
      </div>

      {/* Sparkline of recent sessions (last ~10) */}
      {stats.sessions.length > 0 && <Sparkline sessions={stats.sessions} />}
    </div>
  );
}

function Sparkline({
  sessions,
}: {
  sessions: { date: string; attempts: number; makes: number }[];
}) {
  // Oldest on the left, newest on the right.
  const ordered = [...sessions].reverse();
  const maxAttempts = Math.max(1, ...ordered.map((s) => s.attempts));
  return (
    <div className="mt-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
        Recent sessions
      </p>
      <div className="mt-2 flex items-end gap-1.5">
        {ordered.map((s) => {
          const total = s.attempts || 1;
          const makeHeight = (s.makes / total) * (s.attempts / maxAttempts) * 100;
          const missHeight =
            ((s.attempts - s.makes) / total) *
            (s.attempts / maxAttempts) *
            100;
          return (
            <div
              key={s.date}
              className="flex h-12 flex-1 flex-col-reverse"
              title={`${s.date}: ${s.makes}/${s.attempts} (${Math.round(
                (s.makes / s.attempts) * 100,
              )}%)`}
            >
              <div
                style={{ height: `${makeHeight}%` }}
                className="rounded-t-sm bg-[var(--color-felt-bright)]/80"
              />
              <div
                style={{ height: `${missHeight}%` }}
                className="bg-[var(--color-pop)]/40"
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--fg-dim)]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-[var(--color-felt-bright)]/80" />
          Makes
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-[var(--color-pop)]/40" />
          Misses
        </span>
      </div>
    </div>
  );
}

