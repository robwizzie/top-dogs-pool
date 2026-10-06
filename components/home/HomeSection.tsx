import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Home-page section with an indexed editorial header: a large hollow numeral,
 * eyebrow + title, and a brass hairline that runs out to the right edge.
 */
export function HomeSection({
  index,
  eyebrow,
  title,
  action,
  children,
  className,
}: {
  index?: string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("py-12 sm:py-16", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(title || eyebrow) && (
          <header className="mb-7 flex items-end gap-4 sm:mb-9 sm:gap-6">
            {index && (
              <span
                aria-hidden
                className="pm-outline -mb-1 font-[family-name:var(--font-display)] text-6xl leading-none opacity-40 [-webkit-text-stroke-width:1px] sm:text-7xl"
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
              {title && (
                <h2 className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide text-[var(--color-cream)] sm:text-5xl">
                  {title}
                </h2>
              )}
            </div>
            <div className="pm-rule mb-2 hidden flex-1 sm:block" aria-hidden />
            {action && <div className="mb-1 ml-auto shrink-0 sm:ml-0">{action}</div>}
          </header>
        )}
        <div className="pm-reveal">{children}</div>
      </div>
    </section>
  );
}
