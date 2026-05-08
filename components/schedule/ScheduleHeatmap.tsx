import Link from "next/link";
import type { Match } from "@/lib/apa/schemas";

type Tone = "win" | "loss" | "tie" | "upcoming" | "bye" | "forfeit";

function toneFor(match: Match): Tone {
  if (match.status === "bye") return "bye";
  if (match.status === "forfeit") return "forfeit";
  if (match.status === "upcoming") return "upcoming";
  if (
    typeof match.teamScore === "number" &&
    typeof match.opponentScore === "number"
  ) {
    if (match.teamScore > match.opponentScore) return "win";
    if (match.teamScore < match.opponentScore) return "loss";
    return "tie";
  }
  return "upcoming";
}

const TONE_LABEL: Record<Tone, string> = {
  win: "W",
  loss: "L",
  tie: "T",
  upcoming: "·",
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
 * "Season ribbon" — a horizontally-scrolling row of week tiles, each rich
 * with: week #, date, opponent, score (or BYE / FF / TBD), and tone-colored
 * left rail. Replaces the prior tiny-cell heatmap that was too sparse to be
 * useful at a glance.
 */
export function ScheduleHeatmap({ matches }: { matches: Match[] }) {
  if (matches.length === 0) return null;

  // Sort by date — keeps weeks in chronological order even if APA returns
  // them shuffled. Render one tile per match, no need to bucket by day
  // because pool nights are always Tuesdays in this league.
  const sorted = [...matches].sort(
    (a, b) => +new Date(a.date) - +new Date(b.date),
  );

  const completed = sorted.filter((m) => m.status === "completed");
  const wins = completed.filter(
    (m) =>
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number" &&
      m.teamScore > m.opponentScore,
  ).length;
  const losses = completed.filter(
    (m) =>
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number" &&
      m.teamScore < m.opponentScore,
  ).length;

  // Sweeps + B&Rs across our results — a nice "season" headline number.
  let sweeps = 0;
  let breakAndRuns = 0;
  for (const m of completed) {
    for (const r of m.results ?? []) {
      if (r.outcome === "W" && r.sweep) sweeps++;
      if (r.breakAndRun) breakAndRuns++;
    }
  }

  return (
    <div className="surface overflow-hidden">
      {/* Header row: title + season summary chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-soft)] px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
          Season ribbon
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-dim)]">
          <SummaryChip label="Played" value={`${completed.length}`} />
          <SummaryChip
            label="Record"
            value={`${wins}-${losses}`}
            tone={
              wins > losses ? "felt" : wins < losses ? "pop" : undefined
            }
          />
          {sweeps > 0 && (
            <SummaryChip label="Sweeps" value={`${sweeps}`} tone="brass" />
          )}
          {breakAndRuns > 0 && (
            <SummaryChip label="B&R" value={`${breakAndRuns}`} tone="felt" />
          )}
        </div>
      </div>

      {/* Tiles */}
      <div className="relative">
        <ol className="flex snap-x gap-3 overflow-x-auto p-4 [scrollbar-width:thin]">
          {sorted.map((m, idx) => (
            <li key={m.id} className="snap-start">
              <WeekTile match={m} index={idx} />
            </li>
          ))}
        </ol>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--bg-soft)] px-5 py-2 text-[10px] uppercase tracking-[0.18em] text-[var(--fg-dim)]">
        <Swatch tone="win" label="Win" />
        <Swatch tone="loss" label="Loss" />
        <Swatch tone="tie" label="Tie" />
        <Swatch tone="upcoming" label="Upcoming" />
        <Swatch tone="bye" label="Bye" />
        <Swatch tone="forfeit" label="Forfeit" />
      </div>
    </div>
  );
}

function WeekTile({ match, index }: { match: Match; index: number }) {
  const tone = toneFor(match);
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

  const inner = (
    <div
      className="ribbon-tile group flex h-[112px] w-[160px] flex-col justify-between"
      data-tone={tone}
      style={{ animationDelay: `${index * 25}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-[family-name:var(--font-display)] text-base leading-none tracking-wide text-[var(--color-cream)]">
          {week !== undefined ? `Wk ${week}` : dateLabel}
        </span>
        <span className="rounded-sm border border-[var(--border)] bg-[var(--bg-soft)] px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[10px] tracking-[0.12em] text-[var(--fg-dim)]">
          {TONE_LABEL[tone]}
        </span>
      </div>
      <div>
        <p
          className="line-clamp-1 text-[12px] font-medium text-[var(--color-cream)]"
          title={match.opponent}
        >
          vs {opp}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--fg-dim)]">
          {dateLabel}
        </p>
      </div>
      <div className="flex items-baseline justify-between">
        {score ? (
          <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide tabular-nums text-[var(--color-cream)]">
            {score}
          </span>
        ) : (
          <span className="font-[family-name:var(--font-display)] text-base tracking-[0.16em] text-[var(--fg-dim)]">
            {tone === "bye" ? "BYE WEEK" : tone === "forfeit" ? "FORFEIT" : "TBD"}
          </span>
        )}
      </div>
    </div>
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
      <span className={`font-[family-name:var(--font-display)] text-[13px] tracking-wide tabular-nums ${valueClass}`}>
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
