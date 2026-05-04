"use client";

import { ArrowRight, Radio } from "lucide-react";
import { useIsPoolNightLive } from "@/lib/hooks/useIsPoolNightLive";
import { TIKTOK_LIVE_URL, TIKTOK_PROFILE_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost";

/**
 * TikTok call-to-action that swaps between "Live now" and "Follow" copy
 * depending on whether it's a pool-night window (Tue 7:30-11:30pm ET).
 */
export function LiveCTA({
  variant = "primary",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const live = useIsPoolNightLive();
  const href = live ? TIKTOK_LIVE_URL : TIKTOK_PROFILE_URL;

  if (variant === "ghost") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition-colors",
          live
            ? "border-[var(--color-pop)] bg-[color-mix(in_oklab,var(--color-pop)_12%,transparent)] text-[var(--color-pop-bright)] hover:bg-[var(--color-pop)] hover:text-white"
            : "border-[var(--color-brass)]/60 bg-[color-mix(in_oklab,var(--color-brass)_8%,transparent)] text-[var(--color-brass-bright)] hover:bg-[var(--color-brass)] hover:text-[var(--color-ink)]",
          className,
        )}
      >
        {live ? (
          <>
            <span className="h-2 w-2 animate-pulse-pop rounded-full bg-[var(--color-pop-bright)]" />
            Watch live on TikTok
          </>
        ) : (
          <>Follow on TikTok</>
        )}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "relative inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition-colors",
        live
          ? "bg-[var(--color-pop)] hover:bg-[var(--color-pop-bright)]"
          : "bg-[var(--color-brass)] !text-[var(--color-ink)] hover:bg-[var(--color-brass-bright)]",
        className,
      )}
    >
      {live ? (
        <>
          <span className="h-2 w-2 animate-pulse-pop rounded-full bg-white" />
          <Radio size={16} />
          Live on TikTok
        </>
      ) : (
        <>Follow on TikTok</>
      )}
      <ArrowRight size={16} />
    </a>
  );
}

/** Small pulsing dot — used in nav badges to flag a live night. */
export function LiveDot({ className }: { className?: string }) {
  const live = useIsPoolNightLive();
  if (!live) return null;
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 animate-pulse-pop rounded-full bg-[var(--color-pop-bright)]",
        className,
      )}
      aria-label="Live now"
    />
  );
}
