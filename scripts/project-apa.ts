/**
 * Read everything in data/cache/ and project a single site-ready JSON file
 * to data/apa.json.
 *
 * Implements the leaderboard scoring system:
 *   sweep         = 1.0 pt   (won + opponent scored 0)
 *   mini-sweep    = 0.5 pt   (won + opponent didn't reach the hill)
 *   8-on-break    = 1.0 pt   each
 *   break-and-run = 1.0 pt   each
 *
 * "On the hill" is decided by APA's race-to chart given each side's skill
 * level *at the time of the match*. See lib/apa/race.ts.
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ApaCache } from "./scraper/cache";
import type {
  TeamCacheEntry,
  MatchCacheEntry,
  MemberCacheEntry,
  DivisionCacheEntry,
} from "./scraper/operations";
import { hillThreshold } from "../lib/apa/race";
import {
  loadPlayersConfig,
  normalizedOverride,
} from "../lib/apa/players-config";

/* -------------------------------------------------------------------- helpers */

type AnyRec = Record<string, unknown>;
const asObj = (v: unknown): AnyRec | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as AnyRec) : null;
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNumber = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const asString = (v: unknown): string | undefined =>
  typeof v === "string" && v.length ? v : undefined;
const get = (e: AnyRec | null, ...keys: string[]): unknown => {
  if (!e) return undefined;
  for (const k of keys) {
    if (k in e && e[k] !== null && e[k] !== undefined) return e[k];
  }
  return undefined;
};

function detectFormat(v: unknown): "8-ball" | "9-ball" | "masters" | "doubles" | "unknown" {
  const s = asString(v)?.toLowerCase() ?? "";
  if (s.includes("master")) return "masters";
  if (s.includes("nine") || s === "9-ball") return "9-ball";
  if (s.includes("eight") || s.startsWith("8") || s === "8-ball") return "8-ball";
  if (s.includes("double")) return "doubles";
  return "unknown";
}

/* ------------------------------------------------------------------- types */

type MatchResult = {
  playerId: string;
  playerName: string;
  opponentName: string;
  skillLevel?: number;
  opponentSkillLevel?: number;
  outcome: "W" | "L";
  score?: string;
  sweep: boolean;
  miniSweep: boolean;
  breakAndRun: boolean;
  eightOnBreak: boolean;
  forfeited: boolean;
  teamSlot?: string;
  matchPosition?: number;
};

type Match = {
  id: string;
  teamId: number;
  sessionId?: number;
  sessionName?: string;
  week?: number;
  date: string;
  opponent: string;
  location?: string;
  isHome?: boolean;
  teamScore?: number;
  opponentScore?: number;
  status: "upcoming" | "completed" | "forfeit" | "bye";
  sweep: boolean;
  results: MatchResult[];
};

type LeaderboardRow = {
  playerId: string;
  playerName: string;
  points: number;
  sweeps: number;
  miniSweeps: number;
  breakAndRuns: number;
  eightOnBreaks: number;
  levelUps: number;
  matchesPlayed: number;
  wins: number;
  skillLevel?: number;
  nickname?: string;
  profileImage?: string;
};

type SessionPlayerRecord = {
  sessionId: number;
  sessionName: string;
  teamId: number;
  teamName: string;
  skillLevel?: number;
  startingSkillLevel?: number;
  endingSkillLevel?: number;
  matchesPlayed?: number;
  wins?: number;
  winPct?: number;
  pa?: number;
  ppm?: number;
  rackless?: number;
  points?: number;
  sweeps?: number;
  miniSweeps?: number;
  breakAndRuns?: number;
  eightOnBreaks?: number;
  levelUps?: number;
};

type PlayerProfile = {
  id: string;
  name: string;
  internalId?: number;
  currentSkillLevel: number | null;
  format: "8-ball" | "9-ball" | "masters" | "doubles" | "unknown";
  nickname?: string;
  profileImage?: string;
  actionImage?: string;
  visible?: boolean;
  current: SessionPlayerRecord | null;
  career: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    winPct: number;
    points: number;
    sweeps: number;
    miniSweeps: number;
    breakAndRuns: number;
    eightOnBreaks: number;
    levelUps: number;
  };
  sessions: SessionPlayerRecord[];
};

/* --------------------------------------------------- per-team meta extraction */

function pickTeamMeta(team: TeamCacheEntry) {
  type Page = {
    team?: {
      id?: number;
      name?: string;
      number?: string;
      standing?: number;
      isTied?: boolean;
      division?: { name?: string; format?: string; type?: string; nightOfPlay?: string };
      session?: { id?: number; name?: string };
      location?: { name?: string };
    };
  };
  const t = (team.teamPage as Page).team;
  if (!t) return null;
  return {
    id: t.id ?? 0,
    name: t.name ?? "Unknown Team",
    number: t.number,
    standing: t.standing,
    division: t.division?.name,
    divisionFormat: t.division?.format ?? t.division?.type ?? "8-Ball Open",
    nightOfPlay: t.division?.nightOfPlay,
    session: t.session ? { id: t.session.id ?? 0, name: t.session.name ?? "" } : null,
    homeLocation: t.location?.name,
  };
}

/* --------------------------------------- per-match scoresheet projection */

type SideKey = "HOME" | "AWAY";

function projectMatchScores(
  match: MatchCacheEntry,
  ourSide: SideKey,
  ebpToMemberNumber: Map<number, string>,
  format: "8-ball" | "9-ball" | "masters" | "doubles" | "unknown",
): MatchResult[] {
  type Score = {
    id?: number;
    player?: { id?: number; displayName?: string };
    skillLevel?: number;
    eightBallWins?: number;
    eightOnBreak?: number;
    eightBallBreakAndRun?: number;
    nineBallPoints?: number;
    nineBallBreakAndRun?: number;
    nineOnSnap?: number;
    winLoss?: "W" | "L";
    matchForfeited?: boolean;
    matchPositionNumber?: number;
    teamSlot?: string;
  };
  type Side = {
    homeAway?: SideKey;
    scores?: Score[];
  };
  const data = match.match as { results?: Side[] };
  const sides = data?.results ?? [];
  const our = sides.find((s) => s.homeAway === ourSide);
  const opp = sides.find((s) => s.homeAway !== ourSide);

  const oppByPosition = new Map<number, Score>();
  for (const s of opp?.scores ?? []) {
    if (typeof s.matchPositionNumber === "number") {
      oppByPosition.set(s.matchPositionNumber, s);
    }
  }

  const out: MatchResult[] = [];
  for (const s of our?.scores ?? []) {
    const ebpId = s.player?.id;
    const memberNumber = ebpId ? ebpToMemberNumber.get(ebpId) : undefined;
    const playerName = s.player?.displayName ?? "Unknown";
    const opponent =
      typeof s.matchPositionNumber === "number"
        ? oppByPosition.get(s.matchPositionNumber)
        : undefined;
    const opponentName = opponent?.player?.displayName ?? "Opponent";
    const outcome: "W" | "L" = s.winLoss === "W" ? "W" : "L";
    const ourScore = s.eightBallWins ?? s.nineBallPoints ?? 0;
    const oppScore = opponent?.eightBallWins ?? opponent?.nineBallPoints ?? 0;
    const score =
      ourScore !== undefined && oppScore !== undefined
        ? `${ourScore}-${oppScore}`
        : undefined;
    const eightOnBreak = (s.eightOnBreak ?? 0) > 0;
    const breakAndRun =
      (s.eightBallBreakAndRun ?? 0) > 0 || (s.nineBallBreakAndRun ?? 0) > 0;

    let sweep = false;
    let miniSweep = false;
    if (outcome === "W") {
      // "Sweep" = opponent scored 0 (full shutout).
      // "Mini-sweep" = opponent didn't reach the hill (their wins-to-win minus 1).
      const oppHill = hillThreshold(opponent?.skillLevel, s.skillLevel, format);
      if (oppScore === 0) {
        sweep = true;
      } else if (oppScore < oppHill) {
        miniSweep = true;
      }
    }

    out.push({
      playerId: memberNumber ?? `ebp:${ebpId ?? "?"}`,
      playerName,
      opponentName,
      skillLevel: s.skillLevel,
      opponentSkillLevel: opponent?.skillLevel,
      outcome,
      score,
      sweep,
      miniSweep,
      breakAndRun,
      eightOnBreak,
      forfeited: s.matchForfeited === true,
      teamSlot: s.teamSlot,
      matchPosition: s.matchPositionNumber,
    });
  }
  return out;
}

