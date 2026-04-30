import { PageHeader, Section } from "@/components/ui/Section";
import { MatchCard } from "@/components/cards/MatchCard";
import { getSchedule } from "@/lib/apa";

export const revalidate = 3600;

export const metadata = {
  title: "Schedule",
  description: "Top Dogs full season schedule and results.",
};

export default async function SchedulePage() {
  const schedule = await getSchedule();
  const now = Date.now();
  const upcoming = schedule
    .filter((m) => m.status === "upcoming" || new Date(m.date).getTime() >= now)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const past = schedule
    .filter((m) => m.status === "completed")
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title="Schedule"
        subtitle="Every match this season — past and upcoming. Synced from APA."
      />

      <Section eyebrow="Upcoming" title={`Next ${upcoming.length || ""}`.trim()}>
        {upcoming.length === 0 ? (
          <p className="surface p-6 text-sm text-[var(--fg-dim)]">
            No upcoming matches scheduled yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((m, i) => (
              <MatchCard key={m.id} match={m} highlight={i === 0} />
            ))}
          </div>
        )}
      </Section>

      <Section eyebrow="History" title="Results">
        {past.length === 0 ? (
          <p className="surface p-6 text-sm text-[var(--fg-dim)]">
            No completed matches yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {past.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
