/**
 * Handicap charts for Rack Up matches.
 *
 * The old Lovable app computed an 8-ball race as `skillLevel - 1` (with a
 * hand-rolled special case for SL2). That is not the APA chart — it makes
 * every matchup symmetric and gets the handicap backwards for the spread
 * matchups that matter most (SL4 vs SL7 is 2-vs-5, not 3-vs-6).
 *
 * 8-ball reuses the chart the rest of the site already scores against
 * (lib/apa/race.ts) so a race shown live in Rack Up matches the race the
 * leaderboard assumes when it detects a mini-sweep from a real scoresheet.
 *
 * 9-ball is a different game entirely: it is *point*-based, not rack-based.
 * Each object ball is worth 1 point and the 9 is worth 2, so a full rack is
 * 10 points, and a player wins by reaching a points target set by skill
 * level. The old app toggled a `game_type` column but ran 9-ball through the
 * rack-by-rack 8-ball scoreboard, which is why 9-ball scores never made
 * sense.
 */

import { winsRequired as eightBallWinsRequired } from "@/lib/apa/race";

export type GameType = "8-ball" | "9-ball";

export const GAME_TYPES: readonly GameType[] = ["8-ball", "9-ball"] as const;

/** Valid skill-level range per game type. APA 9-ball runs 1-9, 8-ball 2-7. */
export const SKILL_RANGE: Record<GameType, { min: number; max: number }> = {
  "8-ball": { min: 2, max: 7 },
  "9-ball": { min: 1, max: 9 },
};

/**
 * APA 9-Ball points-to-win chart. Unlike 8-ball this is a flat lookup — a
 * player's target depends only on their own skill level, not the matchup.
 */
const NINE_BALL_POINTS: Record<number, number> = {
  1: 14,
  2: 19,
  3: 25,
  4: 31,
  5: 38,
  6: 46,
  7: 55,
  8: 65,
  9: 75,
};

/** Points a single ball is worth in 9-ball. The 9 is worth 2, everything else 1. */
export const NINE_BALL_BALL_POINTS = 1;
export const NINE_BALL_NINE_POINTS = 2;
/** A cleanly run rack is 8 × 1 + 2 = 10 points. */
export const NINE_BALL_RACK_POINTS = 10;

export function clampSkill(
  value: number | null | undefined,
  game: GameType,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const { min, max } = SKILL_RANGE[game];
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * The target a player must reach to win the match.
 *
 * - 8-ball: racks won, from the asymmetric APA race chart (matchup-dependent).
 * - 9-ball: points, from the APA 9-ball chart (own skill level only).
 *
 * Returns `null` when a required skill level is missing, so callers can
 * refuse to start a match rather than silently inventing a race — the old app
 * defaulted to SL4 mid-match, which quietly changed a player's target.
 */
export function targetFor(
  game: GameType,
  mySkill: number | null | undefined,
  theirSkill: number | null | undefined,
): number | null {
  const mine = clampSkill(mySkill, game);
  if (mine === null) return null;

  if (game === "9-ball") return NINE_BALL_POINTS[mine] ?? null;

  const theirs = clampSkill(theirSkill, game);
  if (theirs === null) return null;
  return eightBallWinsRequired(mine, theirs, "8-ball");
}

/**
 * Score at which a player is one scoring event away from winning.
 *
 * In 8-ball that is literally one rack. In 9-ball "the hill" is fuzzier —
 * a player can win from several points out in a single inning — so we treat
 * being within a rack's worth of points (10) as the hill, which is the
 * convention the APA scoresheet's "on the hill" marker uses.
 */
export function hillScore(game: GameType, target: number): number {
  if (game === "9-ball") return Math.max(0, target - NINE_BALL_RACK_POINTS);
  return Math.max(0, target - 1);
}

export function isOnHill(game: GameType, score: number, target: number): boolean {
  return score >= hillScore(game, target) && score < target;
}

/**
 * Timeouts a player is allowed per rack. APA gives the lower skill levels an
 * extra one. The old app hard-coded the 8-ball rule and then re-read it out of
 * the database on every rack (an N+1 query per rack win).
 */
export function timeoutsPerRack(
  game: GameType,
  skill: number | null | undefined,
): number {
  const sl = clampSkill(skill, game);
  if (sl === null) return 1;
  return sl <= 3 ? 2 : 1;
}

/** Human-readable race label, e.g. "Race to 4 — 3" or "38 — 25 points". */
export function raceLabel(
  game: GameType,
  targetA: number,
  targetB: number,
): string {
  if (game === "9-ball") return `${targetA} — ${targetB} points`;
  return `Race ${targetA} — ${targetB}`;
}
