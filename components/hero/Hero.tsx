import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { PoolBall } from "@/components/brand/PoolBall";
import { LiveCTA } from "@/components/live/LiveCTA";
import { BilliardLamp } from "@/components/home/BilliardLamp";
import { StatCounter } from "@/components/ui/StatCounter";
import { formatDate } from "@/lib/utils";

/**
 * Server-rendered hero: an overhead lamp pooling light onto the felt, an
 * oversized wordmark, the crest inside a rotating halo with balls in orbit,
 * and a scoreboard rail along the bottom edge.
 *
 * Entry stagger animations are CSS-only (see globals.css) so we don't ship
 * framer-motion just for opacity fades. `prefers-reduced-motion` is handled
 * globally.
 */
export function Hero({
  record,
  division,
  homeLocation,
  session,
  nextMatch,
  divisionRank,
  divisionSize,
}: {
  record: { wins: number; losses: number };
  division?: string;
  homeLocation?: string;
  session?: string;
  nextMatch?: { id: string | number; opponent: string; date: string } | null;
  divisionRank?: number;
  divisionSize?: number;
}) {
  const totalMatches = record.wins + record.losses;
  const winPct = totalMatches ? Math.round((record.wins / totalMatches) * 100) : null;

  return (
    <section className="pm-grain relative mt-[calc(-5rem-env(safe-area-inset-top))] overflow-hidden">
      {/* Felt, lamp light, vignette */}
      <div className="pm-felt absolute inset-0 -z-20" aria-hidden />
      <div className="pm-lamp pm-lamp-flicker absolute inset-0 -z-10" aria-hidden />
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_30%,transparent_40%,rgba(0,0,0,0.75)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-b from-transparent to-[var(--bg)]"
        aria-hidden
      />
      <BilliardLamp className="pointer-events-none absolute inset-x-0 bottom-0 top-[calc(5rem+env(safe-area-inset-top))] z-[1]" />

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-[calc(200px+env(safe-area-inset-top))] sm:px-6 sm:pt-[250px] lg:px-8 lg:pb-14 lg:pt-[255px]">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
          <div className="relative z-[2] text-center lg:text-left">
            <p
              className="fade-in-up mb-6 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-white/10 bg-black/25 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/80 backdrop-blur-sm sm:text-[11px]"
              style={{ animationDelay: "0ms" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-felt-bright)] shadow-[0_0_10px_2px_rgba(46,139,87,0.8)]" />
              APA 8-Ball
              {division && <span className="text-[var(--color-brass-bright)]">· {division}</span>}
              {session && <span className="hidden sm:inline">· {session}</span>}
            </p>

            <h1
              className="fade-in-up font-[family-name:var(--font-display)] leading-[0.82] tracking-[0.01em]"
              style={{ animationDelay: "80ms" }}
            >
              <span className="pm-outline block text-[clamp(4.75rem,15vw,10.5rem)]">TOP</span>
              <span className="pm-foil block text-[clamp(5.5rem,18vw,12.5rem)] drop-shadow-[0_8px_40px_rgba(201,162,74,0.25)]">
                DAWGS
              </span>
            </h1>

            <p
              className="fade-in-up mx-auto mt-6 max-w-md text-base leading-relaxed text-[var(--color-cream)]/75 sm:text-lg lg:mx-0"
              style={{ animationDelay: "180ms" }}
            >
              South Jersey&apos;s{" "}
              <span className="pm-serif text-[1.35em] leading-none text-[var(--color-brass-bright)]">
                most dangerous
              </span>{" "}
              8-ball crew. Every rack, every sweep, every stat — live.
            </p>

            <div
              className="fade-in-up mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
              style={{ animationDelay: "260ms" }}
            >
              <Link href="/schedule" className="pm-btn group">
                See the schedule
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <LiveCTA variant="ghost" className="backdrop-blur-sm" />
            </div>
          </div>

          <Crest />
        </div>

        {/* Scoreboard rail */}
        <dl
          className="fade-in-up pm-rail relative z-[2] mt-14 grid grid-cols-2 sm:grid-cols-4 lg:mt-16"
          style={{ animationDelay: "420ms" }}
        >
          {/* diamond sights inlaid along the rail */}
          {[12.5, 37.5, 62.5, 87.5].map((x) => (
            <span
              key={x}
              aria-hidden
              className="pm-diamond hidden sm:block"
              style={{ left: `${x}%`, top: 14 }}
            />
          ))}
          <Stat label="Record">
            <StatCounter value={record.wins} delay={500} />
            <span className="mx-1 text-[var(--color-cream)]/30">–</span>
            <StatCounter value={record.losses} delay={500} />
          </Stat>
          <Stat label="Win rate" accent>
            {winPct !== null ? (
              <>
                <StatCounter value={winPct} delay={500} />
                <span className="text-[0.55em] text-[var(--color-cream)]/50">%</span>
              </>
            ) : (
              <span className="text-[var(--color-cream)]/30">—</span>
            )}
          </Stat>
          <Stat label="Division">
            {divisionRank ? (
              <>
                <span className="text-[0.55em] text-[var(--color-cream)]/50">#</span>
                <StatCounter value={divisionRank} delay={500} duration={600} />
                {divisionSize && (
                  <span className="text-[0.45em] text-[var(--color-cream)]/40"> of {divisionSize}</span>
                )}
              </>
            ) : (
              <span className="text-[var(--color-cream)]/30">—</span>
            )}
          </Stat>
          {nextMatch ? (
            <div className={`group ${CELL} transition-colors hover:bg-white/[0.03]`}>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/50">
                Up next<span className="hidden sm:inline"> · {formatDate(nextMatch.date)}</span>
              </dt>
              <dd className="mt-2 font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide text-[var(--color-cream)] sm:text-[1.7rem]">
                <Link
                  href={`/matches/${nextMatch.id}`}
                  className="flex items-center gap-2 after:absolute after:inset-0"
                >
                  <span className="truncate">vs {nextMatch.opponent}</span>
                  <ArrowRight
                    size={18}
                    className="shrink-0 text-[var(--color-brass-bright)] transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </dd>
            </div>
          ) : (
            <Stat label="Home table">
              <span className="inline-flex items-center gap-2 text-2xl">
                <MapPin size={18} className="text-[var(--color-brass-bright)]" />
                {homeLocation ?? "—"}
              </span>
            </Stat>
          )}
        </dl>
      </div>
    </section>
  );
}

