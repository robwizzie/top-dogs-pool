import type { Streak } from "@/lib/streaks";
import { streakBadge } from "@/lib/streaks";

/**
 * Streak indicator. Reads "HOT" / "COLD" with a chevron + count, all
 * brand-typed. Three variants:
 *   - "pill"  (default): full label, used on cards / hero
 *   - "chip" : compact form, used in dense lists like leaderboard rows
 *   - "tag"  : minimal monospace `↑3W`-style for inline use
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
  const stateLabel = isHot ? "Hot" : "Cold";
  const aria = `${badge.count}-game ${isHot ? "winning" : "losing"} streak`;

  if (variant === "tag") {
    return (
      <span
        className="streak-tag"
        data-kind={badge.kind}
        title={aria}
        aria-label={aria}
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
      title={aria}
      aria-label={aria}
    >
      <Chevron up={isHot} />
      <span className="streak-state">{stateLabel}</span>
      <span className="streak-divider" aria-hidden />
      <span className="streak-count">
        {badge.count}
        <span className="streak-count-suffix">{isHot ? "W" : "L"}</span>
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
