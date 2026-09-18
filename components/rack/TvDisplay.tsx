"use client";

import { Flame, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveMatch } from "@/lib/rack/hooks/useLiveMatch";
import { useRoom } from "@/lib/rack/hooks/useRoom";
import { hillState, sweepWatch, type MatchState, type PlayerSide } from "@/lib/rack/rules/match";
import { raceLabel } from "@/lib/rack/rules/race";

const SCREEN = "flex min-h-dvh flex-col overflow-hidden p-[3vmin]";

/**
 * The TV view — a read-only scoreboard sized for a screen across the room.
 *
 * It subscribes to the same authoritative snapshot the phones write, so there
 * is nothing here to fall out of step: whatever the scorer's phone shows, this
 * shows, because both are rendering the same `live_state` row.
 *
 * Deliberately chrome-free: no header, no nav, no sign-in. Point a browser at
 * it and walk away. It sits outside `app/rack/(app)`, so it gets the theme
 * canvas and nothing else — no Rack Up header, and no Poolmaxxing one either.
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
    <main className={SCREEN}>
      <header className="flex items-baseline justify-between text-[2.2vmin] uppercase tracking-[0.3em] text-[hsl(var(--rack-accent))]">
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
          <span className="text-[hsl(var(--rack-accent))]">
            {state.players[state.winner].name} wins
          </span>
        ) : watch !== null ? (
          <span className="flex items-center gap-[1.5vmin] text-[hsl(var(--rack-accent))]">
            <Flame className="h-[3vmin] w-[3vmin]" />
            Sweep on the line — {state.players[watch].name}
          </span>
        ) : hill.hillHill ? (
          <span className="text-[hsl(var(--rack-secondary))]">Hill — hill</span>
        ) : (
          <span className="text-[hsl(var(--rack-fg-muted))]">
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
          ? "border-[hsl(var(--rack-accent))] bg-[color-mix(in_oklab,hsl(var(--rack-accent))_10%,transparent)]"
          : "border-[hsl(var(--rack-border))]",
      )}
    >
      <p className="max-w-full truncate font-[family-name:var(--rack-font-display)] text-[6vmin] leading-none tracking-wide">
        {p.name}
      </p>
      <p className="mt-[1vmin] text-[2vmin] uppercase tracking-[0.3em] text-[hsl(var(--rack-fg-muted))]">
        SL {p.skill}
        {state.breaker === side && " · breaking"}
      </p>

      <p className="my-[2vmin] font-[family-name:var(--rack-font-display)] text-[22vmin] leading-none text-[hsl(var(--rack-accent))]">
        {p.score}
      </p>
      <p className="text-[2.4vmin] uppercase tracking-[0.3em] text-[hsl(var(--rack-fg-muted))]">
        of {p.target}
      </p>

      <div className="mt-[2vmin] flex flex-wrap justify-center gap-[1.5vmin] text-[1.8vmin] uppercase tracking-[0.2em] text-[hsl(var(--rack-fg-muted))]">
        <span>{p.innings} inn</span>
        <span>{p.safeties} safe</span>
        <span>{p.timeoutsRemaining} TO</span>
      </div>

      {(onHill || hillHill) && (
        <p
          className={cn(
            "mt-[2vmin] flex items-center gap-[1vmin] text-[2.4vmin] uppercase tracking-[0.3em]",
            hillHill ? "text-[hsl(var(--rack-secondary))]" : "text-[hsl(var(--rack-accent))]",
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
    <main className={cn(SCREEN, "items-center justify-center text-center")}>
      <p className="font-[family-name:var(--rack-font-display)] text-[8vmin] tracking-wide">
        {title}
      </p>
      {subtitle && (
        <p className="mt-[2vmin] text-[2.6vmin] uppercase tracking-[0.3em] text-[hsl(var(--rack-fg-muted))]">
          {subtitle}
        </p>
      )}
    </main>
  );
}
