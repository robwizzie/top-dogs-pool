"use client";

import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import { buildSetup, initialState, type PlayerSide } from "@/lib/rack/rules/match";
import { GAME_TYPES, raceLabel, type GameType } from "@/lib/rack/rules/race";
import { skillFor, type ProfileRow } from "@/lib/rack/types";
import type { RoomMember } from "@/lib/rack/hooks/useRoom";
import { AddPlayerPanel } from "./AddPlayerPanel";
import { Avatar, Button, Card, ErrorNote, Field, Pill } from "./ui";

/**
 * Pick two players, a game and a breaker, and start a match.
 *
 * The race is computed and shown *before* the match starts, from the real APA
 * charts. The old app showed a race derived from `skillLevel - 1` and only
 * discovered a missing skill level after the insert had already happened,
 * leaving orphaned match rows behind.
 *
 * A guest can be added from right here. Sending someone back to the lobby to
 * fetch a second player, when the thing they are looking at is a picker with
 * one name in it, is the kind of detour that makes an app feel like paperwork.
 */
export function MatchSetupForm({
  roomId,
  members,
  ownerId,
  onPlayersChanged,
  onStarted,
  onCancel,
}: {
  roomId: string;
  members: RoomMember[];
  /** The signed-in account, which is who any guest added here belongs to. */
  ownerId: string | null;
  onPlayersChanged: () => Promise<void>;
  onStarted: (matchId: string) => void;
  onCancel: () => void;
}) {
  const supabase = getSupabaseBrowser();
  const [game, setGame] = useState<GameType>("8-ball");
  const [playerA, setPlayerA] = useState<string>("");
  const [playerB, setPlayerB] = useState<string>("");
  const [breaker, setBreaker] = useState<PlayerSide>(0);
  const [isCasual, setIsCasual] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profiles = useMemo(
    () =>
      members
        .map((m) => m.profile)
        .filter((p): p is ProfileRow => p !== null),
    [members],
  );

  const a = profiles.find((p) => p.id === playerA) ?? null;
  const b = profiles.find((p) => p.id === playerB) ?? null;

  const preview = useMemo(() => {
    if (!a || !b) return null;
    return buildSetup({
      game,
      isCasual,
      breaker,
      players: [
        { userId: a.id, name: a.name, skill: skillFor(a, game) },
        { userId: b.id, name: b.name, skill: skillFor(b, game) },
      ],
    });
  }, [a, b, game, isCasual, breaker]);

  async function start() {
    if (!supabase || !preview) return;
    if (!preview.ok) {
      setError(preview.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const setup = preview.setup;
      const { data, error: insertError } = await supabase
        .from("matches")
        .insert({
          room_id: roomId,
          game_type: setup.game,
          is_casual: setup.isCasual,
          status: "in_progress",
          setup,
          live_state: initialState(setup),
          version: 0,
          player_ids: setup.players.map((p) => p.userId),
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      // Point the room at the new match so every device in it follows along.
      await supabase
        .from("rooms")
        .update({ current_match_id: data.id })
        .eq("id", roomId);

      onStarted(data.id as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the match.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="font-[family-name:var(--rack-font-display)] text-2xl tracking-wide">
          New match
        </h2>
        <p className="text-sm text-[hsl(var(--rack-fg-muted))]">
          Both players need a skill level for the game you pick.
        </p>
      </div>

      <Field label="Game">
        <div className="flex gap-2">
          {GAME_TYPES.map((g) => (
            <Button
              key={g}
              variant={game === g ? "primary" : "secondary"}
              onClick={() => setGame(g)}
              className="flex-1"
            >
              {g}
            </Button>
          ))}
        </div>
      </Field>

      <PlayerPicker
        label="Player one"
        profiles={profiles}
        game={game}
        selected={playerA}
        disabledId={playerB}
        onSelect={setPlayerA}
      />
      <PlayerPicker
        label="Player two"
        profiles={profiles}
        game={game}
        selected={playerB}
        disabledId={playerA}
        onSelect={setPlayerB}
      />

      {ownerId &&
        (addingPlayer ? (
          <AddPlayerPanel
            ownerId={ownerId}
            roomId={roomId}
            seatedIds={members.map((m) => m.user_id)}
            onSeated={onPlayersChanged}
            onClose={() => setAddingPlayer(false)}
          />
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setAddingPlayer(true)}
          >
            <UserPlus className="h-4 w-4" />
            {profiles.length < 2
              ? "Add whoever you're playing"
              : "Add another player"}
          </Button>
        ))}

      {a && b && (
        <Field label="Who breaks first">
          <div className="flex gap-2">
            {([0, 1] as const).map((side) => (
              <Button
                key={side}
                variant={breaker === side ? "primary" : "secondary"}
                onClick={() => setBreaker(side)}
                className="flex-1"
              >
                {side === 0 ? a.name : b.name}
              </Button>
            ))}
          </div>
        </Field>
      )}

      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={isCasual}
          onChange={(e) => setIsCasual(e.target.checked)}
          className="h-5 w-5 accent-[hsl(var(--rack-accent))]"
        />
        <span>
          Casual match
          <span className="block text-xs text-[hsl(var(--rack-fg-muted))]">
            Played for fun — kept in history but left out of lifetime stats.
          </span>
        </span>
      </label>

      {preview?.ok && (
        <div className="rounded-xl border border-[hsl(var(--rack-border-strong))] bg-black/20 px-4 py-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--rack-accent))]">
            {raceLabel(
              game,
              preview.setup.players[0].target,
              preview.setup.players[1].target,
            )}
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--rack-fg-muted))]">
            {preview.setup.players[0].name} (SL {preview.setup.players[0].skill}) breaks
            first vs {preview.setup.players[1].name} (SL {preview.setup.players[1].skill})
          </p>
        </div>
      )}

      <ErrorNote>{error ?? (preview && !preview.ok ? preview.error : null)}</ErrorNote>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-[2]"
          disabled={busy || !preview?.ok}
          onClick={() => void start()}
        >
          {busy ? "Starting…" : "Start match"}
        </Button>
      </div>
    </Card>
  );
}

function PlayerPicker({
  label,
  profiles,
  game,
  selected,
  disabledId,
  onSelect,
}: {
  label: string;
  profiles: ProfileRow[];
  game: GameType;
  selected: string;
  disabledId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="grid gap-2 sm:grid-cols-2">
        {profiles.map((p) => {
          const skill = skillFor(p, game);
          const isDisabled = p.id === disabledId;
          const isSelected = p.id === selected;
          return (
            <button
              key={p.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(p.id)}
              className={[
                "flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left transition",
                isSelected
                  ? "border-[hsl(var(--rack-accent))] bg-[hsl(var(--rack-accent))]/10"
                  : "border-[hsl(var(--rack-border))] hover:border-[hsl(var(--rack-border-strong))]",
                isDisabled && "cursor-not-allowed opacity-30",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Avatar name={p.name} url={p.avatar_url} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{p.name}</span>
                  {p.is_guest && <Pill tone="accent">guest</Pill>}
                </span>
                {skill === null ? (
                  <Pill tone="hot">No {game} SL</Pill>
                ) : (
                  <span className="text-xs text-[hsl(var(--rack-fg-muted))]">SL {skill}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {profiles.length === 0 && (
        <p className="text-sm text-[hsl(var(--rack-fg-muted))]">
          Nobody at this table yet — share the code, or add a guest below.
        </p>
      )}
    </Field>
  );
}
