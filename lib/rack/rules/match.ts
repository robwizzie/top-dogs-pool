/**
 * The Rack Up match rules engine.
 *
 * This module is pure: no React, no Supabase, no clock. A match is an initial
 * setup plus an ordered log of events, and the current state is always
 * `replay(setup, events)`. Everything else in the section — the phone
 * scoreboard, the TV display, the tournament runner — renders a state
 * produced here.
 *
 * Why an event log rather than mutating rows (what the Lovable app did):
 *
 *   · **Undo is exact.** Undo drops the last event and replays. The old app
 *     stored a hand-written inverse for each action ("oldScore", "oldBreaker",
 *     "oldRackInnings"…) and applied it as a patch; any action whose inverse
 *     was incomplete — rack wins that also moved a patch counter, timeouts
 *     that reset on a rack boundary — left the match subtly wrong.
 *   · **Concurrency is detectable.** Each event has a sequence number, so two
 *     phones scoring the same match can't silently clobber each other; the
 *     second write is rejected and replayed instead of overwriting.
 *   · **The scoresheet is reconstructible.** The log *is* the scoresheet, so
 *     recaps and stats are derived rather than accumulated (and so can't drift
 *     away from what actually happened).
 */

import {
  clampSkill,
  NINE_BALL_NINE_POINTS,
  NINE_BALL_RACK_POINTS,
  hillScore,
  isOnHill,
  targetFor,
  timeoutsPerRack,
  type GameType,
} from "./race";

/* -------------------------------------------------------------------------
 * Setup + state
 * ---------------------------------------------------------------------- */

export type PlayerSide = 0 | 1;

export type MatchPlayerSetup = {
  userId: string;
  name: string;
  /** Skill level for the game type being played. */
  skill: number;
  /** Score needed to win: racks in 8-ball, points in 9-ball. */
  target: number;
};

export type MatchSetup = {
  game: GameType;
  /** Index 0 always breaks the first rack. */
  players: [MatchPlayerSetup, MatchPlayerSetup];
  /** Casual matches are played for fun and excluded from lifetime stats. */
  isCasual: boolean;
};

export type MatchPlayerState = {
  userId: string;
  name: string;
  skill: number;
  target: number;
  /** Racks won (8-ball) or points scored (9-ball). */
  score: number;
  /** Turns at the table. */
  innings: number;
  safeties: number;
  defensiveShots: number;
  timeoutsRemaining: number;
  timeoutsUsed: number;
  breakAndRuns: number;
  eightOnBreaks: number;
  /** 9-ball: the 9 pocketed on the break. */
  nineOnSnaps: number;
  /** Racks won outright without the opponent reaching the table. */
  rackless: number;
  brokeFirst: boolean;
};

export type MatchState = {
  game: GameType;
  isCasual: boolean;
  players: [MatchPlayerState, MatchPlayerState];
  /** Whose turn it is. */
  turn: PlayerSide;
  /** Who breaks the rack in progress. */
  breaker: PlayerSide;
  /** 1-based rack number currently being played. */
  rack: number;
  /** Completed innings across the whole match. */
  totalInnings: number;
  /** Completed innings in the current rack. */
  rackInnings: number;
  /** 9-ball only: points already scored in the rack in progress. */
  rackPoints: number;
  /** 9-ball only: points removed from the rack as dead balls. */
  deadBalls: number;
  status: "in_progress" | "complete";
  winner: PlayerSide | null;
  /** Set when the match ended by forfeit rather than by reaching a target. */
  forfeitedBy: PlayerSide | null;
  /** Sequence number of the last applied event. Matches the DB version. */
  version: number;
};

/* -------------------------------------------------------------------------
 * Events
 * ---------------------------------------------------------------------- */

