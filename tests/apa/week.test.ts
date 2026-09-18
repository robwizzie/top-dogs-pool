/**
 * The week recap's two pure steps.
 *
 * These are the functions that decide what the page claims changed on match
 * night, and the bug they were rewritten to kill — a week's points that the
 * season totals underneath never awarded — is invisible in a screenshot. The
 * first test below is that exact regression.
 */

import { attachWeekPatches, attachCurrentRanks } from "@/lib/apa/week";
import type { WeekRecap } from "@/lib/apa/week";
import type { PlayerPatchInstances } from "@/lib/apa";
import type { LeaderboardRow } from "@/lib/apa/schemas";

let fail = 0;
const check = (n: string, c: boolean, e?: unknown) => {
  if (!c) {
    fail++;
    console.log("FAIL:", n, JSON.stringify(e ?? ""));
  }
};

/** A recap with everyone having played, before points are attributed. */
function recapOf(
  ids: string[],
  matchIds: string[] = ["m-week"],
): WeekRecap {
  return {
    week: 2,
    date: "2026-09-15T19:30:00-04:00",
    opponent: "The Railhouse",
    teamScore: 12,
    opponentScore: 9,
    teamPoints: 0,
    movers: ids.map((id) => ({
      playerId: id,
      playerName: id,
      gained: 0,
      priorRank: null,
      rankDelta: null,
      wins: 1,
      matchesPlayed: 1,
    })),
    patches: [],
    priorRanks: new Map(),
    rankDeltas: new Map(),
    matchIds: new Set(matchIds),
  };
}

function rowOf(id: string, points: number, wins = 1): LeaderboardRow {
  return {
    playerId: id,
    playerName: id,
    points,
    sweeps: 0,
    miniSweeps: 0,
    breakAndRuns: 0,
    eightOnBreaks: 0,
    levelUps: 0,
    firstWin: 0,
    mvp: 0,
    matchesPlayed: 2,
    wins,
  } as LeaderboardRow;
}

const instancesOf = (
  entries: [string, string, string | undefined][],
): Map<string, PlayerPatchInstances> => {
  const out = new Map<string, PlayerPatchInstances>();
  for (const [playerId, kind, matchId] of entries) {
    const bag = (out.get(playerId) ?? {}) as Record<string, unknown[]>;
    bag[kind] = [...((bag[kind] as unknown[]) ?? []), { matchId }];
    out.set(playerId, bag as PlayerPatchInstances);
  }
  return out;
};

/* ---- points come from patches, and only from patches ----------------- */

{
  // The regression: a match night with no patches is a night with no points,
  // however the scoresheet's skill levels happen to read.
  const recap = recapOf(["a", "b"]);
  attachWeekPatches(recap, instancesOf([]), (id) => id);
  check("no patches means no points", recap.teamPoints === 0, recap.teamPoints);
  check("no patches listed", recap.patches.length === 0);
}

{
  const recap = recapOf(["greg", "jake", "aaron"]);
  attachWeekPatches(
    recap,
    instancesOf([
      ["greg", "sweep", "m-week"],
      ["jake", "sweep", "m-week"],
      ["aaron", "mini-sweep", "m-week"],
    ]),
    (id) => id,
  );
  check("mini-sweep is worth a half", recap.teamPoints === 2.5, recap.teamPoints);
  check("all three patches listed", recap.patches.length === 3);
  check(
    "sweeps sort ahead of mini-sweeps",
    recap.patches[2].kind === "mini-sweep",
    recap.patches.map((p) => p.kind),
  );
  check(
    "best mover first",
    recap.movers[2].playerId === "aaron",
    recap.movers.map((m) => [m.playerId, m.gained]),
  );
}

{
  // A re-rate with no match behind it belongs to no particular Tuesday.
  const recap = recapOf(["a"]);
  attachWeekPatches(
    recap,
    instancesOf([
      ["a", "level-up", undefined],
      ["a", "sweep", "other-week"],
    ]),
    (id) => id,
  );
  check("unattributed patches stay out", recap.teamPoints === 0, recap.teamPoints);
  check("another week's patches stay out", recap.patches.length === 0);
}

/* ---- rank movement --------------------------------------------------- */

{
  // Greg and Jake each swept from nothing; Meghan held her point without
  // playing. Prior board: Meghan 1, everyone else 0.
  const recap = recapOf(["greg", "jake"]);
  attachWeekPatches(
    recap,
    instancesOf([
      ["greg", "sweep", "m-week"],
      ["jake", "sweep", "m-week"],
    ]),
    (id) => id,
  );
  const rows = [
    rowOf("greg", 1),
    rowOf("jake", 1),
    rowOf("meghan", 1),
    rowOf("robert", 0),
  ];
  attachCurrentRanks(recap, rows);

  check(
    "a three-way tie is joint first",
    recap.rankDeltas.get("greg") === 1 && recap.rankDeltas.get("jake") === 1,
    [...recap.rankDeltas],
  );
  check(
    "holding the lead alone and then sharing it is no movement",
    recap.rankDeltas.get("meghan") === 0,
    recap.rankDeltas.get("meghan"),
  );
  check(
    "a player who sat out and got passed still moved",
    recap.rankDeltas.get("robert") === -2,
    recap.rankDeltas.get("robert"),
  );
  check(
    "movers carry the same delta the board does",
    recap.movers.every((m) => m.rankDelta === recap.rankDeltas.get(m.playerId)),
  );
  check(
    "prior ranks cover everyone, not just who played",
    recap.priorRanks.size === 4,
    recap.priorRanks.size,
  );
}

console.log(fail === 0 ? "ALL WEEK TESTS PASSED" : `${fail} FAILURES`);
process.exit(fail === 0 ? 0 : 1);
