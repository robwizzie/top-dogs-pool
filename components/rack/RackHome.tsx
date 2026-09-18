"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LogIn, Monitor, Plus, Target, Trophy, Users } from "lucide-react";
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
 * Guests can spectate without an account — only scoring needs one.
 *
 * The hero and the three cards are the original's, because they said the right
 * thing in the right order and people liked them.
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

  const code = normalizeRoomCode(joinCode);

  return (
    <>
      {/* ---- hero ------------------------------------------------------ */}
      <section className="border-b border-[hsl(var(--rack-border))] bg-[hsl(var(--rack-bg-soft))]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-14 text-center sm:px-6 sm:py-20">
          <RackLogo size={96} priority className="rack-fade-in" />
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
            <Field label="Start a new table">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`${profile?.name ?? "My"}'s table`}
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

        {/* ---- open tables --------------------------------------------- */}
        {rooms.length > 0 && (
          <Card>
            <SectionTitle>Open tables</SectionTitle>
            <ul className="space-y-2">
              {rooms.map((room) => (
                <li key={room.id}>
                  <Link
                    href={`/rack/room/${room.code}`}
                    className="flex items-center justify-between gap-3 rounded-[var(--rack-radius)] border border-[hsl(var(--rack-border))] px-3 py-3 transition hover:border-[hsl(var(--rack-primary))] hover:bg-[hsl(var(--rack-bg-soft))]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{room.name}</span>
                      <span className="font-[family-name:var(--rack-font-display)] text-sm tracking-[0.25em] text-[hsl(var(--rack-primary))]">
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
            title="Connect"
            body="Phones score it, the TV shows it, everyone sees the same thing."
          />
        </div>
      </div>
    </>
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
