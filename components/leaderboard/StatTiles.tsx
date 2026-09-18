import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} />
      ))}
    </dl>
  );
}

function StatTile({ label, value, delta, unit, decimals = 0, accent }: Tile) {
  const shown = decimals > 0 ? value.toFixed(decimals) : String(value);
  return (
    <div className="surface px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
        {label}
      </dt>
      <dd className="mt-1 flex items-baseline gap-1.5">
        <span
          className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide"
          style={{ color: accent ?? "var(--color-cream)" }}
        >
          {shown}
        </span>
        {unit && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--fg-dim)]">
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
        "ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
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
    <details className="surface group mt-6 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-semibold">
        How points work
        <span className="text-xs font-normal text-[var(--fg-dim)] transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-[var(--border)] p-5 pt-4 text-sm text-[var(--fg-dim)]">
        {children}
      </div>
    </details>
  );
}
