import Link from "next/link";
import { PageHeader } from "@/components/ui/Section";
import { SessionPicker } from "@/components/leaderboard/SessionPicker";
import { loadSnapshot } from "@/lib/apa/client";
import {
  getCurrentSession,
  getRoster,
  getSessions,
} from "@/lib/apa";
import {
  achievements,
  calendarHeatmap,
  counterPickFor,
  expectedVsActual,
  gameInsights,
  homeAwayPerPlayer,
  homeAwaySplit,
  hotColdPlayers,
  levelUpWatch,
  lineupBreakdown,
  mvpRaceData,
  nextMatchBriefing,
  playerChemistry,
  playerForm,
  playerImpact,
  playerOpponentMatchups,
  playerVenueRecords,
  positionPerformance,
  radarStats,
  recordsBook,
  recordsBySkillLevel,
  reliabilityRanking,
  suggestedLineup,
  teamSummary,
  calibrationBacktest,
  opponentScoutingReport,
  predictLineup,
  throwAdvisorOpponents,
  venueRecords,
  vsOpponents,
  vsSkillLevelTable,
  weeklyTrend,
} from "@/lib/research";
import { CounterPickWidget } from "@/components/research/CounterPickWidget";
import { PlayerComparison } from "@/components/research/PlayerComparison";
import { ThrowAdvisor } from "@/components/research/ThrowAdvisor";
import { CalibrationView } from "@/components/research/CalibrationView";
import { ScoutingReport } from "@/components/research/ScoutingReport";
import { TeamBriefing } from "@/components/research/TeamBriefing";
import type { CounterPickRow } from "@/lib/research";
import type { Match, Player } from "@/lib/apa/schemas";
import { cn, formatDate } from "@/lib/utils";
import {
  parseSessionScope,
  resolveScope,
  scopeLabel as fmtScopeLabel,
} from "@/lib/session-scope";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Research",
  description:
    "Top Dogs analytics — best lineups, position strategy, opponent records, form, and a recommended starting five.",
};

type TabKey =
  | "overview"
  | "throw"
  | "briefing"
  | "lineups"
  | "players"
  | "opponents"
  | "venues";

const TABS: Array<{ key: TabKey; label: string; emoji: string; blurb: string }> = [
  { key: "overview", label: "Overview", emoji: "📊", blurb: "Headline numbers, who's hot, badges, all-time records." },
  { key: "throw", label: "Throw Advisor", emoji: "🎱", blurb: "Live: who to throw vs their putup, with full reasoning." },
  { key: "briefing", label: "Briefing", emoji: "🎯", blurb: "Next-match intel — counter-picks, impact, suggested 5." },
  { key: "lineups", label: "Lineups", emoji: "🤝", blurb: "Best 5-player combos, chemistry, position strategy." },
  { key: "players", label: "Players", emoji: "👤", blurb: "Per-player deep dives — radar, form, level-up, MVP race." },
  { key: "opponents", label: "Opponents", emoji: "⚔️", blurb: "Records vs each team and head-to-head matchups." },
  { key: "venues", label: "Venues & Time", emoji: "🍻", blurb: "Bars, home vs away, calendar heatmap, weekly trend." },
];

function parseTab(t: string | undefined): TabKey {
  const ok = TABS.some((x) => x.key === t);
  return (ok ? t : "overview") as TabKey;
}

type Props = {
  searchParams: Promise<{ session?: string; tab?: string }>;
};

function filterToSessions(matches: Match[], ids: Set<number>): Match[] {
  return matches.filter(
    (m) => m.sessionId !== undefined && ids.has(m.sessionId),
  );
}

