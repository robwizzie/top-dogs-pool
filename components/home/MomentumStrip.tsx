import Link from "next/link";
import { Flame } from "lucide-react";
import type { MomentumChip } from "@/lib/research";
import { cn } from "@/lib/utils";

/**
 * Last-N match outcomes laid out most-recent-first (left → right). Two-row
 * 5×2 grid on mobile, one-row 10× grid on desktop, so each cell always has
 * room to show opponent + score without truncation gymnastics.
 */
export function MomentumStrip({
  chips,
  streak,
}: {
  chips: MomentumChip[];
  streak: { outcome: "W" | "L" | "T" | null; count: number };
}) {
  if (chips.length === 0) return null;

  // Source data is oldest → newest. Reverse so the latest match leads.
  const ordered = [...chips].reverse();

  const showStreak =
    streak.outcome !== null && streak.outcome !== "T" && streak.count >= 3;
  const wins = chips.filter((c) => c.outcome === "W").length;
  const losses = chips.filter((c) => c.outcome === "L").length;
  const ties = chips.length - wins - losses;

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] bg-[var(--bg-soft)]/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Last {chips.length}
          </span>
          <span className="font-[family-name:var(--font-display)] text-lg tracking-wide tabular-nums text-[var(--color-cream)]">
            {wins}–{losses}
            {ties > 0 ? `–${ties}` : ""}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.24em] text-[var(--fg-dim)]">
          newest → oldest
        </span>
        {showStreak && (
          <div className="ml-auto flex items-center gap-1.5">
            <Flame
              size={14}
              className={
                streak.outcome === "W"
                  ? "text-[var(--color-felt-bright)]"
                  : "text-[var(--color-pop-bright)]"
              }
              fill="currentColor"
            />
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.32em]",
                streak.outcome === "W"
                  ? "text-[var(--color-felt-bright)]"
                  : "text-[var(--color-pop-bright)]",
              )}
            >
              {streak.count}-match {streak.outcome === "W" ? "win" : "loss"} streak
            </span>
          </div>
        )}
      </div>

      {/* Cells — 5×2 on mobile, 10×1 on lg. Each cell stacks: outcome badge,
       *  opponent name (truncated), score. Corner cells get matching radii so
       *  the inset brass ring on the latest cell, hover backgrounds, and inner
       *  borders all trace the parent's rounded outline cleanly. */}
      <div className="grid grid-cols-5 lg:grid-cols-10">
        {ordered.map((c, i) => {
          const tone =
            c.outcome === "W"
              ? "bg-[var(--color-felt-bright)]/10 hover:bg-[var(--color-felt-bright)]/20"
              : c.outcome === "L"
                ? "bg-[var(--color-pop)]/10 hover:bg-[var(--color-pop)]/20"
                : "bg-[var(--color-tie)]/10 hover:bg-[var(--color-tie)]/20";
          const badgeBg =
            c.outcome === "W"
              ? "bg-[var(--color-felt-bright)]/25 text-[var(--color-felt-bright)]"
              : c.outcome === "L"
                ? "bg-[var(--color-pop)]/25 text-[var(--color-pop-bright)]"
                : "bg-[var(--color-tie)]/25 text-[var(--color-tie-bright)]";
          const isLatest = i === 0;

          // Per-cell corner rounding so the inset ring follows the parent's
          // 1rem (--radius-card) outline. Mobile is a 5×2 grid; desktop is a
          // single 10-wide row, so corner positions differ by breakpoint.
          //
          //   index → corner
          //   0     → mobile TL · desktop TL+BL
          //   4     → mobile TR · desktop nothing
          //   5     → mobile BL · desktop nothing
          //   9     → mobile BR · desktop TR+BR
          const corners: string[] = [];
          if (i === 0) corners.push("rounded-tl-[1rem] lg:rounded-bl-[1rem]");
          if (i === 4) corners.push("rounded-tr-[1rem] lg:rounded-none");
          if (i === 5) corners.push("rounded-bl-[1rem] lg:rounded-none");
          if (i === 9) corners.push("rounded-br-[1rem] lg:rounded-tr-[1rem]");

          return (
            <Link
              key={c.matchId}
              href={`/matches/${c.matchId}`}
              title={`${c.outcome} vs ${c.opponent} · ${c.teamScore}–${c.opponentScore} · ${new Date(c.date).toLocaleDateString()}`}
              className={cn(
                "group relative flex min-w-0 flex-col items-center gap-1.5 px-2 py-3 text-center transition-colors",
                tone,
                // Vertical separators (skip first-of-row cells)
                "[&:not(:nth-child(5n+1))]:border-l lg:[&:not(:first-child)]:border-l border-[var(--border)]",
                // Horizontal separator below first row on mobile only
                "lg:border-b-0",
                i < 5 && "border-b border-[var(--border)] lg:border-b-0",
                isLatest && "ring-1 ring-inset ring-[var(--color-brass)]/50",
                ...corners,
              )}
            >
              {isLatest && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-brass-bright)] to-transparent"
                />
              )}
              <span
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-base leading-none tracking-wide",
                  badgeBg,
                )}
              >
                {c.outcome}
              </span>
              <span className="block w-full truncate text-[11px] font-medium leading-tight text-[var(--fg)]">
                {c.opponent}
              </span>
              <span className="text-[10px] tabular-nums text-[var(--fg-dim)]">
                {c.teamScore}–{c.opponentScore}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
