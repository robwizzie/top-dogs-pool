"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Trophy, X } from "lucide-react";
import type { DrillScoring } from "@/lib/kinister/drills";
import { useDrillScores, type ScoreEntry } from "@/lib/kinister/useDrillScores";
import { cn } from "@/lib/utils";

type Props = {
  drillId: string;
  scoring: DrillScoring;
};

type PlayerInput = { name: string; score: string };

const DEFAULT_PLAYERS: PlayerInput[] = [{ name: "", score: "" }];

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = players
      .map((p) => ({
        name: p.name.trim() || "You",
        score: Number(p.score),
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
    <section className="surface overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--color-felt-deep)]/30 px-5 py-3">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[var(--color-brass-bright)]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
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
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-[11px] font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:text-[var(--color-pop-bright)]"
            >
              <Trash2 size={11} />
              Clear all
            </button>
          )}
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-brass)]/50 bg-[var(--color-brass)]/15 px-3 text-[11px] font-semibold tracking-wide text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/25"
            >
              <Plus size={12} />
              Log attempt
            </button>
          )}
        </div>
      </header>

      <div className="space-y-4 p-5">
        {open && (
          <form
            onSubmit={submit}
            className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
                New attempt · {scoring.label}
                {scoring.max ? ` (max ${scoring.max})` : ""}
              </p>
              <button
                type="button"
                onClick={reset}
                className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
                aria-label="Cancel"
              >
                <X size={14} />
              </button>
            </div>

            <ul className="space-y-2">
              {players.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => {
                      const next = [...players];
                      next[i] = { ...next[i], name: e.target.value };
                      setPlayers(next);
                    }}
                    placeholder={players.length === 1 ? "You" : `Player ${i + 1}`}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus:border-[var(--color-brass)]/60 focus:outline-none"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={p.score}
                    onChange={(e) => {
                      const next = [...players];
                      next[i] = { ...next[i], score: e.target.value };
                      setPlayers(next);
                    }}
                    placeholder={scoring.unit ?? "score"}
                    min={0}
                    max={scoring.max}
                    className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus:border-[var(--color-brass)]/60 focus:outline-none"
                    required
                  />
                  {players.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = players.filter((_, idx) => idx !== i);
                        setPlayers(next.length === 0 ? DEFAULT_PLAYERS : next);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)]"
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
                  setPlayers([...players, { name: "", score: "" }])
                }
                disabled={players.length >= 8}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-[11px] font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)] disabled:opacity-40"
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
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus:border-[var(--color-brass)]/60 focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-sm font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-full border border-[var(--color-brass)]/50 bg-[var(--color-brass)]/20 px-4 text-sm font-semibold tracking-wide text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/35"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {bestByPlayer.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
              Personal bests
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {bestByPlayer.map(([player, entry], i) => (
                <li
                  key={player}
                  className={cn(
                    "flex items-baseline justify-between rounded-lg border px-3 py-2 text-sm",
                    i === 0
                      ? "border-[var(--color-brass)]/50 bg-[var(--color-brass)]/10"
                      : "border-[var(--border)] bg-[var(--bg-card)]",
                  )}
                >
                  <span className="truncate font-semibold">{player}</span>
                  <span className="font-[family-name:var(--font-display)] text-lg tracking-wide text-[var(--color-brass-bright)]">
                    {entry.score}
                    {scoring.max && (
                      <span className="text-xs text-[var(--fg-dim)]">
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
              History · {entries.length}{" "}
              {entries.length === 1 ? "attempt" : "attempts"}
            </p>
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)]">
              {entries.slice(0, 12).map((e, i) => (
                <li
                  key={`${e.date}-${i}`}
                  className="flex items-center justify-between gap-3 bg-[var(--bg-card)] px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.player}</p>
                    <p className="text-[11px] text-[var(--fg-dim)]">
                      {new Date(e.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                  </div>
                  <span className="font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--fg)]">
                    {e.score}
                    {scoring.unit && (
                      <span className="ml-1 text-xs text-[var(--fg-dim)]">
                        {scoring.unit}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)]"
                    aria-label="Delete entry"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
            {entries.length > 12 && (
              <p className="text-[11px] text-[var(--fg-dim)]">
                Showing 12 of {entries.length} attempts.
              </p>
            )}
          </div>
        ) : (
          !open && (
            <p className="text-sm text-[var(--fg-dim)]">
              No attempts yet. Log one to start tracking progress.
            </p>
          )
        )}
      </div>
    </section>
  );
}
