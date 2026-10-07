import { Suspense } from "react";
import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import {
  DawgDrillHeader,
  DawgDrillRunner,
} from "@/components/shots/DawgDrillRunner";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  title: "Dawg Drill",
  description:
    "Build a custom pool practice routine: pick any shots, set reps for each, and run them in any order with live scoring.",
  path: "/dawg-drill",
});

export default function DawgDrillPage() {
  // The runner reads search params, so it renders client-side; the
  // fallback paints the same felt header so the page never flashes empty.
  return (
    <Suspense fallback={<DawgDrillHeader />}>
      <DawgDrillRunner shots={KINISTER_SHOTS} />
    </Suspense>
  );
}
