import Link from "next/link";
import { PageHeader } from "@/components/ui/Section";
import { SessionPicker } from "@/components/leaderboard/SessionPicker";
import { HeaderRail } from "@/components/season/SeasonKit";
import { Logo } from "@/components/brand/Logo";
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
import { pageMetadata } from "@/lib/site";

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



export const metadata = pageMetadata({
  title: "Standings",
  description:
    "Full APA division standings for Top Dawgs — points, wins, and where every team sits this session and past ones.",
  path: "/standings",
});

type Props = {
  query: { session?: string };
};

export async function StandingsView({ query }: Props) {
  const { session } = query;
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
  // Header rail numbers — display only, derived from the table below.
  const leaderPts = standings.reduce((m, s) => Math.max(m, s.points), 0);
  const ranked = ours && ours.rank > 0;
  const chaser = ours
    ? standings
        .filter((s) => !s.isOurs)
        .reduce<Standing | null>((best, s) => (!best || s.points > best.points ? s : best), null)
    : null;
  const gap = ours
    ? ours.points >= leaderPts
      ? chaser
        ? ours.points - chaser.points
        : 0
      : ours.points - leaderPts
    : 0;

  return (
    <>
      <PageHeader
        eyebrow="Division"
        title="Standings"
        subtitle={
          ours
            ? ours.rank > 0
              ? `${sessionLabel} · Top Dawgs at #${ours.rank}${ours.isTied ? " (T)" : ""} with ${ours.points} pts`
              : `${sessionLabel} · standings open after week 1 · Top Dawgs ${ours.points} pts`
            : `${sessionLabel} · ${standings.length} team${standings.length === 1 ? "" : "s"}`
        }
      >
        {ours && (
          <HeaderRail
            cells={[
              {
                label: "Top Dawgs",
                value: ranked ? (
                  <>
                    <span className="text-[0.55em] text-[var(--color-cream)]/45">#</span>
                    {ours.rank}
                    {ours.isTied ? <span className="text-[0.5em] text-[var(--color-cream)]/45"> T</span> : null}
                    <span className="text-[0.45em] text-[var(--color-cream)]/40"> of {standings.length}</span>
                  </>
                ) : (
                  "—"
                ),
                accent: ranked && ours.rank === 1,
              },
              { label: "Points", value: ours.points },
              {
                label: ours.points >= leaderPts ? "Lead" : "Behind",
                value: (
                  <span
                    className={
                      gap > 0
                        ? "text-[var(--color-felt-bright)]"
                        : gap < 0
                          ? "text-[var(--color-pop-bright)]"
                          : undefined
                    }
                  >
                    {gap > 0 ? "+" : ""}
                    {gap}
                  </span>
                ),
                note: ours.points >= leaderPts ? "pts over 2nd" : "pts off the top",
              },
              { label: "Played", value: ours.matchesPlayed },
            ]}
          />
        )}
      </PageHeader>

      <div className="mx-auto max-w-5xl px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <SessionPicker
            basePath="/standings"
            sessions={sessions}
            selectedIds={selectedIds}
            showAllTime={false}
            singleSelect
          />
        </div>

        {standings.length === 0 ? (
          <p className="pm-glass p-6 text-sm text-[var(--color-cream)]/60">
            No standings cached for this session yet — run{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
              npm run sync
            </code>
            .
          </p>
        ) : (
          <div className="pm-glass overflow-hidden p-1.5 sm:p-2">
            <table className="w-full table-fixed border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/40">
                  <th className="w-[3.75rem] px-3 pb-1 pt-3 sm:w-24 sm:px-5">#</th>
                  <th className="px-2 pb-1 pt-3 sm:px-4">Team</th>
                  <th className="hidden w-24 whitespace-nowrap px-4 pb-1 pt-3 text-right sm:table-cell">
                    Last wk
                  </th>
                  <th className="w-10 px-2 pb-1 pt-3 text-right sm:w-24 sm:px-4">
                    <span className="sm:hidden">P</span>
                    <span className="hidden sm:inline">Played</span>
                  </th>
                  <th className="w-14 px-3 pb-1 pt-3 text-right sm:w-24 sm:px-5">Pts</th>
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
                  const podium = s.rank > 0 && s.rank <= 3;
                  const share = leaderPts > 0 ? (s.points / leaderPts) * 100 : 0;
                  const teamLabel = (
                    <span className="flex min-w-0 items-center gap-2.5">
                      {s.isOurs && (
                        <Logo size={32} className="!h-7 !w-7 shrink-0 drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)] sm:!h-8 sm:!w-8" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate",
                            s.isOurs
                              ? "font-[family-name:var(--font-display)] text-xl leading-none tracking-wide text-[var(--color-cream)] sm:text-2xl"
                              : "font-medium text-[var(--color-cream)]/90",
                            linkable && "transition-colors group-hover:text-[var(--color-brass-bright)]",
                          )}
                        >
                          {s.team}
                          {s.teamNumber && (
                            <span className="ml-1.5 hidden font-sans text-[11px] font-normal tracking-normal text-[var(--color-cream)]/35 sm:inline">
                              {s.teamNumber}
                            </span>
                          )}
                        </span>
                        {/* Lane meter — points as a share of the leader's. */}
                        <span className="mt-1.5 block h-[3px] w-full max-w-[16rem] overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              s.isOurs
                                ? "bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-brass-bright)] shadow-[0_0_8px_rgba(224,190,107,0.6)]"
                                : "bg-[var(--color-cream)]/25",
                            )}
                            style={{ width: `${share}%` }}
                          />
                        </span>
                      </span>
                    </span>
                  );
                  // Row "lane": cells share one rounded background. The first
                  // and last cells carry the rounding.
                  const cell = cn(
                    "py-3 transition-colors",
                    s.isOurs
                      ? "bg-[rgba(46,139,87,0.3)] shadow-[inset_0_1px_0_rgba(224,190,107,0.35),inset_0_-1px_0_rgba(224,190,107,0.18)]"
                      : linkable
                        ? "bg-white/[0.02] group-hover:bg-white/[0.05]"
                        : "bg-white/[0.02]",
                  );
                  return (
                    <tr
                      key={`${s.rank}-${s.team}`}
                      className={cn("group fade-in-up", s.isOurs && "relative")}
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <td
                        className={cn(
                          cell,
                          "rounded-l-2xl px-3 sm:px-5",
                          s.isOurs &&
                            "shadow-[inset_3px_0_0_var(--color-brass-bright),inset_0_1px_0_rgba(224,190,107,0.35),inset_0_-1px_0_rgba(224,190,107,0.18)]",
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              "font-[family-name:var(--font-display)] text-3xl leading-none tabular-nums sm:text-4xl",
                              s.isOurs
                                ? "pm-foil"
                                : podium
                                  ? "text-[var(--color-brass-bright)]/80"
                                  : "text-[var(--color-cream)]/35",
                            )}
                          >
                            {s.rank > 0 ? s.rank : "—"}
                          </span>
                          <span className="flex flex-col items-start gap-0.5">
                            {s.isTied && s.rank > 0 && (
                              <span className="text-[9px] font-bold leading-none tracking-[0.1em] text-[var(--color-cream)]/40">
                                T
                              </span>
                            )}
                            <RankDelta delta={delta} />
                          </span>
                        </span>
                      </td>
                      <td className={cn(cell, "px-2 sm:px-4")}>
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
                      <td className={cn(cell, "hidden px-4 text-right tabular-nums text-[var(--color-cream)]/45 sm:table-cell")}>
                        {s.pointsLastWeek ?? "—"}
                      </td>
                      <td className={cn(cell, "px-2 text-right tabular-nums text-[var(--color-cream)]/45 sm:px-4")}>
                        {s.matchesPlayed}
                      </td>
                      <td
                        className={cn(
                          cell,
                          "rounded-r-2xl px-3 text-right font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide tabular-nums sm:px-5 sm:text-3xl",
                          s.isOurs ? "text-[var(--color-brass-bright)]" : "text-[var(--color-cream)]/85",
                        )}
                      >
                        {s.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--color-cream)]/[0.07] bg-black/20 p-5 text-xs leading-relaxed text-[var(--color-cream)]/55">
          <span className="mt-1 h-2 w-2 shrink-0 rotate-45 rounded-[1px] bg-[var(--color-brass-bright)] shadow-[0_0_8px_rgba(224,190,107,0.6)]" aria-hidden />
          <p>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
              How standings work
            </span>
            APA awards each team up to 25 points per match week. Ties in rank
            are flagged with a small <strong className="text-[var(--color-cream)]/80">T</strong>. The{" "}
            <span className="text-[var(--color-brass-bright)]">Top Dawgs</span>{" "}
            row is highlighted.
          </p>
        </div>
      </div>
    </>
  );
}
