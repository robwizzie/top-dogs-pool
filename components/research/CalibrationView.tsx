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
          sub="≥50% predictions that won, <50% that lost"
        />
        <Stat
          label="Mean absolute error"
          value={`±${(meanAbsError * 100).toFixed(1)}%`}
          sub="how far off our average prediction is"
        />
      </div>

      <div className="surface p-4">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          Reliability · {predictions.length} predictions
        </h3>
        <p className="mb-4 text-xs text-[var(--fg-dim)]">
          Each row is a prediction-confidence bin. The dotted center line is
          perfect calibration — we want the &quot;actual&quot; bar to land on it.
          Bars right of center = the model was right (predictions came true).
          Bars left of center = over-confident (predictions missed).
        </p>
        <ReliabilityRows bins={bins} />
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
      <p className="text-[10px] text-[var(--fg-dim)]">{sub}</p>
    </div>
  );
}

/**
 * Reliability rows — one row per non-empty prediction bin. Each row shows
 * the bin range, sample count, predicted average vs actual win rate, and
 * a single bar that visually compares the two as a percentage.
 *
 * Designed to read clearly on mobile (vertical rows) and desktop (wider
 * bars). Replaces a tiny SVG that didn't scale well to either.
 */
function ReliabilityRows({
  bins,
}: {
  bins: CalibrationResult["bins"];
}) {
  const populated = bins.filter((b) => b.n > 0);
  if (populated.length === 0) {
    return (
      <p className="text-sm text-[var(--fg-dim)]">No bin data yet.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {populated.map((b, i) => (
        <ReliabilityRow key={i} bin={b} />
      ))}
    </ul>
  );
}

function ReliabilityRow({
  bin,
}: {
  bin: CalibrationResult["bins"][number];
}) {
  const [lo, hi] = bin.range;
  const predictedPct = bin.predicted * 100;
  const actualPct = bin.actual * 100;
  const error = Math.abs(bin.predicted - bin.actual);
  const tone =
    error <= 0.05
      ? "var(--color-felt-bright)"
      : error <= 0.12
        ? "var(--color-brass-bright)"
        : "var(--color-pop-bright)";
  const errorLabel =
    error <= 0.05
      ? "well-calibrated"
      : error <= 0.12
        ? "slightly off"
        : bin.predicted > bin.actual
          ? "over-confident"
          : "under-confident";
  return (
    <li className="rounded-md border border-[var(--border)] bg-[var(--bg-soft)]/30 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold tabular-nums text-[var(--fg)]">
            {Math.round(lo * 100)}–{Math.round(hi * 100)}%
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            predicted bin · {bin.n} match{bin.n === 1 ? "" : "es"}
          </span>
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: tone }}
        >
          {errorLabel}
        </span>
      </div>
      {/* Comparison bar — full width represents 0..100%; two markers show
          the predicted average and the actual win rate side-by-side. */}
      <div className="mt-2 relative h-7 w-full rounded-md bg-[var(--bg-soft)]/50 ring-1 ring-inset ring-[var(--border)]">
        {/* Predicted marker (neutral, behind) */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[var(--fg-dim)] opacity-70"
          style={{ left: `${predictedPct}%` }}
          title={`Predicted: ${predictedPct.toFixed(1)}%`}
        />
        {/* Actual marker (colored, in front) */}
        <div
          className="absolute top-0 bottom-0 w-1 rounded-sm"
          style={{
            left: `calc(${actualPct}% - 2px)`,
            backgroundColor: tone,
          }}
          title={`Actual: ${actualPct.toFixed(1)}%`}
        />
        {/* Connecting span between predicted and actual */}
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2 opacity-40"
          style={{
            left: `${Math.min(predictedPct, actualPct)}%`,
            width: `${Math.abs(predictedPct - actualPct)}%`,
            backgroundColor: tone,
          }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-[10px] tabular-nums text-[var(--fg-dim)]">
        <span>
          Predicted avg:{" "}
          <span className="font-semibold text-[var(--fg)]">
            {predictedPct.toFixed(1)}%
          </span>
        </span>
        <span>
          Actual:{" "}
          <span className="font-semibold" style={{ color: tone }}>
            {actualPct.toFixed(1)}%
          </span>
        </span>
        <span>
          Error: ±{(error * 100).toFixed(1)}%
        </span>
      </div>
    </li>
  );
}
