"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { Player } from "@/lib/apa/schemas";
import type { Streak } from "@/lib/streaks";
import { CueBall, PoolBall } from "@/components/brand/PoolBall";
import { PatchTrophyStrip } from "@/components/cards/PatchBadge";
import type { PlayerPatchInstances } from "@/lib/apa";
import { StreakBadge } from "@/components/cards/StreakBadge";
import { cn } from "@/lib/utils";

export function PlayerCard({
  player,
  index = 0,
  streak,
  patchInstances,
}: {
  player: Player;
  index?: number;
  streak?: Streak | null;
  patchInstances?: PlayerPatchInstances;
}) {
  const skill = player.skillLevel ?? null;
  const initials = player.name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const stats = player.stats;
  const winPct =
    stats?.winPct ??
    (stats?.matchesPlayed && stats?.wins !== undefined
      ? Math.round((stats.wins / stats.matchesPlayed) * 1000) / 10
      : undefined);
  const losses =
    stats?.matchesPlayed !== undefined && stats?.wins !== undefined
      ? Math.max(stats.matchesPlayed - stats.wins, 0)
      : undefined;

  const [flipped, setFlipped] = useState(false);

  const hasPatches =
    (stats?.sweeps ?? 0) > 0 ||
    (stats?.miniSweeps ?? 0) > 0 ||
    (stats?.breakAndRuns ?? 0) > 0 ||
    (stats?.eightOnBreaks ?? 0) > 0 ||
    (stats?.levelUps ?? 0) > 0 ||
    (stats?.firstWin ?? 0) > 0 ||
    (stats?.mvp ?? 0) > 0;

  return (
    <div
      className="card-3d fade-in-up"
      style={{ animationDelay: `${index * 40}ms`, height: 268 }}
    >
      <div className="card-3d-inner" data-flipped={flipped || undefined}>
        {/* FRONT — a collector card: foil frame, etched face, holo sheen. */}
        <div className="card-face">
          <Link
            href={`/roster/${player.id}`}
            className="group surface relative block h-full overflow-hidden"
          >
            <span
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_100%_0%,rgba(224,190,107,0.16),transparent_60%),radial-gradient(80%_60%_at_0%_100%,rgba(46,139,87,0.2),transparent_65%)]"
              aria-hidden
            />
            <span className="pm-etch" aria-hidden />
            <span className="pm-holo !opacity-[0.12]" aria-hidden />
            <span
              className="pointer-events-none absolute inset-2.5 rounded-[0.9rem] border border-[var(--color-brass)]/25"
              aria-hidden
            />

            <div className="relative flex h-full flex-col p-5">
              <div className="flex h-11 items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-brass)]">
                    {player.format !== "unknown" ? player.format : "Player"}
                  </p>
                  {streak && <StreakBadge streak={streak} />}
                </div>
                <span className="drop-shadow-[0_8px_12px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:rotate-[-12deg]">
                  {skill ? <PoolBall number={skill} size={44} /> : <CueBall size={44} />}
                </span>
              </div>

              <div className="mt-3 flex min-w-0 items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-[var(--color-brass)]/60 bg-[var(--color-felt-deep)] shadow-[0_10px_24px_-8px_rgba(0,0,0,0.8)]">
                  {player.profileImage ? (
                    <Image
                      src={player.profileImage}
                      alt={player.name}
                      fill
                      sizes="64px"
                      className="object-cover object-top"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-[family-name:var(--font-display)] text-2xl tracking-wider text-[var(--color-cream)]/85">
                      {initials || "?"}
                    </span>
                  )}
                </div>
                <h3 className="min-w-0 font-[family-name:var(--font-display)] text-[1.9rem] leading-[0.9] tracking-wide text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)]">
                  {player.name}
                </h3>
              </div>

              {/* Stat strip */}
              <div className="mt-auto grid grid-cols-3 border-t border-[var(--color-cream)]/[0.08] pr-12 pt-3 md:pr-0">
                <MiniStat
                  label="Record"
                  value={
                    stats?.matchesPlayed ? (
                      <>
                        {stats.wins ?? 0}
                        <span className="text-[var(--color-cream)]/30">/</span>
                        {stats.matchesPlayed}
                      </>
                    ) : (
                      "—"
                    )
                  }
                />
                <MiniStat
                  label="Win"
                  value={
                    winPct !== undefined && stats?.matchesPlayed ? (
                      <>
                        {winPct}
                        <span className="text-[0.6em] text-[var(--color-cream)]/45">%</span>
                      </>
                    ) : (
                      "—"
                    )
                  }
                />
                <MiniStat
                  label={skill !== null ? `SL ${skill} · Pts` : "Pts"}
                  value={stats?.points !== undefined && stats.points > 0 ? stats.points : "—"}
                  accent
                />
              </div>
            </div>
          </Link>

          {/* Tap-to-flip handle for touch devices (hover does the same on desktop). */}
          <FlipButton
            onClick={() => setFlipped((v) => !v)}
            label="Show stats"
          />
        </div>

        {/* BACK */}
        <div className="card-face card-face-back">
          <div className="surface relative h-full overflow-hidden">
            <span
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_80%_at_50%_0%,rgba(46,139,87,0.35),transparent_70%)]"
              aria-hidden
            />
            {player.actionImage && (
              <>
                <Image
                  src={player.actionImage}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="pointer-events-none object-contain object-center opacity-30"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--bg-card)] via-[var(--bg-card)]/85 to-[var(--bg-card)]/40" />
              </>
            )}
            <span className="pm-etch" aria-hidden />

            {/* Navigation overlay — covers the whole card so any tap that
             * isn't on the patches or flip button takes you to the profile. */}
            <Link
              href={`/roster/${player.id}`}
              aria-label={`View ${player.name}'s profile`}
              className="absolute inset-0 z-10"
            />

            {/* Card content — visual only; pointer-events pass through to the
             * Link beneath, except where we re-enable them for the patches. */}
            <div className="pointer-events-none relative z-20 flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-brass)]">
                    Stat Card
                  </p>
                  <h3 className="truncate font-[family-name:var(--font-display)] text-2xl leading-tight tracking-wide text-[var(--color-cream)]">
                    {player.name}
                  </h3>
                </div>
                {skill !== null && <PoolBall number={skill} size={40} />}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <Stat label="Record" value={
                  stats?.matchesPlayed
                    ? `${stats.wins ?? 0}-${losses ?? 0}`
                    : "—"
                } />
                <Stat label="Win %" value={winPct !== undefined ? `${winPct}%` : "—"} />
                <Stat label="Points" value={stats?.points ?? "—"} accent />
                <Stat label="B&R" value={stats?.breakAndRuns ?? "—"} />
                <Stat label="8 on Break" value={stats?.eightOnBreaks ?? "—"} />
                <Stat label="Streak" value={
                  streak && streak.count >= 2
                    ? `${streak.count}${streak.type}`
                    : "—"
                } />
              </div>

              {hasPatches && (
                <div className="pointer-events-auto mt-auto flex items-center justify-center pb-1">
                  <PatchTrophyStrip
                    sweeps={stats?.sweeps ?? 0}
                    miniSweeps={stats?.miniSweeps ?? 0}
                    breakAndRuns={stats?.breakAndRuns ?? 0}
                    eightOnBreaks={stats?.eightOnBreaks ?? 0}
                    levelUps={stats?.levelUps ?? 0}
                    firstWin={stats?.firstWin ?? 0}
                    mvp={stats?.mvp ?? 0}
                    instances={patchInstances}
                    size="xs"
                  />
                </div>
              )}
            </div>

            <FlipButton
              onClick={() => setFlipped((v) => !v)}
              label="Back to card"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 border-[var(--color-cream)]/[0.07] px-1 text-center [&:not(:first-child)]:border-l">
      <p
        className={cn(
          "font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide tabular-nums",
          accent ? "text-[var(--color-brass-bright)]" : "text-[var(--color-cream)]",
        )}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/45">
        {label}
      </p>
    </div>
  );
}

/** Tap-to-flip handle. Mobile-only (desktop flips on hover). Sized at 44×44
 *  to meet the iOS / Material recommended minimum tap target. */
function FlipButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className="absolute bottom-3 right-3 z-30 grid h-11 w-11 place-items-center rounded-full border border-[var(--color-brass)]/35 bg-black/40 text-[var(--color-brass-bright)] backdrop-blur transition hover:border-[var(--color-brass)] hover:text-[var(--color-cream)] md:hidden"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
        <path d="M3 21v-5h5" />
      </svg>
    </button>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-[var(--color-cream)]/[0.07] pb-1">
      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--fg-dim)]">
        {label}
      </span>
      <span
        className={cn(
          "font-[family-name:var(--font-display)] text-base tracking-wide",
          accent ? "text-[var(--color-brass-bright)]" : "text-[var(--color-cream)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
