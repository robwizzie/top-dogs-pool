"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RadarRow } from "@/lib/research";
import { cn } from "@/lib/utils";

/**
 * Side-by-side comparison of two players across the same 5-axis radar used
 * elsewhere on the page. The two polygons overlay so it's instantly visible
 * which axes one dominates the other on.
 */
export function PlayerComparison({ rows }: { rows: RadarRow[] }) {
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          b.matches - a.matches || a.playerName.localeCompare(b.playerName),
      ),
    [rows],
  );
  const [aId, setAId] = useState<string>(sorted[0]?.playerId ?? "");
  const [bId, setBId] = useState<string>(sorted[1]?.playerId ?? "");
  const a = sorted.find((r) => r.playerId === aId);
  const b = sorted.find((r) => r.playerId === bId);

  if (sorted.length < 2) {
    return (
      <p className="surface p-6 text-sm text-[var(--fg-dim)]">
        Need at least two players with matches to compare.
      </p>
    );
  }

  return (
    <div className="surface p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <PlayerSelect
          label="Player A"
          value={aId}
          options={sorted}
          excludeId={bId}
          onChange={setAId}
          accentClass="text-[var(--color-brass-bright)]"
        />
        <PlayerSelect
          label="Player B"
          value={bId}
          options={sorted}
          excludeId={aId}
          onChange={setBId}
          accentClass="text-[var(--color-pop-bright)]"
        />
      </div>

      {a && b && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <ComparisonRadar a={a} b={b} />
          <ComparisonStats a={a} b={b} />
        </div>
      )}
    </div>
  );
}

function PlayerSelect({
  label,
  value,
  options,
  excludeId,
  onChange,
  accentClass,
}: {
  label: string;
  value: string;
  options: RadarRow[];
  excludeId: string;
  onChange: (v: string) => void;
  accentClass: string;
}) {
  return (
    <div>
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.32em]",
          accentClass,
        )}
      >
        {label}
      </p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2 text-sm focus:border-[var(--color-brass)] focus:outline-none"
      >
        {options.map((p) => (
          <option
            key={p.playerId}
            value={p.playerId}
            disabled={p.playerId === excludeId}
          >
            {p.playerName} ({p.matches} matches)
          </option>
        ))}
      </select>
    </div>
  );
}

function ComparisonRadar({ a, b }: { a: RadarRow; b: RadarRow }) {
  const size = 280;
  const center = size / 2;
  const r = size * 0.36;
  const labels = ["Win %", "Sweep", "Mini", "B&R", "8oB"] as const;
  const valuesA = [a.axes.winPct, a.axes.sweepRate, a.axes.miniRate, a.axes.brRate, a.axes.eobRate];
  const valuesB = [b.axes.winPct, b.axes.sweepRate, b.axes.miniRate, b.axes.brRate, b.axes.eobRate];
  const angle = (i: number) => (Math.PI * 2 * i) / labels.length - Math.PI / 2;
  const point = (i: number, v: number) => {
    const rr = (v / 100) * r;
    return [center + Math.cos(angle(i)) * rr, center + Math.sin(angle(i)) * rr];
  };
  const polyA = valuesA.map((v, i) => point(i, v).join(",")).join(" ");
  const polyB = valuesB.map((v, i) => point(i, v).join(",")).join(" ");
  const rings = [25, 50, 75, 100].map((pct) =>
    labels.map((_, i) => point(i, pct).join(",")).join(" "),
  );
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="block w-full">
      {rings.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="var(--border)"
          strokeWidth={0.5}
        />
      ))}
      <polygon
        points={polyB}
        fill="var(--color-pop)"
        fillOpacity={0.25}
        stroke="var(--color-pop-bright)"
        strokeWidth={1.5}
      />
      <polygon
        points={polyA}
        fill="var(--color-brass)"
        fillOpacity={0.3}
        stroke="var(--color-brass-bright)"
        strokeWidth={1.8}
      />
      {labels.map((lbl, i) => {
        const [x, y] = point(i, 118);
        return (
          <text
            key={lbl}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--fg)] text-[10px] font-medium"
          >
            {lbl}
          </text>
        );
      })}
    </svg>
  );
}

function ComparisonStats({ a, b }: { a: RadarRow; b: RadarRow }) {
  const rows = [
    { label: "Matches", aVal: a.matches, bVal: b.matches, fmt: (n: number) => String(n) },
    { label: "Win %", aVal: a.raw.winPct, bVal: b.raw.winPct, fmt: (n: number) => `${n}%` },
    { label: "Sweep %", aVal: a.raw.sweepRate, bVal: b.raw.sweepRate, fmt: (n: number) => `${n}%` },
    { label: "Mini %", aVal: a.raw.miniRate, bVal: b.raw.miniRate, fmt: (n: number) => `${n}%` },
    { label: "B&R %", aVal: a.raw.brRate, bVal: b.raw.brRate, fmt: (n: number) => `${n}%` },
    { label: "8oB %", aVal: a.raw.eobRate, bVal: b.raw.eobRate, fmt: (n: number) => `${n}%` },
  ];
  return (
    <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
      <li className="grid grid-cols-[1fr_5rem_5rem] items-baseline gap-3 px-4 py-3 bg-[var(--bg-soft)]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
          Stat
        </span>
        <Link
          href={`/roster/${a.playerId}`}
          className="text-right text-xs font-bold uppercase tracking-[0.24em] text-[var(--color-brass-bright)] hover:underline"
        >
          {a.playerName.split(" ")[0]}
        </Link>
        <Link
          href={`/roster/${b.playerId}`}
          className="text-right text-xs font-bold uppercase tracking-[0.24em] text-[var(--color-pop-bright)] hover:underline"
        >
          {b.playerName.split(" ")[0]}
        </Link>
      </li>
      {rows.map((r) => {
        const aLeads = r.aVal > r.bVal;
        const bLeads = r.bVal > r.aVal;
        return (
          <li
            key={r.label}
            className="grid grid-cols-[1fr_5rem_5rem] items-baseline gap-3 px-4 py-2.5"
          >
            <span className="text-sm">{r.label}</span>
            <span
              className={cn(
                "text-right text-sm tabular-nums",
                aLeads ? "font-semibold text-[var(--color-brass-bright)]" : "text-[var(--fg-dim)]",
              )}
            >
              {r.fmt(r.aVal)}
            </span>
            <span
              className={cn(
                "text-right text-sm tabular-nums",
                bLeads ? "font-semibold text-[var(--color-pop-bright)]" : "text-[var(--fg-dim)]",
              )}
            >
              {r.fmt(r.bVal)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
