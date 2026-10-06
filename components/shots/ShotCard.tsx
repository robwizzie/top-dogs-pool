import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { KinisterShot } from "@/lib/kinister/shots";
import { PoolTable } from "./PoolTable";
import { PracticeStatusBadge } from "./PracticeStatusBadge";
import { DifficultyPill } from "./TrainingUI";

export function ShotCard({
  shot,
  drilled = false,
}: {
  shot: KinisterShot;
  drilled?: boolean;
}) {
  const num = String(shot.number).padStart(2, "0");
  return (
    <Link
      href={`/shots/${shot.id}`}
      className="pm-glass pm-lift group relative isolate flex flex-col overflow-hidden p-4 sm:p-5"
    >
      <span className="pm-sheen" />
      {/* lamp glow pooling on the diagram; brightens on hover */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-3/4 bg-[radial-gradient(70%_70%_at_50%_45%,rgba(46,139,87,0.16),transparent_70%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      {drilled && (
        <span
          className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(46,139,87,0.55),inset_0_0_40px_-10px_rgba(46,139,87,0.45)]"
          aria-hidden
        />
      )}

      <div className="flex items-start gap-3">
        <span
          aria-label={`Shot ${num}`}
          className="pm-outline -mt-0.5 font-[family-name:var(--font-display)] text-[2.6rem] leading-none opacity-35 transition-opacity [-webkit-text-stroke-width:1px] group-hover:opacity-70"
        >
          {num}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-brass)]">
            {shot.series}
          </p>
          <h3 className="mt-0.5 font-[family-name:var(--font-display)] text-[1.6rem] leading-[0.95] tracking-wide text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)]">
            {shot.name}
          </h3>
        </div>
        {drilled ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-felt-bright)]/50 bg-[var(--color-felt-deep)]/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-felt-text)]"
            title="Marked as drilled"
          >
            <CheckCircle2 size={11} />
            Drilled
          </span>
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-cream)]/10 bg-black/30 text-[var(--color-cream)]/50 transition-all duration-300 group-hover:border-[var(--color-brass)]/50 group-hover:bg-[var(--color-brass)]/15 group-hover:text-[var(--color-brass-bright)]">
            <ArrowUpRight
              size={15}
              className="transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px"
            />
          </span>
        )}
      </div>

      <div className="relative mb-4 mt-4">
        <div
          className="pointer-events-none absolute inset-x-[6%] -bottom-2 h-6 rounded-[50%] bg-black/70 blur-lg"
          aria-hidden
        />
        <div className="relative transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.3,1)] group-hover:scale-[1.015]">
          <PoolTable shot={shot} preview />
          {/* lamp light pooling on the felt */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(45%_60%_at_50%_45%,rgba(255,228,170,0.13),transparent_70%)] opacity-60 mix-blend-screen transition-opacity duration-500 group-hover:opacity-100"
            aria-hidden
          />
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--color-cream)]/[0.07] pt-3">
        <DifficultyPill difficulty={shot.difficulty} />
        <PracticeStatusBadge shotId={shot.id} />
      </div>
    </Link>
  );
}
