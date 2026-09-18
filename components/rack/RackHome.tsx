"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Monitor, Plus, LogIn } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  RACK_NAME,
  RACK_TAGLINE,
  ROOM_CODE_LENGTH,
} from "@/lib/rack/config";
import type { RoomRow } from "@/lib/rack/types";
import { PageHeader } from "@/components/ui/Section";
import { AuthPanel } from "./AuthPanel";
import { useSession } from "./RackShell";
import { Button, Card, ErrorNote, Field, Input, Pill, Spinner } from "./ui";

/**
 * The section's front door: create a table, join one by code, or watch one on
 * a screen. Guests can spectate without an account — only scoring needs one.
 */
export function RackHome() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const { user, profile, loading } = useSession();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(8);
    setRooms((data ?? []) as RoomRow[]);
  }, [supabase]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  async function createRoom() {
    if (!supabase || !user) return;
    setBusy(true);
    setError(null);
    try {
      // Codes are short enough to collide occasionally; retry rather than
      // handing the user a duplicate-key error.
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = generateRoomCode();
        const { data, error: insertError } = await supabase
          .from("rooms")
          .insert({
            code,
            name: newName.trim() || `${profile?.name ?? "New"}'s table`,
            created_by: user.id,
            is_active: true,
          })
          .select("id, code")
          .single();

        if (!insertError) {
          // Put the host in their own room. The room view joins anyone who
          // opens it, so a failure here is recoverable and not worth blocking
          // navigation on.
          await supabase
            .from("room_players")
            .insert({ room_id: data.id, user_id: user.id });
          router.push(`/rack/room/${data.code}`);
          return;
        }
        // 23505 is a duplicate code — spin the wheel again.
        if (insertError.code !== "23505") throw insertError;
      }
      throw new Error("Couldn't find a free table code. Try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the table.");
    } finally {
      setBusy(false);
    }
  }

  const code = normalizeRoomCode(joinCode);

  return (
    <>
      <PageHeader eyebrow={RACK_NAME} title="Tables" subtitle={RACK_TAGLINE} />

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <ErrorNote>{error}</ErrorNote>

        <Card className="space-y-4">
          <Field label="Join or watch a table" hint={`${ROOM_CODE_LENGTH} characters, shouted across the room.`}>
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
                placeholder="ABCD"
                autoCapitalize="characters"
                autoComplete="off"
                inputMode="text"
                className="text-center text-2xl tracking-[0.4em]"
              />
              <Button
                variant="primary"
                size="lg"
                disabled={!isValidRoomCode(code)}
                onClick={() => router.push(`/rack/room/${code}`)}
              >
                <LogIn className="h-4 w-4" /> Join
              </Button>
            </div>
          </Field>
          {isValidRoomCode(code) && (
            <Link
              href={`/rack/display/${code}`}
              className="inline-flex items-center gap-2 text-sm text-[var(--color-brass)] underline underline-offset-4"
            >
              <Monitor className="h-4 w-4" /> Open {code} on a TV instead
            </Link>
          )}
        </Card>

        {loading ? (
          <Spinner />
        ) : user ? (
          <Card className="space-y-4">
            <Field label="Start a new table">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`${profile?.name ?? "My"}'s table`}
              />
            </Field>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={busy}
              onClick={() => void createRoom()}
            >
              <Plus className="h-4 w-4" />
              {busy ? "Creating…" : "Create table"}
            </Button>
          </Card>
        ) : (
          <AuthPanel />
        )}

        {rooms.length > 0 && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-brass)]">
              Open tables
            </h2>
            <ul className="space-y-2">
              {rooms.map((room) => (
                <li key={room.id}>
                  <Link
                    href={`/rack/room/${room.code}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-3 transition hover:border-[var(--color-brass)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{room.name}</span>
                      <span className="text-xs tracking-[0.3em] text-[var(--color-brass-bright)]">
                        {room.code}
                      </span>
                    </span>
                    {room.current_match_id && <Pill tone="hot">live</Pill>}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
