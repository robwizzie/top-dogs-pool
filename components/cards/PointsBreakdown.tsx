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
    <div className="surface px-5 py-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
          Points come from
        </p>
        <span className="font-[family-name:var(--font-display)] text-base tracking-wide tabular-nums text-[var(--color-brass-bright)]">
          {points} pt{points === 1 ? "" : "s"}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="text-[11px] text-[var(--fg-dim)]">
          No leaderboard points logged in this scope yet.
        </p>
      ) : (
        <>
          <div
            className="flex h-3 w-full overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-soft)]"
            role="img"
            aria-label={`Points breakdown: ${visible.map((s) => `${s.count} ${s.label}`).join(", ")}`}
          >
            {visible.map((s) => {
              const pct = (s.pts / total) * 100;
              return (
                <span
                  key={s.key}
                  className="block h-full"
                  style={{ width: `${pct}%`, background: s.color }}
                  title={`${s.label}: ${s.count} (${s.pts}pt)`}
                />
              );
            })}
          </div>

          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-5">
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
                  <span className="text-[var(--fg-dim)]">{s.label}</span>
                </span>
                <span className="font-[family-name:var(--font-display)] tracking-wide tabular-nums text-[var(--color-cream)]">
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
