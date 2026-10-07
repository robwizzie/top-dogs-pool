import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Crosshair,
  Lightbulb,
  MapPin,
  Smartphone,
  Sparkles,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { PointerSheen } from "@/components/home/PointerSheen";
import {
  DifficultyPill,
  HeaderBackLink,
  LampStage,
  PanelLabel,
  SECONDARY_PILL,
} from "@/components/shots/TrainingUI";
import { PoolTable } from "@/components/shots/PoolTable";
import { ShotVideoBlock } from "@/components/shots/ShotVideo";
import { DrilledToggle } from "@/components/shots/DrilledToggle";
import { AttemptTracker } from "@/components/shots/AttemptTracker";
import { ShotNotes } from "@/components/shots/ShotNotes";
import { MistakeDiagram } from "@/components/shots/MistakeDiagram";
import { ShareControls } from "@/components/shots/ShareControls";
import { GlossaryText } from "@/components/shots/GlossaryText";
import { KINISTER_SHOTS, getShot, videoFor } from "@/lib/kinister/shots";
import { POCKETS } from "@/lib/kinister/shots";
import { cutAngle, describePosition, pocketLabel } from "@/lib/kinister/setup";
import { englishSimilarity } from "@/lib/kinister/english";
import { cn } from "@/lib/utils";
import { pageMetadata } from "@/lib/site";

type Params = { id: string };

