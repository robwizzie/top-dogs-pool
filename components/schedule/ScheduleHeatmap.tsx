import Link from "next/link";
import type { Match } from "@/lib/apa/schemas";

type Tone = "win" | "loss" | "tie" | "upcoming" | "bye" | "empty";

function toneFor(match: Match | null): Tone {
  if (!match) return "empty";
  if (match.status === "bye") return "bye";
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

const TONE_BG: Record<Tone, string> = {
  win: "var(--color-felt-bright)",
  loss: "var(--color-pop)",
  tie: "var(--color-tie)",
  upcoming: "var(--bg-soft)",
  bye: "var(--color-cream)",
  empty: "transparent",
};

const TONE_LABEL: Record<Tone, string> = {
  win: "W",
  loss: "L",
  tie: "T",
  upcoming: "·",
  bye: "B",
  empty: "",
};

/**
 * Calendar heatmap of the season. Renders one cell per day across the
 * matches' min→max date range, organized into ISO weeks (Sun-anchored).
 * Each match-day cell is colored W/L/T/upcoming/BYE and links to its match.
 */
export function ScheduleHeatmap({ matches }: { matches: Match[] }) {
  if (matches.length === 0) return null;

  // Bucket matches by YYYY-MM-DD. If two matches share a day (rare), the
  // first one wins; we add a small "+N" marker to the cell.
  const byDay = new Map<string, Match[]>();
  for (const m of matches) {
    const d = new Date(m.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const list = byDay.get(key) ?? [];
    list.push(m);
    byDay.set(key, list);
  }

  // Determine date range — pad to the surrounding Sunday (start) and the
  // next Saturday (end) so the grid is rectangular.
  const days = [...byDay.keys()].sort();
  const first = new Date(days[0]);
  const last = new Date(days[days.length - 1]);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // back to Sunday
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay())); // forward to Saturday

  // Build week columns. Each column is 7 cells (Sun→Sat).
  const weeks: Array<Array<{ date: Date; key: string; matches: Match[] }>> = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: Array<{ date: Date; key: string; matches: Match[] }> = [];
    for (let i = 0; i < 7; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      week.push({
        date: new Date(cursor),
        key,
        matches: byDay.get(key) ?? [],
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  // Month labels — only show the label above the first week of each month.
  const monthLabels: Array<{ label: string | null; index: number }> = weeks.map(
    (w, i) => {
      const first = w[0].date;
      const label = first.toLocaleString(undefined, { month: "short" });
      const prev = i === 0 ? null : weeks[i - 1][0].date;
      return {
        label: prev && prev.getMonth() === first.getMonth() ? null : label,
        index: i,
      };
    },
  );

  let cellIdx = 0;

  return (
    <div className="surface overflow-x-auto p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
          Season heatmap
        </p>
        <Legend />
      </div>
      <div className="inline-flex flex-col gap-1.5">
        {/* Month labels */}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 16px)`, gap: 4 }}>
          {monthLabels.map((m, i) => (
            <div
              key={i}
              className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--fg-dim)]"
            >
              {m.label ?? ""}
            </div>
          ))}
        </div>
        {/* Day grid: 7 rows, weeks columns */}
        <div className="flex gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day) => {
                const m = day.matches[0] ?? null;
                const tone = toneFor(m);
                const idx = cellIdx++;
                const cell = (
                  <span
                    className="heatmap-cell relative grid h-4 w-4 place-items-center rounded-[3px] text-[8px] font-bold"
                    style={{
                      background: TONE_BG[tone],
                      color:
                        tone === "win"
                          ? "rgba(0,0,0,0.7)"
                          : tone === "bye"
                            ? "rgba(0,0,0,0.7)"
                            : tone === "upcoming" || tone === "empty"
                              ? "var(--fg-dim)"
                              : "white",
                      border:
                        tone === "empty"
                          ? "1px solid var(--border)"
                          : "1px solid rgba(0,0,0,0.25)",
                      animationDelay: `${idx * 4}ms`,
                    }}
                    title={
                      m
                        ? `${day.date.toLocaleDateString()} · vs ${m.opponent}${
                            m.teamScore !== undefined && m.opponentScore !== undefined
                              ? ` (${m.teamScore}–${m.opponentScore})`
                              : ""
                          }`
                        : day.date.toLocaleDateString()
                    }
                  >
                    {TONE_LABEL[tone]}
                    {day.matches.length > 1 && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-[var(--color-ink)] px-0.5 text-[8px] text-[var(--color-cream)]">
                        +{day.matches.length - 1}
                      </span>
                    )}
                  </span>
                );
                if (m) {
                  return (
                    <Link key={day.key} href={`/matches/${m.id}`}>
                      {cell}
                    </Link>
                  );
                }
                return <div key={day.key}>{cell}</div>;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--fg-dim)]">
      <Swatch tone="win" label="Win" />
      <Swatch tone="loss" label="Loss" />
      <Swatch tone="tie" label="Tie" />
      <Swatch tone="upcoming" label="Up" />
      <Swatch tone="bye" label="Bye" />
    </div>
  );
}

function Swatch({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="h-3 w-3 rounded-[3px]"
        style={{
          background: TONE_BG[tone],
          border: "1px solid rgba(0,0,0,0.25)",
        }}
      />
      {label}
    </span>
  );
}
