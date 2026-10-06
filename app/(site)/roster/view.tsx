import { PageHeader } from "@/components/ui/Section";
import { PlayerCard } from "@/components/cards/PlayerCard";
import { RackSkeleton } from "@/components/ui/RackSkeleton";
import { HeaderRail } from "@/components/season/SeasonKit";
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



export const metadata = {
  title: "Roster",
  description: "Top Dawgs roster — current and historical, by session.",
};

type Props = {
  query: { session?: string };
};

export async function RosterView({ query }: Props) {
  const { session } = query;
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

  // Quick-glance team numbers for the header rail (display only).
  const teamWins = roster.reduce((n, p) => n + (p.stats?.wins ?? 0), 0);
  const teamPlayed = roster.reduce((n, p) => n + (p.stats?.matchesPlayed ?? 0), 0);
  const skills = roster
    .map((p) => p.skillLevel)
    .filter((sl): sl is number => typeof sl === "number" && sl > 0);
  const avgSkill = skills.length
    ? Math.round((skills.reduce((a, b) => a + b, 0) / skills.length) * 10) / 10
    : null;
  const onFire = roster.filter((p) => {
    const st = streaks.get(p.id);
    return st?.type === "W" && st.count >= 3;
  }).length;

  return (
    <>
      <PageHeader
        eyebrow="The Pack"
        title={
          <>
            Roster
            <span className="pm-serif ml-3 align-middle text-[0.4em] tracking-normal text-[var(--color-cream)]/60">
              meet the dawgs
            </span>
          </>
        }
        subtitle={`${sessionLabel} · ${roster.length} player${roster.length === 1 ? "" : "s"}`}
      >
        {roster.length > 0 && (
          <HeaderRail
            cells={[
              { label: "Players", value: roster.length },
              {
                label: "Individual record",
                value: teamPlayed ? (
                  <>
                    {teamWins}
                    <span className="text-[var(--color-cream)]/30">–</span>
                    {teamPlayed - teamWins}
                  </>
                ) : (
                  "—"
                ),
                accent: teamPlayed > 0,
              },
              { label: "Avg skill", value: avgSkill !== null ? `SL ${avgSkill}` : "—" },
              { label: "On a heater", value: onFire, note: "3+ wins in a row" },
            ]}
          />
        )}
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <div className="mb-8">
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
