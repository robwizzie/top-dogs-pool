"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "topdogs:bowliards-games";
const CHANGE_EVENT = "topdogs:bowliards-change";

/**
 * One frame's data.
 *   - frames 1..9: roll1 (0-10). If roll1 < 10, roll2 (0..10-roll1).
 *   - frame 10: roll1, then roll2; if strike/spare, roll3.
 * Unrolled values are undefined.
 */
export type Frame = {
  roll1?: number;
  roll2?: number;
  roll3?: number; // only legal on frame 10 after a strike or spare
};

export type BowliardsPlayer = {
  id: string;
  name: string;
  frames: Frame[]; // length 10
};

export type BowliardsGame = {
  id: string;
  drillId: string; // always "bowliards"
  startedAt: string;
  finishedAt?: string;
  players: BowliardsPlayer[];
};

type Store = {
  /** Game in progress (one at a time). Undefined = no live game. */
  current?: BowliardsGame;
  /** Completed games — newest first. */
  history: BowliardsGame[];
};

const EMPTY: Store = { history: [] };

function readStore(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY;
    return {
      current: parsed.current,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return EMPTY;
  }
}

function writeStore(store: Store) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function emptyFrames(): Frame[] {
  return Array.from({ length: 10 }, () => ({}));
}

function genId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Scoring helpers.
 * ────────────────────────────────────────────────────────────────────────── */

/** Linearize all rolls for bonus lookups. */
function flatRolls(frames: Frame[]): number[] {
  const rolls: number[] = [];
  frames.forEach((f, i) => {
    if (f.roll1 !== undefined) rolls.push(f.roll1);
    // Frames 1..9: only push roll2 if it actually happened (not a strike).
    if (i < 9) {
      if (f.roll1 !== 10 && f.roll2 !== undefined) rolls.push(f.roll2);
    } else {
      // Frame 10: every roll counts as-is.
      if (f.roll2 !== undefined) rolls.push(f.roll2);
      if (f.roll3 !== undefined) rolls.push(f.roll3);
    }
  });
  return rolls;
}

/** Per-frame cumulative totals. `undefined` means the frame's score isn't
 * yet determined (e.g. a strike without two more rolls recorded). */
export function frameTotals(frames: Frame[]): (number | undefined)[] {
  const rolls = flatRolls(frames);
  let rollIdx = 0;
  let cumulative = 0;
  const totals: (number | undefined)[] = [];

  for (let i = 0; i < 10; i++) {
    const f = frames[i];
    const r1 = f.roll1;
    if (r1 === undefined) {
      totals.push(undefined);
      continue;
    }

    if (i < 9) {
      if (r1 === 10) {
        // Strike: need next two rolls
        const b1 = rolls[rollIdx + 1];
        const b2 = rolls[rollIdx + 2];
        if (b1 === undefined || b2 === undefined) {
          totals.push(undefined);
        } else {
          cumulative += 10 + b1 + b2;
          totals.push(cumulative);
        }
        rollIdx += 1;
      } else {
        const r2 = f.roll2;
        if (r2 === undefined) {
          totals.push(undefined);
          rollIdx += 1;
          continue;
        }
        if (r1 + r2 === 10) {
          // Spare: need next one roll
          const b1 = rolls[rollIdx + 2];
          if (b1 === undefined) {
            totals.push(undefined);
          } else {
            cumulative += 10 + b1;
            totals.push(cumulative);
          }
        } else {
          cumulative += r1 + r2;
          totals.push(cumulative);
        }
        rollIdx += 2;
      }
    } else {
      // Frame 10
      const r1f = r1;
      const r2f = f.roll2;
      const r3f = f.roll3;
      const isStrike = r1f === 10;
      const isSpare = !isStrike && r2f !== undefined && r1f + r2f === 10;
      const needs3 = isStrike || isSpare;
      if (r2f === undefined) {
        totals.push(undefined);
      } else if (needs3 && r3f === undefined) {
        totals.push(undefined);
      } else {
        cumulative += r1f + (r2f ?? 0) + (r3f ?? 0);
        totals.push(cumulative);
      }
    }
  }
  return totals;
}

export function gameTotal(frames: Frame[]): number | undefined {
  const totals = frameTotals(frames);
  for (let i = totals.length - 1; i >= 0; i--) {
    if (totals[i] !== undefined) return totals[i];
  }
  return undefined;
}

/** Which (frameIndex, rollIndex) is next for a given player. Returns null
 * when the card is complete. */
