import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Flag,
  Lightbulb,
  Target,
  Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { PointerSheen } from "@/components/home/PointerSheen";
import {
  DifficultyPill,
  HeaderBackLink,
  HeaderChip,
  LampStage,
  PanelLabel,
  SECONDARY_PILL,
} from "@/components/shots/TrainingUI";
import { DrillTable } from "@/components/shots/DrillTable";
import { DrillScoreTracker } from "@/components/shots/DrillScoreTracker";
import { BowliardsTracker } from "@/components/shots/BowliardsTracker";
import { DRILLS, getDrill } from "@/lib/kinister/drills";
import { cn } from "@/lib/utils";

type Params = { id: string };

export const dynamicParams = false;
export const revalidate = false;

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
      <PageHeader eyebrow="Practice drill" title={drill.name} subtitle={drill.description}>
        <div className="flex flex-wrap items-center gap-2">
          <HeaderBackLink href="/shots">All shots &amp; drills</HeaderBackLink>
          <DifficultyPill difficulty={drill.difficulty} size="md" />
          {drill.scoring && (
            <HeaderChip>
              <Trophy size={13} className="text-[var(--color-brass-bright)]" />
              Tracks {drill.scoring.label.toLowerCase()}
            </HeaderChip>
          )}
          {drill.externalUrl && (
            <a
              href={drill.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={SECONDARY_PILL}
            >
              <ExternalLink size={13} />
              {drill.externalLabel ?? "Reference"}
            </a>
          )}
        </div>
      </PageHeader>
      <PointerSheen />

      <div className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-6 sm:pb-16 lg:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
          <div className="space-y-6">
            {hasDiagram && (
              <LampStage>
                <DrillTable
                  name={drill.name}
                  cueBall={drill.cueBall}
                  objectBalls={drill.objectBalls}
                  ghostBalls={drill.ghostBalls}
                  numberedGhosts={drill.numberedGhosts}
                />
              </LampStage>
            )}

            <section className="pm-glass relative isolate overflow-hidden p-5 sm:p-7">
              <div
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_0%_0%,rgba(46,139,87,0.14),transparent_60%)]"
                aria-hidden
              />
              <PanelLabel>Setup</PanelLabel>
              <ol className="mt-4">
                {drill.setup.map((line, i) => (
                  <li
                    key={i}
                    className="flex gap-4 border-t border-[var(--color-cream)]/[0.07] py-3.5 first:border-t-0 first:pt-0"
                  >
                    <span className="w-7 shrink-0 font-[family-name:var(--font-display)] text-2xl leading-none text-[var(--color-brass-bright)]/80 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-relaxed text-[var(--color-cream)]/85 sm:text-base">
                      {line}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {drill.technique && (
              <section className="pm-glass p-5 sm:p-7">
                <PanelLabel icon={<Target size={14} className="text-[var(--color-brass-bright)]" />}>
                  Technique
                </PanelLabel>
                <p className="mt-3 text-lg leading-relaxed text-[var(--color-cream)]">
                  {drill.technique}
                </p>
              </section>
            )}

            <section className="pm-glass p-5 sm:p-7">
              <PanelLabel icon={<Flag size={14} className="text-[var(--color-brass-bright)]" />}>
                Goals &amp; scoring
              </PanelLabel>
              <ul className="mt-4 grid gap-2.5">
                {drill.goals.map((line, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-2xl bg-black/30 px-4 py-3 text-sm leading-relaxed text-[var(--color-cream)]/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                  >
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[var(--color-felt-bright)]" />
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-6">
            {drill.scoring &&
              (drill.scoring.kind === "bowling" ? (
                <section className="pm-glass relative isolate overflow-hidden">
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(255,226,160,0.1),transparent_70%)]"
                    aria-hidden
                  />
                  <header className="flex items-center gap-2 px-5 pt-5 sm:px-6">
                    <Trophy size={14} className="text-[var(--color-brass-bright)]" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                      Live scorecard
                    </p>
                  </header>
                  <div className="p-5 sm:p-6">
                    <BowliardsTracker />
                  </div>
                </section>
              ) : (
                <DrillScoreTracker drillId={drill.id} scoring={drill.scoring} />
              ))}

            {drill.commonMistakes && drill.commonMistakes.length > 0 && (
              <section className="pm-glass relative isolate overflow-hidden">
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(80%_100%_at_0%_0%,rgba(232,82,72,0.16),transparent_70%)]"
                  aria-hidden
                />
                <div className="flex items-center gap-3 px-5 pb-3 pt-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-pop)]/40 bg-[var(--color-pop)]/10">
                    <AlertTriangle size={14} className="text-[var(--color-pop-bright)]" />
                  </span>
                  <h2 className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide text-[var(--color-cream)]">
                    Common mistakes
                  </h2>
                </div>
                <ol className="px-5 pb-2">
                  {drill.commonMistakes.map((m, i) => (
                    <li
                      key={i}
                      className="flex gap-3 border-t border-[var(--color-cream)]/[0.07] py-3 text-sm leading-relaxed text-[var(--color-cream)]/85"
                    >
                      <span className="w-5 shrink-0 font-[family-name:var(--font-display)] text-lg leading-[1.3] text-[var(--color-pop-bright)]/80 tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="pm-glass p-5 text-xs leading-relaxed text-[var(--color-cream)]/60">
              <PanelLabel icon={<Lightbulb size={14} className="text-[var(--color-brass-bright)]" />}>
                How scoring works
              </PanelLabel>
              <p className="mt-3 leading-relaxed">
                {drill.scoring
                  ? `Log attempts under "${drill.scoring.label}". Solo or multi-player — just add a row per person. Everything saves to this browser's local storage; clear individual entries or wipe the drill's history any time.`
                  : "This drill doesn't have a built-in score. Track it however makes sense for the routine."}
              </p>
            </section>
          </aside>
        </div>

        {/* Prev / next drill */}
        <nav className="mt-14 grid gap-4 sm:grid-cols-2">
          {prev ? (
            <PrevNext href={`/drills/${prev.id}`} next={false} label="Previous drill" name={prev.name} />
          ) : (
            <div className="hidden sm:block" />
          )}
          {next ? (
            <PrevNext href={`/drills/${next.id}`} next label="Next drill" name={next.name} />
          ) : (
            <div />
          )}
        </nav>
      </div>
    </>
  );
}

function PrevNext({
  href,
  next,
  label,
  name,
}: {
  href: string;
  next: boolean;
  label: string;
  name: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "pm-glass pm-lift group relative flex items-center gap-4 overflow-hidden p-5 sm:p-6",
        next && "sm:flex-row-reverse sm:text-right",
      )}
    >
      <span className="pm-sheen" />
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-brass)]/40 bg-black/30 text-[var(--color-brass-bright)] transition-colors group-hover:bg-[var(--color-brass)]/15">
        {next ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/45">
          {label}
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-[0.95] tracking-wide text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)] sm:text-3xl">
          {name}
        </p>
      </div>
    </Link>
  );
}
