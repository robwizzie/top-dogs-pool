"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LogIn, Monitor, Plus, Radio, Target, Trophy, Users } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  RACK_TAGLINE,
  ROOM_CODE_LENGTH,
} from "@/lib/rack/config";
import type { RoomRow } from "@/lib/rack/types";
import { AuthPanel } from "./AuthPanel";
import { useSession } from "./RackShell";
import {
  Button,
  Card,
  ConfirmAction,
  ErrorNote,
  Field,
  Input,
  Pill,
  PoolBallLoader,
  RackLogo,
  SectionTitle,
  Wordmark,
} from "./ui";

/**
 * The front door: create a table, join one by code, or watch one on a screen.
 * Spectating needs no account — only scoring does.
 *
 * The list under the fold used to be every active table anyone had ever
 * opened, which in practice meant a growing pile of half-finished Tuesdays
 * with no way to clear them. It is now *your* tables, with the controls to
 * tidy them up, plus anything actually being played right now.
 */
export function RackHome() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const { user, profile, loading } = useSession();
  const [mine, setMine] = useState<RoomRow[]>([]);
  const [liveElsewhere, setLiveElsewhere] = useState<RoomRow[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    if (!supabase) return;

    // Anything live right now, for anyone — a table with a match on it is
    // worth surfacing; an idle one someone opened last month is not.
    const { data: live } = await supabase
      .from("rooms")
      .select("*")
      .eq("is_active", true)
      .not("current_match_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!user) {
      setMine([]);
      setLiveElsewhere((live ?? []) as RoomRow[]);
      return;
    }

    const { data: seats } = await supabase
      .from("room_players")
      .select("room_id")
      .eq("user_id", user.id);
    const seatIds = (seats ?? []).map((s) => s.room_id as string);

    // PostgREST's `in.()` needs a non-empty list, so a brand-new account with
    // no seats asks only about the tables it hosts.
    const filter = seatIds.length
      ? `created_by.eq.${user.id},id.in.(${seatIds.join(",")})`
      : null;
    const query = supabase.from("rooms").select("*").eq("is_active", true);
    const { data: ours } = await (filter
      ? query.or(filter)
      : query.eq("created_by", user.id)
    )
      .order("created_at", { ascending: false })
      .limit(12);

    const ourRooms = (ours ?? []) as RoomRow[];
    const ourIds = new Set(ourRooms.map((r) => r.id));
    setMine(ourRooms);
    setLiveElsewhere(((live ?? []) as RoomRow[]).filter((r) => !ourIds.has(r.id)));
  }, [supabase, user]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  async function createRoom() {
    if (!supabase || !user) return;
    setBusy(true);
    setError(null);
    try {
      // Codes are short enough to collide occasionally; retry rather than
      // handing someone a duplicate-key error.
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
        if (insertError.code !== "23505") throw insertError;
      }
      throw new Error("Couldn't find a free table code. Try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the table.");
    } finally {
      setBusy(false);
    }
  }

  async function closeRoom(room: RoomRow) {
    if (!supabase) return;
    const { error: err } = await supabase
      .from("rooms")
      .update({ is_active: false, closed_at: new Date().toISOString() })
      .eq("id", room.id);
    if (err) setError(err.message);
    await loadRooms();
  }

  async function deleteRoom(room: RoomRow) {
    if (!supabase) return;
    const { error: err } = await supabase.from("rooms").delete().eq("id", room.id);
    if (err) setError(err.message);
    await loadRooms();
  }

  const code = normalizeRoomCode(joinCode);

  return (
    <>
      {/* ---- hero ------------------------------------------------------ */}
      <section className="border-b border-[hsl(var(--rack-border))] bg-[hsl(var(--rack-bg-soft))]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6 sm:py-14">
          <RackLogo size={84} priority className="rack-fade-in" />
          <Wordmark size="xl" className="rack-fade-in" />
          <p className="max-w-xl text-lg text-[hsl(var(--rack-fg-muted))]">
            {RACK_TAGLINE}. Track every rack, every inning, every epic shot —
            live on your phone and up on the TV.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <ErrorNote>{error}</ErrorNote>

        {/* ---- join ---------------------------------------------------- */}
        <Card raised className="space-y-4">
          <Field
            label="Join or watch a table"
            hint={`${ROOM_CODE_LENGTH} characters, shoutable across a pool hall.`}
          >
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
                placeholder="ABCD"
                autoCapitalize="characters"
                autoComplete="off"
                aria-label="Table code"
                className="text-center font-[family-name:var(--rack-font-display)] text-3xl tracking-[0.35em]"
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
              className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--rack-primary))] underline underline-offset-4"
            >
              <Monitor className="h-4 w-4" /> Put {code} on a TV instead
            </Link>
          )}
        </Card>

        {/* ---- create / sign in ---------------------------------------- */}
        {loading ? (
          <PoolBallLoader />
        ) : user ? (
          <Card className="space-y-4">
            <Field
              label="Start a new table"
              hint="You can play someone who hasn't got the app — add them as a guest once you're in."
            >
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`${profile?.name ?? "My"}'s table`}
                maxLength={60}
              />
            </Field>
            <Button
              variant="accent"
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

        {/* ---- your tables --------------------------------------------- */}
        {mine.length > 0 && (
          <Card>
            <SectionTitle>Your tables</SectionTitle>
            <ul className="space-y-2">
              {mine.map((room) => (
                <TableRow
                  key={room.id}
                  room={room}
                  isHost={room.created_by === user?.id}
                  onClose={() => closeRoom(room)}
                  onDelete={() => deleteRoom(room)}
                />
              ))}
            </ul>
          </Card>
        )}

        {/* ---- anyone else mid-match ----------------------------------- */}
        {liveElsewhere.length > 0 && (
          <Card>
            <SectionTitle>Being played now</SectionTitle>
            <ul className="space-y-2">
              {liveElsewhere.map((room) => (
                <TableRow key={room.id} room={room} isHost={false} />
              ))}
            </ul>
          </Card>
        )}

        {/* ---- what it does -------------------------------------------- */}
        <div className="grid gap-3 pt-4 sm:grid-cols-3">
          <FeatureCard
            icon={<Trophy className="h-6 w-6" />}
            title="Compete"
            body="APA-style matches with real races, innings, safeties and timeouts."
          />
          <FeatureCard
            icon={<Target className="h-6 w-6" />}
            title="Practice"
            body="Run drills with the crew and watch your numbers move over time."
          />
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title="One phone is enough"
            body="Add whoever you're playing as a guest — no second account needed."
          />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- Rows */

function TableRow({
  room,
  isHost,
  onClose,
  onDelete,
}: {
  room: RoomRow;
  isHost: boolean;
  onClose?: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
}) {
  const [managing, setManaging] = useState(false);

  return (
    <li className="rounded-[var(--rack-radius)] border border-[hsl(var(--rack-border))] transition hover:border-[hsl(var(--rack-primary))]">
      <div className="flex items-center gap-2 px-3 py-3">
        <Link href={`/rack/room/${room.code}`} className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{room.name}</span>
          <span className="font-[family-name:var(--rack-font-display)] text-sm tracking-[0.25em] text-[hsl(var(--rack-primary))]">
            {room.code}
          </span>
        </Link>
        {room.current_match_id && (
          <Pill tone="hot">
            <Radio className="h-3 w-3" /> live
          </Pill>
        )}
        {isHost && onClose && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setManaging((v) => !v)}
            aria-label={`Manage ${room.name}`}
          >
            {managing ? "Done" : "Manage"}
          </Button>
        )}
      </div>

      {managing && isHost && onClose && onDelete && (
        <div className="grid gap-2 border-t border-[hsl(var(--rack-border))] p-3 sm:grid-cols-2">
          <ConfirmAction
            variant="secondary"
            size="sm"
            label="Close table"
            question={
              <>
                Close <strong>{room.name}</strong>? It leaves this list and nobody
                can join it. Every match it hosted is kept.
              </>
            }
            confirmLabel="Close it"
            onConfirm={onClose}
          />
          <ConfirmAction
            variant="danger"
            size="sm"
            label="Delete permanently"
            question={
              <>
                Delete <strong>{room.name}</strong> and its match log for good?
                Lifetime records already banked stay.
              </>
            }
            confirmLabel="Delete forever"
            onConfirm={onDelete}
          />
        </div>
      )}
    </li>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="text-center transition hover:-translate-y-0.5 hover:shadow-[var(--rack-shadow-lg)]">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--rack-primary)/0.12)] text-[hsl(var(--rack-primary))]">
        {icon}
      </div>
      <p className="font-[family-name:var(--rack-font-heading)] text-lg font-bold">
        {title}
      </p>
      <p className="mt-1 text-sm text-[hsl(var(--rack-fg-muted))]">{body}</p>
    </Card>
  );
}
