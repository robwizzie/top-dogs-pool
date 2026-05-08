import Link from "next/link";
import type { Match } from "@/lib/apa/schemas";

type Tone = "win" | "loss" | "tie" | "next" | "upcoming" | "bye" | "forfeit";

function toneFor(match: Match, isNext: boolean): Tone {
  if (match.status === "bye") return "bye";
  if (match.status === "forfeit") return "forfeit";
  if (match.status === "upcoming") return isNext ? "next" : "upcoming";
  if (
    typeof match.teamScore === "number" &&
    typeof match.opponentScore === "number"
  ) {
    if (match.teamScore > match.opponentScore) return "win";
    if (match.teamScore < match.opponentScore) return "loss";
    return "tie";
  }
  return isNext ? "next" : "upcoming";
}

const TONE_LABEL: Record<Tone, string> = {
  win: "W",
  loss: "L",
  tie: "T",
  next: "NEXT",
  upcoming: "UP",
  bye: "BYE",
  forfeit: "FF",
};

/** Strip leading filler from opponent names for compact display. */
function shortOpponent(name: string): string {
  return name
    .replace(/^the\s+/i, "")
    .replace(/\s+(team|club|crew)\s*$/i, "")
    .trim();
}

/**
 * Season ribbon — horizontally scrolling row of rich week tiles ordered
 * with the most useful matches first:
 *   1. Closest upcoming match (highlighted with a NEXT badge)
 *   2. Remaining upcoming matches in chronological order
 *   3. Completed matches in reverse chronological order (newest → oldest)
 *
 * Each tile shows Wk #, opponent, date, score, with a tone-colored left rail
 * and a tinted glow that strengthens on hover.
 */
export function ScheduleHeatmap({ matches }: { matches: Match[] }) {
  if (matches.length === 0) return null;

  const now = Date.now();
  const upcoming = matches
    .filter(
      (m) => m.status === "upcoming" || new Date(m.date).getTime() >= now,
    )
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const completed = matches
    .filter(
      (m) =>
        m.status === "completed" ||
        m.status === "forfeit" ||
        m.status === "bye",
    )
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const ordered = [...upcoming, ...completed];
  const nextId = upcoming[0]?.id ?? null;

  // Season summary chips
  const completedReal = completed.filter((m) => m.status === "completed");
  const wins = completedReal.filter(
    (m) =>
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number" &&
      m.teamScore > m.opponentScore,
  ).length;
  const losses = completedReal.filter(
    (m) =>
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number" &&
      m.teamScore < m.opponentScore,
  ).length;

  let sweeps = 0;
  let breakAndRuns = 0;
  for (const m of completedReal) {
    for (const r of m.results ?? []) {
      if (r.outcome === "W" && r.sweep) sweeps++;
      if (r.breakAndRun) breakAndRuns++;
    }
  }

  return (
    <section className="surface overflow-hidden">
      {/* Header — title + summary chips */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-soft)] px-6 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Season ribbon
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--fg-dim)]">
            Up next on the left · most recent results follow
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-dim)]">
          <SummaryChip label="Played" value={`${completedReal.length}`} />
          <SummaryChip
            label="Record"
            value={`${wins}-${losses}`}
            tone={wins > losses ? "felt" : wins < losses ? "pop" : undefined}
          />
          {sweeps > 0 && (
            <SummaryChip label="Sweeps" value={`${sweeps}`} tone="brass" />
          )}
          {breakAndRuns > 0 && (
            <SummaryChip label="B&R" value={`${breakAndRuns}`} tone="felt" />
          )}
        </div>
      </header>

      {/* Tiles — horizontal scroll with generous left/right padding so the
          leftmost tile has clear breathing room on default load and the
          right edge has space for the scrollability fade. */}
      <div className="ribbon-scroll relative">
        <ol
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto py-7 [scrollbar-width:thin]"
          style={{
            paddingInlineStart: "clamp(2rem, 4.5vw, 3.25rem)",
            paddingInlineEnd: "clamp(2.5rem, 5vw, 4rem)",
          }}
        >
          {ordered.map((m, idx) => (
            <li key={m.id} className="snap-start">
              <WeekTile match={m} index={idx} isNext={m.id === nextId} />
            </li>
          ))}
        </ol>
      </div>

      {/* Legend */}
      <footer className="flex flex-wrap items-center gap-4 border-t border-[var(--border)] bg-[var(--bg-soft)] px-6 py-2.5 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-dim)]">
        <Swatch tone="next" label="Next up" />
        <Swatch tone="win" label="Win" />
        <Swatch tone="loss" label="Loss" />
        <Swatch tone="tie" label="Tie" />
        <Swatch tone="upcoming" label="Upcoming" />
        <Swatch tone="bye" label="Bye" />
        <Swatch tone="forfeit" label="Forfeit" />
      </footer>
    </section>
  );
}

