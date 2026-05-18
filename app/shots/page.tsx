import { PageHeader } from "@/components/ui/Section";
import { ShotCard } from "@/components/shots/ShotCard";
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
        subtitle="Bert Kinister's drill catalog — the shots we're grinding to sharpen stroke, position, and shape. Tap a shot for the diagram, replay, and the mistakes to avoid."
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {KINISTER_SHOTS.map((shot) => (
            <ShotCard key={shot.id} shot={shot} />
          ))}
        </div>

        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-[var(--fg-dim)]">
          Heads up: Kinister deliberately never published diagrams for the
          60 Minute Workout — the videos are the source of truth. The setups
          here match his verbal descriptions; treat the geometry as a guide
          and fine-tune as you drill. Source list maintained alongside the
          team — open an issue or DM with corrections.
        </p>
      </div>
    </>
  );
}
