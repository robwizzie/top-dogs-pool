import type { Streak } from "@/lib/streaks";
import { streakBadge } from "@/lib/streaks";

/**
 * Streak indicator. Reads HOT 🔥 / COLD ❄️ with a count, all brand-typed.
 * Three variants:
 *   - "pill"  (default): full label, used on cards / hero
 *   - "chip" : compact form, used in dense lists like leaderboard rows
 *   - "tag"  : minimal monospace `🔥3W`-style for inline use
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
  const icon = isHot ? "🔥" : "❄️";
  const aria = `${badge.count}-game ${isHot ? "winning" : "losing"} streak`;

  if (variant === "tag") {
    return (
      <span
        className="streak-tag"
        data-kind={badge.kind}
        title={aria}
        aria-label={aria}
      >
        <span className="streak-icon" aria-hidden>
          {icon}
        </span>
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
      <span className="streak-icon" aria-hidden>
        {icon}
      </span>
      <span className="streak-state">{stateLabel}</span>
      <span className="streak-divider" aria-hidden />
      <span className="streak-count">
        {badge.count}
        <span className="streak-count-suffix">{isHot ? "W" : "L"}</span>
      </span>
    </span>
  );
}
