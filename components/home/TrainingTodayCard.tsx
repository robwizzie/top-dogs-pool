"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Dog, Flame, Sparkles } from "lucide-react";
import type { KinisterShot } from "@/lib/kinister/shots";
import {
  daysSinceLastAttempt,
  useAllShotStats,
} from "@/lib/kinister/useShotStats";
import { currentDailyStreak } from "@/lib/kinister/achievements";

/**
 * Compact home-page card surfacing the player's current practice streak +
 * how many shots are due, with a one-tap "Build today's drill" button that
 * deep-links into the Dawg Drill builder pre-filled with due shots.
 */
export function TrainingTodayCard({ shots }: { shots: KinisterShot[] }) {
  const stats = useAllShotStats();

  const summary = useMemo(() => {
    const dates = new Set<string>();
    let triedCount = 0;
    let dueCount = 0;
    let untriedCount = 0;
    for (const shot of shots) {
      const s = stats[shot.id];
      if (!s || s.totalAttempts === 0) {
        untriedCount += 1;
        continue;
      }
      triedCount += 1;
      for (const ses of s.sessions) dates.add(ses.date);
      const days = daysSinceLastAttempt(s);
      if (days !== null && days >= 3) dueCount += 1;
    }
    return {
      streak: currentDailyStreak(dates),
      triedCount,
      dueCount,
      untriedCount,
    };
  }, [shots, stats]);

  const hasData = summary.triedCount > 0;

  return (
    <div className="surface flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <Dog size={18} className="text-[var(--color-brass-bright)]" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          Training today
        </p>
      </div>

      {hasData ? (
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Streak"
            value={`${summary.streak}d`}
            icon={<Flame size={14} />}
            sub={
              summary.streak === 0
                ? "Practice today to start one"
                : "Consecutive days"
            }
          />
          <Stat
            label="Due to drill"
            value={summary.dueCount.toString()}
            icon={<Sparkles size={14} />}
            sub={`${summary.untriedCount} you haven't tried yet`}
          />
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-[var(--fg-dim)]">
          Open the shot catalog and log a Made / Missed on any shot — your
          streak, stats, and a daily drill will start filling in.
        </p>
      )}

      <Link
        href="/dawg-drill?preset=today"
        className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-4 text-sm font-semibold tracking-wide text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)]"
      >
        Build today&apos;s drill
        <ArrowRight size={14} />
      </Link>
      <Link
        href="/stats"
        className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
      >
        Open practice stats →
      </Link>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <div className="flex items-center gap-1.5 text-[var(--fg-dim)]">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em]">
          {label}
        </p>
      </div>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide text-[var(--color-brass-bright)]">
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[10px] leading-tight text-[var(--fg-dim)]">
          {sub}
        </p>
      )}
    </div>
  );
}
