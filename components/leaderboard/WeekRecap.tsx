import Link from "next/link";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { PatchBadge, type PatchKind } from "@/components/cards/PatchBadge";
import type { WeekPatch, WeekRecap as Recap } from "@/lib/apa/week";
import { formatDate } from "@/lib/utils";

/**
 * What changed on the most recent match night.
 *
 * Patch Watch is a season tally, so week to week the table barely moves and
 * there's nothing to notice. This is the part that makes the page worth
 * reopening on a Wednesday: the result, what the team put on the board, who
 * climbed, and every patch earned that night with the player's name on it.
 *
 * Renders nothing when there's no completed week — an empty "this week" card
 * is worse than no card.
 */
export function WeekRecap({
  recap,
  patches,
}: {
  recap: Recap | null;
  patches: WeekPatch[];
}) {
  if (!recap) return null;

  const won =
    recap.teamScore !== null &&
    recap.opponentScore !== null &&
    recap.teamScore > recap.opponentScore;
  const tied =
    recap.teamScore !== null &&
    recap.opponentScore !== null &&
    recap.teamScore === recap.opponentScore;

  const climbers = recap.movers
    .filter((m) => (m.rankDelta ?? 0) > 0)
    .sort((a, b) => (b.rankDelta ?? 0) - (a.rankDelta ?? 0));
  const scorers = recap.movers.filter((m) => m.gained > 0);

  return (
    <section className="pm-glass overflow-hidden">
      {/* --- the result ------------------------------------------------- */}
      <header className="pm-grain relative flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-t-[1.25rem] border-b border-[var(--color-cream)]/[0.07] px-5 py-4 sm:px-6">
        <div className="pm-felt absolute inset-0 -z-10 opacity-80" aria-hidden />
        <div className="pm-lamp absolute inset-0 -z-10" aria-hidden />
        <span className="relative z-[2] rounded-full border border-[var(--color-brass)]/40 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass-bright)]">
          Week {recap.week}
        </span>
        {recap.date && (
          <span className="relative z-[2] text-xs uppercase tracking-[0.18em] text-[var(--color-cream)]/60">
            {formatDate(recap.date)}
          </span>
        )}
        {recap.opponent && (
          <span className="relative z-[2] font-[family-name:var(--font-display)] text-xl leading-none tracking-wide text-[var(--color-cream)] sm:text-2xl">
            <span className="text-[0.75em] text-[var(--color-cream)]/45">vs </span>
            {recap.opponent}
          </span>
        )}
        {recap.teamScore !== null && recap.opponentScore !== null && (
          <span
            className={[
              "relative z-[2] ml-auto rounded-full border px-3 py-1 font-[family-name:var(--font-display)] text-lg leading-none tracking-wider tabular-nums",
              won
                ? "border-[var(--color-felt-bright)]/40 bg-black/35 text-[#7fd6a1]"
                : tied
                  ? "border-[var(--color-tie)]/40 bg-black/35 text-[var(--color-tie-bright)]"
                  : "border-[var(--color-pop)]/40 bg-black/35 text-[var(--color-pop-bright)]",
            ].join(" ")}
          >
            {won ? "Won" : tied ? "Tied" : "Lost"} {recap.teamScore}–
            {recap.opponentScore}
          </span>
        )}
      </header>

      <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:gap-7 sm:p-6">
        {/* --- points put on the board --------------------------------- */}
        <div className="flex items-end gap-3 sm:block sm:border-r sm:border-[var(--color-cream)]/[0.07] sm:pr-7">
          <p className="order-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/50 sm:pb-0">
            Patch points
          </p>
          <p className="font-[family-name:var(--font-display)] text-6xl leading-none tracking-wide text-[var(--color-brass-bright)] sm:mt-1 sm:text-7xl">
            {recap.teamPoints % 1 === 0
              ? recap.teamPoints
              : recap.teamPoints.toFixed(1)}
          </p>
          <p className="order-3 pb-1 text-xs text-[var(--color-cream)]/45 sm:pb-0">this week</p>
        </div>

        {/* --- the patches themselves ----------------------------------- */}
        <div className="min-w-0">
          {patches.length > 0 ? (
            <>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/50">
                Earned this week
              </p>
              <ul className="flex flex-wrap gap-2">
                {patches.map((p, i) => (
                  <li key={`${p.playerId}-${p.kind}-${i}`}>
                    <Link
                      href={`/roster/${p.playerId}`}
                      className="group flex items-center gap-2 rounded-full border border-[var(--color-brass)]/20 bg-black/30 py-1 pl-1 pr-3.5 transition-colors hover:border-[var(--color-brass)]/60 hover:bg-[var(--color-brass)]/10"
                    >
                      {/* interactive={false} — the whole chip is the link,
                          so the badge must not open its own lightbox. */}
                      <PatchBadge
                        kind={p.kind as PatchKind}
                        count={1}
                        size="sm"
                        interactive={false}
                      />
                      <span className="text-sm">
                        <span className="font-medium text-[var(--color-cream)] group-hover:text-[var(--color-brass-bright)]">
                          {p.playerName}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-[var(--color-cream)]/55">
              No patches this week — {scorers.length > 0 ? "points still moved." : "the board held."}
            </p>
          )}

          {/* --- who moved ------------------------------------------- */}
          {climbers.length > 0 && (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-cream)]/55">
              <MoveArrow delta={1} />
              <span>
                {climbers.slice(0, 3).map((m, i, arr) => (
                  <span key={m.playerId}>
                    <Link
                      href={`/roster/${m.playerId}`}
                      className="font-medium text-[var(--color-cream)] hover:text-[var(--color-brass-bright)]"
                    >
                      {m.playerName}
                    </Link>
                    <span className="text-[var(--color-felt-bright)]">
                      {" "}
                      +{m.rankDelta}
                    </span>
                    {i < arr.length - 1 ? ", " : ""}
                  </span>
                ))}
              </span>
              <span>climbed the board.</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Rank movement arrow. Paired with the number, so never colour alone. */
export function MoveArrow({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <Minus
        size={13}
        className="shrink-0 text-[var(--fg-dim)]"
        aria-label="held position"
      />
    );
  }
  return delta > 0 ? (
    <ArrowUp
      size={13}
      className="shrink-0 text-[var(--color-felt-bright)]"
      aria-label="moved up"
    />
  ) : (
    <ArrowDown
      size={13}
      className="shrink-0 text-[var(--color-pop-bright)]"
      aria-label="moved down"
    />
  );
}
