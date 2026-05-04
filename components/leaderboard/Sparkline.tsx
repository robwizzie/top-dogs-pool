/**
 * Tiny SVG line chart for leaderboard rows. Plots a numeric series and a
 * single dot at the latest point. Auto-fits its viewBox to the data range
 * so a flat series still draws a visible line down the middle.
 */
export function Sparkline({
  points,
  width = 96,
  height = 28,
  tone = "brass",
  className,
  ariaLabel,
}: {
  points: number[];
  width?: number;
  height?: number;
  tone?: "brass" | "felt" | "pop";
  className?: string;
  ariaLabel?: string;
}) {
  if (!points.length) {
    return (
      <span
        aria-hidden
        className={className}
        style={{ display: "inline-block", width, height }}
      />
    );
  }

  const stroke =
    tone === "felt"
      ? "var(--color-felt-bright)"
      : tone === "pop"
        ? "var(--color-pop-bright)"
        : "var(--color-brass-bright)";
  const fill =
    tone === "felt"
      ? "rgba(46, 139, 87, 0.18)"
      : tone === "pop"
        ? "rgba(232, 82, 72, 0.18)"
        : "rgba(224, 190, 107, 0.18)";

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padY = 3;
  const stepX = points.length === 1 ? 0 : (width - 2) / (points.length - 1);

  const coords = points.map((v, i) => {
    const x = 1 + i * stepX;
    const y = height - padY - ((v - min) / range) * (height - padY * 2);
    return [x, y] as const;
  });
  const linePath = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const areaPath =
    `${linePath} L${coords[coords.length - 1][0].toFixed(2)},${height} ` +
    `L${coords[0][0].toFixed(2)},${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
      className={className}
    >
      <path d={areaPath} fill={fill} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill={stroke} />
    </svg>
  );
}
