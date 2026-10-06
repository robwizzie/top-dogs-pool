import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { Difficulty } from "@/lib/kinister/shots";
import { cn } from "@/lib/utils";

/**
 * Small presentational pieces shared by the Training pages (shot catalog,
 * shot / drill detail, Dawg Drill, stats, glossary) so they speak the same
 * "lamp over the felt" language as the home page. Pure markup — safe to use
 * from both server and client components.
 */

/** Difficulty → pill colours (felt / brass / pop). */
export const DIFFICULTY_TONE: Record<Difficulty, string> = {
  Foundational:
    "border-[var(--color-felt-bright)]/45 bg-[var(--color-felt-bright)]/[0.12] text-[#5fc48a]",
  Intermediate:
    "border-[var(--color-brass)]/45 bg-[var(--color-brass)]/[0.12] text-[var(--color-brass-bright)]",
  Advanced:
    "border-[var(--color-pop)]/45 bg-[var(--color-pop)]/[0.12] text-[var(--color-pop-bright)]",
};

/** The little glowing dot that leads a difficulty pill. */
const DIFFICULTY_DOT: Record<Difficulty, string> = {
  Foundational: "bg-[var(--color-felt-bright)] shadow-[0_0_8px_1px_rgba(46,139,87,0.9)]",
  Intermediate: "bg-[var(--color-brass-bright)] shadow-[0_0_8px_1px_rgba(224,190,107,0.8)]",
  Advanced: "bg-[var(--color-pop-bright)] shadow-[0_0_8px_1px_rgba(232,82,72,0.8)]",
};

export function DifficultyPill({
  difficulty,
  size = "sm",
  short = false,
  className,
}: {
  difficulty: Difficulty;
  size?: "sm" | "md";
  /** Abbreviate to the first four letters (tight catalog cards). */
  short?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold uppercase",
        size === "md"
          ? "h-9 px-3.5 text-[11px] tracking-[0.2em]"
          : "px-2 py-[3px] text-[9.5px] tracking-[0.18em]",
        DIFFICULTY_TONE[difficulty],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DIFFICULTY_DOT[difficulty])} />
      {short ? difficulty.slice(0, 4) : difficulty}
    </span>
  );
}

/** Brass eyebrow used inside cards: optional icon + spaced caps. */
export function PanelLabel({
  icon,
  children,
  tone = "brass",
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "brass" | "pop" | "felt" | "dim";
  className?: string;
}) {
  const color =
    tone === "pop"
      ? "text-[var(--color-pop-bright)]"
      : tone === "felt"
        ? "text-[#5fc48a]"
        : tone === "dim"
          ? "text-[var(--color-cream)]/50"
          : "text-[var(--color-brass)]";
  return (
    <div className={cn("flex items-center gap-2", color, className)}>
      {icon && <span className="flex shrink-0 items-center">{icon}</span>}
      <p className="text-[10px] font-semibold uppercase tracking-[0.32em]">
        {children}
      </p>
    </div>
  );
}

/** Pill-shaped "back" link for the PageHeader's chip row. */
export function HeaderBackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-cream)]/70 backdrop-blur-sm transition-colors hover:border-[var(--color-brass)]/50 hover:text-[var(--color-brass-bright)]"
    >
      <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
      {children}
    </Link>
  );
}

/** Quiet glass chip for quick facts in the PageHeader. */
export function HeaderChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/70 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Secondary pill button/link look (brass outline on smoked glass). */
export const SECONDARY_PILL =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--color-brass)]/40 bg-black/30 px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10";

/** Neutral ghost pill (tertiary actions). */
export const GHOST_PILL =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--color-cream)]/10 bg-white/[0.03] px-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/60 transition-colors hover:border-[var(--color-cream)]/20 hover:text-[var(--color-cream)] disabled:cursor-not-allowed disabled:opacity-40";

/** Recessed track that pill toggles sit in. */
export const PILL_TRACK =
  "inline-flex items-center gap-1 rounded-full bg-black/45 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.05)]";

