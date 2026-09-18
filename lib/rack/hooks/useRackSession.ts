"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "../supabase/browser";
import type { ProfileRow } from "../types";

export type RackSession = {
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  /** Re-read the profile, e.g. after editing it. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

/**
 * The signed-in Rack Up player and their profile.
 *
 * Subscribes to profile changes so a skill level edited on a phone shows up on
 * the TV without a refresh.
 */
export function useRackSession(): RackSession {
  const supabase = getSupabaseBrowser();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (userId: string) => {
      if (!supabase) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      setProfile((data as ProfileRow | null) ?? null);
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;

    // getUser() revalidates against the server; getSession() only reads the
    // cookie, which can be stale after a password change or sign-out
    // elsewhere.
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      if (data.user) await loadProfile(data.user.id);
      if (active) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) void loadProfile(nextUser.id);
      else setProfile(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  // Live profile updates (skill level, avatar, APA link).
  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase
      .channel(`rack_profile_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => setProfile(payload.new as ProfileRow),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, user]);

  const refresh = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  return { user, profile, loading, refresh, signOut };
}