/* ---------------------------------------------- schedule + match indexing */

function projectScheduleMatches(
  team: TeamCacheEntry,
  matches: Map<number, MatchCacheEntry>,
  ebpToMemberNumber: Map<number, string>,
  sessionInfo: { id?: number; name?: string } | undefined,
  format: "8-ball" | "9-ball" | "masters" | "doubles" | "unknown",
): Match[] {
  type ScheduleMatch = {
    id?: number;
    week?: number;
    isBye?: boolean;
    status?: string;
    isFinalized?: boolean;
    startTime?: string;
    home?: { id?: number; name?: string; isMine?: boolean };
    away?: { id?: number; name?: string; isMine?: boolean };
    location?: { name?: string };
    results?: Array<{ homeAway?: SideKey; points?: { total?: number } }>;
  };
  type Schedule = { team?: { id?: number; matches?: ScheduleMatch[] } };
  const data = team.teamSchedule as Schedule;
  const teamId = data?.team?.id ?? 0;
  const out: Match[] = [];
  for (const m of data?.team?.matches ?? []) {
    if (!m?.id) continue;
    // Identify which side IS this team. APA marks our logged-in user's
    // matches with `isMine: true`, but for opponent teams we project too
    // that flag is always false — fall back to matching the team id.
    const homeIsOurs =
      m.home?.isMine === true || (teamId !== 0 && m.home?.id === teamId);
    const ourSide: SideKey = homeIsOurs ? "HOME" : "AWAY";
    const oppSide: SideKey = homeIsOurs ? "AWAY" : "HOME";
    const oppTeam = homeIsOurs ? m.away : m.home;
    const ourTeamRes = m.results?.find((r) => r.homeAway === ourSide);
    const oppTeamRes = m.results?.find((r) => r.homeAway === oppSide);
    const teamScore = ourTeamRes?.points?.total;
    const opponentScore = oppTeamRes?.points?.total;
    const isBye = m.isBye === true;
    const status: Match["status"] = isBye
      ? "bye"
      : m.isFinalized || m.status === "COMPLETED"
        ? "completed"
        : (m.status ?? "").toLowerCase().includes("forfeit")
          ? "forfeit"
          : "upcoming";
    const sweep =
      status === "completed" &&
      (opponentScore ?? -1) === 0 &&
      (teamScore ?? 0) > 0;

    let results: MatchResult[] = [];
    const cached = matches.get(m.id);
    if (cached) {
      results = projectMatchScores(cached, ourSide, ebpToMemberNumber, format);
    }

    out.push({
      id: String(m.id),
      teamId,
      sessionId: sessionInfo?.id,
      sessionName: sessionInfo?.name,
      week: m.week,
      date: m.startTime ?? new Date().toISOString(),
      opponent: isBye ? "BYE" : oppTeam?.name ?? "TBD",
      location: m.location?.name,
      isHome: homeIsOurs,
      teamScore,
      opponentScore,
      status,
      sweep,
      results,
    });
  }
  return out;
}

/* --------------------------------------------------- player aggregation */

type SessionAgg = {
  sessionId: number;
  sessionName: string;
  teamId: number;
  teamName: string;
  skillLevel?: number;
  startingSkillLevel?: number;
  endingSkillLevel?: number;
  levelUps: number;
  matchesPlayed: number;
  wins: number;
  points: number;
  sweeps: number;
  miniSweeps: number;
  breakAndRuns: number;
  eightOnBreaks: number;
  // From AliasSessionStats:
  pa?: number;
  ppm?: number;
  rackless?: number;
  apaMatchesPlayed?: number;
  apaMatchesWon?: number;
};

function pointsForResult(r: MatchResult): number {
  // Per-result points (level-up points are added separately, per session).
  let p = 0;
  if (r.sweep) p += 1;
  else if (r.miniSweep) p += 0.5;
  if (r.breakAndRun) p += 1;
  if (r.eightOnBreak) p += 1;
  return p;
}

/* ------------------------------------------------------ projection main */

