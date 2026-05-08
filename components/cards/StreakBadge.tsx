import type { Streak } from "@/lib/streaks";
import { streakBadge } from "@/lib/streaks";

/**
 * Compact, refined streak indicator. Three variants:
 *   - "pill"  (default): inline lozenge with chevron + count, brand-toned
 *   - "chip" : same look but tighter (used in dense lists like leaderboard)
 *   - "tag"  : monospace minimal, e.g. for inline use next to a name
 */
export function StreakBadge({
  streak,
  variant = "pill",
}: {
  streak: Streak | null | undefined;
  variant?: "pill" | "chip" | "tag";
}) {
  const badge = streakBadge(streak);
  if (!badge) return null;
  const isHot = badge.kind === "hot";
  const label = `${badge.count}-game ${isHot ? "winning" : "losing"} streak`;

  // Tag — terse inline form: "W3" / "L3" with subtle color, no chrome.
  if (variant === "tag") {
    return (
      <span
        className="streak-tag"
        data-kind={badge.kind}
        title={label}
        aria-label={label}
      >
        <Chevron up={isHot} />
        {badge.count}
        {isHot ? "W" : "L"}
      </span>
    );
  }

  return (
    <span
      className={variant === "chip" ? "streak-chip" : "streak-pill"}
      data-kind={badge.kind}
      title={label}
      aria-label={label}
    >
      <Chevron up={isHot} />
      <span className="streak-count">{badge.count}</span>
      <span className="streak-label">
        {isHot ? "Win streak" : "Cold"}
      </span>
    </span>
  );
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="streak-chevron"
      aria-hidden
    >
      {up ? <path d="M3 7.5 6 4l3 3.5" /> : <path d="M3 4.5 6 8l3-3.5" />}
    </svg>
  );
}
