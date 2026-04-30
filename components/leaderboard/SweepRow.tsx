"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
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

    const rect = ref.current.getBoundingClientRect();
    const origin = {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    };
    const t = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 75,
        startVelocity: 35,
        origin,
        colors: ["#C9A24A", "#E0BE6B", "#1F6E3D", "#2E8B57", "#C8362F"],
        scalar: 0.9,
      });
    }, 200 + rank * 80);
    return () => clearTimeout(t);
  }, [celebrate, rank]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.4, delay: rank * 0.04 }}
      className={cn(
        "flex items-center gap-4 p-4",
        rank === 1 && "bg-[var(--color-felt-deep)]/40",
      )}
    >
      <span className="w-8 font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--color-brass-bright)]">
        {rank}
      </span>
      <PoolBall number={(rank - 1) % 7 + 1} size={36} />
      <Link
        href={`/roster/${row.playerId}`}
        className="flex-1 truncate text-base font-medium hover:text-[var(--color-brass)]"
      >
        {row.playerName}
      </Link>
      <div className="grid grid-cols-3 gap-3 text-right">
        <Stat label="Sweeps" value={row.sweeps} accent />
        <Stat label="Mini" value={row.miniSweeps} />
        <Stat label="Wins" value={row.wins} />
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="min-w-[3.5rem]">
      <p
        className={`font-[family-name:var(--font-display)] text-xl tracking-wide ${
          accent ? "text-[var(--color-pop-bright)]" : "text-[var(--fg)]"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
        {label}
      </p>
    </div>
  );
}
