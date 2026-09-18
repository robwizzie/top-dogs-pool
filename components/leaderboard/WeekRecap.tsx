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
    <section className="surface overflow-hidden">
      {/* --- the result ------------------------------------------------- */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] bg-[var(--color-felt-deep)]/40 px-5 py-4">
        <span className="rounded-full bg-[var(--color-brass)]/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brass-bright)]">
          Week {recap.week}
        </span>
        {recap.date && (
          <span className="text-sm text-[var(--fg-dim)]">
            {formatDate(recap.date)}
          </span>
        )}
        {recap.opponent && (
          <span className="text-sm">
            <span className="text-[var(--fg-dim)]">vs </span>
            <span className="font-medium">{recap.opponent}</span>
          </span>
        )}
        {recap.teamScore !== null && recap.opponentScore !== null && (
          <span
            className={[
              "ml-auto rounded-full px-3 py-1 text-sm font-semibold tabular-nums",
              won
                ? "bg-[var(--color-felt-bright)]/18 text-[var(--color-felt-bright)]"
                : tied
                  ? "bg-[var(--color-tie)]/18 text-[var(--color-tie-bright)]"
                  : "bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]",
            ].join(" ")}
          >
            {won ? "Won" : tied ? "Tied" : "Lost"} {recap.teamScore}–
            {recap.opponentScore}
          </span>
        )}
      </header>

      <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:gap-6">
        {/* --- points put on the board --------------------------------- */}
        <div className="sm:border-r sm:border-[var(--border)] sm:pr-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
            Patch points
          </p>
          <p className="font-[family-name:var(--font-display)] text-5xl leading-none tracking-wide text-[var(--color-brass-bright)]">
            {recap.teamPoints % 1 === 0
              ? recap.teamPoints
              : recap.teamPoints.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-[var(--fg-dim)]">this week</p>
        </div>

        {/* --- the patches themselves ----------------------------------- */}
        <div className="min-w-0">
          {patches.length > 0 ? (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
                Earned this week
              </p>
              <ul className="flex flex-wrap gap-2">
                {patches.map((p, i) => (
                  <li key={`${p.playerId}-${p.kind}-${i}`}>
                    <Link
                      href={`/roster/${p.playerId}`}
                      className="group flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] py-1 pl-1 pr-3 transition-colors hover:border-[var(--color-brass)]"
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
                        <span className="font-medium group-hover:text-[var(--color-brass)]">
                          {p.playerName}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-[var(--fg-dim)]">
              No patches this week — {scorers.length > 0 ? "points still moved." : "the board held."}
            </p>
          )}

          {/* --- who moved ------------------------------------------- */}
          {climbers.length > 0 && (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--fg-dim)]">
              <MoveArrow delta={1} />
              <span>
                {climbers.slice(0, 3).map((m, i, arr) => (
                  <span key={m.playerId}>
                    <Link
                      href={`/roster/${m.playerId}`}
                      className="font-medium text-[var(--fg)] hover:text-[var(--color-brass)]"
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
