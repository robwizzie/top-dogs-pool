import Link from "next/link";
import { Dog, LineChart } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { ShotsGallery } from "@/components/shots/ShotsGallery";
import { DrillCard } from "@/components/shots/DrillCard";
import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import { DRILLS } from "@/lib/kinister/drills";

export const metadata = {
  title: "Shots — The Kinister Workout",
  description:
    "Bert Kinister's drill catalog — the shots Top Dawgs are grinding to sharpen stroke, position, and shape.",
};

export default function ShotsPage() {
  return (
    <>
      <PageHeader
        eyebrow="The Kinister Workout"
        title="Shots"
        subtitle="Bert Kinister's drill catalog — the shots we're grinding to sharpen stroke, position, and shape. Tap a shot for the diagram, replay, source video, and the mistakes to avoid."
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/pack-run"
            className="surface surface-hover flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <Dog
                size={22}
                className="text-[var(--color-brass-bright)]"
              />
              <div>
                <p className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--fg)]">
                  Take the pack out
                </p>
                <p className="text-xs leading-relaxed text-[var(--fg-dim)]">
                  Build a custom Pack Run — any shots you want, however
                  many reps you want of each.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
              Open →
            </span>
          </Link>

          <Link
            href="/stats"
            className="surface surface-hover flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <LineChart
                size={22}
                className="text-[var(--color-brass-bright)]"
              />
              <div>
                <p className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--fg)]">
                  Your practice stats
                </p>
                <p className="text-xs leading-relaxed text-[var(--fg-dim)]">
                  Make rate, streaks, strongest &amp; weakest shots,
                  achievements.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
              Open →
            </span>
          </Link>
        </div>

        <ShotsGallery shots={[...KINISTER_SHOTS]} />

        <section className="mt-16 space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              Practice Drills
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--fg)]">
              Routines & Drills
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-[var(--fg-dim)]">
              Multi-ball routines and progression drills that go beyond a
              single shot. Use them to score yourself across a session and
              track measurable improvement over time.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {DRILLS.map((drill) => (
              <DrillCard key={drill.id} drill={drill} />
            ))}
          </div>
        </section>

        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-[var(--fg-dim)]">
          Heads up: Kinister deliberately never published diagrams for the
          60 Minute Workout — the videos are the source of truth. The setups
          here match his verbal descriptions; treat the geometry as a guide
          and fine-tune as you drill. Per-shot timestamps are filled in as
          we catalogue them.
        </p>
      </div>
    </>
  );
}
