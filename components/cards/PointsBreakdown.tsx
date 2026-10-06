/**
 * Visual breakdown of where a player's leaderboard points came from. Renders
 * a stacked horizontal bar segmented by source (sweep / mini / B&R / 8oB /
 * level-ups) with the legend underneath. If a player has zero points, shows
 * a quiet placeholder rather than an empty bar.
 *
 * Point values come from the leaderboard rules:
 *   sweep        = 1.0 pt
 *   mini-sweep   = 0.5 pt
 *   break & run  = 1.0 pt
 *   8-on-break   = 1.0 pt
 *   level-up     = 1.0 pt
 */
type Segment = {
  key: string;
  label: string;
  count: number;
  pts: number;
  color: string;
};

export function PointsBreakdown({
  points,
  sweeps,
  miniSweeps,
  breakAndRuns,
  eightOnBreaks,
  levelUps = 0,
}: {
  points: number;
  sweeps: number;
  miniSweeps: number;
  breakAndRuns: number;
  eightOnBreaks: number;
  levelUps?: number;
}) {
  const segs: Segment[] = [
    {
      key: "sweep",
      label: "Sweep",
      count: sweeps,
      pts: sweeps * 1,
      color: "var(--color-pop)",
    },
    {
      key: "mini",
      label: "Mini",
      count: miniSweeps,
      pts: miniSweeps * 0.5,
      color: "var(--color-brass)",
    },
    {
      key: "br",
      label: "B&R",
      count: breakAndRuns,
      pts: breakAndRuns * 1,
      color: "var(--color-felt-bright)",
    },
    {
      key: "eob",
      label: "8oB",
      count: eightOnBreaks,
      pts: eightOnBreaks * 1,
      color: "var(--color-cream)",
    },
    {
      key: "lvl",
      label: "Level Up",
      count: levelUps,
      pts: levelUps * 1,
      color: "var(--color-felt)",
    },
  ];
  const total = Math.max(
    points,
    segs.reduce((s, x) => s + x.pts, 0),
    0.0001,
  );
  const visible = segs.filter((s) => s.pts > 0);

  return (
    <div className="pm-glass h-full px-5 py-5 sm:px-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-brass)]">
          Points come from
        </p>
        <span className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide tabular-nums text-[var(--color-brass-bright)]">
          {points}
          <span className="ml-1 text-xs tracking-[0.2em] text-[var(--color-cream)]/45">
            pt{points === 1 ? "" : "s"}
          </span>
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-[var(--color-cream)]/50">
          No leaderboard points logged in this scope yet.
        </p>
      ) : (
        <>
          <div
            className="flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full bg-black/40 p-[2px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]"
            role="img"
            aria-label={`Points breakdown: ${visible.map((s) => `${s.count} ${s.label}`).join(", ")}`}
          >
            {visible.map((s) => {
              const pct = (s.pts / total) * 100;
              return (
                <span
                  key={s.key}
                  className="block h-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                  style={{ width: `${pct}%`, background: s.color }}
                  title={`${s.label}: ${s.count} (${s.pts}pt)`}
                />
              );
            })}
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3 xl:grid-cols-5">
            {segs.map((s) => (
              <li
                key={s.key}
                className={`flex items-baseline justify-between gap-2 text-[11px] ${
                  s.pts === 0 ? "opacity-40" : ""
                }`}
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: s.color }}
                    aria-hidden
                  />
                  <span className="text-[var(--color-cream)]/60">{s.label}</span>
                </span>
                <span className="font-[family-name:var(--font-display)] text-base leading-none tracking-wide tabular-nums text-[var(--color-cream)]">
                  {s.count}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
