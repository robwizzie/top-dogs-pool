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
