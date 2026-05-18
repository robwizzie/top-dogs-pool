import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, Lightbulb, Target } from "lucide-react";
import { PoolTable } from "@/components/shots/PoolTable";
import { ShotVideoBlock } from "@/components/shots/ShotVideo";
import { DrilledToggle } from "@/components/shots/DrilledToggle";
import { KINISTER_SHOTS, getShot, videoFor } from "@/lib/kinister/shots";
import { cn } from "@/lib/utils";

type Params = { id: string };

export function generateStaticParams(): Params[] {
  return KINISTER_SHOTS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const shot = getShot(id);
  if (!shot) return { title: "Shot not found" };
  return {
    title: `${shot.name} — Kinister Shot ${String(shot.number).padStart(2, "0")}`,
    description: shot.description,
  };
}

const DIFFICULTY_STYLES = {
  Foundational:
    "border-[var(--color-felt-bright)]/40 text-[var(--color-felt-bright)] bg-[var(--color-felt-deep)]/40",
  Intermediate:
    "border-[var(--color-brass)]/40 text-[var(--color-brass-bright)] bg-[var(--color-brass)]/10",
  Advanced:
    "border-[var(--color-pop)]/40 text-[var(--color-pop-bright)] bg-[var(--color-pop)]/10",
} as const;

export default async function ShotDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const shot = getShot(id);
  if (!shot) notFound();

  const index = KINISTER_SHOTS.findIndex((s) => s.id === shot.id);
  const prev = index > 0 ? KINISTER_SHOTS[index - 1] : null;
  const next =
    index < KINISTER_SHOTS.length - 1 ? KINISTER_SHOTS[index + 1] : null;

  return (
    <>
      <header className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <Link
            href="/shots"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
          >
            <ArrowLeft size={14} />
            All Shots
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                Shot {String(shot.number).padStart(2, "0")} · {shot.series}
              </p>
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-5xl">
                {shot.name}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
                  DIFFICULTY_STYLES[shot.difficulty],
                )}
              >
                {shot.difficulty}
              </span>
              <DrilledToggle shotId={shot.id} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <PoolTable shot={shot} interactive />

            <ShotVideoBlock video={videoFor(shot)} />

            <div className="surface p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                The Setup
              </p>
              <p className="mt-2 leading-relaxed text-[var(--fg)]">
                {shot.description}
              </p>
            </div>

            <div className="surface p-5">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-[var(--color-brass-bright)]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                  Technique
                </p>
              </div>
              <p className="mt-2 leading-relaxed text-[var(--fg)]">
                {shot.technique}
              </p>
            </div>

            <div className="surface p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                What it teaches
              </p>
              <p className="mt-2 leading-relaxed text-[var(--fg-dim)]">
                {shot.teaches}
              </p>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="surface overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--color-pop)]/10 px-5 py-3">
                <AlertTriangle
                  size={16}
                  className="text-[var(--color-pop-bright)]"
                />
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-pop-bright)]">
                  Common Mistakes
                </p>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {shot.commonMistakes.map((m, i) => (
                  <li
                    key={i}
                    className="flex gap-3 px-5 py-3 text-sm leading-relaxed text-[var(--fg)]"
                  >
                    <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-pop-bright)]" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--color-brass)]/10 px-5 py-3">
                <Lightbulb
                  size={16}
                  className="text-[var(--color-brass-bright)]"
                />
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
                  How to Hit It Right
                </p>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {shot.tips.map((t, i) => (
                  <li
                    key={i}
                    className="flex gap-3 px-5 py-3 text-sm leading-relaxed text-[var(--fg)]"
                  >
                    <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brass-bright)]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface p-5 text-xs leading-relaxed text-[var(--fg-dim)]">
              <p className="font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
                Legend
              </p>
              <div className="mt-3 grid gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full border border-black/40 bg-[#ece1c4]" />
                  Cue ball (start &amp; end)
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full border border-black/40 bg-[#e0a82e]" />
                  Object ball
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-6 bg-[rgba(236,225,196,0.75)]" />
                  Cue-ball path
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-0.5 w-6"
                    style={{
                      background:
                        "repeating-linear-gradient(90deg, rgba(224,190,107,0.85) 0 3px, transparent 3px 6px)",
                    }}
                  />
                  Object-ball path
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full border border-dashed border-[rgba(232,82,72,0.7)]" />
                  Target pocket
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Prev / next */}
        <nav className="mt-12 grid gap-3 border-t border-[var(--border)] pt-8 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/shots/${prev.id}`}
              className="surface surface-hover group flex flex-col gap-1 p-4"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
                ← Previous
              </span>
              <span className="font-[family-name:var(--font-display)] text-xl tracking-wide group-hover:text-[var(--color-brass-bright)]">
                {prev.name}
              </span>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/shots/${next.id}`}
              className="surface surface-hover group flex flex-col gap-1 p-4 sm:text-right"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
                Next →
              </span>
              <span className="font-[family-name:var(--font-display)] text-xl tracking-wide group-hover:text-[var(--color-brass-bright)]">
                {next.name}
              </span>
            </Link>
          ) : (
            <div />
          )}
        </nav>
      </div>
    </>
  );
}
