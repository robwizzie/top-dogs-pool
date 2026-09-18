/**
 * The week's story.
 *
 * Patch Watch is a season-long tally, which is exactly what makes it flat: the
 * numbers only creep, so there is nothing to notice on any given Wednesday.
 * This computes what actually changed on the most recent match night — who
 * gained, who moved, which patches were earned — so the page can lead with
 * news instead of a standings table that looks the same as last week.
 *
 * It deliberately does no scoring of its own. An earlier cut of this module
 * re-derived the week's points from the scoresheets, and promptly disagreed
 * with the board above it: its level-up rule was session-scoped where the
 * patch engine's is career-scoped, so Fall 2025 week 16 read "1 point this
 * week, 0 patches won". Now the week's points come from the same patch
 * instances the totals are built from, and the prior ranks come from the rows
 * already on screen minus what was gained — so the recap cannot contradict
 * the numbers underneath it.
 */

import { loadSnapshot } from "./client";
import { rankWithTies } from "./rank";
import type { LeaderboardRow } from "./schemas";
import type {
  PatchInstance,
  PatchInstanceKind,
  PlayerPatchInstances,
} from "./index";

/**
 * What each patch is worth. Mirrors the scoring the projector applies — a
 * mini-sweep is the half-point consolation, everything else is a point.
 */
const PATCH_POINTS: Record<PatchInstanceKind, number> = {
  sweep: 1,
  "mini-sweep": 0.5,
  "break-and-run": 1,
  "8-on-break": 1,
  "level-up": 1,
  "first-win": 1,
  mvp: 1,
};

export type WeekMover = {
  playerId: string;
  playerName: string;
  /** Points earned on this match night alone. */
  gained: number;
  /** Rank before the week, if it could be computed. */
  priorRank: number | null;
  /** Positive = climbed, negative = slipped, 0 = held. Null when unknown. */
  rankDelta: number | null;
  wins: number;
  matchesPlayed: number;
};

export type WeekPatch = {
  playerId: string;
  playerName: string;
  kind: PatchInstanceKind;
  instance: PatchInstance;
};

export type WeekRecap = {
  /** Week number within the session. */
  week: number;
  /** ISO date of the match night. */
  date: string | null;
  opponent: string | null;
  /** Our score vs theirs, when the scoresheet has it. */
  teamScore: number | null;
  opponentScore: number | null;
  /** Points the whole team put on the board this week. */
  teamPoints: number;
  /** Everyone who played, best first. */
  movers: WeekMover[];
  /** Patches earned this week, best first. */
  patches: WeekPatch[];
  /** Ranks as they stood before this week, for every player on the board. */
  priorRanks: Map<string, number>;
  /**
   * Places gained (+) or lost (−) this week, for every player on the board —
   * not just the ones who played. A player who sat out and got passed did
   * move, and the board should say so.
   */
  rankDeltas: Map<string, number>;
  /** Match ids that make up this week — what patches are attributed against. */
  matchIds: Set<string>;
};

/**
 * The most recent completed week for a session, and who played in it.
 *
 * Returns null when there is nothing to say: no completed matches, or the
 * scoresheets carry no week numbers. The caller renders nothing rather than an
 * empty flourish.
 *
 * The points are not filled in yet — pass the result through
 * `attachWeekPatches` and then `attachCurrentRanks`, in that order.
 *
 * `sessionId` defaults to the current session. "All time" has no meaningful
 * "this week", so callers pass a concrete session or get null.
 */
export async function getWeekRecap(
  sessionId?: number,
): Promise<WeekRecap | null> {
  const snap = await loadSnapshot();
  const targetSession = sessionId ?? snap.currentSession?.id;
  if (targetSession === undefined) return null;

  const played = Object.values(snap.matches).filter(
    (m) =>
      m.sessionId === targetSession &&
      m.status === "completed" &&
      typeof m.week === "number",
  );
  if (played.length === 0) return null;

  const latestWeek = Math.max(...played.map((m) => m.week ?? 0));
  const thisWeek = played.filter((m) => m.week === latestWeek);

  const movers = new Map<string, WeekMover>();
  for (const m of thisWeek) {
    for (const r of m.results) {
      if (isSyntheticPlayer(r.playerId)) continue;
      let mover = movers.get(r.playerId);
      if (!mover) {
        mover = {
          playerId: r.playerId,
          playerName: r.playerName,
          gained: 0,
          priorRank: null,
          rankDelta: null,
          wins: 0,
          matchesPlayed: 0,
        };
        movers.set(r.playerId, mover);
      }
      mover.matchesPlayed += 1;
      if (r.outcome === "W") mover.wins += 1;
    }
  }

  const head = thisWeek[0] ?? null;

  return {
    week: latestWeek,
    date: head?.date ?? null,
    opponent: head?.opponent ?? null,
    teamScore: head?.teamScore ?? null,
    opponentScore: head?.opponentScore ?? null,
    teamPoints: 0,
    movers: [...movers.values()],
    patches: [],
    priorRanks: new Map(),
    rankDeltas: new Map(),
    matchIds: new Set(thisWeek.map((m) => m.id)),
  };
}

