import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import type { Match } from "@/lib/apa/schemas";
import { cn, formatDate, formatTime } from "@/lib/utils";

export function MatchCard({
  match,
  highlight = false,
}: {
  match: Match;
  highlight?: boolean;
}) {
  const isUpcoming = match.status === "upcoming";
  const isWin =
    !!match.teamScore &&
    !!match.opponentScore !== undefined &&
    (match.teamScore ?? 0) > (match.opponentScore ?? 0);
  const isLoss =
    match.status === "completed" &&
    (match.teamScore ?? 0) < (match.opponentScore ?? 0);

  const accent = isUpcoming
    ? "bg-[var(--color-brass)]"
    : isWin
      ? "bg-[var(--color-felt-bright)]"
      : "bg-[var(--color-pop)]";

  const inner = (
    <article
      className={cn(
        "surface surface-hover relative overflow-hidden p-5 transition-all",
        highlight && "ring-1 ring-[var(--color-brass)]/40",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", accent)} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
            {isUpcoming ? "Upcoming" : isWin ? "Win" : isLoss ? "Loss" : "Match"}
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

        {!isUpcoming && match.teamScore !== undefined && (
          <div className="shrink-0 text-right">
            <div className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--color-brass-bright)]">
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
    </article>
  );

  return match.status === "completed" ? (
    <Link href={`/matches/${match.id}`} className="block">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}
