import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatCounter } from "@/components/ui/StatCounter";

/**
 * The KPI row above the board.
 *
 * Four headline numbers, each with what it moved by on the most recent match
 * night. The delta is the part that matters — a season total alone says
 * nothing about whether it was a good week, which is the question anyone
 * opening this page on a Wednesday is actually asking.
 *
 * Tiles deliberately stay smaller than the podium's leading score: one hero
 * figure per view, and on this page that's whoever is winning.
 */

export type Tile = {
  label: string;
  value: number;
  /** Change on the latest match night. Omit when there's nothing to compare. */
  delta?: number | null;
  /** Rendered after the value, e.g. "pts". */
  unit?: string;
  decimals?: number;
  accent?: string;
};

export function StatTiles({ tiles }: { tiles: Tile[] }) {
  if (tiles.length === 0) return null;
  const n = tiles.length;
  return (
    <dl className="pm-rail relative mt-1.5 grid grid-cols-2 sm:grid-cols-4">
      {/* brass diamond sights inlaid between the cells */}
      {tiles.map((_, i) =>
        i === 0 ? null : (
          <span
            key={i}
            aria-hidden
            className="pm-diamond hidden sm:block"
            style={{ left: `${(i / n) * 100}%`, top: "50%" }}
          />
        ),
      )}
      {tiles.map((t, i) => (
        <StatTile key={t.label} {...t} index={i} />
      ))}
    </dl>
  );
}

function StatTile({
  label,
  value,
  delta,
  unit,
  decimals = 0,
  accent,
  index,
}: Tile & { index: number }) {
  return (
    <div
      className={cn(
        "relative min-w-0 border-[var(--color-cream)]/[0.07] px-4 py-4 sm:px-5 sm:py-5",
        index % 2 === 1 && "border-l",
        index >= 2 && "border-t sm:border-t-0",
        index > 0 && "sm:border-l",
      )}
    >
      <dt className="truncate text-[9px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/50 sm:text-[10px]">
        {label}
      </dt>
      <dd className="mt-2 flex items-center gap-2">
        <span
          className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide tabular-nums sm:text-[2.6rem]"
          style={{ color: accent ?? "var(--color-cream)" }}
        >
          <StatCounter value={value} decimals={decimals} delay={index * 90} />
        </span>
        {unit && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-cream)]/50">
            {unit}
          </span>
        )}
        <Delta value={delta} />
      </dd>
    </div>
  );
}

/**
 * The week's change. Signed text carries the direction, so the colour is
 * reinforcement rather than the only channel.
 */
function Delta({ value }: { value?: number | null }) {
  if (value === undefined || value === null || value === 0) return null;
  const up = value > 0;
  return (
    <span
      className={cn(
        "ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        up
          ? "bg-[var(--color-felt-bright)]/15 text-[var(--color-felt-bright)]"
          : "bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]",
      )}
      title="Change this week"
    >
      {up ? "+" : "−"}
      {Math.abs(value) % 1 === 0
        ? Math.abs(value)
        : Math.abs(value).toFixed(1)}
    </span>
  );
}

/** Collapsible scoring key — reference, not something to scroll past weekly. */
export function ScoringKey({ children }: { children: ReactNode }) {
  return (
    <details className="pm-glass group mt-8 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <span className="h-2 w-2 shrink-0 rotate-45 rounded-[1px] bg-[var(--color-brass-bright)] shadow-[0_0_8px_rgba(224,190,107,0.6)]" aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-brass)]">
            How points work
          </span>
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--color-brass)]/30 text-xs text-[var(--color-brass-bright)] transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="relative border-t border-[var(--color-cream)]/[0.07] p-5 pt-4 text-sm leading-relaxed text-[var(--color-cream)]/60">
        {children}
      </div>
    </details>
  );
}
