import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import { StatsDashboard } from "@/components/shots/StatsDashboard";

export const dynamic = "force-static";

export const metadata = {
  title: "Stats — Top Dogs Pool",
  description: "Your tracked practice stats, streaks, and achievements.",
};

export default function StatsPage() {
  return <StatsDashboard shots={KINISTER_SHOTS} />;
}
