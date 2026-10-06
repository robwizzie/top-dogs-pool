import Image from "next/image";
import Link from "next/link";
import { PoolBall } from "@/components/brand/PoolBall";
import { PatchTrophyStrip } from "@/components/cards/PatchBadge";
import type { PatchInstance, PatchKind } from "@/components/cards/PatchBadge";
import type { LeaderboardRow } from "@/lib/apa/schemas";
import type { RankedRow } from "@/lib/apa/rank";
import { MoveArrow } from "./WeekRecap";
import { Crown } from "lucide-react";
import { TiltCard } from "@/components/home/TiltCard";
import { cn } from "@/lib/utils";

/**
 * The top three, given the room a ranked list never gives them.
 *
 * The old page rendered ranks 1–3 as ordinary rows with a faint tint, so the
 * leader looked like everyone else. Here first place is physically larger and
 * centred, which is the whole point of a podium: you should be able to tell
 * who is winning from across the room, or from a thumbnail in a group chat.
 *
 * Ordered 2 · 1 · 3 on wide screens (the shape people expect). On a phone the
 * order goes back to 1 · 2 · 3 — a centred tallest column just wastes the
 * fold — with first place across the full width and the other two sharing a
 * row beneath it, so the whole podium stays inside one screen instead of
 * costing three.
 */

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}

const PLACE = {
  1: {
    ring: "var(--color-brass-bright)",
    text: "var(--color-brass-bright)",
    glow: "0 0 0 1px rgba(224,190,107,0.55), 0 30px 80px -24px rgba(224,190,107,0.55), 0 30px 60px -30px rgba(0,0,0,0.9)",
    tint: "radial-gradient(90% 70% at 50% 0%, rgba(224,190,107,0.3), transparent 65%)",
    label: "1st",
  },
  2: {
    ring: "rgba(214,214,224,0.7)",
    text: "#dcdce6",
    glow: "0 0 0 1px rgba(200,200,212,0.3), 0 30px 60px -30px rgba(0,0,0,0.9)",
    tint: "radial-gradient(90% 70% at 50% 0%, rgba(214,214,224,0.14), transparent 65%)",
    label: "2nd",
  },
  3: {
    ring: "rgba(217,151,79,0.75)",
    text: "#d9974f",
    glow: "0 0 0 1px rgba(194,130,63,0.32), 0 30px 60px -30px rgba(0,0,0,0.9)",
    tint: "radial-gradient(90% 70% at 50% 0%, rgba(217,151,79,0.16), transparent 65%)",
    label: "3rd",
  },
} as const;

/** Riser heights for the stage, by slot (sm+ only). */
const RISER = { 1: "h-28", 2: "h-20", 3: "h-14" } as const;

