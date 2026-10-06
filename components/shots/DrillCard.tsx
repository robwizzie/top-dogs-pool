import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Drill } from "@/lib/kinister/drills";
import { DrillTable } from "./DrillTable";
import { SVG_H, SVG_W } from "@/lib/kinister/geometry";
import { DifficultyPill } from "./TrainingUI";

export function DrillCard({ drill }: { drill: Drill }) {
  const hasDiagram =
    drill.cueBall !== undefined ||
    (drill.objectBalls && drill.objectBalls.length > 0);

  return (
    <Link
      href={`/drills/${drill.id}`}
      className="pm-glass pm-lift group relative isolate flex flex-col overflow-hidden p-4 sm:p-5"
    >
      <span className="pm-sheen" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-3/4 bg-[radial-gradient(70%_70%_at_50%_45%,rgba(224,190,107,0.1),transparent_70%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Drill
            {drill.scoring && (
              <span className="text-[var(--color-cream)]/40">
                {" "}· Tracks {drill.scoring.label.toLowerCase()}
              </span>
            )}
          </p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-[1.6rem] leading-[0.95] tracking-wide text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)]">
            {drill.name}
          </h3>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-cream)]/10 bg-black/30 text-[var(--color-cream)]/50 transition-all duration-300 group-hover:border-[var(--color-brass)]/50 group-hover:bg-[var(--color-brass)]/15 group-hover:text-[var(--color-brass-bright)]">
          <ArrowUpRight
            size={15}
            className="transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px"
          />
        </span>
      </div>

      <div className="relative mb-4 mt-4">
        {hasDiagram ? (
          <>
            <div
              className="pointer-events-none absolute inset-x-[6%] -bottom-2 h-6 rounded-[50%] bg-black/70 blur-lg"
              aria-hidden
            />
            <div className="relative transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.3,1)] group-hover:scale-[1.015]">
              <DrillTable
                name={drill.name}
                cueBall={drill.cueBall}
                objectBalls={drill.objectBalls}
                ghostBalls={drill.ghostBalls}
                numberedGhosts={drill.numberedGhosts}
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(45%_60%_at_50%_45%,rgba(255,228,170,0.13),transparent_70%)] opacity-60 mix-blend-screen transition-opacity duration-500 group-hover:opacity-100"
                aria-hidden
              />
            </div>
          </>
        ) : (
          <div
            style={{ aspectRatio: `${SVG_W} / ${SVG_H}` }}
            className="pm-felt relative flex items-center justify-center overflow-hidden rounded-2xl px-6 text-center shadow-[inset_0_0_0_6px_#24170d,inset_0_0_0_7px_rgba(201,162,74,0.35),inset_0_0_60px_rgba(0,0,0,0.6)]">
            <p className="pm-serif text-lg leading-snug text-[var(--color-cream)]/75">
              Layout varies — see drill page for setup &amp; scoring.
            </p>
          </div>
        )}
      </div>

      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-[var(--color-cream)]/60">
        {drill.description}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--color-cream)]/[0.07] pt-3">
        <DifficultyPill difficulty={drill.difficulty} />
      </div>
    </Link>
  );
}