/** A single toggle inside a PILL_TRACK; style the active state with data-active. */
export const PILL_TOGGLE =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs font-semibold tracking-wide text-[var(--color-cream)]/55 transition-all hover:text-[var(--color-cream)] data-[active=true]:bg-gradient-to-b data-[active=true]:from-[#f0d48a] data-[active=true]:via-[#c9a24a] data-[active=true]:to-[#b38b36] data-[active=true]:text-[var(--color-ink)] data-[active=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_6px_16px_-8px_rgba(201,162,74,0.9)]";

/**
 * Stage for a table diagram: a dark room with an overhead billiard lamp —
 * brass bar, three glowing shades and a warm cone falling onto the felt —
 * so the diagram reads like a real table under a light.
 */
export function LampStage({
  children,
  className,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  /** Smaller lamp + padding for secondary diagrams. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "pm-glass pm-grain relative overflow-hidden",
        compact ? "px-3 pb-3 pt-9 sm:px-4 sm:pb-4" : "px-3 pb-3 pt-12 sm:px-6 sm:pb-6 sm:pt-16",
        className,
      )}
    >
      {/* room light: warm pool under the lamp, felt bounce below */}
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_50%_8%,rgba(255,226,160,0.16),transparent_70%),radial-gradient(80%_60%_at_50%_75%,rgba(46,139,87,0.22),transparent_70%)]"
        aria-hidden
      />
      <div
        className="pm-cone pointer-events-none absolute left-1/2 top-4 -z-10 h-[90%] w-[130%] -translate-x-1/2 opacity-70"
        aria-hidden
      />
      {/* the lamp */}
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-0 z-[2] flex -translate-x-1/2 flex-col items-center",
          compact ? "w-[58%]" : "w-[62%]",
        )}
        aria-hidden
      >
        <div className="h-2 w-px bg-gradient-to-b from-transparent to-[var(--color-brass)]/60 sm:h-3" />
        <div className="h-[3px] w-full rounded-full bg-gradient-to-r from-[#8b6f2c] via-[#f0d48a] to-[#8b6f2c] shadow-[0_1px_0_rgba(0,0,0,0.6)]" />
        <div className="flex w-full justify-around">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex flex-col items-center">
              <span className="h-1.5 w-px bg-[var(--color-brass)]/70 sm:h-2" />
              <span
                className={cn(
                  "block bg-gradient-to-b from-[#1e5a3c] to-[#0d2f20] [clip-path:polygon(28%_0,72%_0,100%_100%,0_100%)]",
                  compact ? "h-3 w-8 sm:h-3.5 sm:w-10" : "h-3.5 w-9 sm:h-5 sm:w-14",
                )}
              />
              <span
                className={cn(
                  "block h-[3px] rounded-full bg-[#fff2cc] shadow-[0_0_14px_5px_rgba(255,226,160,0.55),0_0_40px_14px_rgba(255,220,150,0.18)]",
                  compact ? "w-8 sm:w-10" : "w-9 sm:w-14",
                )}
              />
            </span>
          ))}
        </div>
      </div>
      {/* the table itself sits on a soft contact shadow */}
      <div className="relative z-[1]">
        <div
          className="pointer-events-none absolute inset-x-[4%] -bottom-3 h-8 rounded-[50%] bg-black/70 blur-xl"
          aria-hidden
        />
        <div className="relative">{children}</div>
        {/* warm light pooling on the felt */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[55%] bg-[radial-gradient(45%_60%_at_50%_35%,rgba(255,228,170,0.1),transparent_70%)] mix-blend-screen"
          aria-hidden
        />
      </div>
    </div>
  );
}

/** Editorial section heading used between blocks on Training pages. */
export function TrainingHeading({
  index,
  eyebrow,
  title,
  action,
  className,
}: {
  index?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex items-end gap-4 sm:mb-8 sm:gap-6", className)}>
      {index && (
        <span
          aria-hidden
          className="pm-outline -mb-1 font-[family-name:var(--font-display)] text-5xl leading-none opacity-40 [-webkit-text-stroke-width:1px] sm:text-6xl"
        >
          {index}
        </span>
      )}
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
      {action && <div className="mb-1 ml-auto shrink-0 sm:ml-0">{action}</div>}
    </header>
  );
}
