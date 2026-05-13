"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { Player } from "@/lib/apa/schemas";
import type { Streak } from "@/lib/streaks";
import { CueBall, PoolBall } from "@/components/brand/PoolBall";
import { PatchTrophyStrip } from "@/components/cards/PatchBadge";
import { StreakBadge } from "@/components/cards/StreakBadge";
import { cn } from "@/lib/utils";

export function PlayerCard({
  player,
  index = 0,
  streak,
}: {
  player: Player;
  index?: number;
  streak?: Streak | null;
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

  return (
    <div
      className="card-3d fade-in-up"
      style={{ animationDelay: `${index * 40}ms`, height: 200 }}
    >
      <div className="card-3d-inner" data-flipped={flipped || undefined}>
        {/* FRONT */}
        <div className="card-face">
          <Link
            href={`/roster/${player.id}`}
            className="group surface surface-hover relative block h-full overflow-hidden p-5 transition-all"
          >
            <div className="absolute -right-6 -top-6 opacity-30 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-50">
              {skill ? <PoolBall number={skill} size={120} /> : <CueBall size={120} />}
            </div>

            {streak && (
              <div className="absolute left-4 top-4 z-10">
                <StreakBadge streak={streak} />
              </div>
            )}

            <div className={cn("relative flex items-center gap-4", streak ? "mt-7" : "")}>
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-brass)]/40 bg-[var(--color-felt-deep)] text-lg font-semibold tracking-wider text-[var(--color-cream)]">
                {player.profileImage ? (
                  <Image
                    src={player.profileImage}
                    alt={player.name}
                    fill
                    sizes="56px"
                    className="object-cover object-top"
                  />
                ) : (
                  initials || "?"
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass)]">
                  {player.format !== "unknown" ? player.format : "Player"}
                </p>
                <h3 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
                  {player.name}
                </h3>
              </div>
            </div>

            <div className="relative mt-5 flex items-end justify-between gap-3">
              {winPct !== undefined && stats?.matchesPlayed ? (
                <div className="text-xs text-[var(--fg-dim)]">
                  <span className="font-semibold text-[var(--color-cream)]">
                    {stats.wins ?? 0}
                    <span className="text-[var(--fg-dim)]">/</span>
                    {stats.matchesPlayed}
                  </span>{" "}
                  · {winPct}%
                  {stats.points !== undefined && stats.points > 0 && (
                    <> · {stats.points}pt</>
                  )}
                </div>
              ) : (
                <span className="text-xs text-[var(--fg-dim)]">View profile →</span>
              )}
              {skill !== null && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1 text-[11px] font-semibold tracking-wider text-[var(--color-brass-bright)]">
                  SL {skill}
                </span>
              )}
            </div>
          </Link>

          {/* Tap-to-flip handle for touch devices (hover does the same on desktop). */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFlipped((v) => !v);
            }}
            aria-label="Show stats"
            className="absolute bottom-3 right-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-soft)]/80 text-[var(--color-brass-bright)] backdrop-blur transition hover:border-[var(--border-strong)] hover:text-[var(--color-cream)] md:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          </button>
        </div>

        {/* BACK */}
        <div className="card-face card-face-back">
          <Link
            href={`/roster/${player.id}`}
            className="surface surface-hover relative flex h-full flex-col justify-between overflow-hidden p-5"
          >
            {player.actionImage && (
              <>
                <Image
                  src={player.actionImage}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-contain object-center opacity-30"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--bg-card)] via-[var(--bg-card)]/85 to-[var(--bg-card)]/40" />
              </>
            )}

            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
                  Stat Card
                </p>
                <h3 className="font-[family-name:var(--font-display)] text-2xl leading-tight tracking-wide">
                  {player.name}
                </h3>
              </div>
              {skill !== null && <PoolBall number={skill} size={44} />}
            </div>

            <div className="relative grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
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

            {((stats?.sweeps ?? 0) > 0 ||
              (stats?.miniSweeps ?? 0) > 0 ||
              (stats?.breakAndRuns ?? 0) > 0 ||
              (stats?.eightOnBreaks ?? 0) > 0 ||
              (stats?.levelUps ?? 0) > 0 ||
              (stats?.firstWin ?? 0) > 0 ||
              (stats?.mvp ?? 0) > 0) && (
              <div className="relative flex items-center justify-center">
                <PatchTrophyStrip
                  sweeps={stats?.sweeps ?? 0}
                  miniSweeps={stats?.miniSweeps ?? 0}
                  breakAndRuns={stats?.breakAndRuns ?? 0}
                  eightOnBreaks={stats?.eightOnBreaks ?? 0}
                  levelUps={stats?.levelUps ?? 0}
                  firstWin={stats?.firstWin ?? 0}
                  mvp={stats?.mvp ?? 0}
                  size="xs"
                />
              </div>
            )}

            <div className="relative flex items-center justify-between text-[11px]">
              {streak ? <StreakBadge streak={streak} /> : <span />}
              <span className="font-semibold uppercase tracking-[0.18em] text-[var(--color-brass-bright)]">
                View profile →
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFlipped((v) => !v);
            }}
            aria-label="Back to card"
            className="absolute bottom-3 right-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-soft)]/80 text-[var(--color-brass-bright)] backdrop-blur transition hover:border-[var(--border-strong)] hover:text-[var(--color-cream)] md:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15.5-6.4L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15.5 6.4L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
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
    <div className="flex items-baseline justify-between border-b border-[var(--border)]/60 pb-1">
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
