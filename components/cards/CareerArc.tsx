/**
 * Cumulative-wins arc for a player. Shows W/L progression as two stacked
 * sparklines (cumulative wins solid brass, cumulative losses muted pop) so
 * trajectory is immediately readable. Server-renderable.
 */
export function CareerArc({
  outcomes,
  height = 84,
}: {
  outcomes: ("W" | "L")[];
  height?: number;
}) {
  if (outcomes.length < 2) return null;

  const W = 600;
  const padX = 8;
  const padY = 6;
  const stepX = (W - padX * 2) / (outcomes.length - 1);

  const winsPts: Array<[number, number]> = [];
  const lossesPts: Array<[number, number]> = [];
  let w = 0;
  let l = 0;
  outcomes.forEach((o, i) => {
    if (o === "W") w++;
    else l++;
    const x = padX + i * stepX;
    winsPts.push([x, w]);
    lossesPts.push([x, l]);
  });
  const maxY = Math.max(w, l, 1);
  const yFor = (v: number) =>
    height - padY - (v / maxY) * (height - padY * 2);

  const winsPath = winsPts
    .map(([x, v], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yFor(v).toFixed(1)}`)
    .join(" ");
  const lossesPath = lossesPts
    .map(([x, v], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yFor(v).toFixed(1)}`)
    .join(" ");
  const lastWin = winsPts[winsPts.length - 1];
  const lastLoss = lossesPts[lossesPts.length - 1];

  return (
    <div className="pm-glass h-full px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-brass)]">
          Trajectory
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-cream)]/45">
          <span className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide tabular-nums text-[var(--color-brass-bright)]">
            {w}
          </span>{" "}
          W{" "}
          <span className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide tabular-nums text-[var(--color-pop-bright)]">
            {l}
          </span>{" "}
          L · {outcomes.length} matches
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Cumulative ${w} wins, ${l} losses across ${outcomes.length} matches`}
      >
        <defs>
          <linearGradient id="career-arc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brass-bright)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-brass-bright)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path
          d={`${winsPath} L${lastWin[0].toFixed(1)},${height} L${winsPts[0][0].toFixed(1)},${height} Z`}
          fill="url(#career-arc-fill)"
          stroke="none"
        />
        <path
          d={lossesPath}
          fill="none"
          stroke="var(--color-pop)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.65}
        />
        <path
          d={winsPath}
          fill="none"
          stroke="var(--color-brass-bright)"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={lastLoss[0]} cy={yFor(lastLoss[1])} r={3} fill="var(--color-pop-bright)" />
        <circle cx={lastWin[0]} cy={yFor(lastWin[1])} r={3.4} fill="var(--color-brass-bright)" />
      </svg>
    </div>
  );
}
