import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import { StatsDashboard } from "@/components/shots/StatsDashboard";
import { pageMetadata } from "@/lib/site";

export const dynamic = "force-static";

export const metadata = pageMetadata({
  title: "Practice Stats",
  description:
    "Tracked pool practice stats — make rates, streaks, and achievements across every shot and drill.",
  path: "/stats",
});

export default function StatsPage() {
  return <StatsDashboard shots={KINISTER_SHOTS} />;
}
