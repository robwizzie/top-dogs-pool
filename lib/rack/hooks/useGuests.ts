"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowser } from "../supabase/browser";
import type { GameType } from "../rules/race";
import type { ProfileRow } from "../types";

/**
 * The people you play who don't have an account.
 *
 * Guests belong to the account that entered them, not to a table: you add
 * "Dave" once and he is there every week, with the record he has built up,
 * instead of being retyped as a stranger each time. They are ordinary profile
 * rows, so everything downstream — seating, match setup, stats, head-to-head —
 * treats them like anyone else.
 */

export type GuestDraft = {
  name: string;
  /** Per-game skill levels. A match needs one for the game being played. */
  skills: Partial<Record<GameType, number>>;
};

export type GuestBook = {
  guests: ProfileRow[];
  loading: boolean;
  error: string | null;
  /**
   * The database hasn't had the guest-players migration applied, so there is
   * nothing to list and nothing can be created. The UI should say so up front
   * rather than let someone fill in a form that can only fail.
   */
  unavailable: boolean;
  create: (draft: GuestDraft) => Promise<ProfileRow | null>;
  update: (id: string, draft: GuestDraft) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
};

/**
 * Whether an error means "this database predates guests" rather than a real
 * failure.
 *
 * It surfaces three ways depending on which request hits it first:
 *   · `PGRST204` — PostgREST rejecting an insert/update payload that names a
 *     column it doesn't have ("Could not find the 'guest_owner' column of
 *     'profiles' in the schema cache"). This is what adding a guest hits.
 *   · `42703`   — Postgres itself, "column does not exist", from the
 *     `guest_owner=eq.…` filter on the list query.
 *   · the schema-cache wording, for PostgREST versions that reword the code.
 */
export function isMissingGuestSchema(err: { code?: string; message?: string }): boolean {
  if (err.code === "PGRST204" || err.code === "42703") return true;
  const msg = err.message ?? "";
  return /guest_owner|is_guest/.test(msg) && /schema cache|does not exist/.test(msg);
}

export const GUEST_SCHEMA_MISSING =
  "Guest players aren't switched on for this database yet. Whoever runs the Supabase project needs to apply supabase/migrations/20260918020000_rack_guest_players.sql (SQL Editor → paste → Run).";

/** Say what went wrong in terms the person reading it can act on. */
function describe(err: { code?: string; message: string }): string {
  return isMissingGuestSchema(err) ? GUEST_SCHEMA_MISSING : err.message;
}

export function useGuests(ownerId: string | null): GuestBook {
  const supabase = getSupabaseBrowser();
  const [guests, setGuests] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  /** Record a failure, and remember if it means guests can't work at all. */
  const fail = useCallback((err: { code?: string; message: string }) => {
    if (isMissingGuestSchema(err)) setUnavailable(true);
    setError(describe(err));
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase || !ownerId) {
      setGuests([]);
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase
      .from("profiles")
      .select("*")
      .eq("guest_owner", ownerId)
      .order("name", { ascending: true });
    if (err) {
      fail(err);
    } else {
      setError(null);
      setUnavailable(false);
    }
    setGuests((data ?? []) as ProfileRow[]);
    setLoading(false);
  }, [supabase, ownerId, fail]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (draft: GuestDraft): Promise<ProfileRow | null> => {
      if (!supabase || !ownerId) return null;
      setError(null);
      const { data, error: err } = await supabase
        .from("profiles")
        .insert({
          name: draft.name.trim(),
          is_guest: true,
          guest_owner: ownerId,
          skill_levels: draft.skills,
          // The single-value fallback the rest of the app reads when a game
          // has no specific entry.
          skill_level: draft.skills["8-ball"] ?? draft.skills["9-ball"] ?? null,
        })
        .select("*")
        .single();

      if (err) {
        fail(err);
        return null;
      }
      const row = data as ProfileRow;
      setGuests((prev) =>
        [...prev, row].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return row;
    },
    [supabase, ownerId, fail],
  );

  const update = useCallback(
    async (id: string, draft: GuestDraft): Promise<boolean> => {
      if (!supabase) return false;
      setError(null);
      const { error: err } = await supabase
        .from("profiles")
        .update({
          name: draft.name.trim(),
          skill_levels: draft.skills,
          skill_level: draft.skills["8-ball"] ?? draft.skills["9-ball"] ?? null,
        })
        .eq("id", id);
      if (err) {
        fail(err);
        return false;
      }
      await refresh();
      return true;
    },
    [supabase, refresh, fail],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase) return false;
      setError(null);
      const { error: err } = await supabase.from("profiles").delete().eq("id", id);
      if (err) {
        fail(err);
        return false;
      }
      setGuests((prev) => prev.filter((g) => g.id !== id));
      return true;
    },
    [supabase, fail],
  );

  return { guests, loading, error, unavailable, create, update, remove, refresh };
}
