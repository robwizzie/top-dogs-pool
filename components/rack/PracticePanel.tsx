"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Target } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/rack/supabase/browser";
import {
  DRILLS,
  drillById,
  drillMaxScore,
  parseDrillPlan,
  serializeDrillPlan,
  type Drill,
  type DrillPlan,
} from "@/lib/rack/rules/drills";
import type {
  PracticeSessionPlayerRow,
  PracticeSessionRow,
  ProfileRow,
} from "@/lib/rack/types";
import type { RoomMember } from "@/lib/rack/hooks/useRoom";
import { Avatar, Button, Card, EmptyState, ErrorNote, Field, Pill, PoolBallLoader } from "./ui";

/**
 * Practice sessions.
 *
 * A session is a list of drills and a set of players; each player accumulates
 * a score per drill. Scores are written per attempt rather than reconstructed
 * at the end, so walking away mid-drill keeps whatever was already logged.
 */
export function PracticePanel({
  roomId,
  members,
  viewerId,
  onClose,
}: {
  roomId: string;
  members: RoomMember[];
  viewerId: string | null;
  onClose: () => void;
}) {
  const supabase = getSupabaseBrowser();
  const [session, setSession] = useState<PracticeSessionRow | null>(null);
  const [scores, setScores] = useState<PracticeSessionPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const profiles = useMemo(
    () => members.map((m) => m.profile).filter((p): p is ProfileRow => p !== null),
    [members],
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("practice_sessions")
      .select("*")
      .eq("room_id", roomId)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = (data as PracticeSessionRow | null) ?? null;
    setSession(row);

    if (row) {
      const { data: players } = await supabase
        .from("practice_session_players")
        .select("*")
        .eq("session_id", row.id);
      setScores((players ?? []) as PracticeSessionPlayerRow[]);
    }
    setLoading(false);
  }, [supabase, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!supabase || !session) return;
    const channel = supabase
      .channel(`rack_practice_${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "practice_session_players",
          filter: `session_id=eq.${session.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, session, load]);

  const record = useCallback(
    async (userId: string, drill: Drill, points: number) => {
      if (!supabase || !session) return;
      const existing = scores.find((s) => s.user_id === userId);
      const drillScores = { ...(existing?.drill_scores ?? {}) };
      drillScores[drill.id] = (drillScores[drill.id] ?? 0) + points;

      const total = Object.values(drillScores).reduce((a, b) => a + b, 0);
      const attempts = (existing?.attempts ?? 0) + 1;

      const { error: err } = await supabase.from("practice_session_players").upsert(
        {
          ...(existing?.id ? { id: existing.id } : {}),
          session_id: session.id,
          user_id: userId,
          drill_scores: drillScores,
          score: total,
          attempts,
        },
        { onConflict: "session_id,user_id" },
      );
      if (err) setError(err.message);
      else await load();
    },
    [supabase, session, scores, load],
  );

  const end = useCallback(async () => {
    if (!supabase || !session) return;

    // Roll the session into each player's lifetime practice stats.
    const plan = parseDrillPlan(session.drill_type);
    for (const entry of scores) {
      for (const { id: drillId } of plan) {
        const drill = drillById(drillId);
        const value = entry.drill_scores?.[drillId];
        if (!drill || value === undefined) continue;

        const { data: existing } = await supabase
          .from("practice_stats")
          .select("*")
          .eq("user_id", entry.user_id)
          .eq("drill_type", drillId)
          .maybeSingle();

        await supabase.from("practice_stats").upsert(
          {
            ...(existing?.id ? { id: existing.id } : {}),
            user_id: entry.user_id,
            drill_type: drillId,
            best_score: Math.max(existing?.best_score ?? 0, value),
            completions:
              (existing?.completions ?? 0) + (value >= drill.target ? 1 : 0),
            total_attempts: (existing?.total_attempts ?? 0) + 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,drill_type" },
        );
      }
    }

    await supabase
      .from("practice_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", session.id);
    setSession(null);
    setScores([]);
    onClose();
  }, [supabase, session, scores, onClose]);

  if (loading) return <PoolBallLoader label="Loading practice" />;

  if (!session) {
    return (
      <PracticeSetup
        roomId={roomId}
        profiles={profiles}
        viewerId={viewerId}
        onCreated={load}
        onCancel={onClose}
      />
    );
  }

  const plan = parseDrillPlan(session.drill_type);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[hsl(var(--rack-accent))]">
            Practice
          </p>
          <h2 className="font-[family-name:var(--rack-font-display)] text-2xl tracking-wide">
            {plan.length} {plan.length === 1 ? "drill" : "drills"}
          </h2>
        </div>
        <Button variant="primary" onClick={() => void end()}>
          <Check className="h-4 w-4" /> Finish &amp; save
        </Button>
      </Card>

      <ErrorNote>{error}</ErrorNote>

      {plan.map(({ id, target }) => {
        const drill = drillById(id);
        if (!drill) return null;
        return (
          <Card key={id}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-[family-name:var(--rack-font-display)] text-xl tracking-wide">
                {drill.name}
              </h3>
              <Pill tone="accent">
                target {target} / max {drillMaxScore(drill)}
              </Pill>
            </div>
            <p className="text-sm text-[hsl(var(--rack-fg-muted))]">{drill.instructions}</p>

            <div className="mt-4 space-y-2">
              {scores.length === 0 && (
                <p className="text-sm text-[hsl(var(--rack-fg-muted))]">No players in this session.</p>
              )}
              {scores.map((entry) => {
                const profile = profiles.find((p) => p.id === entry.user_id);
                const value = entry.drill_scores?.[id] ?? 0;
                return (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--rack-border))] px-3 py-2"
                  >
                    <Avatar name={profile?.name ?? "?"} url={profile?.avatar_url} size={28} />
                    <span className="flex-1 truncate text-sm">{profile?.name ?? "Player"}</span>
                    <span className="font-[family-name:var(--rack-font-display)] text-xl text-[hsl(var(--rack-accent))]">
                      {value}
                    </span>
                    <span className="flex gap-1.5">
                      {drill.scoring.kind === "per-attempt" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => void record(entry.user_id, drill, 1)}
                          >
                            Made
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void record(entry.user_id, drill, 0)}
                          >
                            Missed
                          </Button>
                        </>
                      ) : (
                        drill.scoring.options.map((opt) => (
                          <Button
                            key={opt.label}
                            size="sm"
                            variant={opt.points > 0 ? "secondary" : "ghost"}
                            onClick={() => void record(entry.user_id, drill, opt.points)}
                          >
                            {opt.label}
                            {opt.points > 0 && ` +${opt.points}`}
                          </Button>
                        ))
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function PracticeSetup({
  roomId,
  profiles,
  viewerId,
  onCreated,
  onCancel,
}: {
  roomId: string;
  profiles: ProfileRow[];
  viewerId: string | null;
  onCreated: () => Promise<void>;
  onCancel: () => void;
}) {
  const supabase = getSupabaseBrowser();
  const [selected, setSelected] = useState<DrillPlan>([]);
  const [players, setPlayers] = useState<string[]>(viewerId ? [viewerId] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDrill = (drill: Drill) =>
    setSelected((prev) =>
      prev.some((d) => d.id === drill.id)
        ? prev.filter((d) => d.id !== drill.id)
        : [...prev, { id: drill.id, target: drill.target }],
    );

  const togglePlayer = (id: string) =>
    setPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );

  async function create() {
    if (!supabase || selected.length === 0 || players.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from("practice_sessions")
        .insert({ room_id: roomId, drill_type: serializeDrillPlan(selected) })
        .select("id")
        .single();
      if (insertError) throw insertError;

      await supabase.from("practice_session_players").insert(
        players.map((userId) => ({
          session_id: data.id,
          user_id: userId,
          score: 0,
          attempts: 0,
          drill_scores: {},
        })),
      );
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start practice.");
    } finally {
      setBusy(false);
    }
  }

  if (profiles.length === 0) {
    return (
      <EmptyState title="Nobody at the table">
        <Button className="mt-3" onClick={onCancel}>
          Back
        </Button>
      </EmptyState>
    );
  }

  return (
    <Card className="space-y-5">
      <h2 className="font-[family-name:var(--rack-font-display)] text-2xl tracking-wide">
        Practice session
      </h2>

      <Field label="Drills" hint="Run in the order you pick them.">
        <div className="space-y-2">
          {DRILLS.map((drill) => {
            const on = selected.some((d) => d.id === drill.id);
            const tooFewPlayers = drill.minPlayers > players.length;
            return (
              <button
                key={drill.id}
                type="button"
                disabled={tooFewPlayers}
                onClick={() => toggleDrill(drill)}
                className={[
                  "w-full rounded-xl border px-3 py-3 text-left transition",
                  on
                    ? "border-[hsl(var(--rack-accent))] bg-[hsl(var(--rack-accent))]/10"
                    : "border-[hsl(var(--rack-border))] hover:border-[hsl(var(--rack-border-strong))]",
                  tooFewPlayers && "cursor-not-allowed opacity-40",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[hsl(var(--rack-accent))]" />
                  <span className="font-semibold">{drill.name}</span>
                  {drill.minPlayers > 1 && <Pill>{drill.minPlayers}+ players</Pill>}
                </span>
                <span className="mt-1 block text-sm text-[hsl(var(--rack-fg-muted))]">
                  {drill.description} · {drill.goal}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Players">
        <div className="grid gap-2 sm:grid-cols-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePlayer(p.id)}
              className={[
                "flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm transition",
                players.includes(p.id)
                  ? "border-[hsl(var(--rack-accent))] bg-[hsl(var(--rack-accent))]/10"
                  : "border-[hsl(var(--rack-border))] hover:border-[hsl(var(--rack-border-strong))]",
              ].join(" ")}
            >
              <Avatar name={p.name} url={p.avatar_url} size={28} />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </Field>

      <ErrorNote>{error}</ErrorNote>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-[2]"
          disabled={busy || selected.length === 0 || players.length === 0}
          onClick={() => void create()}
        >
          {busy ? "Starting…" : "Start practice"}
        </Button>
      </div>
    </Card>
  );
}
