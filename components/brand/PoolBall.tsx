import { cn } from "@/lib/utils";

const BALL_COLORS: Record<number, string> = {
  1: "#F4C430", // yellow
  2: "#1B4F8B", // blue
  3: "#C8362F", // red
  4: "#5B2C8B", // purple
  5: "#E07A1F", // orange
  6: "#1F6E3D", // green (matches the logo collar)
  7: "#7A1F1F", // maroon
  8: "#0A0A0A", // black
  9: "#F4C430",
  10: "#1B4F8B",
  11: "#C8362F",
  12: "#5B2C8B",
  13: "#E07A1F",
  14: "#1F6E3D",
  15: "#7A1F1F",
};

export function PoolBall({
  number = 8,
  size = 28,
  className,
  spin = false,
}: {
  number?: number;
  size?: number;
  className?: string;
  spin?: boolean;
}) {
  const color = BALL_COLORS[number] ?? "#1F6E3D";
  const isStripe = number > 8 && number <= 15;
  const id = `ball-${number}`;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn(spin && "animate-spin-slow", className)}
      role="img"
      aria-label={`${number} ball`}
    >
      <defs>
        <radialGradient id={`${id}-shade`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="20%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>

      <circle cx="50" cy="50" r="48" fill={isStripe ? "#f7efd7" : color} />
      {isStripe && (
        <g clipPath={`url(#${id}-clip)`}>
          <rect x="0" y="28" width="100" height="44" fill={color} />
        </g>
      )}
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-shade)`} />
      {/* white spot for the number */}
      <circle cx="50" cy="50" r="16" fill="#f7efd7" />
      <text
        x="50"
        y="56"
        textAnchor="middle"
        fontSize="20"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
        fill="#0a0a0a"
      >
        {number}
      </text>
    </svg>
  );
}

export function CueBall({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
      <defs>
        <radialGradient id="cue-shade" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="rgba(255,255,255,1)" />
          <stop offset="60%" stopColor="rgba(240,234,213,1)" />
          <stop offset="100%" stopColor="rgba(60,40,20,0.4)" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#cue-shade)" />
    </svg>
  );
}