export const dynamicParams = false;
export const revalidate = false;

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
  if (!shot) return { title: "Shot" };
  return pageMetadata({
    title: `${shot.name} — Kinister Shot ${String(shot.number).padStart(2, "0")}`,
    description: shot.description,
    path: `/shots/${shot.id}`,
    type: "article",
    ownImage: true,
  });
}

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

  // Top 3 related shots: same series, scored by english similarity (if both
  // shots have english data) and proximity in the catalog.
  const related = KINISTER_SHOTS.filter((s) => s.id !== shot.id)
    .map((s) => {
      let score = 0;
      if (s.series === shot.series) score += 1.5;
      if (s.difficulty === shot.difficulty) score += 0.8;
      if (shot.english && s.english) {
        score += englishSimilarity(shot.english, s.english) * 1.2;
      }
      // Lightly prefer shots that come after this one in the catalog —
      // they're often the natural next step in a series.
      const catalogDistance = Math.abs(s.number - shot.number);
      score += Math.max(0, 0.6 - catalogDistance * 0.08);
      return { shot: s, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.shot);

  const num = String(shot.number).padStart(2, "0");
  const cut =
    !shot.sequence && shot.targetPocket
      ? cutAngle(shot.cueBall, shot.objectBall, POCKETS[shot.targetPocket])
      : null;

  return (
    <>
      <PageHeader
        eyebrow={`Shot ${num} · ${shot.series}`}
        title={shot.name}
        subtitle={shot.teaches}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <HeaderBackLink href="/shots">All shots</HeaderBackLink>
            <DifficultyPill difficulty={shot.difficulty} size="md" />
            {!shot.sequence && (
              <Link
                href={`/shots/${shot.id}/ar`}
                className={SECONDARY_PILL}
                title="Point your phone at the table and see the ghost ball overlaid live"
              >
                <Crosshair size={13} />
                AR aim
              </Link>
            )}
            <Link
              href={`/shots/${shot.id}/practice`}
              className={SECONDARY_PILL}
              title="Open a stripped-down view designed for putting your phone on the rail"
            >
              <Smartphone size={13} />
              Rail view
            </Link>
            <DrilledToggle shotId={shot.id} />
          </div>
          <ShareControls shot={shot} />
        </div>
      </PageHeader>
      <PointerSheen />

      <div className="mx-auto max-w-7xl px-4 pb-12 pt-4 sm:px-6 sm:pb-16 lg:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
          <div className="space-y-6">
            <LampStage>
              <PoolTable shot={shot} interactive />
            </LampStage>

            <ShotVideoBlock video={videoFor(shot)} />

            {!shot.sequence && (
              <section className="pm-glass relative isolate overflow-hidden p-5 sm:p-6">
                <div
                  className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_0%_0%,rgba(46,139,87,0.14),transparent_60%)]"
                  aria-hidden
                />
                <PanelLabel icon={<MapPin size={14} className="text-[var(--color-brass-bright)]" />}>
                  Rack the shot
                </PanelLabel>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SpecTile
                    label="Cue ball"
                    swatch={<BallSwatch className="bg-[radial-gradient(circle_at_35%_35%,#fff,#cfc7b0)]" />}
                  >
                    {describePosition(shot.cueBall)}
                  </SpecTile>
                  <SpecTile
                    label="Object ball"
                    swatch={<BallSwatch className="bg-[radial-gradient(circle_at_35%_35%,#fff8d8,#e0a82e_60%,#7a5610)]" />}
                  >
                    {describePosition(shot.objectBall)}
                  </SpecTile>
                  {shot.targetPocket && (
                    <SpecTile
                      label="Target pocket"
                      swatch={
                        <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-dashed border-[rgba(232,82,72,0.8)] bg-black/60" />
                      }
                    >
                      {pocketLabel(shot.targetPocket)}
                    </SpecTile>
                  )}
                  {cut && (
                    <div className="flex items-center gap-4 rounded-2xl bg-black/30 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(224,190,107,0.18)]">
                      <p className="font-[family-name:var(--font-display)] text-5xl leading-none tracking-wide tabular-nums text-[var(--color-brass-bright)]">
                        {cut.degrees.toFixed(0)}°
                      </p>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/45">
                          Cut angle
                        </dt>
                        <dd className="mt-0.5 text-sm leading-snug text-[var(--color-cream)]">
                          {cut.label}
                          <span className="block text-xs text-[var(--color-cream)]/45">
                            off the pocket line
                          </span>
                        </dd>
                      </div>
                    </div>
                  )}
                </dl>
                <p className="mt-4 text-xs leading-relaxed text-[var(--color-cream)]/55">
                  The faint outlined ball on the diagram is the{" "}
                  <span className="font-semibold text-[var(--color-cream)]">
                    ghost ball
                  </span>{" "}
                  — aim your cue ball straight at it and the object ball goes
                  in the pocket.
                </p>
              </section>
            )}

            <section className="pm-glass relative overflow-hidden p-5 sm:p-7">
              <PanelLabel>The setup</PanelLabel>
              <p className="mt-3 text-lg leading-relaxed text-[var(--color-cream)] sm:text-xl sm:leading-relaxed">
                <GlossaryText text={shot.description} />
              </p>
              <div className="my-6 h-px bg-gradient-to-r from-[var(--color-brass)]/35 via-[var(--color-cream)]/[0.07] to-transparent" />
              <PanelLabel icon={<Target size={14} className="text-[var(--color-brass-bright)]" />}>
                Technique
              </PanelLabel>
              <p className="mt-3 leading-relaxed text-[var(--color-cream)]/85">
                <GlossaryText text={shot.technique} />
              </p>
            </section>

            {related.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-4">
                  <PanelLabel icon={<Sparkles size={14} className="text-[var(--color-brass-bright)]" />}>
                    Try these next
                  </PanelLabel>
                  <div className="pm-rule flex-1" aria-hidden />
                </div>
                <ul className="grid gap-4 sm:grid-cols-3">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/shots/${r.id}`}
                        className="pm-glass pm-lift group relative flex h-full items-center gap-4 overflow-hidden p-3 sm:flex-col sm:items-stretch sm:gap-3"
                      >
                        <span className="pm-sheen" />
                        <div className="w-32 shrink-0 sm:w-auto">
                          <PoolTable shot={r} preview />
                        </div>
                        <div className="min-w-0 px-1 pb-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-cream)]/45">
                            Shot {String(r.number).padStart(2, "0")} · {r.difficulty}
                          </p>
                          <p className="mt-1 font-[family-name:var(--font-display)] text-xl leading-[0.95] tracking-wide text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)]">
                            {r.name}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <AttemptTracker shotId={shot.id} />

            <ShotNotes shotId={shot.id} />

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
                {shot.commonMistakes.map((m, i) => (
                  <li
                    key={i}
                    className="flex gap-3 border-t border-[var(--color-cream)]/[0.07] py-3 text-sm leading-relaxed text-[var(--color-cream)]/85"
                  >
                    <span className="w-5 shrink-0 font-[family-name:var(--font-display)] text-lg leading-[1.3] text-[var(--color-pop-bright)]/80 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <GlossaryText text={m} />
                    </span>
                  </li>
                ))}
              </ol>
              {shot.mistakeDiagrams && shot.mistakeDiagrams.length > 0 && (
                <div className="grid gap-5 border-t border-[var(--color-cream)]/[0.07] p-4 sm:p-5">
                  {shot.mistakeDiagrams.map((md, i) => (
                    <figure key={i} className="space-y-2.5">
                      <MistakeDiagram shot={shot} mistake={md} />
                      <figcaption className="space-y-0.5 text-xs leading-relaxed">
                        <p className="font-semibold uppercase tracking-[0.16em] text-[var(--color-pop-bright)]">
                          {md.mistake}
                        </p>
                        <p className="text-[var(--color-cream)]/55">{md.outcome}</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>

            <section className="pm-glass relative isolate overflow-hidden">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(80%_100%_at_0%_0%,rgba(224,190,107,0.16),transparent_70%)]"
                aria-hidden
              />
              <div className="flex items-center gap-3 px-5 pb-3 pt-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-brass)]/40 bg-[var(--color-brass)]/10">
                  <Lightbulb size={14} className="text-[var(--color-brass-bright)]" />
                </span>
                <h2 className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide text-[var(--color-cream)]">
                  How to hit it right
                </h2>
              </div>
              <ol className="px-5 pb-2">
                {shot.tips.map((t, i) => (
                  <li
                    key={i}
                    className="flex gap-3 border-t border-[var(--color-cream)]/[0.07] py-3 text-sm leading-relaxed text-[var(--color-cream)]/85"
                  >
                    <span className="w-5 shrink-0 font-[family-name:var(--font-display)] text-lg leading-[1.3] text-[var(--color-brass-bright)]/80 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <GlossaryText text={t} />
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="pm-glass p-5 text-xs leading-relaxed text-[var(--color-cream)]/65">
              <PanelLabel>Legend</PanelLabel>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/40 bg-[#ece1c4]" />
                  Cue ball (start &amp; end)
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/40 bg-[#e0a82e]" />
                  Object ball
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-6 shrink-0 bg-[rgba(236,225,196,0.75)]" />
                  Cue-ball path
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-0.5 w-6 shrink-0"
                    style={{
                      background:
                        "repeating-linear-gradient(90deg, rgba(224,190,107,0.85) 0 3px, transparent 3px 6px)",
                    }}
                  />
                  Object-ball path
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-dashed border-[rgba(232,82,72,0.7)]" />
                  Target pocket
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-dashed border-white/55" />
                  Ghost ball (aim point)
                </div>
              </div>
              <Link
                href="/glossary"
                className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass-bright)] transition-colors hover:text-[var(--color-brass)]"
              >
                <BookOpen size={12} />
                Look up a term →
              </Link>
            </section>
          </aside>
        </div>

        {/* Prev / next */}
        <nav className="mt-14 grid gap-4 sm:grid-cols-2">
          {prev ? (
            <PrevNextCard href={`/shots/${prev.id}`} dir="prev" label="Previous shot" number={prev.number} name={prev.name} />
          ) : (
            <div className="hidden sm:block" />
          )}
          {next ? (
            <PrevNextCard href={`/shots/${next.id}`} dir="next" label="Next shot" number={next.number} name={next.name} />
          ) : (
            <div />
          )}
        </nav>
      </div>
    </>
  );
}

function BallSwatch({ className }: { className: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 shrink-0 rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${className}`}
    />
  );
}

function SpecTile({
  label,
  swatch,
  children,
}: {
  label: string;
  swatch: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-black/30 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
      <span className="mt-0.5">{swatch}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/45">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm leading-snug text-[var(--color-cream)]">{children}</dd>
      </div>
    </div>
  );
}

function PrevNextCard({
  href,
  dir,
  label,
  number,
  name,
}: {
  href: string;
  dir: "prev" | "next";
  label: string;
  number: number;
  name: string;
}) {
  const next = dir === "next";
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
          {label} · {String(number).padStart(2, "0")}
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-[0.95] tracking-wide text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)] sm:text-3xl">
          {name}
        </p>
      </div>
    </Link>
  );
}
