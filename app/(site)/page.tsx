import Link from "next/link";
import { ArrowRight, Calendar as CalendarIcon, Crown, Flame, Snowflake, Star } from "lucide-react";
import { Hero } from "@/components/hero/Hero";
import { HomeSection } from "@/components/home/HomeSection";
import { PointerSheen } from "@/components/home/PointerSheen";
import { ResultsTicker } from "@/components/home/ResultsTicker";
import { Logo } from "@/components/brand/Logo";
import { Countdown } from "@/components/home/Countdown";
import { RackArt } from "@/components/home/RackArt";
import { TiltCard } from "@/components/home/TiltCard";
import { PoolBall } from "@/components/brand/PoolBall";
import { LiveCTA } from "@/components/live/LiveCTA";
import { Sparkline } from "@/components/leaderboard/Sparkline";
import { MomentumStrip } from "@/components/home/MomentumStrip";
import { TrainingTodayCard } from "@/components/home/TrainingTodayCard";
import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import {
  getLastUpdated,
  getLeaderboard,
  getRoster,
  getStandings,
  getTeam,
} from "@/lib/apa";
import { loadSnapshot } from "@/lib/apa/client";
import {
  currentTeamStreak,
  hotColdPlayers,
  playerPointsTrajectories,
  teamMomentum,
} from "@/lib/research";
import { matchBreakdown, matchMvp, matchRecap } from "@/lib/recap";
import { ChalkTalk } from "@/components/cards/ChalkTalk";
import { SITE_TIME_ZONE, formatDate, isPoolNightLive, nextPoolNightStart } from "@/lib/utils";
import { SITE_DESCRIPTION, SITE_NAME, SITE_OG_IMAGE, SITE_TITLE, siteJsonLd } from "@/lib/site";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  // The whole object, not just `url`: Next replaces `openGraph` wholesale.
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [SITE_OG_IMAGE],
  },
};