async function main() {
  const cache = new ApaCache();
  const meta = (await cache.readMeta<{
    teamId: number;
    sourceUrl: string;
    leagueSlug: string;
    currentSessionId: number | null;
    lastScrapeAt: string;
  }>()) ?? {
    teamId: 12894673,
    sourceUrl: "",
    leagueSlug: "southjersey",
    currentSessionId: null,
    lastScrapeAt: new Date().toISOString(),
  };

  const playersConfig = await loadPlayersConfig();
  const teamRecords = await cache.readAll<TeamCacheEntry>("teams");
  const matchRecords = await cache.readAll<MatchCacheEntry>("matches");
  const memberRecords = await cache.readAll<MemberCacheEntry>("members");
  const divisionRecords = await cache.readAll<DivisionCacheEntry>("divisions");

  if (teamRecords.length === 0) {
    console.error("No teams in cache. Run `npm run scrape` first.");
    process.exit(1);
  }

  const teams = new Map<number, TeamCacheEntry>();
  for (const { id, record } of teamRecords) teams.set(parseInt(id, 10), record.data);
  const matchCache = new Map<number, MatchCacheEntry>();
  for (const { id, record } of matchRecords) matchCache.set(parseInt(id, 10), record.data);
  const members = new Map<number, MemberCacheEntry>();
  for (const { id, record } of memberRecords) members.set(parseInt(id, 10), record.data);
  const divisions = new Map<number, DivisionCacheEntry>();
  for (const { id, record } of divisionRecords) divisions.set(parseInt(id, 10), record.data);

  console.log(
    `→ projecting from cache: teams=${teams.size}, matches=${matchCache.size}, members=${members.size}, divisions=${divisions.size}`,
  );

  // 1. EBP -> memberNumber, EBP -> skillLevel maps from every cached roster.
  const ebpToMemberNumber = new Map<number, string>();
  const ebpIdToSkillLevel = new Map<number, number>();
  type RosterEntry = {
    id?: number;
    memberNumber?: string;
    displayName?: string;
    skillLevel?: number;
    member?: { id?: number };
    __typename?: string;
    matchesWon?: number;
    matchesPlayed?: number;
    pa?: number;
    ppm?: number;
  };
  type RosterShape = { team?: { roster?: RosterEntry[] } };
  for (const team of teams.values()) {
    const data = team.teamRoster as RosterShape;
    for (const r of data?.team?.roster ?? []) {
      if (typeof r.id === "number" && r.memberNumber) {
        ebpToMemberNumber.set(r.id, r.memberNumber);
      }
      if (typeof r.id === "number" && typeof r.skillLevel === "number") {
        ebpIdToSkillLevel.set(r.id, r.skillLevel);
      }
    }
  }

  // 2. Identify CURRENT team & session.
  const currentTeam = teams.get(meta.teamId);
  if (!currentTeam) {
    console.error(`Current team ${meta.teamId} missing from cache.`);
    process.exit(1);
  }
  const currentMeta = pickTeamMeta(currentTeam)!;
  const currentSessionId = currentMeta.session?.id ?? meta.currentSessionId ?? null;
  const currentFormat = detectFormat(currentMeta.divisionFormat);

  // 3. Identify "Top Dogs lineage" — teams that count as us across sessions.
  // Match current team's name first (APA team names persist across sessions
  // for stable rosters). Members can also play for other teams in the same
  // session (e.g. Patrick on Bobby D's Cue Crew); those don't count.
  // If you rename the team on APA later, add the old name to OUR_TEAM_ALIASES.
  const OUR_TEAM_ALIASES = new Set<string>(
    [currentMeta.name, "Top Dogs", "Eight Men Out"].filter(Boolean) as string[],
  );
  const oursTeamIds = new Set<number>([meta.teamId]);
  for (const [tid, team] of teams) {
    const m = pickTeamMeta(team);
    if (m && OUR_TEAM_ALIASES.has(m.name)) oursTeamIds.add(tid);
  }
  console.log(
    `→ identified ${oursTeamIds.size} team(s) as Top Dogs lineage:`,
    [...oursTeamIds].sort().join(", "),
  );

  // 4. Sessions registry — only sessions where Top Dogs lineage played.
  type SessionEntry = { name: string; ourTeamId: number; format: string };
  const sessionsBySessionId = new Map<number, SessionEntry>();
  for (const [tid, team] of teams) {
    if (!oursTeamIds.has(tid)) continue;
    const m = pickTeamMeta(team);
    if (!m?.session) continue;
    if (!sessionsBySessionId.has(m.session.id)) {
      sessionsBySessionId.set(m.session.id, {
        name: m.session.name,
        ourTeamId: tid,
        format: detectFormat(m.divisionFormat),
      });
    }
  }
  const sessions = [...sessionsBySessionId.entries()]
    .map(([id, s]) => ({
      id,
      name: s.name,
      teamId: s.ourTeamId,
      format: s.format,
    }))
    .sort((a, b) => b.id - a.id);

  // 4. Project every match across every Top Dogs lineage team.
  // (Matches from other teams members also play on are NOT included anywhere
  // on the site — leaderboard, player history, match detail are all Top Dogs only.)
  const matchesById = new Map<string, Match>();
  for (const [tid, team] of teams) {
    if (!oursTeamIds.has(tid)) continue;
    const tm = pickTeamMeta(team);
    const session = tm?.session ?? undefined;
    const fmt = detectFormat(tm?.divisionFormat);
    for (const m of projectScheduleMatches(team, matchCache, ebpToMemberNumber, session, fmt)) {
      matchesById.set(m.id, m);
    }
  }

  // 5. Build per-session, per-player aggregations from match results.
  // We walk matches in chronological order per (session, player) so we can
  // detect skill-level increases (level-ups) — those count as 1 point each.
  // key = `${sessionId}::${playerId}`
  const aggKey = (sessionId: number, playerId: string) => `${sessionId}::${playerId}`;
  const aggregations = new Map<string, SessionAgg>();
  // Career = sum across all sessions per player
  type CareerAgg = SessionAgg & { firstSessionId: number; latestSessionId: number };
  const careers = new Map<string, CareerAgg>();

  // Group player-results by (sessionId, playerId), preserving chronological order.
  type Entry = { match: Match; result: MatchResult };
  const groupedEntries = new Map<string, Entry[]>();
  const sortedMatches = [...matchesById.values()]
    .filter((m) => m.status === "completed" && m.sessionId)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  for (const m of sortedMatches) {
    for (const r of m.results) {
      if (r.playerId.startsWith("ebp:")) continue;
      const k = aggKey(m.sessionId!, r.playerId);
      const list = groupedEntries.get(k) ?? [];
      list.push({ match: m, result: r });
      groupedEntries.set(k, list);
    }
  }

  // session id → Top Dogs team for that session. Restricted to ours so a
  // session's "team" is always the Eight Men Out lineage team, never a
  // parallel team some current member also plays on.
  const sessionTeamFor = new Map<number, { teamId: number; teamName: string }>();
  for (const [tid, team] of teams) {
    if (!oursTeamIds.has(tid)) continue;
    const tm = pickTeamMeta(team);
    if (tm?.session?.id && tm.id) {
      if (!sessionTeamFor.has(tm.session.id)) {
        sessionTeamFor.set(tm.session.id, { teamId: tm.id, teamName: tm.name });
      }
    }
  }

  for (const [k, entries] of groupedEntries) {
    const [, playerId] = k.split("::");
    const sessionId = entries[0].match.sessionId!;

    // Walk chronologically. The starting SL is the first match's SL; each
    // time we see a higher SL than any seen so far, that's a level-up
    // (1 point per increment).
    let priorMaxSL: number | undefined;
    let levelUps = 0;
    let startingSL: number | undefined;
    let endingSL: number | undefined;
    let matchesPlayed = 0;
    let wins = 0;
    let points = 0;
    let sweeps = 0;
    let miniSweeps = 0;
    let breakAndRuns = 0;
    let eightOnBreaks = 0;

    for (const { match: m, result: r } of entries) {
      if (!oursTeamIds.has(m.teamId)) continue;
      matchesPlayed += 1;
      if (r.outcome === "W") wins += 1;
      if (r.sweep) sweeps += 1;
      if (r.miniSweep) miniSweeps += 1;
      if (r.breakAndRun) breakAndRuns += 1;
      if (r.eightOnBreak) eightOnBreaks += 1;
      points += pointsForResult(r);

      const sl = r.skillLevel;
      if (typeof sl === "number") {
        if (startingSL === undefined) startingSL = sl;
        if (priorMaxSL === undefined) priorMaxSL = sl;
        else if (sl > priorMaxSL) {
          levelUps += sl - priorMaxSL;
          priorMaxSL = sl;
        }
        endingSL = sl;
      }
    }

    if (matchesPlayed === 0) continue;
    points += levelUps;

    const teamInfo = sessionTeamFor.get(sessionId) ?? {
      teamId: entries[0].match.teamId,
      teamName: entries[0].match.opponent,
    };
    const agg: SessionAgg = {
      sessionId,
      sessionName: entries[0].match.sessionName ?? "",
      teamId: teamInfo.teamId,
      teamName: teamInfo.teamName,
      skillLevel: endingSL,
      startingSkillLevel: startingSL,
      endingSkillLevel: endingSL,
      levelUps,
      matchesPlayed,
      wins,
      points,
      sweeps,
      miniSweeps,
      breakAndRuns,
      eightOnBreaks,
    };
    aggregations.set(k, agg);

    let car = careers.get(playerId);
    if (!car) {
      car = {
        sessionId: 0,
        sessionName: "",
        teamId: 0,
        teamName: "",
        levelUps: 0,
        matchesPlayed: 0,
        wins: 0,
        points: 0,
        sweeps: 0,
        miniSweeps: 0,
        breakAndRuns: 0,
        eightOnBreaks: 0,
        firstSessionId: sessionId,
        latestSessionId: sessionId,
      };
      careers.set(playerId, car);
    }
    car.firstSessionId = Math.min(car.firstSessionId, sessionId);
    car.latestSessionId = Math.max(car.latestSessionId, sessionId);
    if (typeof endingSL === "number") car.skillLevel = endingSL;
    car.matchesPlayed += matchesPlayed;
    car.wins += wins;
    car.sweeps += sweeps;
    car.miniSweeps += miniSweeps;
    car.breakAndRuns += breakAndRuns;
    car.eightOnBreaks += eightOnBreaks;
    car.levelUps += levelUps;
    car.points += points;
  }

  // 6. Member meta — name + alias-sourced PA/PPM/rackless per session.
  type AliasPlayer = {
    id?: number;
    team?: { id?: number; name?: string };
    skillLevel?: number;
    pa?: number;
    ppm?: number;
    matchesWon?: number;
    matchesPlayed?: number;
    rackless?: number;
    eightBallBreakAndRuns?: number;
    eightOnBreaks?: number;
    __typename?: string;
  };
  type AliasData = {
    alias?: { id?: number; member?: { id?: number }; players?: AliasPlayer[] };
  };
  // Merge AliasSessionStats into our aggregations as supplementary data.
  // Look up sessionId via teamId.
  const teamIdToSessionInfo = new Map<number, { id: number; name: string; teamName: string }>();
  for (const [tid, team] of teams) {
    const m = pickTeamMeta(team);
    if (m?.session) {
      teamIdToSessionInfo.set(tid, {
        id: m.session.id,
        name: m.session.name,
        teamName: m.name,
      });
    }
  }

  // Capture per-player metadata + whether they appear on a roster (for name lookup).
  const memberNumberToInternalId = new Map<string, number>();
  const memberNumberMeta = new Map<
    string,
    { name: string; currentSL: number | null; format: string }
  >();
  for (const team of teams.values()) {
    const data = team.teamRoster as RosterShape;
    const isCurrent =
      ((team.teamPage as { team?: { session?: { id?: number } } })?.team?.session?.id ??
        null) === currentSessionId;
    for (const r of data?.team?.roster ?? []) {
      if (!r.memberNumber) continue;
      if (r.member?.id) memberNumberToInternalId.set(r.memberNumber, r.member.id);
      const existing = memberNumberMeta.get(r.memberNumber);
      if (!existing || isCurrent) {
        memberNumberMeta.set(r.memberNumber, {
          name: r.displayName ?? existing?.name ?? "Unknown",
          currentSL: (isCurrent ? r.skillLevel : existing?.currentSL) ?? null,
          format: detectFormat(r.__typename),
        });
      }
    }
  }

  // 7. Build PlayerProfile records (current roster only — past members aren't fetched).
  type RosterPlayer = {
    id: string;
    name: string;
    skillLevel: number | null;
    format: string;
    stats?: AnyRec;
    nickname?: string;
    profileImage?: string;
    actionImage?: string;
    visible?: boolean;
  };
  const players = new Map<string, PlayerProfile>();
  // Build the union of every internal ID that has appeared on a Top Dogs
  // lineage roster — current AND past — so past teammates (e.g. Greg
  // Carpenter, Colleen Mooney) get profile cards too.
  const allTopDogsInternalIds = new Set<number>();
  for (const tid of oursTeamIds) {
    const team = teams.get(tid);
    if (!team) continue;
    for (const r of (team.teamRoster as RosterShape).team?.roster ?? []) {
      if (r.member?.id) allTopDogsInternalIds.add(r.member.id);
    }
  }

  for (const internalId of allTopDogsInternalIds) {
    const member = members.get(internalId);
    // Find this member's memberNumber via internalId map.
    let memberNumber: string | undefined;
    for (const [mn, iid] of memberNumberToInternalId)
      if (iid === internalId) {
        memberNumber = mn;
        break;
      }
    if (!memberNumber) continue;
    const memberMeta = memberNumberMeta.get(memberNumber);
    if (!memberMeta) continue;

    // Per-session list — start from match-derived aggregations, then merge AliasSessionStats supplements.
    const sessionsMap = new Map<number, SessionPlayerRecord>();
    for (const agg of aggregations.values()) {
      // We'll filter to this player below by walking aggregations of the right key.
      if (agg.sessionId == null) continue;
    }
    // Actually iterate our keyed aggregations directly:
    for (const [k, agg] of aggregations) {
      const [, pid] = k.split("::");
      if (pid !== memberNumber) continue;
      sessionsMap.set(agg.sessionId, {
        sessionId: agg.sessionId,
        sessionName: agg.sessionName,
        teamId: agg.teamId,
        teamName: agg.teamName,
        skillLevel: agg.endingSkillLevel ?? agg.skillLevel,
        startingSkillLevel: agg.startingSkillLevel,
        endingSkillLevel: agg.endingSkillLevel,
        matchesPlayed: agg.matchesPlayed,
        wins: agg.wins,
        winPct: agg.matchesPlayed
          ? Math.round((agg.wins / agg.matchesPlayed) * 1000) / 10
          : undefined,
        points: Math.round(agg.points * 10) / 10,
        sweeps: agg.sweeps,
        miniSweeps: agg.miniSweeps,
        breakAndRuns: agg.breakAndRuns,
        eightOnBreaks: agg.eightOnBreaks,
        levelUps: agg.levelUps,
      });
    }

    // Merge AliasSessionStats supplements (PA/PPM/rackless from APA's API)
    // — but ONLY for Top Dogs lineage teams. Members may have played for other
    // teams the same season; those don't belong on a Top Dogs profile.
    if (member) {
      const aliasData = member.aliasSessionStats as AliasData;
      for (const p of aliasData?.alias?.players ?? []) {
        const teamId = p.team?.id;
        if (!teamId) continue;
        if (!oursTeamIds.has(teamId)) continue;
        const sessionInfo = teamIdToSessionInfo.get(teamId);
        if (!sessionInfo) continue;
        const existing = sessionsMap.get(sessionInfo.id) ?? {
          sessionId: sessionInfo.id,
          sessionName: sessionInfo.name,
          teamId,
          teamName: p.team?.name ?? sessionInfo.teamName,
          skillLevel: ebpIdToSkillLevel.get(p.id ?? 0),
        };
        existing.pa = typeof p.pa === "number" ? Math.round(p.pa * 1000) / 10 : existing.pa;
        existing.ppm = typeof p.ppm === "number" ? Math.round(p.ppm * 100) / 100 : existing.ppm;
        existing.rackless = p.rackless ?? existing.rackless;
        existing.skillLevel =
          existing.skillLevel ?? p.skillLevel ?? ebpIdToSkillLevel.get(p.id ?? 0);
        // Prefer match-derived values for matchesPlayed/wins (more accurate at session level
        // since AliasSessionStats only counts the player's matches on that team).
        existing.matchesPlayed =
          existing.matchesPlayed ?? p.matchesPlayed ?? undefined;
        existing.wins = existing.wins ?? p.matchesWon ?? undefined;
        sessionsMap.set(sessionInfo.id, existing);
      }
    }

    const sessionRecords = [...sessionsMap.values()].sort((a, b) => b.sessionId - a.sessionId);

    // Career totals: prefer match-derived; fall back to summing AliasSessionStats.
    const career = careers.get(memberNumber);
    const careerStats = career
      ? {
          matchesPlayed: career.matchesPlayed,
          wins: career.wins,
          losses: Math.max(career.matchesPlayed - career.wins, 0),
          points: Math.round(career.points * 10) / 10,
          sweeps: career.sweeps,
          miniSweeps: career.miniSweeps,
          breakAndRuns: career.breakAndRuns,
          eightOnBreaks: career.eightOnBreaks,
          levelUps: career.levelUps,
          winPct: career.matchesPlayed
            ? Math.round((career.wins / career.matchesPlayed) * 1000) / 10
            : 0,
        }
      : (() => {
          // Fallback to AliasSessionStats sums — restricted to Top Dogs teams.
          const aliasData = member?.aliasSessionStats as AliasData | undefined;
          let mp = 0,
            wins = 0,
            ms = 0;
          for (const p of aliasData?.alias?.players ?? []) {
            if (!p.team?.id || !oursTeamIds.has(p.team.id)) continue;
            mp += p.matchesPlayed ?? 0;
            wins += p.matchesWon ?? 0;
            ms += p.rackless ?? 0;
          }
          return {
            matchesPlayed: mp,
            wins,
            losses: Math.max(mp - wins, 0),
            points: ms * 0.5,
            sweeps: 0,
            miniSweeps: ms,
            breakAndRuns: 0,
            eightOnBreaks: 0,
            levelUps: 0,
            winPct: mp ? Math.round((wins / mp) * 1000) / 10 : 0,
          };
        })();

    const override = normalizedOverride(playersConfig, memberNumber);
    players.set(memberNumber, {
      id: memberNumber,
      name: override.nickname ?? memberMeta.name,
      internalId,
      currentSkillLevel: memberMeta.currentSL,
      format: memberMeta.format as PlayerProfile["format"],
      nickname: override.nickname,
      profileImage: override.profileImage,
      actionImage: override.actionImage,
      visible: override.visible !== false,
      current: sessionRecords.find((s) => s.sessionId === currentSessionId) ?? null,
      career: careerStats,
      sessions: sessionRecords,
    });
  }

  // Anonymize hidden players (visible:false in players-config.json) in every
  // match's per-player results. We KEEP the row so the match still displays
  // a complete 5-player lineup — just rename the slot to "Unknown" and prefix
  // the playerId with "hidden:" so consumers can detect anonymized rows the
  // same way they detect "ebp:" anonymous opponents. Per-player analytics
  // iterate the (visible-only) roster, so they never query these IDs.
  {
    const hiddenPlayerIds = new Set<string>();
    for (const [memberNumber, p] of players) {
      if (p.visible === false) hiddenPlayerIds.add(memberNumber);
    }
    if (hiddenPlayerIds.size > 0) {
      for (const [id, m] of matchesById) {
        if (!m.results?.length) continue;
        let mutated = false;
        const next = m.results.map((r) => {
          if (!hiddenPlayerIds.has(r.playerId)) return r;
          mutated = true;
          return { ...r, playerId: `hidden:${r.playerId}`, playerName: "Unknown" };
        });
        if (mutated) matchesById.set(id, { ...m, results: next });
      }
    }
  }

  // 8. Build leaderboards — one per session, plus "all".
  // We restrict each board to "our" players for that session — i.e. members
  // who appear on our team's roster in that session. The "all" board is the
  // union of every session-roster member we've ever had.
  type LBKey = number | "all";
  const leaderboards: Record<string, LeaderboardRow[]> = {};

  // Pre-compute eligible player IDs per session and overall, plus a name
  // resolver so past-team members (no longer on current roster) still have
  // human-readable names on the all-time leaderboard.
  const playersInSession = new Map<number, Set<string>>();
  const playersAllSessions = new Set<string>();
  const memberNumberToDisplayName = new Map<string, string>();
  for (const [tid, team] of teams) {
    const m = pickTeamMeta(team);
    if (!m?.session) continue;
    // Only include the team that's "ours" for that session (the one we
    // surfaced in `sessions[]`). This prevents counting opponents we
    // happened to scrape.
    const sessionEntry = sessions.find((s) => s.id === m.session?.id);
    if (!sessionEntry || sessionEntry.teamId !== tid) continue;
    const data = team.teamRoster as RosterShape;
    const set = playersInSession.get(m.session.id) ?? new Set<string>();
    for (const r of data?.team?.roster ?? []) {
      if (!r.memberNumber) continue;
      set.add(r.memberNumber);
      playersAllSessions.add(r.memberNumber);
      if (r.displayName && !memberNumberToDisplayName.has(r.memberNumber)) {
        memberNumberToDisplayName.set(r.memberNumber, r.displayName);
      }
    }
    playersInSession.set(m.session.id, set);
  }

  function buildLeaderboard(filter: LBKey): LeaderboardRow[] {
    type Acc = LeaderboardRow & { _participated: boolean };
    const acc = new Map<string, Acc>();
    const eligible =
      filter === "all"
        ? playersAllSessions
        : playersInSession.get(filter) ?? new Set<string>();
    for (const pid of eligible) {
      const override = normalizedOverride(playersConfig, pid);
      // Visibility: hidden players are excluded entirely from leaderboards.
      if (override.visible === false) continue;
      const profile = players.get(pid);
      const playerName =
        override.nickname ??
        profile?.name ??
        memberNumberToDisplayName.get(pid) ??
        pid;
      const row: Acc = {
        playerId: pid,
        playerName,
        points: 0,
        sweeps: 0,
        miniSweeps: 0,
        breakAndRuns: 0,
        eightOnBreaks: 0,
        levelUps: 0,
        matchesPlayed: 0,
        wins: 0,
        skillLevel: undefined,
        nickname: override.nickname,
        profileImage: override.profileImage,
        _participated: false,
      };
      acc.set(pid, row);
      if (filter === "all") {
        const car = careers.get(pid);
        if (car && car.matchesPlayed > 0) {
          row.points = Math.round(car.points * 10) / 10;
          row.sweeps = car.sweeps;
          row.miniSweeps = car.miniSweeps;
          row.breakAndRuns = car.breakAndRuns;
          row.eightOnBreaks = car.eightOnBreaks;
          row.levelUps = car.levelUps;
          row.matchesPlayed = car.matchesPlayed;
          row.wins = car.wins;
          row.skillLevel = profile?.currentSkillLevel ?? car.skillLevel;
          row._participated = true;
        }
      } else {
        const agg = aggregations.get(aggKey(filter, pid));
        if (agg && agg.matchesPlayed > 0) {
          row.points = Math.round(agg.points * 10) / 10;
          row.sweeps = agg.sweeps;
          row.miniSweeps = agg.miniSweeps;
          row.breakAndRuns = agg.breakAndRuns;
          row.eightOnBreaks = agg.eightOnBreaks;
          row.levelUps = agg.levelUps;
          row.matchesPlayed = agg.matchesPlayed;
          row.wins = agg.wins;
          row.skillLevel = agg.endingSkillLevel ?? agg.skillLevel;
          row._participated = true;
        }
      }
    }
    return [...acc.values()]
      .filter((r) => r._participated)
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.sweeps - a.sweeps ||
          b.miniSweeps - a.miniSweeps ||
          b.wins - a.wins ||
          a.playerName.localeCompare(b.playerName),
      )
      .map(({ _participated, ...row }) => {
        void _participated;
        return row;
      });
  }

  for (const s of sessions) {
    leaderboards[String(s.id)] = buildLeaderboard(s.id);
  }
  leaderboards["all"] = buildLeaderboard("all");

  // 9. Per-session rosters for the roster page session selector.
  // ONLY Top Dogs lineage teams — never the parallel non-ours teams that
  // current roster members may also play on.
  const sessionRosters: Record<string, RosterPlayer[]> = {};
  for (const [tid, team] of teams) {
    if (!oursTeamIds.has(tid)) continue;
    const m = pickTeamMeta(team);
    if (!m?.session) continue;
    // Each session's "ours" team is canonically `sessions[i].teamId`. If
    // multiple ours teams existed in one session (shouldn't happen, but be
    // safe), prefer that canonical one.
    const sessionEntry = sessions.find((s) => s.id === m.session?.id);
    if (!sessionEntry || sessionEntry.teamId !== tid) continue;
    const data = team.teamRoster as RosterShape;
    const out: RosterPlayer[] = [];
    for (const r of data?.team?.roster ?? []) {
      if (!r.memberNumber) continue;
      const override = normalizedOverride(playersConfig, r.memberNumber);
      const visible: boolean = override.visible !== false;
      // Hidden players are excluded from the roster (they still exist on
      // historical scoresheets, but won't list as a teammate anywhere).
      if (!visible) continue;
      const winPct =
        r.matchesPlayed && r.matchesWon !== undefined
          ? Math.round((r.matchesWon / r.matchesPlayed) * 1000) / 10
          : undefined;
      const agg = aggregations.get(aggKey(m.session.id, r.memberNumber));
      out.push({
        id: r.memberNumber,
        name: override.nickname ?? r.displayName ?? "Unknown",
        skillLevel: r.skillLevel ?? null,
        format: detectFormat(r.__typename),
        nickname: override.nickname,
        profileImage: override.profileImage,
        actionImage: override.actionImage,
        visible,
        stats: {
          wins: r.matchesWon,
          matchesPlayed: r.matchesPlayed,
          winPct,
          ppm: r.ppm !== undefined ? Math.round(r.ppm * 100) / 100 : undefined,
          pa: r.pa !== undefined ? Math.round(r.pa * 1000) / 10 : undefined,
          points: agg ? Math.round(agg.points * 10) / 10 : undefined,
          sweeps: agg?.sweeps,
          miniSweeps: agg?.miniSweeps,
          breakAndRuns: agg?.breakAndRuns,
          eightOnBreaks: agg?.eightOnBreaks,
        },
      });
    }
    sessionRosters[String(m.session.id)] = out;
  }

  // 9b. Per-session full division standings.
  // Map our team for each session → its division id → cached standings.
  type DivStandingsRow = {
    id?: number;
    name?: string;
    number?: string;
    standing?: number;
    sessionTotalPoints?: number;
    pointsLastWeek?: number;
    totalTeamMatchesPlayed?: number;
    isTied?: boolean;
    isBye?: boolean;
  };
  type DivStandingsData = { division?: { teams?: DivStandingsRow[] } };
  const sessionStandings: Record<string, AnyRec[]> = {};
  for (const session of sessions) {
    const team = teams.get(session.teamId);
    if (!team) continue;
    type Page = { team?: { division?: { id?: number } } };
    const divId = (team.teamPage as Page).team?.division?.id;
    if (!divId) continue;
    const div = divisions.get(divId);
    if (!div) continue;
    const data = div.divsionStandings as DivStandingsData;
    const rows = (data?.division?.teams ?? []).filter((t) => !t.isBye);

    // For "wins/losses" we need per-team sweeps stats. The division payload
    // has `totalTeamMatchesPlayed` (across both sides), so we estimate W/L
    // for our team from our cached schedule and leave it 0/0 for opponents.
    const ourTeamId = session.teamId;
    let oursWins = 0;
    let oursLosses = 0;
    for (const m of matchesById.values()) {
      if (m.teamId !== ourTeamId || m.status !== "completed") continue;
      if (
        typeof m.teamScore === "number" &&
        typeof m.opponentScore === "number"
      ) {
        if (m.teamScore > m.opponentScore) oursWins++;
        else if (m.teamScore < m.opponentScore) oursLosses++;
      }
    }

    const projected = rows
      .map((t) => {
        const isOurs = t.id === ourTeamId;
        return {
          rank: t.standing ?? 0,
          team: t.name ?? "Unknown",
          teamId: t.id,
          teamNumber: t.number,
          isOurs,
          points: t.sessionTotalPoints ?? 0,
          pointsLastWeek: t.pointsLastWeek,
          matchesPlayed: t.totalTeamMatchesPlayed ?? 0,
          wins: isOurs ? oursWins : 0,
          losses: isOurs ? oursLosses : 0,
          isTied: t.isTied === true,
        };
      })
      .sort(
        (a, b) =>
          (a.rank || 99) - (b.rank || 99) || b.points - a.points,
      );
    sessionStandings[String(session.id)] = projected;
  }

  // 10. Current-session metadata, schedule, standings, team summary.
  const teamMeta = currentMeta;
  const currentSchedule: Match[] = [];
  for (const m of matchesById.values()) {
    if (m.teamId === meta.teamId) currentSchedule.push(m);
  }
  currentSchedule.sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const completed = currentSchedule.filter((m) => m.status === "completed");
  const wins = completed.filter(
    (m) =>
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number" &&
      m.teamScore > m.opponentScore,
  ).length;
  const losses = completed.filter(
    (m) =>
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number" &&
      m.teamScore < m.opponentScore,
  ).length;

  const ourStanding = teamMeta.standing;
  type ScheduleData = { team?: { sessionTotalPoints?: number } };
  const sessionPoints = (currentTeam.teamSchedule as ScheduleData).team
    ?.sessionTotalPoints;

  // Prefer the full division standings (current session) when available;
  // fall back to a one-row standings array for older snapshots.
  const standings =
    sessionStandings[String(currentSessionId)] ??
    (ourStanding
      ? [
          {
            rank: ourStanding,
            team: teamMeta.name,
            isOurs: true,
            points: sessionPoints ?? 0,
            matchesPlayed: completed.length,
            wins,
            losses,
          },
        ]
      : []);

  const upcomingMatch =
    currentSchedule.find((m) => m.status === "upcoming") ?? null;
  const recentMatches = completed
    .slice()
    .reverse() // already sorted asc; reverse for newest-first
    .slice(0, 5);

  const teamSummary = {
    id: meta.teamId,
    name: teamMeta.name,
    number: teamMeta.number,
    division: teamMeta.division,
    divisionRank: teamMeta.standing,
    session: teamMeta.session?.name,
    homeLocation: teamMeta.homeLocation,
    format: detectFormat(teamMeta.divisionFormat),
    record: { wins, losses, points: sessionPoints },
    upcomingMatch,
    recentMatches,
  };

  // Current roster — canonical source is sessionRosters[currentSessionId].
  const currentRoster =
    (currentSessionId ? sessionRosters[String(currentSessionId)] : undefined) ??
    [];

  // matches map for the site (everything we have). Hidden-player results
  // were already filtered out of matchesById before this point.
  const matchesMap: Record<string, Match> = {};
  for (const [id, m] of matchesById) matchesMap[id] = m;

  // ---- Opponent teams + players (incremental, current-session) -------
  // Walk our current-session schedule, find opponent team ids in matches we
  // have cached, then for each opp team build an OpponentTeamProfile + a
  // simplified PlayerProfile per roster member from the cached member data.
  // Only includes opp teams whose data has been scraped; the opp scraper
  // step runs each weekly sync and accumulates over time.
  // Opp data is built primarily from cached MATCHES — every match's
  // payload includes both teams' full rosters with per-player stats
  // (matchesWon/Played, SL, pa, ppm) at the time of that match. Aggregating
  // across matches gives us per-player session records without needing
  // to fetch opp member pages at all.
  //
  // Optionally enriched by cached opp team pages (which give us their
  // future schedule + division standing) when available — but the core
  // per-player and per-session record is purely match-cache-driven.
  const opponentTeams: Record<string, AnyRec> = {};
  const opponentPlayers: Record<string, AnyRec> = {};

  type MatchSide = {
    id?: number;
    name?: string;
    number?: string;
    isMine?: boolean;
    league?: { id?: number; slug?: string };
    division?: { id?: number; type?: string };
    roster?: Array<{
      id?: number;
      memberNumber?: string;
      displayName?: string;
      matchesWon?: number;
      matchesPlayed?: number;
      pa?: number;
      ppm?: number;
      skillLevel?: number;
      __typename?: string;
      member?: { id?: number };
    }>;
  };
  type MatchPayload = {
    id?: number;
    isFinalized?: boolean;
    isBye?: boolean;
    home?: MatchSide;
    away?: MatchSide;
    session?: { id?: number; name?: string };
    division?: { id?: number; type?: string };
    league?: { slug?: string };
    location?: { name?: string };
    startTime?: string;
    week?: number;
    results?: Array<{ homeAway?: SideKey; points?: { total?: number } }>;
  };

  // Per-opp-team aggregate (built from match cache).
  type OppTeamAgg = {
    id: number;
    name: string;
    number?: string;
    divisionId?: number;
    sessionId?: number;
    sessionName?: string;
    format: string;
    leagueSlug?: string;
    perSessionWins: Map<number, number>;
    perSessionLosses: Map<number, number>;
    matchesVsUs: Set<string>;
    lastSeenStartTime: string;
  };
  const oppTeams = new Map<number, OppTeamAgg>();

  // Per-opp-player aggregate. We track each (memberNumber, sessionId) as a
  // single record; the most-recent match's roster snapshot is the most up-
  // to-date session totals.
  type OppPlayerSession = {
    sessionId: number;
    sessionName: string;
    teamId: number;
    teamName: string;
    skillLevel?: number;
    matchesPlayed: number;
    wins: number;
    pa?: number;
    ppm?: number;
    /** When this snapshot was observed — to keep the latest. */
    snapshotAt: number;
  };
  type OppPlayerAgg = {
    id: string; // memberNumber
    name: string;
    internalId?: number;
    format: string;
    sessions: Map<number, OppPlayerSession>;
  };
  const oppPlayers = new Map<string, OppPlayerAgg>();

  for (const mc of matchCache.values()) {
    const m = mc.match as MatchPayload;
    if (!m.session?.id) continue;
    const sessionId = m.session.id;
    const sessionName = m.session.name ?? `Session ${sessionId}`;
    const sides: Array<{ side: MatchSide | undefined; key: SideKey }> = [
      { side: m.home, key: "HOME" },
      { side: m.away, key: "AWAY" },
    ];
    // Identify which side is "us" for THIS match (any of our lineage teams).
    const oursSideKey = sides.find(
      (s) => typeof s.side?.id === "number" && oursTeamIds.has(s.side.id),
    )?.key;
    for (const { side, key } of sides) {
      if (!side?.id) continue;
      if (oursTeamIds.has(side.id)) continue; // skip our team
      const teamId = side.id;
      // Init or update team aggregate.
      let agg = oppTeams.get(teamId);
      if (!agg) {
        agg = {
          id: teamId,
          name: side.name ?? `Team #${teamId}`,
          number: side.number,
          divisionId: side.division?.id,
          sessionId,
          sessionName,
          format: detectFormat(side.division?.type ?? side.roster?.[0]?.__typename),
          leagueSlug: side.league?.slug ?? meta.leagueSlug,
          perSessionWins: new Map(),
          perSessionLosses: new Map(),
          matchesVsUs: new Set(),
          lastSeenStartTime: m.startTime ?? "",
        };
        oppTeams.set(teamId, agg);
      }
      // Keep latest session info.
      if (!m.startTime || m.startTime >= agg.lastSeenStartTime) {
        agg.lastSeenStartTime = m.startTime ?? agg.lastSeenStartTime;
        agg.sessionId = sessionId;
        agg.sessionName = sessionName;
        if (side.name) agg.name = side.name;
        if (side.number) agg.number = side.number;
      }
      // Cross-link match if it's vs us.
      if (oursSideKey && m.id && m.isFinalized) {
        agg.matchesVsUs.add(String(m.id));
      }
      // Compute their per-session record from this match's results.
      if (m.isFinalized && m.results) {
        const ourPts = m.results.find((r) => r.homeAway !== key)?.points?.total;
        const theirPts = m.results.find((r) => r.homeAway === key)?.points?.total;
        if (typeof ourPts === "number" && typeof theirPts === "number") {
          if (theirPts > ourPts)
            agg.perSessionWins.set(
              sessionId,
              (agg.perSessionWins.get(sessionId) ?? 0) + 1,
            );
          else if (theirPts < ourPts)
            agg.perSessionLosses.set(
              sessionId,
              (agg.perSessionLosses.get(sessionId) ?? 0) + 1,
            );
        }
      }
      // Aggregate per-roster-entry per-session player stats. The roster
      // shows season-to-date W/L for that team-session — keep the latest
      // snapshot.
      const snapshotAt = m.startTime ? +new Date(m.startTime) : Date.now();
      for (const r of side.roster ?? []) {
        if (!r.memberNumber) continue;
        let pAgg = oppPlayers.get(r.memberNumber);
        if (!pAgg) {
          pAgg = {
            id: r.memberNumber,
            name: r.displayName ?? r.memberNumber,
            internalId: r.member?.id,
            format: detectFormat(r.__typename),
            sessions: new Map(),
          };
          oppPlayers.set(r.memberNumber, pAgg);
        }
        // Always update the display name from the most-recent appearance.
        if (r.displayName && snapshotAt >= (pAgg.sessions.get(sessionId)?.snapshotAt ?? 0)) {
          pAgg.name = r.displayName;
        }
        const existing = pAgg.sessions.get(sessionId);
        // Take the snapshot with the highest matchesPlayed (latest snapshot
        // at end of session). Fall back to most-recent if same.
        const newMP = r.matchesPlayed ?? 0;
        const newWins = r.matchesWon ?? 0;
        const isMoreComplete =
          !existing ||
          newMP > existing.matchesPlayed ||
          (newMP === existing.matchesPlayed && snapshotAt > existing.snapshotAt);
        if (isMoreComplete) {
          pAgg.sessions.set(sessionId, {
            sessionId,
            sessionName,
            teamId,
            teamName: side.name ?? `Team #${teamId}`,
            skillLevel: r.skillLevel,
            matchesPlayed: newMP,
            wins: newWins,
            pa: r.pa !== undefined ? Math.round(r.pa * 1000) / 10 : undefined,
            ppm: r.ppm !== undefined ? Math.round(r.ppm * 100) / 100 : undefined,
            snapshotAt,
          });
        }
      }
    }
  }

  // Materialize opp team profiles. Roster comes from the most-recent match
  // we have against them; schedule + full record comes from cached opp team
  // page when available, otherwise we fall back to the vs-us record.
  type ScheduleMatchRaw = {
    id?: number;
    isFinalized?: boolean;
    isBye?: boolean;
    home?: { id?: number };
    away?: { id?: number };
    results?: Array<{ homeAway?: SideKey; points?: { total?: number } }>;
  };
  type ScheduleShape = { team?: { matches?: ScheduleMatchRaw[]; division?: { name?: string }; sessionTotalPoints?: number } };
  type TeamPageShape = { team?: { standing?: number; location?: { name?: string }; division?: { name?: string } } };

  for (const [teamId, agg] of oppTeams) {
    // Default vs-us record (used when we don't have the team's full schedule).
    const vsUsCurrentTotals = {
      wins: agg.perSessionWins.get(agg.sessionId ?? -1) ?? 0,
      losses: agg.perSessionLosses.get(agg.sessionId ?? -1) ?? 0,
    };
    let wins = vsUsCurrentTotals.wins;
    let losses = vsUsCurrentTotals.losses;
    let pointsTotal: number | undefined;
    let rank: number | undefined;
    let divisionName: string | undefined;
    let homeLocationName: string | undefined;

    // If we have the opp team's cached page, derive full session record from
    // their schedule (which includes all matches with home/away ids).
    const teamCacheEntry = teams.get(teamId);
    let schedule: Match[] = [];
    if (teamCacheEntry) {
      const teamPage = (teamCacheEntry.teamPage as TeamPageShape).team;
      const sched = (teamCacheEntry.teamSchedule as ScheduleShape).team;
      if (typeof teamPage?.standing === "number") rank = teamPage.standing;
      divisionName = teamPage?.division?.name;
      homeLocationName = teamPage?.location?.name;
      if (typeof sched?.sessionTotalPoints === "number") {
        pointsTotal = sched.sessionTotalPoints;
      }
      if (sched?.matches?.length) {
        let w = 0;
        let l = 0;
        for (const sm of sched.matches) {
          if (!sm.isFinalized || sm.isBye) continue;
          const ourSide: SideKey | null =
            sm.home?.id === teamId
              ? "HOME"
              : sm.away?.id === teamId
                ? "AWAY"
                : null;
          if (!ourSide) continue;
          const ours = sm.results?.find((r) => r.homeAway === ourSide)?.points
            ?.total;
          const opp = sm.results?.find((r) => r.homeAway !== ourSide)?.points
            ?.total;
          if (typeof ours !== "number" || typeof opp !== "number") continue;
          if (ours > opp) w++;
          else if (ours < opp) l++;
        }
        wins = w;
        losses = l;
      }
      const meta_ = pickTeamMeta(teamCacheEntry);
      if (meta_?.session) {
        schedule = projectScheduleMatches(
          teamCacheEntry,
          matchCache,
          ebpToMemberNumber,
          meta_.session,
          detectFormat(meta_.divisionFormat),
        );
      }
    }
    // Build their roster from the most-recent appearance per session: take
    // the players whose latest session = current session.
    const rosterPlayers: RosterPlayer[] = [];
    for (const p of oppPlayers.values()) {
      const rec = p.sessions.get(agg.sessionId ?? -1);
      if (rec && rec.teamId === teamId) {
        const winPct =
          rec.matchesPlayed > 0
            ? Math.round((rec.wins / rec.matchesPlayed) * 1000) / 10
            : undefined;
        rosterPlayers.push({
          id: p.id,
          name: p.name,
          skillLevel: rec.skillLevel ?? null,
          format: p.format,
          visible: true,
          stats: {
            wins: rec.wins,
            matchesPlayed: rec.matchesPlayed,
            winPct,
            ppm: rec.ppm,
            pa: rec.pa,
          },
        });
      }
    }
    opponentTeams[String(teamId)] = {
      id: teamId,
      name: agg.name,
      number: agg.number,
      division: divisionName,
      divisionRank: rank,
      sessionId: agg.sessionId,
      sessionName: agg.sessionName,
      homeLocation: homeLocationName,
      format: agg.format,
      url: `https://league.poolplayers.com/${agg.leagueSlug ?? meta.leagueSlug}/team/${teamId}`,
      record: {
        wins,
        losses,
        points: pointsTotal,
        rank,
      },
      roster: rosterPlayers,
      schedule,
      matchesVsUs: [...agg.matchesVsUs],
      lastFetched: new Date().toISOString(),
    };
  }

  // Materialize opp player profiles.
  for (const [memberNumber, agg] of oppPlayers) {
    const sessionRecords = [...agg.sessions.values()]
      .map((s) => ({
        sessionId: s.sessionId,
        sessionName: s.sessionName,
        teamId: s.teamId,
        teamName: s.teamName,
        skillLevel: s.skillLevel,
        matchesPlayed: s.matchesPlayed,
        wins: s.wins,
        winPct:
          s.matchesPlayed > 0
            ? Math.round((s.wins / s.matchesPlayed) * 1000) / 10
            : undefined,
        pa: s.pa,
        ppm: s.ppm,
        levelUps: 0,
      }))
      .sort((a, b) => b.sessionId - a.sessionId);
    const careerMatches = sessionRecords.reduce(
      (s, r) => s + r.matchesPlayed,
      0,
    );
    const careerWins = sessionRecords.reduce((s, r) => s + r.wins, 0);
    const currentRecord = sessionRecords.find(
      (r) => r.sessionId === currentSessionId,
    );
    opponentPlayers[memberNumber] = {
      id: memberNumber,
      name: agg.name,
      internalId: agg.internalId,
      currentSkillLevel: currentRecord?.skillLevel ?? null,
      format: agg.format,
      visible: true,
      current: currentRecord ?? null,
      career: {
        matchesPlayed: careerMatches,
        wins: careerWins,
        losses: Math.max(0, careerMatches - careerWins),
        winPct:
          careerMatches > 0
            ? Math.round((careerWins / careerMatches) * 1000) / 10
            : 0,
        points: 0,
        sweeps: 0,
        miniSweeps: 0,
        breakAndRuns: 0,
        eightOnBreaks: 0,
        levelUps: 0,
      },
      sessions: sessionRecords,
    };
  }

  const out_ = {
    lastUpdated: new Date().toISOString(),
    teamId: meta.teamId,
    sourceUrl: meta.sourceUrl,
    currentSession: currentMeta.session
      ? {
          id: currentMeta.session.id,
          name: currentMeta.session.name,
          teamId: meta.teamId,
        }
      : null,
    sessions,
    team: teamSummary,
    roster: currentRoster,
    schedule: currentSchedule,
    standings,
    matches: matchesMap,
    players: Object.fromEntries(players),
    leaderboards,
    sessionRosters,
    sessionStandings,
    opponentTeams,
    opponentPlayers,
  };

  await writeFile(resolve("data/apa.json"), JSON.stringify(out_, null, 2));
  const lbCurrent = leaderboards[String(currentSessionId)] ?? [];
  console.log(
    `→ wrote data/apa.json` +
      `\n  team=${teamSummary.name}  rank=#${teamSummary.divisionRank}  W=${wins}/L=${losses}` +
      `\n  sessions=${sessions.length}  matches=${Object.keys(matchesMap).length}  players=${players.size}` +
      `\n  current-session leaderboard top: ` +
      lbCurrent
        .slice(0, 3)
        .map((r) => `${r.playerName}(${r.points}pt)`)
        .join(", "),
  );

  // Silence unused vars from inlined code.
  void asObj;
  void asArray;
  void asNumber;
  void get;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
