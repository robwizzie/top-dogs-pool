import Link from "next/link";
import { Flame } from "lucide-react";
import type { MomentumChip } from "@/lib/research";
import { cn } from "@/lib/utils";

const TONE = {
  W: {
    ball: "radial-gradient(circle at 32% 28%, #9be3b6 0%, #2e8b57 38%, #134d2f 80%, #0b2a1e 100%)",
    glow: "rgba(46,139,87,0.55)",
    text: "text-[var(--color-felt-bright)]",
  },
  L: {
    ball: "radial-gradient(circle at 32% 28%, #ffb1aa 0%, #e85248 36%, #8f1f1a 80%, #4d0f0c 100%)",
    glow: "rgba(232,82,72,0.5)",
    text: "text-[var(--color-pop-bright)]",
  },
  T: {
    ball: "radial-gradient(circle at 32% 28%, #ffe7a8 0%, #f4c453 36%, #a06f12 80%, #57400b 100%)",
    glow: "rgba(244,196,83,0.5)",
    text: "text-[var(--color-tie-bright)]",
  },
} as const;

/**
 * Form guide — the last N match outcomes as a rail of glossy balls, most
 * recent first (left → right). 5×2 on mobile, one row of 10 on desktop.
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
    <div className="pm-glass overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 pb-1 pt-5 sm:px-7">
        <div className="flex items-baseline gap-3">
          <span className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide tabular-nums text-[var(--color-cream)]">
            {wins}
            <span className="text-[var(--color-cream)]/30">–</span>
            {losses}
            {ties > 0 && (
              <>
                <span className="text-[var(--color-cream)]/30">–</span>
                {ties}
              </>
            )}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/50">
            Last {chips.length}
          </span>
        </div>
        {showStreak && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]",
              streak.outcome === "W"
                ? "border-[var(--color-felt-bright)]/40 bg-[var(--color-felt-bright)]/10 text-[var(--color-felt-bright)]"
                : "border-[var(--color-pop)]/40 bg-[var(--color-pop)]/10 text-[var(--color-pop-bright)]",
            )}
          >
            <Flame size={12} fill="currentColor" />
            {streak.count}-match {streak.outcome === "W" ? "win" : "skid"}
          </span>
        )}
        <span className="ml-auto hidden text-[10px] uppercase tracking-[0.28em] text-[var(--color-cream)]/35 sm:inline">
          Newest → oldest
        </span>
      </div>

      <ol className="relative grid grid-cols-5 gap-y-2 px-2 pb-4 pt-3 sm:px-4 lg:grid-cols-10">
        {/* The rail the balls sit on — desktop only, where they form a line. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-10 top-[2.6rem] hidden h-px bg-gradient-to-r from-[var(--color-brass)]/50 via-[var(--color-cream)]/10 to-transparent lg:block"
        />
        {ordered.map((c, i) => {
          const tone = TONE[c.outcome];
          const isLatest = i === 0;
          return (
            <li key={c.matchId} className="min-w-0">
              <Link
                href={`/matches/${c.matchId}`}
                title={`${c.outcome} vs ${c.opponent} · ${c.teamScore}–${c.opponentScore} · ${new Date(c.date).toLocaleDateString()}`}
                className="group flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-2 text-center transition-colors hover:bg-white/[0.04]"
              >
                <span
                  className={cn(
                    "relative inline-flex items-center justify-center rounded-full font-[family-name:var(--font-display)] leading-none text-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105",
                    isLatest ? "h-11 w-11 text-lg" : "h-9 w-9 text-base",
                  )}
                  style={{
                    background: tone.ball,
                    boxShadow: `0 6px 14px -4px rgba(0,0,0,0.7), 0 0 ${isLatest ? 22 : 0}px -2px ${tone.glow}`,
                  }}
                >
                  <span className="flex h-[58%] w-[58%] items-center justify-center rounded-full bg-[#f6efdc] text-[0.8em] text-[var(--color-ink)] shadow-inner">
                    {c.outcome}
                  </span>
                  {isLatest && (
                    <span className="absolute -inset-1.5 rounded-full border border-[var(--color-brass-bright)]/50" />
                  )}
                </span>
                <span className="block w-full truncate text-[11px] font-medium leading-tight text-[var(--color-cream)]/85">
                  {c.opponent}
                </span>
                <span className={cn("font-[family-name:var(--font-display)] text-sm leading-none tracking-wider tabular-nums", tone.text)}>
                  {c.teamScore}–{c.opponentScore}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
