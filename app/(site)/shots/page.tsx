import Link from "next/link";
import { ArrowRight, BookOpen, Dog, LineChart } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { PointerSheen } from "@/components/home/PointerSheen";
import { ShotsGallery } from "@/components/shots/ShotsGallery";
import { DrillCard } from "@/components/shots/DrillCard";
import { HeaderChip, SECONDARY_PILL, TrainingHeading } from "@/components/shots/TrainingUI";
import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import { DRILLS } from "@/lib/kinister/drills";

export const dynamic = "force-static";

export const metadata = {
  title: "Shots — The Kinister Workout",
  description:
    "Bert Kinister's drill catalog — the shots Top Dawgs are grinding to sharpen stroke, position, and shape.",
};

export default function ShotsPage() {
  const tiers = new Set(KINISTER_SHOTS.map((s) => s.difficulty)).size;
  return (
    <>
      <PageHeader
        eyebrow="The Kinister Workout"
        title="Shots"
        subtitle="Bert Kinister's drill catalog — the shots we're grinding to sharpen stroke, position, and shape. Tap a shot for the diagram, replay, source video, and the mistakes to avoid."
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/dawg-drill"
              className="pm-btn"
              title="Build a custom drill — pick any shots and set how many reps you want of each."
            >
              <Dog size={16} />
              Start a Dawg Drill
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/stats"
              className={`${SECONDARY_PILL} h-12 px-5`}
              title="Make rate, streaks, strongest & weakest shots, achievements."
            >
              <LineChart size={14} />
              Your practice stats
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <HeaderChip>
              <span className="font-[family-name:var(--font-display)] text-base leading-none tracking-wide text-[var(--color-brass-bright)]">
                {KINISTER_SHOTS.length}
              </span>
              shots
            </HeaderChip>
            <HeaderChip>
              <span className="font-[family-name:var(--font-display)] text-base leading-none tracking-wide text-[var(--color-brass-bright)]">
                {DRILLS.length}
              </span>
              routines
            </HeaderChip>
            <HeaderChip>
              <span className="font-[family-name:var(--font-display)] text-base leading-none tracking-wide text-[var(--color-brass-bright)]">
                {tiers}
              </span>
              tiers
            </HeaderChip>
            <Link
              href="/glossary"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/70 backdrop-blur-sm transition-colors hover:border-[var(--color-brass)]/50 hover:text-[var(--color-brass-bright)]"
            >
              <BookOpen size={13} />
              Glossary
            </Link>
          </div>
        </div>
      </PageHeader>
      <PointerSheen />

      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 sm:pb-16 lg:px-8">
        <section>
          <TrainingHeading index="01" eyebrow="The catalog" title="Every Shot" />
          <ShotsGallery shots={[...KINISTER_SHOTS]} />
        </section>

        <section className="mt-16 sm:mt-24">
          <TrainingHeading index="02" eyebrow="Practice drills" title="Routines & Drills" />
          <p className="-mt-2 mb-7 max-w-3xl text-sm leading-relaxed text-[var(--color-cream)]/60 sm:text-base">
            Multi-ball routines and progression drills that go beyond a
            single shot. Use them to score yourself across a session and
            track measurable improvement over time.
          </p>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {DRILLS.map((drill) => (
              <DrillCard key={drill.id} drill={drill} />
            ))}
          </div>
        </section>

        <aside className="mt-14 flex max-w-3xl gap-4 border-l border-[var(--color-brass)]/40 pl-5">
          <p className="text-xs leading-relaxed text-[var(--color-cream)]/50 sm:text-sm">
            <span className="pm-serif mr-1 text-base text-[var(--color-cream)]/80 sm:text-lg">
              Heads up —
            </span>
            Kinister deliberately never published diagrams for the 60 Minute
            Workout — the videos are the source of truth. The setups here
            match his verbal descriptions; treat the geometry as a guide and
            fine-tune as you drill. Per-shot timestamps are filled in as we
            catalogue them.
          </p>
        </aside>
      </div>
    </>
  );
}
