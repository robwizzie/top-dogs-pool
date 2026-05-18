import { PageHeader } from "@/components/ui/Section";
import { ShotsGallery } from "@/components/shots/ShotsGallery";
import { KINISTER_SHOTS } from "@/lib/kinister/shots";

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