export type MatchEvent =
  /** Turn passes to the other player without a score. */
  | { type: "turn_over" }
  /** 8-ball: a rack was won. */
  | {
      type: "rack_won";
      side: PlayerSide;
      /** How the rack ended — drives the patch counters. */
      kind: "normal" | "break_and_run" | "eight_on_break";
      /** True when the loser never got to the table this rack. */
      rackless?: boolean;
    }
  /** 9-ball: balls pocketed by the player at the table. */
  | { type: "points"; side: PlayerSide; points: number; nineOnSnap?: boolean }
  /** 9-ball: balls that left the table without scoring for anyone. */
  | { type: "dead_balls"; points: number }
  /** 9-ball: the rack is over; re-rack and pass the break. */
  | { type: "rack_end" }
  | { type: "safety"; side: PlayerSide }
  | { type: "defensive_shot"; side: PlayerSide }
  | { type: "timeout"; side: PlayerSide }
  /** Undo a mis-tapped timeout without spending it. */
  | { type: "timeout_cancelled"; side: PlayerSide }
  | { type: "forfeit"; side: PlayerSide }
  /** Host correction: set a counter directly. */
  | {
      type: "adjust";
      side: PlayerSide;
      field: AdjustableField;
      delta: number;
    };

export type AdjustableField =
  | "score"
  | "innings"
  | "safeties"
  | "defensiveShots"
  | "breakAndRuns"
  | "eightOnBreaks"
  | "nineOnSnaps";

/* -------------------------------------------------------------------------
 * Construction
 * ---------------------------------------------------------------------- */

export function initialState(setup: MatchSetup): MatchState {
  const mk = (p: MatchPlayerSetup, side: PlayerSide): MatchPlayerState => ({
    userId: p.userId,
    name: p.name,
    skill: p.skill,
    target: p.target,
    score: 0,
    innings: 0,
    safeties: 0,
    defensiveShots: 0,
    timeoutsRemaining: timeoutsPerRack(setup.game, p.skill),
    timeoutsUsed: 0,
    breakAndRuns: 0,
    eightOnBreaks: 0,
    nineOnSnaps: 0,
    rackless: 0,
    brokeFirst: side === 0,
  });

  return {
    game: setup.game,
    isCasual: setup.isCasual,
    players: [mk(setup.players[0], 0), mk(setup.players[1], 1)],
    turn: 0,
    breaker: 0,
    rack: 1,
    totalInnings: 0,
    rackInnings: 0,
    rackPoints: 0,
    deadBalls: 0,
    status: "in_progress",
    winner: null,
    forfeitedBy: null,
    version: 0,
  };
}

/**
 * Build a setup from two players, refusing rather than guessing when a skill
 * level is missing. The old app fell back to SL4 mid-match, which silently
 * moved a player's race.
 */
export function buildSetup(args: {
  game: GameType;
  isCasual: boolean;
  breaker: PlayerSide;
  players: [
    { userId: string; name: string; skill: number | null | undefined },
    { userId: string; name: string; skill: number | null | undefined },
  ];
}):
  | { ok: true; setup: MatchSetup }
  | { ok: false; error: string } {
  const [a, b] = args.players;
  if (a.userId === b.userId) {
    return { ok: false, error: "A player can't be matched against themselves." };
  }

  // Name the player who is actually missing a skill level. An 8-ball race
  // needs *both* levels, so deriving the blame from a null target would
  // always accuse the first player.
  const missing = [a, b].filter((p) => clampSkill(p.skill, args.game) === null);
  if (missing.length > 0) {
    const names = missing.map((p) => p.name).join(" and ");
    const verb = missing.length > 1 ? "have" : "has";
    return {
      ok: false,
      error: `${names} ${verb} no ${args.game} skill level set — add one on their profile first.`,
    };
  }

  const targetA = targetFor(args.game, a.skill, b.skill);
  const targetB = targetFor(args.game, b.skill, a.skill);
  if (targetA === null || targetB === null) {
    return { ok: false, error: `Couldn't work out a ${args.game} race for this matchup.` };
  }

  const ordered: [MatchPlayerSetup, MatchPlayerSetup] = [
    { userId: a.userId, name: a.name, skill: a.skill as number, target: targetA },
    { userId: b.userId, name: b.name, skill: b.skill as number, target: targetB },
  ];

  // Index 0 breaks first, so put the chosen breaker there.
  const players: [MatchPlayerSetup, MatchPlayerSetup] =
    args.breaker === 0 ? ordered : [ordered[1], ordered[0]];

  return { ok: true, setup: { game: args.game, isCasual: args.isCasual, players } };
}

