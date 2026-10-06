"use client";

import { useEffect } from "react";
import { CornerDownLeft, Plus, Target, X } from "lucide-react";
import { useShotStats } from "@/lib/kinister/useShotStats";
import { logSessionAttempt } from "@/lib/kinister/useSession";
import { showToast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

export function AttemptTracker({ shotId }: { shotId: string }) {
  const {
    stats,
    todaySession,
    logMake: rawLogMake,
    logMiss: rawLogMiss,
    undo,
    reset,
  } = useShotStats(shotId);

  // Wrap log handlers so the player gets a subtle confirmation toast for
  // every rep — reassurance the tap landed. We also mirror the attempt
  // to the active Dawg Drill session, if one is running, so the
  // end-of-session summary can show this rep.
  const logMake = () => {
    rawLogMake();
    logSessionAttempt(shotId, true);
    showToast({ message: "Make logged", kind: "success" });
  };
  const logMiss = () => {
    rawLogMiss();
    logSessionAttempt(shotId, false);
    showToast({ message: "Miss logged", kind: "info" });
  };

  // Keyboard shortcuts: M = make, X = miss. Phone-on-rail use case: a
  // bluetooth keyboard / remote shutter triggers reps without taking
  // hands off the cue.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const editing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (t && (t as HTMLElement).isContentEditable);
      if (editing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "m") {
        e.preventDefault();
        logMake();
      } else if (key === "x") {
        e.preventDefault();
        logMiss();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotId]);

  const allTimePct =
    stats.totalAttempts > 0
      ? Math.round((stats.totalMakes / stats.totalAttempts) * 100)
      : null;
  const todayPct =
    todaySession.attempts > 0
      ? Math.round((todaySession.makes / todaySession.attempts) * 100)
      : null;

  return (
    <div className="pm-glass relative isolate overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-48 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(255,226,160,0.1),transparent_70%)]"
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-[var(--color-brass-bright)]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Practice tracker
          </p>
        </div>
        {stats.totalAttempts > 0 && (
          <button
            type="button"
            onClick={reset}
            className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/40 transition-colors hover:text-[var(--color-pop-bright)]"
          >
            Reset
          </button>
        )}
      </div>

      {/* Today's session + all-time totals, on a walnut scoreboard rail */}
      <div className="pm-rail mt-5 grid grid-cols-2">
        <span className="pm-diamond left-1/2 top-1/2" aria-hidden />
        <ScoreCell
          label="Today"
          makes={todaySession.makes}
          attempts={todaySession.attempts}
          pct={todayPct}
          highlight
        />
        <ScoreCell
          label="All time"
          makes={stats.totalMakes}
          attempts={stats.totalAttempts}
          pct={allTimePct}
        />
      </div>

      {/* +Make / +Miss buttons */}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={logMake}
          className={cn(
            "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#3aa86a] via-[#2e8b57] to-[#1f6e3d] text-sm font-semibold tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_10px_24px_-12px_rgba(46,139,87,0.9)] transition-[filter,transform] hover:-translate-y-px hover:brightness-110 active:translate-y-0 active:brightness-95",
          )}
          aria-label="Log a make"
        >
          <Plus size={15} /> Made
          <kbd className="ml-1 hidden rounded border border-white/25 px-1 font-sans text-[9px] font-semibold text-white/70 sm:inline">M</kbd>
        </button>
        <button
          type="button"
          onClick={logMiss}
          className={cn(
            "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-pop)]/50 bg-[var(--color-pop)]/10 text-sm font-semibold tracking-wide text-[var(--color-pop-bright)] transition-[background-color,transform] hover:-translate-y-px hover:bg-[var(--color-pop)]/20 active:translate-y-0",
          )}
          aria-label="Log a miss"
        >
          <X size={15} /> Missed
          <kbd className="ml-1 hidden rounded border border-[var(--color-pop)]/40 px-1 font-sans text-[9px] font-semibold text-[var(--color-pop-bright)]/70 sm:inline">X</kbd>
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={todaySession.attempts === 0}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-cream)]/10 bg-black/40 text-[var(--color-cream)]/60 transition-colors hover:border-[var(--color-brass)]/45 hover:text-[var(--color-brass-bright)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Undo last attempt"
          title="Undo last attempt"
        >
          <CornerDownLeft size={15} />
        </button>
      </div>

      {/* Sparkline of recent sessions (last ~10) */}
      {stats.sessions.length > 0 && <Sparkline sessions={stats.sessions} />}
    </div>
  );
}

function ScoreCell({
  label,
  makes,
  attempts,
  pct,
  highlight = false,
}: {
  label: string;
  makes: number;
  attempts: number;
  pct: number | null;
  highlight?: boolean;
}) {
  return (
    <div className="relative px-4 py-4 text-center sm:px-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/50">
        {label}
      </p>
      <p className="mt-1.5 font-[family-name:var(--font-display)] text-5xl leading-[0.85] tracking-wide tabular-nums">
        <span className={highlight && makes > 0 ? "pm-foil" : "text-[var(--color-cream)]"}>
          {makes}
        </span>
        <span className="text-3xl text-[var(--color-cream)]/30">/{attempts}</span>
      </p>
      <p className="mt-1.5 text-[11px] text-[var(--color-cream)]/50">
        {pct === null ? "no attempts yet" : `${pct}% made`}
      </p>
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
    <div className="mt-5 border-t border-[var(--color-cream)]/[0.07] pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/45">
        Recent sessions
      </p>
      <div className="mt-3 flex items-end gap-1.5">
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
                className="rounded-t-[3px] bg-gradient-to-t from-[var(--color-felt-bright)]/70 to-[var(--color-felt-text)]"
              />
              <div
                style={{ height: `${missHeight}%` }}
                className="bg-[var(--color-pop)]/40"
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-cream)]/45">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-[var(--color-felt-text)]" />
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

