import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/Section";
import {
  getMatch,
  getOpponentTeam,
  getOpponentTeams,
  getSchedule,
  getTeam,
} from "@/lib/apa";
import { loadSnapshot } from "@/lib/apa/client";
import { cn, formatDate } from "@/lib/utils";
import type { Match, Player } from "@/lib/apa/schemas";

export const revalidate = 3600;

type Props = {
  params: Promise<{ teamId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { teamId } = await params;
  const team = await getOpponentTeam(teamId);
  return {
    title: team ? `${team.name} · Opponent` : "Opponent",
    description: team
      ? `Scouting profile for ${team.name} — roster, schedule, and our matches against them.`
      : "Opponent team profile.",
  };
}

export default async function OpponentTeamPage({ params }: Props) {
  const { teamId } = await params;
  const team = await getOpponentTeam(teamId);
  if (!team) notFound();

  // Cross-references: ALL opp teams we know about (for linking schedule
  // opponents to their profile pages), the snapshot for opp player career
  // lookups, and our schedule (for "common opponents" analysis).
  const [allOppTeams, snapshot, ourSchedule, ourTeam] = await Promise.all([
    getOpponentTeams(),
    loadSnapshot(),
    getSchedule(),
    getTeam(),
  ]);
  const oppTeamByName = new Map(
    allOppTeams.map((t) => [t.name.trim().toLowerCase(), t]),
  );

  // Pull each opp player's full league career from the snapshot — gives us
  // SL trajectory and total matches across all teams (not just this one).
  const oppPlayersById = snapshot.opponentPlayers ?? {};

  // Past schedule is sorted by (their team's perspective) date descending.
  const completed = [...team.schedule]
    .filter((m) => m.status === "completed")
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const upcoming = [...team.schedule]
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

  // ----- Quick stats -------------------------------------------------------
  const rosterWithSL = team.roster.filter((p) => p.skillLevel != null);
  const avgSL =
    rosterWithSL.length > 0
      ? rosterWithSL.reduce((s, p) => s + (p.skillLevel ?? 0), 0) /
        rosterWithSL.length
      : null;
  const totalRosterMatches = team.roster.reduce(
    (s, p) => s + (p.stats?.matchesPlayed ?? 0),
    0,
  );
  const totalRosterWins = team.roster.reduce(
    (s, p) => s + (p.stats?.wins ?? 0),
    0,
  );
  const rosterWinPct =
    totalRosterMatches > 0
      ? Math.round((totalRosterWins / totalRosterMatches) * 1000) / 10
      : null;

  // Top scorer — highest career win % across roster, min 5 matches scraped.
  const rosterEnriched = team.roster.map((p) => {
    const profile = oppPlayersById[p.id];
    return {
      ...p,
      career: profile?.career ?? null,
      sessions: profile?.sessions ?? [],
    };
  });
  const topScorer = [...rosterEnriched]
    .filter((p) => p.career && p.career.matchesPlayed >= 5)
    .sort((a, b) => (b.career?.winPct ?? 0) - (a.career?.winPct ?? 0))[0];

  // Hot / cold from career data (mirrors ScoutingReport logic).
  function trendOf(career: typeof rosterEnriched[number]["career"]):
    | "hot"
    | "cold"
    | "steady" {
    if (!career || career.matchesPlayed < 5) return "steady";
    if (career.winPct >= 60) return "hot";
    if (career.winPct <= 40) return "cold";
    return "steady";
  }
  const hotCount = rosterEnriched.filter(
    (p) => trendOf(p.career) === "hot",
  ).length;
  const coldCount = rosterEnriched.filter(
    (p) => trendOf(p.career) === "cold",
  ).length;

  // Streak from THEIR perspective — last N completed matches in a row of
  // same outcome.
  const completedFinalized = completed.filter(
    (m) =>
      typeof m.teamScore === "number" && typeof m.opponentScore === "number",
  );
  const streak = (() => {
    if (completedFinalized.length === 0) return null;
    const out = (m: Match) => {
      // teamScore / opponentScore in opp team's schedule are from THEIR
      // perspective (the projector flips them appropriately).
      if (m.teamScore! > m.opponentScore!) return "W" as const;
      if (m.teamScore! < m.opponentScore!) return "L" as const;
      return "T" as const;
    };
    const last = out(completedFinalized[0]);
    let n = 0;
    for (const m of completedFinalized) {
      if (out(m) === last) n++;
      else break;
    }
    return { kind: last, count: n };
  })();

  // Avg points per match (margin trend) — positive means they typically
  // outscore opponents.
  let avgFor = 0;
  let avgAgainst = 0;
  let nMargins = 0;
  let bestWin: { match: Match; margin: number } | null = null;
  let worstLoss: { match: Match; margin: number } | null = null;
  for (const m of completedFinalized) {
    const f = m.teamScore!;
    const a = m.opponentScore!;
    avgFor += f;
    avgAgainst += a;
    nMargins++;
    const margin = f - a;
    if (margin > 0 && (!bestWin || margin > bestWin.margin)) {
      bestWin = { match: m, margin };
    }
    if (margin < 0 && (!worstLoss || margin < worstLoss.margin)) {
      worstLoss = { match: m, margin };
    }
  }
  if (nMargins > 0) {
    avgFor = Math.round((avgFor / nMargins) * 10) / 10;
    avgAgainst = Math.round((avgAgainst / nMargins) * 10) / 10;
  }

  // Common opponents — teams both they and we have played this session.
  // For each shared opponent, compare their result vs ours.
  const ourTeamName = ourTeam?.name ?? "Top Dawgs";
  type CommonOppRow = {
    opponent: string;
    oppTeamId: number | null;
    theirResult: { score: string; outcome: "W" | "L" | "T" } | null;
    ourResult: { score: string; outcome: "W" | "L" | "T" } | null;
  };
  const commonOpponents = (() => {
    const ourByOppName = new Map<string, Match>();
    for (const m of ourSchedule) {
      if (
        m.status === "completed" &&
        typeof m.teamScore === "number" &&
        typeof m.opponentScore === "number"
      ) {
        ourByOppName.set(m.opponent.trim().toLowerCase(), m);
      }
    }
    const rows: CommonOppRow[] = [];
    for (const m of completedFinalized) {
      const oppKey = m.opponent.trim().toLowerCase();
      // Skip matches against US (those go in their own section) and any
      // mismatch where we don't share an opponent.
      if (oppKey === ourTeamName.trim().toLowerCase()) continue;
      const ourMatch = ourByOppName.get(oppKey);
      if (!ourMatch) continue;
      const theirOutcome: "W" | "L" | "T" =
        m.teamScore! > m.opponentScore!
          ? "W"
          : m.teamScore! < m.opponentScore!
            ? "L"
            : "T";
      const ourOutcome: "W" | "L" | "T" =
        ourMatch.teamScore! > ourMatch.opponentScore!
          ? "W"
          : ourMatch.teamScore! < ourMatch.opponentScore!
            ? "L"
            : "T";
      const linkedOpp = oppTeamByName.get(oppKey);
      rows.push({
        opponent: m.opponent,
        oppTeamId: linkedOpp?.id ?? null,
        theirResult: {
          score: `${m.teamScore}–${m.opponentScore}`,
          outcome: theirOutcome,
        },
        ourResult: {
          score: `${ourMatch.teamScore}–${ourMatch.opponentScore}`,
          outcome: ourOutcome,
        },
      });
    }
    return rows;
  })();

  // Resolve the "vs us" matches — full Match records for our scoresheet.
  const matchesVsUs = await Promise.all(
    team.matchesVsUs.map((id) => getMatch(id)),
  );
  const validMatchesVsUs = matchesVsUs.filter(
    (m): m is NonNullable<typeof m> => m !== null,
  );

  return (
    <>
      <PageHeader
        eyebrow={team.division ?? "Opposing team"}
        title={team.name}
        subtitle={
          <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[var(--fg-dim)]">
            <span>
              {team.record.wins}–{team.record.losses}
              {team.record.ties ? `–${team.record.ties}` : ""}
            </span>
            {team.record.rank ? (
              <span>#{team.record.rank} in division</span>
            ) : null}
            {team.record.points != null && (
              <span>{team.record.points} pts</span>
            )}
            {team.sessionName && <span>· {team.sessionName}</span>}
            {team.homeLocation && <span>· {team.homeLocation}</span>}
          </span>
        }
      />

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        {/* ===== Quick stat cards ===== */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Roster avg SL"
            value={avgSL ? avgSL.toFixed(1) : "—"}
            sub={`${rosterWithSL.length} player${rosterWithSL.length === 1 ? "" : "s"}`}
          />
          <Stat
            label="Roster career"
            value={rosterWinPct != null ? `${rosterWinPct}%` : "—"}
            sub={`${totalRosterWins}–${totalRosterMatches - totalRosterWins} across all sessions`}
            tone={
              rosterWinPct == null
                ? undefined
                : rosterWinPct >= 55
                  ? "text-[var(--color-pop-bright)]"
                  : rosterWinPct <= 45
                    ? "text-[var(--color-felt-bright)]"
                    : undefined
            }
          />
          <Stat
            label="Avg points / week"
            value={nMargins > 0 ? `${avgFor}` : "—"}
            sub={
              nMargins > 0
                ? `vs ${avgAgainst} allowed (${avgFor - avgAgainst >= 0 ? "+" : ""}${(avgFor - avgAgainst).toFixed(1)} margin)`
                : "no completed matches"
            }
            tone={
              nMargins > 0 && avgFor > avgAgainst
                ? "text-[var(--color-pop-bright)]"
                : nMargins > 0 && avgFor < avgAgainst
                  ? "text-[var(--color-felt-bright)]"
                  : undefined
            }
          />
          {streak && streak.count >= 2 ? (
            <Stat
              label="Current streak"
              value={`${streak.count}${streak.kind}`}
              sub={
                streak.kind === "W"
                  ? "wins in a row 🔥"
                  : streak.kind === "L"
                    ? "losses in a row ❄️"
                    : "ties in a row"
              }
              tone={
                streak.kind === "W"
                  ? "text-[var(--color-pop-bright)]"
                  : streak.kind === "L"
                    ? "text-[var(--color-felt-bright)]"
                    : undefined
              }
            />
          ) : (
            <Stat
              label="Hot / cold roster"
              value={`${hotCount} 🔥 / ${coldCount} ❄️`}
              sub={`based on ≥5-match career win %`}
            />
          )}
        </section>

        {/* ===== Top scorer + key matches ===== */}
        {(topScorer || bestWin || worstLoss) && (
          <section className="grid gap-3 lg:grid-cols-3">
            {topScorer && (
              <Highlight
                eyebrow="🏆 Top scorer"
                title={topScorer.name}
                href={`/players/${topScorer.id}`}
                lines={[
                  topScorer.career
                    ? `${topScorer.career.winPct}% career (${topScorer.career.wins}–${topScorer.career.losses})`
                    : "",
                  topScorer.skillLevel != null
                    ? `Currently SL${topScorer.skillLevel}`
                    : "",
                ].filter(Boolean)}
                tone="brass"
              />
            )}
            {bestWin && (
              <Highlight
                eyebrow="💥 Biggest win"
                title={`+${bestWin.margin} vs ${bestWin.match.opponent}`}
                href={
                  team.matchesVsUs.includes(bestWin.match.id)
                    ? `/matches/${bestWin.match.id}`
                    : null
                }
                lines={[
                  `${bestWin.match.teamScore}–${bestWin.match.opponentScore}`,
                  formatDate(bestWin.match.date),
                ]}
                tone="pop"
              />
            )}
            {worstLoss && (
              <Highlight
                eyebrow="🥶 Worst loss"
                title={`${worstLoss.margin} vs ${worstLoss.match.opponent}`}
                href={
                  team.matchesVsUs.includes(worstLoss.match.id)
                    ? `/matches/${worstLoss.match.id}`
                    : null
                }
                lines={[
                  `${worstLoss.match.teamScore}–${worstLoss.match.opponentScore}`,
                  formatDate(worstLoss.match.date),
                ]}
                tone="felt"
              />
            )}
          </section>
        )}

        {/* ===== Roster ===== */}
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-wide">
              Roster
            </h2>
            <p className="text-xs text-[var(--fg-dim)]">
              Sorted by SL desc · click any player for full session history
            </p>
          </div>
          {rosterEnriched.length === 0 ? (
            <p className="surface p-6 text-sm text-[var(--fg-dim)]">
              No roster data yet.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...rosterEnriched]
                .sort(
                  (a, b) =>
                    (b.skillLevel ?? 0) - (a.skillLevel ?? 0) ||
                    (b.career?.matchesPlayed ?? 0) -
                      (a.career?.matchesPlayed ?? 0),
                )
                .map((p) => (
                  <RosterCard
                    key={p.id}
                    player={p}
                    trend={trendOf(p.career)}
                    currentSessionId={team.sessionId ?? null}
                  />
                ))}
            </ul>
          )}
        </section>

        {/* ===== Matches vs us — quick recap ===== */}
        {validMatchesVsUs.length > 0 && (
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-3xl tracking-wide">
              When we played them ({validMatchesVsUs.length})
            </h2>
            <ul className="surface divide-y divide-[var(--border)]">
              {validMatchesVsUs.map((m) => {
                const won =
                  typeof m.teamScore === "number" &&
                  typeof m.opponentScore === "number" &&
                  m.teamScore > m.opponentScore;
                const lost =
                  typeof m.teamScore === "number" &&
                  typeof m.opponentScore === "number" &&
                  m.teamScore < m.opponentScore;
                const tied =
                  typeof m.teamScore === "number" &&
                  typeof m.opponentScore === "number" &&
                  m.teamScore === m.opponentScore;
                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-soft)]/40"
                  >
                    <Link
                      href={`/matches/${m.id}`}
                      className="flex flex-1 flex-wrap items-baseline gap-2"
                    >
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]",
                          won &&
                            "bg-[var(--color-felt)]/20 text-[var(--color-felt-bright)]",
                          lost &&
                            "bg-[var(--color-pop)]/20 text-[var(--color-pop-bright)]",
                          tied &&
                            "bg-[var(--color-brass)]/20 text-[var(--color-brass-bright)]",
                        )}
                      >
                        {won ? "W" : lost ? "L" : tied ? "T" : "—"}
                      </span>
                      <span className="text-sm font-medium">
                        {formatDate(m.date)}
                      </span>
                      {m.location && (
                        <span className="text-xs text-[var(--fg-dim)]">
                          @ {m.location}
                        </span>
                      )}
                    </Link>
                    <Link
                      href={`/matches/${m.id}`}
                      className="rounded px-1 text-sm tabular-nums transition-colors hover:bg-[var(--bg-soft)]"
                      title="View this match"
                    >
                      <span className="text-[var(--color-felt-bright)]">
                        {m.teamScore ?? "—"}
                      </span>
                      <span className="text-[var(--fg-dim)]"> – </span>
                      <span className="text-[var(--color-pop-bright)]">
                        {m.opponentScore ?? "—"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ===== Common opponents ===== */}
        {commonOpponents.length > 0 && (
          <section>
            <h2 className="mb-1 font-[family-name:var(--font-display)] text-3xl tracking-wide">
              Common opponents
            </h2>
            <p className="mb-4 text-xs text-[var(--fg-dim)]">
              Teams both we and {team.name} have played this session — handy
              for transitive read on relative strength.
            </p>
            <div className="surface overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                    <th className="px-4 py-3">Opponent</th>
                    <th className="px-4 py-3 text-right">{team.name}</th>
                    <th className="px-4 py-3 text-right">{ourTeamName}</th>
                    <th className="px-4 py-3 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {commonOpponents.map((row, i) => {
                    const theirNum =
                      row.theirResult?.outcome === "W"
                        ? 1
                        : row.theirResult?.outcome === "T"
                          ? 0
                          : -1;
                    const ourNum =
                      row.ourResult?.outcome === "W"
                        ? 1
                        : row.ourResult?.outcome === "T"
                          ? 0
                          : -1;
                    const delta = ourNum - theirNum;
                    const deltaTone =
                      delta > 0
                        ? "text-[var(--color-felt-bright)]"
                        : delta < 0
                          ? "text-[var(--color-pop-bright)]"
                          : "text-[var(--fg-dim)]";
                    return (
                      <tr
                        key={`${row.opponent}-${i}`}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">
                          {row.oppTeamId ? (
                            <Link
                              href={`/opponents/${row.oppTeamId}`}
                              className="hover:text-[var(--color-brass)]"
                            >
                              {row.opponent}
                            </Link>
                          ) : (
                            row.opponent
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums">
                          <ResultPill r={row.theirResult} />
                        </td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums">
                          <ResultPill r={row.ourResult} />
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right text-xs font-semibold tabular-nums",
                            deltaTone,
                          )}
                        >
                          {delta > 0
                            ? "we did better"
                            : delta < 0
                              ? "they did better"
                              : "tied"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===== Upcoming ===== */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-3xl tracking-wide">
              Upcoming ({upcoming.length})
            </h2>
            <ul className="surface divide-y divide-[var(--border)]">
              {upcoming.map((m) => {
                const linkedOpp = oppTeamByName.get(
                  m.opponent.trim().toLowerCase(),
                );
                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 transition-colors hover:bg-[var(--bg-soft)]/40"
                  >
                    <Link
                      href={`/matches/${m.id}?team=${team.id}`}
                      className="flex flex-1 flex-wrap items-baseline gap-2"
                    >
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--fg-dim)]">
                        Wk{m.week ?? "?"}
                      </span>
                      <span>
                        vs <span className="font-medium">{m.opponent}</span>
                      </span>
                      {m.location && (
                        <span className="text-xs text-[var(--fg-dim)]">
                          @ {m.location}
                        </span>
                      )}
                    </Link>
                    <span className="flex items-baseline gap-2 text-xs text-[var(--fg-dim)]">
                      {linkedOpp && (
                        <Link
                          href={`/opponents/${linkedOpp.id}`}
                          className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)] hover:underline"
                        >
                          team →
                        </Link>
                      )}
                      <span>{formatDate(m.date)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ===== Full schedule ===== */}
        {completed.length > 0 && (
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-3xl tracking-wide">
              Schedule ({completed.length} completed)
            </h2>
            <ul className="surface divide-y divide-[var(--border)]">
              {completed.map((m) => {
                const won =
                  typeof m.teamScore === "number" &&
                  typeof m.opponentScore === "number" &&
                  m.teamScore > m.opponentScore;
                const lost =
                  typeof m.teamScore === "number" &&
                  typeof m.opponentScore === "number" &&
                  m.teamScore < m.opponentScore;
                const tied =
                  typeof m.teamScore === "number" &&
                  typeof m.opponentScore === "number" &&
                  m.teamScore === m.opponentScore;
                const linkedOpp = oppTeamByName.get(
                  m.opponent.trim().toLowerCase(),
                );
                const isVsUs = team.matchesVsUs.includes(m.id);
                // Use the vs-us match id when available so the link goes to
                // OUR scoresheet (with our perspective as default); otherwise
                // pass team= so the match page renders from this opp's
                // perspective.
                const matchHref = isVsUs
                  ? `/matches/${m.id}`
                  : `/matches/${m.id}?team=${team.id}`;
                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-soft)]/40"
                  >
                    <Link
                      href={matchHref}
                      className="flex flex-1 flex-wrap items-baseline gap-2"
                    >
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]",
                          won &&
                            "bg-[var(--color-pop)]/20 text-[var(--color-pop-bright)]",
                          lost &&
                            "bg-[var(--color-felt)]/20 text-[var(--color-felt-bright)]",
                          tied &&
                            "bg-[var(--color-brass)]/20 text-[var(--color-brass-bright)]",
                        )}
                      >
                        {won ? "W" : lost ? "L" : tied ? "T" : "—"}
                      </span>
                      {isVsUs && (
                        <span className="rounded-full bg-[var(--color-brass)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-brass-bright)]">
                          vs us
                        </span>
                      )}
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--fg-dim)]">
                        Wk{m.week ?? "?"}
                      </span>
                      <span>vs <span className="font-medium">{m.opponent}</span></span>
                    </Link>
                    <span className="flex items-baseline gap-3 text-sm tabular-nums">
                      <Link
                        href={matchHref}
                        className={cn(
                          "rounded px-1 transition-colors hover:bg-[var(--bg-soft)]",
                          won && "font-semibold text-[var(--color-pop-bright)]",
                          lost && "font-semibold text-[var(--color-felt-bright)]",
                          tied && "font-semibold text-[var(--color-brass-bright)]",
                        )}
                        title="View this match"
                      >
                        {m.teamScore ?? "-"}–{m.opponentScore ?? "-"}
                      </Link>
                      {linkedOpp && (
                        <Link
                          href={`/opponents/${linkedOpp.id}`}
                          className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)] hover:underline"
                          title={`View ${m.opponent}`}
                        >
                          team →
                        </Link>
                      )}
                      <span className="text-xs text-[var(--fg-dim)]">
                        {formatDate(m.date)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="text-xs text-[var(--fg-dim)]">
          Last fetched {formatDate(team.lastFetched)} ·{" "}
          {team.url && (
            <a
              href={team.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--color-brass)] hover:underline"
            >
              View on APA league portal →
            </a>
          )}
        </p>
      </div>
    </>
  );
}

