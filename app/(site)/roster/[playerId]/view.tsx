import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { StatCounter } from "@/components/ui/StatCounter";
import { YouTubeEmbed } from "@/components/clips/YouTubeEmbed";
import { OutcomeBars } from "@/components/leaderboard/OutcomeBars";
import { StreakBadge } from "@/components/cards/StreakBadge";
import { PointsBreakdown } from "@/components/cards/PointsBreakdown";
import { PatchShowcase } from "@/components/cards/PatchBadge";
import { CareerArc } from "@/components/cards/CareerArc";
import { RosterRackCard } from "@/components/rack/RosterRackCard";
import { PoolBall } from "@/components/brand/PoolBall";
import { SessionPicker } from "@/components/leaderboard/SessionPicker";
import { HeaderRail, ResultBall, SeasonHeading } from "@/components/season/SeasonKit";
import { parseSessionScope, resolveScope } from "@/lib/session-scope";
import {
  getCurrentSession,
  getLeaderboard,
  getMatch,
  getPatchInstances,
  getPlayer,
  getPlayerHistory,
  getSessions,
} from "@/lib/apa";
import { getClipsForPlayer } from "@/lib/youtube/client";
import { formatDate } from "@/lib/utils";



type Props = {
  params: Promise<{ playerId: string }>;
  query: { session?: string };
};

export async function generateMetadata({ params }: Pick<Props, "params">) {
  const { playerId } = await params;
  const { player, profile } = await getPlayer(playerId);
  if (player?.visible === false || profile?.visible === false) {
    return { title: "Player" };
  }
  return { title: player?.name ?? "Player" };
}

