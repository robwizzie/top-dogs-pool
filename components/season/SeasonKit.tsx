import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Small shared pieces for the Season pages (roster, player, schedule,
 * standings, Patch Watch) so they speak the same language as the home page:
 * a walnut scoreboard rail for quick stats, an editorial section heading with
 * a brass hairline, and glossy W/L/T ball tokens.
 */

export type RailCell = {
  label: ReactNode;
  value: ReactNode;
  /** Optional small line under the value. */
  note?: ReactNode;
  /** Highlight the value (brass foil). Use for one cell per rail. */
  accent?: boolean;
};

/**
 * Walnut table-rail scoreboard with brass diamond sights, sized to sit inside
 * a `PageHeader` (or above a section). 2-up on phones, one row from `sm`.
 */
export function HeaderRail({
  cells,
  className,
  size = "md",
}: {
  cells: RailCell[];
  className?: string;
  /** "lg" for a full-width in-page scoreboard. */
  size?: "md" | "lg";
}) {
  const lg = size === "lg";
  if (cells.length === 0) return null;
  const n = cells.length;
  return (
    <dl
      className={cn(
        "pm-rail relative mt-2 grid max-w-3xl grid-cols-2",
        n === 3 ? "sm:grid-cols-3" : n >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-2",
        className,
      )}
    >
      {cells.map((_, i) =>
        i === 0 ? null : (
          <span
            key={i}
            aria-hidden
            className="pm-diamond hidden sm:block"
            style={{ left: `${(i / n) * 100}%`, top: "50%" }}
          />
        ),
      )}
      {cells.map((c, i) => (
        <div
          key={i}
          className={cn(
            "relative min-w-0 border-[var(--color-cream)]/[0.07]",
            lg ? "px-5 py-5 sm:px-7 sm:py-6" : "px-4 py-3.5 sm:px-5 sm:py-4",
            // 2×2 grid on phones: hairlines between cells.
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t sm:border-t-0",
            i > 0 && "sm:border-l",
            // A lone trailing cell spans the row on phones.
            n % 2 === 1 && i === n - 1 && "col-span-2 sm:col-span-1",
          )}
        >
          <dt className="truncate text-[9px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/50 sm:text-[10px]">
            {c.label}
          </dt>
          <dd
            className={cn(
              "truncate font-[family-name:var(--font-display)] leading-none tracking-wide tabular-nums",
              lg ? "mt-2 text-5xl sm:text-6xl" : "mt-1.5 text-3xl sm:text-4xl",
              c.accent ? "pm-foil" : "text-[var(--color-cream)]",
            )}
          >
            {c.value}
          </dd>
          {c.note && (
            <p className="mt-1 truncate text-[10px] uppercase tracking-[0.2em] text-[var(--color-cream)]/40">
              {c.note}
            </p>
          )}
        </div>
      ))}
    </dl>
  );
}

/**
 * In-page section heading: eyebrow + Bebas title, a brass hairline running
 * out to the right, and an optional action / aside.
 */
export function SeasonHeading({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex items-end gap-4 sm:gap-6", className)}>
      <div className="min-w-0 shrink-0">
        {eyebrow && (
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.34em] text-[var(--color-brass)]">
            {eyebrow}
          </p>
        )}
        <h2 className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide text-[var(--color-cream)] sm:text-4xl">
          {title}
        </h2>
      </div>
      <div className="pm-rule mb-2 hidden flex-1 sm:block" aria-hidden />
      {action && <div className="mb-1 ml-auto min-w-0 sm:ml-0">{action}</div>}
    </header>
  );
}

const BALL = {
  W: {
    ball: "radial-gradient(circle at 32% 28%, #9be3b6 0%, #2e8b57 38%, #134d2f 80%, #0b2a1e 100%)",
    glow: "rgba(46,139,87,0.55)",
  },
  L: {
    ball: "radial-gradient(circle at 32% 28%, #ffb1aa 0%, #e85248 36%, #8f1f1a 80%, #4d0f0c 100%)",
    glow: "rgba(232,82,72,0.5)",
  },
  T: {
    ball: "radial-gradient(circle at 32% 28%, #ffe7a8 0%, #f4c453 36%, #a06f12 80%, #57400b 100%)",
    glow: "rgba(244,196,83,0.5)",
  },
  N: {
    ball: "radial-gradient(circle at 32% 28%, #5b5e5a 0%, #2a2c29 40%, #141513 85%, #0b0c0b 100%)",
    glow: "rgba(0,0,0,0)",
  },
} as const;

/**
 * Glossy result ball — a pool ball in the outcome's colour with the letter on
 * the white spot (same token as the home page's form guide). `N` is a neutral
 * dark ball for byes / no result.
 */
export function ResultBall({
  outcome,
  size = 36,
  label,
  glow = false,
  className,
}: {
  outcome: "W" | "L" | "T" | "N";
  size?: number;
  /** Text on the spot; defaults to the outcome letter. */
  label?: string;
  glow?: boolean;
  className?: string;
}) {
  const tone = BALL[outcome];
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-display)] leading-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: tone.ball,
        boxShadow: `0 6px 14px -4px rgba(0,0,0,0.7)${glow ? `, 0 0 22px -2px ${tone.glow}` : ""}`,
      }}
      aria-hidden
    >
      <span className="flex h-[58%] w-[58%] items-center justify-center rounded-full bg-[#f6efdc] pt-[0.08em] text-[var(--color-ink)] shadow-inner">
        {label ?? (outcome === "N" ? "–" : outcome)}
      </span>
    </span>
  );
}