export default async function HomePage() {
  const [team, roster, leaderboard, standings, lastUpdated, snap] =
    await Promise.all([
      getTeam(),
      getRoster(),
      getLeaderboard(),
      getStandings(),
      getLastUpdated(),
      loadSnapshot(),
    ]);

  const ourStanding = standings.find((s) => s.isOurs);
  const upcoming = team?.upcomingMatch ?? null;
  const recent = team?.recentMatches ?? [];
  const lastCompleted = recent[0] ?? null;
  const recapText = lastCompleted ? matchRecap(lastCompleted) : null;
  const lastMvp = lastCompleted ? matchMvp(lastCompleted) : null;
  const lastBreakdown = lastCompleted ? matchBreakdown(lastCompleted) : null;
  const dataReady = !!team && roster.length > 0;
  // Treat rank 0 as "no rank yet" — APA fills standings after the first
  // match week. Pass undefined so the Hero renders a dash.
  const rawRank = ourStanding?.rank ?? team?.divisionRank;
  const divisionRank =
    typeof rawRank === "number" && rawRank > 0 ? rawRank : undefined;

  // Tonight banner — live or within ~36h of pool night.
  const now = new Date();
  const isLive = isPoolNightLive(now);
  const nextStart = isLive ? null : nextPoolNightStart(now);
  const hoursUntilPoolNight = nextStart
    ? (nextStart.getTime() - now.getTime()) / (60 * 60 * 1000)
    : Infinity;
  const showTonightBanner = isLive || hoursUntilPoolNight < 36;

  // Top-5 with per-player sparkline trajectories (last 10 matches).
  const topFive = leaderboard.slice(0, 5);
  const sparklineMatches = Object.values(snap.matches).filter(
    (m) =>
      m.sessionId !== undefined &&
      m.sessionId === snap.currentSession?.id,
  );
  const trajectories = playerPointsTrajectories(
    sparklineMatches,
    topFive.map((r) => r.playerId),
    10,
  );

  // Momentum strip — last 10 outcomes; pull from broadest match pool so it
  // doesn't blank out at session-start when current session has 0 matches.
  const allMatches = Object.values(snap.matches).filter((m) =>
    snap.sessions.some((s) => s.id === m.sessionId),
  );
  const momentum = teamMomentum(allMatches, 10);
  const streak = currentTeamStreak(allMatches);

  // Spotlight: hottest player (≥+15 delta), or coldest if no clear hot, with
  // the recent-vs-baseline numbers for narrative weight.
  const trends = hotColdPlayers(allMatches, roster);
  const hottest = trends.find((t) => t.status === "hot" && t.recentMatches >= 5);
  const coldest =
    !hottest && trends.find((t) => t.status === "cold" && t.recentMatches >= 5);
  const spotlight = hottest ?? coldest ?? null;

  // Section numerals follow render order, so conditional sections never
  // leave a gap in the 01, 02, 03… sequence.
  let sectionNo = 0;
  const nextIndex = () => String(++sectionNo).padStart(2, "0");

  const lastOutcome =
    lastCompleted &&
    typeof lastCompleted.teamScore === "number" &&
    typeof lastCompleted.opponentScore === "number"
      ? lastCompleted.teamScore > lastCompleted.opponentScore
        ? "W"
        : lastCompleted.teamScore < lastCompleted.opponentScore
          ? "L"
          : "T"
      : null;

  const [leader, ...chasers] = topFive;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd()).replace(/</g, "\\u003c") }}
      />
      <PointerSheen />
      <Hero
        record={team?.record ?? { wins: 0, losses: 0 }}
        division={team?.division}
        homeLocation={team?.homeLocation}
        session={team?.session}
        nextMatch={upcoming}
        divisionRank={divisionRank}
        divisionSize={standings.length || undefined}
      />

      <ResultsTicker chips={momentum} />

      {!dataReady && (
        <HomeSection>
          <div className="pm-glass flex items-center gap-3 p-6 text-sm text-[var(--fg-dim)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-brass)]" />
            APA data hasn&apos;t synced yet — run{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
              npm run scrape
            </code>{" "}
            to populate the team page.
          </div>
        </HomeSection>
      )}

      {/* Match night — a fight card when pool night is live or within 36h. */}
      {showTonightBanner && upcoming && (
        <HomeSection className="!pb-0">
          <Link
            href="/research?tab=briefing"
            className="pm-glass pm-lift pm-grain group relative block overflow-hidden"
          >
            <span className="pm-sheen" />
            <div className="pm-felt absolute inset-0 -z-10 opacity-70" aria-hidden />
            <div className="pm-lamp absolute inset-0 -z-10" aria-hidden />

            <div className="relative z-[2] px-5 pb-6 pt-5 sm:px-10 sm:pb-9 sm:pt-7">
              <div className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.34em] text-[var(--color-pop-bright)] sm:text-[11px]">
                {isLive ? (
                  <>
                    <span className="inline-block h-2 w-2 animate-pulse-pop rounded-full bg-[var(--color-pop-bright)]" />
                    Live now
                  </>
                ) : (
                  <>
                    <CalendarIcon size={12} />
                    {hoursUntilPoolNight < 12 ? "Match night · Tonight" : "Match night · Tomorrow"}
                  </>
                )}
              </div>

              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
                <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-end sm:gap-4 sm:text-right">
                  <p className="order-2 font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide text-[var(--color-cream)] sm:order-1 sm:text-5xl">
                    Top Dawgs
                  </p>
                  <span className="order-1 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)] sm:order-2">
                    <Logo size={72} className="!h-14 !w-14 sm:!h-[72px] sm:!w-[72px]" />
                  </span>
                </div>
                <span className="pm-foil font-[family-name:var(--font-display)] text-5xl leading-none sm:text-8xl">
                  VS
                </span>
                <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-4 sm:text-left">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--color-cream)]/15 bg-black/40 font-[family-name:var(--font-display)] text-2xl text-[var(--color-cream)]/80 sm:h-[72px] sm:w-[72px] sm:text-3xl">
                    {initials(upcoming.opponent)}
                  </span>
                  <p className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide text-[var(--color-cream)] sm:text-5xl">
                    {upcoming.opponent}
                  </p>
                </div>
              </div>

              <div className="mt-7 flex justify-center">
                <Countdown target={upcoming.date} />
              </div>

              <div className="mt-7 flex flex-col items-center gap-4 border-t border-[var(--color-cream)]/10 pt-5 sm:flex-row sm:justify-between">
                <p className="text-center text-sm text-[var(--color-cream)]/70 sm:text-left">
                  {formatDate(upcoming.date)} ·{" "}
                  {new Date(upcoming.date).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: SITE_TIME_ZONE,
                  })}
                  {upcoming.location && ` · ${upcoming.location}`}
                </p>
                <span className="pm-btn">
                  Pre-match briefing
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        </HomeSection>
      )}

      {momentum.length > 0 && (
        <HomeSection index={nextIndex()} eyebrow="Form guide" title="Momentum">
          <MomentumStrip chips={momentum} streak={streak} />
        </HomeSection>
      )}

      {/* Last match — scoreboard recap, MVP and the player-watch spotlight
          as one bento grid. */}
      {recapText && lastCompleted && (
        <HomeSection index={nextIndex()} eyebrow="Last match" title="The Recap">
          <div className="grid gap-4 lg:grid-cols-3">
            <Link
              href={`/matches/${lastCompleted.id}`}
              className={`pm-glass pm-lift group relative block overflow-hidden p-6 sm:p-8 ${lastMvp ? "lg:col-span-2" : "lg:col-span-3"}`}
            >
              <span className="pm-sheen" />
              <div className="flex flex-wrap items-center gap-3">
                {lastOutcome && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] ${
                      lastOutcome === "W"
                        ? "bg-[var(--color-felt-bright)]/15 text-[var(--color-felt-bright)]"
                        : lastOutcome === "L"
                          ? "bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]"
                          : "bg-[var(--color-tie)]/15 text-[var(--color-tie-bright)]"
                    }`}
                  >
                    {lastOutcome === "W" ? "Win" : lastOutcome === "L" ? "Loss" : "Tie"}
                  </span>
                )}
                <span className="text-[11px] uppercase tracking-[0.24em] text-[var(--color-cream)]/50">
                  {formatDate(lastCompleted.date)}
                </span>
              </div>

              {typeof lastCompleted.teamScore === "number" &&
                typeof lastCompleted.opponentScore === "number" && (
                  <div className="mt-5 flex items-end gap-5 sm:gap-8">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
                        Top Dawgs
                      </p>
                      <p
                        className={`font-[family-name:var(--font-display)] text-7xl leading-[0.85] tabular-nums sm:text-8xl ${
                          lastOutcome === "W" ? "pm-foil" : "text-[var(--color-cream)]"
                        }`}
                      >
                        {lastCompleted.teamScore}
                      </p>
                    </div>
                    <span className="mb-6 font-[family-name:var(--font-display)] text-3xl text-[var(--color-cream)]/25">–</span>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/50">
                        {lastCompleted.opponent}
                      </p>
                      <p
                        className={`font-[family-name:var(--font-display)] text-7xl leading-[0.85] tabular-nums sm:text-8xl ${
                          lastOutcome === "L" ? "pm-foil" : "text-[var(--color-cream)]/45"
                        }`}
                      >
                        {lastCompleted.opponentScore}
                      </p>
                    </div>
                  </div>
                )}

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--color-cream)]/85 sm:text-lg">
                {recapText}
              </p>
              <p className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brass-bright)]">
                Read the scoresheet
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
              </p>
            </Link>

            {lastMvp && (
              <TiltCard className="h-full">
                <div className="pm-glass relative h-full overflow-hidden p-6 sm:p-8">
                  <div
                    className="absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_100%_0%,rgba(224,190,107,0.28),transparent_60%),radial-gradient(70%_60%_at_0%_100%,rgba(46,139,87,0.25),transparent_60%)]"
                    aria-hidden
                  />
                  <span className="pm-etch" aria-hidden />
                  <span className="pm-holo" aria-hidden />
                  {/* inner foil frame, like a collector card */}
                  <span
                    className="pointer-events-none absolute inset-3 rounded-[0.9rem] border border-[var(--color-brass)]/30"
                    aria-hidden
                  />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between">
                      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass-bright)]">
                        <Star size={12} fill="currentColor" /> Match MVP
                      </p>
                      <span className="flex h-14 w-14 rotate-[-10deg] flex-col items-center justify-center rounded-full border-2 border-[var(--color-brass-bright)]/70 bg-black/30 text-center leading-none text-[var(--color-brass-bright)] shadow-[0_0_20px_rgba(224,190,107,0.35)]">
                        <Star size={14} fill="currentColor" />
                        <span className="mt-0.5 font-[family-name:var(--font-display)] text-sm tracking-[0.15em]">MVP</span>
                      </span>
                    </div>
                    <p className="pm-serif mt-2 text-lg text-[var(--color-cream)]/60">
                      Player of the night
                    </p>
                    <p className="pm-foil font-[family-name:var(--font-display)] text-5xl leading-[0.9] tracking-wide sm:text-6xl">
                      {lastMvp.playerName}
                    </p>
                    {lastMvp.score && (
                      <p className="mt-3 font-[family-name:var(--font-display)] text-3xl tracking-wider tabular-nums text-[var(--color-cream)]/80">
                        {lastMvp.score}
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-6">
                      {lastMvp.sweep && <Badge tone="pop">Sweep</Badge>}
                      {!lastMvp.sweep && lastMvp.miniSweep && <Badge tone="brass">Mini sweep</Badge>}
                      {lastMvp.breakAndRun && <Badge tone="felt">Break &amp; run</Badge>}
                      {lastMvp.eightOnBreak && <Badge tone="cream">8 on the break</Badge>}
                    </div>
                  </div>
                </div>
              </TiltCard>
            )}

            {spotlight && (
              <Link
                href={`/roster/${spotlight.playerId}`}
                className="pm-glass pm-lift group relative block overflow-hidden p-6 sm:p-8 lg:col-span-3"
              >
                <span className="pm-sheen" />
                <div className="absolute -right-6 -top-6 opacity-10" aria-hidden>
                  {spotlight.status === "hot" ? (
                    <Flame size={180} className="text-[var(--color-brass-bright)]" />
                  ) : (
                    <Snowflake size={180} className="text-[var(--color-pop-bright)]" />
                  )}
                </div>
                <div className="relative grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p
                      className={`text-[10px] font-semibold uppercase tracking-[0.32em] ${
                        spotlight.status === "hot"
                          ? "text-[var(--color-brass)]"
                          : "text-[var(--color-pop)]"
                      }`}
                    >
                      Player watch · {spotlight.status === "hot" ? "Heating up" : "Cooling off"}
                    </p>
                    <h3 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-wide text-[var(--color-cream)] sm:text-5xl">
                      {spotlight.playerName}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-cream)]/75">
                      Winning at{" "}
                      <span className="font-semibold text-[var(--color-cream)]">
                        {spotlight.recentWinPct}%
                      </span>{" "}
                      over the last {spotlight.recentMatches} matches, against a career
                      baseline of {spotlight.baselineWinPct}%.
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p
                      className={`font-[family-name:var(--font-display)] text-7xl leading-none tracking-wide tabular-nums ${
                        spotlight.status === "hot"
                          ? "text-[var(--color-felt-bright)]"
                          : "text-[var(--color-pop-bright)]"
                      }`}
                    >
                      {spotlight.delta > 0 ? "+" : ""}
                      {spotlight.delta}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[var(--color-cream)]/50">
                      pts vs baseline
                    </p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </HomeSection>
      )}

      {/* Chalk Talk — coach's-corner breakdown of the last match: what
          worked, what didn't, what to take into next week. Compact mode
          on the home page; full version on /matches/[id]. */}
      {lastBreakdown && lastCompleted && (
        <HomeSection index={nextIndex()} eyebrow="Chalk talk" title="Coach's Corner">
          <Link
            href={`/matches/${lastCompleted.id}#chalk-talk`}
            className="block transition-transform duration-300 hover:-translate-y-1"
          >
            <ChalkTalk breakdown={lastBreakdown} compact />
          </Link>
        </HomeSection>
      )}

      {/* Ladder — the leader gets a featured card, the chasers a ranked list. */}
      {leader && (
        <HomeSection
          index={nextIndex()}
          eyebrow="Leaderboard"
          title="The Ladder"
          action={
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brass)] hover:text-[var(--color-brass-bright)]"
            >
              Full board <ArrowRight size={14} />
            </Link>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
            <TiltCard className="h-full" max={5}>
            <Link
              href={`/roster/${leader.playerId}`}
              className="pm-glass group relative flex h-full flex-col overflow-hidden p-6 sm:p-8"
            >
              <span className="pm-etch" aria-hidden />
              <span className="pm-holo" aria-hidden />
              <div
                className="absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_20%_0%,rgba(224,190,107,0.2),transparent_65%)]"
                aria-hidden
              />
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brass)]/40 bg-[var(--color-brass)]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
                  <Crown size={12} /> Top dawg
                </span>
                <PoolBall number={1} size={52} className="drop-shadow-[0_10px_16px_rgba(0,0,0,0.6)]" />
              </div>
              <p className="pm-serif mt-6 text-lg text-[var(--color-cream)]/60">
                Leading the ladder
              </p>
              <p className="font-[family-name:var(--font-display)] text-5xl leading-[0.9] tracking-wide text-[var(--color-cream)] sm:text-6xl">
                {leader.playerName}
              </p>
              <p className="mt-2 text-sm text-[var(--color-cream)]/60">
                {leader.wins}/{leader.matchesPlayed} wins
                {leader.sweeps > 0 && (
                  <> · {leader.sweeps} sweep{leader.sweeps === 1 ? "" : "s"}</>
                )}
                {leader.miniSweeps > 0 && <> · {leader.miniSweeps} mini</>}
              </p>
              <div className="mt-auto flex items-end justify-between gap-4 pt-8">
                <div>
                  <p className="pm-foil font-[family-name:var(--font-display)] text-7xl leading-none tabular-nums">
                    {leader.points}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--color-cream)]/50">
                    points
                  </p>
                </div>
                <Sparkline
                  points={trajectories.get(leader.playerId) ?? [0]}
                  tone="brass"
                  width={150}
                  height={48}
                  ariaLabel={`${leader.playerName} points trajectory over last 10 matches`}
                />
              </div>
            </Link>
            </TiltCard>

            {chasers.length > 0 && (
              <ol className="pm-glass flex flex-col overflow-hidden p-2">
                {chasers.map((row, i) => {
                  const rank = i + 2;
                  const series = trajectories.get(row.playerId) ?? [0];
                  return (
                    <li key={row.playerId} className="flex-1">
                      <Link
                        href={`/roster/${row.playerId}`}
                        className="group flex h-full items-center gap-4 rounded-2xl px-4 py-4 transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="w-7 shrink-0 text-center font-[family-name:var(--font-display)] text-3xl leading-none text-[var(--color-cream)]/35 tabular-nums">
                          {rank}
                        </span>
                        <PoolBall number={rank} size={34} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-medium text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)]">
                            {row.playerName}
                          </p>
                          <p className="text-xs text-[var(--color-cream)]/50">
                            {row.wins}/{row.matchesPlayed} W
                            {row.sweeps > 0 && (
                              <> · <span className="text-[var(--color-pop-bright)]">{row.sweeps}</span> sweep{row.sweeps === 1 ? "" : "s"}</>
                            )}
                            {row.miniSweeps > 0 && <> · {row.miniSweeps} mini</>}
                          </p>
                        </div>
                        <Sparkline
                          points={series}
                          tone={rank <= 3 ? "felt" : "pop"}
                          width={96}
                          height={30}
                          ariaLabel={`${row.playerName} points trajectory over last 10 matches`}
                          className="hidden shrink-0 sm:block"
                        />
                        <div className="w-12 shrink-0 text-right">
                          <div className="font-[family-name:var(--font-display)] text-3xl leading-none tabular-nums text-[var(--color-brass-bright)]">
                            {row.points}
                          </div>
                          <div className="text-[9px] uppercase tracking-[0.24em] text-[var(--color-cream)]/40">
                            pts
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </HomeSection>
      )}

      {/* Training corner — surface practice streak + due drill. */}
      <HomeSection index={nextIndex()} eyebrow="Training" title="Today's Drill">
        <TrainingTodayCard shots={[...KINISTER_SHOTS]} />
      </HomeSection>

      {/* Finale — the live-stream invite, set on felt under the lamp. */}
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pb-14 lg:px-8">
        <div className="pm-grain pm-reveal relative overflow-hidden rounded-[1.75rem] border border-[var(--color-brass)]/25 shadow-[0_40px_120px_-40px_rgba(46,139,87,0.6)]">
          <div className="pm-felt absolute inset-0 -z-10" aria-hidden />
          <div className="pm-lamp pm-lamp-flicker absolute inset-0 -z-10" aria-hidden />
          <div className="relative z-[2] grid items-center gap-10 px-6 py-12 sm:px-12 sm:py-16 lg:grid-cols-[1fr_auto]">
            <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[var(--color-brass-bright)] sm:text-[11px]">
              Every Tuesday · 7:30 – 11:30pm
            </p>
            <h3 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-5xl leading-[0.9] tracking-wide text-[var(--color-cream)] sm:text-7xl">
              Pull up a stool.
              <span className="block">
                <span className="pm-serif mr-3 text-[0.8em] text-[var(--color-cream)]/80">we&apos;re</span>
                <span className="pm-foil">Live.</span>
              </span>
            </h3>
            <p className="mt-4 max-w-md text-[var(--color-cream)]/75">
              We stream the table every match night. Drop a comment, cheer the
              Dawgs, sweat the hill-hill racks with us.
            </p>
            <div className="mt-8">
              <LiveCTA />
            </div>
            </div>
            <div className="flex justify-center lg:pr-6">
              {/* One instance, scaled — a second, display:none copy would own
                  the SVG gradient ids and leave the visible one unpainted. */}
              <RackArt ball={46} className="-my-8 rotate-[-8deg] scale-[0.8] sm:my-0 sm:scale-100" />
            </div>
          </div>
        </div>
      </section>

      {lastUpdated && (
        <p className="px-4 text-center text-[11px] uppercase tracking-[0.2em] text-[var(--color-cream)]/35">
          APA data synced{" "}
          <time dateTime={lastUpdated.toISOString()}>
            {lastUpdated.toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </p>
      )}
    </>
  );
}

/** Up-to-two-letter monogram for an opponent with no logo of their own. */
function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "pop" | "brass" | "felt" | "cream";
}) {
  const cls =
    tone === "pop"
      ? "bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]"
      : tone === "brass"
        ? "bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)]"
        : tone === "felt"
          ? "bg-[var(--color-felt)]/30 text-[var(--color-felt-bright)]"
          : "bg-[var(--color-cream)]/15 text-[var(--color-cream)]";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${cls}`}
    >
      {children}
    </span>
  );
}
