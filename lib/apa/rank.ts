/**
 * Standings ranks that admit ties.
 *
 * The leaderboard's sort applies tiebreakers (sweeps, then mini-sweeps, then
 * wins, then name) so the list has a stable order — but that order is not the
 * same thing as a ranking. Three players on one point each are joint first,
 * and numbering them 1, 2, 3 quietly claims a winner the scoresheets never
 * produced. This computes standard competition ranking (1, 1, 1, 4) off the
 * points alone, leaving the tiebreakers to do what they're for: deciding what
 * order to print, not who is ahead.
 */

export type RankedRow<T> = {
  row: T;
  /** Competition rank: joint positions share a number, the next one skips. */
  rank: number;
  /** True when at least one other row holds the same rank. */
  tied: boolean;
};

export function rankWithTies<T>(
  rows: T[],
  pointsOf: (row: T) => number,
): RankedRow<T>[] {
  const out: RankedRow<T>[] = [];
  let rank = 0;
  let lastPoints: number | null = null;

  rows.forEach((row, i) => {
    const points = pointsOf(row);
    // A new score claims this position; an equal one inherits the rank above.
    if (lastPoints === null || points !== lastPoints) {
      rank = i + 1;
      lastPoints = points;
    }
    out.push({ row, rank, tied: false });
  });

  // Second pass: a rank held by more than one row is a tie.
  const counts = new Map<number, number>();
  for (const r of out) counts.set(r.rank, (counts.get(r.rank) ?? 0) + 1);
  for (const r of out) r.tied = (counts.get(r.rank) ?? 0) > 1;

  return out;
}
