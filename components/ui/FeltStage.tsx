import type { ReactNode } from "react";
import { BilliardLamp } from "@/components/home/BilliardLamp";
import { cn } from "@/lib/utils";

/**
 * Full-bleed "under the lamp" stage for single-moment pages (lock screens,
 * the 404): lamp-lit felt that runs up behind the floating site header —
 * same negative top margin as `PageHeader` — with the billiard lamp hanging
 * over a centered column. Render it first on the page.
 */
export function FeltStage({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "pm-grain relative mt-[calc(-5rem-env(safe-area-inset-top))] overflow-hidden",
        className,
      )}
    >
      <div className="pm-felt absolute inset-0 -z-20" aria-hidden />
      <div className="pm-lamp pm-lamp-flicker absolute inset-0 -z-10" aria-hidden />
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_85%_at_50%_25%,transparent_38%,rgba(0,0,0,0.78)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-[var(--bg)]"
        aria-hidden
      />
      <BilliardLamp className="pointer-events-none absolute inset-x-0 bottom-0 top-[calc(5rem+env(safe-area-inset-top))] z-[1] opacity-90" />

      <div
        className={cn(
          "relative z-[2] mx-auto flex max-w-7xl flex-col items-center px-4 pb-20 pt-[calc(5rem+env(safe-area-inset-top)+8.5rem)] sm:px-6 sm:pb-28 sm:pt-[calc(5rem+env(safe-area-inset-top)+10rem)] lg:px-8",
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
