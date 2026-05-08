import type { Streak } from "@/lib/streaks";
import { streakBadge } from "@/lib/streaks";

/**
 * Small flame/snowflake badge for a player's current trailing streak.
 * Renders nothing for streaks shorter than 3.
 */
export function StreakBadge({
  streak,
  size = "sm",
}: {
  streak: Streak | null | undefined;
  size?: "sm" | "md";
}) {
  const badge = streakBadge(streak);
  if (!badge) return null;
  const isHot = badge.kind === "hot";
  const label = `${badge.count}-${isHot ? "win" : "loss"} streak`;
  return (
    <span
      className="streak-badge"
      data-kind={badge.kind}
      title={label}
      aria-label={label}
      style={size === "md" ? { fontSize: 11, padding: "0.22rem 0.6rem" } : undefined}
    >
      <span className="streak-icon" aria-hidden>
        {isHot ? "🔥" : "❄️"}
      </span>
      <span>
        {badge.count}
        {isHot ? "W" : "L"}
      </span>
    </span>
  );
}
