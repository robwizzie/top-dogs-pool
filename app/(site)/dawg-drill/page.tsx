import { Suspense } from "react";
import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import {
  DawgDrillHeader,
  DawgDrillRunner,
} from "@/components/shots/DawgDrillRunner";

export const dynamic = "force-static";

export const metadata = {
  title: "Dawg Drill — Top Dogs Pool",
  description:
    "Build a custom Dawg Drill: pick any shots, set how many reps you'll take of each, and run them in any order.",
};

export default function DawgDrillPage() {
  // The runner reads search params, so it renders client-side; the
  // fallback paints the same felt header so the page never flashes empty.
  return (
    <Suspense fallback={<DawgDrillHeader />}>
      <DawgDrillRunner shots={KINISTER_SHOTS} />
    </Suspense>
  );
}
