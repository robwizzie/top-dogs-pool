import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getShot, KINISTER_SHOTS } from "@/lib/kinister/shots";
import { ShotAR } from "@/components/shots/ShotAR";

type Params = { id: string };

export function generateStaticParams(): Params[] {
  return KINISTER_SHOTS.map((s) => ({ id: s.id }));
}

export const metadata = {
  title: "AR Aim — Top Dogs Pool",
  description:
    "Overlay the ghost ball and aim line on a live camera view of your pool table.",
};

export default async function ShotARPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const shot = getShot(id);
  if (!shot) notFound();
  // Multi-ball sequence shots don't have a single ghost-ball geometry,
  // so AR view is not meaningful for them.
  if (shot.sequence) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-12 sm:px-6">
        <Link
          href={`/shots/${shot.id}`}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
        >
          <ArrowLeft size={14} />
          Back to {shot.name}
        </Link>
        <div className="surface p-6">
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
            AR view not available for multi-ball drills
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--fg-dim)]">
            AR Aim overlays the ghost ball for a single cue-ball / object-ball
            shot. Multi-ball sequences ({shot.name}) don&apos;t have one
            ghost-ball setup — open the shot detail page to walk through
            the sequence diagrams instead.
          </p>
        </div>
      </main>
    );
  }
  return <ShotAR shot={shot} />;
}
