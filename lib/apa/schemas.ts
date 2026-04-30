import { z } from "zod";

export const Format = z.enum(["8-ball", "9-ball", "masters", "doubles", "unknown"]);
export type Format = z.infer<typeof Format>;

export const Player = z.object({
  id: z.string(),
  name: z.string(),
  skillLevel: z.number().int().min(1).max(9).nullable(),
  format: Format.default("unknown"),
  url: z.string().url().optional(),
});
export type Player = z.infer<typeof Player>;

export const PlayerStats = z.object({
  id: z.string(),
  name: z.string(),
  skillLevel: z.number().int().min(1).max(9).nullable(),
  format: Format,
  matchesPlayed: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  innings: z.number().int().min(0).optional(),
  defensiveShots: z.number().int().min(0).optional(),
  /** 8-ball: matches won; 9-ball: points / points-needed average. */
  pa: z.number().min(0).optional(),
  mpr: z.number().min(0).optional(),
});
export type PlayerStats = z.infer<typeof PlayerStats>;

export const MatchResult = z.object({
  /** Top Dogs player id */
  playerId: z.string(),
  playerName: z.string(),
  opponentName: z.string(),
  /** "W" or "L" for the Top Dogs player */
  outcome: z.enum(["W", "L"]),
  /** Score-line e.g. "3-0", "2-1" if scraped */
  score: z.string().optional(),
  /** True when the Top Dogs player won without giving up a single rack/point. */
  miniSweep: z.boolean().default(false),
});
export type MatchResult = z.infer<typeof MatchResult>;

export const Match = z.object({
  id: z.string(),
  week: z.number().int().min(0).optional(),
  date: z.string(), // ISO
  opponent: z.string(),
  location: z.string().optional(),
  /** Top Dogs team points if completed */
  teamScore: z.number().int().min(0).optional(),
  opponentScore: z.number().int().min(0).optional(),
  status: z.enum(["upcoming", "completed", "forfeit", "bye"]).default("upcoming"),
  /** Whether the Top Dogs swept the team match (max possible points, 0 to opponent). */
  sweep: z.boolean().default(false),
  results: z.array(MatchResult).default([]),
  url: z.string().url().optional(),
});
export type Match = z.infer<typeof Match>;

export const Standing = z.object({
  rank: z.number().int().min(0),
  team: z.string(),
  isOurs: z.boolean().default(false),
  points: z.number().min(0),
  matchesPlayed: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
});
export type Standing = z.infer<typeof Standing>;

export const TeamSummary = z.object({
  name: z.string(),
  division: z.string().optional(),
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

export type LeaderboardRow = {
  playerId: string;
  playerName: string;
  sweeps: number;
  miniSweeps: number;
  matchesPlayed: number;
  wins: number;
};
