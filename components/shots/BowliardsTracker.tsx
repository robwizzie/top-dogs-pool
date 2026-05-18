"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2, Trophy, Undo2, X } from "lucide-react";
import {
  frameTotals,
  gameTotal,
  maxForNextRoll,
  nextRollSlot,
  useBowliardsGames,
  type BowliardsPlayer,
  type Frame,
} from "@/lib/kinister/useBowliardsScores";
import { cn } from "@/lib/utils";

const FRAME_COUNT = 10;

export function BowliardsTracker() {
  const {
    current,
    history,
    startGame,
    recordRoll,
    undoRoll,
    finishGame,
    cancelGame,
    clearHistory,
    clearAll,
  } = useBowliardsGames();

  if (!current) {
    return (
      <div className="space-y-4">
        <NewGameForm onStart={startGame} />
        <HistoryList history={history} onClearHistory={clearHistory} />
      </div>
    );
  }

  const everyoneDone = current.players.every(
    (p) => nextRollSlot(p.frames) === null,
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
            Live game · {current.players.length}{" "}
            {current.players.length === 1 ? "player" : "players"}
          </p>
          <p className="font-[family-name:var(--font-display)] text-lg tracking-wide text-[var(--fg)]">
            Frame{" "}
            {Math.min(
              FRAME_COUNT,
              Math.max(
                ...current.players.map(
                  (p) => (nextRollSlot(p.frames)?.frame ?? FRAME_COUNT - 1) + 1,
                ),
              ),
            )}{" "}
            of {FRAME_COUNT}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {everyoneDone && (
            <button
              type="button"
              onClick={finishGame}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-felt-bright)]/50 bg-[var(--color-felt-bright)]/15 px-3 text-[11px] font-semibold tracking-wide text-[var(--color-felt-bright)] hover:bg-[var(--color-felt-bright)]/25"
            >
              <Trophy size={11} />
              Save final
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm("Discard this game without saving?")) cancelGame();
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-[11px] font-semibold tracking-wide text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)]"
          >
            <X size={11} />
            Discard
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {current.players.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            onRoll={(pins) => recordRoll(p.id, pins)}
            onUndo={() => undoRoll(p.id)}
          />
        ))}
      </div>

      <HistoryList history={history} onClearHistory={clearHistory} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (confirm("Wipe live game AND history?")) clearAll();
          }}
          className="inline-flex items-center gap-1.5 text-[11px] text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)]"
        >
          <Trash2 size={11} />
          Clear everything
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function NewGameForm({
  onStart,
}: {
  onStart: (names: string[]) => void;
}) {
  const [names, setNames] = useState<string[]>([""]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onStart(names);
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        New game
      </p>
      <ul className="space-y-2">
        {names.map((n, i) => (
          <li key={i} className="flex gap-2">
            <input
              type="text"
              value={n}
              onChange={(e) => {
                const next = [...names];
                next[i] = e.target.value;
                setNames(next);
              }}
              placeholder={names.length === 1 ? "You" : `Player ${i + 1}`}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg-dim)] focus:border-[var(--color-brass)]/60 focus:outline-none"
            />
            {names.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setNames(names.filter((_, idx) => idx !== i))
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)]"
                aria-label="Remove player"
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={() => setNames([...names, ""])}
          disabled={names.length >= 6}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-[11px] font-semibold tracking-wide text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-40"
        >
          <Plus size={11} />
          Add player
        </button>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-full border border-[var(--color-brass)]/50 bg-[var(--color-brass)]/20 px-4 text-sm font-semibold tracking-wide text-[var(--color-brass-bright)] hover:bg-[var(--color-brass)]/35"
        >
          Start game
        </button>
      </div>
    </form>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function PlayerCard({
  player,
  onRoll,
  onUndo,
}: {
  player: BowliardsPlayer;
  onRoll: (pins: number) => void;
  onUndo: () => void;
}) {
  const totals = useMemo(() => frameTotals(player.frames), [player.frames]);
  const total = gameTotal(player.frames);
  const slot = nextRollSlot(player.frames);
  const max = maxForNextRoll(player.frames);
  const done = slot === null;

  return (
    <article
      className={cn(
        "rounded-xl border bg-[var(--bg-card)] p-3",
        done
          ? "border-[var(--color-felt-bright)]/40"
          : "border-[var(--border)]",
      )}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="truncate font-semibold">{player.name}</p>
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-brass-bright)]">
          {total ?? "—"}
        </p>
      </div>

      <Scorecard frames={player.frames} totals={totals} activeIdx={slot?.frame} />

      {done ? (
        <p className="mt-3 text-center text-xs text-[var(--color-felt-bright)]">
          Final: {total ?? 0}
        </p>
      ) : (
        <RollPad
          max={max}
          isFrameTen={slot.frame === 9}
          isSecondRoll={slot.roll === 2}
          afterStrike={
            slot.frame === 9 &&
            slot.roll >= 2 &&
            player.frames[9].roll1 === 10
          }
          onRoll={onRoll}
          onUndo={onUndo}
          hasAnyRolls={player.frames.some(
            (f) =>
              f.roll1 !== undefined ||
              f.roll2 !== undefined ||
              f.roll3 !== undefined,
          )}
        />
      )}
    </article>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Scorecard({
  frames,
  totals,
  activeIdx,
}: {
  frames: Frame[];
  totals: (number | undefined)[];
  activeIdx?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-full gap-0.5">
        {frames.map((f, i) => (
          <FrameCell
            key={i}
            frame={f}
            frameIdx={i}
            total={totals[i]}
            active={activeIdx === i}
          />
        ))}
      </div>
    </div>
  );
}

function FrameCell({
  frame,
  frameIdx,
  total,
  active,
}: {
  frame: Frame;
  frameIdx: number;
  total: number | undefined;
  active: boolean;
}) {
  const isFrameTen = frameIdx === 9;
  const r1 = frame.roll1;
  const r2 = frame.roll2;
  const r3 = frame.roll3;
  const isStrike1 = r1 === 10;
  const isStrike2 = isFrameTen && r2 === 10;
  const isSpare = !isStrike1 && r2 !== undefined && (r1 ?? 0) + r2 === 10;

  function renderRoll(v: number | undefined, isStrike: boolean, isSpare: boolean) {
    if (v === undefined) return "";
    if (isStrike) return "X";
    if (isSpare) return "/";
    if (v === 0) return "–";
    return String(v);
  }

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col rounded border",
        active
          ? "border-[var(--color-brass)]/60 bg-[var(--color-brass)]/10"
          : "border-[var(--border)] bg-[var(--bg)]",
        isFrameTen ? "w-16" : "w-12",
      )}
    >
      <div className="flex h-5 items-stretch divide-x divide-[var(--border)] border-b border-[var(--border)] text-[10px] font-semibold text-[var(--fg)]">
        {isFrameTen ? (
          <>
            <span className="flex-1 text-center leading-5">
              {renderRoll(r1, isStrike1, false)}
            </span>
            <span className="flex-1 text-center leading-5">
              {renderRoll(
                r2,
                isStrike2,
                !isStrike1 && isSpare,
              )}
            </span>
            <span className="flex-1 text-center leading-5">
              {r3 === 10 ? "X" : r3 === undefined ? "" : String(r3)}
            </span>
          </>
        ) : (
          <>
            <span className="flex-1 text-center leading-5">
              {isStrike1 ? "" : renderRoll(r1, false, false)}
            </span>
            <span className="flex-1 text-center leading-5">
              {isStrike1
                ? "X"
                : renderRoll(r2, false, isSpare)}
            </span>
          </>
        )}
      </div>
      <div className="flex h-7 items-center justify-center text-xs font-semibold text-[var(--fg-dim)]">
        {total ?? ""}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function RollPad({
  max,
  isFrameTen,
  isSecondRoll,
  afterStrike,
  onRoll,
  onUndo,
  hasAnyRolls,
}: {
  max: number;
  isFrameTen: boolean;
  isSecondRoll: boolean;
  afterStrike: boolean;
  onRoll: (pins: number) => void;
  onUndo: () => void;
  hasAnyRolls: boolean;
}) {
  // Pin buttons 0..max
  const buttons: number[] = [];
  for (let i = 0; i <= max; i++) buttons.push(i);

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        {isFrameTen
          ? afterStrike
            ? "Fresh rack — pins this roll"
            : isSecondRoll
              ? "Pins remaining"
              : "Pins this roll"
          : isSecondRoll
            ? "Pins remaining"
            : "Pins this roll"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {buttons.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onRoll(n)}
            className={cn(
              "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-sm font-semibold tracking-wide transition-colors",
              n === max && n === 10
                ? "border-[var(--color-felt-bright)]/50 bg-[var(--color-felt-bright)]/15 text-[var(--color-felt-bright)] hover:bg-[var(--color-felt-bright)]/25"
                : n === max
                  ? "border-[var(--color-brass)]/50 bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)] hover:bg-[var(--color-brass)]/25"
                  : "border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--border-strong)]",
            )}
          >
            {n === 10 ? "X" : n}
          </button>
        ))}
        {hasAnyRolls && (
          <button
            type="button"
            onClick={onUndo}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs font-semibold text-[var(--fg-dim)] hover:text-[var(--fg)]"
            aria-label="Undo last roll"
          >
            <Undo2 size={11} />
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function HistoryList({
  history,
  onClearHistory,
}: {
  history: ReturnType<typeof useBowliardsGames>["history"];
  onClearHistory: () => void;
}) {
  if (history.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
          Past games · {history.length}
        </p>
        <button
          type="button"
          onClick={() => {
            if (confirm("Clear all past Bowliards games?")) onClearHistory();
          }}
          className="inline-flex items-center gap-1.5 text-[11px] text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)]"
        >
          <RotateCcw size={11} />
          Clear history
        </button>
      </div>
      <ul className="space-y-2">
        {history.map((g) => {
          const sorted = [...g.players].sort(
            (a, b) => (gameTotal(b.frames) ?? 0) - (gameTotal(a.frames) ?? 0),
          );
          return (
            <li
              key={g.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3"
            >
              <div className="flex items-baseline justify-between text-[11px] text-[var(--fg-dim)]">
                <span>
                  {new Date(g.finishedAt ?? g.startedAt).toLocaleDateString(
                    undefined,
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}
                </span>
                <span>{g.players.length} players</span>
              </div>
              <ul className="mt-1.5 divide-y divide-[var(--border)]/60">
                {sorted.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-baseline justify-between py-1 text-sm"
                  >
                    <span
                      className={cn(
                        "truncate",
                        i === 0 && "font-semibold text-[var(--color-brass-bright)]",
                      )}
                    >
                      {p.name}
                      {i === 0 && " 🏆"}
                    </span>
                    <span className="font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--fg)]">
                      {gameTotal(p.frames) ?? 0}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
