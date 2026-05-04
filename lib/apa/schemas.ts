import { z } from "zod";

export const Format = z.enum(["8-ball", "9-ball", "masters", "doubles", "unknown"]);
export type Format = z.infer<typeof Format>;

const PlayerStatsBlock = z
  .object({
    wins: z.number().int().min(0).optional(),
    matchesPlayed: z.number().int().min(0).optional(),
    winPct: z.number().min(0).max(100).optional(),
    ppm: z.number().min(0).optional(),
    pa: z.number().min(0).max(100).optional(),
    points: z.number().min(0).optional(),
    sweeps: z.number().int().min(0).optional(),
    miniSweeps: z.number().int().min(0).optional(),
    breakAndRuns: z.number().int().min(0).optional(),
    eightOnBreaks: z.number().int().min(0).optional(),
  })
  .partial();

export const Player = z.object({
  id: z.string(),
  name: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  skillLevel: z.number().int().min(0).max(9).nullable(),
  format: Format.default("unknown"),
  url: z.string().url().optional(),
  stats: PlayerStatsBlock.optional(),
  /** Optional display overrides applied by the projector from data/players-config.json. */
  nickname: z.string().optional(),
  profileImage: z.string().optional(),
  actionImage: z.string().optional(),
  visible: z.boolean().default(true),
});
export type Player = z.infer<typeof Player>;

export const PlayerStats = z.object({
  id: z.string(),
  name: z.string(),
  skillLevel: z.number().int().min(0).max(9).nullable(),
  format: Format,
  matchesPlayed: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  pa: z.number().min(0).optional(),
  ppm: z.number().min(0).optional(),
  winPct: z.number().min(0).max(100).optional(),
  points: z.number().min(0).optional(),
  sweeps: z.number().int().min(0).optional(),
  miniSweeps: z.number().int().min(0).optional(),
  breakAndRuns: z.number().int().min(0).optional(),
  eightOnBreaks: z.number().int().min(0).optional(),
});
export type PlayerStats = z.infer<typeof PlayerStats>;

export const MatchResult = z.object({
  playerId: z.string(),
  playerName: z.string(),
  opponentName: z.string(),
  /** Player's skill level *at the time of the match*. */
  skillLevel: z.number().int().min(0).max(9).optional(),
  opponentSkillLevel: z.number().int().min(0).max(9).optional(),
  outcome: z.enum(["W", "L"]),
  /** "X-Y" — player's wins vs opponent's wins. */
  score: z.string().optional(),
  /** True if player won AND opponent scored 0 (full shutout). 1 leaderboard point. */
  sweep: z.boolean().default(false),
  /** True if player won AND opponent didn't reach the hill (race-to minus 1).
   *  Mutually exclusive with `sweep`. 0.5 leaderboard points. */
  miniSweep: z.boolean().default(false),
  /** Player ran the rack from the break in 8-ball/9-ball. 1 leaderboard point. */
  breakAndRun: z.boolean().default(false),
  /** Player sank the 8 on the break. 1 leaderboard point. */
  eightOnBreak: z.boolean().default(false),
  forfeited: z.boolean().default(false),
  /** Slot label from APA (e.g. "8A", "8B"). 8A = first match, 8E = anchor. */
  teamSlot: z.string().nullable().optional(),
  /** 1-based match position in the team match (1=lead, 5=anchor for 8-ball). */
  matchPosition: z.number().int().min(1).max(5).optional(),
});
export type MatchResult = z.infer<typeof MatchResult>;

export const Match = z.object({
  id: z.string(),
  teamId: z.number().int().optional(),
  sessionId: z.number().int().optional(),
  sessionName: z.string().optional(),
  week: z.number().int().min(0).optional(),
  date: z.string(),
  opponent: z.string(),
  location: z.string().optional(),
  /** True when our side was the home team for this match. */
  isHome: z.boolean().optional(),
  teamScore: z.number().int().min(0).optional(),
  opponentScore: z.number().int().min(0).optional(),
  status: z.enum(["upcoming", "completed", "forfeit", "bye"]).default("upcoming"),
  /** Team-level shutout — kept for backwards-compat; rarely true. */
  sweep: z.boolean().default(false),
  results: z.array(MatchResult).default([]),
  url: z.string().url().optional(),
});
export type Match = z.infer<typeof Match>;

