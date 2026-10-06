"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, RotateCcw, Search } from "lucide-react";
import type { Difficulty, KinisterShot } from "@/lib/kinister/shots";
import { useDrilled } from "@/lib/kinister/useDrilled";
import { ShotCard } from "./ShotCard";
import { PILL_TOGGLE, PILL_TRACK } from "./TrainingUI";
import { cn } from "@/lib/utils";
import { englishCategory, type EnglishCategory } from "@/lib/kinister/english";

const DIFFICULTIES: Difficulty[] = [
  "Foundational",
  "Intermediate",
  "Advanced",
];

/** Active-state colours for the difficulty toggles (felt / brass / pop). */
const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Foundational:
    "data-[active=true]:from-[var(--color-felt-text)] data-[active=true]:via-[#2e8b57] data-[active=true]:to-[#1f6e3d] data-[active=true]:text-white data-[active=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_16px_-8px_rgba(46,139,87,0.9)]",
  Intermediate: "",
  Advanced:
    "data-[active=true]:from-[#ff8a7f] data-[active=true]:via-[#e85248] data-[active=true]:to-[#c8362f] data-[active=true]:text-white data-[active=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_16px_-8px_rgba(232,82,72,0.9)]",
};

const ENGLISH_CATEGORIES: { id: EnglishCategory; label: string }[] = [
  { id: "center", label: "Center" },
  { id: "follow", label: "Follow / high" },
  { id: "draw", label: "Draw / low" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
];

type DrilledFilter = "all" | "drilled" | "open";

export function ShotsGallery({ shots }: { shots: KinisterShot[] }) {
  const allSeries = useMemo(
    () => Array.from(new Set(shots.map((s) => s.series))).sort(),
    [shots],
  );

  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [series, setSeries] = useState<string>("all");
  const [drilledFilter, setDrilledFilter] = useState<DrilledFilter>("all");
  const [englishFilter, setEnglishFilter] = useState<EnglishCategory | "all">(
    "all",
  );
  const [query, setQuery] = useState("");
  const { has, count, clearAll } = useDrilled();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shots.filter((s) => {
      if (difficulty !== "all" && s.difficulty !== difficulty) return false;
      if (series !== "all" && s.series !== series) return false;
      const isDrilled = has(s.id);
      if (drilledFilter === "drilled" && !isDrilled) return false;
      if (drilledFilter === "open" && isDrilled) return false;
      if (englishFilter !== "all") {
        const cats = s.english ? englishCategory(s.english) : ["center"];
        if (!cats.includes(englishFilter)) return false;
      }
      if (q) {
        const hay = [
          s.name,
          s.shortName,
          s.description,
          s.technique,
          s.teaches,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [shots, difficulty, series, drilledFilter, englishFilter, query, has]);

  const total = shots.length;
  const filtersDirty =
    difficulty !== "all" ||
    series !== "all" ||
    drilledFilter !== "all" ||
    englishFilter !== "all" ||
    query.trim() !== "";

  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Control console — progress, search and the filter rails. */}
      <div className="pm-glass relative isolate overflow-hidden p-4 sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_120%_at_0%_0%,rgba(46,139,87,0.16),transparent_60%),radial-gradient(50%_120%_at_100%_0%,rgba(224,190,107,0.08),transparent_60%)]"
          aria-hidden
        />
        <div className="grid items-center gap-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:gap-8">
          <div className="flex items-end gap-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                <CheckCircle2
                  size={13}
                  className={cn(
                    "shrink-0 transition-colors",
                    count > 0
                      ? "text-[var(--color-felt-bright)]"
                      : "text-[var(--color-brass)]/70",
                  )}
                />
                Shots drilled
              </p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="font-[family-name:var(--font-display)] text-5xl leading-[0.85] tracking-wide tabular-nums">
                  <span className={count > 0 ? "pm-foil" : "text-[var(--color-cream)]"}>
                    {count}
                  </span>
                  <span className="text-2xl text-[var(--color-cream)]/35">
                    {" "}/ {total}
                  </span>
                </p>
                {count > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/45 transition-colors hover:text-[var(--color-pop-bright)]"
                  >
                    <RotateCcw size={11} />
                    Reset
                  </button>
                )}
              </div>
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-black/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--color-felt-bright)] via-[var(--color-brass)] to-[var(--color-brass-bright)] shadow-[0_0_12px_rgba(224,190,107,0.6)] transition-[width] duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          <label className="group flex h-12 items-center gap-3 rounded-full bg-black/45 px-4 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-shadow focus-within:shadow-[inset_0_1px_3px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(224,190,107,0.5),0_0_0_4px_rgba(224,190,107,0.08)]">
            <Search
              size={16}
              className="shrink-0 text-[var(--color-cream)]/40 transition-colors group-focus-within:text-[var(--color-brass-bright)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, technique, or what it teaches…"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-cream)] placeholder:text-[var(--color-cream)]/35 focus:outline-none"
              aria-label="Search shots"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/50 transition-colors hover:text-[var(--color-brass-bright)]"
              >
                Clear
              </button>
            )}
          </label>
        </div>

        <div className="my-5 h-px bg-gradient-to-r from-transparent via-[var(--color-brass)]/25 to-transparent" />

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <FilterRow label="English">
            <Chip
              active={englishFilter === "all"}
              onClick={() => setEnglishFilter("all")}
            >
              All
            </Chip>
            {ENGLISH_CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                active={englishFilter === c.id}
                onClick={() => setEnglishFilter(c.id)}
              >
                {c.label}
              </Chip>
            ))}
          </FilterRow>

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

          <FilterRow label="Series" bare>
            <span className="relative inline-flex">
              <select
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                aria-label="Filter by series"
                className="h-10 appearance-none rounded-full border-0 bg-black/45 pl-4 pr-10 text-xs font-semibold tracking-wide text-[var(--color-cream)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.06)] transition-shadow hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(224,190,107,0.4)] focus:outline-none"
              >
                <option value="all">All series</option>
                {allSeries.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-brass-bright)]"
              />
            </span>
          </FilterRow>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="pm-glass flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
          <p className="pm-serif text-2xl text-[var(--color-cream)]/70">
            Nothing on the table.
          </p>
          <p className="font-[family-name:var(--font-display)] text-3xl tracking-wide">
            No shots match those filters.
          </p>
          <p className="text-sm text-[var(--color-cream)]/55">
            Try widening difficulty or switching status back to All.
          </p>
        </div>
      ) : (
        <>
          {filtersDirty && (
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-cream)]/50">
              Showing{" "}
              <span className="font-semibold text-[var(--color-brass-bright)]">
                {filtered.length}
              </span>{" "}
              of {total} shots
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
  bare = false,
}: {
  label: string;
  children: React.ReactNode;
  /** Render children as-is instead of inside a pill track. */
  bare?: boolean;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2">
      <span className="pl-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-cream)]/45">
        {label}
      </span>
      {bare ? (
        <div className="flex items-center">{children}</div>
      ) : (
        <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className={cn(PILL_TRACK, "w-max")} role="group" aria-label={label}>
            {children}
          </div>
        </div>
      )}
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
      aria-pressed={active}
      className={cn(PILL_TOGGLE, tone)}
    >
      {children}
    </button>
  );
}
