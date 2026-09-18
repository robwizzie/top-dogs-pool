"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowser } from "../supabase/browser";
import type { ProfileRow, RoomPlayerRow, RoomRow } from "../types";

export type RoomMember = RoomPlayerRow & { profile: ProfileRow | null };

export type LiveRoom = {
  room: RoomRow | null;
  members: RoomMember[];
  loading: boolean;
  error: string | null;
  isHost: boolean;
  refresh: () => Promise<void>;
};

/**
 * A room and everyone in it, kept live.
 *
 * Membership and the room's current match both arrive by realtime, so a player
 * joining on their phone appears on the TV without anyone refreshing, and a
 * match started by the host opens on every device at once.
 */
export function useRoom(code: string | null, viewerId: string | null): LiveRoom {
  const supabase = getSupabaseBrowser();
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(
    async (roomId: string) => {
      if (!supabase) return;
      const { data } = await supabase
        .from("room_players")
        .select("*, profiles(*)")
        .eq("room_id", roomId)
        .order("joined_at", { ascending: true });

      setMembers(
        ((data ?? []) as (RoomPlayerRow & { profiles: ProfileRow | null })[]).map(
          ({ profiles, ...rest }) => ({ ...rest, profile: profiles }),
        ),
      );
    },
    [supabase],
  );

  const load = useCallback(async () => {
    if (!supabase || !code) {
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setError(`No table with code ${code}.`);
      setRoom(null);
      setLoading(false);
      return;
    }

    const roomRow = data as RoomRow;
    setRoom(roomRow);
    setError(null);
    await loadMembers(roomRow.id);
    setLoading(false);
  }, [supabase, code, loadMembers]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!supabase || !room) return;

    const channel = supabase
      .channel(`rack_room_${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => setRoom(payload.new as RoomRow),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${room.id}`,
        },
        // The payload only carries the join row, not the joined profile, so
        // re-read rather than trying to patch a half-populated member in.
        () => void loadMembers(room.id),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, room, loadMembers]);

  return {
    room,
    members,
    loading,
    error,
    isHost: Boolean(viewerId && room && room.created_by === viewerId),
    refresh: load,
  };
}
