"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import type { Difficulty, KinisterShot } from "@/lib/kinister/shots";
import { useDrilled } from "@/lib/kinister/useDrilled";
import { ShotCard } from "./ShotCard";
import { cn } from "@/lib/utils";

const DIFFICULTIES: Difficulty[] = [
  "Foundational",
  "Intermediate",
  "Advanced",
];

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Foundational:
    "data-[active=true]:bg-[var(--color-felt-bright)]/30 data-[active=true]:text-[var(--color-felt-bright)] data-[active=true]:border-[var(--color-felt-bright)]/50",
  Intermediate:
    "data-[active=true]:bg-[var(--color-brass)]/20 data-[active=true]:text-[var(--color-brass-bright)] data-[active=true]:border-[var(--color-brass)]/60",
  Advanced:
    "data-[active=true]:bg-[var(--color-pop)]/15 data-[active=true]:text-[var(--color-pop-bright)] data-[active=true]:border-[var(--color-pop)]/50",
};

type DrilledFilter = "all" | "drilled" | "open";

export function ShotsGallery({ shots }: { shots: KinisterShot[] }) {
  const allSeries = useMemo(
    () => Array.from(new Set(shots.map((s) => s.series))).sort(),
    [shots],
  );

  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [series, setSeries] = useState<string>("all");
  const [drilledFilter, setDrilledFilter] = useState<DrilledFilter>("all");
  const { has, count, clearAll } = useDrilled();

  const filtered = useMemo(
    () =>
      shots.filter((s) => {
        if (difficulty !== "all" && s.difficulty !== difficulty) return false;
        if (series !== "all" && s.series !== series) return false;
        const isDrilled = has(s.id);
        if (drilledFilter === "drilled" && !isDrilled) return false;
        if (drilledFilter === "open" && isDrilled) return false;
        return true;
      }),
    [shots, difficulty, series, drilledFilter, has],
  );

  const total = shots.length;
  const filtersDirty =
    difficulty !== "all" || series !== "all" || drilledFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="surface flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle2
            size={18}
            className={cn(
              "transition-colors",
              count > 0
                ? "text-[var(--color-felt-bright)]"
                : "text-[var(--fg-dim)]",
            )}
          />
          <div>
            <p className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide">
              {count}
              <span className="text-[var(--fg-dim)]">/{total}</span>
            </p>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--fg-dim)]">
              Shots drilled
            </p>
          </div>
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
          >
            <RotateCcw size={12} />
            Reset tracker
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <FilterRow label="Difficulty">
          <Chip
            active={difficulty === "all"}
            onClick={() => setDifficulty("all")}
          >
            All
          </Chip>
          {DIFFICULTIES.map((d) => (
            <Chip
              key={d}
              active={difficulty === d}
              onClick={() => setDifficulty(d)}
              tone={DIFFICULTY_STYLES[d]}
            >
              {d}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Status">
          <Chip
            active={drilledFilter === "all"}
            onClick={() => setDrilledFilter("all")}
          >
            All
          </Chip>
          <Chip
            active={drilledFilter === "drilled"}
            onClick={() => setDrilledFilter("drilled")}
          >
            Drilled
          </Chip>
          <Chip
            active={drilledFilter === "open"}
            onClick={() => setDrilledFilter("open")}
          >
            Still to do
          </Chip>
        </FilterRow>

        <FilterRow label="Series">
          <select
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold tracking-wide text-[var(--fg)] hover:border-[var(--border-strong)]"
          >
            <option value="all">All series</option>
            {allSeries.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterRow>
      </div>

      {filtered.length === 0 ? (
        <div className="surface flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
            No shots match those filters.
          </p>
          <p className="text-sm text-[var(--fg-dim)]">
            Try widening difficulty or switching status back to All.
          </p>
        </div>
      ) : (
        <>
          {filtersDirty && (
            <p className="text-xs text-[var(--fg-dim)]">
              Showing {filtered.length} of {total} shots.
            </p>
          )}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((shot) => (
              <ShotCard key={shot.id} shot={shot} drilled={has(shot.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--fg-dim)]">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={cn(
        "rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]",
        "data-[active=true]:border-[var(--color-brass)]/60 data-[active=true]:bg-[var(--color-brass)]/15 data-[active=true]:text-[var(--color-brass-bright)]",
        tone,
      )}
    >
      {children}
    </button>
  );
}
