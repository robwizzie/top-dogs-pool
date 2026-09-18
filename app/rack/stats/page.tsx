import { RackHero } from "@/components/rack/ui";
import { StatsView } from "@/components/rack/StatsView";

export const metadata = { title: "Rack Up stats" };

export default function RackStatsPage() {
  return (
    <>
      <RackHero title="Stats" subtitle="Everything scored at the table — records, streaks, head-to-head and practice bests." />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <StatsView />
      </div>
    </>
  );
}
