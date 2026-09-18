import { PageHeader } from "@/components/ui/Section";
import { StatsView } from "@/components/rack/StatsView";

export const metadata = { title: "Rack Up stats" };

export default function RackStatsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Rack Up"
        title="Stats"
        subtitle="Everything scored at the table — wins, streaks, patches and head-to-head."
      />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <StatsView />
      </div>
    </>
  );
}
