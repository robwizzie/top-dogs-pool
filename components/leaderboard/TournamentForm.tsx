"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Loader2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionRecord, Format } from "@/lib/apa/schemas";

const CUSTOM = "__custom__";

const FORMATS: Format[] = ["8-ball", "9-ball", "masters", "doubles"];

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--color-brass)] focus:ring-2 focus:ring-[var(--color-brass)]/30";
const labelClass =
  "block text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]";

type Row = {
  key: string;
  player: string;
  customName: string;
  customId: string;
  skillLevel: string;
  opponentName: string;
  opponentSkillLevel: string;
  outcome: "W" | "L";
  scoreFor: string;
  scoreAgainst: string;
  sweep: boolean;
  miniSweep: boolean;
  breakAndRuns: string;
  eightOnBreaks: string;
  levelUps: string;
  firstWin: boolean;
  bonusPoints: string;
  bonusLabel: string;
};

type Game = {
  id: string;
  name: string;
  date: string;
  sessionId: number;
  format: string;
  results: { playerName: string; outcome: string }[];
};

let rowSeq = 0;
function emptyRow(): Row {
  rowSeq += 1;
  return {
    key: `r${rowSeq}`,
    player: "",
    customName: "",
    customId: "",
    skillLevel: "",
    opponentName: "",
    opponentSkillLevel: "",
    outcome: "W",
    scoreFor: "",
    scoreAgainst: "",
    sweep: false,
    miniSweep: false,
    breakAndRuns: "0",
    eightOnBreaks: "0",
    levelUps: "0",
    firstWin: false,
    bonusPoints: "0",
    bonusLabel: "",
  };
}

const n = (s: string) => {
  const v = parseInt(s, 10);
  return Number.isFinite(v) ? v : 0;
};
const f = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

function rowPoints(r: Row): number {
  let p = 0;
  if (r.sweep) p += 1;
  else if (r.miniSweep) p += 0.5;
  p += n(r.breakAndRuns) + n(r.eightOnBreaks) + n(r.levelUps);
  if (r.firstWin) p += 1;
  p += f(r.bonusPoints);
  return Math.round(p * 10) / 10;
}