export const Standing = z.object({
  rank: z.number().int().min(0),
  team: z.string(),
  teamId: z.number().int().optional(),
  teamNumber: z.string().optional(),
  isOurs: z.boolean().default(false),
  points: z.number().min(0),
  pointsLastWeek: z.number().min(0).nullable().optional(),
  matchesPlayed: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  isTied: z.boolean().default(false),
});
export type Standing = z.infer<typeof Standing>;

export const TeamSummary = z.object({
  id: z.number().int().optional(),
  name: z.string(),
  number: z.string().optional(),
  division: z.string().optional(),
  divisionRank: z.number().int().optional(),
  session: z.string().optional(),
  homeLocation: z.string().optional(),
  format: Format.default("unknown"),
  record: z.object({
    wins: z.number().int().min(0),
    losses: z.number().int().min(0),
    points: z.number().min(0).optional(),
  }),
  upcomingMatch: Match.nullable(),
  recentMatches: z.array(Match).default([]),
});
export type TeamSummary = z.infer<typeof TeamSummary>;

export const SessionRecord = z.object({
  id: z.number().int(),
  name: z.string(),
  teamId: z.number().int(),
  format: Format.default("unknown"),
});
export type SessionRecord = z.infer<typeof SessionRecord>;

export const SessionPlayerRecord = z.object({
  sessionId: z.number().int(),
  sessionName: z.string(),
  teamId: z.number().int(),
  teamName: z.string(),
  skillLevel: z.number().int().min(0).max(9).optional(),
  /** Highest SL the player reached during this session (= startSL + levelUps). */
  endingSkillLevel: z.number().int().min(0).max(9).optional(),
  /** SL the player started this session at (first match). */
  startingSkillLevel: z.number().int().min(0).max(9).optional(),
  matchesPlayed: z.number().int().min(0).optional(),
  wins: z.number().int().min(0).optional(),
  winPct: z.number().min(0).max(100).optional(),
  pa: z.number().min(0).max(100).optional(),
  ppm: z.number().min(0).optional(),
  rackless: z.number().int().min(0).optional(),
  /** Computed by the projector from match scoresheets. */
  points: z.number().min(0).optional(),
  sweeps: z.number().int().min(0).optional(),
  miniSweeps: z.number().int().min(0).optional(),
  breakAndRuns: z.number().int().min(0).optional(),
  eightOnBreaks: z.number().int().min(0).optional(),
  /** Number of skill-level increases observed during this session (1pt each). */
  levelUps: z.number().int().min(0).default(0),
});
export type SessionPlayerRecord = z.infer<typeof SessionPlayerRecord>;

export const PlayerProfile = z.object({
  id: z.string(),
  name: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  internalId: z.number().int().optional(),
  currentSkillLevel: z.number().int().min(0).max(9).nullable(),
  format: Format,
  /** Display overrides from data/players-config.json. */
  nickname: z.string().optional(),
  profileImage: z.string().optional(),
  actionImage: z.string().optional(),
  visible: z.boolean().default(true),
  current: SessionPlayerRecord.nullable(),
  career: z.object({
    matchesPlayed: z.number().int().min(0),
    wins: z.number().int().min(0),
    losses: z.number().int().min(0),
    winPct: z.number().min(0).max(100),
    points: z.number().min(0),
    sweeps: z.number().int().min(0),
    miniSweeps: z.number().int().min(0),
    breakAndRuns: z.number().int().min(0),
    eightOnBreaks: z.number().int().min(0),
    levelUps: z.number().int().min(0).default(0),
  }),
  sessions: z.array(SessionPlayerRecord),
});
export type PlayerProfile = z.infer<typeof PlayerProfile>;

