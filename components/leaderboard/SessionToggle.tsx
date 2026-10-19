"use client";

import { useRouter } from "next/navigation";

/**
 * One multi-select pill in the SessionPicker.
 *
 * This is a button, not a <Link>, on purpose. Each pill points at "current
 * selection ± this session", so as links they formed an unbounded graph:
 * every page linked to ~17 new combinations, every combination is its own
 * uncached /q/ render, and crawlers walked the whole 2^17 powerset (≈80k
 * Worker renders a day at ~0.8 s CPU each). <Link> also prefetched every
 * pill for real visitors, which cost ~17 extra renders per page view.
 *
 * A button keeps the same UX for people and gives crawlers nothing to follow.
 */
export function SessionToggle({
  href,
  active,
  className,
  children,
}: {
  href: string;
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      aria-pressed={active}
      onClick={() => router.push(href, { scroll: false })}
    >
      {children}
    </button>
  );
}
