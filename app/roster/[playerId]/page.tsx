import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { StatCounter } from "@/components/ui/StatCounter";
import { YouTubeEmbed } from "@/components/clips/YouTubeEmbed";
import { OutcomeBars } from "@/components/leaderboard/OutcomeBars";
import { StreakBadge } from "@/components/cards/StreakBadge";
import { PoolBall } from "@/components/brand/PoolBall";
import { SessionPicker } from "@/components/leaderboard/SessionPicker";
import { parseSessionScope, resolveScope } from "@/lib/session-scope";
import {
  getCurrentSession,
  getLeaderboard,
  getMatch,
  getPlayer,
  getPlayerHistory,
  getSessions,
} from "@/lib/apa";
import { getClipsForPlayer } from "@/lib/youtube/client";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ session?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { playerId } = await params;
  const { player, profile } = await getPlayer(playerId);
  if (player?.visible === false || profile?.visible === false) {
    return { title: "Player" };
  }
  return { title: player?.name ?? "Player" };
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const [{ playerId }, sp] = await Promise.all([params, searchParams]);
  const [
    { player, profile },
    sessions,
    currentSession,
    clips,
    history,
    currentLeaderboard,
  ] = await Promise.all([
    getPlayer(playerId),
    getSessions(),
    getCurrentSession(),
    getClipsForPlayer(playerId),
    getPlayerHistory(),
    getLeaderboard(),
  ]);
  const playerHistory = history.get(playerId);
  const isTopDog =
    currentLeaderboard.length > 0 &&
    currentLeaderboard[0].playerId === playerId &&
    currentLeaderboard[0].points > 0;
  if (!player) notFound();
  // Hidden players (visible:false) shouldn't have a public profile page.
  if (player.visible === false) notFound();
  if (profile?.visible === false) notFound();

  // Resolve scope using shared helpers (multi-select aware).
  const allIds = sessions.map((s) => s.id);
  const scopeKind = parseSessionScope(sp.session, allIds);
  const selectedIds = resolveScope(scopeKind, allIds, currentSession?.id);
  const isAllSessions = selectedIds.size === allIds.length;
  const isSingle = selectedIds.size === 1;

  // Pick the stat block to display. Career when "all", single-session record
  // when 1 selected, summed across selection when multiple.
  const inScope = (profile?.sessions ?? []).filter((s) =>
    selectedIds.has(s.sessionId),
  );
  const display = (() => {
    if (isAllSessions) {
      return {
        label: "Career",
        matchesPlayed: profile?.career.matchesPlayed ?? 0,
        wins: profile?.career.wins ?? 0,
        losses: profile?.career.losses ?? 0,
        winPct: profile?.career.winPct ?? 0,
        points: profile?.career.points ?? 0,
        sweeps: profile?.career.sweeps ?? 0,
        miniSweeps: profile?.career.miniSweeps ?? 0,
        breakAndRuns: profile?.career.breakAndRuns ?? 0,
        eightOnBreaks: profile?.career.eightOnBreaks ?? 0,
        skillLevel: profile?.currentSkillLevel ?? null,
        pa: undefined as number | undefined,
        ppm: undefined as number | undefined,
        teamLabel: undefined as string | undefined,
      };
    }
    if (isSingle) {
      const s = inScope[0];
      return {
        label: s?.sessionName ?? "Session",
        matchesPlayed: s?.matchesPlayed ?? 0,
        wins: s?.wins ?? 0,
        losses: (s?.matchesPlayed ?? 0) - (s?.wins ?? 0),
        winPct: s?.winPct ?? 0,
        points: s?.points ?? 0,
        sweeps: s?.sweeps ?? 0,
        miniSweeps: s?.miniSweeps ?? 0,
        breakAndRuns: s?.breakAndRuns ?? 0,
        eightOnBreaks: s?.eightOnBreaks ?? 0,
        skillLevel: s?.skillLevel ?? null,
        pa: s?.pa,
        ppm: s?.ppm,
        teamLabel: s?.teamName,
      };
    }
    // Multi-session subset: sum across them.
    let mp = 0,
      w = 0,
      pts = 0,
      sw = 0,
      ms = 0,
      br = 0,
      eob = 0;
    for (const s of inScope) {
      mp += s.matchesPlayed ?? 0;
      w += s.wins ?? 0;
      pts += s.points ?? 0;
      sw += s.sweeps ?? 0;
      ms += s.miniSweeps ?? 0;
      br += s.breakAndRuns ?? 0;
      eob += s.eightOnBreaks ?? 0;
    }
    return {
      label: `${selectedIds.size} sessions combined`,
      matchesPlayed: mp,
      wins: w,
      losses: mp - w,
      winPct: mp ? Math.round((w / mp) * 1000) / 10 : 0,
      points: Math.round(pts * 10) / 10,
      sweeps: sw,
      miniSweeps: ms,
      breakAndRuns: br,
      eightOnBreaks: eob,
      skillLevel: inScope[inScope.length - 1]?.skillLevel ?? null,
      pa: undefined as number | undefined,
      ppm: undefined as number | undefined,
      teamLabel: undefined as string | undefined,
    };
  })();

  const matchHistoryRaw = await getPlayerMatchHistory(playerId, selectedIds);
  const matchHistory = matchHistoryRaw.slice(0, 12);

  const actionImage = profile?.actionImage ?? player.actionImage;
  const profileImage = profile?.profileImage ?? player.profileImage;

  return (
    <>
      {actionImage ? (
        <PlayerHero
          name={player.name}
          format={player.format}
          skillLevel={display.skillLevel ?? null}
          teamLabel={display.teamLabel}
          actionImage={actionImage}
          profileImage={profileImage}
          isTopDog={isTopDog}
        />
      ) : (
        <PageHeader
          eyebrow={
            player.format !== "unknown" ? player.format.toUpperCase() : "Player"
          }
          title={player.name}
          subtitle={
            display.skillLevel
              ? `Skill Level ${display.skillLevel}${
                  display.teamLabel ? ` · ${display.teamLabel}` : ""
                }`
              : display.teamLabel
          }
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/roster"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--fg-dim)] hover:text-[var(--color-brass)]"
        >
          <ArrowLeft size={14} /> Back to roster
        </Link>

        <div className="mb-6">
          <SessionPicker
            basePath={`/roster/${playerId}`}
            sessions={sessions.filter((s) =>
              profile?.sessions.some((ps) => ps.sessionId === s.id),
            )}
            selectedIds={selectedIds}
          />
        </div>

        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            {display.label}
          </h2>
          {playerHistory?.streak && (
            <StreakBadge streak={playerHistory.streak} size="md" />
          )}
          {playerHistory && playerHistory.outcomes.length > 0 && (
            <div className="hidden items-center gap-2 text-[11px] text-[var(--fg-dim)] sm:flex">
              <span>Recent:</span>
              <OutcomeBars outcomes={playerHistory.outcomes} max={10} />
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatedStatTile label="Points" value={display.points} decimals={Number.isInteger(display.points) ? 0 : 1} accent delay={0} />
          <RecordTile wins={display.wins} losses={display.losses} delay={80} />
          <AnimatedStatTile
            label="Win %"
            value={display.matchesPlayed ? display.winPct : 0}
            empty={!display.matchesPlayed}
            suffix="%"
            decimals={1}
            delay={160}
          />
          <AnimatedStatTile label="Sweeps" value={display.sweeps} accent delay={240} />
          <AnimatedStatTile label="Mini-Sweeps" value={display.miniSweeps} delay={320} />
          <AnimatedStatTile label="Break & Runs" value={display.breakAndRuns} delay={400} />
          <AnimatedStatTile label="8 on Break" value={display.eightOnBreaks} delay={480} />
          {display.pa !== undefined ? (
            <AnimatedStatTile label="PA" value={display.pa} suffix="%" delay={560} />
          ) : (
            <AnimatedStatTile label="Matches" value={display.matchesPlayed} delay={560} />
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-xs">
          <Link
            href={`/compare?players=${playerId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1.5 font-semibold uppercase tracking-[0.18em] text-[var(--color-brass-bright)] transition-colors hover:border-[var(--color-brass)] hover:bg-[var(--color-brass)]/10"
          >
            Compare with another player →
          </Link>
        </div>

        {profile && profile.sessions.length > 1 && (
          <section className="mt-12">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide">
              Session History
            </h2>
            <ul className="surface divide-y divide-[var(--border)]">
              {profile.sessions.map((s) => (
                <li
                  key={`${s.sessionId}-${s.teamId}`}
                  className={
                    selectedIds.has(s.sessionId)
                      ? "flex items-center gap-4 bg-[var(--color-felt-deep)]/40 p-4"
                      : "flex items-center gap-4 p-4"
                  }
                >
                  <Link
                    href={`/roster/${playerId}?session=${s.sessionId}`}
                    className="min-w-0 flex-1 hover:text-[var(--color-brass)]"
                  >
                    <p className="truncate text-sm font-medium">
                      {s.sessionName}
                      <span className="text-[var(--fg-dim)]"> · </span>
                      <span className="text-[var(--fg-dim)]">
                        {s.teamName}
                      </span>
                    </p>
                    <p className="text-xs text-[var(--fg-dim)]">
                      {s.skillLevel ? `SL${s.skillLevel} · ` : ""}
                      {s.matchesPlayed ?? 0} matches
                      {s.winPct !== undefined ? ` · ${s.winPct}% win` : ""}
                      {s.points !== undefined && s.points > 0
                        ? ` · ${s.points} pts`
                        : ""}
                    </p>
                  </Link>
                  {s.wins !== undefined && s.matchesPlayed !== undefined && (
                    <span className="text-sm font-medium tabular-nums">
                      {s.wins}
                      <span className="text-[var(--fg-dim)]">/</span>
                      {s.matchesPlayed}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide">
            {isAllSessions ? "Recent Matches (career)" : "Matches"}
          </h2>
          {matchHistory.length === 0 ? (
            <p className="surface p-6 text-sm text-[var(--fg-dim)]">
              No matches with scoresheet results for this scope.
            </p>
          ) : (
            <ul className="surface divide-y divide-[var(--border)]">
              {matchHistory.map(({ match, mine }) => (
                <li key={match.id}>
                  <Link
                    href={`/matches/${match.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-[var(--bg-soft)]"
                  >
                    <PoolBall
                      number={mine.outcome === "W" ? 6 : 8}
                      size={28}
                    />
                    <div className="flex-1 truncate">
                      <p className="text-sm font-medium">
                        vs {match.opponent}
                        {match.sessionName && (
                          <span className="ml-2 text-xs text-[var(--fg-dim)]">
                            {match.sessionName}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--fg-dim)]">
                        {formatDate(match.date)}
                        {mine.score && ` · ${mine.score}`}
                        {mine.skillLevel && ` · SL${mine.skillLevel}`}
                        {mine.opponentSkillLevel && ` vs SL${mine.opponentSkillLevel}`}
                        {mine.sweep && " · SWEEP"}
                        {!mine.sweep && mine.miniSweep && " · MINI"}
                        {mine.breakAndRun && " · B&R"}
                        {mine.eightOnBreak && " · 8 ON BREAK"}
                      </p>
                    </div>
                    <span
                      className={
                        mine.outcome === "W"
                          ? "text-sm font-bold text-[var(--color-felt-bright)]"
                          : "text-sm font-bold text-[var(--color-pop-bright)]"
                      }
                    >
                      {mine.outcome}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {clips.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide">
              Highlight Reel
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clips.map((c, i) => (
                <YouTubeEmbed key={c.id} clip={c} priority={i === 0} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/**
 * Walk the snapshot's matches map for matches in scope where this player
 * has a result row. Newest first.
 */
async function getPlayerMatchHistory(
  playerId: string,
  selectedIds: Set<number>,
): Promise<
  Array<{
    match: NonNullable<Awaited<ReturnType<typeof getMatch>>>;
    mine: NonNullable<
      NonNullable<Awaited<ReturnType<typeof getMatch>>>["results"][number]
    >;
  }>
> {
  const { loadSnapshot } = await import("@/lib/apa/client");
  const snap = await loadSnapshot();
  const out: Array<{
    match: (typeof snap.schedule)[number];
    mine: (typeof snap.schedule)[number]["results"][number];
  }> = [];
  for (const m of Object.values(snap.matches)) {
    if (m.sessionId === undefined || !selectedIds.has(m.sessionId)) continue;
    if (m.status !== "completed") continue;
    const mine = m.results.find((r) => r.playerId === playerId);
    if (!mine) continue;
    out.push({ match: m, mine });
  }
  out.sort((a, b) => +new Date(b.match.date) - +new Date(a.match.date));
  return out;
}

function PlayerHero({
  name,
  format,
  skillLevel,
  teamLabel,
  actionImage,
  profileImage,
  isTopDog = false,
}: {
  name: string;
  format: string;
  skillLevel: number | null;
  teamLabel?: string;
  actionImage: string;
  profileImage?: string;
  isTopDog?: boolean;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--border)]">
      <Image
        src={actionImage}
        alt={`${name} action shot`}
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover hero-zoom"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/70 to-transparent"
        aria-hidden
      />
      {isTopDog && (
        <div
          className="top-dog-stamp pointer-events-none absolute right-4 top-6 z-10 sm:right-8 sm:top-10"
          aria-label="Top Dog — current sweeps leader"
        >
          <span className="block">TOP</span>
          <span className="block">DOG</span>
        </div>
      )}
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-12 pt-32 sm:px-6 sm:pb-16 sm:pt-40 lg:px-8 lg:pb-20 lg:pt-48">
        <div className="flex items-end gap-5">
          {profileImage && (
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[var(--color-brass)]/70 bg-[var(--color-felt-deep)] shadow-[0_8px_24px_rgba(0,0,0,0.4)] sm:h-24 sm:w-24">
              <Image
                src={profileImage}
                alt={name}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
          )}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              {format !== "unknown" ? format.toUpperCase() : "Player"}
              {skillLevel ? ` · SL${skillLevel}` : ""}
              {teamLabel ? ` · ${teamLabel}` : ""}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-5xl leading-none tracking-wide drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)] sm:text-6xl lg:text-7xl">
              {name}
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnimatedStatTile({
  label,
  value,
  decimals = 0,
  suffix = "",
  accent = false,
  empty = false,
  delay = 0,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  accent?: boolean;
  empty?: boolean;
  delay?: number;
}) {
  return (
    <div className="surface px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        {label}
      </p>
      <p
        className={`mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide tabular-nums ${
          accent ? "text-[var(--color-pop-bright)]" : "text-[var(--color-cream)]"
        }`}
      >
        {empty ? (
          "—"
        ) : (
          <StatCounter value={value} decimals={decimals} suffix={suffix} delay={delay} />
        )}
      </p>
    </div>
  );
}

function RecordTile({
  wins,
  losses,
  delay = 0,
}: {
  wins: number;
  losses: number;
  delay?: number;
}) {
  return (
    <div className="surface px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        Record
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide tabular-nums text-[var(--color-cream)]">
        <StatCounter value={wins} delay={delay} />
        <span className="text-[var(--fg-dim)]">–</span>
        <StatCounter value={losses} delay={delay} />
      </p>
    </div>
  );
}