/* -------------------------------------------------------------------------
 * Reducer
 * ---------------------------------------------------------------------- */

const other = (side: PlayerSide): PlayerSide => (side === 0 ? 1 : 0);

/**
 * Apply one event. Always returns a new state; never mutates. Events that
 * don't apply (scoring after the match is over, spending a timeout that isn't
 * there) are ignored rather than throwing, so a replayed log from an older
 * client version can never wedge the UI.
 */
export function reduce(state: MatchState, event: MatchEvent): MatchState {
  if (state.status === "complete" && event.type !== "adjust") return state;

  const next = cloneState(state);
  next.version = state.version + 1;

  switch (event.type) {
    case "turn_over": {
      passTurn(next);
      break;
    }

    case "rack_won": {
      if (next.game !== "8-ball") break;
      const p = next.players[event.side];
      p.score += 1;
      if (event.kind === "break_and_run") p.breakAndRuns += 1;
      if (event.kind === "eight_on_break") p.eightOnBreaks += 1;
      if (event.rackless) p.rackless += 1;
      startNewRack(next, event.side);
      settleIfWon(next);
      break;
    }

    case "points": {
      if (next.game !== "9-ball") break;
      const p = next.players[event.side];
      const points = Math.max(0, Math.round(event.points));
      p.score += points;
      next.rackPoints += points;
      if (event.nineOnSnap) {
        p.nineOnSnaps += 1;
        p.eightOnBreaks += 1; // shared "on the break" patch counter
      }
      settleIfWon(next);
      break;
    }

    case "dead_balls": {
      if (next.game !== "9-ball") break;
      const points = Math.max(0, Math.round(event.points));
      next.deadBalls += points;
      next.rackPoints += points;
      break;
    }

    case "rack_end": {
      if (next.game !== "9-ball") break;
      // Whoever pockets the 9 breaks the next rack; in practice the host taps
      // "rack over" after the 9 drops, so the player at the table breaks next.
      startNewRack(next, next.turn);
      break;
    }

    case "safety": {
      next.players[event.side].safeties += 1;
      break;
    }

    case "defensive_shot": {
      next.players[event.side].defensiveShots += 1;
      break;
    }

    case "timeout": {
      const p = next.players[event.side];
      if (p.timeoutsRemaining <= 0) return state; // nothing to spend
      p.timeoutsRemaining -= 1;
      p.timeoutsUsed += 1;
      break;
    }

    case "timeout_cancelled": {
      const p = next.players[event.side];
      if (p.timeoutsUsed <= 0) return state;
      p.timeoutsRemaining += 1;
      p.timeoutsUsed -= 1;
      break;
    }

    case "forfeit": {
      next.status = "complete";
      next.winner = other(event.side);
      next.forfeitedBy = event.side;
      break;
    }

    case "adjust": {
      const p = next.players[event.side];
      const field = event.field;
      p[field] = Math.max(0, p[field] + Math.round(event.delta));
      if (field === "score") {
        // A correction can both finish and un-finish a match.
        if (p.score >= p.target) settleIfWon(next);
        else if (next.forfeitedBy === null) {
          next.status = "in_progress";
          next.winner = null;
        }
      }
      break;
    }
  }

  return next;
}

/** Fold an event log into a state. The single source of truth for "now". */
export function replay(setup: MatchSetup, events: MatchEvent[]): MatchState {
  return events.reduce(reduce, initialState(setup));
}

function passTurn(state: MatchState) {
  state.turn = other(state.turn);
  state.players[state.turn].innings += 1;
  // An inning completes when the table comes back round to the breaker.
  if (state.turn === state.breaker) {
    state.totalInnings += 1;
    state.rackInnings += 1;
  }
}