/**
 * Attribute the week's patches — and therefore the week's points.
 *
 * Matched by match id rather than date: two match nights can fall in the same
 * calendar week, and a rescheduled one can land nowhere near its week number.
 * Instances with no match behind them (a mid-session re-rate, a session MVP)
 * belong to no particular Tuesday, so they are left out of the week's news.
 *
 * `instances` must be scoped to the same session the recap covers, which is
 * the only scope the page shows a recap for.
 */
export function attachWeekPatches(
  recap: WeekRecap,
  instances: Map<string, PlayerPatchInstances>,
  nameOf: (playerId: string) => string,
): WeekRecap {
  const byPlayer = new Map(recap.movers.map((m) => [m.playerId, m]));
  const patches: WeekPatch[] = [];

  for (const [playerId, bag] of instances) {
    for (const [kind, list] of Object.entries(bag) as [
      PatchInstanceKind,
      PatchInstance[],
    ][]) {
      for (const instance of list ?? []) {
        if (!instance.matchId || !recap.matchIds.has(instance.matchId)) continue;
        patches.push({ playerId, playerName: nameOf(playerId), kind, instance });

        const mover = byPlayer.get(playerId);
        if (mover) mover.gained += PATCH_POINTS[kind] ?? 0;
      }
    }
  }

  // Sweeps first, then the rarer per-rack feats — the order people care about.
  const weight: Record<string, number> = {
    sweep: 0,
    "8-on-break": 1,
    "break-and-run": 2,
    "level-up": 3,
    "first-win": 4,
    mvp: 5,
    "mini-sweep": 6,
  };
  patches.sort((a, b) => (weight[a.kind] ?? 9) - (weight[b.kind] ?? 9));

  recap.patches = patches;
  recap.teamPoints = recap.movers.reduce((s, m) => s + m.gained, 0);
  recap.movers.sort(
    (a, b) =>
      b.gained - a.gained ||
      b.wins - a.wins ||
      a.playerName.localeCompare(b.playerName),
  );
  return recap;
}

/**
 * Work out where everyone stood before the week, and how far they moved.
 *
 * Prior points are simply the points on screen minus what was gained this
 * week, so the arrows are arithmetic on the board itself rather than a second
 * pass over the scoresheets that could drift from it. Both ends use the same
 * competition ranking the board displays, so a player who was joint first and
 * is still joint first has moved nothing — which is what the page claims.
 *
 * Call after `attachWeekPatches`; it needs `gained`.
 */
export function attachCurrentRanks(
  recap: WeekRecap,
  rows: LeaderboardRow[],
): WeekRecap {
  const gainedBy = new Map(recap.movers.map((m) => [m.playerId, m.gained]));
  const priorPointsOf = (r: LeaderboardRow) =>
    r.points - (gainedBy.get(r.playerId) ?? 0);

  const currentRanks = new Map<string, number>();
  for (const { row, rank } of rankWithTies(rows, (r) => r.points)) {
    currentRanks.set(row.playerId, rank);
  }

  // The prior board has to be re-sorted: last week's order is not this week's.
  const priorOrder = [...rows].sort(
    (a, b) =>
      priorPointsOf(b) - priorPointsOf(a) ||
      b.wins - a.wins ||
      a.playerName.localeCompare(b.playerName),
  );
  recap.priorRanks = new Map();
  for (const { row, rank } of rankWithTies(priorOrder, priorPointsOf)) {
    recap.priorRanks.set(row.playerId, rank);
  }

  recap.rankDeltas = new Map();
  for (const row of rows) {
    const prior = recap.priorRanks.get(row.playerId);
    const now = currentRanks.get(row.playerId);
    if (prior === undefined || now === undefined) continue;
    recap.rankDeltas.set(row.playerId, prior - now);
  }

  for (const mover of recap.movers) {
    mover.priorRank = recap.priorRanks.get(mover.playerId) ?? null;
    mover.rankDelta = recap.rankDeltas.get(mover.playerId) ?? null;
  }
  return recap;
}

/* ------------------------------------------------------------------ utils */

/** APA's scoresheets carry placeholder entries we never rank. */
function isSyntheticPlayer(id: string): boolean {
  return id.startsWith("ebp:") || id.startsWith("hidden:");
}
