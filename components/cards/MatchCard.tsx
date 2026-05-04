import Link from "next/link";
import { Calendar, MapPin, Star } from "lucide-react";
import type { Match } from "@/lib/apa/schemas";
import { matchMvp } from "@/lib/recap";
import { cn, formatDate, formatTime } from "@/lib/utils";

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

  const accent = isUpcoming
    ? "bg-[var(--color-brass)]"
    : isTie
      ? "bg-[var(--color-tie)]"
      : isWin
        ? "bg-[var(--color-felt-bright)]"
        : isLoss
          ? "bg-[var(--color-pop)]"
          : "bg-[var(--border)]";

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
    : "text-[var(--color-brass)]";

  const mvp = isCompleted ? matchMvp(match) : null;

  const inner = (
    <article
      className={cn(
        "surface surface-hover relative flex h-full flex-col overflow-hidden p-5 transition-all",
        highlight && "ring-1 ring-[var(--color-brass)]/40",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", accent)} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "mb-1 text-[11px] font-semibold uppercase tracking-[0.28em]",
              eyebrowColor,
            )}
          >
            {eyebrowLabel}
            {match.week ? ` · Week ${match.week}` : ""}
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
            vs <span className="text-[var(--color-cream)]">{match.opponent}</span>
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--fg-dim)]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} />
              {formatDate(match.date)} · {formatTime(match.date)}
            </span>
            {match.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} />
                {match.location}
              </span>
            )}
          </div>
        </div>

        {hasScore && (
          <div className="shrink-0 text-right">
            <div
              className={cn(
                "font-[family-name:var(--font-display)] text-3xl tracking-wide tabular-nums",
                isTie
                  ? "text-[var(--color-tie-bright)]"
                  : "text-[var(--color-brass-bright)]",
              )}
            >
              {match.teamScore}
              <span className="mx-1 text-[var(--fg-dim)]">–</span>
              {match.opponentScore}
            </div>
            {match.sweep && (
              <span className="mt-1 inline-block rounded-full bg-[var(--color-pop)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-pop-bright)]">
                Sweep
              </span>
            )}
          </div>
        )}
      </div>

      {/* Spacer that pushes MVP/footer to the bottom for uniform card heights. */}
      <div className="flex-1" aria-hidden />

      {mvp && (
        <div className="mt-4 flex items-center gap-2 border-t border-[var(--border)] pt-3 text-xs">
          <Star
            size={14}
            className="shrink-0 text-[var(--color-brass-bright)]"
            fill="currentColor"
          />
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass)]">
            MVP
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--fg)]">
            {mvp.playerName}
          </span>
          {mvp.score && (
            <span className="shrink-0 text-[var(--fg-dim)] tabular-nums">
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

  // Wrap in Link only when there's a destination (completed matches).
  return match.status === "completed" ? (
    <Link href={`/matches/${match.id}`} className="block h-full">
      {inner}
    </Link>
  ) : (
    <div className="h-full">{inner}</div>
  );
}
