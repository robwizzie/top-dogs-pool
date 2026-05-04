/**
 * APA race-to-X chart for 8-ball.
 *
 * Each cell is the number of game wins that side needs to win the team match,
 * given their skill level vs. the opponent's. The chart is symmetric around
 * the diagonal (lower SL needs fewer wins; equal SL means equal race).
 *
 * Source: APA's published 8-Ball "Skill Level Race Chart". If APA tweaks the
 * matrix or you want to handle SL1/8/9 edge cases differently, edit here —
 * everything downstream (mini-sweep detection, leaderboard scoring) reads
 * `winsRequired()`.
 */

const EIGHT_BALL_RACE: Record<number, Record<number, number>> = {
  // myWins given (mySL, theirSL)
  2: { 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4 },
  3: { 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4 },
  4: { 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5 },
  5: { 2: 3, 3: 3, 4: 4, 5: 4, 6: 5, 7: 5 },
  6: { 2: 3, 3: 4, 4: 4, 5: 5, 6: 5, 7: 6 },
  7: { 2: 4, 3: 4, 4: 5, 5: 5, 6: 6, 7: 7 },
};

/**
 * Wins my-side needs to win the team match. Defaults conservatively (3 wins)
 * when an SL is missing or out-of-range so leaderboard scoring still works
 * on edge data — mini-sweep detection will be slightly off but at least it
 * won't crash.
 */
export function winsRequired(
  mySkill: number | undefined | null,
  theirSkill: number | undefined | null,
  format: "8-ball" | "9-ball" | string | undefined = "8-ball",
): number {
  if (format !== "8-ball") return 3; // 9-ball is point-based, not modeled here yet.
  const my = clamp(mySkill);
  const their = clamp(theirSkill);
  if (my === null || their === null) return 3;
  return EIGHT_BALL_RACE[my]?.[their] ?? 3;
}

/**
 * "On the hill" = one game away from winning. Returning the number of wins
 * that constitutes being on the hill for that side.
 */
export function hillThreshold(
  mySkill: number | undefined | null,
  theirSkill: number | undefined | null,
  format: "8-ball" | "9-ball" | string | undefined = "8-ball",
): number {
  return Math.max(0, winsRequired(mySkill, theirSkill, format) - 1);
}

function clamp(v: number | undefined | null): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < 2) return 2;
  if (v > 7) return 7;
  return Math.round(v);
}
