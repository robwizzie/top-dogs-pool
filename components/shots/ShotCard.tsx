import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { KinisterShot } from "@/lib/kinister/shots";
import { PoolTable } from "./PoolTable";
import { cn } from "@/lib/utils";

const DIFFICULTY_STYLES: Record<KinisterShot["difficulty"], string> = {
  Foundational:
    "border-[var(--color-felt-bright)]/40 text-[var(--color-felt-bright)] bg-[var(--color-felt-deep)]/40",
  Intermediate:
    "border-[var(--color-brass)]/40 text-[var(--color-brass-bright)] bg-[var(--color-brass)]/10",
  Advanced:
    "border-[var(--color-pop)]/40 text-[var(--color-pop-bright)] bg-[var(--color-pop)]/10",
};

export function ShotCard({
  shot,
  drilled = false,
}: {
  shot: KinisterShot;
  drilled?: boolean;
}) {
  return (
    <Link
      href={`/shots/${shot.id}`}
      className={cn(
        "group surface surface-hover relative flex flex-col gap-3 overflow-hidden p-4 transition-all hover:-translate-y-0.5",
        drilled && "border-[var(--color-felt-bright)]/45",
      )}
    >
      {drilled && (
        <span
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-[var(--color-felt-bright)]/45 bg-[var(--color-felt-deep)]/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-felt-bright)] backdrop-blur"
          title="Marked as drilled"
        >
          <CheckCircle2 size={11} />
          Drilled
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Shot {String(shot.number).padStart(2, "0")}
          </p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-tight tracking-wide text-[var(--fg)]">
            {shot.name}
          </h3>
        </div>
        <ArrowUpRight
          size={18}
          className="shrink-0 text-[var(--fg-dim)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--color-brass-bright)]"
        />
      </div>

      <PoolTable shot={shot} preview />

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            DIFFICULTY_STYLES[shot.difficulty],
          )}
        >
          {shot.difficulty}
        </span>
        <span className="text-[11px] text-[var(--fg-dim)]">{shot.series}</span>
      </div>
    </Link>
  );
}
