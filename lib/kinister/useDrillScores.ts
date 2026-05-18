"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "topdogs:drill-scores";
const CHANGE_EVENT = "topdogs:drill-scores-change";

export type ScoreEntry = {
  /** ISO timestamp the attempt was recorded. */
  date: string;
  /** Free-form player name (or "You" for solo). */
  player: string;
  /** The score itself. */
  score: number;
  /** Optional note. */
  note?: string;
};

type Store = Record<string, ScoreEntry[]>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Local-storage tracker for drill score attempts. Each drill keeps its own
 * ordered list of `ScoreEntry`s (newest first). Designed for solo or
 * multi-player use — players are free-form strings.
 */
export function useDrillScores(drillId: string) {
  const [entries, setEntries] = useState<ScoreEntry[]>([]);

  useEffect(() => {
    setEntries(readStore()[drillId] ?? []);
    function onChange() {
      setEntries(readStore()[drillId] ?? []);
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [drillId]);

  const add = useCallback(
    (entry: Omit<ScoreEntry, "date"> & { date?: string }) => {
      const store = readStore();
      const list = store[drillId] ?? [];
      const next: ScoreEntry = {
        date: entry.date ?? new Date().toISOString(),
        player: entry.player,
        score: entry.score,
        note: entry.note,
      };
      store[drillId] = [next, ...list];
      writeStore(store);
    },
    [drillId],
  );

  const remove = useCallback(
    (index: number) => {
      const store = readStore();
      const list = store[drillId] ?? [];
      const filtered = list.filter((_, i) => i !== index);
      if (filtered.length === 0) {
        delete store[drillId];
      } else {
        store[drillId] = filtered;
      }
      writeStore(store);
    },
    [drillId],
  );

  const clearDrill = useCallback(() => {
    const store = readStore();
    delete store[drillId];
    writeStore(store);
  }, [drillId]);

  return { entries, add, remove, clearDrill };
}

/** Hook for clearing every drill's scores at once (settings/admin UI). */
export function useClearAllDrillScores() {
  return useCallback(() => {
    writeStore({});
  }, []);
}
