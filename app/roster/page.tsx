import { PageHeader } from "@/components/ui/Section";
import { PlayerCard } from "@/components/cards/PlayerCard";
import { RackSkeleton } from "@/components/ui/RackSkeleton";
import { SessionPicker } from "@/components/leaderboard/SessionPicker";
import {
  getCurrentSession,
  getPatchInstances,
  getPlayerStreaks,
  getRoster,
  getSessions,
} from "@/lib/apa";
import {
  parseSessionScope,
  resolveScope,
  scopeLabel,
} from "@/lib/session-scope";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Roster",
  description: "Top Dawgs roster — current and historical, by session.",
};

type Props = {
  searchParams: Promise<{ session?: string }>;
};

export default async function RosterPage({ searchParams }: Props) {
  const { session } = await searchParams;
  const [sessions, currentSession] = await Promise.all([
    getSessions(),
    getCurrentSession(),
  ]);
  const allIds = sessions.map((s) => s.id);
  const scope = parseSessionScope(session, allIds);
  const selectedIds = resolveScope(scope, allIds, currentSession?.id);
  // Roster is per-session — show the most recent of the selection.
  const primaryId = Math.max(...selectedIds);

  const [roster, streaks, patchInstances] = await Promise.all([
    getRoster(primaryId),
    getPlayerStreaks(),
    getPatchInstances(selectedIds),
  ]);
  const primaryName = sessions.find((s) => s.id === primaryId)?.name;
  const sessionLabel =
    selectedIds.size > 1
      ? `${scopeLabel(selectedIds, sessions)} · showing ${primaryName ?? primaryId}`
      : primaryName ?? scopeLabel(selectedIds, sessions);

  return (
    <>
      <PageHeader
        eyebrow="The Pack"
        title="Roster"
        subtitle={`${sessionLabel} · ${roster.length} player${roster.length === 1 ? "" : "s"}`}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <SessionPicker
            basePath="/roster"
            sessions={sessions}
            selectedIds={selectedIds}
            showAllTime={false}
            singleSelect
          />
        </div>

        {roster.length === 0 ? (
          <div className="surface">
            <RackSkeleton message="Racking the roster — pull again in a minute" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {roster.map((p, i) => (
              <PlayerCard
                key={p.id}
                player={p}
                index={i}
                streak={streaks.get(p.id) ?? null}
                patchInstances={patchInstances.get(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
