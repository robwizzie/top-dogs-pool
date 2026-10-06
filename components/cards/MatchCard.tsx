import Link from "next/link";
import { Calendar, MapPin, Star } from "lucide-react";
import type { Match } from "@/lib/apa/schemas";
import { matchMvp } from "@/lib/recap";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { ResultBall } from "@/components/season/SeasonKit";

export function MatchCard({
  match,
  highlight = false,
}: {
  match: Match;
  highlight?: boolean;
}) {
  const isUpcoming = match.status === "upcoming";
  const isBye = match.status === "bye";
  const isCompleted = match.status === "completed";
  const hasScore =
    isCompleted &&
    match.teamScore !== undefined &&
    match.opponentScore !== undefined;
  const isWin = hasScore && match.teamScore! > match.opponentScore!;
  const isLoss = hasScore && match.teamScore! < match.opponentScore!;
  const isTie = hasScore && match.teamScore! === match.opponentScore!;

  const eyebrowLabel = isUpcoming
    ? "Upcoming"
    : isBye
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
        : isBye
          ? "text-[var(--color-cream)]/45"
          : "text-[var(--color-brass)]";

  // Soft light spilling from the date block, tinted by result.
  const glow = isWin
    ? "rgba(46,139,87,0.28)"
    : isLoss
      ? "rgba(200,54,47,0.24)"
      : isTie
        ? "rgba(224,168,46,0.24)"
        : isBye
          ? "rgba(236,225,196,0.06)"
          : "rgba(224,190,107,0.16)";

  const mvp = isCompleted ? matchMvp(match) : null;
  const d = new Date(match.date);

  const inner = (
    <article
      className={cn(
        "pm-glass group relative flex h-full flex-col overflow-hidden",
        !isBye && "pm-lift",
        highlight &&
          "shadow-[0_0_0_1px_rgba(224,190,107,0.45),0_30px_70px_-30px_rgba(201,162,74,0.55)]",
        isBye && "opacity-75",
      )}
    >
      {!isBye && <span className="pm-sheen" />}
      {highlight && (
        <>
          <span className="pm-felt pointer-events-none absolute inset-px rounded-[inherit] opacity-60" aria-hidden />
          <span className="pm-lamp pointer-events-none absolute inset-0 rounded-[inherit]" aria-hidden />
        </>
      )}
      <span
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: `radial-gradient(70% 90% at 0% 0%, ${glow}, transparent 70%)` }}
        aria-hidden
      />

      <div className="relative flex items-start gap-4 p-5">
        {/* Date block — like the date on a fight poster. */}
        <div
          className={cn(
            "flex w-[3.75rem] shrink-0 flex-col items-center rounded-xl border px-1 pb-1.5 pt-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
            highlight
              ? "border-[var(--color-brass)]/50 bg-black/40"
              : "border-[var(--color-cream)]/10 bg-black/25",
          )}
        >
          <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass)]">
            {d.toLocaleDateString("en-US", { month: "short" })}
          </span>
          <span className="font-[family-name:var(--font-display)] text-3xl leading-none text-[var(--color-cream)]">
            {d.getDate()}
          </span>
          <span className="text-[9px] uppercase tracking-[0.2em] text-[var(--color-cream)]/45">
            {d.toLocaleDateString("en-US", { weekday: "short" })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em]",
              eyebrowColor,
            )}
          >
            {highlight && isUpcoming && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-brass-bright)] shadow-[0_0_8px_rgba(224,190,107,0.9)]" />
            )}
            {highlight && isUpcoming ? "Next up" : eyebrowLabel}
            {match.week ? <span className="text-[var(--color-cream)]/40">· Wk {match.week}</span> : ""}
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-2xl leading-[0.95] tracking-wide text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)] sm:text-[1.7rem]">
            <span className="text-[0.75em] text-[var(--color-cream)]/45">vs </span>
            {match.opponent}
          </h3>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-[var(--color-cream)]/55">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} className="text-[var(--color-brass)]" />
              {formatDate(match.date)} · {formatTime(match.date)}
            </span>
            {match.location && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin size={12} className="shrink-0 text-[var(--color-brass)]" />
                <span className="truncate">{match.location}</span>
              </span>
            )}
          </div>
        </div>

        {hasScore && (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <ResultBall outcome={isWin ? "W" : isLoss ? "L" : "T"} size={30} />
            <div
              className={cn(
                "font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide tabular-nums",
                isTie
                  ? "text-[var(--color-tie-bright)]"
                  : isWin
                    ? "text-[var(--color-felt-bright)]"
                    : "text-[var(--color-pop-bright)]",
              )}
            >
              {match.teamScore}
              <span className="mx-0.5 text-[var(--color-cream)]/30">–</span>
              {match.opponentScore}
            </div>
            {match.sweep && (
              <span className="inline-block rounded-full bg-[var(--color-pop)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-pop-bright)]">
                Sweep
              </span>
            )}
          </div>
        )}
      </div>

      {/* Spacer that pushes MVP/footer to the bottom for uniform card heights. */}
      <div className="flex-1" aria-hidden />

      {mvp && (
        <div className="relative mx-5 mb-4 flex items-center gap-2 border-t border-[var(--color-cream)]/[0.07] pt-3 text-xs">
          <Star
            size={14}
            className="shrink-0 text-[var(--color-brass-bright)]"
            fill="currentColor"
          />
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass)]">
            MVP
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-cream)]">
            {mvp.playerName}
          </span>
          {mvp.score && (
            <span className="shrink-0 text-[var(--color-cream)]/50 tabular-nums">
              {mvp.score}
            </span>
          )}
          {mvp.sweep && (
            <span className="shrink-0 rounded-full bg-[var(--color-pop)]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--color-pop-bright)]">
              SW
            </span>
          )}
          {!mvp.sweep && mvp.miniSweep && (
            <span className="shrink-0 rounded-full bg-[var(--color-brass)]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--color-brass-bright)]">
              MS
            </span>
          )}
          {mvp.breakAndRun && (
            <span className="shrink-0 rounded-full bg-[var(--color-felt)]/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--color-felt-bright)]">
              B&amp;R
            </span>
          )}
          {mvp.eightOnBreak && (
            <span className="shrink-0 rounded-full bg-[var(--color-cream)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--color-cream)]">
              8oB
            </span>
          )}
        </div>
      )}
    </article>
  );

  // Always link to the match scoresheet — even upcoming matches benefit
  // from the page (location, time, weekly context) and the eventual recap.
  // Bye matches are the only no-content case.
  return match.status === "bye" ? (
    <div className="h-full">{inner}</div>
  ) : (
    <Link href={`/matches/${match.id}`} className="block h-full">
      {inner}
    </Link>
  );
}
