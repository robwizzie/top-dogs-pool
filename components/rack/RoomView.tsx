"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Monitor,
  Settings2,
  Target,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import { useLiveMatch } from "@/lib/rack/hooks/useLiveMatch";
import { useRoom } from "@/lib/rack/hooks/useRoom";
import {
  Avatar,
  Button,
  Card,
  ConfirmAction,
  EmptyState,
  ErrorNote,
  Note,
  Pill,
  PoolBallLoader,
  RoomCode,
} from "./ui";
import { AddPlayerPanel } from "./AddPlayerPanel";
import { MatchSetupForm } from "./MatchSetupForm";
import { Scoreboard } from "./Scoreboard";
import { TournamentPanel } from "./TournamentPanel";
import { PracticePanel } from "./PracticePanel";
import { useSession } from "./RackShell";

type Mode = "lobby" | "new-match" | "tournament" | "practice";

export function RoomView({ code }: { code: string }) {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const { user, profile, loading: sessionLoading } = useSession();
  const room = useRoom(code, user?.id ?? null);
  const [mode, setMode] = useState<Mode>("lobby");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const live = useLiveMatch(room.room?.current_match_id ?? null, user?.id ?? null);

  const inRoom = Boolean(user && room.members.some((m) => m.user_id === user.id));
  const closed = room.room?.is_active === false;

  /* Join the room automatically — if you opened the link you meant to be here. */
  const join = useCallback(async () => {
    if (!supabase || !user || !room.room) return;
    const { error: err } = await supabase
      .from("room_players")
      .insert({ room_id: room.room.id, user_id: user.id });
    // A duplicate just means another tab got there first.
    if (err && err.code !== "23505") setError(err.message);
  }, [supabase, user, room.room]);

  useEffect(() => {
    if (user && room.room && !inRoom && !room.loading && !closed) void join();
  }, [user, room.room, room.loading, inRoom, closed, join]);

  /* ---- host actions ------------------------------------------------- */

  async function closeTable() {
    if (!supabase || !room.room) return;
    setBusy(true);
    const { error: err } = await supabase
      .from("rooms")
      .update({ is_active: false, closed_at: new Date().toISOString() })
      .eq("id", room.room.id);
    setBusy(false);
    if (err) return setError(err.message);
    router.push("/rack");
  }

  // Closing is a tidy-up, not a decision — an accidental one should cost a tap
  // to undo rather than a new table and a new code to tell everyone.
  async function reopenTable() {
    if (!supabase || !room.room) return;
    setBusy(true);
    const { error: err } = await supabase
      .from("rooms")
      .update({ is_active: true, closed_at: null })
      .eq("id", room.room.id);
    setBusy(false);
    if (err) return setError(err.message);
    await room.refresh();
    setManaging(false);
  }

  async function deleteTable() {
    if (!supabase || !room.room) return;
    setBusy(true);
    const { error: err } = await supabase.from("rooms").delete().eq("id", room.room.id);
    setBusy(false);
    if (err) return setError(err.message);
    router.push("/rack");
  }

  async function removeMember(rowId: string) {
    if (!supabase) return;
    const { error: err } = await supabase.from("room_players").delete().eq("id", rowId);
    if (err) setError(err.message);
    await room.refresh();
  }

  /* ---- render -------------------------------------------------------- */

  if (room.loading || sessionLoading) {
    return <PoolBallLoader label="Finding the table" />;
  }

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

  const activeMatch = live.state && live.row?.status === "in_progress" ? live : null;
  const roomRow = room.room;

  return (
    <div className="space-y-4">
      {/* ---- the table ------------------------------------------------- */}
      <Card>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[hsl(var(--rack-accent))]">
            Table
          </p>
          <h1 className="truncate font-[family-name:var(--rack-font-display)] text-3xl tracking-wide">
            {roomRow.name}
          </h1>
          {room.isHost && (
            <p className="mt-0.5 text-sm text-[hsl(var(--rack-fg-muted))]">
              You&apos;re hosting
            </p>
          )}
        </div>

        {/* One row: the code people need, then the things you can do with the
            table. On a phone this wraps under the title instead of leaving two
            unlabelled icons floating on their own line. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <RoomCode code={roomRow.code} />
          <Link
            href={`/rack/display/${roomRow.code}`}
            target="_blank"
            className="ml-auto"
          >
            <Button variant="secondary">
              <Monitor className="h-4 w-4" />
              <span className="hidden sm:inline">TV display</span>
            </Button>
          </Link>
          {room.isHost && (
            <Button
              variant="ghost"
              onClick={() => setManaging((v) => !v)}
              aria-label="Manage table"
              title="Manage table"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {managing && room.isHost && (
          <div className="mt-4 grid gap-2 border-t border-[hsl(var(--rack-border))] pt-4 sm:grid-cols-2">
            {closed ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void reopenTable()}
              >
                Reopen table
              </Button>
            ) : (
              <ConfirmAction
                variant="secondary"
                size="md"
                label="Close table"
                question={
                  <>
                    Close <strong>{roomRow.name}</strong>? It stops appearing in
                    your tables and nobody can join it. Every match it hosted is
                    kept, and so is everyone&apos;s record.
                  </>
                }
                confirmLabel="Close it"
                busy={busy}
                onConfirm={closeTable}
              />
            )}
            <ConfirmAction
              variant="danger"
              size="md"
              label="Delete permanently"
              question={
                <>
                  Delete <strong>{roomRow.name}</strong> and its match log for good?
                  Lifetime records already banked from those matches stay — this
                  removes the table and the scoresheets, not anyone&apos;s stats.
                </>
              }
              confirmLabel="Delete forever"
              busy={busy}
              onConfirm={deleteTable}
            />
          </div>
        )}
      </Card>

      <ErrorNote>{error}</ErrorNote>

      {closed && (
        <Note>
          This table is closed. Its history is still here, but nothing new can be
          started.{" "}
          {room.isHost ? (
            <>Reopen it under the manage button above, or{" "}</>
          ) : null}
          <Link href="/rack" className="underline underline-offset-4">
            open a new one
          </Link>
          .
        </Note>
      )}

      {!user && (
        <Card className="text-center">
          <p className="text-sm text-[hsl(var(--rack-fg-muted))]">
            You&apos;re watching as a spectator.{" "}
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

      {live.loading && roomRow.current_match_id && (
        <PoolBallLoader label="Loading the match" />
      )}

      {activeMatch ? (
        <Scoreboard
          live={activeMatch}
          onFinished={async () => {
            await activeMatch.finalize();
            if (supabase) {
              await supabase
                .from("rooms")
                .update({ current_match_id: null })
                .eq("id", roomRow.id);
            }
            setMode("lobby");
          }}
        />
      ) : mode === "new-match" ? (
        <MatchSetupForm
          roomId={roomRow.id}
          members={room.members}
          ownerId={user?.id ?? null}
          onPlayersChanged={room.refresh}
          onStarted={() => setMode("lobby")}
          onCancel={() => setMode("lobby")}
        />
      ) : mode === "tournament" ? (
        <TournamentPanel
          roomId={roomRow.id}
          members={room.members}
          isHost={room.isHost}
          onClose={() => setMode("lobby")}
        />
      ) : mode === "practice" ? (
        <PracticePanel
          roomId={roomRow.id}
          members={room.members}
          viewerId={user?.id ?? null}
          onClose={() => setMode("lobby")}
        />
      ) : (
        <>
          {/* ---- who's here ------------------------------------------- */}
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--rack-accent))]">
                <Users className="h-4 w-4" />
                At the table ({room.members.length})
              </h2>
              {user && !closed && !addingPlayer && (
                <Button variant="secondary" size="sm" onClick={() => setAddingPlayer(true)}>
                  <UserPlus className="h-4 w-4" /> Add player
                </Button>
              )}
            </div>

            {room.members.length === 0 ? (
              <p className="text-sm text-[hsl(var(--rack-fg-muted))]">
                Nobody yet — share the code above.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {room.members.map((m) => {
                  const isGuest = m.profile?.is_guest ?? false;
                  const canRemove =
                    (room.isHost || m.profile?.guest_owner === user?.id) &&
                    m.user_id !== roomRow.created_by;
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-[var(--rack-radius)] px-2 py-1.5 hover:bg-[hsl(var(--rack-bg-soft))]"
                    >
                      <Avatar
                        name={m.profile?.name ?? "?"}
                        url={m.profile?.avatar_url}
                        size={32}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {m.profile?.name ?? "Unknown"}
                      </span>
                      {m.user_id === roomRow.created_by && <Pill>host</Pill>}
                      {isGuest && <Pill tone="accent">guest</Pill>}
                      {canRemove && !closed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void removeMember(m.id)}
                          aria-label={`Remove ${m.profile?.name ?? "player"}`}
                          title="Remove from the table"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* The whole point: a second player without a second account. */}
            {addingPlayer && user && (
              <div className="mt-3">
                <AddPlayerPanel
                  ownerId={user.id}
                  roomId={roomRow.id}
                  seatedIds={room.members.map((m) => m.user_id)}
                  onSeated={room.refresh}
                  onClose={() => setAddingPlayer(false)}
                />
              </div>
            )}

            {user && !addingPlayer && room.members.length < 2 && !closed && (
              <p className="mt-3 text-sm text-[hsl(var(--rack-fg-muted))]">
                A match needs two players. Share the code, or{" "}
                <button
                  type="button"
                  onClick={() => setAddingPlayer(true)}
                  className="font-semibold text-[hsl(var(--rack-accent))] underline underline-offset-4"
                >
                  add whoever you&apos;re playing
                </button>{" "}
                — they don&apos;t need an account.
              </p>
            )}
          </Card>

          {/* ---- what to do ------------------------------------------- */}
          {user && !closed && (
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
            <Note>
              Set your own skill levels on{" "}
              <Link href="/rack/profile" className="underline underline-offset-4">
                your profile
              </Link>{" "}
              before starting a match.
            </Note>
          )}
        </>
      )}
    </div>
  );
}
