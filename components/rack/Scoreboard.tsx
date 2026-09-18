"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  Clock,
  Flag,
  Flame,
  Minus,
  Mountain,
  Plus,
  Shield,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  earnedPatches,
  hillState,
  sweepWatch,
  type MatchState,
  type PlayerSide,
} from "@/lib/rack/rules/match";
import { NINE_BALL_RACK_POINTS, raceLabel } from "@/lib/rack/rules/race";
import type { LiveMatch } from "@/lib/rack/hooks/useLiveMatch";
import { Button, Card, ErrorNote, Pill } from "./ui";

/**
 * The live scoreboard — the screen someone is holding while standing at the
 * table, so every control is thumb-sized and the score is legible at arm's
 * length.
 *
 * Read-only for spectators: scoring controls only render for the two players
 * and the room host, which is the same rule the database enforces.
 */
export function Scoreboard({
  live,
  onFinished,
}: {
  live: LiveMatch;
  onFinished?: () => void;
}) {
  const { state, dispatch, undo, canScore, saving, error } = live;
  const [confirmForfeit, setConfirmForfeit] = useState<PlayerSide | null>(null);
  const [rackWinner, setRackWinner] = useState<PlayerSide | null>(null);

  if (!state) return null;

  const hill = hillState(state);
  const watch = sweepWatch(state);
  const done = state.status === "complete";

  return (
    <div className="space-y-4">
      <ScoreHeader state={state} />

      <div className="grid gap-3 sm:grid-cols-2">
        {([0, 1] as const).map((side) => (
          <PlayerPanel
            key={side}
            state={state}
            side={side}
            onHill={hill.onHill.includes(side)}
            hillHill={hill.hillHill}
          />
        ))}
      </div>

      {watch !== null && !done && (
        <div className="flex items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-brass)]/40 bg-[var(--color-brass)]/10 px-4 py-3 text-center">
          <Flame className="h-4 w-4 text-[var(--color-brass-bright)]" />
          <span className="text-sm font-semibold tracking-wide text-[var(--color-brass-bright)]">
            Sweep on the line — {state.players[watch].name} is one away with a shutout
          </span>
        </div>
      )}

      <ErrorNote>{error}</ErrorNote>

      {done ? (
        <FinalPanel state={state} onFinished={onFinished} />
      ) : canScore ? (
        <>
          {state.game === "8-ball" ? (
            <EightBallControls
              state={state}
              rackWinner={rackWinner}
              setRackWinner={setRackWinner}
              dispatch={dispatch}
              saving={saving}
            />
          ) : (
            <NineBallControls state={state} dispatch={dispatch} saving={saving} />
          )}

          <SharedControls
            state={state}
            dispatch={dispatch}
            undo={undo}
            saving={saving}
            confirmForfeit={confirmForfeit}
            setConfirmForfeit={setConfirmForfeit}
          />
        </>
      ) : (
        <Card className="text-center text-sm text-[var(--fg-dim)]">
          You&apos;re watching this match. Only the two players and the room host can
          score it.
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function ScoreHeader({ state }: { state: MatchState }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-center">
      <Pill tone="brass">{state.game}</Pill>
      <Pill>
        {raceLabel(state.game, state.players[0].target, state.players[1].target)}
      </Pill>
      <Pill>Rack {state.rack}</Pill>
      <Pill>
        {state.totalInnings} {state.totalInnings === 1 ? "inning" : "innings"}
      </Pill>
      {state.isCasual && <Pill>Casual — not counted</Pill>}
    </div>
  );
}

function PlayerPanel({
  state,
  side,
  onHill,
  hillHill,
}: {
  state: MatchState;
  side: PlayerSide;
  onHill: boolean;
  hillHill: boolean;
}) {
  const p = state.players[side];
  const active = state.turn === side && state.status === "in_progress";
  const breaking = state.breaker === side;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition",
        active && "border-[var(--color-brass)] shadow-[var(--shadow-brass)]",
      )}
    >
      {active && (
        <span className="absolute inset-x-0 top-0 h-1 bg-[var(--color-brass)]" aria-hidden />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-[family-name:var(--font-display)] text-2xl tracking-wide">
            {p.name}
          </p>
          <p className="text-xs text-[var(--fg-dim)]">
            SL {p.skill}
            {breaking && " · breaking"}
            {active && " · at the table"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-[family-name:var(--font-display)] text-5xl leading-none tracking-wide text-[var(--color-brass-bright)]">
            {p.score}
          </p>
          <p className="text-xs text-[var(--fg-dim)]">of {p.target}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {hillHill && onHill ? (
          <Pill tone="hot">
            <Flame className="h-3 w-3" /> Hill–hill
          </Pill>
        ) : onHill ? (
          <Pill tone="brass">
            <Mountain className="h-3 w-3" /> On the hill
          </Pill>
        ) : null}
        <Pill>
          {p.innings} {p.innings === 1 ? "inning" : "innings"}
        </Pill>
        <Pill>{p.safeties} safe</Pill>
        <Pill>
          {p.timeoutsRemaining}/{p.timeoutsRemaining + p.timeoutsUsed} TO
        </Pill>
        {p.breakAndRuns > 0 && <Pill tone="win">{p.breakAndRuns}× B&amp;R</Pill>}
        {p.eightOnBreaks > 0 && state.game === "8-ball" && (
          <Pill tone="win">{p.eightOnBreaks}× 8-on-break</Pill>
        )}
        {p.nineOnSnaps > 0 && <Pill tone="win">{p.nineOnSnaps}× 9-on-snap</Pill>}
      </div>
    </Card>
  );
}

/* ---- 8-ball -------------------------------------------------------------- */

function EightBallControls({
  state,
  rackWinner,
  setRackWinner,
  dispatch,
  saving,
}: {
  state: MatchState;
  rackWinner: PlayerSide | null;
  setRackWinner: (s: PlayerSide | null) => void;
  dispatch: LiveMatch["dispatch"];
  saving: boolean;
}) {
  if (rackWinner !== null) {
    const name = state.players[rackWinner].name;
    return (
      <Card>
        <p className="mb-3 text-center text-sm text-[var(--fg-dim)]">
          How did {name} win the rack?
        </p>
        <div className="grid gap-2">
          {(
            [
              { kind: "normal", label: "Won the rack" },
              { kind: "break_and_run", label: "Break and run" },
              { kind: "eight_on_break", label: "8 on the break" },
            ] as const
          ).map((option) => (
            <Button
              key={option.kind}
              size="lg"
              variant={option.kind === "normal" ? "primary" : "secondary"}
              disabled={saving}
              onClick={() => {
                dispatch({ type: "rack_won", side: rackWinner, kind: option.kind });
                setRackWinner(null);
              }}
            >
              {option.label}
            </Button>
          ))}
          <Button variant="ghost" onClick={() => setRackWinner(null)}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {([0, 1] as const).map((side) => (
        <Button
          key={side}
          size="lg"
          variant="primary"
          disabled={saving}
          onClick={() => setRackWinner(side)}
          className="min-h-16"
        >
          Rack to {state.players[side].name}
        </Button>
      ))}
    </div>
  );
}

/* ---- 9-ball -------------------------------------------------------------- */

function NineBallControls({
  state,
  dispatch,
  saving,
}: {
  state: MatchState;
  dispatch: LiveMatch["dispatch"];
  saving: boolean;
}) {
  const side = state.turn;
  const name = state.players[side].name;
  const rackLeft = NINE_BALL_RACK_POINTS - state.rackPoints;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-[var(--fg-dim)]">
          At the table: <strong className="text-[var(--fg)]">{name}</strong>
        </span>
        <Pill>{rackLeft} left in rack</Pill>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="lg"
          variant="primary"
          disabled={saving || rackLeft <= 0}
          onClick={() => dispatch({ type: "points", side, points: 1 })}
          className="min-h-16"
        >
          <Plus className="h-4 w-4" /> Ball (1)
        </Button>
        <Button
          size="lg"
          variant="primary"
          disabled={saving || rackLeft < 2}
          onClick={() => dispatch({ type: "points", side, points: 2 })}
          className="min-h-16"
        >
          <Plus className="h-4 w-4" /> Nine (2)
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          disabled={saving || rackLeft <= 0}
          onClick={() => dispatch({ type: "dead_balls", points: 1 })}
        >
          <Minus className="h-4 w-4" /> Dead ball
        </Button>
        <Button
          disabled={saving || rackLeft < 2}
          onClick={() => dispatch({ type: "points", side, points: 2, nineOnSnap: true })}
        >
          9 on the snap
        </Button>
      </div>

      <Button
        className="mt-2 w-full"
        variant="secondary"
        disabled={saving}
        onClick={() => dispatch({ type: "rack_end" })}
      >
        Rack over — re-rack
      </Button>
    </Card>
  );
}

/* ---- shared -------------------------------------------------------------- */

function SharedControls({
  state,
  dispatch,
  undo,
  saving,
  confirmForfeit,
  setConfirmForfeit,
}: {
  state: MatchState;
  dispatch: LiveMatch["dispatch"];
  undo: LiveMatch["undo"];
  saving: boolean;
  confirmForfeit: PlayerSide | null;
  setConfirmForfeit: (s: PlayerSide | null) => void;
}) {
  const side = state.turn;
  const p = state.players[side];

  return (
    <Card className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button disabled={saving} onClick={() => dispatch({ type: "turn_over" })}>
          <ArrowLeftRight className="h-4 w-4" /> Turn over
        </Button>
        <Button disabled={saving} onClick={() => dispatch({ type: "safety", side })}>
          <Shield className="h-4 w-4" /> Safety
        </Button>
        <Button
          disabled={saving}
          onClick={() => dispatch({ type: "defensive_shot", side })}
        >
          Defensive
        </Button>
        <Button
          disabled={saving || p.timeoutsRemaining <= 0}
          onClick={() => dispatch({ type: "timeout", side })}
          title={
            p.timeoutsRemaining <= 0
              ? `${p.name} has no timeouts left this rack`
              : undefined
          }
        >
          <Clock className="h-4 w-4" /> Timeout
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={saving || state.version === 0}
          onClick={() => void undo()}
        >
          <Undo2 className="h-4 w-4" /> Undo last
        </Button>

        {confirmForfeit === null ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setConfirmForfeit(side)}
          >
            <Flag className="h-4 w-4" /> Forfeit
          </Button>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-[var(--fg-dim)]">
              Forfeit for {state.players[confirmForfeit].name}?
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                dispatch({ type: "forfeit", side: confirmForfeit });
                setConfirmForfeit(null);
              }}
            >
              Confirm
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmForfeit(null)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function FinalPanel({
  state,
  onFinished,
}: {
  state: MatchState;
  onFinished?: () => void;
}) {
  const winner = state.winner === null ? null : state.players[state.winner];
  const patches = earnedPatches(state);

  return (
    <Card className="text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
        Final
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide">
        {winner ? `${winner.name} takes it` : "Match over"}
      </p>
      <p className="mt-1 text-sm text-[var(--fg-dim)]">
        {state.players[0].score} — {state.players[1].score}
        {state.forfeitedBy !== null &&
          ` · ${state.players[state.forfeitedBy].name} forfeited`}
      </p>

      {patches.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {patches.map((patch, i) => (
            <Pill key={`${patch.kind}-${patch.side}-${i}`} tone="win">
              {state.players[patch.side].name} ·{" "}
              {patch.count > 1 ? `${patch.count}× ` : ""}
              {patch.kind.replace(/-/g, " ")}
            </Pill>
          ))}
        </div>
      )}

      {state.isCasual && (
        <p className="mt-4 text-xs text-[var(--fg-dim)]">
          Casual match — not added to lifetime stats.
        </p>
      )}

      {onFinished && (
        <Button variant="primary" size="lg" className="mt-5 w-full" onClick={onFinished}>
          Back to the table
        </Button>
      )}
    </Card>
  );
}
