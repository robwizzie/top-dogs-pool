import type { MomentumChip } from "@/lib/research";
import { cn } from "@/lib/utils";

/**
 * Scoreboard-style crawl of recent results under the hero. The list is
 * rendered twice and the track slides by exactly one copy, so the loop is
 * seamless. Purely decorative motion — the second copy is aria-hidden.
 */
export function ResultsTicker({ chips }: { chips: MomentumChip[] }) {
  if (chips.length === 0) return null;
  const items = [...chips].reverse();
  return (
    <div className="relative border-y border-[var(--color-cream)]/[0.07] bg-black/40 py-3 backdrop-blur-sm">
      <div className="pm-marquee-mask overflow-hidden">
        <div className="pm-marquee">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              aria-hidden={copy === 1 || undefined}
              className="flex shrink-0 items-center"
            >
              {items.map((c) => (
                <li
                  key={`${copy}-${c.matchId}`}
                  className="flex items-center gap-3 px-6 text-sm whitespace-nowrap"
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-[13px] leading-none",
                      c.outcome === "W"
                        ? "bg-[var(--color-felt-bright)] text-[var(--color-ink)]"
                        : c.outcome === "L"
                          ? "bg-[var(--color-pop)] text-white"
                          : "bg-[var(--color-tie)] text-[var(--color-ink)]",
                    )}
                  >
                    {c.outcome}
                  </span>
                  <span className="text-[var(--color-cream)]/60">vs</span>
                  <span className="font-medium text-[var(--color-cream)]">{c.opponent}</span>
                  {typeof c.teamScore === "number" && typeof c.opponentScore === "number" && (
                    <span className="font-[family-name:var(--font-display)] text-base tracking-wider tabular-nums text-[var(--color-brass-bright)]">
                      {c.teamScore}–{c.opponentScore}
                    </span>
                  )}
                  <span className="ml-3 text-[var(--color-brass)]/40">✦</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  );
}