/* ---------- helpers ---------- */

function Stat({
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

function Highlight({
  eyebrow,
  title,
  href,
  lines,
  tone,
}: {
  eyebrow: string;
  title: string;
  href: string | null;
  lines: string[];
  tone: "brass" | "pop" | "felt";
}) {
  const accent =
    tone === "brass"
      ? "text-[var(--color-brass-bright)]"
      : tone === "pop"
        ? "text-[var(--color-pop-bright)]"
        : "text-[var(--color-felt-bright)]";
  const inner = (
    <div className="surface p-4">
      <p className={cn("text-[10px] font-semibold uppercase tracking-[0.28em]", accent)}>
        {eyebrow}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl tracking-wide">
        {title}
      </p>
      {lines.map((line, i) => (
        <p key={i} className="text-[10px] text-[var(--fg-dim)]">
          {line}
        </p>
      ))}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-colors hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function ResultPill({
  r,
}: {
  r: { score: string; outcome: "W" | "L" | "T" } | null;
}) {
  if (!r) return <span className="text-[var(--fg-dim)]">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]",
        r.outcome === "W" &&
          "bg-[var(--color-felt)]/20 text-[var(--color-felt-bright)]",
        r.outcome === "L" &&
          "bg-[var(--color-pop)]/20 text-[var(--color-pop-bright)]",
        r.outcome === "T" &&
          "bg-[var(--color-brass)]/20 text-[var(--color-brass-bright)]",
      )}
    >
      <span>{r.outcome}</span>
      <span className="font-mono text-[10px] tabular-nums">{r.score}</span>
    </span>
  );
}

