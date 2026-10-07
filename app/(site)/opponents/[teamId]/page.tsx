import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { PoolBall } from "@/components/brand/PoolBall";
import { PointerSheen } from "@/components/home/PointerSheen";
import {
  Chip,
  ChipRow,
  DISPLAY,
  OutcomePill,
  SectionHead,
  StatRail,
  TABLE_WRAP,
  TH,
  THEAD_ROW,
  TR,
  TR_OURS,
} from "@/components/research/ScoutUI";
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
import { prerenderOpponentTeamIds } from "@/lib/prerender";
import { pageMetadata } from "@/lib/site";

export const revalidate = 3600;

/**
 * Rendered on first request per id, then cached — except on Cloudflare
 * Workers, where they are prerendered at build (see lib/prerender.ts).
 */
export async function generateStaticParams() {
  return (await prerenderOpponentTeamIds()).map((teamId) => ({ teamId }));
}

type Props = {
  params: Promise<{ teamId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { teamId } = await params;
  const team = await getOpponentTeam(teamId);
  return pageMetadata({
    title: team ? `${team.name} · Opponent` : "Opponent",
    description: team
      ? `Scouting profile for ${team.name} — roster, schedule, and their APA matches against Top Dawgs.`
      : "Opponent team profile.",
    path: `/opponents/${teamId}`,
  });
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

  const recordStr = `${team.record.wins}–${team.record.losses}${team.record.ties ? `–${team.record.ties}` : ""}`;

  return (
    <>
      <PageHeader
        eyebrow={team.division ?? "Opposing team"}
        title={team.name}
        subtitle={
          team.sessionName || team.homeLocation ? (
            <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="pm-serif text-[1.15em] text-[var(--color-brass-bright)]/90">
                Scouting report
              </span>
              {team.sessionName && <span>· {team.sessionName}</span>}
              {team.homeLocation && <span>· {team.homeLocation}</span>}
            </span>
          ) : undefined
        }
      >
        <ChipRow>
          <Chip tone="brass" className="font-semibold tabular-nums">
            {recordStr}
          </Chip>
          {team.record.rank ? (
            <Chip>#{team.record.rank} in division</Chip>
          ) : null}
          {team.record.points != null && (
            <Chip className="tabular-nums">{team.record.points} pts</Chip>
          )}
        </ChipRow>
      </PageHeader>
      <PointerSheen />

      <div className="mx-auto max-w-7xl space-y-14 px-4 pb-16 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        {/* ===== Quick stats — on the rail ===== */}
        <StatRail
          className="fade-in-up mt-2"
          stats={[
            {
              label: "Roster avg SL",
              value: avgSL ? avgSL.toFixed(1) : "—",
              sub: `${rosterWithSL.length} player${rosterWithSL.length === 1 ? "" : "s"}`,
            },
            {
              label: "Roster career",
              value: rosterWinPct != null ? `${rosterWinPct}%` : "—",
              sub: `${totalRosterWins}–${totalRosterMatches - totalRosterWins} across all sessions`,
              tone:
                rosterWinPct == null
                  ? undefined
                  : rosterWinPct >= 55
                    ? "loss"
                    : rosterWinPct <= 45
                      ? "win"
                      : undefined,
            },
            {
              label: "Avg points / week",
              value: nMargins > 0 ? `${avgFor}` : "—",
              sub:
                nMargins > 0
                  ? `vs ${avgAgainst} allowed (${avgFor - avgAgainst >= 0 ? "+" : ""}${(avgFor - avgAgainst).toFixed(1)} margin)`
                  : "no completed matches",
              tone:
                nMargins > 0 && avgFor > avgAgainst
                  ? "loss"
                  : nMargins > 0 && avgFor < avgAgainst
                    ? "win"
                    : undefined,
            },
            streak && streak.count >= 2
              ? {
                  label: "Current streak",
                  value: `${streak.count}${streak.kind}`,
                  sub:
                    streak.kind === "W"
                      ? "wins in a row 🔥"
                      : streak.kind === "L"
                        ? "losses in a row ❄️"
                        : "ties in a row",
                  tone:
                    streak.kind === "W"
                      ? "loss"
                      : streak.kind === "L"
                        ? "win"
                        : undefined,
                }
              : {
                  label: "Hot / cold roster",
                  value: `${hotCount} 🔥 / ${coldCount} ❄️`,
                  sub: `based on ≥5-match career win %`,
                },
          ]}
        />

        {/* ===== Top scorer + key matches ===== */}
        {(topScorer || bestWin || worstLoss) && (
          <section className="grid gap-4 lg:grid-cols-3">
            {topScorer && (
              <Highlight
                icon="🏆"
                eyebrow="Top scorer"
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
                index={0}
              />
            )}
            {bestWin && (
              <Highlight
                icon="💥"
                eyebrow="Biggest win"
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
                index={1}
              />
            )}
            {worstLoss && (
              <Highlight
                icon="🥶"
                eyebrow="Worst loss"
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
                index={2}
              />
            )}
          </section>
        )}

        {/* ===== Roster ===== */}
        <section>
          <SectionHead
            eyebrow="The roster"
            title="Who they bring"
            action={
              <p className="hidden text-[11px] text-[var(--color-cream)]/45 md:block">
                Sorted by SL desc · click any player for full session history
              </p>
            }
          />
          {rosterEnriched.length === 0 ? (
            <p className="surface p-6 text-sm text-[var(--color-cream)]/55">
              No roster data yet.
            </p>
          ) : (
            <ul className="pm-reveal grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <p className="mt-3 text-[11px] text-[var(--color-cream)]/45 md:hidden">
            Sorted by SL desc · tap any player for full session history
          </p>
        </section>

        {/* ===== Matches vs us — quick recap ===== */}
        {validMatchesVsUs.length > 0 && (
          <section>
            <SectionHead
              eyebrow="Head to head"
              title={`When we played them (${validMatchesVsUs.length})`}
            />
            <ul className="surface pm-reveal overflow-hidden">
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
                  <li key={m.id} className={cn(TR, "relative")}>
                    <Link
                      href={`/matches/${m.id}`}
                      className="group flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6"
                    >
                      <OutcomePill outcome={won ? "W" : lost ? "L" : tied ? "T" : "—"} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[var(--color-cream)]">
                          {formatDate(m.date)}
                        </span>
                        {m.location && (
                          <span className="block truncate text-xs text-[var(--color-cream)]/45">
                            @ {m.location}
                          </span>
                        )}
                      </span>
                      <span
                        className={`${DISPLAY} shrink-0 text-2xl leading-none tabular-nums sm:text-3xl`}
                        title="View this match"
                      >
                        <span className="text-[var(--color-felt-text)]">
                          {m.teamScore ?? "—"}
                        </span>
                        <span className="mx-1 text-[var(--color-cream)]/25">–</span>
                        <span className="text-[var(--color-pop-bright)]">
                          {m.opponentScore ?? "—"}
                        </span>
                      </span>
                      <ArrowRight
                        size={16}
                        className="shrink-0 text-[var(--color-brass)]/60 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brass-bright)]"
                      />
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
            <SectionHead
              eyebrow="Transitive read"
              title="Common opponents"
              sub={`Teams both we and ${team.name} have played this session — handy for transitive read on relative strength.`}
            />
            <div className={cn(TABLE_WRAP, "pm-reveal")}>
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className={TH}>Opponent</th>
                    <th className={cn(TH, "text-right")}>{team.name}</th>
                    <th className={cn(TH, "text-right text-[var(--color-brass-bright)]")}>
                      {ourTeamName}
                    </th>
                    <th className={cn(TH, "text-right")}>Δ</th>
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
                        ? "text-[var(--color-felt-text)]"
                        : delta < 0
                          ? "text-[var(--color-pop-bright)]"
                          : "text-[var(--color-cream)]/45";
                    return (
                      <tr key={`${row.opponent}-${i}`} className={TR}>
                        <td className="px-4 py-3.5 font-medium text-[var(--color-cream)]">
                          {row.oppTeamId ? (
                            <Link
                              href={`/opponents/${row.oppTeamId}`}
                              className="transition-colors hover:text-[var(--color-brass-bright)]"
                            >
                              {row.opponent}
                            </Link>
                          ) : (
                            row.opponent
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <ResultPill r={row.theirResult} />
                        </td>
                        <td className="bg-[var(--color-brass)]/[0.04] px-4 py-3.5 text-right">
                          <ResultPill r={row.ourResult} />
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-4 py-3.5 text-right text-xs font-semibold",
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
            <SectionHead eyebrow="On deck" title={`Upcoming (${upcoming.length})`} />
            <ul className="surface pm-reveal overflow-hidden">
              {upcoming.map((m) => {
                const linkedOpp = oppTeamByName.get(
                  m.opponent.trim().toLowerCase(),
                );
                return (
                  <li
                    key={m.id}
                    className={cn(TR, "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3.5 sm:px-6")}
                  >
                    <Link
                      href={`/matches/${m.id}?team=${team.id}`}
                      className="flex min-w-[min(100%,15rem)] flex-1 items-baseline gap-3"
                    >
                      <WeekTag week={m.week} />
                      <span className="min-w-0 truncate text-[var(--color-cream)]/85">
                        <span className="pm-serif text-[var(--color-cream)]/45">vs</span>{" "}
                        <span className="font-semibold text-[var(--color-cream)]">{m.opponent}</span>
                        {m.location && (
                          <span className="ml-2 text-xs text-[var(--color-cream)]/40">
                            @ {m.location}
                          </span>
                        )}
                      </span>
                    </Link>
                    <span className="flex items-baseline gap-3 text-xs text-[var(--color-cream)]/50">
                      {linkedOpp && (
                        <Link
                          href={`/opponents/${linkedOpp.id}`}
                          className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brass)] hover:text-[var(--color-brass-bright)]"
                        >
                          team →
                        </Link>
                      )}
                      <span className="tabular-nums">{formatDate(m.date)}</span>
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
            <SectionHead
              eyebrow="Their season"
              title={`Schedule (${completed.length} completed)`}
            />
            <ul className="surface pm-reveal overflow-hidden">
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
                    className={cn(
                      TR,
                      "flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 sm:px-6",
                      isVsUs && TR_OURS,
                    )}
                  >
                    <Link
                      href={matchHref}
                      className="flex min-w-[min(100%,15rem)] flex-1 items-center gap-3"
                    >
                      {/* Their perspective: their W reads as bad news (red). */}
                      <span
                        className={cn(
                          DISPLAY,
                          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full pt-px text-base leading-none ring-1 ring-inset",
                          won &&
                            "bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)] ring-[var(--color-pop-bright)]/35",
                          lost &&
                            "bg-[var(--color-felt-bright)]/15 text-[var(--color-felt-text)] ring-[var(--color-felt-bright)]/40",
                          tied &&
                            "bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)] ring-[var(--color-brass)]/40",
                          !won && !lost && !tied && "bg-white/5 text-[var(--color-cream)]/45 ring-white/10",
                        )}
                      >
                        {won ? "W" : lost ? "L" : tied ? "T" : "—"}
                      </span>
                      <WeekTag week={m.week} />
                      <span className="min-w-0 truncate text-[var(--color-cream)]/85">
                        <span className="pm-serif text-[var(--color-cream)]/45">vs</span>{" "}
                        <span className="font-semibold text-[var(--color-cream)]">{m.opponent}</span>
                      </span>
                      {isVsUs && (
                        <span className="shrink-0 rounded-full bg-[var(--color-brass)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-brass-bright)] ring-1 ring-inset ring-[var(--color-brass)]/35">
                          vs us
                        </span>
                      )}
                    </Link>
                    <span className="ml-10 flex items-baseline gap-3 sm:ml-0">
                      <Link
                        href={matchHref}
                        className={cn(
                          DISPLAY,
                          "text-xl leading-none tabular-nums transition-opacity hover:opacity-80",
                          won && "text-[var(--color-pop-bright)]",
                          lost && "text-[var(--color-felt-text)]",
                          tied && "text-[var(--color-brass-bright)]",
                          !won && !lost && !tied && "text-[var(--color-cream)]/40",
                        )}
                        title="View this match"
                      >
                        {m.teamScore ?? "-"}–{m.opponentScore ?? "-"}
                      </Link>
                      {linkedOpp && (
                        <Link
                          href={`/opponents/${linkedOpp.id}`}
                          className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brass)] hover:text-[var(--color-brass-bright)]"
                          title={`View ${m.opponent}`}
                        >
                          team →
                        </Link>
                      )}
                      <span className="w-[5.5rem] text-right text-xs tabular-nums text-[var(--color-cream)]/45">
                        {formatDate(m.date)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="flex flex-wrap items-center gap-x-2 border-t border-[var(--color-cream)]/[0.07] pt-5 text-xs text-[var(--color-cream)]/45">
          Last fetched {formatDate(team.lastFetched)} ·{" "}
          {team.url && (
            <a
              href={team.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-brass)] hover:text-[var(--color-brass-bright)] hover:underline"
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

function WeekTag({ week }: { week?: number }) {
  return (
    <span className="w-9 shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/40 tabular-nums">
      Wk{week ?? "?"}
    </span>
  );
}

function Highlight({
  icon,
  eyebrow,
  title,
  href,
  lines,
  tone,
  index = 0,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  href: string | null;
  lines: string[];
  tone: "brass" | "pop" | "felt";
  index?: number;
}) {
  const accent =
    tone === "brass"
      ? "text-[var(--color-brass-bright)]"
      : tone === "pop"
        ? "text-[var(--color-pop-bright)]"
        : "text-[var(--color-felt-text)]";
  const glow =
    tone === "brass"
      ? "rgba(224,190,107,0.2)"
      : tone === "pop"
        ? "rgba(232,82,72,0.18)"
        : "rgba(46,139,87,0.22)";
  const inner = (
    <div
      className={cn(
        "pm-glass fade-in-up relative h-full overflow-hidden p-5 sm:p-6",
        href && "pm-lift",
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {href && <span className="pm-sheen" />}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full"
        style={{ background: `radial-gradient(circle, ${glow}, transparent 70%)` }}
      />
      <span aria-hidden className="absolute right-5 top-5 text-2xl opacity-90">
        {icon}
      </span>
      <p className={cn("relative text-[10px] font-semibold uppercase tracking-[0.3em]", accent)}>
        {eyebrow}
      </p>
      <p className={`${DISPLAY} relative mt-2 pr-8 text-3xl leading-[0.95] text-[var(--color-cream)]`}>
        {title}
      </p>
      <div className="relative mt-3 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-cream)]/55">
        {lines.map((line, i) => (
          <span key={i} className="tabular-nums">
            {i > 0 && <span className="mr-3 text-[var(--color-cream)]/20">·</span>}
            {line}
          </span>
        ))}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
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
  if (!r) return <span className="text-[var(--color-cream)]/40">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 ring-1 ring-inset",
        r.outcome === "W" &&
          "bg-[var(--color-felt-bright)]/12 text-[var(--color-felt-text)] ring-[var(--color-felt-bright)]/35",
        r.outcome === "L" &&
          "bg-[var(--color-pop)]/12 text-[var(--color-pop-bright)] ring-[var(--color-pop-bright)]/30",
        r.outcome === "T" &&
          "bg-[var(--color-brass)]/12 text-[var(--color-brass-bright)] ring-[var(--color-brass)]/35",
      )}
    >
      <span className="text-[10px] font-bold">{r.outcome}</span>
      <span className={`${DISPLAY} text-base leading-none tabular-nums`}>{r.score}</span>
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
    <li className="surface surface-hover group relative">
      <Link href={`/players/${player.id}`} className="block p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className={`${DISPLAY} block truncate text-2xl leading-none text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)]`}
            >
              {player.name}
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {trend === "hot" && (
                <span className="rounded-full bg-[var(--color-pop)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-pop-bright)] ring-1 ring-inset ring-[var(--color-pop-bright)]/25">
                  🔥 Hot
                </span>
              )}
              {trend === "cold" && (
                <span className="rounded-full bg-[var(--color-felt)]/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-felt-text)] ring-1 ring-inset ring-[var(--color-felt-bright)]/30">
                  ❄️ Cold
                </span>
              )}
              {sessionRec?.matchesPlayed ? (
                <span className="text-[11px] tabular-nums text-[var(--color-cream)]/55">
                  {sessionRec.wins ?? 0}/{sessionRec.matchesPlayed} this session
                  {sessionRec.winPct != null && ` · ${sessionRec.winPct}%`}
                </span>
              ) : null}
            </div>
          </div>
          {player.skillLevel != null && (
            <span className="flex shrink-0 flex-col items-center gap-1" title={`SL${player.skillLevel}`}>
              <PoolBall
                number={player.skillLevel}
                size={38}
                className="drop-shadow-[0_8px_10px_rgba(0,0,0,0.55)]"
              />
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/45">
                SL{player.skillLevel}
              </span>
            </span>
          )}
        </div>
        {player.career && player.career.matchesPlayed > 0 && (
          <p className="mt-3 text-[11px] text-[var(--color-cream)]/50">
            Career:{" "}
            <span className={`${DISPLAY} text-base leading-none tabular-nums text-[var(--color-cream)]`}>
              {player.career.wins}–{player.career.losses}
            </span>{" "}
            ({player.career.winPct}%) over {player.career.matchesPlayed} matches
          </p>
        )}
        {trajectory.length > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-cream)]/[0.07] pt-3">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--color-cream)]/40">
              SL trajectory
            </span>
            <div className="flex items-center gap-1">
              {trajectory.map((s, i) => {
                const isCurrent =
                  currentSessionId != null && s.sessionId === currentSessionId;
                return (
                  <span
                    key={`${s.sessionId}-${i}`}
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[10px] font-semibold tabular-nums",
                      isCurrent
                        ? "bg-[var(--color-brass)]/20 text-[var(--color-brass-bright)] ring-1 ring-inset ring-[var(--color-brass)]"
                        : "text-[var(--color-cream)]/50 ring-1 ring-inset ring-white/10",
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
