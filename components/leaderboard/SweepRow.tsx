"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { PoolBall } from "@/components/brand/PoolBall";
import { PatchTrophyStrip } from "@/components/cards/PatchBadge";
import { StreakBadge } from "@/components/cards/StreakBadge";
import { OutcomeBars } from "@/components/leaderboard/OutcomeBars";
import { MoveArrow } from "@/components/leaderboard/WeekRecap";
import type { LeaderboardRow } from "@/lib/apa/schemas";
import type { Streak } from "@/lib/streaks";
import type { PatchInstance, PatchKind } from "@/components/cards/PatchBadge";
import { cn } from "@/lib/utils";

export function SweepRow({
  row,
  rank,
  celebrate = false,
  streak,
  outcomes,
  patchInstances,
  rankDelta = null,
  tied = false,
}: {
  row: LeaderboardRow;
  rank: number;
  celebrate?: boolean;
  streak?: Streak | null;
  outcomes?: ("W" | "L")[];
  patchInstances?: Partial<Record<PatchKind, PatchInstance[]>>;
  /** Places gained (+) or lost (−) since last week. Null when unknown. */
  rankDelta?: number | null;
  /** Joint position — shown as "T4" rather than implying a clean placing. */
  tied?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!celebrate || !ref.current) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    const rect = ref.current.getBoundingClientRect();
    const origin = {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    };
    const t = setTimeout(async () => {
      // Lazy-load canvas-confetti only when a celebration actually fires —
      // no need to ship the lib in the initial bundle.
      const { default: confetti } = await import("canvas-confetti");
      if (cancelled) return;
      confetti({
        particleCount: 60,
        spread: 75,
        startVelocity: 35,
        origin,
        colors: ["#C9A24A", "#E0BE6B", "#1F6E3D", "#2E8B57", "#C8362F"],
        scalar: 0.9,
      });
    }, 200 + rank * 80);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [celebrate, rank]);

  return (
    <div
      ref={ref}
      className={cn(
        // Top-aligned, not centred: a row carrying a patch strip is taller
        // than the rank and avatar beside it, and centring left the name
        // floating above them attached to nothing.
        "group fade-in-up flex items-start gap-3 rounded-2xl px-3 py-3.5 sm:gap-4 sm:px-4",
        "transition-colors hover:bg-white/[0.04]",
      )}
      style={{ animationDelay: `${rank * 40}ms` }}
    >
      <span className="flex w-9 shrink-0 flex-col items-center pt-0.5 sm:w-10">
        <span className="font-[family-name:var(--font-display)] text-3xl leading-none tabular-nums text-[var(--color-cream)]/35 transition-colors group-hover:text-[var(--color-cream)]/60">
          {tied ? `T${rank}` : rank}
        </span>
        {rankDelta !== null && rankDelta !== 0 && (
          <span className="mt-1 flex items-center gap-px text-[10px] tabular-nums text-[var(--color-cream)]/50">
            <MoveArrow delta={rankDelta} />
            {Math.abs(rankDelta)}
          </span>
        )}
      </span>
      {row.profileImage ? (
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--color-brass)]/45 shadow-[0_8px_18px_-8px_rgba(0,0,0,0.9)]">
          <Image
            src={row.profileImage}
            alt={row.playerName}
            fill
            sizes="40px"
            className="object-cover object-top"
          />
        </div>
      ) : (
        <PoolBall
          number={((rank - 1) % 7) + 1}
          size={40}
          className="shrink-0 drop-shadow-[0_8px_10px_rgba(0,0,0,0.6)]"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/roster/${row.playerId}`}
            className="min-w-0 truncate text-base font-medium text-[var(--color-cream)] transition-colors hover:text-[var(--color-brass-bright)]"
          >
            {row.playerName}
            {row.skillLevel && (
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-cream)]/40">
                SL{row.skillLevel}
              </span>
            )}
          </Link>
          {streak && <StreakBadge streak={streak} variant="chip" />}
        </div>
        <PatchTrophyStrip
          sweeps={row.sweeps}
          miniSweeps={row.miniSweeps}
          breakAndRuns={row.breakAndRuns}
          eightOnBreaks={row.eightOnBreaks}
          levelUps={row.levelUps}
          firstWin={row.firstWin}
          mvp={row.mvp}
          instances={patchInstances}
          size="sm"
          className="mt-2"
        />
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-cream)]/45">
          <span className="tabular-nums">
            {row.wins}/{row.matchesPlayed} W
          </span>
        </div>
      </div>
      {outcomes && outcomes.length > 0 && (
        <div className="hidden shrink-0 self-center sm:block">
          <OutcomeBars outcomes={outcomes} />
        </div>
      )}
      <div className="w-14 shrink-0 text-right">
        <p className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide tabular-nums text-[var(--color-brass-bright)]">
          {row.points}
        </p>
        <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--color-cream)]/40">
          {row.points === 1 ? "pt" : "pts"}
        </p>
      </div>
    </div>
  );
}
