"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "../supabase/browser";
import {
  initialState,
  reduce,
  replay,
  type MatchEvent,
  type MatchSetup,
  type MatchState,
} from "../rules/match";
import type { AppendEventResult, MatchRow } from "../types";

export type LiveMatch = {
  /** What to render: server state with any unconfirmed taps applied on top. */
  state: MatchState | null;
  setup: MatchSetup | null;
  row: MatchRow | null;
  loading: boolean;
  error: string | null;
  /** True while a tap is in flight. */
  saving: boolean;
  /** Unconfirmed events, oldest first. */
  pending: MatchEvent[];
  /** Whether this viewer is allowed to score. */
  canScore: boolean;
  dispatch: (event: MatchEvent) => void;
  undo: () => Promise<void>;
  finalize: () => Promise<void>;
};

/**
 * Live match state, shared across every device looking at it.
 *
 * The model is deliberately boring, because the interesting version is what
 * broke before. Server state is authoritative and arrives by realtime; local
 * taps are applied optimistically on top so the phone feels instant; each tap
 * is sent as one event with the version it was based on. If the server has
 * moved on, it says so and hands back the truth, and the queued taps are
 * replayed against it. Nothing is ever written blind.
 *
 * Writes are serialised through a promise chain: a rapid double-tap becomes
 * two ordered events rather than two racing read-modify-writes.
 */
