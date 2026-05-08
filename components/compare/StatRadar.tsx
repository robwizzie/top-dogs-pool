/**
 * SVG radar chart for comparing 2-4 players across normalized stat axes.
 * Server-renderable. Each polygon gets its own brand-tinted fill + stroke.
 */
type RadarPlayer = {
  id: string;
  name: string;
  /** Values per axis 0-1 (already normalized). */
  values: number[];
  color: string;
};

const POLY_COLORS = [
  "var(--color-brass-bright)",
  "var(--color-felt-bright)",
  "var(--color-pop-bright)",
  "var(--color-cream)",
];

export function StatRadar({
  axes,
  players,
  size = 380,
}: {
  axes: string[];
  players: RadarPlayer[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 36;
  const n = axes.length;
  if (n < 3 || players.length === 0) return null;

  function point(axisIdx: number, value: number): [number, number] {
    const angle = (Math.PI * 2 * axisIdx) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * r * value, cy + Math.sin(angle) * r * value];
  }

  // Concentric grid
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="auto"
      role="img"
      aria-label={`Stat comparison across ${players.map((p) => p.name).join(", ")}`}
      style={{ maxWidth: size }}
    >
      {/* Rings */}
      {rings.map((ringR) => (
        <polygon
          key={ringR}
          points={Array.from({ length: n }, (_, i) => point(i, ringR).join(",")).join(" ")}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}
      {/* Axis spokes */}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--border)"
            strokeWidth={1}
          />
        );
      })}
      {/* Player polygons */}
      {players.map((p, i) => {
        const points = p.values
          .map((v, ai) => point(ai, Math.max(0, Math.min(1, v))).join(","))
          .join(" ");
        const color = p.color || POLY_COLORS[i % POLY_COLORS.length];
        return (
          <g key={p.id}>
            <polygon
              points={points}
              fill={color}
              fillOpacity={0.16}
              stroke={color}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            {p.values.map((v, ai) => {
              const [x, y] = point(ai, Math.max(0, Math.min(1, v)));
              return (
                <circle key={ai} cx={x} cy={y} r={3} fill={color} />
              );
            })}
          </g>
        );
      })}
      {/* Axis labels */}
      {axes.map((label, i) => {
        const [x, y] = point(i, 1.16);
        return (
          <text
            key={label}
            x={x}
            y={y}
            fontSize={11}
            fontWeight={600}
            fill="var(--fg-dim)"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export const RADAR_COLORS = POLY_COLORS;