export async function PlayerView({ params, query }: Props) {
  const [{ playerId }, sp] = await Promise.all([params, query]);
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
        levelUps: profile?.career.levelUps ?? 0,
        firstWin: profile?.career.firstWin ?? 0,
        mvp: profile?.career.mvp ?? 0,
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
        levelUps: s?.levelUps ?? 0,
        firstWin: s?.firstWin ?? 0,
        mvp: s?.mvp ?? 0,
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
      eob = 0,
      lvl = 0,
      fw = 0,
      mv = 0;
    for (const s of inScope) {
      mp += s.matchesPlayed ?? 0;
      w += s.wins ?? 0;
      pts += s.points ?? 0;
      sw += s.sweeps ?? 0;
      ms += s.miniSweeps ?? 0;
      br += s.breakAndRuns ?? 0;
      eob += s.eightOnBreaks ?? 0;
      lvl += s.levelUps ?? 0;
      // firstWin is binary career-wide — max() so a multi-session selection
      // never inflates a once-in-a-career patch.
      fw = Math.max(fw, s.firstWin ?? 0);
      mv += s.mvp ?? 0;
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
      levelUps: lvl,
      firstWin: fw,
      mvp: mv,
      skillLevel: inScope[inScope.length - 1]?.skillLevel ?? null,
      pa: undefined as number | undefined,
      ppm: undefined as number | undefined,
      teamLabel: undefined as string | undefined,
    };
  })();

  const matchHistoryRaw = await getPlayerMatchHistory(playerId, selectedIds);
  const matchHistory = matchHistoryRaw.slice(0, 12);

  // Patch instances: resolve once, scoped to whatever sessions the user has
  // selected. The patch lightbox uses these to render the "Earned in" list.
  const allPatchInstances = await getPatchInstances(
    isAllSessions ? "all" : selectedIds,
  );
  const playerPatchInstances = allPatchInstances.get(playerId);

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

      <div className="mx-auto max-w-7xl px-4 pb-14 pt-2 sm:px-6 lg:px-8">
        <Link
          href="/roster"
          className="group mb-6 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brass)]/30 bg-black/30 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brass)]"
        >
          <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
          Back to roster
        </Link>

        <div className="mb-10">
          <SessionPicker
            basePath={`/roster/${playerId}`}
            sessions={sessions.filter((s) =>
              profile?.sessions.some((ps) => ps.sessionId === s.id),
            )}
            selectedIds={selectedIds}
          />
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide text-[var(--color-cream)] sm:text-4xl">
            {display.label}
          </h2>
          {playerHistory?.streak && (
            <StreakBadge streak={playerHistory.streak} />
          )}
          <div className="pm-rule hidden flex-1 sm:block" aria-hidden />
          {playerHistory && playerHistory.outcomes.length > 0 && (
            <div className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/45">
              <span>Recent form</span>
              <OutcomeBars outcomes={playerHistory.outcomes} max={10} />
            </div>
          )}
        </div>

        {/* Scoreboard — the four numbers that matter, on the table rail. */}
        <HeaderRail
          size="lg"
          className="mt-0 max-w-none"
          cells={[
            {
              label: "Patch points",
              value: (
                <StatCounter
                  value={display.points}
                  decimals={Number.isInteger(display.points) ? 0 : 1}
                />
              ),
              accent: true,
            },
            {
              label: "Record",
              value: (
                <>
                  <StatCounter value={display.wins} delay={80} />
                  <span className="text-[var(--color-cream)]/30">–</span>
                  <StatCounter value={display.losses} delay={80} />
                </>
              ),
            },
            {
              label: "Win rate",
              value: display.matchesPlayed ? (
                <>
                  <StatCounter value={display.winPct} decimals={1} delay={160} />
                  <span className="text-[0.5em] text-[var(--color-cream)]/45">%</span>
                </>
              ) : (
                <span className="text-[var(--color-cream)]/30">—</span>
              ),
            },
            {
              label: "Sweeps",
              value: <StatCounter value={display.sweeps} delay={240} />,
            },
          ]}
        />

        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <AnimatedStatTile label="Mini-Sweeps" value={display.miniSweeps} delay={320} tone="brass" />
          <AnimatedStatTile label="Break & Runs" value={display.breakAndRuns} delay={400} tone="felt" />
          <AnimatedStatTile label="8 on Break" value={display.eightOnBreaks} delay={480} tone="cream" />
          {display.pa !== undefined ? (
            <AnimatedStatTile label="PA" value={display.pa} suffix="%" delay={560} tone="pop" />
          ) : (
            <AnimatedStatTile label="Matches" value={display.matchesPlayed} delay={560} tone="pop" />
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <PointsBreakdown
            points={display.points}
            sweeps={display.sweeps}
            miniSweeps={display.miniSweeps}
            breakAndRuns={display.breakAndRuns}
            eightOnBreaks={display.eightOnBreaks}
            levelUps={display.levelUps}
          />
          {playerHistory && playerHistory.outcomes.length >= 2 && (
            <CareerArc outcomes={playerHistory.outcomes} />
          )}
        </div>

        {(display.sweeps > 0 ||
          display.miniSweeps > 0 ||
          display.breakAndRuns > 0 ||
          display.eightOnBreaks > 0 ||
          display.levelUps > 0 ||
          display.firstWin > 0 ||
          display.mvp > 0) && (
          <section className="mt-16">
            <SeasonHeading
              eyebrow="Hardware"
              title="Patches Earned"
              action={
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/45 sm:inline">
                  Tap a patch for the match list
                </span>
              }
            />
            <PatchShowcase
              sweeps={display.sweeps}
              miniSweeps={display.miniSweeps}
              breakAndRuns={display.breakAndRuns}
              eightOnBreaks={display.eightOnBreaks}
              levelUps={display.levelUps}
              firstWin={display.firstWin}
              mvp={display.mvp}
              instances={playerPatchInstances}
            />
          </section>
        )}

        {/* Live-scored record from the Rack Up section, if this player has
            linked an account there. Renders nothing when they haven't. */}
        <div className="mt-12 empty:hidden">
          <RosterRackCard apaMemberId={playerId} />
        </div>

        {profile && profile.sessions.length > 1 && (
          <section className="mt-16">
            <SeasonHeading
              eyebrow="Career"
              title="Session History"
              action={
                <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/45">
                  {profile.sessions.length} sessions
                </span>
              }
            />
            <ul className="pm-glass overflow-hidden p-1.5 sm:p-2">
              {profile.sessions.map((s) => {
                const active = selectedIds.has(s.sessionId);
                const pct =
                  s.winPct ??
                  (s.matchesPlayed && s.wins !== undefined
                    ? Math.round((s.wins / s.matchesPlayed) * 1000) / 10
                    : undefined);
                return (
                  <li key={`${s.sessionId}-${s.teamId}`}>
                    <Link
                      href={`/roster/${playerId}?session=${s.sessionId}`}
                      className={
                        "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 transition-colors sm:gap-4 sm:px-4 " +
                        (active
                          ? "bg-[linear-gradient(90deg,rgba(46,139,87,0.28),rgba(46,139,87,0.06)_70%,transparent)] shadow-[inset_3px_0_0_var(--color-brass-bright)]"
                          : "hover:bg-white/[0.04]")
                      }
                    >
                      {s.skillLevel ? (
                        <PoolBall number={s.skillLevel} size={34} />
                      ) : (
                        <span className="h-[34px] w-[34px] shrink-0 rounded-full border border-[var(--color-cream)]/10" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-[family-name:var(--font-display)] text-xl leading-tight tracking-wide text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)]">
                          {s.sessionName}
                          <span className="ml-2 font-sans text-xs normal-case tracking-normal text-[var(--color-cream)]/50">
                            {s.teamName}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-cream)]/50">
                          {s.skillLevel ? `SL${s.skillLevel} · ` : ""}
                          {s.matchesPlayed ?? 0} matches
                          {s.winPct !== undefined ? ` · ${s.winPct}% win` : ""}
                          {s.points !== undefined && s.points > 0
                            ? ` · ${s.points} pts`
                            : ""}
                        </p>
                      </div>
                      {pct !== undefined && (
                        <span
                          className="hidden h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-white/[0.06] md:block"
                          aria-hidden
                        >
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-[var(--color-felt-bright)] to-[var(--color-brass-bright)]"
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </span>
                      )}
                      {s.wins !== undefined && s.matchesPlayed !== undefined && (
                        <span className="w-14 shrink-0 text-right font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide tabular-nums text-[var(--color-cream)]">
                          {s.wins}
                          <span className="text-[var(--color-cream)]/30">/</span>
                          {s.matchesPlayed}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mt-16">
          <SeasonHeading
            eyebrow="Scoresheets"
            title={isAllSessions ? "Recent Matches" : "Matches"}
            action={
              isAllSessions ? (
                <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/45">
                  Career
                </span>
              ) : undefined
            }
          />
          {matchHistory.length === 0 ? (
            <p className="pm-glass p-6 text-sm text-[var(--color-cream)]/60">
              No matches with scoresheet results for this scope.
            </p>
          ) : (
            <ul className="pm-glass overflow-hidden p-1.5 sm:p-2">
              {matchHistory.map(({ match, mine }) => {
                const tags = [
                  mine.sweep ? "Sweep" : null,
                  !mine.sweep && mine.miniSweep ? "Mini" : null,
                  mine.breakAndRun ? "B&R" : null,
                  mine.eightOnBreak ? "8 on break" : null,
                ].filter(Boolean) as string[];
                return (
                  <li key={match.id}>
                    <Link
                      href={`/matches/${match.id}`}
                      className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-white/[0.04] sm:gap-4 sm:px-4"
                    >
                      <ResultBall
                        outcome={mine.outcome === "W" ? "W" : "L"}
                        size={38}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)] sm:text-base">
                          vs {match.opponent}
                          {match.sessionName && (
                            <span className="ml-2 text-xs font-normal text-[var(--color-cream)]/45">
                              {match.sessionName}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[var(--color-cream)]/50">
                          <span>{formatDate(match.date)}</span>
                          {mine.skillLevel && (
                            <span>
                              · SL{mine.skillLevel}
                              {mine.opponentSkillLevel && ` vs SL${mine.opponentSkillLevel}`}
                            </span>
                          )}
                          {tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-[var(--color-brass)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--color-brass-bright)]"
                            >
                              {t}
                            </span>
                          ))}
                        </p>
                      </div>
                      {mine.score && (
                        <span
                          className={
                            "shrink-0 font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide tabular-nums " +
                            (mine.outcome === "W"
                              ? "text-[var(--color-felt-bright)]"
                              : "text-[var(--color-pop-bright)]")
                          }
                        >
                          {mine.score}
                        </span>
                      )}
                      <span className="sr-only">{mine.outcome === "W" ? "Win" : "Loss"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {clips.length > 0 && (
          <section className="mt-16">
            <SeasonHeading eyebrow="On camera" title="Highlight Reel" />
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
    <section className="pm-grain relative isolate mt-[calc(-5rem-env(safe-area-inset-top))] overflow-hidden">
      {/* Soft blurred background fill so contain doesn't leave hard letterbox
          bars — gives the hero a polished, full-bleed feel while keeping the
          entire action shot visible. */}
      <Image
        src={actionImage}
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden
        className="-z-20 scale-110 object-cover blur-2xl opacity-50"
      />
      <Image
        src={actionImage}
        alt={`${name} action shot`}
        fill
        priority
        sizes="100vw"
        className="-z-10 object-contain object-center hero-zoom"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/55 to-[var(--bg)]/30"
        aria-hidden
      />
      <div className="pm-lamp absolute inset-0 -z-10" aria-hidden />
      {isTopDog && (
        <div
          className="top-dog-stamp pointer-events-none absolute right-4 top-28 z-10 sm:right-8 sm:top-32"
          aria-label="Top Dog — current sweeps leader"
        >
          <span className="block">TOP</span>
          <span className="block">DOG</span>
        </div>
      )}
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-12 pt-[calc(5rem+env(safe-area-inset-top)+8rem)] sm:px-6 sm:pb-16 sm:pt-[calc(5rem+env(safe-area-inset-top)+10rem)] lg:px-8 lg:pb-20 lg:pt-[calc(5rem+env(safe-area-inset-top)+12rem)]">
        <div className="flex items-end gap-5">
          {profileImage && (
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[var(--color-brass)]/70 bg-[var(--color-felt-deep)] shadow-[0_8px_24px_rgba(0,0,0,0.4)] sm:h-24 sm:w-24">
              <Image
                src={profileImage}
                alt={name}
                fill
                sizes="96px"
                className="object-cover object-top"
              />
            </div>
          )}
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)] backdrop-blur-sm sm:text-[11px]">
              {format !== "unknown" ? format.toUpperCase() : "Player"}
              {skillLevel ? ` · SL${skillLevel}` : ""}
              {teamLabel ? ` · ${teamLabel}` : ""}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-6xl leading-[0.9] tracking-wide text-[var(--color-cream)] drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)] sm:text-7xl lg:text-8xl">
              {name}
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}

const TILE_TONE = {
  brass: "rgba(224,190,107,0.22)",
  felt: "rgba(46,139,87,0.3)",
  cream: "rgba(236,225,196,0.14)",
  pop: "rgba(232,82,72,0.22)",
} as const;

function AnimatedStatTile({
  label,
  value,
  decimals = 0,
  suffix = "",
  delay = 0,
  tone = "cream",
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  delay?: number;
  tone?: keyof typeof TILE_TONE;
}) {
  return (
    <div className="pm-glass relative overflow-hidden px-5 py-4">
      <span
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background: `radial-gradient(80% 90% at 100% 0%, ${TILE_TONE[tone]}, transparent 65%)`,
        }}
        aria-hidden
      />
      <p className="relative text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/50">
        {label}
      </p>
      <p className="relative mt-1.5 font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide tabular-nums text-[var(--color-cream)]">
        <StatCounter value={value} decimals={decimals} suffix={suffix} delay={delay} />
      </p>
    </div>
  );
}
