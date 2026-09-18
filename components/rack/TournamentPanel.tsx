"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, GripVertical, Play } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import {
  BYE,
  bracketColumns,
  buildBracket,
  lossesByPlayer,
  readyMatches,
  resolveBracket,
  type Bracket,
  type BracketType,
  type MatchResults,
  type ResolvedMatch,
} from "@/lib/rack/rules/bracket";
import { GAME_TYPES, type GameType } from "@/lib/rack/rules/race";
import { skillFor, type ProfileRow, type TournamentRow } from "@/lib/rack/types";
import type { RoomMember } from "@/lib/rack/hooks/useRoom";
import { Avatar, Button, Card, EmptyState, ErrorNote, Field, Input, Pill, Spinner } from "./ui";

/**
 * Tournament runner.
 *
 * Seeding generates the entire bracket at once and stores it on the
 * tournament row, so it can be drawn before a ball is struck and every
 * subsequent round is a pure function of the results so far. Recording a
 * winner is a single upsert against a stable slot id — there is no round
 * generation step that can produce a different bracket than the one on screen.
 */
export function TournamentPanel({
  roomId,
  members,
  isHost,
  onClose,
}: {
  roomId: string;
  members: RoomMember[];
  isHost: boolean;
  onClose: () => void;
}) {
  const supabase = getSupabaseBrowser();
  const [tournament, setTournament] = useState<TournamentRow | null>(null);
  const [results, setResults] = useState<MatchResults>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const profiles = useMemo(
    () => members.map((m) => m.profile).filter((p): p is ProfileRow => p !== null),
    [members],
  );
  const nameOf = useCallback(
    (id: string | null) => {
      if (!id) return null;
      if (id === BYE) return "Bye";
      return profiles.find((p) => p.id === id)?.name ?? "Unknown";
    },
    [profiles],
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .eq("room_id", roomId)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = (data as TournamentRow | null) ?? null;
    setTournament(row);

    if (row) {
      const { data: rows } = await supabase
        .from("tournament_matches")
        .select("bracket_match_id, winner_id")
        .eq("tournament_id", row.id);
      const next: MatchResults = {};
      for (const r of rows ?? []) {
        if (r.bracket_match_id && r.winner_id) {
          next[r.bracket_match_id] = { winner: r.winner_id };
        }
      }
      setResults(next);
    }
    setLoading(false);
  }, [supabase, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Results land from whoever is recording them; keep every device in step.
  useEffect(() => {
    if (!supabase || !tournament) return;
    const channel = supabase
      .channel(`rack_tournament_${tournament.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_matches",
          filter: `tournament_id=eq.${tournament.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, tournament, load]);

  const resolved = useMemo(() => {
    if (!tournament?.bracket || !tournament.seeds) return null;
    const seeds = new Map(
      Object.entries(tournament.seeds).map(([seed, id]) => [Number(seed), id]),
    );
    return resolveBracket(tournament.bracket as Bracket, seeds, results);
  }, [tournament, results]);

  const recordWinner = useCallback(
    async (slot: ResolvedMatch, winnerId: string) => {
      if (!supabase || !tournament) return;
      const { error: err } = await supabase.from("tournament_matches").upsert(
        {
          tournament_id: tournament.id,
          bracket_match_id: slot.id,
          round: slot.round,
          match_number: slot.order,
          bracket: slot.bracket,
          player1_id: slot.aId === BYE ? null : slot.aId,
          player2_id: slot.bId === BYE ? null : slot.bId,
          winner_id: winnerId,
          status: "completed",
          completed_at: new Date().toISOString(),
        },
        { onConflict: "tournament_id,bracket_match_id" },
      );
      if (err) setError(err.message);
      else await load();
    },
    [supabase, tournament, load],
  );

  // Close the tournament out once the bracket has a champion.
  useEffect(() => {
    if (!supabase || !tournament || !resolved?.complete || !resolved.champion) return;
    if (tournament.status === "complete") return;
    void supabase
      .from("tournaments")
      .update({
        status: "complete",
        winner_id: resolved.champion,
        completed_at: new Date().toISOString(),
      })
      .eq("id", tournament.id);
  }, [supabase, tournament, resolved]);

  if (loading) return <Spinner label="Loading the bracket" />;

  if (!tournament) {
    return (
      <TournamentSetup
        roomId={roomId}
        profiles={profiles}
        isHost={isHost}
        onCreated={load}
        onCancel={onClose}
      />
    );
  }

  if (!resolved) {
    return (
      <EmptyState title="Bracket not seeded">
        <Button className="mt-3" onClick={onClose}>
          Back
        </Button>
      </EmptyState>
    );
  }

  const ready = readyMatches(resolved);
  const losses = lossesByPlayer(resolved);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            {tournament.bracket_type === "double" ? "Double elimination" : "Single elimination"}
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
            {tournament.name}
          </h2>
          <p className="text-sm text-[var(--fg-dim)]">
            {tournament.game_type} · {resolved.bracket.playerCount} players
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Back to table
        </Button>
      </Card>

      <ErrorNote>{error}</ErrorNote>

      {resolved.champion && (
        <Card className="text-center">
          <Crown className="mx-auto h-8 w-8 text-[var(--color-brass-bright)]" />
          <p className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-wide">
            {nameOf(resolved.champion)} wins it
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {[...resolved.placements.entries()]
              .sort((a, b) => a[1] - b[1])
              .map(([id, place]) => (
                <Pill key={id} tone={place === 1 ? "brass" : "neutral"}>
                  {place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"} · {nameOf(id)}
                </Pill>
              ))}
          </div>
        </Card>
      )}

      {ready.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-brass)]">
            Up next
          </h3>
          <ul className="space-y-2">
            {ready.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2"
              >
                <Pill>{m.label}</Pill>
                <span className="flex-1 text-sm">
                  {nameOf(m.aId)} <span className="text-[var(--fg-dim)]">vs</span>{" "}
                  {nameOf(m.bId)}
                </span>
                {isHost && (
                  <span className="flex gap-2">
                    <Button size="sm" onClick={() => void recordWinner(m, m.aId!)}>
                      {nameOf(m.aId)} won
                    </Button>
                    <Button size="sm" onClick={() => void recordWinner(m, m.bId!)}>
                      {nameOf(m.bId)} won
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!isHost && (
            <p className="mt-3 text-xs text-[var(--fg-dim)]">
              The host records results.
            </p>
          )}
        </Card>
      )}

      <BracketBoard resolved={resolved} nameOf={nameOf} losses={losses} />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function BracketBoard({
  resolved,
  nameOf,
  losses,
}: {
  resolved: NonNullable<ReturnType<typeof resolveBracket>>;
  nameOf: (id: string | null) => string | null;
  losses: Map<string, number>;
}) {
  const sides = (["winners", "losers", "final"] as const).filter(
    (side) => bracketColumns(resolved, side).length > 0,
  );

  return (
    <div className="space-y-6">
      {sides.map((side) => (
        <div key={side}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-brass)]">
            {side === "winners"
              ? resolved.bracket.type === "double"
                ? "Winners bracket"
                : "Bracket"
              : side === "losers"
                ? "Losers bracket"
                : "Finals"}
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {bracketColumns(resolved, side).map((col) => (
              <div key={col.round} className="min-w-[13rem] shrink-0 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--fg-dim)]">
                  {col.label}
                </p>
                {col.matches.map((m) => (
                  <BracketCell key={m.id} match={m} nameOf={nameOf} losses={losses} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BracketCell({
  match,
  nameOf,
  losses,
}: {
  match: ResolvedMatch;
  nameOf: (id: string | null) => string | null;
  losses: Map<string, number>;
}) {
  const row = (id: string | null) => {
    const won = id !== null && match.winnerId === id;
    const isBye = id === BYE;
    return (
      <div
        className={[
          "flex items-center justify-between gap-2 px-2 py-1.5 text-sm",
          won && "bg-[var(--color-brass)]/12 font-semibold text-[var(--color-brass-bright)]",
          isBye && "italic text-[var(--fg-dim)]",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="truncate">{nameOf(id) ?? "—"}</span>
        {id && id !== BYE && (losses.get(id) ?? 0) > 0 && (
          <span className="shrink-0 text-[10px] text-[var(--fg-dim)]">
            {losses.get(id)}L
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)] bg-black/20">
      {row(match.aId)}
      {row(match.bId)}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function TournamentSetup({
  roomId,
  profiles,
  isHost,
  onCreated,
  onCancel,
}: {
  roomId: string;
  profiles: ProfileRow[];
  isHost: boolean;
  onCreated: () => Promise<void>;
  onCancel: () => void;
}) {
  const supabase = getSupabaseBrowser();
  const [name, setName] = useState("Tuesday Tournament");
  const [game, setGame] = useState<GameType>("8-ball");
  const [type, setType] = useState<BracketType>("single");
  const [seeded, setSeeded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSeeded((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const move = (index: number, delta: number) =>
    setSeeded((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const preview = useMemo(
    () => (seeded.length >= 2 ? buildBracket(seeded.length, type) : null),
    [seeded.length, type],
  );

  async function create() {
    if (!supabase || seeded.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const bracket = buildBracket(seeded.length, type);
      const seeds = Object.fromEntries(seeded.map((id, i) => [String(i + 1), id]));

      const { data, error: insertError } = await supabase
        .from("tournaments")
        .insert({
          room_id: roomId,
          name: name.trim() || "Tournament",
          game_type: game,
          tournament_type: type,
          bracket_type: type,
          bracket,
          seeds,
          status: "in_progress",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      await supabase.from("tournament_players").insert(
        seeded.map((userId, i) => ({
          tournament_id: data.id,
          user_id: userId,
          seed: i + 1,
        })),
      );

      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the tournament.");
    } finally {
      setBusy(false);
    }
  }

  if (!isHost) {
    return (
      <EmptyState title="No tournament running">
        <p>The room host can start one.</p>
        <Button className="mt-3" onClick={onCancel}>
          Back
        </Button>
      </EmptyState>
    );
  }

  return (
    <Card className="space-y-5">
      <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
        New tournament
      </h2>

      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

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

      <Field
        label="Format"
        hint={
          type === "double"
            ? "Everyone gets a second life. The winners-bracket player only has to win the grand final once."
            : "One loss and you're out."
        }
      >
        <div className="flex gap-2">
          {(["single", "double"] as const).map((t) => (
            <Button
              key={t}
              variant={type === t ? "primary" : "secondary"}
              onClick={() => setType(t)}
              className="flex-1"
            >
              {t === "single" ? "Single elim" : "Double elim"}
            </Button>
          ))}
        </div>
      </Field>

      <Field label="Entrants" hint="Tap to add. Order sets the seeding — seed 1 at the top.">
        <div className="grid gap-2 sm:grid-cols-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={[
                "flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm transition",
                seeded.includes(p.id)
                  ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]",
              ].join(" ")}
            >
              <Avatar name={p.name} url={p.avatar_url} size={28} />
              <span className="truncate">{p.name}</span>
              <span className="ml-auto text-xs text-[var(--fg-dim)]">
                SL {skillFor(p, game) ?? "—"}
              </span>
            </button>
          ))}
        </div>
      </Field>

      {seeded.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brass)]">
            Seeding
          </p>
          <ol className="space-y-1">
            {seeded.map((id, i) => (
              <li
                key={id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
              >
                <GripVertical className="h-4 w-4 text-[var(--fg-dim)]" />
                <span className="w-6 text-[var(--color-brass)]">{i + 1}</span>
                <span className="flex-1 truncate">
                  {profiles.find((p) => p.id === id)?.name}
                </span>
                <Button size="sm" variant="ghost" onClick={() => move(i, -1)} aria-label="Move up">
                  ↑
                </Button>
                <Button size="sm" variant="ghost" onClick={() => move(i, 1)} aria-label="Move down">
                  ↓
                </Button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {preview && (
        <p className="text-sm text-[var(--fg-dim)]">
          {preview.size - preview.playerCount > 0
            ? `${preview.size - preview.playerCount} bye${preview.size - preview.playerCount === 1 ? "" : "s"} — the top seeds sit out round one.`
            : "No byes — the bracket is full."}{" "}
          {preview.matches.length} slots in the bracket.
        </p>
      )}

      <ErrorNote>{error}</ErrorNote>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-[2]"
          disabled={busy || seeded.length < 2}
          onClick={() => void create()}
        >
          <Play className="h-4 w-4" />
          {busy ? "Creating…" : `Start with ${seeded.length}`}
        </Button>
      </div>
    </Card>
  );
}