export function Podium({
  entries,
  patchInstances,
  rankDeltas,
}: {
  entries: RankedRow<LeaderboardRow>[];
  patchInstances: Map<string, Partial<Record<PatchKind, PatchInstance[]>>>;
  rankDeltas: Map<string, number | null>;
}) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return null;

  // 2 · 1 · 3 visually, but the DOM keeps 1 · 2 · 3 so screen readers and
  // keyboard order follow the actual standings.
  const order = [1, 0, 2].filter((i) => i < top.length);

  return (
    <section
      aria-label="Top three"
      className="pm-grain relative overflow-hidden rounded-[1.75rem] border border-[var(--color-brass)]/25 shadow-[0_40px_120px_-40px_rgba(46,139,87,0.6)]"
    >
      {/* The stage: felt under a lamp, a cone of light on the champion. */}
      <div className="pm-felt absolute inset-0 -z-10" aria-hidden />
      <div className="pm-lamp pm-lamp-flicker absolute inset-0 -z-10" aria-hidden />
      <div
        className="pm-cone absolute left-1/2 top-0 -z-10 h-full w-[85%] -translate-x-1/2 sm:w-[60%]"
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_50%_10%,transparent_40%,rgba(0,0,0,0.65)_100%)]"
        aria-hidden
      />

      <div className="relative z-[2] px-3 pt-6 sm:px-8 sm:pt-8">
        <p className="mb-5 text-center text-[10px] font-semibold uppercase tracking-[0.34em] text-[var(--color-brass-bright)] sm:mb-6 sm:text-[11px]">
          The podium
          <span className="pm-serif ml-2 text-sm normal-case tracking-normal text-[var(--color-cream)]/60">
            under the lamp
          </span>
        </p>
        <ol className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3 sm:items-end sm:gap-5 sm:pb-0">
          {top.map(({ row, rank, tied }, i) => {
            const slot = (i + 1) as 1 | 2 | 3;
            return (
              <li
                key={row.playerId}
                className="contents sm:flex sm:flex-col"
                style={{ order: order.indexOf(i) }}
              >
                <PodiumCard
                  row={row}
                  // `contents` above means this card is the grid item on a phone,
                  // so first place claims the full row here rather than on the li.
                  className={i === 0 ? "col-span-2 sm:col-span-1" : undefined}
                  // The card's size follows its slot on the podium; the badge
                  // shows the real, possibly-joint rank.
                  slot={slot}
                  rank={rank}
                  tied={tied}
                  instances={patchInstances.get(row.playerId)}
                  rankDelta={rankDeltas.get(row.playerId) ?? null}
                />
                {/* The riser — a walnut step with the place carved in. */}
                <div
                  className={cn(
                    "relative mt-4 hidden items-start justify-center overflow-hidden rounded-t-xl border-x border-t border-[var(--color-brass)]/25 bg-[linear-gradient(180deg,#2b1c12,#1d130c_55%,#140d08)] pt-2 shadow-[inset_0_1px_0_rgba(255,220,170,0.18)] sm:flex",
                    RISER[slot],
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "font-[family-name:var(--font-display)] leading-none",
                      slot === 1 ? "pm-foil text-6xl" : "pm-outline text-5xl opacity-60 [-webkit-text-stroke-width:1px]",
                    )}
                  >
                    {slot}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function PodiumCard({
  row,
  slot,
  rank,
  tied,
  instances,
  rankDelta,
  className,
}: {
  row: LeaderboardRow;
  slot: 1 | 2 | 3;
  rank: number;
  tied: boolean;
  instances?: Partial<Record<PatchKind, PatchInstance[]>>;
  rankDelta: number | null;
  className?: string;
}) {
  const style = PLACE[(Math.min(rank, 3) || 1) as 1 | 2 | 3] ?? PLACE[3];
  const first = slot === 1;

  const card = (
    <div
      className={cn(
        "pm-glass fade-in-up relative flex h-full flex-col items-center gap-2 overflow-hidden px-3 text-center sm:px-4",
        first ? "py-6 sm:py-8" : "py-4 sm:py-5",
      )}
      style={{ boxShadow: style.glow, animationDelay: `${slot * 60}ms` }}
    >
      <span
        className="pointer-events-none absolute inset-px rounded-[inherit]"
        style={{ background: style.tint }}
        aria-hidden
      />
      {first && (
        <>
          <span className="pm-etch" aria-hidden />
          <span className="pm-holo" aria-hidden />
          <span
            className="pointer-events-none absolute inset-2.5 rounded-[0.9rem] border border-[var(--color-brass)]/30"
            aria-hidden
          />
        </>
      )}

      <span
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.24em]",
          first ? "border-[var(--color-brass)]/45 bg-[var(--color-brass)]/12" : "border-white/10 bg-black/30",
        )}
        style={{ color: style.text }}
      >
        {first && <Crown size={11} aria-hidden />}
        {tied ? `T${rank}` : ordinal(rank)}
      </span>

      <div
        className={cn(
          "relative mt-1 overflow-hidden rounded-full shadow-[0_14px_30px_-10px_rgba(0,0,0,0.9)]",
          first ? "h-24 w-24 sm:h-28 sm:w-28" : "h-14 w-14 sm:h-16 sm:w-16",
        )}
        style={{ boxShadow: `0 0 0 2px ${style.ring}, 0 0 0 5px rgba(0,0,0,0.35), 0 14px 30px -10px rgba(0,0,0,0.9)` }}
      >
        {row.profileImage ? (
          <Image
            src={row.profileImage}
            alt=""
            fill
            sizes={first ? "112px" : "64px"}
            className="object-cover object-top"
          />
        ) : (
          <PoolBall number={slot} size={first ? 112 : 64} className="h-full w-full" />
        )}
      </div>

      <Link
        href={`/roster/${row.playerId}`}
        className={cn(
          "relative max-w-full truncate font-[family-name:var(--font-display)] leading-none tracking-wide text-[var(--color-cream)] transition-colors hover:text-[var(--color-brass-bright)]",
          first ? "mt-1 text-3xl sm:text-4xl" : "text-xl sm:text-2xl",
        )}
      >
        {row.playerName}
      </Link>

      <p className="relative flex items-baseline gap-1.5">
        {/* The one hero figure on the page. Proportional digits: at this size
            tabular spacing makes a number like 11 look loose. */}
        <span
          className={cn(
            "font-[family-name:var(--font-display)] leading-none tracking-wide",
            first ? "pm-foil text-7xl sm:text-8xl" : "text-4xl sm:text-5xl",
          )}
          style={first ? undefined : { color: style.text }}
        >
          {row.points % 1 === 0 ? row.points : row.points.toFixed(1)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/50">
          {row.points === 1 ? "pt" : "pts"}
        </span>
      </p>

      <div className="relative flex items-center gap-2 text-xs text-[var(--color-cream)]/55">
        <span className="tabular-nums">
          {row.wins}/{row.matchesPlayed} W
        </span>
        {rankDelta !== null && rankDelta !== 0 && (
          <span className="flex items-center gap-0.5">
            <MoveArrow delta={rankDelta} />
            <span className="tabular-nums">{Math.abs(rankDelta)}</span>
          </span>
        )}
      </div>

      {instances && (
        <PatchTrophyStrip
          sweeps={row.sweeps}
          miniSweeps={row.miniSweeps}
          breakAndRuns={row.breakAndRuns}
          eightOnBreaks={row.eightOnBreaks}
          levelUps={row.levelUps}
          firstWin={row.firstWin}
          mvp={row.mvp}
          instances={instances}
          size={first ? "md" : "sm"}
          className="relative justify-center"
        />
      )}
    </div>
  );

  return (
    <div className={cn("min-w-0", className)}>
      {first ? (
        <TiltCard className="h-full rounded-[1.25rem]" max={5}>
          {card}
        </TiltCard>
      ) : (
        card
      )}
    </div>
  );
}
