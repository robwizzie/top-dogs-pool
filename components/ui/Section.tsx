import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

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
          <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              {eyebrow && (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">
                  {title}
                </h2>
              )}
            </div>
            {action}
          </header>
        )}
        <div className={contentClassName}>{children}</div>
      </div>
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {eyebrow && (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            {eyebrow}
          </p>
        )}
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-2xl text-[var(--fg-dim)]">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