function startNewRack(state: MatchState, winnerSide: PlayerSide) {
  state.rack += 1;
  state.rackInnings = 0;
  state.rackPoints = 0;
  state.deadBalls = 0;
  // Winner breaks the next rack (APA alternates only on a tie-breaker rule we
  // don't model; winner-breaks is what the team actually plays).
  state.breaker = winnerSide;
  state.turn = winnerSide;
  for (const p of state.players) {
    p.timeoutsRemaining = timeoutsPerRack(state.game, p.skill);
    p.timeoutsUsed = 0;
  }
}

function settleIfWon(state: MatchState) {
  for (const side of [0, 1] as const) {
    if (state.players[side].score >= state.players[side].target) {
      state.status = "complete";
      state.winner = side;
      return;
    }
  }
}

function cloneState(state: MatchState): MatchState {
  return {
    ...state,
    players: [{ ...state.players[0] }, { ...state.players[1] }],
  };
}

/* -------------------------------------------------------------------------
 * Derived read models
 * ---------------------------------------------------------------------- */

export type HillState = {
  /** Sides currently one score away from winning. */
  onHill: PlayerSide[];
  hillHill: boolean;
};

export function hillState(state: MatchState): HillState {
  const onHill = ([0, 1] as const).filter((side) =>
    isOnHill(state.game, state.players[side].score, state.players[side].target),
  );
  return { onHill: [...onHill], hillHill: onHill.length === 2 };
}

/**
 * Patch (achievement) detection, shared with the rest of the site's
 * vocabulary so a Rack Up sweep means the same thing as an APA sweep.
 *
 * - **Sweep** — won without the opponent scoring at all.
 * - **Mini-sweep** — won while the opponent never reached the hill. This
 *   didn't exist in the Lovable app at all, even though it's half a point on
 *   the team's Patch Watch board.
 */
export type PatchKind =
  | "sweep"
  | "mini-sweep"
  | "break-and-run"
  | "8-on-break"
  | "9-on-snap";

export type EarnedPatch = { kind: PatchKind; side: PlayerSide; count: number };

export function earnedPatches(state: MatchState): EarnedPatch[] {
  const out: EarnedPatch[] = [];
  for (const side of [0, 1] as const) {
    const p = state.players[side];
    if (p.breakAndRuns > 0)
      out.push({ kind: "break-and-run", side, count: p.breakAndRuns });
    if (p.eightOnBreaks > 0 && state.game === "8-ball")
      out.push({ kind: "8-on-break", side, count: p.eightOnBreaks });
    if (p.nineOnSnaps > 0)
      out.push({ kind: "9-on-snap", side, count: p.nineOnSnaps });
  }

  if (state.status === "complete" && state.winner !== null && !state.forfeitedBy) {
    const win = state.winner;
    const lose = other(win);
    const loser = state.players[lose];
    if (loser.score === 0) {
      out.push({ kind: "sweep", side: win, count: 1 });
    } else if (loser.score < hillScore(state.game, loser.target)) {
      out.push({ kind: "mini-sweep", side: win, count: 1 });
    }
  }

  return out;
}

/**
 * "Sweep watch" — the winner is one score from a sweep and the opponent is
 * still on zero. Drives the on-table callout so the room knows it's live.
 */
export function sweepWatch(state: MatchState): PlayerSide | null {
  if (state.status === "complete") return null;
  for (const side of [0, 1] as const) {
    const me = state.players[side];
    const them = state.players[other(side)];
    if (them.score === 0 && isOnHill(state.game, me.score, me.target)) return side;
  }
  return null;
}

/** Points/racks still needed, per side. */
export function remaining(state: MatchState, side: PlayerSide): number {
  const p = state.players[side];
  return Math.max(0, p.target - p.score);
}

/**
 * Whether a 9-ball rack still has points on the table. Used to stop the host
 * ending a rack that hasn't actually been cleared.
 */
export function nineBallRackComplete(state: MatchState): boolean {
  return state.game === "9-ball" && state.rackPoints >= NINE_BALL_RACK_POINTS;
}

export { NINE_BALL_NINE_POINTS, NINE_BALL_RACK_POINTS };
