import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { PoolBall } from "@/components/brand/PoolBall";

export function Section({
  title,
  eyebrow,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("py-10 sm:py-14", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(title || eyebrow || action) && (
          <header className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:flex-nowrap sm:gap-6">
            <div>
              {eyebrow && (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide text-[var(--color-cream)] sm:text-4xl">
                  {title}
                </h2>
              )}
            </div>
            <div className="pm-rule mb-2 hidden min-w-8 flex-1 sm:block" aria-hidden />
            {action}
          </header>
        )}
        <div className={contentClassName}>{children}</div>
      </div>
    </section>
  );
}

/**
 * Page-top hero shared by every interior page: lamp-lit felt that runs up
 * behind the floating site header (hence the negative top margin, matching
 * the header's height), a big display title and an optional subtitle.
 * Always render it first on the page.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  /** Optional extra content under the subtitle (chips, quick stats). */
  children?: ReactNode;
}) {
  return (
    <header className="pm-grain relative mt-[calc(-5rem-env(safe-area-inset-top))] overflow-hidden">
      <div className="pm-felt absolute inset-0 -z-20" aria-hidden />
      <div className="pm-lamp absolute inset-0 -z-10" aria-hidden />
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(110%_90%_at_50%_0%,transparent_35%,rgba(0,0,0,0.7)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-b from-transparent to-[var(--bg)]"
        aria-hidden
      />
      {/* A lone 8-ball resting on the felt, out of focus, for depth. */}
      <div
        className="pointer-events-none absolute -right-16 top-1/2 -z-10 hidden -translate-y-1/3 opacity-50 blur-[2px] drop-shadow-[0_40px_40px_rgba(0,0,0,0.7)] md:block lg:right-[6%]"
        aria-hidden
      >
        <PoolBall number={8} size={260} />
      </div>

      <div className="relative z-[2] mx-auto max-w-7xl px-4 pb-12 pt-[calc(5rem+env(safe-area-inset-top)+2.75rem)] sm:px-6 sm:pb-16 sm:pt-[calc(5rem+env(safe-area-inset-top)+4rem)] lg:px-8">
        {eyebrow && (
          <p className="fade-in-up mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)] backdrop-blur-sm sm:text-[11px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-felt-bright)] shadow-[0_0_10px_2px_rgba(46,139,87,0.8)]" />
            <span className="truncate">{eyebrow}</span>
          </p>
        )}
        <h1
          className="fade-in-up max-w-4xl font-[family-name:var(--font-display)] text-5xl leading-[0.9] tracking-wide text-[var(--color-cream)] drop-shadow-[0_6px_30px_rgba(0,0,0,0.5)] sm:text-7xl lg:text-8xl"
          style={{ animationDelay: "60ms" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="fade-in-up mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-cream)]/70 sm:text-lg"
            style={{ animationDelay: "140ms" }}
          >
            {subtitle}
          </p>
        )}
        {children && (
          <div className="fade-in-up mt-6" style={{ animationDelay: "200ms" }}>
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
