import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, ExternalLink, Lightbulb, Target } from "lucide-react";
import { DrillTable } from "@/components/shots/DrillTable";
import { DrillScoreTracker } from "@/components/shots/DrillScoreTracker";
import { DRILLS, getDrill } from "@/lib/kinister/drills";
import { cn } from "@/lib/utils";

type Params = { id: string };

export function generateStaticParams(): Params[] {
  return DRILLS.map((d) => ({ id: d.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const drill = getDrill(id);
  if (!drill) return { title: "Drill not found" };
  return {
    title: `${drill.name} — Practice Drill`,
    description: drill.description,
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

export default async function DrillDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const drill = getDrill(id);
  if (!drill) notFound();

  const index = DRILLS.findIndex((d) => d.id === drill.id);
  const prev = index > 0 ? DRILLS[index - 1] : null;
  const next = index < DRILLS.length - 1 ? DRILLS[index + 1] : null;

  const hasDiagram =
    drill.cueBall !== undefined ||
    (drill.objectBalls && drill.objectBalls.length > 0);

  return (
    <>
      <header className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <Link
            href="/shots"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
          >
            <ArrowLeft size={14} />
            All Shots & Drills
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                Practice Drill
              </p>
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-5xl">
                {drill.name}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
                  DIFFICULTY_STYLES[drill.difficulty],
                )}
              >
                {drill.difficulty}
              </span>
              {drill.externalUrl && (
                <a
                  href={drill.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 text-sm font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:border-[var(--color-brass)]/60 hover:text-[var(--color-brass-bright)]"
                >
                  <ExternalLink size={13} />
                  {drill.externalLabel ?? "Reference"}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {hasDiagram && (
              <DrillTable
                name={drill.name}
                cueBall={drill.cueBall}
                objectBalls={drill.objectBalls}
                ghostBalls={drill.ghostBalls}
              />
            )}

            <div className="surface p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                The Drill
              </p>
              <p className="mt-2 leading-relaxed text-[var(--fg)]">
                {drill.description}
              </p>
            </div>

            <div className="surface overflow-hidden">
              <div className="border-b border-[var(--border)] bg-[var(--color-felt-deep)]/30 px-5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
                  Setup
                </p>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {drill.setup.map((line, i) => (
                  <li
                    key={i}
                    className="flex gap-3 px-5 py-3 text-sm leading-relaxed text-[var(--fg)]"
                  >
                    <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brass-bright)]" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            {drill.technique && (
              <div className="surface p-5">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-[var(--color-brass-bright)]" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                    Technique
                  </p>
                </div>
                <p className="mt-2 leading-relaxed text-[var(--fg)]">
                  {drill.technique}
                </p>
              </div>
            )}

            <div className="surface p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                Goals & Scoring
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--fg)]">
                {drill.goals.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brass-bright)]" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="space-y-6">
            {drill.scoring && (
              <DrillScoreTracker drillId={drill.id} scoring={drill.scoring} />
            )}

            {drill.commonMistakes && drill.commonMistakes.length > 0 && (
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
                  {drill.commonMistakes.map((m, i) => (
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
            )}

            <div className="surface p-5 text-xs leading-relaxed text-[var(--fg-dim)]">
              <div className="flex items-center gap-2">
                <Lightbulb
                  size={14}
                  className="text-[var(--color-brass-bright)]"
                />
                <p className="font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
                  How scoring works
                </p>
              </div>
              <p className="mt-2 leading-relaxed">
                {drill.scoring
                  ? `Log attempts under "${drill.scoring.label}". Solo or multi-player — just add a row per person. Everything saves to this browser's local storage; clear individual entries or wipe the drill's history any time.`
                  : "This drill doesn't have a built-in score. Track it however makes sense for the routine."}
              </p>
            </div>
          </aside>
        </div>

        {/* Prev / next drill */}
        <nav className="mt-12 grid gap-3 border-t border-[var(--border)] pt-8 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/drills/${prev.id}`}
              className="surface surface-hover group flex flex-col gap-1 p-4"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
                ← Previous Drill
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
              href={`/drills/${next.id}`}
              className="surface surface-hover group flex flex-col gap-1 p-4 sm:text-right"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
                Next Drill →
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
