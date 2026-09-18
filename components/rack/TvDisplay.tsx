"use client";

import { Flame, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveMatch } from "@/lib/rack/hooks/useLiveMatch";
import { useRoom } from "@/lib/rack/hooks/useRoom";
import { hillState, sweepWatch, type MatchState, type PlayerSide } from "@/lib/rack/rules/match";
import { raceLabel } from "@/lib/rack/rules/race";

/** Covers the site chrome so the whole screen is scoreboard. */
const OVERLAY =
  "fixed inset-0 z-50 flex flex-col overflow-hidden bg-[var(--color-ink)] p-[3vmin]";

/**
 * The TV view — a read-only scoreboard sized for a screen across the room.
 *
 * It subscribes to the same authoritative snapshot the phones write, so there
 * is nothing here to fall out of step: whatever the scorer's phone shows, this
 * shows, because both are rendering the same `live_state` row.
 *
 * Deliberately chrome-free: no header, no nav, no sign-in. Point a browser at
 * it and walk away.
 *
 * It renders as a fixed, full-viewport overlay rather than an ordinary page.
 * Next.js layouts compose rather than replace, so a nested layout can't opt
 * out of the site header, footer and mobile tab bar; covering them is both
 * simpler and more robust than restructuring every route in the site into a
 * layout group just for this one screen.
 */
export function TvDisplay({ code }: { code: string }) {
  const room = useRoom(code, null);
  const live = useLiveMatch(room.room?.current_match_id ?? null, null);

  if (room.loading) return <Splash title="Connecting…" />;
  if (room.error || !room.room) return <Splash title={`No table ${code}`} />;

  if (!live.state) {
    return (
      <Splash
        title={room.room.name}
        subtitle={`Table ${room.room.code} — waiting for a match`}
      />
    );
  }

  const state = live.state;
  const hill = hillState(state);
  const watch = sweepWatch(state);

  return (
    <main className={OVERLAY}>
      <header className="flex items-baseline justify-between text-[2.2vmin] uppercase tracking-[0.3em] text-[var(--color-brass)]">
        <span>{room.room.name}</span>
        <span>
          {state.game} · {raceLabel(state.game, state.players[0].target, state.players[1].target)}
        </span>
        <span>
          Rack {state.rack} · {state.totalInnings} innings
        </span>
      </header>

      <div className="grid flex-1 grid-cols-2 items-center gap-[3vmin]">
        {([0, 1] as const).map((side) => (
          <TvSide
            key={side}
            state={state}
            side={side}
            onHill={hill.onHill.includes(side)}
            hillHill={hill.hillHill}
          />
        ))}
      </div>

      <footer className="flex min-h-[8vmin] items-center justify-center text-center text-[2.6vmin] uppercase tracking-[0.3em]">
        {state.status === "complete" && state.winner !== null ? (
          <span className="text-[var(--color-brass-bright)]">
            {state.players[state.winner].name} wins
          </span>
        ) : watch !== null ? (
          <span className="flex items-center gap-[1.5vmin] text-[var(--color-brass-bright)]">
            <Flame className="h-[3vmin] w-[3vmin]" />
            Sweep on the line — {state.players[watch].name}
          </span>
        ) : hill.hillHill ? (
          <span className="text-[var(--color-pop-bright)]">Hill — hill</span>
        ) : (
          <span className="text-[var(--fg-dim)]">
            {state.players[state.turn].name} at the table
          </span>
        )}
      </footer>
    </main>
  );
}

function TvSide({
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

  return (
    <section
      className={cn(
        "flex h-full flex-col items-center justify-center rounded-[2vmin] border p-[3vmin] transition",
        active
          ? "border-[var(--color-brass)] bg-[color-mix(in_oklab,var(--color-brass)_10%,transparent)]"
          : "border-[var(--border)]",
      )}
    >
      <p className="max-w-full truncate font-[family-name:var(--font-display)] text-[6vmin] leading-none tracking-wide">
        {p.name}
      </p>
      <p className="mt-[1vmin] text-[2vmin] uppercase tracking-[0.3em] text-[var(--fg-dim)]">
        SL {p.skill}
        {state.breaker === side && " · breaking"}
      </p>

      <p className="my-[2vmin] font-[family-name:var(--font-display)] text-[22vmin] leading-none text-[var(--color-brass-bright)]">
        {p.score}
      </p>
      <p className="text-[2.4vmin] uppercase tracking-[0.3em] text-[var(--fg-dim)]">
        of {p.target}
      </p>

      <div className="mt-[2vmin] flex flex-wrap justify-center gap-[1.5vmin] text-[1.8vmin] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
        <span>{p.innings} inn</span>
        <span>{p.safeties} safe</span>
        <span>{p.timeoutsRemaining} TO</span>
      </div>

      {(onHill || hillHill) && (
        <p
          className={cn(
            "mt-[2vmin] flex items-center gap-[1vmin] text-[2.4vmin] uppercase tracking-[0.3em]",
            hillHill ? "text-[var(--color-pop-bright)]" : "text-[var(--color-brass-bright)]",
          )}
        >
          {hillHill ? (
            <Flame className="h-[3vmin] w-[3vmin]" />
          ) : (
            <Mountain className="h-[3vmin] w-[3vmin]" />
          )}
          {hillHill ? "Hill–hill" : "On the hill"}
        </p>
      )}
    </section>
  );
}

function Splash({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <main className={cn(OVERLAY, "items-center justify-center text-center")}>
      <p className="font-[family-name:var(--font-display)] text-[8vmin] tracking-wide">
        {title}
      </p>
      {subtitle && (
        <p className="mt-[2vmin] text-[2.6vmin] uppercase tracking-[0.3em] text-[var(--fg-dim)]">
          {subtitle}
        </p>
      )}
    </main>
  );
}
