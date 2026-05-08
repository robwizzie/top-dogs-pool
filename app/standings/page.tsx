import Link from "next/link";
import { PageHeader } from "@/components/ui/Section";
import { SessionPicker } from "@/components/leaderboard/SessionPicker";
import {
  getCurrentSession,
  getOpponentTeams,
  getSessions,
  getStandings,
} from "@/lib/apa";
import type { Standing } from "@/lib/apa/schemas";
import { cn } from "@/lib/utils";
import {
  parseSessionScope,
  resolveScope,
  scopeLabel,
} from "@/lib/session-scope";

/**
 * Rank teams by `pointsLastWeek` (descending) to derive last week's standings,
 * keyed by team name. Returns a map from team → previous rank. Teams without
 * a `pointsLastWeek` value are omitted (we can't show a meaningful delta).
 */
function computePrevRanks(standings: Standing[]): Map<string, number> {
  const eligible = standings.filter(
    (s) => s.pointsLastWeek !== null && s.pointsLastWeek !== undefined,
  );
  if (eligible.length === 0) return new Map();
  const sorted = [...eligible].sort(
    (a, b) => (b.pointsLastWeek ?? 0) - (a.pointsLastWeek ?? 0),
  );
  const ranks = new Map<string, number>();
  let lastPts = Number.POSITIVE_INFINITY;
  let lastRank = 0;
  sorted.forEach((s, i) => {
    const pts = s.pointsLastWeek ?? 0;
    const rank = pts === lastPts ? lastRank : i + 1;
    ranks.set(s.team, rank);
    lastPts = pts;
    lastRank = rank;
  });
  return ranks;
}

function RankDelta({ delta }: { delta: number }) {
  if (!delta) return null;
  const up = delta > 0;
  return (
    <span
      className={cn(
        "rank-delta inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums",
        up ? "text-[var(--color-felt-bright)]" : "text-[var(--color-pop-bright)]",
      )}
      title={up ? `Up ${delta} from last week` : `Down ${Math.abs(delta)} from last week`}
      aria-label={up ? `Up ${delta}` : `Down ${Math.abs(delta)}`}
      data-direction={up ? "up" : "down"}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span>{Math.abs(delta)}</span>
    </span>
  );
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Standings",
  description: "Full division standings — current session and past sessions.",
};

type Props = {
  searchParams: Promise<{ session?: string }>;
};

export default async function StandingsPage({ searchParams }: Props) {
  const { session } = await searchParams;
  const [sessions, currentSession, oppTeams] = await Promise.all([
    getSessions(),
    getCurrentSession(),
    getOpponentTeams(),
  ]);
  const allIds = sessions.map((s) => s.id);
  const scope = parseSessionScope(session, allIds);
  const selectedIds = resolveScope(scope, allIds, currentSession?.id);
  // Standings are point-in-time — pick the most-recent selected session.
  const primaryId = Math.max(...selectedIds);

  const standings = await getStandings(primaryId);
  // Compute "delta vs last week" by ranking the previous-week point totals
  // (pointsLastWeek). Ties share a rank using competition-style ordering.
  const prevRanks = computePrevRanks(standings);
  // Index opp teams by id so we can wire up clickable rows quickly.
  const oppTeamIds = new Set(oppTeams.map((t) => t.id));
  const primaryName = sessions.find((s) => s.id === primaryId)?.name;
  const sessionLabel =
    selectedIds.size > 1
      ? `${scopeLabel(selectedIds, sessions)} · showing ${primaryName ?? primaryId}`
      : primaryName ?? scopeLabel(selectedIds, sessions);
  const ours = standings.find((s) => s.isOurs);

  return (
    <>
      <PageHeader
        eyebrow="Division"
        title="Standings"
        subtitle={
          ours
            ? `${sessionLabel} · Top Dogs at #${ours.rank}${ours.isTied ? " (T)" : ""} with ${ours.points} pts`
            : `${sessionLabel} · ${standings.length} team${standings.length === 1 ? "" : "s"}`
        }
      />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5">
          <SessionPicker
            basePath="/standings"
            sessions={sessions}
            selectedIds={selectedIds}
            showAllTime={false}
            singleSelect
          />
        </div>

        {standings.length === 0 ? (
          <p className="surface p-6 text-sm text-[var(--fg-dim)]">
            No standings cached for this session yet — run{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
              npm run sync
            </code>
            .
          </p>
        ) : (
          <div className="surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">
                    Last
                  </th>
                  <th className="px-4 py-3 text-right">Played</th>
                  <th className="px-4 py-3 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, idx) => {
                  const prev = prevRanks.get(s.team);
                  const delta =
                    prev !== undefined && Number.isFinite(prev)
                      ? prev - s.rank
                      : 0;
                  const linkable =
                    !s.isOurs &&
                    typeof s.teamId === "number" &&
                    oppTeamIds.has(s.teamId);
                  const teamLabel = (
                    <>
                      <span
                        className={
                          s.isOurs
                            ? "rounded-full bg-[var(--color-brass)] px-2 py-0.5 text-[var(--color-ink)]"
                            : linkable
                              ? "hover:text-[var(--color-brass)]"
                              : ""
                        }
                      >
                        {s.team}
                      </span>
                      {s.teamNumber && (
                        <span className="ml-1.5 text-xs text-[var(--fg-dim)]">
                          ({s.teamNumber})
                        </span>
                      )}
                    </>
                  );
                  return (
                    <tr
                      key={`${s.rank}-${s.team}`}
                      className={cn(
                        "fade-in-up border-b border-[var(--border)] last:border-0",
                        s.isOurs && "bg-[var(--color-felt-deep)]/40",
                        linkable && "transition-colors hover:bg-[var(--bg-soft)]/50",
                      )}
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <td className="px-4 py-3 font-[family-name:var(--font-display)] text-2xl tracking-wide tabular-nums">
                        <span className="inline-flex items-baseline gap-1.5">
                          <span>{s.rank}</span>
                          {s.isTied && (
                            <span className="text-xs text-[var(--fg-dim)]">
                              T
                            </span>
                          )}
                          <RankDelta delta={delta} />
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {linkable ? (
                          <Link
                            href={`/opponents/${s.teamId}`}
                            className="block"
                          >
                            {teamLabel}
                          </Link>
                        ) : (
                          teamLabel
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-[var(--fg-dim)] sm:table-cell">
                        {s.pointsLastWeek ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--fg-dim)]">
                        {s.matchesPlayed}
                      </td>
                      <td className="px-4 py-3 text-right font-[family-name:var(--font-display)] text-xl tracking-wide tabular-nums text-[var(--color-brass-bright)]">
                        {s.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="surface mt-6 p-5 text-sm text-[var(--fg-dim)]">
          <h3 className="mb-2 font-semibold text-[var(--fg)]">
            How standings work
          </h3>
          <p className="text-xs">
            APA awards each team up to 25 points per match week. Ties in rank
            are flagged with a small <strong>T</strong>. The{" "}
            <span className="text-[var(--color-brass-bright)]">Top Dogs</span>{" "}
            row is highlighted.
          </p>
        </div>
      </div>
    </>
  );
}
