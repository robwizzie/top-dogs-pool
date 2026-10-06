"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Trash2, Trophy, X } from "lucide-react";
import type { DrillScoring } from "@/lib/kinister/drills";
import { useDrillScores, type ScoreEntry } from "@/lib/kinister/useDrillScores";
import { cn } from "@/lib/utils";

type Props = {
  drillId: string;
  scoring: DrillScoring;
};

type PlayerInput = { name: string; score: number };

const DEFAULT_PLAYERS: PlayerInput[] = [{ name: "", score: 0 }];

export function DrillScoreTracker({ drillId, scoring }: Props) {
  const { entries, add, remove, clearDrill } = useDrillScores(drillId);
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<PlayerInput[]>(DEFAULT_PLAYERS);
  const [note, setNote] = useState("");

  const goal = scoring.goal ?? "high";

  const bestByPlayer = useMemo(() => {
    const best = new Map<string, ScoreEntry>();
    for (const e of entries) {
      const current = best.get(e.player);
      if (!current) {
        best.set(e.player, e);
        continue;
      }
      const better =
        goal === "high" ? e.score > current.score : e.score < current.score;
      if (better) best.set(e.player, e);
    }
    return [...best.entries()].sort((a, b) =>
      goal === "high" ? b[1].score - a[1].score : a[1].score - b[1].score,
    );
  }, [entries, goal]);

  function reset() {
    setPlayers(DEFAULT_PLAYERS);
    setNote("");
    setOpen(false);
  }

  function adjustScore(idx: number, delta: number) {
    const next = [...players];
    const max = scoring.max ?? Infinity;
    const nextScore = Math.max(0, Math.min(max, (next[idx]?.score ?? 0) + delta));
    next[idx] = { ...next[idx], score: nextScore };
    setPlayers(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = players
      .map((p) => ({
        name: p.name.trim() || "You",
        score: p.score,
      }))
      .filter((p) => Number.isFinite(p.score) && p.score >= 0);
    if (cleaned.length === 0) return;
    const date = new Date().toISOString();
    for (const p of cleaned) {
      add({ player: p.name, score: p.score, date, note: note || undefined });
    }
    reset();
  }

  return (
    <section className="pm-glass relative isolate overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(255,226,160,0.1),transparent_70%)]"
        aria-hidden
      />
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-[var(--color-brass-bright)]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Score Tracker
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Clear every saved attempt for this drill?")) {
                  clearDrill();
                }
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-cream)]/10 bg-black/30 px-3 text-[11px] font-semibold tracking-wide text-[var(--color-cream)]/55 transition-colors hover:text-[var(--color-pop-bright)]"
            >
              <Trash2 size={11} />
              Clear all
            </button>
          )}
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-b from-[#f0d48a] via-[#c9a24a] to-[#b38b36] px-4 text-xs font-semibold tracking-wide text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_20px_-10px_rgba(201,162,74,0.9)] transition-[filter] hover:brightness-110"
            >
              <Plus size={12} />
              Log attempt
            </button>
          )}
        </div>
      </header>

      <div className="space-y-5 p-5 sm:p-6">
        {open && (
          <form
            onSubmit={submit}
            className="space-y-3 rounded-2xl border border-[var(--color-cream)]/10 bg-black/30 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/55">
                New attempt · {scoring.label}
                {scoring.max ? ` (max ${scoring.max})` : ""}
              </p>
              <button
                type="button"
                onClick={reset}
                className="text-[var(--color-cream)]/55 hover:text-[var(--color-cream)]"
                aria-label="Cancel"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-[11px] text-[var(--color-cream)]/55">
              Tap +/− to update each player&apos;s score as you drill. Save
              the attempt when you&apos;re done.
            </p>
            <ul className="space-y-2">
              {players.map((p, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-cream)]/10 bg-black/40 p-2"
                >
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => {
                      const next = [...players];
                      next[i] = { ...next[i], name: e.target.value };
                      setPlayers(next);
                    }}
                    placeholder={players.length === 1 ? "You" : `Player ${i + 1}`}
                    className="min-w-0 flex-1 rounded-full border border-[var(--color-cream)]/10 bg-black/30 px-2 py-1.5 text-sm text-[var(--color-cream)] placeholder:text-[var(--color-cream)]/55 focus:border-[var(--color-brass)]/60 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustScore(i, -1)}
                      disabled={p.score <= 0}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-cream)]/10 bg-black/30 text-[var(--color-cream)]/55 hover:text-[var(--color-cream)] disabled:opacity-30"
                      aria-label="Decrement score"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="inline-flex min-w-[3.5rem] items-baseline justify-center gap-1 rounded-full border border-[var(--color-cream)]/10 bg-black/30 px-3 py-1.5 text-base">
                      <span className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide tabular-nums text-[var(--color-brass-bright)]">
                        {p.score}
                      </span>
                      {scoring.max && (
                        <span className="text-[10px] text-[var(--color-cream)]/55">
                          /{scoring.max}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustScore(i, 1)}
                      disabled={
                        scoring.max !== undefined && p.score >= scoring.max
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-brass)]/40 bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)] hover:bg-[var(--color-brass)]/25 disabled:opacity-30"
                      aria-label="Increment score"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {players.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = players.filter((_, idx) => idx !== i);
                        setPlayers(next.length === 0 ? DEFAULT_PLAYERS : next);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-cream)]/10 text-[var(--color-cream)]/55 hover:text-[var(--color-pop-bright)]"
                      aria-label="Remove player"
                    >
                      <X size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setPlayers([...players, { name: "", score: 0 }])
                }
                disabled={players.length >= 8}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-cream)]/10 bg-black/40 px-3 text-[11px] font-semibold tracking-wide text-[var(--color-cream)]/55 transition-colors hover:text-[var(--color-cream)] disabled:opacity-40"
              >
                <Plus size={11} />
                Add player
              </button>
            </div>

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full rounded-xl border border-[var(--color-cream)]/10 bg-black/40 px-3 py-1.5 text-sm text-[var(--color-cream)] placeholder:text-[var(--color-cream)]/55 focus:border-[var(--color-brass)]/60 focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-9 items-center rounded-full border border-[var(--color-cream)]/10 bg-black/40 px-4 text-sm font-semibold tracking-wide text-[var(--color-cream)]/55 transition-colors hover:text-[var(--color-cream)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-full bg-gradient-to-b from-[#f0d48a] via-[#c9a24a] to-[#b38b36] px-5 text-sm font-semibold tracking-wide text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-[filter] hover:brightness-110"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {bestByPlayer.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/55">
              Personal bests
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {bestByPlayer.map(([player, entry], i) => (
                <li
                  key={player}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-4 py-2.5 text-sm",
                    i === 0
                      ? "border-[var(--color-brass)]/45 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(224,190,107,0.18),rgba(224,190,107,0.04))] shadow-[0_10px_30px_-18px_rgba(201,162,74,0.8)]"
                      : "border-[var(--color-cream)]/10 bg-black/30",
                  )}
                >
                  <span className="truncate font-semibold">{player}</span>
                  <span
                    className={cn(
                      "font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide tabular-nums",
                      i === 0 ? "pm-foil" : "text-[var(--color-brass-bright)]",
                    )}
                  >
                    {entry.score}
                    {scoring.max && (
                      <span className="text-xs text-[var(--color-cream)]/55">
                        /{scoring.max}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {entries.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/55">
              History · {entries.length}{" "}
              {entries.length === 1 ? "attempt" : "attempts"}
            </p>
            <ul className="divide-y divide-[var(--color-cream)]/[0.07] overflow-hidden rounded-2xl border border-[var(--color-cream)]/10">
              {entries.slice(0, 12).map((e, i) => (
                <li
                  key={`${e.date}-${i}`}
                  className="flex items-center justify-between gap-3 bg-black/30 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.player}</p>
                    <p className="text-[11px] text-[var(--color-cream)]/55">
                      {new Date(e.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                  </div>
                  <span className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide tabular-nums text-[var(--color-cream)]">
                    {e.score}
                    {scoring.unit && (
                      <span className="ml-1 text-xs text-[var(--color-cream)]/55">
                        {scoring.unit}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-[var(--color-cream)]/55 hover:text-[var(--color-pop-bright)]"
                    aria-label="Delete entry"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
            {entries.length > 12 && (
              <p className="text-[11px] text-[var(--color-cream)]/55">
                Showing 12 of {entries.length} attempts.
              </p>
            )}
          </div>
        ) : (
          !open && (
            <p className="text-sm text-[var(--color-cream)]/55">
              No attempts yet. Log one to start tracking progress.
            </p>
          )
        )}
      </div>
    </section>
  );
}
