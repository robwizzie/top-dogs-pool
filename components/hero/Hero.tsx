import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { PoolBall } from "@/components/brand/PoolBall";
import { LiveCTA } from "@/components/live/LiveCTA";

/**
 * Server-rendered hero. Entry stagger animations are CSS-only (see globals.css)
 * so we don't ship framer-motion just for opacity fades. `prefers-reduced-motion`
 * is already handled globally by the existing media-query in globals.css.
 */
export function Hero({
  record,
  division,
  homeLocation,
  nextOpponent,
  divisionRank,
  divisionSize,
}: {
  record: { wins: number; losses: number };
  division?: string;
  homeLocation?: string;
  nextOpponent?: string;
  divisionRank?: number;
  divisionSize?: number;
}) {
  const totalMatches = record.wins + record.losses;
  const winPct = totalMatches ? Math.round((record.wins / totalMatches) * 100) : null;
  const isFresh = totalMatches === 0;

  return (
    <section className="relative overflow-hidden border-b border-[var(--border)]">
      <div className="felt-texture absolute inset-0 -z-10 opacity-60" aria-hidden />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-[var(--bg)]/40 to-[var(--bg)]"
        aria-hidden
      />

      {/* Floating balls — CSS-driven, lg-only to keep the hero tight on mobile */}
      <div
        className="float-y pointer-events-none absolute left-[6%] top-[22%] hidden lg:block"
        aria-hidden
      >
        <PoolBall number={9} size={48} />
      </div>
      <div
        className="float-y-rev pointer-events-none absolute right-[8%] top-[60%] hidden lg:block"
        aria-hidden
      >
        <PoolBall number={6} size={56} />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-14 md:grid-cols-[1.2fr_1fr] lg:px-8 lg:py-16">
        <div>
          <p
            className="fade-in-up mb-3 inline-flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]"
            style={{ animationDelay: "0ms" }}
          >
            <span className="block h-px w-8 bg-[var(--color-brass)]" />
            APA Pool · South Jersey
            {division && <span className="text-[var(--fg-dim)]">· {division}</span>}
            {homeLocation && (
              <span className="text-[var(--fg-dim)]">· {homeLocation}</span>
            )}
          </p>
          <h1
            className="fade-in-up font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-wide sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "60ms" }}
          >
            <span className="block text-[var(--color-cream)]">TOP</span>
            <span className="block text-[var(--color-brass-bright)]">DAWGS</span>
          </h1>

          {nextOpponent && (
            <div
              className="fade-in-up mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)]/80 px-3 py-1.5 text-xs"
              style={{ animationDelay: "180ms" }}
            >
              <span className="font-semibold uppercase tracking-[0.24em] text-[var(--color-brass)]">
                Next
              </span>
              <span className="text-[var(--fg-dim)]">vs</span>
              <span className="font-medium text-[var(--fg)]">{nextOpponent}</span>
            </div>
          )}

          <div
            className="fade-in-up mt-6 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "260ms" }}
          >
            <Link
              href="/schedule"
              className="group inline-flex items-center gap-2 rounded-full bg-[var(--color-brass)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)]"
            >
              See the schedule
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <LiveCTA variant="ghost" />
          </div>

          <dl
            className="fade-in mt-8 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4"
            style={{ animationDelay: "400ms" }}
          >
            <Stat label="Record">
              {isFresh ? (
                <span className="text-[var(--color-brass-bright)]">0–0</span>
              ) : (
                <>
                  {record.wins}
                  <span className="text-[var(--fg-dim)]">–</span>
                  {record.losses}
                </>
              )}
            </Stat>
            {winPct !== null && <Stat label="Win %">{winPct}%</Stat>}
            <Stat label="Division" icon={<Trophy size={12} />}>
              {divisionRank ? (
                <>
                  #{divisionRank}
                  {divisionSize && (
                    <span className="text-base text-[var(--fg-dim)]">/{divisionSize}</span>
                  )}
                </>
              ) : (
                <span className="text-[var(--fg-dim)]">—</span>
              )}
            </Stat>
            <Stat label="Matches">{totalMatches}</Stat>
          </dl>
        </div>

        <div className="hero-zoom relative mx-auto aspect-square w-full max-w-sm">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(46,139,87,0.55),transparent_70%)] blur-2xl" />
          <div className="relative h-full w-full">
            <Logo size={420} priority className="!h-full !w-full hover-roll" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/70 px-4 py-3">
      <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-brass-bright)]">
        {children}
      </dd>
    </div>
  );
}