type RosterEnriched = Player & {
  career: { matchesPlayed: number; wins: number; losses: number; winPct: number } | null;
  sessions: Array<{
    sessionId: number;
    sessionName: string;
    skillLevel?: number | null;
    matchesPlayed?: number;
    wins?: number;
    winPct?: number;
  }>;
};

function RosterCard({
  player,
  trend,
  currentSessionId,
}: {
  player: RosterEnriched;
  trend: "hot" | "cold" | "steady";
  currentSessionId: number | null;
}) {
  const sessionRec = player.stats;
  // SL trajectory — last 4 sessions with SL data (newest first → reversed
  // for left-to-right "oldest to newest" arrows). Capture sessionId on
  // each chip so we can highlight the current session distinctly.
  const trajectory = [...(player.sessions ?? [])]
    .filter((s) => s.skillLevel != null)
    .slice(0, 4)
    .reverse();
  return (
    <li className="surface p-4">
      <Link
        href={`/players/${player.id}`}
        className="block hover:text-[var(--color-brass)]"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-[family-name:var(--font-display)] text-xl tracking-wide truncate">
            {player.name}
          </span>
          {player.skillLevel != null && (
            <span className="text-xs text-[var(--fg-dim)]">
              SL{player.skillLevel}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
          {trend === "hot" && (
            <span className="rounded-full bg-[var(--color-pop)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-pop-bright)]">
              🔥 Hot
            </span>
          )}
          {trend === "cold" && (
            <span className="rounded-full bg-[var(--color-felt)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-felt-bright)]">
              ❄️ Cold
            </span>
          )}
          {sessionRec?.matchesPlayed ? (
            <span className="text-[10px] text-[var(--fg-dim)]">
              {sessionRec.wins ?? 0}/{sessionRec.matchesPlayed} this session
              {sessionRec.winPct != null && ` · ${sessionRec.winPct}%`}
            </span>
          ) : null}
        </div>
        {player.career && player.career.matchesPlayed > 0 && (
          <p className="mt-1 text-[10px] text-[var(--fg-dim)]">
            Career:{" "}
            <span className="font-semibold text-[var(--fg)]">
              {player.career.wins}–{player.career.losses}
            </span>{" "}
            ({player.career.winPct}%) over {player.career.matchesPlayed} matches
          </p>
        )}
        {trajectory.length > 0 && (
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
              SL trajectory
            </span>
            <div className="flex items-baseline gap-1">
              {trajectory.map((s, i) => {
                const isCurrent =
                  currentSessionId != null && s.sessionId === currentSessionId;
                return (
                  <span
                    key={`${s.sessionId}-${i}`}
                    className={cn(
                      "rounded px-1 py-px text-[10px] tabular-nums",
                      isCurrent
                        ? "border border-[var(--color-brass)] bg-[var(--color-brass)]/15 font-bold text-[var(--color-brass-bright)]"
                        : "border border-[var(--border)] text-[var(--fg-dim)]",
                    )}
                    title={`${s.sessionName}${isCurrent ? " (current)" : ""}: ${s.matchesPlayed ?? 0} matches${s.winPct != null ? ` · ${s.winPct}%` : ""}`}
                  >
                    {s.skillLevel ?? "?"}
                    {isCurrent && (
                      <span className="ml-0.5 text-[8px]">●</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </Link>
    </li>
  );
}
