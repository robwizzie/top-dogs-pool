import { PageHeader } from "@/components/ui/Section";
import { PlayerCard } from "@/components/cards/PlayerCard";
import { getRoster } from "@/lib/apa";

export const revalidate = 3600;

export const metadata = {
  title: "Roster",
  description: "The Top Dogs roster — players, formats, and skill levels.",
};

export default async function RosterPage() {
  const roster = await getRoster();

  return (
    <>
      <PageHeader
        eyebrow="The Pack"
        title="Roster"
        subtitle={`${roster.length} player${roster.length === 1 ? "" : "s"} repping the Top Dogs.`}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {roster.length === 0 ? (
          <p className="surface p-6 text-sm text-[var(--fg-dim)]">
            Roster syncing from APA — refresh in a minute.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {roster.map((p, i) => (
              <PlayerCard key={p.id} player={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
