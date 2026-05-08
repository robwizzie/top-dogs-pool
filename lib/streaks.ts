import type { Match } from "@/lib/apa/schemas";

export type Streak = {
  /** "W" = winning streak (hot), "L" = losing streak (cold). */
  type: "W" | "L";
  /** Number of consecutive matches in the streak. */
  count: number;
};

/**
 * Build per-player chronological outcome lists (oldest → newest), skipping
 * forfeits. Shared base for streaks + recent-outcome bars.
 */
export function buildOutcomeHistory(matches: Match[]): Map<string, ("W" | "L")[]> {
  const history = new Map<string, ("W" | "L")[]>();
  const sorted = [...matches]
    .filter((m) => m.status === "completed")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  for (const match of sorted) {
    for (const r of match.results ?? []) {
      if (r.forfeited) continue;
      if (r.outcome !== "W" && r.outcome !== "L") continue;
      const list = history.get(r.playerId) ?? [];
      list.push(r.outcome);
      history.set(r.playerId, list);
    }
  }
  return history;
}

export function streakFromHistory(outcomes: ("W" | "L")[]): Streak | null {
  if (outcomes.length === 0) return null;
  const last = outcomes[outcomes.length - 1];
  let count = 1;
  for (let i = outcomes.length - 2; i >= 0; i--) {
    if (outcomes[i] === last) count++;
    else break;
  }
  return { type: last, count };
}

/**
 * Compute current trailing W/L streak for every player across the supplied
 * matches. Forfeits are skipped (they're neither hot nor cold). The "current"
 * streak walks back from the most-recent completed match.
 */
export function computeStreaks(matches: Match[]): Map<string, Streak> {
  const history = buildOutcomeHistory(matches);
  const out = new Map<string, Streak>();
  for (const [id, outcomes] of history) {
    const s = streakFromHistory(outcomes);
    if (s) out.set(id, s);
  }
  return out;
}

/** Hot if 3+ in a row, cold if 3+ losses in a row. Otherwise null. */
export function streakBadge(streak: Streak | undefined | null): {
  kind: "hot" | "cold";
  count: number;
} | null {
  if (!streak) return null;
  if (streak.count < 3) return null;
  return { kind: streak.type === "W" ? "hot" : "cold", count: streak.count };
}
