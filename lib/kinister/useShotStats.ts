"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "topdogs:shot-stats";
const CHANGE_EVENT = "topdogs:shot-stats-change";
/** Keep the last N sessions per shot — older entries roll off automatically. */
const MAX_SESSIONS = 14;

export type ShotSession = {
  /** ISO date string (yyyy-mm-dd) in the user's local timezone. */
  date: string;
  attempts: number;
  makes: number;
};

export type ShotStats = {
  totalAttempts: number;
  totalMakes: number;
  sessions: ShotSession[];
};

/**
 * Read every shot's stats at once (snapshot). Stays in sync via storage
 * events. Useful for dashboard-style aggregate views.
 */
export function useAllShotStats(): Record<string, ShotStats> {
  const [all, setAll] = useState<Record<string, ShotStats>>({});
  useEffect(() => {
    setAll(readAll());
    function onChange() {
      setAll(readAll());
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return all;
}

/**
 * Days since the player last logged an attempt on this shot. Returns null
 * if they've never attempted it.
 */
export function daysSinceLastAttempt(stats: ShotStats): number | null {
  if (stats.sessions.length === 0) return null;
  const newest = stats.sessions[0]; // we unshift newest first
  const [y, m, d] = newest.date.split("-").map(Number);
  const then = new Date(y, (m ?? 1) - 1, d ?? 1);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = today.getTime() - then.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

type AllStats = Record<string, ShotStats>;

const EMPTY: ShotStats = { totalAttempts: 0, totalMakes: 0, sessions: [] };

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readAll(): AllStats {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(stats: AllStats) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function recordHit(prev: ShotStats, made: boolean): ShotStats {
  const today = todayKey();
  const sessions = [...prev.sessions];
  const lastIdx = sessions.findIndex((s) => s.date === today);
  if (lastIdx >= 0) {
    sessions[lastIdx] = {
      ...sessions[lastIdx],
      attempts: sessions[lastIdx].attempts + 1,
      makes: sessions[lastIdx].makes + (made ? 1 : 0),
    };
  } else {
    sessions.unshift({
      date: today,
      attempts: 1,
      makes: made ? 1 : 0,
    });
  }
  return {
    totalAttempts: prev.totalAttempts + 1,
    totalMakes: prev.totalMakes + (made ? 1 : 0),
    sessions: sessions.slice(0, MAX_SESSIONS),
  };
}

/**
 * Per-shot attempts/makes tracker stored in localStorage. Increments today's
 * session count (or starts a new one) when the player logs a make or miss.
 */
export function useShotStats(shotId: string) {
  const [all, setAll] = useState<AllStats>({});

  useEffect(() => {
    setAll(readAll());
    function onChange() {
      setAll(readAll());
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const stats = all[shotId] ?? EMPTY;
  const today = todayKey();
  const todaySession =
    stats.sessions.find((s) => s.date === today) ?? {
      date: today,
      attempts: 0,
      makes: 0,
    };

  const logMake = useCallback(() => {
    const current = readAll();
    const updated = recordHit(current[shotId] ?? EMPTY, true);
    writeAll({ ...current, [shotId]: updated });
  }, [shotId]);

  const logMiss = useCallback(() => {
    const current = readAll();
    const updated = recordHit(current[shotId] ?? EMPTY, false);
    writeAll({ ...current, [shotId]: updated });
  }, [shotId]);

  const undo = useCallback(() => {
    const current = readAll();
    const cur = current[shotId];
    if (!cur || cur.totalAttempts === 0) return;
    const sessions = [...cur.sessions];
    const todayIdx = sessions.findIndex((s) => s.date === today);
    if (todayIdx < 0 || sessions[todayIdx].attempts <= 0) return;
    const last = sessions[todayIdx];
    // We can't know if the last was a make or miss without separate
    // recording — assume miss-first to be safe (undo only walks attempts
    // back). If the user previously made it, makes can drift; that's an
    // acceptable cost for a one-button undo.
    const wasMake = last.makes > 0 && last.makes === last.attempts;
    const updated: ShotStats = {
      totalAttempts: cur.totalAttempts - 1,
      totalMakes: cur.totalMakes - (wasMake ? 1 : 0),
      sessions: sessions
        .map((s, i) =>
          i === todayIdx
            ? {
                ...s,
                attempts: s.attempts - 1,
                makes: Math.max(0, s.makes - (wasMake ? 1 : 0)),
              }
            : s,
        )
        .filter((s) => s.attempts > 0),
    };
    writeAll({ ...current, [shotId]: updated });
  }, [shotId, today]);

  /**
   * Flip the last logged attempt from `was` to `isNow` without changing
   * the attempt count. Used by the AR auto-tracker's one-tap override.
   *
   * Callers pass `was` because the hook can't reliably distinguish
   * make-vs-miss from aggregate counts; the caller logged the entry so it
   * knows what to swap.
   */
  const correctLast = useCallback(
    (was: boolean, isNow: boolean) => {
      if (was === isNow) return;
      const current = readAll();
      const cur = current[shotId];
      if (!cur || cur.sessions.length === 0) return;
      const t = todayKey();
      const sessions = [...cur.sessions];
      const idx = sessions.findIndex((s) => s.date === t);
      if (idx < 0) return;
      const s = sessions[idx];
      const delta = (isNow ? 1 : 0) - (was ? 1 : 0);
      const updated = {
        ...cur,
        totalMakes: Math.max(0, cur.totalMakes + delta),
        sessions: sessions.map((session, i) =>
          i === idx
            ? { ...s, makes: Math.max(0, Math.min(s.attempts, s.makes + delta)) }
            : session,
        ),
      };
      writeAll({ ...current, [shotId]: updated });
    },
    [shotId],
  );

  const reset = useCallback(() => {
    const current = readAll();
    if (!current[shotId]) return;
    const { [shotId]: _drop, ...rest } = current;
    void _drop;
    writeAll(rest);
  }, [shotId]);

  return { stats, todaySession, logMake, logMiss, undo, reset, correctLast };
}
