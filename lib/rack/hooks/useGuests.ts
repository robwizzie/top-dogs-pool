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
  create: (draft: GuestDraft) => Promise<ProfileRow | null>;
  update: (id: string, draft: GuestDraft) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
};

/**
 * Say what went wrong in terms the person reading it can act on.
 *
 * `42703` is PostgREST relaying "column does not exist", which for this hook
 * means one thing: the deploy is ahead of the database. Raw SQL text would
 * send whoever hit it looking for a bug in the app.
 */
function describe(err: { code?: string; message: string }): string {
  if (err.code === "42703") {
    return "Guests need a database update that hasn't been applied yet — run the latest migration in supabase/migrations/.";
  }
  return err.message;
}

export function useGuests(ownerId: string | null): GuestBook {
  const supabase = getSupabaseBrowser();
  const [guests, setGuests] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (err) setError(describe(err));
    setGuests((data ?? []) as ProfileRow[]);
    setLoading(false);
  }, [supabase, ownerId]);

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
        setError(describe(err));
        return null;
      }
      const row = data as ProfileRow;
      setGuests((prev) =>
        [...prev, row].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return row;
    },
    [supabase, ownerId],
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
        setError(describe(err));
        return false;
      }
      await refresh();
      return true;
    },
    [supabase, refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!supabase) return false;
      setError(null);
      const { error: err } = await supabase.from("profiles").delete().eq("id", id);
      if (err) {
        setError(describe(err));
        return false;
      }
      setGuests((prev) => prev.filter((g) => g.id !== id));
      return true;
    },
    [supabase],
  );

  return { guests, loading, error, create, update, remove, refresh };
}
