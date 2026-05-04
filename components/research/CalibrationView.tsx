"use client";

import { useState } from "react";
import type { CalibrationResult } from "@/lib/research";
import { cn } from "@/lib/utils";

/**
 * Calibration check display.
 *
 * - Brier score (mean squared error of probability predictions)
 *   Reference: 0 = perfect; 0.25 = random; > 0.25 = worse than chance
 * - Reliability plot: predicted-bin-center vs actual-win-rate
 *   Diagonal line = perfectly calibrated. Bars above the line = under-confident
 *   (model said 60% but actually won 70%), below = over-confident.
 * - Per-prediction list (collapsed) for inspection.
 */
export function CalibrationView({
  calibration,
}: {
  calibration: CalibrationResult;
}) {
  const { predictions, brier, bins, meanAbsError } = calibration;
  const [showAll, setShowAll] = useState(false);

  if (predictions.length === 0) {
    return (
      <p className="surface p-6 text-sm text-[var(--fg-dim)]">
        Not enough match history yet to backtest.
      </p>
    );
  }

  const overallAccuracy =
    predictions.length > 0
      ? Math.round(
          (predictions.filter(
            (p) =>
              (p.predicted >= 0.5 && p.actual === 1) ||
              (p.predicted < 0.5 && p.actual === 0),
          ).length /
            predictions.length) *
            1000,
        ) / 10
      : 0;

  // Sample sample of predictions sorted by prediction confidence
  const sortedPreds = [...predictions].sort((a, b) => b.predicted - a.predicted);

  const brierTone =
    brier <= 0.18
      ? "text-[var(--color-felt-bright)]"
      : brier <= 0.23
        ? "text-[var(--color-brass-bright)]"
        : "text-[var(--color-pop-bright)]";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Brier score"
          value={brier.toFixed(3)}
          sub="lower = better · 0=perfect · 0.25=random"
          tone={brierTone}
        />
        <Stat
          label="Coin-flip accuracy"
          value={`${overallAccuracy}%`}
          sub="≥50% predictions that won, &lt;50% that lost"
        />
        <Stat
          label="Mean absolute error"
          value={`±${(meanAbsError * 100).toFixed(1)}%`}
          sub="how far off our average prediction is"
        />
      </div>

      <div className="surface p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          Reliability plot · {predictions.length} predictions
        </h3>
        <ReliabilityChart bins={bins} />
        <p className="mt-3 text-xs text-[var(--fg-dim)]">
          Each bar shows the actual win rate for predictions in that bin. The
          dashed diagonal is perfect calibration. Bars at or near the line =
          honest predictions.
        </p>
      </div>

      <details className="surface">
        <summary className="cursor-pointer list-none p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Per-prediction list ({predictions.length} matches)
          </span>
          <span className="ml-2 text-xs text-[var(--fg-dim)]">— tap to view</span>
        </summary>
        <div className="border-t border-[var(--border)]">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[var(--bg-card)]">
                <tr className="border-b border-[var(--border)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Opp</th>
                  <th className="px-3 py-2 text-right">Pred</th>
                  <th className="px-3 py-2 text-right">Actual</th>
                  <th className="px-3 py-2 text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? sortedPreds : sortedPreds.slice(0, 50)).map((p, i) => {
                  const delta = p.predicted - p.actual;
                  return (
                    <tr
                      key={`${p.matchId}-${p.playerId}-${i}`}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-3 py-2 text-[var(--fg-dim)] tabular-nums">
                        {new Date(p.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-2">
                        {p.playerName}
                        {p.playerSL != null && (
                          <span className="ml-1 text-[var(--fg-dim)]">
                            SL{p.playerSL}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[var(--fg-dim)]">
                        {p.oppName}
                        {p.oppSL != null && (
                          <span className="ml-1">SL{p.oppSL}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Math.round(p.predicted * 100)}%
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          p.actual === 1
                            ? "text-[var(--color-felt-bright)]"
                            : "text-[var(--color-pop-bright)]",
                        )}
                      >
                        {p.actual === 1 ? "W" : "L"}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          Math.abs(delta) <= 0.2
                            ? "text-[var(--fg-dim)]"
                            : "text-[var(--color-pop-bright)]",
                        )}
                      >
                        {delta > 0 ? "+" : ""}
                        {Math.round(delta * 100)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!showAll && sortedPreds.length > 50 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="block w-full border-t border-[var(--border)] px-3 py-3 text-center text-xs font-semibold text-[var(--color-brass)] hover:bg-[var(--bg-soft)]/40"
            >
              Show all {sortedPreds.length} predictions
            </button>
          )}
        </div>
      </details>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide tabular-nums",
          tone ?? "text-[var(--color-cream)]",
        )}
      >
        {value}
      </p>
      <p
        className="text-[10px] text-[var(--fg-dim)]"
        dangerouslySetInnerHTML={{ __html: sub }}
      />
    </div>
  );
}

