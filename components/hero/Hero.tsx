"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { PoolBall } from "@/components/brand/PoolBall";
import { TIKTOK_LIVE_URL } from "@/lib/config";

export function Hero({
  record,
  division,
}: {
  record: { wins: number; losses: number };
  division?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <section className="relative overflow-hidden border-b border-[var(--border)]">
      <div className="felt-texture absolute inset-0 -z-10 opacity-60" aria-hidden />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[var(--bg)]/40 to-[var(--bg)]"
        aria-hidden
      />

      {/* Floating balls */}
      {!reduce && (
        <>
          <motion.div
            className="pointer-events-none absolute left-[6%] top-[18%] hidden md:block"
            animate={{ y: [0, -10, 0], rotate: [0, 6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            <PoolBall number={9} size={56} />
          </motion.div>
          <motion.div
            className="pointer-events-none absolute right-[8%] top-[60%] hidden md:block"
            animate={{ y: [0, 14, 0], rotate: [0, -8, 0] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            <PoolBall number={6} size={72} />
          </motion.div>
          <motion.div
            className="pointer-events-none absolute right-[40%] bottom-[8%] hidden lg:block"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            <PoolBall number={3} size={36} />
          </motion.div>
        </>
      )}

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 md:grid-cols-[1.1fr_1fr] lg:px-8 lg:py-28">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]"
          >
            <span className="block h-px w-8 bg-[var(--color-brass)]" />
            APA Pool · South Jersey
            {division && <span className="text-[var(--fg-dim)]">· {division}</span>}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="font-[family-name:var(--font-display)] text-6xl leading-[0.95] tracking-wide sm:text-7xl lg:text-8xl"
          >
            <span className="block text-[var(--color-cream)]">TOP</span>
            <span className="block text-[var(--color-brass-bright)]">DOGS</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-5 max-w-xl text-[var(--fg-dim)]"
          >
            Live roster, schedule, deep stats, sweeps leaderboard, and match clips —
            pulled fresh from APA every hour. Catch us live on TikTok every match night.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/schedule"
              className="group inline-flex items-center gap-2 rounded-full bg-[var(--color-brass)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)]"
            >
              See the schedule
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href={TIKTOK_LIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-pop)] bg-[color-mix(in_oklab,var(--color-pop)_12%,transparent)] px-5 py-3 text-sm font-semibold text-[var(--color-pop-bright)] transition-colors hover:bg-[var(--color-pop)] hover:text-white"
            >
              <span className="h-2 w-2 animate-pulse-pop rounded-full bg-[var(--color-pop-bright)]" />
              Watch on TikTok
            </a>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 grid max-w-md grid-cols-3 gap-4"
          >
            <Stat label="Record">
              {record.wins}<span className="text-[var(--fg-dim)]">–</span>{record.losses}
            </Stat>
            <Stat label="Win %">
              {pct(record.wins, record.wins + record.losses)}
            </Stat>
            <Stat label="Matches">
              {record.wins + record.losses}
            </Stat>
          </motion.dl>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92, rotate: -3 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mx-auto aspect-square w-full max-w-md"
        >
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(46,139,87,0.55),transparent_70%)] blur-2xl" />
          <div className="relative h-full w-full">
            <Logo size={520} priority className="!h-full !w-full" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/70 px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
        {label}
      </dt>
      <dd className="mt-1 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-brass-bright)]">
        {children}
      </dd>
    </div>
  );
}

function pct(w: number, total: number): string {
  if (!total) return "—";
  return `${Math.round((w / total) * 100)}%`;
}
