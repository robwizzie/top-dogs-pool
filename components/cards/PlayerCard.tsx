"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Player } from "@/lib/apa/schemas";
import { CueBall, PoolBall } from "@/components/brand/PoolBall";
import { cn } from "@/lib/utils";

export function PlayerCard({ player, index = 0 }: { player: Player; index?: number }) {
  const skill = player.skillLevel ?? null;
  const initials = player.name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
    >
      <Link
        href={`/roster/${player.id}`}
        className="group surface surface-hover relative block overflow-hidden p-5 transition-all"
      >
        <div className="absolute -right-6 -top-6 opacity-30 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-50">
          {skill ? <PoolBall number={skill} size={120} /> : <CueBall size={120} />}
        </div>

        <div className="relative flex items-center gap-4">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--color-brass)]/40 bg-[var(--color-felt-deep)] text-lg font-semibold tracking-wider text-[var(--color-cream)]",
            )}
          >
            {initials || "?"}
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

        <div className="relative mt-5 flex items-end justify-between">
          <span className="text-xs text-[var(--fg-dim)]">View profile →</span>
          {skill !== null && (
            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 py-1 text-[11px] font-semibold tracking-wider text-[var(--color-brass-bright)]">
              SL {skill}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