export function nextRollSlot(frames: Frame[]): {
  frame: number;
  roll: 1 | 2 | 3;
} | null {
  for (let i = 0; i < 10; i++) {
    const f = frames[i];
    if (f.roll1 === undefined) return { frame: i, roll: 1 };
    if (i < 9) {
      if (f.roll1 !== 10 && f.roll2 === undefined) {
        return { frame: i, roll: 2 };
      }
    } else {
      // Frame 10
      if (f.roll2 === undefined) return { frame: i, roll: 2 };
      const isStrike = f.roll1 === 10;
      const isSpare = !isStrike && (f.roll1 ?? 0) + (f.roll2 ?? 0) === 10;
      if ((isStrike || isSpare) && f.roll3 === undefined) {
        return { frame: i, roll: 3 };
      }
    }
  }
  return null;
}

/** Highest legal pin count for the next slot, given prior rolls in that
 * frame (so we never let a "remaining pin" entry exceed 10 total). */
export function maxForNextRoll(frames: Frame[]): number {
  const slot = nextRollSlot(frames);
  if (!slot) return 0;
  const f = frames[slot.frame];
  if (slot.frame < 9) {
    if (slot.roll === 1) return 10;
    // roll 2 (not frame 10): remaining after roll 1
    return 10 - (f.roll1 ?? 0);
  }
  // Frame 10
  if (slot.roll === 1) return 10;
  if (slot.roll === 2) {
    if (f.roll1 === 10) return 10; // fresh rack after a strike
    return 10 - (f.roll1 ?? 0); // remaining pins
  }
  // roll 3 only legal after strike or spare
  const r1 = f.roll1 ?? 0;
  const r2 = f.roll2 ?? 0;
  if (r1 === 10) {
    return r2 === 10 ? 10 : 10 - r2;
  }
  return 10; // after a spare, fresh rack
}

/* ─────────────────────────────────────────────────────────────────────────
 * Hook.
 * ────────────────────────────────────────────────────────────────────────── */

export function useBowliardsGames() {
  const [store, setStore] = useState<Store>(EMPTY);

  useEffect(() => {
    setStore(readStore());
    function onChange() {
      setStore(readStore());
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const startGame = useCallback((playerNames: string[]) => {
    const game: BowliardsGame = {
      id: genId(),
      drillId: "bowliards",
      startedAt: new Date().toISOString(),
      players: playerNames.map((name, i) => ({
        id: `p_${i}_${Date.now().toString(36)}`,
        name: name.trim() || (playerNames.length === 1 ? "You" : `Player ${i + 1}`),
        frames: emptyFrames(),
      })),
    };
    const next = readStore();
    next.current = game;
    writeStore(next);
  }, []);

  /** Record one roll for the given player. */
  const recordRoll = useCallback((playerId: string, pins: number) => {
    const next = readStore();
    const game = next.current;
    if (!game) return;
    const player = game.players.find((p) => p.id === playerId);
    if (!player) return;
    const slot = nextRollSlot(player.frames);
    if (!slot) return; // card complete
    const max = maxForNextRoll(player.frames);
    const clamped = Math.max(0, Math.min(max, Math.round(pins)));
    const frame = player.frames[slot.frame];
    if (slot.roll === 1) frame.roll1 = clamped;
    else if (slot.roll === 2) frame.roll2 = clamped;
    else frame.roll3 = clamped;
    writeStore(next);
  }, []);

  /** Undo the most recent roll for a player. */
  const undoRoll = useCallback((playerId: string) => {
    const next = readStore();
    const game = next.current;
    if (!game) return;
    const player = game.players.find((p) => p.id === playerId);
    if (!player) return;
    // Walk frames in reverse, clear the most-recent recorded roll.
    for (let i = 9; i >= 0; i--) {
      const f = player.frames[i];
      if (i === 9 && f.roll3 !== undefined) {
        f.roll3 = undefined;
        writeStore(next);
        return;
      }
      if (f.roll2 !== undefined) {
        f.roll2 = undefined;
        writeStore(next);
        return;
      }
      if (f.roll1 !== undefined) {
        f.roll1 = undefined;
        writeStore(next);
        return;
      }
    }
  }, []);

  /** Finish the current game: move it into history. */
  const finishGame = useCallback(() => {
    const next = readStore();
    if (!next.current) return;
    const finished = { ...next.current, finishedAt: new Date().toISOString() };
    next.history = [finished, ...next.history].slice(0, 50);
    next.current = undefined;
    writeStore(next);
  }, []);

  /** Discard the live game without saving to history. */
  const cancelGame = useCallback(() => {
    const next = readStore();
    next.current = undefined;
    writeStore(next);
  }, []);

  /** Wipe history (preserves any live game). */
  const clearHistory = useCallback(() => {
    writeStore({ current: readStore().current, history: [] });
  }, []);

  /** Wipe everything. */
  const clearAll = useCallback(() => {
    writeStore(EMPTY);
  }, []);

  return {
    current: store.current,
    history: store.history,
    startGame,
    recordRoll,
    undoRoll,
    finishGame,
    cancelGame,
    clearHistory,
    clearAll,
  };
}
