import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Small presentational kit shared by the scouting / match pages (match
 * recap, opponent + opposing-player profiles, briefing, research). Pure
 * styling — no data logic — so the pages read as one family with the home
 * page: editorial section heads, walnut-rail stat strips, refined tables.
 */

/** Display face shorthand. */
export const DISPLAY = "font-[family-name:var(--font-display)] tracking-wide";

/** Eyebrow — tiny tracked uppercase brass label. */
export const EYEBROW =
  "text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-brass)]";

/* ---------- tables ---------- */

/** Scroll container for a table inside a `.surface` card. */
export const TABLE_WRAP = "surface overflow-x-auto overscroll-x-contain";
/** `<thead><tr>` row. */
export const THEAD_ROW =
  "border-b border-[var(--color-cream)]/[0.08] bg-black/25 text-left";
/** `<th>` cell — eyebrow style. */
export const TH =
  "whitespace-nowrap px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-brass)]/85";
/** `<tbody><tr>` row — hairline divider + hover wash. */
export const TR =
  "border-b border-[var(--color-cream)]/[0.06] transition-colors last:border-0 hover:bg-white/[0.025]";
/** Highlight for "our team" / current-session rows. */
export const TR_OURS =
  "bg-[var(--color-brass)]/[0.07] shadow-[inset_3px_0_0_var(--color-brass)] hover:bg-[var(--color-brass)]/[0.1]";
/** Bebas tabular numerals for table numbers. */
export const NUM = `${DISPLAY} text-lg leading-none tabular-nums`;

/* ---------- section head ---------- */

/**
 * Editorial section header: optional hollow index numeral, eyebrow, Bebas
 * title, a brass hairline running out to the right, and an optional action.
 */
export function SectionHead({
  index,
  eyebrow,
  title,
  sub,
  action,
  className,
}: {
  index?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5 sm:mb-6", className)}>
      <div className="flex items-end gap-3 sm:gap-5">
        {index && (
          <span
            aria-hidden
            className="pm-outline -mb-0.5 font-[family-name:var(--font-display)] text-5xl leading-none opacity-40 [-webkit-text-stroke-width:1px] sm:text-6xl"
          >
            {index}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className={cn(EYEBROW, "mb-1.5")}>{eyebrow}</p>}
          <h2
            className={cn(
              DISPLAY,
              "text-3xl leading-[0.95] text-[var(--color-cream)] sm:text-4xl",
            )}
          >
            {title}
          </h2>
        </div>
        <div className="pm-rule mb-2 hidden min-w-8 flex-1 sm:block" aria-hidden />
        {action && <div className="mb-1 ml-auto shrink-0 sm:ml-0">{action}</div>}
      </div>
      {sub && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-cream)]/60">
          {sub}
        </p>
      )}
    </header>
  );
}

/* ---------- hero chips ---------- */

/** Row of glassy chips for a PageHeader's children slot. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function Chip({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "brass" | "win" | "loss" | "tie";
  className?: string;
}) {
  const toneCls =
    tone === "brass"
      ? "border-[var(--color-brass)]/40 text-[var(--color-brass-bright)]"
      : tone === "win"
        ? "border-[var(--color-felt-bright)]/45 text-[var(--color-felt-text)]"
        : tone === "loss"
          ? "border-[var(--color-pop-bright)]/45 text-[var(--color-pop-bright)]"
          : tone === "tie"
            ? "border-[var(--color-tie)]/45 text-[var(--color-tie-bright)]"
            : "border-white/10 text-[var(--color-cream)]/80";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-black/30 px-3 py-1.5 text-xs font-medium backdrop-blur-sm",
        toneCls,
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- stat rail ---------- */

export type RailStat = {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  /** Foil (one per view), or a semantic tint for the number. */
  tone?: "foil" | "win" | "loss" | "tie" | "brass";
};

/**
 * Walnut table-rail stat strip (the home hero's scoreboard look) with brass
 * diamond sights. 2 columns on phones (or 3 when `mobileCols` is 3), one row
 * from `sm` up.
 */
export function StatRail({
  stats,
  mobileCols = 2,
  className,
  size = "lg",
}: {
  stats: RailStat[];
  mobileCols?: 2 | 3;
  className?: string;
  size?: "md" | "lg";
}) {
  const n = stats.length;
  const smCols =
    n >= 5 ? "sm:grid-cols-5" : n === 4 ? "sm:grid-cols-4" : n === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <dl
      className={cn(
        "pm-rail relative grid",
        mobileCols === 3 ? "grid-cols-3" : "grid-cols-2",
        smCols,
        className,
      )}
    >
      {stats.map((_, i) => (
        <span
          key={`d${i}`}
          aria-hidden
          className="pm-diamond hidden sm:block"
          style={{ left: `${((i + 0.5) / n) * 100}%`, top: 12 }}
        />
      ))}
      {stats.map((s, i) => {
        const mobileL = i % mobileCols !== 0;
        const mobileT = i >= mobileCols;
        // An odd one out on a 2-up phone grid spans the full row.
        const span = mobileCols === 2 && i === n - 1 && n % 2 === 1;
        const toneCls =
          s.tone === "foil"
            ? "pm-foil"
            : s.tone === "win"
              ? "text-[#6fcf97]"
              : s.tone === "loss"
                ? "text-[var(--color-pop-bright)]"
                : s.tone === "tie"
                  ? "text-[var(--color-tie-bright)]"
                  : s.tone === "brass"
                    ? "text-[var(--color-brass-bright)]"
                    : "text-[var(--color-cream)]";
        return (
          <div
            key={i}
            className={cn(
              "relative min-w-0 border-[var(--color-cream)]/[0.08] px-4 pb-4 pt-6 sm:px-6 sm:pb-5 sm:pt-7",
              mobileL ? "border-l" : i !== 0 ? "sm:border-l" : "",
              mobileT && "border-t sm:border-t-0",
              span && "col-span-2 sm:col-span-1",
            )}
          >
            <dt className="text-[10px] font-semibold uppercase leading-snug tracking-[0.22em] text-[var(--color-cream)]/50 sm:truncate sm:tracking-[0.26em]">
              {s.label}
            </dt>
            <dd
              className={cn(
                DISPLAY,
                "mt-1.5 leading-none tabular-nums",
                size === "lg" ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl",
                toneCls,
              )}
            >
              {s.value}
            </dd>
            {s.sub && (
              <p className="mt-1.5 text-[11px] leading-snug text-[var(--color-cream)]/45 sm:truncate">
                {s.sub}
              </p>
            )}
          </div>
        );
      })}
    </dl>
  );
}

/* ---------- W / L / T pill ---------- */

export function OutcomePill({
  outcome,
  className,
}: {
  outcome: "W" | "L" | "T" | "—" | string;
  className?: string;
}) {
  const cls =
    outcome === "W"
      ? "bg-[var(--color-felt-bright)]/15 text-[var(--color-felt-text)] ring-[var(--color-felt-bright)]/40"
      : outcome === "L"
        ? "bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)] ring-[var(--color-pop-bright)]/35"
        : outcome === "T"
          ? "bg-[var(--color-tie)]/15 text-[var(--color-tie-bright)] ring-[var(--color-tie)]/40"
          : "bg-white/5 text-[var(--color-cream)]/50 ring-white/10";
  return (
    <span
      className={cn(
        DISPLAY,
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full pt-px text-base leading-none ring-1 ring-inset",
        cls,
        className,
      )}
    >
      {outcome}
    </span>
  );
}