/**
 * Reliability plot — bar chart with one bar per prediction bin showing
 * actual-win-rate vs predicted-rate. A dashed diagonal shows perfect
 * calibration.
 */
function ReliabilityChart({
  bins,
}: {
  bins: CalibrationResult["bins"];
}) {
  const w = 100;
  const h = 100;
  const padX = 8;
  const padY = 6;
  const innerW = w - 2 * padX;
  const innerH = h - 2 * padY;
  // Bar layout
  const barW = innerW / bins.length;
  const maxN = Math.max(...bins.map((b) => b.n));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full">
      {/* Diagonal reference (perfect calibration) */}
      <line
        x1={padX}
        y1={padY + innerH}
        x2={padX + innerW}
        y2={padY}
        stroke="var(--fg-dim)"
        strokeDasharray="1.5 1.5"
        strokeWidth={0.4}
        opacity={0.6}
      />
      {/* Axes */}
      <line
        x1={padX}
        y1={padY + innerH}
        x2={padX + innerW}
        y2={padY + innerH}
        stroke="var(--border)"
        strokeWidth={0.5}
      />
      <line
        x1={padX}
        y1={padY}
        x2={padX}
        y2={padY + innerH}
        stroke="var(--border)"
        strokeWidth={0.5}
      />
      {/* Bars */}
      {bins.map((b, i) => {
        if (b.n === 0) return null;
        const cx = padX + i * barW + barW / 2;
        const yPredicted = padY + innerH - b.predicted * innerH;
        const yActual = padY + innerH - b.actual * innerH;
        // Width scales with bin sample size (visual weight).
        const tWidth = Math.max(
          0.6,
          Math.min(barW * 0.7, (b.n / maxN) * barW * 0.8),
        );
        const error = Math.abs(b.predicted - b.actual);
        const color =
          error <= 0.05
            ? "var(--color-felt-bright)"
            : error <= 0.12
              ? "var(--color-brass-bright)"
              : "var(--color-pop-bright)";
        return (
          <g key={i}>
            {/* Bar from y=actual up to y=predicted (whichever is taller) */}
            <line
              x1={cx}
              y1={Math.min(yPredicted, yActual)}
              x2={cx}
              y2={Math.max(yPredicted, yActual)}
              stroke={color}
              strokeWidth={tWidth * 0.4}
              opacity={0.6}
            />
            {/* Actual win rate dot (the "truth") */}
            <circle cx={cx} cy={yActual} r={1.4} fill={color} />
            {/* Predicted center dot (smaller, neutral) */}
            <circle
              cx={cx}
              cy={yPredicted}
              r={0.8}
              fill="var(--fg-dim)"
              opacity={0.7}
            />
          </g>
        );
      })}
      {/* Axis labels */}
      <text
        x={padX}
        y={h - 0.5}
        className="fill-[var(--fg-dim)]"
        style={{ fontSize: 3 }}
      >
        0%
      </text>
      <text
        x={w - padX - 5}
        y={h - 0.5}
        className="fill-[var(--fg-dim)]"
        style={{ fontSize: 3 }}
      >
        100%
      </text>
      <text
        x={padX - 7}
        y={padY + 3}
        className="fill-[var(--fg-dim)]"
        style={{ fontSize: 3 }}
      >
        100%
      </text>
      <text
        x={padX - 5}
        y={padY + innerH}
        className="fill-[var(--fg-dim)]"
        style={{ fontSize: 3 }}
      >
        0%
      </text>
      <text
        x={padX + innerW / 2}
        y={h - 0.5}
        textAnchor="middle"
        className="fill-[var(--fg-dim)]"
        style={{ fontSize: 3, letterSpacing: "0.1em" }}
      >
        Predicted
      </text>
      <text
        x={1}
        y={padY + innerH / 2}
        textAnchor="middle"
        className="fill-[var(--fg-dim)]"
        style={{ fontSize: 3, letterSpacing: "0.1em" }}
        transform={`rotate(-90 1 ${padY + innerH / 2})`}
      >
        Actual
      </text>
    </svg>
  );
}