export function TournamentForm({
  sessions,
  currentSessionId,
  players,
}: {
  sessions: SessionRecord[];
  currentSessionId: number | null;
  players: { id: string; name: string }[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [sessionId, setSessionId] = useState<number | "">(
    currentSessionId ?? "",
  );
  const [format, setFormat] = useState<Format>("8-ball");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [games, setGames] = useState<Game[] | null>(null);

  const sessionName = useCallback(
    (id: number) => sessions.find((s) => s.id === id)?.name ?? `Session ${id}`,
    [sessions],
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/tournaments", { cache: "no-store" });
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
      const data = await res.json();
      if (data.ok) setGames(data.games);
    } catch {
      /* leave list as-is */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const total = rows.reduce((s, r) => s + rowPoints(r), 0);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Give the tournament a name.");
    if (!sessionId) return setError("Pick a session to attribute it to.");

    const results = [];
    for (const r of rows) {
      const isCustom = r.player === CUSTOM;
      const playerId = isCustom ? r.customId.trim() : r.player;
      const playerName = isCustom
        ? r.customName.trim()
        : players.find((p) => p.id === r.player)?.name ?? "";
      if (!playerId || !playerName) {
        return setError(
          "Each row needs a player (pick one, or fill in a custom name + id).",
        );
      }
      const hasScore = r.scoreFor !== "" || r.scoreAgainst !== "";
      results.push({
        playerId,
        playerName,
        ...(r.skillLevel !== "" ? { skillLevel: n(r.skillLevel) } : {}),
        opponentName: r.opponentName.trim(),
        ...(r.opponentSkillLevel !== ""
          ? { opponentSkillLevel: n(r.opponentSkillLevel) }
          : {}),
        outcome: r.outcome,
        ...(hasScore
          ? { score: `${n(r.scoreFor)}-${n(r.scoreAgainst)}` }
          : {}),
        sweep: r.sweep,
        miniSweep: r.sweep ? false : r.miniSweep,
        breakAndRuns: n(r.breakAndRuns),
        eightOnBreaks: n(r.eightOnBreaks),
        levelUps: n(r.levelUps),
        firstWin: r.firstWin,
        bonusPoints: f(r.bonusPoints),
        bonusLabel: r.bonusLabel.trim(),
      });
    }

    setSaving(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          date,
          sessionId: Number(sessionId),
          format,
          results,
        }),
      });
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong saving.");
        return;
      }
      // Reset entry rows but keep the event meta for quick repeat entry.
      setRows([emptyRow()]);
      await refresh();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this tournament entry?")) return;
    const res = await fetch(`/api/tournaments?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.status === 401) {
      setNeedsLogin(true);
      return;
    }
    await refresh();
    router.refresh();
  }

  if (needsLogin) {
    return (
      <div className="surface p-6 text-sm text-[var(--fg-dim)]">
        Your admin session expired.{" "}
        <Link
          href="/admin-login?next=/leaderboard/admin"
          className="font-semibold text-[var(--color-brass-bright)] hover:underline"
        >
          Sign in again
        </Link>{" "}
        to keep editing.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Event meta */}
      <div className="surface space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Tournament name
            <input
              className={cn(inputClass, "mt-1.5 normal-case tracking-normal")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring Singles 2026"
            />
          </label>
          <label className={labelClass}>
            Date
            <input
              type="date"
              className={cn(inputClass, "mt-1.5 normal-case tracking-normal")}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Counts toward session
            <select
              className={cn(inputClass, "mt-1.5 normal-case tracking-normal")}
              value={sessionId}
              onChange={(e) =>
                setSessionId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">Select a session…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Format
            <select
              className={cn(inputClass, "mt-1.5 normal-case tracking-normal")}
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
            >
              {FORMATS.map((fm) => (
                <option key={fm} value={fm}>
                  {fm}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Player rows */}
      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={r.key} className="surface space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass)]">
                <Trophy size={12} />
                Player {i + 1} · {rowPoints(r).toFixed(1)} pt
                {rowPoints(r) === 1 ? "" : "s"}
              </span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setRows((rs) => rs.filter((x) => x.key !== r.key))
                  }
                  className="text-[var(--fg-dim)] transition-colors hover:text-[var(--color-pop-bright)]"
                  aria-label="Remove player"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Player
                <select
                  className={cn(inputClass, "mt-1.5 normal-case tracking-normal")}
                  value={r.player}
                  onChange={(e) => setRow(r.key, { player: e.target.value })}
                >
                  <option value="">Select a player…</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value={CUSTOM}>Other (type a name)…</option>
                </select>
              </label>
              <label className={labelClass}>
                Their skill level
                <input
                  type="number"
                  min={0}
                  max={9}
                  className={cn(inputClass, "mt-1.5 normal-case tracking-normal")}
                  value={r.skillLevel}
                  onChange={(e) => setRow(r.key, { skillLevel: e.target.value })}
                  placeholder="optional"
                />
              </label>
            </div>

            {r.player === CUSTOM && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Custom player name
                  <input
                    className={cn(
                      inputClass,
                      "mt-1.5 normal-case tracking-normal",
                    )}
                    value={r.customName}
                    onChange={(e) =>
                      setRow(r.key, { customName: e.target.value })
                    }
                    placeholder="Full name"
                  />
                </label>
                <label className={labelClass}>
                  Custom player id
                  <input
                    className={cn(
                      inputClass,
                      "mt-1.5 normal-case tracking-normal",
                    )}
                    value={r.customId}
                    onChange={(e) => setRow(r.key, { customId: e.target.value })}
                    placeholder="APA member # or any unique id"
                  />
                </label>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Opponent name
                <input
                  className={cn(inputClass, "mt-1.5 normal-case tracking-normal")}
                  value={r.opponentName}
                  onChange={(e) =>
                    setRow(r.key, { opponentName: e.target.value })
                  }
                  placeholder="optional"
                />
              </label>
              <label className={labelClass}>
                Opponent skill level
                <input
                  type="number"
                  min={0}
                  max={9}
                  className={cn(inputClass, "mt-1.5 normal-case tracking-normal")}
                  value={r.opponentSkillLevel}
                  onChange={(e) =>
                    setRow(r.key, { opponentSkillLevel: e.target.value })
                  }
                  placeholder="optional"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className={labelClass}>
                Result
                <select
                  className={cn(inputClass, "mt-1.5 normal-case tracking-normal")}
                  value={r.outcome}
                  onChange={(e) =>
                    setRow(r.key, { outcome: e.target.value as "W" | "L" })
                  }
                >
                  <option value="W">Win</option>
                  <option value="L">Loss</option>
                </select>
              </label>
              <label className={labelClass}>
                Your games
                <input
                  type="number"
                  min={0}
                  className={cn(inputClass, "mt-1.5 normal-case tracking-normal")}
                  value={r.scoreFor}
                  onChange={(e) => setRow(r.key, { scoreFor: e.target.value })}
                  placeholder="optional"
                />
              </label>
              <label className={labelClass}>
                Opponent games
                <input
                  type="number"
                  min={0}
                  className={cn(inputClass, "mt-1.5 normal-case tracking-normal")}
                  value={r.scoreAgainst}
                  onChange={(e) =>
                    setRow(r.key, { scoreAgainst: e.target.value })
                  }
                  placeholder="optional"
                />
              </label>
            </div>

            {/* Patches */}
            <fieldset className="rounded-xl border border-[var(--border)] p-4">
              <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                Patches
              </legend>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-[var(--fg)]">
                  <input
                    type="checkbox"
                    checked={r.sweep}
                    onChange={(e) =>
                      setRow(r.key, {
                        sweep: e.target.checked,
                        miniSweep: e.target.checked ? false : r.miniSweep,
                      })
                    }
                  />
                  Sweep <span className="text-[var(--fg-dim)]">(1)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-[var(--fg)]">
                  <input
                    type="checkbox"
                    checked={r.miniSweep}
                    disabled={r.sweep}
                    onChange={(e) =>
                      setRow(r.key, { miniSweep: e.target.checked })
                    }
                  />
                  Mini-sweep <span className="text-[var(--fg-dim)]">(0.5)</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-[var(--fg)]">
                  <input
                    type="checkbox"
                    checked={r.firstWin}
                    onChange={(e) =>
                      setRow(r.key, { firstWin: e.target.checked })
                    }
                  />
                  First win <span className="text-[var(--fg-dim)]">(1)</span>
                </label>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className={labelClass}>
                  Break &amp; runs
                  <input
                    type="number"
                    min={0}
                    className={cn(
                      inputClass,
                      "mt-1.5 normal-case tracking-normal",
                    )}
                    value={r.breakAndRuns}
                    onChange={(e) =>
                      setRow(r.key, { breakAndRuns: e.target.value })
                    }
                  />
                </label>
                <label className={labelClass}>
                  8-on-the-break
                  <input
                    type="number"
                    min={0}
                    className={cn(
                      inputClass,
                      "mt-1.5 normal-case tracking-normal",
                    )}
                    value={r.eightOnBreaks}
                    onChange={(e) =>
                      setRow(r.key, { eightOnBreaks: e.target.value })
                    }
                  />
                </label>
                <label className={labelClass}>
                  Level-ups
                  <input
                    type="number"
                    min={0}
                    className={cn(
                      inputClass,
                      "mt-1.5 normal-case tracking-normal",
                    )}
                    value={r.levelUps}
                    onChange={(e) =>
                      setRow(r.key, { levelUps: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Bonus points
                  <input
                    type="number"
                    step="0.5"
                    className={cn(
                      inputClass,
                      "mt-1.5 normal-case tracking-normal",
                    )}
                    value={r.bonusPoints}
                    onChange={(e) =>
                      setRow(r.key, { bonusPoints: e.target.value })
                    }
                  />
                </label>
                <label className={labelClass}>
                  Bonus label
                  <input
                    className={cn(
                      inputClass,
                      "mt-1.5 normal-case tracking-normal",
                    )}
                    value={r.bonusLabel}
                    onChange={(e) =>
                      setRow(r.key, { bonusLabel: e.target.value })
                    }
                    placeholder="e.g. 1st place"
                  />
                </label>
              </div>
            </fieldset>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, emptyRow()])}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--fg-dim)] transition-colors hover:border-[var(--color-brass)] hover:text-[var(--fg)]"
        >
          <Plus size={15} />
          Add another player
        </button>
      </div>

      {/* Submit */}
      <div className="surface flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="text-sm text-[var(--fg-dim)]">
          Total for this entry ·{" "}
          <span className="font-semibold text-[var(--color-brass-bright)]">
            {total.toFixed(1)} pt{total === 1 ? "" : "s"}
          </span>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-brass)] px-6 py-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)] disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? "Saving…" : "Save to leaderboard"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-pop-bright)]">{error}</p>
      )}

      {/* Existing entries */}
      <div className="surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-[var(--fg)]">
          Saved tournament entries
        </h3>
        {games === null ? (
          <p className="text-xs text-[var(--fg-dim)]">Loading…</p>
        ) : games.length === 0 ? (
          <p className="text-xs text-[var(--fg-dim)]">
            None yet — add your first above.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {games.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--fg)]">
                    {g.name}
                  </p>
                  <p className="text-xs text-[var(--fg-dim)]">
                    {g.date} · {sessionName(g.sessionId)} · {g.results.length}{" "}
                    player{g.results.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(g.id)}
                  className="shrink-0 text-[var(--fg-dim)] transition-colors hover:text-[var(--color-pop-bright)]"
                  aria-label={`Delete ${g.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
