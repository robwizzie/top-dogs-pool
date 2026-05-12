import Link from "next/link";
import { ArrowRight, Calendar as CalendarIcon, Flame, Snowflake, Star } from "lucide-react";
import { Hero } from "@/components/hero/Hero";
import { Section } from "@/components/ui/Section";
import { PoolBall } from "@/components/brand/PoolBall";
import { LiveCTA } from "@/components/live/LiveCTA";
import { Sparkline } from "@/components/leaderboard/Sparkline";
import { MomentumStrip } from "@/components/home/MomentumStrip";
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
import { matchMvp, matchRecap } from "@/lib/recap";
import { formatDate, isPoolNightLive, nextPoolNightStart } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

  return (
    <>
      <Hero
        record={team?.record ?? { wins: 0, losses: 0 }}
        division={team?.division}
        homeLocation={team?.homeLocation}
        nextOpponent={upcoming?.opponent}
        divisionRank={divisionRank}
        divisionSize={standings.length || undefined}
      />

      {momentum.length > 0 && (
        <Section className="!pb-0 !pt-8 sm:!pt-10">
          <MomentumStrip chips={momentum} streak={streak} />
        </Section>
      )}

      {!dataReady && (
        <Section>
          <div className="surface flex items-center gap-3 p-6 text-sm text-[var(--fg-dim)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-brass)]" />
            APA data hasn&apos;t synced yet — run{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
              npm run scrape
            </code>{" "}
            to populate the team page.
          </div>
        </Section>
      )}

      {/* Tonight — the headline when match night is live or within 36h. */}
      {showTonightBanner && upcoming && (
        <Section>
          <Link
            href="/research?tab=briefing"
            className="surface surface-hover relative block overflow-hidden p-6"
          >
            <div className="absolute -right-8 -top-8 opacity-15">
              <PoolBall number={8} size={180} />
            </div>
            <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-pop-bright)]">
                  {isLive ? (
                    <>
                      <span className="inline-block h-2 w-2 animate-pulse-pop rounded-full bg-[var(--color-pop-bright)]" />
                      Tonight · Live
                    </>
                  ) : hoursUntilPoolNight < 12 ? (
                    <>
                      <CalendarIcon size={12} /> Match Night Tonight
                    </>
                  ) : (
                    <>
                      <CalendarIcon size={12} /> Match Night Tomorrow
                    </>
                  )}
                </div>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">
                  vs <span className="text-[var(--color-brass-bright)]">{upcoming.opponent}</span>
                </p>
                <p className="mt-1 text-sm text-[var(--fg-dim)]">
                  {formatDate(upcoming.date)} at{" "}
                  {new Date(upcoming.date).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {upcoming.location && ` · ${upcoming.location}`}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 self-start rounded-full bg-[var(--color-brass)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] sm:self-auto">
                Pre-match briefing <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        </Section>
      )}

      {/* Last — the most recent completed match, narrated, with MVP. */}
      {recapText && lastCompleted && (
        <Section eyebrow="Last Match" title="Recap">
          <Link
            href={`/matches/${lastCompleted.id}`}
            className="surface surface-hover block overflow-hidden"
          >
            <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
              <div className="p-6 lg:p-7">
                <div className="mb-3 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
                  vs {lastCompleted.opponent}
                  {typeof lastCompleted.teamScore === "number" &&
                    typeof lastCompleted.opponentScore === "number" && (
                      <span className="font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--color-brass-bright)]">
                        {lastCompleted.teamScore}–{lastCompleted.opponentScore}
                      </span>
                    )}
                </div>
                <p className="text-base leading-relaxed">{recapText}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.28em] text-[var(--color-brass)]">
                  Read the scoresheet →
                </p>
              </div>
              {lastMvp && (
                <aside className="border-t border-[var(--border)] bg-[var(--bg-soft)] p-6 lg:border-l lg:border-t-0 lg:p-7">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass-bright)]">
                    <Star size={12} fill="currentColor" /> Match MVP
                  </div>
                  <p className="mt-2 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-cream)]">
                    {lastMvp.playerName}
                  </p>
                  {lastMvp.score && (
                    <p className="mt-1 text-sm tabular-nums text-[var(--fg-dim)]">
                      {lastMvp.score}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {lastMvp.sweep && (
                      <Badge tone="pop">SWEEP</Badge>
                    )}
                    {!lastMvp.sweep && lastMvp.miniSweep && (
                      <Badge tone="brass">MINI</Badge>
                    )}
                    {lastMvp.breakAndRun && (
                      <Badge tone="felt">B&amp;R</Badge>
                    )}
                    {lastMvp.eightOnBreak && (
                      <Badge tone="cream">8oB</Badge>
                    )}
                  </div>
                </aside>
              )}
            </div>
          </Link>
        </Section>
      )}

      {/* Spotlight — auto-derived "hot" or "cold" player narrative. */}
      {spotlight && (
        <Section eyebrow="Player Watch" title="Spotlight">
          <Link
            href={`/roster/${spotlight.playerId}`}
            className={`surface surface-hover relative block overflow-hidden p-6 sm:p-7 ${spotlight.status === "hot" ? "" : ""}`}
          >
            <div className="absolute -right-6 -top-6 opacity-15" aria-hidden>
              {spotlight.status === "hot" ? (
                <Flame size={140} className="text-[var(--color-brass-bright)]" />
              ) : (
                <Snowflake size={140} className="text-[var(--color-pop-bright)]" />
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
                  {spotlight.status === "hot" ? "🔥 Heating Up" : "❄️ Cooling Off"}
                </p>
                <h3 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">
                  {spotlight.playerName}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--fg)]">
                  Over the last {spotlight.recentMatches} matches, winning at{" "}
                  <span className="font-semibold text-[var(--color-cream)]">
                    {spotlight.recentWinPct}%
                  </span>{" "}
                  vs. a career baseline of{" "}
                  <span className="text-[var(--fg-dim)]">{spotlight.baselineWinPct}%</span>
                  {" — "}
                  {spotlight.status === "hot" ? "trending up." : "trending down."}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`font-[family-name:var(--font-display)] text-5xl tracking-wide tabular-nums ${
                    spotlight.status === "hot"
                      ? "text-[var(--color-felt-bright)]"
                      : "text-[var(--color-pop-bright)]"
                  }`}
                >
                  {spotlight.delta > 0 ? "+" : ""}
                  {spotlight.delta}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                  vs baseline
                </p>
              </div>
            </div>
          </Link>
        </Section>
      )}

      {/* Ladder — top 5 with sparkline trajectories. */}
      {topFive.length > 0 && (
        <Section
          eyebrow="Leaderboard"
          title="The Ladder"
          action={
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brass)] hover:text-[var(--color-brass-bright)]"
            >
              Full leaderboard <ArrowRight size={14} />
            </Link>
          }
        >
          <ol className="surface divide-y divide-[var(--border)]">
            {topFive.map((row, i) => {
              const series = trajectories.get(row.playerId) ?? [0];
              const tone = i === 0 ? "brass" : i < 3 ? "felt" : "pop";
              return (
                <li key={row.playerId} className="flex items-center gap-4 p-4">
                  <span className="w-6 shrink-0 text-center font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-brass-bright)]">
                    {i + 1}
                  </span>
                  <PoolBall number={(i % 7) + 1} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/roster/${row.playerId}`}
                      className="block truncate text-base font-medium hover:text-[var(--color-brass)]"
                    >
                      {row.playerName}
                    </Link>
                    <p className="text-xs text-[var(--fg-dim)]">
                      {row.wins}/{row.matchesPlayed} W
                      {row.sweeps > 0 && (
                        <> · <span className="text-[var(--color-pop-bright)]">{row.sweeps}</span> sweep{row.sweeps === 1 ? "" : "s"}</>
                      )}
                      {row.miniSweeps > 0 && (
                        <> · {row.miniSweeps} mini</>
                      )}
                    </p>
                  </div>
                  <Sparkline
                    points={series}
                    tone={tone}
                    width={84}
                    height={28}
                    ariaLabel={`${row.playerName} points trajectory over last 10 matches`}
                    className="hidden shrink-0 sm:block"
                  />
                  <div className="shrink-0 text-right">
                    <div className="font-[family-name:var(--font-display)] text-2xl tracking-wide tabular-nums text-[var(--color-brass-bright)]">
                      {row.points}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                      pts
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {/* TikTok / live CTA — team identity moment. */}
      <Section className="!pb-24" contentClassName="">
        <div className="surface relative flex flex-col items-start gap-4 overflow-hidden p-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="absolute -right-10 -top-10 opacity-15">
            <PoolBall number={8} size={220} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              Match nights
            </p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">
              Tuesdays · 7:30 – 11:30pm
            </h3>
            <p className="mt-2 max-w-xl text-[var(--fg-dim)]">
              We stream the table live every match night. Drop a comment, cheer
              the Top Dawgs, hop in chat.
            </p>
          </div>
          <div className="relative">
            <LiveCTA />
          </div>
        </div>
      </Section>

      {lastUpdated && (
        <p className="px-4 pb-10 text-center text-xs text-[var(--fg-dim)]">
          APA data last synced{" "}
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
      className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${cls}`}
    >
      {children}
    </span>
  );
}
