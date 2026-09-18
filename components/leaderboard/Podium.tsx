import Image from "next/image";
import Link from "next/link";
import { PoolBall } from "@/components/brand/PoolBall";
import { PatchTrophyStrip } from "@/components/cards/PatchBadge";
import type { PatchInstance, PatchKind } from "@/components/cards/PatchBadge";
import type { LeaderboardRow } from "@/lib/apa/schemas";
import type { RankedRow } from "@/lib/apa/rank";
import { MoveArrow } from "./WeekRecap";
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
    ring: "var(--color-brass)",
    text: "var(--color-brass-bright)",
    glow: "0 0 0 1px rgba(201,162,74,0.45), 0 18px 40px -18px rgba(201,162,74,0.55)",
    label: "1st",
  },
  2: {
    ring: "rgba(200,200,212,0.5)",
    text: "#d6d6e0",
    glow: "0 0 0 1px rgba(200,200,212,0.25)",
    label: "2nd",
  },
  3: {
    ring: "rgba(194,130,63,0.5)",
    text: "#d9974f",
    glow: "0 0 0 1px rgba(194,130,63,0.25)",
    label: "3rd",
  },
} as const;

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
    <section aria-label="Top three">
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:items-end">
        {top.map(({ row, rank, tied }, i) => (
          <li
            key={row.playerId}
            className="contents sm:block"
            style={{ order: order.indexOf(i) }}
          >
            <PodiumCard
              row={row}
              // `contents` above means this card is the grid item on a phone,
              // so first place claims the full row here rather than on the li.
              className={i === 0 ? "col-span-2 sm:col-span-1" : undefined}
              // The card's size follows its slot on the podium; the badge
              // shows the real, possibly-joint rank.
              slot={(i + 1) as 1 | 2 | 3}
              rank={rank}
              tied={tied}
              instances={patchInstances.get(row.playerId)}
              rankDelta={rankDeltas.get(row.playerId) ?? null}
            />
          </li>
        ))}
      </ol>
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

  return (
    <div
      className={cn(
        "surface fade-in-up flex flex-col items-center gap-2 px-3 text-center sm:px-4",
        first ? "py-6 sm:py-8" : "py-4 sm:py-5",
        className,
      )}
      style={{ boxShadow: style.glow, animationDelay: `${slot * 60}ms` }}
    >
      <span
        className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.24em]"
        style={{ color: style.text, background: "rgba(255,255,255,0.05)" }}
      >
        {tied ? `T${rank}` : ordinal(rank)}
      </span>

      <div
        className={cn(
          "relative overflow-hidden rounded-full",
          first ? "h-20 w-20" : "h-14 w-14",
        )}
        style={{ boxShadow: `0 0 0 2px ${style.ring}` }}
      >
        {row.profileImage ? (
          <Image
            src={row.profileImage}
            alt=""
            fill
            sizes={first ? "80px" : "56px"}
            className="object-cover object-top"
          />
        ) : (
          <PoolBall number={slot} size={first ? 80 : 56} />
        )}
      </div>

      <Link
        href={`/roster/${row.playerId}`}
        className={cn(
          "max-w-full truncate font-medium hover:text-[var(--color-brass)]",
          first ? "text-lg" : "text-sm sm:text-base",
        )}
      >
        {row.playerName}
      </Link>

      <p className="flex items-baseline gap-1.5">
        {/* The one hero figure on the page. Proportional digits: at this size
            tabular spacing makes a number like 11 look loose. */}
        <span
          className={cn(
            "font-[family-name:var(--font-display)] leading-none tracking-wide",
            first ? "text-6xl" : "text-3xl sm:text-4xl",
          )}
          style={{ color: style.text }}
        >
          {row.points % 1 === 0 ? row.points : row.points.toFixed(1)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          {row.points === 1 ? "pt" : "pts"}
        </span>
      </p>

      <div className="flex items-center gap-2 text-xs text-[var(--fg-dim)]">
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
          className="justify-center"
        />
      )}
    </div>
  );
}
