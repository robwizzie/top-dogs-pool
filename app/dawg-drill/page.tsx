import { Suspense } from "react";
import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import { DawgDrillRunner } from "@/components/shots/DawgDrillRunner";

export const dynamic = "force-static";

export const metadata = {
  title: "Dawg Drill — Top Dogs Pool",
  description:
    "Build a custom Dawg Drill: pick any shots, set how many reps you'll take of each, and run them in any order.",
};

export default function DawgDrillPage() {
  return (
    <main className="min-h-dvh bg-[var(--bg)]">
      <Suspense fallback={null}>
        <DawgDrillRunner shots={KINISTER_SHOTS} />
      </Suspense>
    </main>
  );
}