export function useLiveMatch(matchId: string | null, viewerId: string | null): LiveMatch {
  const supabase = getSupabaseBrowser();

  const [row, setRow] = useState<MatchRow | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [serverState, setServerState] = useState<MatchState | null>(null);
  const [pending, setPending] = useState<MatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs mirror state for use inside the write queue, which must not close
  // over stale renders.
  const serverStateRef = useRef<MatchState | null>(null);
  const pendingRef = useRef<MatchEvent[]>([]);
  const setupRef = useRef<MatchSetup | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const applyServer = useCallback((next: MatchState | null) => {
    serverStateRef.current = next;
    setServerState(next);
  }, []);

  const applyPending = useCallback((next: MatchEvent[]) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  /* ---- initial load -------------------------------------------------- */
  useEffect(() => {
    if (!supabase || !matchId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    void (async () => {
      const { data, error: err } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .maybeSingle();

      if (!active) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setError("Match not found.");
        setLoading(false);
        return;
      }

      const matchRow = data as MatchRow;
      setRow(matchRow);
      setupRef.current = matchRow.setup;

      // The room host can score too, not just the two players — the rule the
      // database enforces in rack_can_score_match(). Mirroring it here keeps
      // the buttons from being offered to someone the server will refuse.
      const { data: roomRow } = await supabase
        .from("rooms")
        .select("created_by")
        .eq("id", matchRow.room_id)
        .maybeSingle();
      if (active) setHostId((roomRow?.created_by as string | undefined) ?? null);

      // Prefer the stored snapshot. Fall back to replaying the log, which
      // covers a row written by an older client that didn't snapshot.
      if (matchRow.live_state) {
        applyServer(matchRow.live_state);
      } else if (matchRow.setup) {
        const { data: events } = await supabase
          .from("match_events")
          .select("event")
          .eq("match_id", matchId)
          .order("seq", { ascending: true });
        const log = (events ?? []).map((e) => e.event as MatchEvent);
        applyServer(replay(matchRow.setup, log));
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [supabase, matchId, applyServer]);

  /* ---- realtime ------------------------------------------------------ */
  useEffect(() => {
    if (!supabase || !matchId) return;

    const channel = supabase
      .channel(`rack_match_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const next = payload.new as MatchRow;
          setRow(next);
          setupRef.current = next.setup ?? setupRef.current;
          const current = serverStateRef.current;
          // Ignore anything not newer than what we already have — realtime can
          // redeliver, and our own write already advanced us.
          if (next.live_state && (!current || next.live_state.version > current.version)) {
            applyServer(next.live_state);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, matchId, applyServer]);

  /* ---- writes -------------------------------------------------------- */

  const flush = useCallback(
    async (event: MatchEvent) => {
      if (!supabase || !matchId) return;

      // Retry only a handful of times. A conflict means somebody else scored
      // between our read and our write, which resolves on the next attempt; a
      // conflict that keeps repeating means something is wrong, and spinning
      // forever would be worse than surfacing it.
      const MAX_ATTEMPTS = 5;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const base = serverStateRef.current;
        if (!base) return;

        // Everything still unconfirmed ahead of this event, then this one.
        const ahead = pendingRef.current.slice(
          0,
          Math.max(0, pendingRef.current.indexOf(event)),
        );
        const projected = ahead.reduce(reduce, base);
        const next = reduce(projected, event);

        const { data, error: rpcError } = await supabase.rpc(
          "rack_append_match_event",
          {
            p_match_id: matchId,
            p_expected_version: projected.version,
            p_event: event,
            p_state: next,
          },
        );

        if (rpcError) {
          setError(rpcError.message);
          // Drop the optimistic event rather than leaving the scoreboard ahead
          // of the server, showing a score that was never recorded.
          applyPending(pendingRef.current.filter((e) => e !== event));
          return;
        }

        const result = (Array.isArray(data) ? data[0] : data) as
          | AppendEventResult
          | null;
        if (!result) return;

        if (result.conflict) {
          // Someone else got there first. Take their state as the new base and
          // try this event again on top of it.
          if (result.live_state) applyServer(result.live_state);
          continue;
        }

        if (result.live_state) applyServer(result.live_state);
        applyPending(pendingRef.current.filter((e) => e !== event));
        setError(null);
        return;
      }

      setError("Couldn't save that — the scoreboard was being updated elsewhere. Try again.");
      applyPending(pendingRef.current.filter((e) => e !== event));
    },
    [supabase, matchId, applyPending, applyServer],
  );

  const dispatch = useCallback(
    (event: MatchEvent) => {
      if (!serverStateRef.current) return;
      applyPending([...pendingRef.current, event]);
      setSaving(true);
      queueRef.current = queueRef.current
        .then(() => flush(event))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (pendingRef.current.length === 0) setSaving(false);
        });
    },
    [flush, applyPending],
  );

  /* ---- undo ---------------------------------------------------------- */

  const undo = useCallback(async () => {
    if (!supabase || !matchId) return;
    const setup = setupRef.current;
    const current = serverStateRef.current;
    if (!setup || !current || current.version === 0) return;

    setSaving(true);
    try {
      // Read the log, drop the last event, replay. Exact by construction —
      // there is no per-action inverse that can be incomplete.
      const { data: events, error: readError } = await supabase
        .from("match_events")
        .select("seq, event")
        .eq("match_id", matchId)
        .order("seq", { ascending: true });
      if (readError) throw readError;

      const log = (events ?? []).map((e) => e.event as MatchEvent);
      const target = Math.max(0, log.length - 1);
      const rewound = target === 0 ? initialState(setup) : replay(setup, log.slice(0, target));

      const { data, error: rpcError } = await supabase.rpc("rack_rewind_match", {
        p_match_id: matchId,
        p_to_version: target,
        p_state: rewound,
      });
      if (rpcError) throw rpcError;

      const result = (Array.isArray(data) ? data[0] : data) as AppendEventResult | null;
      if (result?.live_state) applyServer(result.live_state);
      applyPending([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [supabase, matchId, applyServer, applyPending]);

  /* ---- finalize ------------------------------------------------------ */

  const finalize = useCallback(async () => {
    if (!supabase || !matchId) return;
    const { error: rpcError } = await supabase.rpc("rack_finalize_match", {
      p_match_id: matchId,
    });
    if (rpcError) setError(rpcError.message);
  }, [supabase, matchId]);

  const state = serverState ? pending.reduce(reduce, serverState) : null;

  const canScore = Boolean(
    viewerId && row && (row.player_ids.includes(viewerId) || viewerId === hostId),
  );

  /* ---- settle automatically ------------------------------------------ */
  // A finished match has to be written into the lifetime tables, and waiting
  // for someone to tap a button means a phone locked at the end of the night
  // silently loses the result. The RPC is guarded by finalized_at under a row
  // lock, so every device racing to call it is harmless — exactly one does the
  // work.
  useEffect(() => {
    if (!row || !canScore) return;
    if (row.status !== "complete" || row.finalized_at) return;
    void finalize();
  }, [row, canScore, finalize]);

  return {
    state,
    setup: setupRef.current,
    row,
    loading,
    error,
    saving,
    pending,
    canScore,
    dispatch,
    undo,
    finalize,
  };
}
