import { ApaFetchError, loadSnapshot } from "./client";
import { computeStreaks, type Streak } from "@/lib/streaks";
import type {
  LeaderboardRow,
  Match,
  Player,
  PlayerProfile,
  PlayerStats,
  SessionRecord,
  Standing,
  TeamSummary,
} from "./schemas";

/** Top-level current-session team summary. Null if no snapshot yet. */
export async function getTeam(): Promise<TeamSummary | null> {
  const snap = await loadSnapshot();
  if (!snap.team.name || snap.teamId === 0) return null;
  return snap.team;
}

/** Current-session roster. Pass `sessionId` for a historical session's roster.
 *  When given a Set, returns the latest selected session's roster. */
export async function getRoster(
  sessionScope?: number | Set<number>,
): Promise<Player[]> {
  const snap = await loadSnapshot();
  if (sessionScope === undefined) return snap.roster;
  const id =
    typeof sessionScope === "number"
      ? sessionScope
      : Math.max(...sessionScope);
  return snap.sessionRosters[String(id)] ?? [];
}

/**
 * Schedule for the current session by default. Pass a sessionId or set of
 * sessionIds to fetch that combined schedule.
 */
export async function getSchedule(
  sessionScope?: number | Set<number>,
): Promise<Match[]> {
  const snap = await loadSnapshot();
  if (sessionScope === undefined) return snap.schedule;
  const ids =
    typeof sessionScope === "number" ? new Set([sessionScope]) : sessionScope;
  const teamIds = new Set(
    snap.sessions.filter((s) => ids.has(s.id)).map((s) => s.teamId),
  );
  return Object.values(snap.matches)
    .filter((m) =>
      m.teamId !== undefined ? teamIds.has(m.teamId) : false,
    )
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
}

/**
 * Full division standings — current session by default, or for a given session
 * id. With a Set, returns the most-recent selected session's standings (since
 * standings are point-in-time per division and don't combine meaningfully).
 */
export async function getStandings(
  sessionScope?: number | Set<number>,
): Promise<Standing[]> {
  const snap = await loadSnapshot();
  if (sessionScope !== undefined) {
    const id =
      typeof sessionScope === "number"
        ? sessionScope
        : Math.max(...sessionScope);
    return snap.sessionStandings[String(id)] ?? [];
  }
  if (snap.currentSession) {
    return (
      snap.sessionStandings[String(snap.currentSession.id)] ?? snap.standings
    );
  }
  return snap.standings;
}

export async function getSessions(): Promise<SessionRecord[]> {
  return (await loadSnapshot()).sessions;
}

export async function getCurrentSession(): Promise<{
  id: number;
  name: string;
  teamId: number;
} | null> {
  return (await loadSnapshot()).currentSession ?? null;
}

/**
 * Look up any match by id — current session or historical, whichever is
 * present in the matches map.
 */
export async function getMatch(id: string): Promise<Match | null> {
  const snap = await loadSnapshot();
  if (snap.matches[id]) return snap.matches[id];
  const ours = snap.schedule.find((m) => m.id === id);
  if (ours) return ours;
  // Fall back to opp team schedules — when we scrape an opp team's full
  // schedule, the projector embeds match results (with player IDs) on each
  // schedule entry, so opp-vs-opp matches are still viewable.
  for (const t of Object.values(snap.opponentTeams)) {
    const m = t.schedule.find((s) => s.id === id);
    if (m) return m;
  }
  return null;
}

/** Full career-spanning player profile. */
export async function getPlayerProfile(
  id: string,
): Promise<PlayerProfile | null> {
  const snap = await loadSnapshot();
  return snap.players[id] ?? null;
}

/**
 * Player profile for ANY player — ours or an opponent we've scraped data
 * for. Falls through opp profiles if not in our roster. Used by the
 * `/players/[id]` route and click-throughs from the scouting report.
 */
export async function getAnyPlayerProfile(
  id: string,
): Promise<{ profile: PlayerProfile | null; isOpponent: boolean }> {
  const snap = await loadSnapshot();
  const ours = snap.players[id];
  if (ours) return { profile: ours, isOpponent: false };
  const opp = snap.opponentPlayers[id];
  if (opp) return { profile: opp, isOpponent: true };
  return { profile: null, isOpponent: false };
}

/** Opponent team profile — scraped data for a specific opp team. */
export async function getOpponentTeam(id: string | number) {
  const snap = await loadSnapshot();
  return snap.opponentTeams[String(id)] ?? null;
}

/** All opponent teams we have scraped data for. */
export async function getOpponentTeams() {
  const snap = await loadSnapshot();
  return Object.values(snap.opponentTeams);
}

/**
 * Backwards-compatible getter used by the existing player detail page.
 * Combines current-session roster info with career stats from the player
 * profile (when available).
 */