/** The crest inside a rotating conic halo, with three balls in slow orbit. */
function Crest() {
  return (
    <div className="hero-zoom relative mx-auto aspect-square w-[78%] max-w-[30rem] sm:w-[60%] lg:w-full">
      {/* Lamp-lit glow on the felt beneath the crest */}
      <div
        className="absolute inset-[-12%] rounded-full bg-[radial-gradient(circle_at_50%_55%,rgba(46,139,87,0.55),rgba(46,139,87,0.12)_45%,transparent_70%)] blur-2xl"
        aria-hidden
      />
      <div className="pm-halo absolute inset-[-4%] rounded-full" aria-hidden />
      <div
        className="absolute inset-[3%] rounded-full border border-[var(--color-brass)]/15"
        aria-hidden
      />

      {/* Orbiting balls — the ring rotates, each ball counter-rotates so its
       *  number stays upright. */}
      <div className="pm-orbit pointer-events-none absolute inset-[-6%]" aria-hidden>
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_10px_14px_rgba(0,0,0,0.6)]">
          <PoolBall number={9} size={44} />
        </div>
        <div className="absolute bottom-[12%] left-[2%] drop-shadow-[0_10px_14px_rgba(0,0,0,0.6)]">
          <PoolBall number={6} size={54} />
        </div>
        <div className="absolute bottom-[18%] right-[0%] drop-shadow-[0_10px_14px_rgba(0,0,0,0.6)]">
          <PoolBall number={8} size={38} />
        </div>
      </div>

      <div className="relative h-full w-full drop-shadow-[0_30px_50px_rgba(0,0,0,0.7)]">
        <Logo size={480} priority className="hover-roll !h-full !w-full" />
      </div>
    </div>
  );
}

/** One scoreboard cell. 2×2 on mobile, a single row of four from `sm`. */
const CELL =
  "relative min-w-0 border-[var(--color-cream)]/[0.07] px-5 py-5 even:border-l sm:px-6 sm:[&:not(:first-child)]:border-l [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0";

function Stat({
  label,
  accent = false,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={CELL}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/50">
        {label}
      </dt>
      <dd
        className={`mt-1 font-[family-name:var(--font-display)] text-5xl leading-none tracking-wide tabular-nums sm:text-6xl ${
          accent ? "pm-foil" : "text-[var(--color-cream)]"
        }`}
      >
        {children}
      </dd>
    </div>
  );
}
