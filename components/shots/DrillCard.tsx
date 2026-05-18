import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Drill } from "@/lib/kinister/drills";
import type { Difficulty } from "@/lib/kinister/shots";
import { DrillTable } from "./DrillTable";
import { cn } from "@/lib/utils";

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Foundational:
    "border-[var(--color-felt-bright)]/40 text-[var(--color-felt-bright)] bg-[var(--color-felt-deep)]/40",
  Intermediate:
    "border-[var(--color-brass)]/40 text-[var(--color-brass-bright)] bg-[var(--color-brass)]/10",
  Advanced:
    "border-[var(--color-pop)]/40 text-[var(--color-pop-bright)] bg-[var(--color-pop)]/10",
};

export function DrillCard({ drill }: { drill: Drill }) {
  const hasDiagram =
    drill.cueBall !== undefined ||
    (drill.objectBalls && drill.objectBalls.length > 0);

  return (
    <Link
      href={`/drills/${drill.id}`}
      className="group surface surface-hover relative flex flex-col gap-3 overflow-hidden p-4 transition-all hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Drill
          </p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-tight tracking-wide text-[var(--fg)]">
            {drill.name}
          </h3>
        </div>
        <ArrowUpRight
          size={18}
          className="shrink-0 text-[var(--fg-dim)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--color-brass-bright)]"
        />
      </div>

      {hasDiagram ? (
        <DrillTable
          name={drill.name}
          cueBall={drill.cueBall}
          objectBalls={drill.objectBalls}
          ghostBalls={drill.ghostBalls}
        />
      ) : (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] px-4 text-center text-xs text-[var(--fg-dim)]">
          Layout varies — see drill page for setup & scoring.
        </div>
      )}

      <p className="line-clamp-2 text-sm leading-relaxed text-[var(--fg-dim)]">
        {drill.description}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            DIFFICULTY_STYLES[drill.difficulty],
          )}
        >
          {drill.difficulty}
        </span>
        {drill.scoring && (
          <span className="text-[11px] text-[var(--fg-dim)]">
            Tracks {drill.scoring.label.toLowerCase()}
          </span>
        )}
      </div>
    </Link>
  );
}
