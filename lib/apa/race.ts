/**
 * APA race-to-X chart for 8-ball.
 *
 * Each cell is the number of game wins MY side needs to win the team match,
 * given my skill level (row) vs. the opponent's skill level (column).
 *
 * The chart is **asymmetric** — the lower SL gets the shorter race (handicap),
 * which is the whole point of the system. SL2 vs SL7 is 2-vs-7 (the SL2 only
 * needs 2 wins, the SL7 has to win 7); SL5 vs SL7 is 4-vs-5; same-SL pairs
 * race to the standard target for that SL.
 *
 * The previous version of this chart had cells like (5,7)=5 and (7,5)=5,
 * which made the engine treat every same-pair race as "even" and produced
 * misleading 50% race-equity for every matchup. The correct chart hands the
 * structural advantage to the lower SL — which the live data above this comment
 * line in scoresheets reflects (SL2 winning at 2-anything, SL7 having to grind
 * to 7 vs an SL2, SL4 needing only 2 vs an SL7, etc.).
 *
 * Source: APA's published 8-Ball "Skill Level Race Chart" + cross-checked
 * against our division's own observed scoresheets (data/apa.json).
 */

const EIGHT_BALL_RACE: Record<number, Record<number, number>> = {
  // myWins given (mySL, theirSL).
  // Read row-wise: row 7 col 2 = 7 means SL7 needs 7 wins vs SL2.
  2: { 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2 },
  3: { 2: 3, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2 },
  4: { 2: 4, 3: 3, 4: 3, 5: 3, 6: 3, 7: 2 },
  5: { 2: 5, 3: 4, 4: 4, 5: 4, 6: 4, 7: 3 },
  6: { 2: 6, 3: 5, 4: 5, 5: 5, 6: 5, 7: 4 },
  7: { 2: 7, 3: 6, 4: 5, 5: 5, 6: 5, 7: 5 },
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
