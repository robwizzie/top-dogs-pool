"use client";

import { useCallback, useEffect, useState } from "react";

const SESSIONS_KEY = "topdogs:sessions";
const ACTIVE_KEY = "topdogs:active-session";
const CHANGE_EVENT = "topdogs:sessions-change";
/** Keep at most this many session records — older ones are pruned automatically. */
const MAX_SESSIONS = 40;

export type Critique = {
  /** ISO timestamp the critique came back from the API. */
  at: string;
  verdict: "looked great" | "needs work" | "uncertain";
  summary: string;
};

export type SessionShotEntry = {
  shotId: string;
  /** What the player asked for when they built the drill. */
  targetReps: number;
  attempts: number;
  makes: number;
  /** AI critiques the player ran on this shot during the session. */
  critiques: Critique[];
};

export type Session = {
  id: string;
  startedAt: string; // ISO
  endedAt?: string; // ISO when finalized
  shots: SessionShotEntry[];
};

type AllSessions = Record<string, Session>;

function readSessions(): AllSessions {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessions(sessions: AllSessions) {
  // Prune old finalized sessions before write.
  const ids = Object.keys(sessions);
  if (ids.length > MAX_SESSIONS) {
    const sorted = ids
      .map((id) => sessions[id])
      .sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt));
    const keep = sorted.slice(0, MAX_SESSIONS);
    const pruned: AllSessions = {};
    for (const s of keep) pruned[s.id] = s;
    sessions = pruned;
  }
  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function readActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

function setActiveId(id: string | null) {
  if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/**
 * Start a new session bound to the given list of shots + target reps.
 * Replaces any previously-active session. Returns the new session ID.
 */
export function startSession(items: { shotId: string; reps: number }[]): string {
  const sessions = readSessions();
  const id = uuid();
  sessions[id] = {
    id,
    startedAt: new Date().toISOString(),
    shots: items.map((i) => ({
      shotId: i.shotId,
      targetReps: i.reps,
      attempts: 0,
      makes: 0,
      critiques: [],
    })),
  };
  writeSessions(sessions);
  setActiveId(id);
  return id;
}

/** Mark the active session as ended without deleting it. */
export function endActiveSession(): void {
  const id = readActiveId();
  if (!id) return;
  const sessions = readSessions();
  const s = sessions[id];
  if (s) {
    s.endedAt = new Date().toISOString();
    writeSessions(sessions);
  }
  setActiveId(null);
}

/** Discard the active session entirely (no record kept). */
export function discardActiveSession(): void {
  const id = readActiveId();
  if (!id) return;
  const sessions = readSessions();
  delete sessions[id];
  writeSessions(sessions);
  setActiveId(null);
}

/**
 * Append an attempt to the active session. No-op if no session is
 * active. Safe to call from anywhere — out-of-session attempts simply
 * fall through to the per-shot stats only.
 */
export function logSessionAttempt(shotId: string, made: boolean): void {
  const id = readActiveId();
  if (!id) return;
  const sessions = readSessions();
  const s = sessions[id];
  if (!s) return;
  let entry = s.shots.find((e) => e.shotId === shotId);
  if (!entry) {
    entry = {
      shotId,
      targetReps: 0,
      attempts: 0,
      makes: 0,
      critiques: [],
    };
    s.shots.push(entry);
  }
  entry.attempts += 1;
  if (made) entry.makes += 1;
  writeSessions(sessions);
}

/**
 * Flip the most-recent attempt for a shot from `was` to `isNow` without
 * changing the attempt count. Mirrors useShotStats.correctLast for the
 * active session record.
 */
export function correctSessionAttempt(
  shotId: string,
  was: boolean,
  isNow: boolean,
): void {
  if (was === isNow) return;
  const id = readActiveId();
  if (!id) return;
  const sessions = readSessions();
  const s = sessions[id];
  if (!s) return;
  const entry = s.shots.find((e) => e.shotId === shotId);
  if (!entry || entry.attempts === 0) return;
  const delta = (isNow ? 1 : 0) - (was ? 1 : 0);
  entry.makes = Math.max(0, Math.min(entry.attempts, entry.makes + delta));
  writeSessions(sessions);
}

/** Attach an AI critique to the shot's session entry. */
export function logSessionCritique(
  shotId: string,
  critique: Omit<Critique, "at">,
): void {
  const id = readActiveId();
  if (!id) return;
  const sessions = readSessions();
  const s = sessions[id];
  if (!s) return;
  let entry = s.shots.find((e) => e.shotId === shotId);
  if (!entry) {
    entry = {
      shotId,
      targetReps: 0,
      attempts: 0,
      makes: 0,
      critiques: [],
    };
    s.shots.push(entry);
  }
  entry.critiques.push({ ...critique, at: new Date().toISOString() });
  writeSessions(sessions);
}

/** Reactive snapshot of a single session by ID. */
export function useSession(id: string | null): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    function refresh() {
      if (!id) {
        setSession(null);
        return;
      }
      setSession(readSessions()[id] ?? null);
    }
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [id]);
  return session;
}

/** Reactive snapshot of the currently-active session, if any. */
export function useActiveSession(): Session | null {
  const [active, setActive] = useState<Session | null>(null);
  useEffect(() => {
    function refresh() {
      const id = readActiveId();
      setActive(id ? readSessions()[id] ?? null : null);
    }
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return active;
}

/** List of all session records, newest first. */
export function useSessions(): Session[] {
  const [list, setList] = useState<Session[]>([]);
  useEffect(() => {
    function refresh() {
      const all = Object.values(readSessions());
      all.sort((a, b) =>
        (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt),
      );
      setList(all);
    }
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return list;
}

/** Read a single session imperatively (e.g. from an event handler). */
export function getSession(id: string): Session | null {
  return readSessions()[id] ?? null;
}

/** Imperatively read the active session ID — synchronous, no hook. */
export function readActiveSessionId(): string | null {
  return readActiveId();
}

/** Imperatively get the active session ID. */
export function useActiveSessionId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    function refresh() {
      setId(readActiveId());
    }
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return id;
}

// Re-export the callback-shaped helpers for consumers that want stable
// references inside useEffect deps.
export function useSessionActions() {
  return {
    start: useCallback(
      (items: { shotId: string; reps: number }[]) => startSession(items),
      [],
    ),
    end: useCallback(() => endActiveSession(), []),
    discard: useCallback(() => discardActiveSession(), []),
    logAttempt: useCallback(
      (shotId: string, made: boolean) => logSessionAttempt(shotId, made),
      [],
    ),
    logCritique: useCallback(
      (shotId: string, c: Omit<Critique, "at">) =>
        logSessionCritique(shotId, c),
      [],
    ),
  };
}
