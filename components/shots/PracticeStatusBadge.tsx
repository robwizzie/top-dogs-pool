"use client";

import { Clock, Flame, Sparkle } from "lucide-react";
import {
  daysSinceLastAttempt,
  useShotStats,
} from "@/lib/kinister/useShotStats";

/**
 * Tiny client-only badge for shot cards: "Practiced today", "5 days ago",
 * "Never tried" — a gentle spaced-repetition nudge.
 */
export function PracticeStatusBadge({ shotId }: { shotId: string }) {
  const { stats } = useShotStats(shotId);
  if (stats.totalAttempts === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
        <Sparkle size={10} />
        Not yet tried
      </span>
    );
  }
  const days = daysSinceLastAttempt(stats);
  if (days === null) return null;
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-felt-bright)]/40 bg-[var(--color-felt-deep)]/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-felt-bright)]">
        <Flame size={10} />
        Today
      </span>
    );
  }
  if (days <= 2) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-brass)]/40 bg-[var(--color-brass)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brass-bright)]">
        <Clock size={10} />
        {days}d ago
      </span>
    );
  }
  // 3+ days since last attempt — surface as "due"
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-pop)]/40 bg-[var(--color-pop)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-pop-bright)]">
      <Clock size={10} />
      Due · {days}d
    </span>
  );
}