function WeekTile({
  match,
  index,
  isNext,
}: {
  match: Match;
  index: number;
  isNext: boolean;
}) {
  const tone = toneFor(match, isNext);
  const date = new Date(match.date);
  const dateLabel = date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
  });
  const week = match.week;
  const opp = shortOpponent(match.opponent);
  const score =
    typeof match.teamScore === "number" &&
    typeof match.opponentScore === "number"
      ? `${match.teamScore}–${match.opponentScore}`
      : null;

  // Days-to label for the next-up tile, e.g. "in 4 days"
  const daysUntil = Math.round(
    (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const relativeLabel =
    isNext && match.status !== "completed"
      ? daysUntil <= 0
        ? "Tonight"
        : daysUntil === 1
          ? "Tomorrow"
          : `In ${daysUntil} days`
      : null;

  const inner = (
    <article
      className="ribbon-tile group flex h-[140px] w-[200px] flex-col justify-between"
      data-tone={tone}
      data-next={isNext || undefined}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Top — week number + tone badge */}
      <header className="flex items-start justify-between gap-2">
        <span className="font-[family-name:var(--font-display)] text-lg leading-none tracking-wide text-[var(--color-cream)]">
          {week !== undefined ? `Wk ${week}` : dateLabel}
        </span>
        <span className="ribbon-tone-badge" data-tone={tone}>
          {TONE_LABEL[tone]}
        </span>
      </header>

      {/* Middle — opponent + date / countdown */}
      <div className="min-w-0">
        <p
          className="line-clamp-1 text-[13px] font-semibold text-[var(--color-cream)]"
          title={match.opponent}
        >
          vs {opp}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-dim)]">
          {relativeLabel ?? dateLabel}
        </p>
      </div>

      {/* Bottom — score (if any) or status */}
      <footer className="flex items-end justify-between">
        {score ? (
          <span className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide tabular-nums text-[var(--color-cream)]">
            {score}
          </span>
        ) : (
          <span className="font-[family-name:var(--font-display)] text-base tracking-[0.16em] text-[var(--fg-dim)]">
            {tone === "bye" ? "BYE" : tone === "forfeit" ? "FF" : "TBD"}
          </span>
        )}
        {match.location && (
          <span className="ml-2 line-clamp-1 max-w-[60%] truncate text-right text-[10px] text-[var(--fg-dim)]">
            {match.location}
          </span>
        )}
      </footer>
    </article>
  );

  if (match.status === "bye") {
    return inner;
  }
  return (
    <Link
      href={`/matches/${match.id}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brass)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
      title={`vs ${match.opponent} · ${dateLabel}${score ? ` · ${score}` : ""}`}
    >
      {inner}
    </Link>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "felt" | "pop" | "brass";
}) {
  const valueClass =
    tone === "felt"
      ? "text-[var(--color-felt-bright)]"
      : tone === "pop"
        ? "text-[var(--color-pop-bright)]"
        : tone === "brass"
          ? "text-[var(--color-brass-bright)]"
          : "text-[var(--color-cream)]";
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1">
      <span>{label}</span>
      <span
        className={`font-[family-name:var(--font-display)] text-[13px] tracking-wide tabular-nums ${valueClass}`}
      >
        {value}
      </span>
    </span>
  );
}

function Swatch({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="ribbon-swatch" data-tone={tone} aria-hidden />
      {label}
    </span>
  );
}
