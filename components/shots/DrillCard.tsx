import { ExternalLink } from "lucide-react";
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
    <article className="surface flex flex-col gap-4 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Drill
          </p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-tight tracking-wide text-[var(--fg)]">
            {drill.name}
          </h3>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            DIFFICULTY_STYLES[drill.difficulty],
          )}
        >
          {drill.difficulty}
        </span>
      </header>

      {hasDiagram && (
        <DrillTable
          name={drill.name}
          cueBall={drill.cueBall}
          objectBalls={drill.objectBalls}
          ghostBalls={drill.ghostBalls}
        />
      )}

      <p className="text-sm leading-relaxed text-[var(--fg-dim)]">
        {drill.description}
      </p>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--fg-dim)]">
            Setup
          </p>
          <ul className="mt-1.5 space-y-1 text-sm leading-relaxed">
            {drill.setup.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[var(--color-brass)]">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--fg-dim)]">
            Goals
          </p>
          <ul className="mt-1.5 space-y-1 text-sm leading-relaxed">
            {drill.goals.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[var(--color-brass)]">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {drill.externalUrl && (
        <a
          href={drill.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:border-[var(--color-brass)]/60 hover:text-[var(--color-brass-bright)]"
        >
          <ExternalLink size={12} />
          {drill.externalLabel ?? "Reference"}
        </a>
      )}
    </article>
  );
}
