/**
 * Tiny W/L bar history — one little bar per match, oldest → newest. Green for
 * wins, red for losses. Used on leaderboard rows so a streak/slump is obvious
 * at a glance. Server-renderable.
 */
export function OutcomeBars({
  outcomes,
  max = 8,
  className,
}: {
  outcomes: ("W" | "L")[];
  max?: number;
  className?: string;
}) {
  if (!outcomes.length) return null;
  const slice = outcomes.slice(-max);
  return (
    <div
      className={`flex items-end gap-[2px] ${className ?? ""}`}
      role="img"
      aria-label={`Last ${slice.length}: ${slice.join("-")}`}
      title={`Last ${slice.length}: ${slice.join("-")}`}
    >
      {slice.map((o, i) => (
        <span
          key={i}
          className="block w-[5px] rounded-[1.5px]"
          style={{
            height: o === "W" ? 12 : 8,
            background:
              o === "W" ? "var(--color-felt-bright)" : "var(--color-pop)",
            opacity: 0.3 + (0.7 * (i + 1)) / slice.length,
          }}
        />
      ))}
    </div>
  );
}
