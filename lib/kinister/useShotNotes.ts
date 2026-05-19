"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "topdogs:shot-notes";
const CHANGE_EVENT = "topdogs:shot-notes-change";

type AllNotes = Record<string, string>;

function readAll(): AllNotes {
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

function writeAll(notes: AllNotes) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Personal text notes per shot, stored in localStorage. Every serious pool
 * player builds up cues that only make sense to them — "cheat the contact
 * left", "needs firmer pace than I think", "miscue if I rush". This is the
 * notebook for those.
 */
export function useShotNotes(shotId: string) {
  const [all, setAll] = useState<AllNotes>({});

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

  const note = all[shotId] ?? "";

  const save = useCallback(
    (value: string) => {
      const current = readAll();
      const trimmed = value.trim();
      if (trimmed === "") {
        const { [shotId]: _drop, ...rest } = current;
        void _drop;
        writeAll(rest);
      } else {
        writeAll({ ...current, [shotId]: value });
      }
    },
    [shotId],
  );

  return { note, save };
}