export async function getPlayer(id: string): Promise<{
  player: Player | null;
  stats: PlayerStats | null;
  profile: PlayerProfile | null;
}> {
  const snap = await loadSnapshot();
  const player = snap.roster.find((p) => p.id === id) ?? null;
  const profile = snap.players[id] ?? null;
  if (!player && !profile) return { player: null, stats: null, profile: null };

  const career = profile?.career;
  const stats: PlayerStats = {
    id: profile?.id ?? player!.id,
    name: profile?.name ?? player!.name,
    skillLevel: profile?.currentSkillLevel ?? player?.skillLevel ?? null,
    format: profile?.format ?? player?.format ?? "unknown",
    matchesPlayed:
      career?.matchesPlayed ??
      player?.stats?.matchesPlayed ??
      0,
    wins: career?.wins ?? player?.stats?.wins ?? 0,
    losses:
      career?.losses ??
      Math.max(
        (player?.stats?.matchesPlayed ?? 0) - (player?.stats?.wins ?? 0),
        0,
      ),
    pa: profile?.current?.pa ?? player?.stats?.pa,
    ppm: profile?.current?.ppm ?? player?.stats?.ppm,
    winPct:
      career?.winPct ??
      player?.stats?.winPct ??
      undefined,
    points: career?.points,
    sweeps: career?.sweeps,
    miniSweeps: career?.miniSweeps,
    breakAndRuns: career?.breakAndRuns,
    eightOnBreaks: career?.eightOnBreaks,
  };
  return { player: player ?? toRosterPlayer(profile!), stats, profile };
}

function toRosterPlayer(profile: PlayerProfile): Player {
  return {
    id: profile.id,
    name: profile.name,
    firstName: profile.firstName,
    lastName: profile.lastName,
    skillLevel: profile.currentSkillLevel,
    format: profile.format,
    nickname: profile.nickname,
    profileImage: profile.profileImage,
    actionImage: profile.actionImage,
    visible: profile.visible !== false,
    stats: {
      wins: profile.career.wins,
      matchesPlayed: profile.career.matchesPlayed,
      winPct: profile.career.winPct,
      points: profile.career.points,
      sweeps: profile.career.sweeps,
      miniSweeps: profile.career.miniSweeps,
      breakAndRuns: profile.career.breakAndRuns,
      eightOnBreaks: profile.career.eightOnBreaks,
    },
  };
}

/**
 * Leaderboard for the requested scope.
 *   undefined            → current session
 *   "all"                → career totals across every cached session
 *   number               → just that session's leaderboard
 *   Set<number>          → combined across the given sessions (sums points,
 *                          sweeps, mini-sweeps, B&R, 8oB, etc.)
 */
export async function getLeaderboard(
  sessionScope?: number | "all" | Set<number>,
): Promise<LeaderboardRow[]> {
  const snap = await loadSnapshot();

  // Single key → use pre-computed.
  if (sessionScope === undefined) {
    const key = snap.currentSession ? String(snap.currentSession.id) : "all";
    return snap.leaderboards[key] ?? [];
  }
  if (sessionScope === "all") return snap.leaderboards["all"] ?? [];
  if (typeof sessionScope === "number")
    return snap.leaderboards[String(sessionScope)] ?? [];

  // Set: combine.
  const ids = sessionScope;
  if (ids.size === 0) return [];
  if (ids.size === 1) {
    const only = [...ids][0];
    return snap.leaderboards[String(only)] ?? [];
  }
  // If they happen to have selected every session, use the pre-computed "all".
  if (ids.size === snap.sessions.length) return snap.leaderboards["all"] ?? [];

  // Otherwise sum across the selected sessions.
  type Acc = LeaderboardRow & { _seen: boolean };
  const acc = new Map<string, Acc>();
  for (const id of ids) {
    const rows = snap.leaderboards[String(id)] ?? [];
    for (const r of rows) {
      let cur = acc.get(r.playerId);
      if (!cur) {
        cur = {
          ...r,
          // Re-init aggregate counters; we'll re-sum below.
          points: 0,
          sweeps: 0,
          miniSweeps: 0,
          breakAndRuns: 0,
          eightOnBreaks: 0,
          levelUps: 0,
          matchesPlayed: 0,
          wins: 0,
          _seen: true,
        };
        acc.set(r.playerId, cur);
      }
      cur.points += r.points;
      cur.sweeps += r.sweeps;
      cur.miniSweeps += r.miniSweeps;
      cur.breakAndRuns += r.breakAndRuns;
      cur.eightOnBreaks += r.eightOnBreaks;
      cur.levelUps += r.levelUps;
      cur.matchesPlayed += r.matchesPlayed;
      cur.wins += r.wins;
      // Latest SL we've seen wins.
      if (typeof r.skillLevel === "number") cur.skillLevel = r.skillLevel;
    }
  }
  return [...acc.values()]
    .map(({ _seen, ...row }) => {
      void _seen;
      return {
        ...row,
        points: Math.round(row.points * 10) / 10,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.sweeps - a.sweeps ||
        b.miniSweeps - a.miniSweeps ||
        b.wins - a.wins ||
        a.playerName.localeCompare(b.playerName),
    );
}

/**
 * Current trailing W/L streak per player, computed across every match in the
 * snapshot (career — not session-scoped). Returns a map keyed by playerId.
 */
export async function getPlayerStreaks(): Promise<Map<string, Streak>> {
  const snap = await loadSnapshot();
  return computeStreaks(Object.values(snap.matches));
}

export async function getLastUpdated(): Promise<Date | null> {
  const snap = await loadSnapshot();
  if (snap.lastUpdated.startsWith("1970-")) return null;
  const d = new Date(snap.lastUpdated);
  return isNaN(d.getTime()) ? null : d;
}

export { ApaFetchError };
