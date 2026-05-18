"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "topdogs:drilled-shots";
const CHANGE_EVENT = "topdogs:drilled-change";

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Local-storage tracker for which Kinister shots a player has drilled.
 * Identical state shared across all components on the page via a custom
 * event so toggles in one place update everywhere immediately.
 */
export function useDrilled() {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setIds(readSet());
    function onChange() {
      setIds(readSet());
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const next = readSet();
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeSet(next);
  }, []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  const clearAll = useCallback(() => {
    writeSet(new Set());
  }, []);

  return { has, toggle, clearAll, count: ids.size, ids };
}
