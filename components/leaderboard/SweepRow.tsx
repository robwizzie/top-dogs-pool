"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { PoolBall } from "@/components/brand/PoolBall";
import type { LeaderboardRow } from "@/lib/apa/schemas";
import { cn } from "@/lib/utils";

export function SweepRow({
  row,
  rank,
  celebrate = false,
}: {
  row: LeaderboardRow;
  rank: number;
  celebrate?: boolean;
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
        "fade-in-up flex items-center gap-3 p-4",
        rank === 1 && "bg-[var(--color-felt-deep)]/40",
      )}
      style={{ animationDelay: `${rank * 40}ms` }}
    >
      <span className="w-8 shrink-0 font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--color-brass-bright)]">
        {rank}
      </span>
      {row.profileImage ? (
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--color-brass)]/40">
          <Image
            src={row.profileImage}
            alt={row.playerName}
            fill
            sizes="36px"
            className="object-cover"
          />
        </div>
      ) : (
        <PoolBall number={((rank - 1) % 7) + 1} size={36} />
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={`/roster/${row.playerId}`}
          className="block truncate text-base font-medium hover:text-[var(--color-brass)]"
        >
          {row.playerName}
          {row.skillLevel && (
            <span className="ml-2 text-xs text-[var(--fg-dim)]">
              SL{row.skillLevel}
            </span>
          )}
        </Link>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--fg-dim)]">
          {row.sweeps > 0 && (
            <span>
              <span className="font-semibold text-[var(--color-pop-bright)]">
                {row.sweeps}
              </span>{" "}
              sweep{row.sweeps === 1 ? "" : "s"}
            </span>
          )}
          {row.miniSweeps > 0 && (
            <span>
              <span className="font-semibold text-[var(--color-brass-bright)]">
                {row.miniSweeps}
              </span>{" "}
              mini
            </span>
          )}
          {row.breakAndRuns > 0 && (
            <span>
              <span className="font-semibold text-[var(--color-felt-bright)]">
                {row.breakAndRuns}
              </span>{" "}
              B&amp;R
            </span>
          )}
          {row.eightOnBreaks > 0 && (
            <span>
              <span className="font-semibold text-[var(--color-cream)]">
                {row.eightOnBreaks}
              </span>{" "}
              8-on-break
            </span>
          )}
          {row.levelUps > 0 && (
            <span>
              <span className="font-semibold text-[var(--color-felt-bright)]">
                {row.levelUps}
              </span>{" "}
              level up{row.levelUps === 1 ? "" : "s"}
            </span>
          )}
          <span>
            {row.wins}/{row.matchesPlayed} W
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--color-brass-bright)]">
          {row.points}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          {row.points === 1 ? "pt" : "pts"}
        </p>
      </div>
    </div>
  );
}
