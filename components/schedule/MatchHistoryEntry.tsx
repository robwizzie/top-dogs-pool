import Link from "next/link";
import { Calendar, MapPin, Star } from "lucide-react";
import type { Match } from "@/lib/apa/schemas";
import { matchMvp, matchRecap } from "@/lib/recap";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { ResultBall } from "@/components/season/SeasonKit";

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

  const scoreColor = isTie
    ? "text-[var(--color-tie-bright)]"
    : isWin
      ? "text-[var(--color-felt-bright)]"
      : "text-[var(--color-pop-bright)]";

  // Result-tinted light spilling in from both ends of the card.
  const glow = isWin
    ? "rgba(46,139,87,0.3)"
    : isLoss
      ? "rgba(200,54,47,0.26)"
      : isTie
        ? "rgba(224,168,46,0.26)"
        : "rgba(236,225,196,0.05)";

  const recap = isCompleted ? matchRecap(match) : null;
  const mvp = isCompleted ? matchMvp(match) : null;
  const d = new Date(match.date);

  const inner = (
    <article
      className={cn(
        "pm-glass group relative overflow-hidden",
        isCompleted && "pm-lift",
        isBye && "opacity-70",
      )}
    >
      {isCompleted && <span className="pm-sheen" />}
      <span
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background: `radial-gradient(40% 120% at 100% 50%, ${glow}, transparent 70%), radial-gradient(30% 100% at 0% 50%, ${glow}, transparent 70%)`,
        }}
        aria-hidden
      />
      <div className="relative grid grid-cols-[4.5rem_minmax(0,1fr)] sm:min-h-[10.5rem] sm:grid-cols-[7rem_minmax(0,1fr)_10rem]">
        {/* Date column — fight-poster date stack */}
        <div className="flex flex-col items-center justify-center border-r border-[var(--color-cream)]/[0.07] px-2 py-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-brass)]">
            {d.toLocaleDateString("en-US", { month: "short" })}
          </p>
          <p className="font-[family-name:var(--font-display)] text-4xl leading-none text-[var(--color-cream)] sm:text-5xl">
            {d.getDate()}
          </p>
          <p className="mt-0.5 whitespace-nowrap text-[9px] uppercase tracking-[0.2em] text-[var(--color-cream)]/45 sm:text-[10px]">
            <span className={match.week ? "hidden sm:inline" : undefined}>
              {d.getFullYear()}
              {match.week ? " · " : ""}
            </span>
            {match.week ? `Wk ${match.week}` : ""}
          </p>
        </div>

        {/* Body — recap + meta + MVP slot. Flex column so MVP slot pins to bottom. */}
        <div className="flex min-w-0 flex-col p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.32em]",
                  eyebrowColor,
                )}
              >
                {eyebrowLabel}
                {match.sweep && (
                  <span className="ml-2 rounded-full bg-[var(--color-pop)]/20 px-2 py-0.5 text-[9px] font-bold tracking-widest text-[var(--color-pop-bright)]">
                    Team Sweep
                  </span>
                )}
              </span>
              <h3 className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-[0.95] tracking-wide text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)] sm:text-3xl">
                <span className="text-[0.7em] text-[var(--color-cream)]/40">vs </span>
                {match.opponent}
              </h3>
            </div>
            {/* Phone: the score rides in the body's corner. */}
            {hasScore && (
              <div className="flex shrink-0 items-center gap-2 sm:hidden">
                <span className={cn("font-[family-name:var(--font-display)] text-3xl leading-none tabular-nums", scoreColor)}>
                  {match.teamScore}
                  <span className="text-[var(--color-cream)]/30">–</span>
                  {match.opponentScore}
                </span>
                <ResultBall outcome={isWin ? "W" : isLoss ? "L" : "T"} size={30} />
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-cream)]/50">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} className="text-[var(--color-brass)]" /> {formatDate(match.date)} · {formatTime(match.date)}
            </span>
            {match.location && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin size={12} className="shrink-0 text-[var(--color-brass)]" />
                <span className="truncate">{match.location}</span>
              </span>
            )}
          </div>

          <div className="mt-3 text-sm leading-relaxed text-[var(--color-cream)]/80 sm:min-h-[3rem]">
            {recap ? (
              <p className="line-clamp-3 max-w-2xl">{recap}</p>
            ) : isBye ? (
              <p className="italic text-[var(--color-cream)]/45">Bye week — no match.</p>
            ) : !isCompleted ? (
              <p className="text-[var(--color-cream)]/45">On deck.</p>
            ) : (
              <p className="text-[var(--color-cream)]/45">No recap available.</p>
            )}
          </div>

          {/* MVP slot — always reserves space so cards stay uniform. */}
          <div className="mt-auto pt-3">
            {mvp ? (
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--color-brass)]/25 bg-black/30 px-3 py-1 text-xs">
                <Star
                  size={12}
                  className="shrink-0 text-[var(--color-brass-bright)]"
                  fill="currentColor"
                />
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass)]">
                  MVP
                </span>
                <span className="truncate font-medium text-[var(--color-cream)]">
                  {mvp.playerName}
                </span>
                {mvp.score && (
                  <span className="shrink-0 tabular-nums text-[var(--color-cream)]/50">
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
              <span className="text-[10px] uppercase tracking-[0.24em] text-[var(--color-cream)]/25">
                {isBye ? "—" : "No MVP"}
              </span>
            )}
          </div>
        </div>

        {/* Score column — sm+, never wraps */}
        <div className="hidden flex-col items-center justify-center gap-2 border-l border-[var(--color-cream)]/[0.07] p-4 sm:flex">
          {hasScore ? (
            <>
              <ResultBall
                outcome={isWin ? "W" : isLoss ? "L" : "T"}
                size={40}
                glow
              />
              <div
                className={cn(
                  "whitespace-nowrap font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide tabular-nums",
                  scoreColor,
                )}
              >
                {match.teamScore}
                <span className="mx-1 text-[var(--color-cream)]/30">–</span>
                {match.opponentScore}
              </div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/40">
                Final
              </p>
            </>
          ) : isBye ? (
            <>
              <ResultBall outcome="N" size={40} />
              <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-cream)]/40">
                Bye
              </span>
            </>
          ) : (
            <span className="pm-outline font-[family-name:var(--font-display)] text-4xl tracking-wide">
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
