import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Target } from "lucide-react";
import { PoolTable } from "@/components/shots/PoolTable";
import { LampStage } from "@/components/shots/TrainingUI";
import { getShot, KINISTER_SHOTS } from "@/lib/kinister/shots";
import { describePosition, pocketLabel } from "@/lib/kinister/setup";

type Params = { id: string };

export const dynamicParams = false;
export const revalidate = false;

export function generateStaticParams(): Params[] {
  return KINISTER_SHOTS.map((s) => ({ id: s.id }));
}

export default async function ShotPracticePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const shot = getShot(id);
  if (!shot) notFound();

  // Pick the single most important tip — first tip line — plus the
  // technique one-liner. Anything else is noise on the rail.
  const topTip = shot.tips[0];
  const topMistake = shot.commonMistakes[0];

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-4">
        <Link
          href={`/shots/${shot.id}`}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
        >
          <ArrowLeft size={14} />
          Back
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          Shot {String(shot.number).padStart(2, "0")}
        </p>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-5">
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-[0.9] tracking-wide text-[var(--color-cream)] sm:text-5xl">
          {shot.name}
        </h1>

        {/* Big diagram + english indicator */}
        <LampStage compact>
          <PoolTable shot={shot} interactive />
        </LampStage>

        {/* Setup — only what you need to rack the balls */}
        {!shot.sequence && (
          <div className="pm-glass p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-[var(--color-brass-bright)]" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
                Rack
              </p>
            </div>
            <dl className="mt-2 grid gap-2 text-sm">
              <div className="flex items-baseline gap-3">
                <dt className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
                  Cue ball
                </dt>
                <dd className="flex-1 leading-snug text-[var(--fg)]">
                  {describePosition(shot.cueBall)}
                </dd>
              </div>
              <div className="flex items-baseline gap-3">
                <dt className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
                  Object ball
                </dt>
                <dd className="flex-1 leading-snug text-[var(--fg)]">
                  {describePosition(shot.objectBall)}
                </dd>
              </div>
              {shot.targetPocket && (
                <div className="flex items-baseline gap-3">
                  <dt className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-dim)]">
                    Target
                  </dt>
                  <dd className="flex-1 leading-snug text-[var(--fg)]">
                    {pocketLabel(shot.targetPocket)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Single-line technique cue + key tip + key mistake */}
        <div className="pm-glass p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-[var(--color-brass-bright)]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
              Hit it
            </p>
          </div>
          <p className="mt-2 text-base leading-relaxed text-[var(--fg)]">
            {shot.technique}
          </p>
          {topTip && (
            <p className="mt-3 border-l-2 border-[var(--color-brass)] pl-3 text-sm leading-relaxed text-[var(--fg-dim)]">
              <span className="font-semibold text-[var(--color-brass-bright)]">
                Tip:{" "}
              </span>
              {topTip}
            </p>
          )}
          {topMistake && (
            <p className="mt-2 border-l-2 border-[var(--color-pop)] pl-3 text-sm leading-relaxed text-[var(--fg-dim)]">
              <span className="font-semibold text-[var(--color-pop-bright)]">
                Avoid:{" "}
              </span>
              {topMistake}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
