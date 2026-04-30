import type { LeaderboardRow, Match, Player } from "./schemas";

/**
 * Derive the sweeps leaderboard from match results.
 *
 *  • Sweep      = the team won a match while giving up zero points (e.g. 5-0 / 3-0).
 *                 Every player who participated in that match gets credited a sweep.
 *  • Mini-sweep = an individual Top Dogs player won their game without giving up
 *                 a single rack/point (per `result.miniSweep` flag).
 */
export function buildLeaderboard(roster: Player[], matches: Match[]): LeaderboardRow[] {
  const byPlayer = new Map<string, LeaderboardRow>();

  for (const p of roster) {
    byPlayer.set(p.id, {
      playerId: p.id,
      playerName: p.name,
      sweeps: 0,
      miniSweeps: 0,
      matchesPlayed: 0,
      wins: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== "completed") continue;

    const ourPlayersInMatch = new Set<string>();
    for (const r of match.results) {
      ourPlayersInMatch.add(r.playerId);
      const row = ensure(byPlayer, r.playerId, r.playerName);
      row.matchesPlayed += 1;
      if (r.outcome === "W") row.wins += 1;
      if (r.miniSweep) row.miniSweeps += 1;
    }

    if (match.sweep) {
      for (const id of ourPlayersInMatch) {
        const row = byPlayer.get(id);
        if (row) row.sweeps += 1;
      }
    }
  }

  return [...byPlayer.values()].sort(
    (a, b) =>
      b.sweeps - a.sweeps ||
      b.miniSweeps - a.miniSweeps ||
      b.wins - a.wins ||
      a.playerName.localeCompare(b.playerName),
  );
}

function ensure(
  map: Map<string, LeaderboardRow>,
  id: string,
  name: string,
): LeaderboardRow {
  let row = map.get(id);
  if (!row) {
    row = {
      playerId: id,
      playerName: name,
      sweeps: 0,
      miniSweeps: 0,
      matchesPlayed: 0,
      wins: 0,
    };
    map.set(id, row);
  }
  return row;
}