export const LeaderboardRow = z.object({
  playerId: z.string(),
  playerName: z.string(),
  /** Total leaderboard points (sweep=1, mini=0.5, B&R=1, 8oB=1, level-up=1). */
  points: z.number().min(0),
  sweeps: z.number().int().min(0),
  miniSweeps: z.number().int().min(0),
  breakAndRuns: z.number().int().min(0),
  eightOnBreaks: z.number().int().min(0),
  /** Skill-level increases observed during the session(s) this row covers. */
  levelUps: z.number().int().min(0).default(0),
  matchesPlayed: z.number().int().min(0),
  wins: z.number().int().min(0),
  /** Skill level — current for "all", in-session ending SL for per-session leaderboards. */
  skillLevel: z.number().int().min(0).max(9).optional(),
  /** Optional display overrides. */
  nickname: z.string().optional(),
  profileImage: z.string().optional(),
});
export type LeaderboardRow = z.infer<typeof LeaderboardRow>;

/**
 * An opposing team we've scraped data for. Mirrors TeamSummary in shape but
 * scoped to a specific session (since opp teams change roster session-to-
 * session). The roster + schedule + record are everything we know from
 * crawling their team page.
 */
export const OpponentTeamProfile = z.object({
  id: z.number().int(),
  name: z.string(),
  number: z.string().optional(),
  division: z.string().optional(),
  divisionRank: z.number().int().optional(),
  /** Session this snapshot is for. */
  sessionId: z.number().int().optional(),
  sessionName: z.string().optional(),
  homeLocation: z.string().optional(),
  format: Format.default("8-ball"),
  url: z.string().url().optional(),
  /** Their team-level record this session. */
  record: z.object({
    wins: z.number().int().min(0),
    losses: z.number().int().min(0),
    points: z.number().min(0).optional(),
    rank: z.number().int().optional(),
  }),
  /** Their full roster this session. */
  roster: z.array(Player).default([]),
  /** Their full schedule this session (includes matches not against us). */
  schedule: z.array(Match).default([]),
  /** Our team's match-id list against this opp (for cross-linking). */
  matchesVsUs: z.array(z.string()).default([]),
  /** When this team's data was last cached (for freshness display). */
  lastFetched: z.string(),
});
export type OpponentTeamProfile = z.infer<typeof OpponentTeamProfile>;

export const ApaSnapshot = z.object({
  lastUpdated: z.string(),
  teamId: z.number().int(),
  sourceUrl: z.string().optional(),
  currentSession: z
    .object({
      id: z.number().int(),
      name: z.string(),
      teamId: z.number().int(),
    })
    .nullable()
    .optional(),
  sessions: z.array(SessionRecord).default([]),
  team: TeamSummary,
  roster: z.array(Player).default([]),
  schedule: z.array(Match).default([]),
  standings: z.array(Standing).default([]),
  matches: z.record(z.string(), Match).default({}),
  players: z.record(z.string(), PlayerProfile).default({}),
  /**
   * Per-session leaderboard arrays, plus an "all" key for career totals.
   * Each entry is sorted by points desc.
   */
  leaderboards: z.record(z.string(), z.array(LeaderboardRow)).default({}),
  /** Roster snapshots per session (for the roster page session selector). */
  sessionRosters: z.record(z.string(), z.array(Player)).default({}),
  /** Full division standings per session (sessionId → all teams in division). */
  sessionStandings: z.record(z.string(), z.array(Standing)).default({}),
  /**
   * Opponent teams we've scraped data for (keyed by team id as a string).
   * Built incrementally — each week we fetch the upcoming opponent's full
   * team profile (roster + their schedule + record). Empty until the first
   * opponent scrape lands.
   */
  opponentTeams: z.record(z.string(), OpponentTeamProfile).default({}),
  /**
   * Opponent player profiles (keyed by player id as a string). Same shape
   * as `players` but flagged via `isOpponent: true`. Populated when we
   * scrape an opponent team — each of their roster members gets pulled in
   * with their full career stats.
   */
  opponentPlayers: z.record(z.string(), PlayerProfile).default({}),
});
export type ApaSnapshot = z.infer<typeof ApaSnapshot>;