export default async function ResearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const session = sp.session;
  const tab = parseTab(sp.tab);
  const [snap, sessions, currentSession] = await Promise.all([
    loadSnapshot(),
    getSessions(),
    getCurrentSession(),
  ]);

  const allIds = sessions.map((s) => s.id);
  const scope = parseSessionScope(session, allIds);
  const selectedIds = resolveScope(scope, allIds, currentSession?.id);
  const scopeLabel = fmtScopeLabel(selectedIds, sessions);

  const allMatches = Object.values(snap.matches).filter(
    (m) => snap.sessions.some((s) => s.id === m.sessionId),
  );
  const matches = filterToSessions(allMatches, selectedIds);

  // Roster: union across every selected session so past members (e.g. Greg,
  // Colleen) who only show up in older sessions still appear in the analytics
  // when "All" or a multi-session range is in scope. For each player we keep
  // the entry from their most-recent session so SL/profile is up-to-date.
  const sortedSelected = [...selectedIds].sort((a, b) => b - a);
  const rosterById = new Map<string, Player>();
  for (const sid of sortedSelected) {
    const sessionRoster = snap.sessionRosters[String(sid)] ?? [];
    for (const p of sessionRoster) {
      if (!rosterById.has(p.id)) rosterById.set(p.id, p);
    }
  }
  // Fallback: if nothing matched (e.g. roster snapshots empty), use the most
  // recent session's roster directly.
  if (rosterById.size === 0) {
    const fallback = await getRoster(Math.max(...selectedIds));
    for (const p of fallback) rosterById.set(p.id, p);
  }
  const roster: Player[] = [...rosterById.values()];
  const nameLookup = new Map<string, string>();
  for (const p of roster) nameLookup.set(p.id, p.name);
  for (const profile of Object.values(snap.players))
    if (!nameLookup.has(profile.id)) nameLookup.set(profile.id, profile.name);

  const summary = teamSummary(matches);
  const lineups = lineupBreakdown(matches, nameLookup);
  const positions = positionPerformance(matches, roster);
  const opponents = vsOpponents(matches);
  const split = homeAwaySplit(matches);
  const skill = vsSkillLevelTable(matches, roster);
  const form = playerForm(matches, roster);
  const reliability = reliabilityRanking(matches, roster);
  const recommendation = suggestedLineup(positions);

  // For "Hot & Cold" we want the broadest sample we have — always use
  // the union of all sessions so a player's recency window isn't truncated
  // by the user picking a short session.
  const hotCold = hotColdPlayers(allMatches, roster);
  // Chemistry, SL history, home/away per player — use scope.
  const chemistry = playerChemistry(matches, roster);
  const slHistory = recordsBySkillLevel(matches, roster);
  const homeAwaySL = homeAwayPerPlayer(matches, roster);
  const trend = weeklyTrend(matches);
  const insights = gameInsights(matches);
  // Per-player vs opponent + venue analytics use the active scope.
  const playerOppMatchups = playerOpponentMatchups(matches, roster);
  const homeVenueName = snap.team?.homeLocation;
  const venues = venueRecords(matches, homeVenueName);
  const playerVenues = playerVenueRecords(matches, roster, homeVenueName);

  // Phase 3 batch — analytics for all the new sections.
  const briefing = nextMatchBriefing(snap.schedule, matches, roster);
  const impact = playerImpact(matches, roster);
  const ach = achievements(matches, roster);
  const records = recordsBook(matches, roster);
  const mvpRace = mvpRaceData(matches, roster);
  const radar = radarStats(matches, roster);
  const calendar = calendarHeatmap(matches);
  const playersForLevelUp = roster.map((p) => {
    const profile = snap.players[p.id];
    return {
      id: p.id,
      name: p.name,
      skillLevel: p.skillLevel,
      visible: p.visible,
      sessions: profile?.sessions ?? [],
    };
  });
  const levelUps = levelUpWatch(playersForLevelUp);
  const expActual = expectedVsActual(matches);

  // Counter-pick: pre-compute a result per known opponent name.
  const opponentNames = new Set<string>();
  for (const m of matches) {
    if (m.status !== "completed") continue;
    for (const r of m.results) {
      const o = (r.opponentName ?? "").trim();
      if (o && o !== "Opponent") opponentNames.add(o);
    }
  }
  const counterPickFor_: Record<string, CounterPickRow[]> = {};
  for (const name of opponentNames) {
    const rows = counterPickFor(name, matches, roster);
    if (rows.length) counterPickFor_[name.toLowerCase()] = rows;
  }
  const counterPickOpponents = [...opponentNames].sort();
  // Best/worst opponent highlights for the "vs Teams" section.
  const oppByWinPct = [...opponents].sort(
    (a, b) =>
      b.winPct - a.winPct ||
      b.matchesPlayed - a.matchesPlayed,
  );
  const bestVsTeams = oppByWinPct
    .filter((o) => o.matchesPlayed >= 2 && o.wins > 0)
    .slice(0, 3);
  const toughestTeams = [...opponents]
    .filter((o) => o.matchesPlayed >= 2)
    .sort(
      (a, b) =>
        a.winPct - b.winPct ||
        b.losses - a.losses ||
        b.matchesPlayed - a.matchesPlayed,
    )
    .slice(0, 3);

  // Throw Advisor data — full match history (across selected scope) + opponent
  // autocomplete + a list of distinct venues for the location field.
  const throwOpponents = throwAdvisorOpponents(matches);
  const throwLocations = [
    ...new Set(matches.map((m) => m.location).filter((v): v is string => !!v)),
  ].sort();
  const nextScheduledMatch = snap.schedule
    .filter((m) => m.status === "upcoming" && m.opponent !== "BYE")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0];
  // Calibration backtest — replays the engine on every historical match
  // using only-prior-data, to measure how accurate our predictions are.
  const calibration = calibrationBacktest(matches, roster);
  // Pre-match scouting report on the upcoming opponent — enriched with
  // opp-player profiles when we've scraped them.
  const scoutingReport = nextScheduledMatch
    ? opponentScoutingReport(
        nextScheduledMatch.opponent,
        matches,
        roster,
        currentSession?.id,
        snap.opponentPlayers,
      )
    : null;
  // Identify the opp team id (if any) so the scouting report can deep-link
  // to the team page.
  const scoutingOppTeam = scoutingReport
    ? Object.values(snap.opponentTeams).find(
        (t) => t.name.trim().toLowerCase() === scoutingReport.team.trim().toLowerCase(),
      ) ?? null
    : null;
  const scoutingTeamId = scoutingOppTeam?.id ?? null;
  // Predicted lineups (both throw orders) — built from opp roster when we
  // have it scraped; falls back to scouting-report player list otherwise.
  const oppRosterForLineup = scoutingOppTeam
    ? scoutingOppTeam.roster.map((p) => ({
        name: p.name,
        latestSL: p.skillLevel,
        preferredPosition: undefined,
      }))
    : scoutingReport
      ? scoutingReport.players.map((p) => ({
          name: p.name,
          latestSL: p.latestSL,
          preferredPosition: p.preferredPosition,
        }))
      : [];
  const predictedWeFirst =
    nextScheduledMatch && oppRosterForLineup.length >= 5
      ? predictLineup(
          "we-first",
          matches,
          roster,
          nextScheduledMatch.opponent,
          oppRosterForLineup,
          nextScheduledMatch.location,
        )
      : null;
  const predictedTheyFirst =
    nextScheduledMatch && oppRosterForLineup.length >= 5
      ? predictLineup(
          "they-first",
          matches,
          roster,
          nextScheduledMatch.opponent,
          oppRosterForLineup,
          nextScheduledMatch.location,
        )
      : null;

  // Sort lineups various ways for "best/worst" sections.
  const lineupsByWins = [...lineups].sort((a, b) =>
    b.wins - a.wins || b.matchesPlayed - a.matchesPlayed,
  );
  const lineupsByPoints = [...lineups].sort(
    (a, b) => b.individualPoints - a.individualPoints,
  );
  const lineupsByDiff = [...lineups].sort((a, b) => b.pointDiff - a.pointDiff);

  return (
    <>
      <PageHeader
        eyebrow="Lab"
        title="Research"
        subtitle={`${scopeLabel} · ${summary.matchesPlayed} match${summary.matchesPlayed === 1 ? "" : "es"} · ${summary.wins}–${summary.losses} (${summary.winPct}%)`}
      />

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        <SessionPicker
          basePath="/research"
          sessions={sessions}
          selectedIds={selectedIds}
          preserveQuery={{ tab: tab !== "overview" ? tab : undefined }}
        />

        <TabNav
          active={tab}
          session={session}
          counts={{
            overview: 4,
            throw: 1,
            briefing: (briefing ? 5 : 4) + (scoutingReport ? 1 : 0),
            lineups: 3,
            players: 7,
            opponents: 3,
            venues: 5,
          }}
        />

        <Section
          title="Throw Advisor"
          subtitle="Live during pool night: tell it who they put up, what slot it is, and which of our players are at the bar — get a ranked recommendation with full reasoning. Tracks the running score, the APA 23-rule SL budget, and warns when burning a stud here would force the rest of the night into trouble. Already-thrown players are removed automatically."
          anchor="throw"
          forTab="throw"
          activeTab={tab}
        >
          <ThrowAdvisor
            roster={roster}
            matches={matches}
            opponents={throwOpponents}
            defaultOpponent={nextScheduledMatch?.opponent}
            defaultLocation={nextScheduledMatch?.location}
            knownLocations={throwLocations}
          />
        </Section>

        <Section
          title="Calibration check"
          subtitle="Replays the recommendation engine over every past individual match using only-prior-data. Measures how accurate the win-probability predictions actually are: Brier score (lower = better), reliability bins (do 70%-predictions actually win 70% of the time?), and a confusion-style breakdown. This is a trust-meter — verifies the numbers you see during the night are honest."
          anchor="calibration"
          forTab="throw"
          activeTab={tab}
        >
          <CalibrationView calibration={calibration} />
        </Section>

        {briefing && (
          <Section
            title="Pre-Match Briefing"
            subtitle="Tonight's read — toggle who's playing to recompute the lineup, then tap “Share with team” to send a public link the rest of the team can open without the password."
            anchor="briefing"
            forTab="briefing"
            activeTab={tab}
          >
            <TeamBriefing
              briefing={briefing}
              scouting={scoutingReport}
              oppTeam={scoutingOppTeam}
              inputs={{
                matches,
                roster,
                opponentTeam: briefing.opponentName,
                opponentRoster: oppRosterForLineup,
                location: briefing.match.location,
              }}
              initialAvailableIds={roster
                .filter((p) => p.visible !== false)
                .map((p) => p.id)}
              editable
            />
          </Section>
        )}

        {scoutingReport && (
          <Section
            title="Scouting report"
            subtitle={`In-depth read on ${scoutingReport.team} from every match they've played us — team record this session and lifetime, per-player form (hot/cold), preferred slots, suspected real skill levels for anyone playing above their stated SL, and our top counter from the roster.`}
            anchor="scouting"
            forTab="briefing"
            activeTab={tab}
          >
            <ScoutingReport
              report={scoutingReport}
              teamId={scoutingTeamId}
              oppTeamProfile={scoutingOppTeam}
              predictedWeFirst={predictedWeFirst}
              predictedTheyFirst={predictedTheyFirst}
              lineupInputs={
                nextScheduledMatch && oppRosterForLineup.length >= 5
                  ? {
                      matches,
                      roster,
                      opponentTeam: nextScheduledMatch.opponent,
                      opponentRoster: oppRosterForLineup,
                      location: nextScheduledMatch.location,
                    }
                  : null
              }
            />
          </Section>
        )}

        <Section
          title="Counter-Pick"
          subtitle="Type any opponent we've played → get our roster ranked by who matches up best against them. Bayesian-smoothed so a 1-0 record doesn't trump 5-1."
          anchor="counter-pick"
          forTab="briefing"
          activeTab={tab}
        >
          <CounterPickWidget
            opponents={counterPickOpponents}
            pickFor={counterPickFor_}
          />
        </Section>

        {/* The Numbers */}
        <Section
          title="The Numbers"
          subtitle="Top-line metrics across the scope."
          forTab="overview"
          activeTab={tab}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Team Win %" value={`${summary.winPct}%`} sub={`${summary.wins}–${summary.losses}`} />
            <Stat label="Player Win %" value={`${summary.playerWinPct}%`} sub={`${summary.totalPlayerWins}/${summary.totalPlayerMatches}`} />
            <Stat label="Sweeps" value={String(summary.totalSweeps)} sub={`+${summary.totalMiniSweeps} mini`} accent />
            <Stat label="Special Shots" value={String(summary.totalBreakAndRuns + summary.totalEightOnBreaks)} sub={`${summary.totalBreakAndRuns} B&R · ${summary.totalEightOnBreaks} 8oB`} />
            <Stat label="Avg Pts For" value={String(summary.averagePointsScored)} />
            <Stat label="Avg Pts Against" value={String(summary.averagePointsConceded)} />
          </div>
        </Section>

        {/* Hot & Cold */}
        <Section
          title="🔥  Hot & ❄️  Cold"
          subtitle="Compares each player's win rate over their last 10 individual matches against their career win rate from every match before that. The difference (in percentage points) is the delta. 🔥 Hot = at least 15 points above career norm · ❄️ Cold = at least 15 points below · otherwise Steady. Needs a minimum of 5 recent matches to qualify; players with thinner careers are scored against their full record instead."
          anchor="hot-cold"
          forTab="overview"
          activeTab={tab}
        >
          <HotColdGrid rows={hotCold} />
        </Section>

        {/* Impact (with/without) */}
        <Section
          title="Player Impact"
          subtitle="Team record when each player IS in the lineup vs when they aren't. Big positive swing = irreplaceable."
          anchor="impact"
          forTab="briefing"
          activeTab={tab}
        >
          <ImpactTable rows={impact} />
        </Section>

        {/* Comparison */}
        <Section
          title="Side-by-Side Comparison"
          subtitle="Pick any two roster members to overlay their five-axis profiles."
          anchor="compare"
          forTab="briefing"
          activeTab={tab}
        >
          <PlayerComparison rows={radar} />
        </Section>

        {/* Recommended lineup */}
        <Section
          title="Suggested Starting 5"
          subtitle="Greedy pick — each position filled by the available roster member with the highest win rate at that slot (min 2 matches). Computed from the data in scope."
          anchor="starting5"
          forTab="briefing"
          activeTab={tab}
        >
          {recommendation.pickedFive.length === 0 ? (
            <Empty msg="Not enough position data yet — need at least 2 matches per player per slot." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-5">
              {[1, 2, 3, 4, 5].map((pos) => {
                const c = recommendation.byPosition[pos];
                return (
                  <div
                    key={pos}
                    className="surface flex flex-col items-center gap-1 p-4 text-center"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                      Match {pos}
                    </span>
                    {c ? (
                      <>
                        <Link
                          href={`/roster/${c.playerId}`}
                          className="font-[family-name:var(--font-display)] text-xl tracking-wide hover:text-[var(--color-brass)]"
                        >
                          {c.playerName}
                        </Link>
                        <span className="text-xs text-[var(--fg-dim)]">
                          {c.winPct}% · {c.matches} matches
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-[var(--fg-dim)]">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Best lineups */}
        <Section
          title="Best & Worst Lineups"
          subtitle="A 'lineup' is the unordered set of 5 players who played the team match. Ordered three ways."
          anchor="lineups"
          forTab="lineups"
          activeTab={tab}
        >
          <div className="grid gap-5 lg:grid-cols-3">
            <LineupCard
              heading="Most Wins"
              rows={lineupsByWins.slice(0, 3)}
              metric={(r) => `${r.wins}W · ${r.matchesPlayed} GP`}
              accent
            />
            <LineupCard
              heading="Most Individual Points"
              rows={lineupsByPoints.slice(0, 3)}
              metric={(r) => `${r.individualPoints} pts · ${r.matchesPlayed} GP`}
            />
            <LineupCard
              heading="Best Point Differential"
              rows={lineupsByDiff.slice(0, 3)}
              metric={(r) =>
                `${r.pointDiff > 0 ? "+" : ""}${r.pointDiff} · ${r.pointsScored}/${r.pointsConceded}`
              }
            />
          </div>

          {lineupsByWins.length > 3 && (
            <details className="mt-6 group">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] hover:text-[var(--color-brass)]">
                ↳ All {lineups.length} lineups (click to expand)
              </summary>
              <div className="mt-4 surface overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                      <th className="px-4 py-3">Lineup</th>
                      <th className="px-4 py-3 text-right">GP</th>
                      <th className="px-4 py-3 text-right">W–L</th>
                      <th className="px-4 py-3 text-right">Win %</th>
                      <th className="px-4 py-3 text-right">Pts For/Ag</th>
                      <th className="px-4 py-3 text-right">Indiv Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...lineups]
                      .sort(
                        (a, b) =>
                          b.matchesPlayed - a.matchesPlayed ||
                          b.winPct - a.winPct,
                      )
                      .map((row) => (
                        <tr
                          key={row.playerIds.join("+")}
                          className="border-b border-[var(--border)] last:border-0"
                        >
                          <td className="px-4 py-3 text-xs">
                            {row.playerNames.join(" · ")}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {row.matchesPlayed}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {row.wins}–{row.losses}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {row.winPct}%
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[var(--fg-dim)]">
                            {row.pointsScored}/{row.pointsConceded}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--color-brass-bright)]">
                            {row.individualPoints}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </Section>

        {/* Chemistry */}
        <Section
          title="Player Chemistry"
          subtitle="How well each pair of teammates plays together. Lift = win % when both are in the lineup minus the average win % of matches with one but not the other. Positive = better together."
          anchor="chemistry"
          forTab="lineups"
          activeTab={tab}
        >
          <ChemistryTable rows={chemistry.slice(0, 12)} />
          {chemistry.length > 12 && (
            <details className="mt-4 group">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] hover:text-[var(--color-brass)]">
                ↳ All {chemistry.length} pairs
              </summary>
              <div className="mt-3"><ChemistryTable rows={chemistry} /></div>
            </details>
          )}
        </Section>

        {/* Position performance */}
        <Section
          title="Position Strategy"
          subtitle="Per-player win rate at each slot. Cells show wins/matches; color is the win rate. Empty cells = never played there."
          anchor="position"
          forTab="lineups"
          activeTab={tab}
        >
          <div className="surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                  <th className="px-4 py-3">Player</th>
                  {[1, 2, 3, 4, 5].map((p) => (
                    <th key={p} className="px-3 py-3 text-center">
                      Match {p}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Best</th>
                </tr>
              </thead>
              <tbody>
                {positions
                  .filter((row) => row.totalMatches > 0)
                  .map((row) => (
                    <tr
                      key={row.playerId}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/roster/${row.playerId}`}
                          className="font-medium hover:text-[var(--color-brass)]"
                        >
                          {row.playerName}
                        </Link>
                      </td>
                      {[1, 2, 3, 4, 5].map((p) => {
                        const cell = row.positions[p];
                        if (!cell || cell.matches === 0) {
                          return (
                            <td
                              key={p}
                              className="px-3 py-3 text-center text-[var(--fg-dim)]"
                            >
                              —
                            </td>
                          );
                        }
                        return (
                          <td
                            key={p}
                            className={cn(
                              "px-3 py-3 text-center tabular-nums",
                              winRateClass(cell.winPct, cell.matches),
                            )}
                          >
                            <span className="font-semibold">{cell.wins}</span>
                            <span className="text-[var(--fg-dim)]">
                              /{cell.matches}
                            </span>
                            <div className="text-[10px] text-[var(--fg-dim)]">
                              {cell.winPct}%
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right text-xs">
                        {row.bestPosition ? (
                          <>
                            <span className="font-semibold text-[var(--color-brass-bright)]">
                              #{row.bestPosition}
                            </span>{" "}
                            <span className="text-[var(--fg-dim)]">
                              ({row.bestPositionWinPct}%)
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--fg-dim)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Skill-level history */}
        <Section
          title="Skill-Level Journey"
          subtitle="Each player's record split by their skill level *at the time* of each match. Shows whether a level-up helped or hurt their winning."
          anchor="sl-journey"
          forTab="players"
          activeTab={tab}
        >
          <SLHistoryTable rows={slHistory} />
        </Section>

        {/* Skill-level matchups */}
        <Section
          title="Matchup vs Skill Level"
          subtitle="How each player has fared against opponents of each SL bracket. Colour = win rate."
          anchor="vs-sl"
          forTab="players"
          activeTab={tab}
        >
          <div className="surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                  <th className="px-4 py-3">Player</th>
                  {[2, 3, 4, 5, 6, 7].map((sl) => (
                    <th key={sl} className="px-3 py-3 text-center">
                      vs SL{sl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skill
                  .filter((row) =>
                    [2, 3, 4, 5, 6, 7].some((sl) => row.bySL[sl].matches > 0),
                  )
                  .map((row) => (
                    <tr
                      key={row.playerId}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/roster/${row.playerId}`}
                          className="font-medium hover:text-[var(--color-brass)]"
                        >
                          {row.playerName}
                        </Link>
                      </td>
                      {[2, 3, 4, 5, 6, 7].map((sl) => {
                        const cell = row.bySL[sl];
                        if (!cell || cell.matches === 0) {
                          return (
                            <td
                              key={sl}
                              className="px-3 py-3 text-center text-[var(--fg-dim)]"
                            >
                              —
                            </td>
                          );
                        }
                        return (
                          <td
                            key={sl}
                            className={cn(
                              "px-3 py-3 text-center tabular-nums",
                              winRateClass(cell.winPct, cell.matches),
                            )}
                          >
                            <span className="font-semibold">{cell.wins}</span>
                            <span className="text-[var(--fg-dim)]">
                              /{cell.matches}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Reliability + Form */}
        <Section
          title="Most Reliable Players"
          subtitle="Score = win rate × log(1 + matches) — favors both consistency and volume."
          anchor="reliable"
          forTab="players"
          activeTab={tab}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reliability.slice(0, 9).map((r, i) => (
              <div key={r.playerId} className="surface p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-brass-bright)]">
                    #{i + 1}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                    Score {r.score}
                  </span>
                </div>
                <Link
                  href={`/roster/${r.playerId}`}
                  className="mt-1 block font-medium hover:text-[var(--color-brass)]"
                >
                  {r.playerName}
                </Link>
                <p className="text-xs text-[var(--fg-dim)]">
                  {r.wins}/{r.matches} W ·{" "}
                  <span className="font-semibold text-[var(--fg)]">
                    {r.winPct}%
                  </span>
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Form & Streaks"
          subtitle="Most recent first (left = newest). Streaks count the player's current run."
          anchor="form"
          forTab="players"
          activeTab={tab}
        >
          <div className="surface divide-y divide-[var(--border)]">
            {form.map((f) => (
              <div
                key={f.playerId}
                className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap"
              >
                <Link
                  href={`/roster/${f.playerId}`}
                  className="w-40 shrink-0 truncate font-medium hover:text-[var(--color-brass)]"
                >
                  {f.playerName}
                </Link>
                <div className="flex flex-1 items-center gap-1">
                  {f.recent.length === 0 ? (
                    <span className="text-xs text-[var(--fg-dim)]">No matches</span>
                  ) : (
                    f.recent.map((o, i) => (
                      <span
                        key={i}
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold",
                          o === "W"
                            ? "bg-[var(--color-felt-bright)]/20 text-[var(--color-felt-bright)]"
                            : "bg-[var(--color-pop)]/20 text-[var(--color-pop-bright)]",
                        )}
                      >
                        {o}
                      </span>
                    ))
                  )}
                </div>
                <div className="text-right text-xs text-[var(--fg-dim)]">
                  {f.currentStreak ? (
                    <>
                      <span
                        className={
                          f.currentStreak.type === "W"
                            ? "font-bold text-[var(--color-felt-bright)]"
                            : "font-bold text-[var(--color-pop-bright)]"
                        }
                      >
                        {f.currentStreak.length}{f.currentStreak.type}
                      </span>{" "}
                      streak ·{" "}
                    </>
                  ) : null}
                  best {f.longestWinStreak}W · last10 {f.last10WinPct}%
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* vs Opponent */}
        <Section
          title="vs Opponents"
          subtitle="Our record against each opponent in scope. Switch to All Time at the top for a true lifetime view."
          anchor="vs-teams"
          forTab="opponents"
          activeTab={tab}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="surface p-5">
              <h3 className="mb-3 font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--color-felt-bright)]">
                We Own&nbsp;Em
              </h3>
              {bestVsTeams.length === 0 ? (
                <p className="text-xs text-[var(--fg-dim)]">No clear favorite matchups yet.</p>
              ) : (
                <ol className="space-y-2">
                  {bestVsTeams.map((o, i) => (
                    <li
                      key={o.opponent}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass)]">
                        #{i + 1}
                      </span>
                      <span className="flex-1 truncate font-medium">
                        {o.opponent}
                      </span>
                      <span className="text-xs text-[var(--fg-dim)]">
                        {o.wins}-{o.losses}
                      </span>
                      <span className="font-semibold text-[var(--color-felt-bright)] tabular-nums text-sm">
                        {o.winPct}%
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="surface p-5">
              <h3 className="mb-3 font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--color-pop-bright)]">
                Tough Outs
              </h3>
              {toughestTeams.length === 0 ? (
                <p className="text-xs text-[var(--fg-dim)]">No problem matchups yet.</p>
              ) : (
                <ol className="space-y-2">
                  {toughestTeams.map((o, i) => (
                    <li
                      key={o.opponent}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-pop)]">
                        #{i + 1}
                      </span>
                      <span className="flex-1 truncate font-medium">
                        {o.opponent}
                      </span>
                      <span className="text-xs text-[var(--fg-dim)]">
                        {o.wins}-{o.losses}
                      </span>
                      <span className="font-semibold text-[var(--color-pop-bright)] tabular-nums text-sm">
                        {o.winPct}%
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="mt-5 surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                  <th className="px-4 py-3">Opponent</th>
                  <th className="px-4 py-3 text-right">GP</th>
                  <th className="px-4 py-3 text-right">W–L</th>
                  <th className="px-4 py-3 text-right">Win %</th>
                  <th className="px-4 py-3 text-right">Pts For/Ag</th>
                </tr>
              </thead>
              <tbody>
                {opponents.map((o) => (
                  <tr
                    key={o.opponent}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{o.opponent}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {o.matchesPlayed}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {o.wins}–{o.losses}
                      {o.ties > 0 && `–${o.ties}`}
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", winRateClass(o.winPct, o.wins + o.losses))}>
                      {o.winPct}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--fg-dim)]">
                      {o.pointsScored}/{o.pointsConceded}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Player vs individual opponents */}
        <Section
          title="Head-to-Head Matchups"
          subtitle="For each Top Dog: who they own and who owns them. Strategic data for who to throw against a given opponent. Min 2 head-to-head meetings."
          anchor="h2h"
          forTab="opponents"
          activeTab={tab}
        >
          <PlayerOpponentGrid rows={playerOppMatchups} />
        </Section>

        {/* Venues */}
        <Section
          title="Bars We Play"
          subtitle="Records by venue — the bars we play best at vs the rooms we struggle in."
          anchor="bars"
          forTab="venues"
          activeTab={tab}
        >
          <VenueTable rows={venues} />
          <div className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              Per Player
            </h3>
            <PlayerVenueGrid rows={playerVenues} homeVenueName={homeVenueName} />
          </div>
        </Section>

        {/* Home vs Away */}
        <Section
          title="Home vs Away"
          subtitle="Where we play matters."
          anchor="home-away"
          forTab="venues"
          activeTab={tab}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="surface p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                Home
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide">
                {split.homeWins}–{split.homeLosses}
              </p>
              <p className="text-xs text-[var(--fg-dim)]">
                {split.homeWinPct}% win rate · {split.homePointsAvg} pts/match
              </p>
            </div>
            <div className="surface p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                Away
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide">
                {split.awayWins}–{split.awayLosses}
              </p>
              <p className="text-xs text-[var(--fg-dim)]">
                {split.awayWinPct}% win rate · {split.awayPointsAvg} pts/match
              </p>
            </div>
          </div>

          {/* Per-player home/away */}
          <div className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              Per Player
            </h3>
            <div className="surface overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                    <th className="px-4 py-3">Player</th>
                    <th className="px-3 py-3 text-center">Home W/GP</th>
                    <th className="px-3 py-3 text-center">Home %</th>
                    <th className="px-3 py-3 text-center">Away W/GP</th>
                    <th className="px-3 py-3 text-center">Away %</th>
                    <th className="px-3 py-3 text-right">Swing</th>
                  </tr>
                </thead>
                <tbody>
                  {homeAwaySL
                    .filter((r) => r.homeMatches + r.awayMatches > 0)
                    .sort((a, b) => Math.abs(b.homeAwaySwing) - Math.abs(a.homeAwaySwing))
                    .map((r) => (
                      <tr
                        key={r.playerId}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/roster/${r.playerId}`}
                            className="font-medium hover:text-[var(--color-brass)]"
                          >
                            {r.playerName}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-[var(--fg-dim)]">
                          {r.homeWins}/{r.homeMatches}
                        </td>
                        <td className={cn("px-3 py-3 text-center tabular-nums", winRateClass(r.homeWinPct, r.homeMatches))}>
                          {r.homeMatches ? `${r.homeWinPct}%` : "—"}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums text-[var(--fg-dim)]">
                          {r.awayWins}/{r.awayMatches}
                        </td>
                        <td className={cn("px-3 py-3 text-center tabular-nums", winRateClass(r.awayWinPct, r.awayMatches))}>
                          {r.awayMatches ? `${r.awayWinPct}%` : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3 text-right text-xs font-semibold tabular-nums",
                            r.homeAwaySwing > 5
                              ? "text-[var(--color-felt-bright)]"
                              : r.homeAwaySwing < -5
                                ? "text-[var(--color-pop-bright)]"
                                : "text-[var(--fg-dim)]",
                          )}
                        >
                          {r.homeAwaySwing > 0 ? "+" : ""}
                          {r.homeAwaySwing}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* Weekly Trend */}
        <Section
          title="Weekly Trend"
          subtitle="Match-by-match outcome and running record."
          anchor="trend"
          forTab="venues"
          activeTab={tab}
        >
          <WeeklyTrend trend={trend} />
        </Section>

        {/* Game Insights */}
        <Section
          title="Game Insights"
          subtitle="What individual matches actually look like for us."
          anchor="insights"
          forTab="venues"
          activeTab={tab}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Avg games per match" value={String(insights.averageGamesPerMatch)} sub="ours + opponent's per individual match" />
            <Stat label="Forfeit rate" value={`${insights.forfeitPct}%`} sub={`${insights.forfeitMatches} of ${insights.totalIndividualMatches}`} />
            <Stat label="Comeback wins" value={String(insights.comebackWins)} sub="narrow wins after a lost individual" />
            <Stat label="Total individual matches" value={String(insights.totalIndividualMatches)} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ResultCard
              tone="brass"
              heading="Most decisive win"
              row={insights.decisiveTeamWins}
            />
            <ResultCard
              tone="cream"
              heading="Closest win"
              row={insights.closestTeamWin}
            />
            <ResultCard
              tone="pop"
              heading="Worst loss"
              row={insights.largestTeamLoss}
            />
          </div>
        </Section>

        {/* Achievements */}
        <Section
          title="🏅  Achievements"
          subtitle="Auto-derived badges. Awarded to whoever leads each category in scope."
          anchor="achievements"
          forTab="overview"
          activeTab={tab}
        >
          <AchievementsGrid badges={ach.flat} />
        </Section>

        {/* Records Book */}
        <Section
          title="📖  Records Book"
          subtitle="Team and individual milestones. Click any record to jump to the match."
          anchor="records"
          forTab="overview"
          activeTab={tab}
        >
          <RecordsBookView entries={records} />
        </Section>

        {/* MVP Race */}
        <Section
          title="MVP Race"
          subtitle="Cumulative leaderboard points by date. See who pulled away and when."
          anchor="mvp-race"
          forTab="players"
          activeTab={tab}
        >
          <MVPRaceChart series={mvpRace} />
        </Section>

        {/* Player Radar Charts */}
        <Section
          title="Player Radar"
          subtitle="Each player's profile across five axes (win %, sweeps, mini, B&R, 8oB) — normalized so the team's leader on each axis is at the edge."
          anchor="radar"
          forTab="players"
          activeTab={tab}
        >
          <RadarGrid rows={radar} />
        </Section>

        {/* Calendar Heatmap */}
        <Section
          title="Season at a Glance"
          subtitle="Every match colored by outcome and intensity by margin."
          anchor="calendar"
          forTab="venues"
          activeTab={tab}
        >
          <CalendarHeatmap cells={calendar} />
        </Section>

        {/* Level-Up Watch */}
        <Section
          title="Level-Up Watch"
          subtitle="Tracks each player's PA (Performance Average — APA's underlying skill score, separate from their displayed Skill Level) across the last 5 sessions. Delta = this session's PA minus last session's PA. ▲ Trending up if delta &gt; +1.5 · ▼ Trending down if delta &lt; -1.5 · otherwise flat. APA bumps a player's SL when their PA crosses internal thresholds, so a sustained climb here is an early signal a level-up is coming. Sorted by biggest movers first."
          anchor="level-up"
          forTab="players"
          activeTab={tab}
        >
          <LevelUpWatchView rows={levelUps} />
        </Section>

        {/* Expected vs Actual */}
        <Section
          title="Expected vs Actual"
          subtitle="Smoothed expected wins given each opponent's historical record against us. Positive delta = we're outperforming our matchups."
          anchor="expected"
          forTab="opponents"
          activeTab={tab}
        >
          <ExpectedVsActualView ea={expActual} />
        </Section>
      </div>
    </>
  );
}

/* -------------------------------------------- new component bits */

function HotColdGrid({
  rows,
}: {
  rows: ReturnType<typeof hotColdPlayers>;
}) {
  const hot = rows.filter((r) => r.status === "hot");
  const cold = rows.filter((r) => r.status === "cold");
  const steady = rows.filter((r) => r.status === "steady");
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <HotColdColumn
        heading="Hot 🔥"
        rows={hot.length ? hot : steady.filter((r) => r.delta > 0).slice(0, 3)}
        accent="brass"
        emptyMsg={hot.length ? undefined : "Nobody clearly trending up — small samples."}
      />
      <HotColdColumn
        heading="Cold ❄️"
        rows={cold.length ? cold : steady.filter((r) => r.delta < 0).slice(0, 3)}
        accent="pop"
        emptyMsg={cold.length ? undefined : "Nobody clearly trending down."}
      />
    </div>
  );
}

function HotColdColumn({
  heading,
  rows,
  accent,
  emptyMsg,
}: {
  heading: string;
  rows: ReturnType<typeof hotColdPlayers>;
  accent: "brass" | "pop";
  emptyMsg?: string;
}) {
  return (
    <div className="surface p-5">
      <h3
        className={cn(
          "mb-3 font-[family-name:var(--font-display)] text-2xl tracking-wide",
          accent === "brass"
            ? "text-[var(--color-brass-bright)]"
            : "text-[var(--color-pop-bright)]",
        )}
      >
        {heading}
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--fg-dim)]">{emptyMsg}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.playerId}
              className="flex items-baseline justify-between gap-3"
            >
              <Link
                href={`/roster/${r.playerId}`}
                className="font-medium hover:text-[var(--color-brass)]"
              >
                {r.playerName}
              </Link>
              <div className="text-right text-xs">
                <div
                  className={cn(
                    "font-bold",
                    r.delta > 0
                      ? "text-[var(--color-felt-bright)]"
                      : r.delta < 0
                        ? "text-[var(--color-pop-bright)]"
                        : "text-[var(--fg-dim)]",
                  )}
                >
                  {r.delta > 0 ? "+" : ""}
                  {r.delta} pts
                </div>
                <div className="text-[var(--fg-dim)]">
                  last {r.recentMatches}: {r.recentWinPct}% · base {r.baselineWinPct}%
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChemistryTable({
  rows,
}: {
  rows: ReturnType<typeof playerChemistry>;
}) {
  if (rows.length === 0) {
    return (
      <p className="surface p-6 text-sm text-[var(--fg-dim)]">
        Need more matches to compute chemistry — each pair has to share at least one team match.
      </p>
    );
  }
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
            <th className="px-4 py-3">Pair</th>
            <th className="px-3 py-3 text-right">Together W–L</th>
            <th className="px-3 py-3 text-right">Win %</th>
            <th className="px-3 py-3 text-right">Lift</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.pair.join("+")}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="px-4 py-3 text-sm font-medium">
                {r.pairNames[0]} <span className="text-[var(--fg-dim)]">+</span>{" "}
                {r.pairNames[1]}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {r.togetherTeamWins}–{r.togetherTeamLosses}{" "}
                <span className="text-[var(--fg-dim)]">
                  ({r.togetherMatches})
                </span>
              </td>
              <td className={cn("px-3 py-3 text-right tabular-nums", winRateClass(r.togetherWinPct, r.togetherMatches))}>
                {r.togetherWinPct}%
              </td>
              <td
                className={cn(
                  "px-3 py-3 text-right tabular-nums font-semibold",
                  r.lift > 5
                    ? "text-[var(--color-felt-bright)]"
                    : r.lift < -5
                      ? "text-[var(--color-pop-bright)]"
                      : "text-[var(--fg-dim)]",
                )}
              >
                {r.lift > 0 ? "+" : ""}
                {r.lift}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SLHistoryTable({
  rows,
}: {
  rows: ReturnType<typeof recordsBySkillLevel>;
}) {
  // Determine the SL columns we have any data for.
  const allSLs = new Set<number>();
  for (const r of rows) for (const sl of Object.keys(r.bySL)) allSLs.add(parseInt(sl, 10));
  const cols = [...allSLs].sort((a, b) => a - b);
  if (cols.length === 0) {
    return <p className="surface p-6 text-sm text-[var(--fg-dim)]">No SL history yet.</p>;
  }
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
            <th className="px-4 py-3">Player</th>
            {cols.map((sl) => (
              <th key={sl} className="px-3 py-3 text-center">
                SL{sl}
              </th>
            ))}
            <th className="px-4 py-3 text-right">Best</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.playerId}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/roster/${row.playerId}`}
                  className="font-medium hover:text-[var(--color-brass)]"
                >
                  {row.playerName}
                </Link>
              </td>
              {cols.map((sl) => {
                const c = row.bySL[sl];
                if (!c) {
                  return (
                    <td key={sl} className="px-3 py-3 text-center text-[var(--fg-dim)]">
                      —
                    </td>
                  );
                }
                return (
                  <td
                    key={sl}
                    className={cn("px-3 py-3 text-center tabular-nums", winRateClass(c.winPct, c.matches))}
                  >
                    <span className="font-semibold">{c.wins}</span>
                    <span className="text-[var(--fg-dim)]">/{c.matches}</span>
                    <div className="text-[10px] text-[var(--fg-dim)]">{c.winPct}%</div>
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right text-xs">
                {row.bestSL ? (
                  <>
                    <span className="font-semibold text-[var(--color-brass-bright)]">
                      SL{row.bestSL.sl}
                    </span>{" "}
                    <span className="text-[var(--fg-dim)]">
                      ({row.bestSL.winPct}%)
                    </span>
                  </>
                ) : (
                  <span className="text-[var(--fg-dim)]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeeklyTrend({
  trend,
}: {
  trend: ReturnType<typeof weeklyTrend>;
}) {
  if (trend.length === 0) {
    return <p className="surface p-6 text-sm text-[var(--fg-dim)]">No matches yet.</p>;
  }
  // Build SVG sparkline of cumulative wins minus losses.
  const W = 600;
  const H = 80;
  const pad = 6;
  const xs = trend.map((_p, i) => pad + (i * (W - 2 * pad)) / Math.max(1, trend.length - 1));
  const ys = trend.map((p) => p.cumulativeWins - p.cumulativeLosses);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(0, ...ys);
  const yRange = yMax - yMin || 1;
  const yToSvg = (y: number) => H - pad - ((y - yMin) / yRange) * (H - 2 * pad);
  const path =
    `M ${xs[0]} ${yToSvg(ys[0])} ` +
    xs
      .slice(1)
      .map((x, i) => `L ${x} ${yToSvg(ys[i + 1])}`)
      .join(" ");
  const zeroY = yToSvg(0);

  return (
    <div className="surface p-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-20 w-full text-[var(--color-brass-bright)]"
        aria-hidden
      >
        <line
          x1={pad}
          x2={W - pad}
          y1={zeroY}
          y2={zeroY}
          className="stroke-[var(--border)]"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {trend.map((p, i) => (
          <circle
            key={p.matchId}
            cx={xs[i]}
            cy={yToSvg(ys[i])}
            r={3}
            className={
              p.outcome === "W"
                ? "fill-[var(--color-felt-bright)]"
                : p.outcome === "L"
                  ? "fill-[var(--color-pop-bright)]"
                  : "fill-[var(--fg-dim)]"
            }
          />
        ))}
      </svg>
      <div className="mt-3 grid gap-1 text-xs">
        {trend.map((p) => (
          <div
            key={p.matchId}
            className="grid grid-cols-[2.5rem_3rem_1fr_4rem_3.5rem] items-center gap-2"
          >
            <span className="font-semibold text-[var(--color-brass)]">
              W{p.week}
            </span>
            <span className="text-[var(--fg-dim)]">
              {formatDate(p.date, { month: "short", day: "numeric" })}
            </span>
            <Link
              href={`/matches/${p.matchId}`}
              className="truncate hover:text-[var(--color-brass)]"
            >
              vs {p.opponent}
            </Link>
            <span className="text-right tabular-nums text-[var(--fg-dim)]">
              {p.teamScore !== undefined && p.opponentScore !== undefined
                ? `${p.teamScore}–${p.opponentScore}`
                : "—"}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-center text-[10px] font-bold",
                p.outcome === "W"
                  ? "bg-[var(--color-felt-bright)]/20 text-[var(--color-felt-bright)]"
                  : p.outcome === "L"
                    ? "bg-[var(--color-pop)]/20 text-[var(--color-pop-bright)]"
                    : "bg-[var(--bg-soft)] text-[var(--fg-dim)]",
              )}
            >
              {p.outcome}{" "}
              <span className="font-normal opacity-60">
                {p.cumulativeWins}–{p.cumulativeLosses}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerOpponentGrid({
  rows,
}: {
  rows: ReturnType<typeof playerOpponentMatchups>;
}) {
  if (rows.length === 0) {
    return (
      <p className="surface p-6 text-sm text-[var(--fg-dim)]">
        Need scoresheet data with opponent names — try widening to All Time.
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.playerId} className="surface p-5">
          <div className="flex items-baseline justify-between gap-3">
            <Link
              href={`/roster/${row.playerId}`}
              className="font-[family-name:var(--font-display)] text-2xl tracking-wide hover:text-[var(--color-brass)]"
            >
              {row.playerName}
            </Link>
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
              {row.totalOpponents} opps · {row.totalMatches} matches
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <MatchupColumn
              heading="Owns"
              rows={row.best}
              tone="felt"
              empty="No 2+ matchups yet"
            />
            <MatchupColumn
              heading="Owned by"
              rows={row.worst}
              tone="pop"
              empty="None — keep it that way"
            />
          </div>

          {row.all.length > 5 && (
            <details className="mt-4 group">
              <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] hover:text-[var(--color-brass)]">
                ↳ All {row.all.length} opponents
              </summary>
              <ul className="mt-3 space-y-1 text-xs">
                {row.all.map((o) => (
                  <li
                    key={o.opponentName}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="flex-1 min-w-0 truncate">
                      {o.opponentName}
                      {o.latestSkillLevel ? (
                        <span className="ml-1.5 text-[var(--color-brass)]">
                          SL{o.latestSkillLevel}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "tabular-nums",
                        winRateClass(o.winPct, o.matches),
                      )}
                    >
                      {o.wins}–{o.losses}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

function MatchupColumn({
  heading,
  rows,
  tone,
  empty,
}: {
  heading: string;
  rows: Array<{
    opponentName: string;
    matches: number;
    wins: number;
    losses: number;
    winPct: number;
    latestSkillLevel?: number;
  }>;
  tone: "felt" | "pop";
  empty: string;
}) {
  return (
    <div>
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.32em]",
          tone === "felt"
            ? "text-[var(--color-felt-bright)]"
            : "text-[var(--color-pop-bright)]",
        )}
      >
        {heading}
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--fg-dim)]">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {rows.map((r) => (
            <li
              key={r.opponentName}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="flex-1 min-w-0 truncate">
                {r.opponentName}
                {r.latestSkillLevel ? (
                  <span className="ml-1.5 text-[var(--color-brass)]">
                    SL{r.latestSkillLevel}
                  </span>
                ) : null}
              </span>
              <span className="text-[var(--fg-dim)] tabular-nums">
                {r.wins}-{r.losses}
              </span>
              <span
                className={cn(
                  "w-12 text-right font-semibold tabular-nums",
                  tone === "felt"
                    ? "text-[var(--color-felt-bright)]"
                    : "text-[var(--color-pop-bright)]",
                )}
              >
                {r.winPct}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VenueTable({
  rows,
}: {
  rows: ReturnType<typeof venueRecords>;
}) {
  if (rows.length === 0) {
    return (
      <p className="surface p-6 text-sm text-[var(--fg-dim)]">
        No venue data in scope.
      </p>
    );
  }
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
            <th className="px-4 py-3">Venue</th>
            <th className="px-3 py-3 text-right">GP</th>
            <th className="px-3 py-3 text-right">Team W–L</th>
            <th className="px-3 py-3 text-right">Team %</th>
            <th className="px-3 py-3 text-right">Avg Margin</th>
            <th className="px-3 py-3 text-right">Indiv W/GP</th>
            <th className="px-3 py-3 text-right">Indiv %</th>
          </tr>
        </thead>
        <tbody>
          {[...rows]
            .sort(
              (a, b) =>
                b.teamWinPct - a.teamWinPct || b.teamMatches - a.teamMatches,
            )
            .map((v) => (
              <tr
                key={v.location}
                className={cn(
                  "border-b border-[var(--border)] last:border-0",
                  v.isHomeVenue && "bg-[var(--color-felt-deep)]/30",
                )}
              >
                <td className="px-4 py-3 font-medium">
                  {v.location}
                  {v.isHomeVenue && (
                    <span className="ml-2 rounded-full bg-[var(--color-brass)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-brass-bright)]">
                      Home
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {v.teamMatches}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {v.teamWins}–{v.teamLosses}
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-right tabular-nums",
                    winRateClass(v.teamWinPct, v.teamWins + v.teamLosses),
                  )}
                >
                  {v.teamWinPct}%
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-right tabular-nums font-semibold",
                    v.averageMargin > 1
                      ? "text-[var(--color-felt-bright)]"
                      : v.averageMargin < -1
                        ? "text-[var(--color-pop-bright)]"
                        : "text-[var(--fg-dim)]",
                  )}
                >
                  {v.averageMargin > 0 ? "+" : ""}
                  {v.averageMargin}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-[var(--fg-dim)]">
                  {v.individualWins}/{v.individualMatches}
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-right tabular-nums",
                    winRateClass(v.individualWinPct, v.individualMatches),
                  )}
                >
                  {v.individualWinPct}%
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerVenueGrid({
  rows,
  homeVenueName,
}: {
  rows: ReturnType<typeof playerVenueRecords>;
  homeVenueName?: string;
}) {
  if (rows.length === 0) return null;
  // Build a stable column list of all venues that anyone has played.
  const venues = new Map<string, number>(); // location -> total matches across players
  for (const r of rows) {
    for (const v of r.byVenue) {
      venues.set(v.location, (venues.get(v.location) ?? 0) + v.matches);
    }
  }
  const cols = [...venues.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([loc]) => loc);

  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
            <th className="px-4 py-3">Player</th>
            {cols.map((loc) => (
              <th
                key={loc}
                className={cn(
                  "px-3 py-3 text-center",
                  loc === homeVenueName &&
                    "bg-[var(--color-felt-deep)]/30 text-[var(--color-brass-bright)]",
                )}
              >
                <span className="block max-w-[7rem] truncate text-[10px]">
                  {loc}
                </span>
              </th>
            ))}
            <th className="px-4 py-3 text-right">Best</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.playerId}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/roster/${r.playerId}`}
                  className="font-medium hover:text-[var(--color-brass)]"
                >
                  {r.playerName}
                </Link>
              </td>
              {cols.map((loc) => {
                const v = r.byVenue.find((b) => b.location === loc);
                if (!v) {
                  return (
                    <td
                      key={loc}
                      className="px-3 py-3 text-center text-[var(--fg-dim)]"
                    >
                      —
                    </td>
                  );
                }
                return (
                  <td
                    key={loc}
                    className={cn(
                      "px-3 py-3 text-center tabular-nums",
                      winRateClass(v.winPct, v.matches),
                    )}
                  >
                    <span className="font-semibold">{v.wins}</span>
                    <span className="text-[var(--fg-dim)]">/{v.matches}</span>
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right text-xs">
                {r.bestVenue ? (
                  <>
                    <span className="font-semibold text-[var(--color-brass-bright)]">
                      {r.bestVenue.winPct}%
                    </span>{" "}
                    <span className="text-[var(--fg-dim)] text-[10px]">
                      @ {r.bestVenue.location.slice(0, 14)}
                    </span>
                  </>
                ) : (
                  <span className="text-[var(--fg-dim)]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultCard({
  heading,
  tone,
  row,
}: {
  heading: string;
  tone: "brass" | "cream" | "pop";
  row:
    | {
        matchId: string;
        opponent: string;
        date: string;
        teamScore: number;
        opponentScore: number;
        margin: number;
      }
    | null;
}) {
  return (
    <div className="surface p-4">
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.32em]",
          tone === "brass"
            ? "text-[var(--color-brass-bright)]"
            : tone === "pop"
              ? "text-[var(--color-pop-bright)]"
              : "text-[var(--color-cream)]",
        )}
      >
        {heading}
      </p>
      {row ? (
        <Link
          href={`/matches/${row.matchId}`}
          className="mt-1 block hover:text-[var(--color-brass)]"
        >
          <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
            {row.teamScore}–{row.opponentScore}
          </p>
          <p className="text-xs text-[var(--fg-dim)]">
            vs {row.opponent} · {formatDate(row.date)}
          </p>
        </Link>
      ) : (
        <p className="mt-1 text-sm text-[var(--fg-dim)]">No data</p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

function Section({
  title,
  subtitle,
  anchor,
  children,
  forTab,
  activeTab,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  anchor?: string;
  children: React.ReactNode;
  /** Render only when activeTab matches. If unset, always renders. */
  forTab?: TabKey;
  activeTab?: TabKey;
}) {
  if (forTab && activeTab && forTab !== activeTab) return null;
  return (
    <section id={anchor} className="scroll-mt-24">
      <span aria-hidden className="block h-px w-12 bg-gradient-to-r from-[var(--color-brass)] to-transparent" />
      <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--fg-dim)]">{subtitle}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TabNav({
  active,
  session,
  counts,
}: {
  active: TabKey;
  session?: string;
  counts: Record<TabKey, number>;
}) {
  function hrefFor(key: TabKey): string {
    const params: string[] = [];
    if (session) params.push(`session=${encodeURIComponent(session)}`);
    if (key !== "overview") params.push(`tab=${key}`);
    return params.length ? `/research?${params.join("&")}` : "/research";
  }
  return (
    <nav aria-label="Research tabs">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {TABS.map((t) => {
          const isActive = t.key === active;
          const count = counts[t.key];
          return (
            <Link
              key={t.key}
              href={hrefFor(t.key)}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative isolate flex flex-col overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 transition-all duration-200",
                isActive
                  ? "border-[var(--color-brass)] shadow-[0_12px_30px_-12px_rgba(201,162,74,0.35)]"
                  : "border-[var(--border)] hover:-translate-y-0.5 hover:border-[var(--color-brass)]/50 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]",
              )}
            >
              {/* Soft brass wash for active card — sits under content */}
              {isActive && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(201,162,74,0.18),transparent_60%)]"
                />
              )}
              {/* Top accent bar — brass on active, faint on hover */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-[3px] transition-opacity",
                  isActive
                    ? "bg-gradient-to-r from-[var(--color-brass-dim)] via-[var(--color-brass-bright)] to-[var(--color-brass-dim)] opacity-100"
                    : "bg-[var(--color-brass)] opacity-0 group-hover:opacity-40",
                )}
              />
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "text-[2.25rem] leading-none transition-transform duration-200",
                    isActive
                      ? "drop-shadow-[0_2px_8px_rgba(201,162,74,0.4)]"
                      : "opacity-90 group-hover:scale-110 group-hover:opacity-100",
                  )}
                  aria-hidden
                >
                  {t.emoji}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums tracking-wide transition-colors",
                    isActive
                      ? "bg-[var(--color-brass)] text-[var(--color-ink)] shadow-sm"
                      : "bg-[var(--bg-soft)] text-[var(--fg-dim)] group-hover:bg-[var(--color-brass)]/15 group-hover:text-[var(--color-brass-bright)]",
                  )}
                  aria-label={`${count} sections`}
                >
                  {count}
                </span>
              </div>
              <h3
                className={cn(
                  "mt-3 font-[family-name:var(--font-display)] text-xl tracking-wide transition-colors",
                  isActive
                    ? "text-[var(--color-brass-bright)]"
                    : "text-[var(--fg)] group-hover:text-[var(--color-brass)]",
                )}
              >
                {t.label}
              </h3>
              <p className="mt-1 text-[11px] leading-snug text-[var(--fg-dim)]">
                {t.blurb}
              </p>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide",
          accent
            ? "text-[var(--color-pop-bright)]"
            : "text-[var(--color-cream)]",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-[var(--fg-dim)]">{sub}</p>}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <p className="surface p-6 text-sm text-[var(--fg-dim)]">{msg}</p>
  );
}

function LineupCard({
  heading,
  rows,
  metric,
  accent = false,
}: {
  heading: string;
  rows: Array<{
    playerNames: string[];
    matchesPlayed: number;
    wins: number;
    losses: number;
    winPct: number;
    pointsScored: number;
    pointsConceded: number;
    pointDiff: number;
    individualPoints: number;
  }>;
  metric: (r: {
    matchesPlayed: number;
    wins: number;
    pointsScored: number;
    pointsConceded: number;
    pointDiff: number;
    individualPoints: number;
  }) => string;
  accent?: boolean;
}) {
  return (
    <div className="surface p-5">
      <h3
        className={cn(
          "font-[family-name:var(--font-display)] text-xl tracking-wide",
          accent
            ? "text-[var(--color-pop-bright)]"
            : "text-[var(--color-cream)]",
        )}
      >
        {heading}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--fg-dim)]">No data yet.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {rows.map((r, i) => (
            <li key={r.playerNames.join("+")}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
                  #{i + 1}
                </span>
                <span className="text-xs font-semibold text-[var(--fg)]">
                  {metric(r)}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--fg-dim)]">
                {r.playerNames.join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function winRateClass(pct: number, matches: number): string {
  if (matches < 2) return "text-[var(--fg-dim)]";
  if (pct >= 70) return "bg-[var(--color-felt-bright)]/20 text-[var(--color-felt-bright)]";
  if (pct >= 55) return "bg-[var(--color-felt)]/20 text-[var(--color-cream)]";
  if (pct >= 45) return "text-[var(--fg)]";
  if (pct >= 30) return "bg-[var(--color-pop)]/10 text-[var(--fg)]";
  return "bg-[var(--color-pop)]/20 text-[var(--color-pop-bright)]";
}

/* ============================================== Player Impact (with/without) */

function ImpactTable({
  rows,
}: {
  rows: ReturnType<typeof playerImpact>;
}) {
  if (rows.length === 0) {
    return <p className="surface p-6 text-sm text-[var(--fg-dim)]">No data.</p>;
  }
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
            <th className="px-4 py-3">Player</th>
            <th className="px-3 py-3 text-right">With (W/GP)</th>
            <th className="px-3 py-3 text-right">With %</th>
            <th className="px-3 py-3 text-right">Without (W/GP)</th>
            <th className="px-3 py-3 text-right">Without %</th>
            <th className="px-3 py-3 text-right">Swing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.playerId}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/roster/${r.playerId}`}
                  className="font-medium hover:text-[var(--color-brass)]"
                >
                  {r.playerName}
                </Link>
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-[var(--fg-dim)]">
                {r.withWins}/{r.withMatches}
              </td>
              <td className={cn("px-3 py-3 text-right tabular-nums", winRateClass(r.withWinPct, r.withMatches))}>
                {r.withMatches ? `${r.withWinPct}%` : "—"}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-[var(--fg-dim)]">
                {r.withoutWins}/{r.withoutMatches}
              </td>
              <td className={cn("px-3 py-3 text-right tabular-nums", winRateClass(r.withoutWinPct, r.withoutMatches))}>
                {r.withoutMatches ? `${r.withoutWinPct}%` : "—"}
              </td>
              <td
                className={cn(
                  "px-3 py-3 text-right text-sm font-bold tabular-nums",
                  r.swing > 5
                    ? "text-[var(--color-felt-bright)]"
                    : r.swing < -5
                      ? "text-[var(--color-pop-bright)]"
                      : "text-[var(--fg-dim)]",
                )}
              >
                {r.swing > 0 ? "+" : ""}
                {r.swing}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================== Achievements */

function AchievementsGrid({
  badges,
}: {
  badges: ReturnType<typeof achievements>["flat"];
}) {
  if (badges.length === 0) {
    return (
      <p className="surface p-6 text-sm text-[var(--fg-dim)]">
        No badges to award yet — need more match data.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {badges.map((b) => (
        <div
          key={b.id}
          className="surface relative overflow-hidden p-4 text-center"
        >
          <div className="absolute -right-3 -top-3 text-5xl opacity-20">
            {b.emoji}
          </div>
          <p className="text-2xl">{b.emoji}</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--color-brass-bright)]">
            {b.label}
          </p>
          <Link
            href={`/roster/${b.playerId}`}
            className="mt-1 block text-sm font-medium hover:text-[var(--color-brass)]"
          >
            {b.playerName}
          </Link>
          <p className="mt-1 text-xs text-[var(--fg-dim)]">{b.value}</p>
          <p className="mt-2 text-[10px] italic text-[var(--fg-dim)]">
            {b.description}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ============================================== Records Book */

function RecordsBookView({
  entries,
}: {
  entries: ReturnType<typeof recordsBook>;
}) {
  if (entries.length === 0) {
    return (
      <p className="surface p-6 text-sm text-[var(--fg-dim)]">
        Not enough data for records yet.
      </p>
    );
  }
  return (
    <ul className="surface divide-y divide-[var(--border)]">
      {entries.map((e, i) => {
        const inner = (
          <div className="flex items-baseline justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{e.label}</p>
              {e.detail && (
                <p className="text-xs text-[var(--fg-dim)]">{e.detail}</p>
              )}
            </div>
            <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-brass-bright)]">
              {e.value}
            </span>
          </div>
        );
        if (e.matchId) {
          return (
            <li key={`${e.label}-${i}`}>
              <Link
                href={`/matches/${e.matchId}`}
                className="block hover:bg-[var(--bg-soft)]"
              >
                {inner}
              </Link>
            </li>
          );
        }
        if (e.playerId) {
          return (
            <li key={`${e.label}-${i}`}>
              <Link
                href={`/roster/${e.playerId}`}
                className="block hover:bg-[var(--bg-soft)]"
              >
                {inner}
              </Link>
            </li>
          );
        }
        return <li key={`${e.label}-${i}`}>{inner}</li>;
      })}
    </ul>
  );
}

/* ============================================== MVP Race chart */

function MVPRaceChart({
  series,
}: {
  series: ReturnType<typeof mvpRaceData>;
}) {
  if (series.length === 0 || series.every((s) => s.series.length === 0)) {
    return <p className="surface p-6 text-sm text-[var(--fg-dim)]">No points scored yet.</p>;
  }
  const W = 700;
  const H = 200;
  const padL = 30;
  const padR = 8;
  const padT = 10;
  const padB = 26;
  const allDates = series.flatMap((s) => s.series.map((p) => +new Date(p.date)));
  const minD = Math.min(...allDates);
  const maxD = Math.max(...allDates);
  const maxPts = Math.max(
    ...series.flatMap((s) =>
      s.series.map((p) => p.cumulativePoints),
    ),
    1,
  );
  const xOf = (d: number) =>
    padL + ((d - minD) / Math.max(1, maxD - minD)) * (W - padL - padR);
  const yOf = (p: number) => H - padB - (p / maxPts) * (H - padT - padB);

  // Simple distinct color per player from a fixed palette.
  const palette = [
    "#C9A24A",
    "#E0BE6B",
    "#1F6E3D",
    "#2E8B57",
    "#C8362F",
    "#8B7CE0",
    "#E07CB0",
    "#7CCDE0",
  ];

  return (
    <div className="surface overflow-x-auto p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
        {/* axes */}
        <line
          x1={padL}
          x2={W - padR}
          y1={H - padB}
          y2={H - padB}
          className="stroke-[var(--border)]"
        />
        <line
          x1={padL}
          x2={padL}
          y1={padT}
          y2={H - padB}
          className="stroke-[var(--border)]"
        />
        {/* y-axis ticks */}
        {[0, 0.5, 1].map((t) => {
          const y = yOf(maxPts * t);
          return (
            <g key={t}>
              <line
                x1={padL - 3}
                x2={padL}
                y1={y}
                y2={y}
                className="stroke-[var(--border)]"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[var(--fg-dim)] text-[9px]"
              >
                {Math.round(maxPts * t * 10) / 10}
              </text>
            </g>
          );
        })}
        {series.map((s, i) => {
          const color = palette[i % palette.length];
          const path = s.series
            .map((p, j) => {
              const x = xOf(+new Date(p.date));
              const y = yOf(p.cumulativePoints);
              return `${j === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" ");
          const last = s.series[s.series.length - 1];
          return (
            <g key={s.playerId}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {last && (
                <text
                  x={xOf(+new Date(last.date)) + 3}
                  y={yOf(last.cumulativePoints) + 3}
                  className="text-[9px]"
                  fill={color}
                >
                  {s.playerName.split(" ")[0]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {series.map((s, i) => {
          const color = palette[i % palette.length];
          const total = s.series[s.series.length - 1]?.cumulativePoints ?? 0;
          return (
            <div key={s.playerId} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[var(--fg)]">{s.playerName}</span>
              <span className="font-semibold text-[var(--color-brass-bright)] tabular-nums">
                {total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================== Player Radar */

function RadarGrid({
  rows,
}: {
  rows: ReturnType<typeof radarStats>;
}) {
  if (rows.length === 0) {
    return <p className="surface p-6 text-sm text-[var(--fg-dim)]">No data.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((r) => (
        <PlayerRadar key={r.playerId} row={r} />
      ))}
    </div>
  );
}

function PlayerRadar({
  row,
}: {
  row: ReturnType<typeof radarStats>[number];
}) {
  const size = 180;
  const center = size / 2;
  const r = size * 0.4;
  const labels = ["Win %", "Sweep", "Mini", "B&R", "8oB"] as const;
  const values = [
    row.axes.winPct,
    row.axes.sweepRate,
    row.axes.miniRate,
    row.axes.brRate,
    row.axes.eobRate,
  ];
  const angle = (i: number) => (Math.PI * 2 * i) / labels.length - Math.PI / 2;
  const point = (i: number, v: number) => {
    const rr = (v / 100) * r;
    return [center + Math.cos(angle(i)) * rr, center + Math.sin(angle(i)) * rr];
  };
  const polyPoints = values
    .map((v, i) => point(i, v).join(","))
    .join(" ");
  // Reference rings.
  const rings = [25, 50, 75, 100].map((pct) =>
    labels
      .map((_, i) => point(i, pct).join(","))
      .join(" "),
  );

  return (
    <div className="surface p-4">
      <div className="flex items-baseline justify-between">
        <Link
          href={`/roster/${row.playerId}`}
          className="font-[family-name:var(--font-display)] text-lg tracking-wide hover:text-[var(--color-brass)]"
        >
          {row.playerName}
        </Link>
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
          {row.matches} m
        </span>
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto mt-2 block h-40 w-40">
        {rings.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="var(--border)"
            strokeWidth={0.5}
          />
        ))}
        <polygon
          points={polyPoints}
          fill="var(--color-brass)"
          fillOpacity={0.25}
          stroke="var(--color-brass-bright)"
          strokeWidth={1.5}
        />
        {labels.map((lbl, i) => {
          const [x, y] = point(i, 115);
          return (
            <text
              key={lbl}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[var(--fg-dim)] text-[8px]"
            >
              {lbl}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 grid grid-cols-5 gap-1 text-[10px] text-center text-[var(--fg-dim)]">
        <div>{row.raw.winPct}%</div>
        <div>{row.raw.sweepRate}%</div>
        <div>{row.raw.miniRate}%</div>
        <div>{row.raw.brRate}%</div>
        <div>{row.raw.eobRate}%</div>
      </div>
    </div>
  );
}

/* ============================================== Calendar Heatmap */

function CalendarHeatmap({
  cells,
}: {
  cells: ReturnType<typeof calendarHeatmap>;
}) {
  if (cells.length === 0) {
    return <p className="surface p-6 text-sm text-[var(--fg-dim)]">No matches.</p>;
  }
  // calendarHeatmap returns oldest→newest. Reverse so the most-recent
  // match sits on the LEFT (latest action first).
  const reversed = [...cells].reverse();
  const maxAbsMargin = Math.max(...cells.map((c) => Math.abs(c.margin)), 1);

  // Played-only stats (excludes byes + upcoming).
  const played = cells.filter((c) => c.outcome === "W" || c.outcome === "L" || c.outcome === "T");
  const totalRec = countRecord(played);
  // Last 10 of completed matches.
  const last10 = played.slice(-10);
  const last10Rec = countRecord(last10);
  // Streak (consecutive same-outcome from the most recent played match).
  const streak = (() => {
    if (played.length === 0) return null as null | { kind: "W" | "L" | "T"; count: number };
    const last = played[played.length - 1].outcome as "W" | "L" | "T";
    let n = 0;
    for (let i = played.length - 1; i >= 0; i--) {
      if (played[i].outcome === last) n++;
      else break;
    }
    return { kind: last, count: n };
  })();

  return (
    <div className="space-y-3">
      {/* Summary strip — total + last-10 + streak */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Season"
          value={fmtRecord(totalRec)}
          sub={`${played.length} match${played.length === 1 ? "" : "es"} played`}
        />
        <SummaryStat
          label="Last 10"
          value={fmtRecord(last10Rec)}
          sub={
            last10.length > 0
              ? `${Math.round((last10Rec.w / Math.max(1, last10Rec.w + last10Rec.l + last10Rec.t)) * 100)}% win rate`
              : "—"
          }
          tone={
            last10Rec.w > last10Rec.l
              ? "text-[var(--color-felt-bright)]"
              : last10Rec.w < last10Rec.l
                ? "text-[var(--color-pop-bright)]"
                : undefined
          }
        />
        {streak && streak.count >= 2 ? (
          <SummaryStat
            label="Current streak"
            value={`${streak.count}${streak.kind}`}
            sub={
              streak.kind === "W"
                ? "wins in a row 🐕"
                : streak.kind === "L"
                  ? "losses in a row"
                  : "ties in a row"
            }
            tone={
              streak.kind === "W"
                ? "text-[var(--color-felt-bright)]"
                : streak.kind === "L"
                  ? "text-[var(--color-pop-bright)]"
                  : undefined
            }
          />
        ) : (
          <SummaryStat
            label="Most recent"
            value={
              played.length > 0
                ? (played[played.length - 1].outcome as string)
                : "—"
            }
            sub={played.length > 0 ? `vs ${played[played.length - 1].opponent}` : ""}
          />
        )}
      </div>

      {/* Match cards — most recent first (left). Horizontally scrollable on
          mobile, wrapping grid on desktop. */}
      <div className="surface p-3 sm:p-4">
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible">
          {reversed.map((c) => (
            <MatchCell key={c.matchId} cell={c} maxAbsMargin={maxAbsMargin} />
          ))}
        </div>
        <p className="mt-2 text-[10px] text-[var(--fg-dim)]">
          Most recent on the left. Color intensity scales with the team-point margin. Tap any card to open the match.
        </p>
      </div>
    </div>
  );
}

function countRecord(cells: ReturnType<typeof calendarHeatmap>) {
  let w = 0,
    l = 0,
    t = 0;
  for (const c of cells) {
    if (c.outcome === "W") w++;
    else if (c.outcome === "L") l++;
    else if (c.outcome === "T") t++;
  }
  return { w, l, t };
}

function fmtRecord({ w, l, t }: { w: number; l: number; t: number }) {
  return t > 0 ? `${w}–${l}–${t}` : `${w}–${l}`;
}

function SummaryStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide tabular-nums",
          tone ?? "text-[var(--color-cream)]",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-[var(--fg-dim)]">{sub}</p>}
    </div>
  );
}

function MatchCell({
  cell,
  maxAbsMargin,
}: {
  cell: ReturnType<typeof calendarHeatmap>[number];
  maxAbsMargin: number;
}) {
  const intensity = Math.min(1, Math.abs(cell.margin) / maxAbsMargin);
  const tone =
    cell.outcome === "W"
      ? "text-[var(--color-felt-bright)]"
      : cell.outcome === "L"
        ? "text-[var(--color-pop-bright)]"
        : cell.outcome === "T"
          ? "text-[var(--color-brass-bright)]"
          : "text-[var(--fg-dim)]";
  const bg =
    cell.outcome === "W"
      ? `color-mix(in oklab, var(--color-felt-bright) ${15 + intensity * 50}%, transparent)`
      : cell.outcome === "L"
        ? `color-mix(in oklab, var(--color-pop) ${15 + intensity * 50}%, transparent)`
        : cell.outcome === "T"
          ? `color-mix(in oklab, var(--color-brass) 25%, transparent)`
          : cell.outcome === "BYE"
            ? "var(--bg-soft)"
            : "transparent";
  const border =
    cell.outcome === "UPCOMING"
      ? "border-dashed border-[var(--border)]"
      : "border-solid border-[var(--border)]";
  const badge =
    cell.outcome === "W"
      ? "W"
      : cell.outcome === "L"
        ? "L"
        : cell.outcome === "T"
          ? "T"
          : cell.outcome === "BYE"
            ? "BYE"
            : "—";
  const dateStr = formatShortDate(cell.date);
  const scoreStr =
    typeof cell.teamScore === "number" && typeof cell.opponentScore === "number"
      ? `${cell.teamScore}–${cell.opponentScore}`
      : null;
  const oppLabel = cell.outcome === "BYE" ? "BYE" : cell.opponent;
  const isUpcoming = cell.outcome === "UPCOMING";
  return (
    <Link
      href={`/matches/${cell.matchId}`}
      title={`${dateStr} · vs ${oppLabel}${scoreStr ? ` · ${scoreStr}` : ""}`}
      className={cn(
        "group flex w-[140px] shrink-0 flex-col gap-1.5 rounded-md border-2 px-3 py-2.5 transition-colors",
        "hover:border-[var(--color-brass)] sm:w-[160px]",
        border,
      )}
      style={{ backgroundColor: bg }}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          Wk{cell.week ?? "?"} · {dateStr}
        </span>
        <span className={cn("text-[11px] font-bold uppercase tracking-[0.2em]", tone)}>
          {badge}
        </span>
      </div>
      <div className="truncate text-sm font-semibold text-[var(--fg)]" title={oppLabel}>
        vs {oppLabel}
      </div>
      <div className="text-[11px] tabular-nums">
        {scoreStr ? (
          <span className={tone}>{scoreStr}</span>
        ) : isUpcoming ? (
          <span className="text-[var(--fg-dim)]">upcoming</span>
        ) : (
          <span className="text-[var(--fg-dim)]">—</span>
        )}
      </div>
    </Link>
  );
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(+d)) return "?";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ============================================== Level-Up Watch */

function LevelUpWatchView({
  rows,
}: {
  rows: ReturnType<typeof levelUpWatch>;
}) {
  if (rows.length === 0) {
    return <p className="surface p-6 text-sm text-[var(--fg-dim)]">No PA data yet.</p>;
  }
  return (
    <div className="surface divide-y divide-[var(--border)]">
      {rows.map((r) => (
        <div
          key={r.playerId}
          className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap"
        >
          <Link
            href={`/roster/${r.playerId}`}
            className="w-44 shrink-0 truncate font-medium hover:text-[var(--color-brass)]"
          >
            {r.playerName}
          </Link>
          <span className="text-xs text-[var(--fg-dim)]">
            SL{r.currentSL ?? "?"}
          </span>
          <div className="flex flex-1 items-center gap-1">
            {r.paTrend.map((p, i) => (
              <span
                key={i}
                className="inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded bg-[var(--bg-soft)] px-1 text-[10px] font-semibold tabular-nums text-[var(--fg)]"
              >
                {Math.round(p)}
              </span>
            ))}
          </div>
          <div
            className={cn(
              "w-24 text-right text-sm font-bold tabular-nums",
              r.trend === "up"
                ? "text-[var(--color-felt-bright)]"
                : r.trend === "down"
                  ? "text-[var(--color-pop-bright)]"
                  : "text-[var(--fg-dim)]",
            )}
          >
            {r.delta > 0 ? "+" : ""}
            {r.delta} PA
            <div className="text-[10px] font-normal text-[var(--fg-dim)] uppercase tracking-widest">
              {r.trend}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================== Expected vs Actual */

function ExpectedVsActualView({
  ea,
}: {
  ea: ReturnType<typeof expectedVsActual>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Actual wins" value={String(ea.actualWins)} sub={`out of ${ea.matches}`} />
        <Stat label="Expected wins" value={String(ea.expectedWins)} sub="schedule-strength adjusted" />
        <Stat
          label={ea.delta >= 0 ? "Over-performing" : "Under-performing"}
          value={`${ea.delta > 0 ? "+" : ""}${ea.delta}`}
          accent
          sub="actual − expected"
        />
      </div>
      {ea.perMatch.length > 0 && (
        <details className="surface overflow-hidden p-0">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] hover:text-[var(--color-brass)]">
            ↳ Per-match expected probabilities
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Opponent</th>
                  <th className="px-3 py-3 text-right">Expected</th>
                  <th className="px-3 py-3 text-right">Actual</th>
                </tr>
              </thead>
              <tbody>
                {ea.perMatch.map((p) => (
                  <tr
                    key={p.matchId}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3 text-xs text-[var(--fg-dim)]">
                      {formatDate(p.date)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/matches/${p.matchId}`}
                        className="font-medium hover:text-[var(--color-brass)]"
                      >
                        {p.opponent}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums">
                      {Math.round(p.expected * 100)}%
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right text-sm font-bold tabular-nums",
                        p.actual === 1
                          ? "text-[var(--color-felt-bright)]"
                          : "text-[var(--color-pop-bright)]",
                      )}
                    >
                      {p.actual === 1 ? "W" : "L"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
