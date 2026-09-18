"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Monitor, Target, Trophy, Users } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import { useLiveMatch } from "@/lib/rack/hooks/useLiveMatch";
import { useRoom } from "@/lib/rack/hooks/useRoom";
import { Avatar, Button, Card, EmptyState, ErrorNote, Pill, PoolBallLoader } from "./ui";
import { MatchSetupForm } from "./MatchSetupForm";
import { Scoreboard } from "./Scoreboard";
import { TournamentPanel } from "./TournamentPanel";
import { PracticePanel } from "./PracticePanel";
import { useSession } from "./RackShell";

type Mode = "lobby" | "new-match" | "tournament" | "practice";

export function RoomView({ code }: { code: string }) {
  const supabase = getSupabaseBrowser();
  const { user, profile, loading: sessionLoading } = useSession();
  const room = useRoom(code, user?.id ?? null);
  const [mode, setMode] = useState<Mode>("lobby");
  const [joinError, setJoinError] = useState<string | null>(null);

  const live = useLiveMatch(room.room?.current_match_id ?? null, user?.id ?? null);

  const inRoom = Boolean(user && room.members.some((m) => m.user_id === user.id));

  /* Join the room automatically — if you opened the link you meant to be here. */
  const join = useCallback(async () => {
    if (!supabase || !user || !room.room) return;
    const { error } = await supabase
      .from("room_players")
      .insert({ room_id: room.room.id, user_id: user.id });
    // A duplicate just means another tab got there first.
    if (error && error.code !== "23505") setJoinError(error.message);
  }, [supabase, user, room.room]);

  useEffect(() => {
    if (user && room.room && !inRoom && !room.loading) void join();
  }, [user, room.room, room.loading, inRoom, join]);

  if (room.loading || sessionLoading) return <PoolBallLoader label="Finding the table" />;

  if (room.error || !room.room) {
    return (
      <EmptyState title="Table not found">
        <p>{room.error ?? `No table with code ${code}.`}</p>
        <Link
          href="/rack"
          className="mt-3 inline-block text-[hsl(var(--rack-accent))] underline underline-offset-4"
        >
          Back to tables
        </Link>
      </EmptyState>
    );
  }

  const activeMatch =
    live.state && live.row?.status === "in_progress" ? live : null;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[hsl(var(--rack-accent))]">
            Table
          </p>
          <h1 className="font-[family-name:var(--rack-font-display)] text-3xl tracking-wide">
            {room.room.name}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--rack-fg-muted))]">
            Code{" "}
            <strong className="tracking-[0.3em] text-[hsl(var(--rack-accent))]">
              {room.room.code}
            </strong>
            {room.isHost && " · you're hosting"}
          </p>
        </div>
        <Link href={`/rack/display/${room.room.code}`} target="_blank">
          <Button variant="secondary">
            <Monitor className="h-4 w-4" /> TV display
          </Button>
        </Link>
      </Card>

      <ErrorNote>{joinError}</ErrorNote>

      {!user && (
        <Card className="text-center">
          <p className="text-sm text-[hsl(var(--rack-fg-muted))]">
            You&apos;re watching as a guest.{" "}
            <Link
              href="/rack"
              className="text-[hsl(var(--rack-accent))] underline underline-offset-4"
            >
              Sign in
            </Link>{" "}
            to join the table and score.
          </p>
        </Card>
      )}

      {live.loading && room.room.current_match_id && <PoolBallLoader label="Loading the match" />}

      {activeMatch ? (
        <Scoreboard
          live={activeMatch}
          onFinished={async () => {
            await activeMatch.finalize();
            if (supabase && room.room) {
              await supabase
                .from("rooms")
                .update({ current_match_id: null })
                .eq("id", room.room.id);
            }
            setMode("lobby");
          }}
        />
      ) : mode === "new-match" ? (
        <MatchSetupForm
          roomId={room.room.id}
          members={room.members}
          onStarted={() => setMode("lobby")}
          onCancel={() => setMode("lobby")}
        />
      ) : mode === "tournament" ? (
        <TournamentPanel
          roomId={room.room.id}
          members={room.members}
          isHost={room.isHost}
          onClose={() => setMode("lobby")}
        />
      ) : mode === "practice" ? (
        <PracticePanel
          roomId={room.room.id}
          members={room.members}
          viewerId={user?.id ?? null}
          onClose={() => setMode("lobby")}
        />
      ) : (
        <>
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-[hsl(var(--rack-accent))]" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--rack-accent))]">
                At the table ({room.members.length})
              </h2>
            </div>
            {room.members.length === 0 ? (
              <p className="text-sm text-[hsl(var(--rack-fg-muted))]">
                Nobody yet. Share code{" "}
                <strong className="tracking-[0.3em]">{room.room.code}</strong>.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {room.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <Avatar
                      name={m.profile?.name ?? "?"}
                      url={m.profile?.avatar_url}
                      size={32}
                    />
                    <span className="text-sm">
                      {m.profile?.name ?? "Unknown"}
                      {m.user_id === room.room?.created_by && (
                        <Pill className="ml-2">host</Pill>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {user && (
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => setMode("new-match")}
                className="min-h-16"
              >
                <Trophy className="h-4 w-4" /> New match
              </Button>
              <Button size="lg" onClick={() => setMode("tournament")} className="min-h-16">
                <Trophy className="h-4 w-4" /> Tournament
              </Button>
              <Button size="lg" onClick={() => setMode("practice")} className="min-h-16">
                <Target className="h-4 w-4" /> Practice
              </Button>
            </div>
          )}

          {!profile && user && (
            <Card className="text-sm text-[hsl(var(--rack-fg-muted))]">
              Set your skill levels on{" "}
              <Link
                href="/rack/profile"
                className="text-[hsl(var(--rack-accent))] underline underline-offset-4"
              >
                your profile
              </Link>{" "}
              before starting a match.
            </Card>
          )}
        </>
      )}
    </div>
  );
}
