import Link from "next/link";
import { Calendar, MapPin, Star } from "lucide-react";
import type { Match } from "@/lib/apa/schemas";
import { matchMvp, matchRecap } from "@/lib/recap";
import { cn, formatDate, formatTime } from "@/lib/utils";

/**
 * One row in the schedule's "results & recaps" timeline. Built so every entry
 * occupies identical real-estate regardless of recap length / MVP presence:
 *   - fixed-width Date column (left, sm+)
 *   - flexible Body column with min-height anchor
 *   - fixed-width Score column (right, sm+)
 *   - MVP slot at the bottom of the body always reserves space (placeholder
 *     when no MVP) so cards never wobble between W/L/bye rows.
 */
export function MatchHistoryEntry({ match }: { match: Match }) {
  const isCompleted = match.status === "completed";
  const isBye = match.status === "bye";
  const hasScore =
    isCompleted &&
    typeof match.teamScore === "number" &&
    typeof match.opponentScore === "number";
  const isWin = hasScore && match.teamScore! > match.opponentScore!;
  const isLoss = hasScore && match.teamScore! < match.opponentScore!;
  const isTie = hasScore && match.teamScore! === match.opponentScore!;

  const accent = isBye
    ? "bg-[var(--border)]"
    : isTie
      ? "bg-[var(--color-tie)]"
      : isWin
        ? "bg-[var(--color-felt-bright)]"
        : isLoss
          ? "bg-[var(--color-pop)]"
          : "bg-[var(--color-brass)]";

  const eyebrowLabel = isBye
    ? "Bye"
    : isTie
      ? "Tie"
      : isWin
        ? "Win"
        : isLoss
          ? "Loss"
          : "Match";

  const eyebrowColor = isTie
    ? "text-[var(--color-tie-bright)]"
    : isWin
      ? "text-[var(--color-felt-bright)]"
      : isLoss
        ? "text-[var(--color-pop-bright)]"
        : "text-[var(--color-brass)]";

  const recap = isCompleted ? matchRecap(match) : null;
  const mvp = isCompleted ? matchMvp(match) : null;

  const inner = (
    <article className="surface surface-hover relative overflow-hidden">
      <span className={cn("absolute inset-y-0 left-0 w-1.5", accent)} aria-hidden />
      <div className="grid min-h-[11rem] grid-cols-1 gap-0 sm:grid-cols-[7.5rem_minmax(0,1fr)_10rem]">
        {/* Date column — fixed width on sm+ */}
        <div className="flex flex-col justify-center border-b border-[var(--border)] bg-[var(--bg-soft)]/60 p-4 sm:border-b-0 sm:border-r">
          <p className="font-[family-name:var(--font-display)] text-xl tracking-wide whitespace-nowrap text-[var(--color-cream)]">
            {new Date(match.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
          <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            {new Date(match.date).getFullYear()}
            {match.week ? ` · Wk ${match.week}` : ""}
          </p>
        </div>

        {/* Body — recap + meta + MVP slot. Flex column so MVP slot pins to bottom. */}
        <div className="flex min-w-0 flex-col p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.32em]",
                eyebrowColor,
              )}
            >
              {eyebrowLabel}
            </span>
            <h3 className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
              vs <span className="text-[var(--color-cream)]">{match.opponent}</span>
            </h3>
            {match.sweep && (
              <span className="rounded-full bg-[var(--color-pop)]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--color-pop-bright)]">
                Team Sweep
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--fg-dim)]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} /> {formatDate(match.date)} · {formatTime(match.date)}
            </span>
            {match.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={12} /> {match.location}
              </span>
            )}
          </div>

          <div className="mt-3 min-h-[3.5rem] text-sm leading-relaxed text-[var(--fg)]">
            {recap ? (
              <p className="line-clamp-3 max-w-2xl">{recap}</p>
            ) : isBye ? (
              <p className="italic text-[var(--fg-dim)]">Bye week — no match.</p>
            ) : !isCompleted ? (
              <p className="text-[var(--fg-dim)]">On deck.</p>
            ) : (
              <p className="text-[var(--fg-dim)]">No recap available.</p>
            )}
          </div>

          {/* MVP slot — always reserves space so cards stay uniform. */}
          <div className="mt-auto pt-3">
            {mvp ? (
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1 text-xs">
                <Star
                  size={12}
                  className="shrink-0 text-[var(--color-brass-bright)]"
                  fill="currentColor"
                />
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass)]">
                  MVP
                </span>
                <span className="truncate font-medium text-[var(--fg)]">
                  {mvp.playerName}
                </span>
                {mvp.score && (
                  <span className="shrink-0 tabular-nums text-[var(--fg-dim)]">
                    {mvp.score}
                  </span>
                )}
                {mvp.sweep && (
                  <span className="shrink-0 rounded-full bg-[var(--color-pop)]/20 px-1.5 text-[9px] font-bold uppercase tracking-widest text-[var(--color-pop-bright)]">
                    SW
                  </span>
                )}
                {!mvp.sweep && mvp.miniSweep && (
                  <span className="shrink-0 rounded-full bg-[var(--color-brass)]/20 px-1.5 text-[9px] font-bold uppercase tracking-widest text-[var(--color-brass-bright)]">
                    MS
                  </span>
                )}
                {mvp.breakAndRun && (
                  <span className="shrink-0 rounded-full bg-[var(--color-felt)]/30 px-1.5 text-[9px] font-bold uppercase tracking-widest text-[var(--color-felt-bright)]">
                    B&amp;R
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] uppercase tracking-[0.24em] text-[var(--fg-dim)]/40">
                {isBye ? "—" : "No MVP"}
              </span>
            )}
          </div>
        </div>

        {/* Score column — fixed width on sm+, never wraps */}
        <div className="flex flex-col items-center justify-center border-t border-[var(--border)] bg-[var(--bg-soft)]/40 p-4 sm:border-l sm:border-t-0">
          {hasScore ? (
            <>
              <div
                className={cn(
                  "whitespace-nowrap font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide tabular-nums sm:text-4xl",
                  isTie
                    ? "text-[var(--color-tie-bright)]"
                    : "text-[var(--color-brass-bright)]",
                )}
              >
                {match.teamScore}
                <span className="mx-1 text-[var(--fg-dim)]">–</span>
                {match.opponentScore}
              </div>
              <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                Final
              </p>
            </>
          ) : isBye ? (
            <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--fg-dim)]">
              Bye
            </span>
          ) : (
            <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-brass)]">
              vs
            </span>
          )}
        </div>
      </div>
    </article>
  );

  return isCompleted ? (
    <Link href={`/matches/${match.id}`} className="block">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}
