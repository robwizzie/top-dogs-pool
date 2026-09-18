/**
 * The practice drill catalogue.
 *
 * Ported from the Lovable app's inline `drills` array, with the scoring made
 * explicit. Previously a drill carried a single `target` number and the
 * scoring screen let you tap a counter up to it, which meant "Safety
 * Challenge, target 10" was unscoreable — its own instructions award 2 points
 * per snooker and 1 per forced kick, so the target and the per-attempt value
 * disagreed.
 *
 * Each drill now declares how an attempt scores, so the tracker can offer the
 * right buttons instead of a single +1.
 */

export type DrillScoring =
  /** Each successful attempt is worth one point. */
  | { kind: "per-attempt"; attempts: number }
  /** Attempts are worth different amounts; the tracker shows one button each. */
  | {
      kind: "weighted";
      attempts: number;
      options: { label: string; points: number }[];
    };

export type Drill = {
  id: string;
  name: string;
  description: string;
  /** What the drill is training. */
  goal: string;
  instructions: string;
  /** Points that count as a clean run. */
  target: number;
  minPlayers: number;
  scoring: DrillScoring;
};

export const DRILLS: readonly Drill[] = [
  {
    id: "line-drill",
    name: "Line Drill",
    description: "Five balls in a line, pocketed in order",
    goal: "Accuracy and speed control",
    instructions:
      "Set five object balls in a straight line from the foot spot to the head spot, about a diamond apart. Start with the cue ball behind the head string and pocket each ball in order into the same corner pocket without disturbing the others. One point per ball.",
    target: 5,
    minPlayers: 1,
    scoring: { kind: "per-attempt", attempts: 5 },
  },
  {
    id: "cue-ball-control",
    name: "Cue Ball Control Ladder",
    description: "Land the cue ball in four target zones",
    goal: "Precise position with draw, follow and english",
    instructions:
      "Place one object ball on the foot spot and mark four target zones: centre table, the head spot, and both side pockets. Pocket the ball and land the cue ball in zone one, re-spot and repeat for zone two, and so on. One point per zone you land.",
    target: 4,
    minPlayers: 1,
    scoring: { kind: "per-attempt", attempts: 4 },
  },
  {
    id: "3-ball-runout",
    name: "3-Ball Run-Out",
    description: "Call the order, then clear three balls",
    goal: "Pattern play and planning",
    instructions:
      "Place three balls and the cue ball anywhere. Before shooting, call which ball goes first, second and third, then run all three without missing. Plan the whole route before you get down on the first shot. One point per ball made before a miss.",
    target: 3,
    minPlayers: 1,
    scoring: { kind: "per-attempt", attempts: 3 },
  },
  {
    id: "bank-battle",
    name: "Bank Battle",
    description: "Six balls, every one off at least one rail",
    goal: "Bank angles and cushion feel",
    instructions:
      "Set six balls around the table. Each must be pocketed using at least one rail. Work both short and long angles and use the diamond system or the mirror method. One point per bank made.",
    target: 6,
    minPlayers: 1,
    scoring: { kind: "per-attempt", attempts: 6 },
  },
  {
    id: "safety-challenge",
    name: "Safety Challenge",
    description: "Six attempts to hide the cue ball",
    goal: "Defensive play and snookers",
    instructions:
      "Set six balls mid-table and play safeties only. Hiding the cue ball so your opponent has no direct shot scores 2; leaving them a shot they must kick at scores 1; anything else scores nothing. Practise one-rail and two-rail escapes on both sides.",
    // Six attempts at up to 2 points each; 10 is a strong run, not a clean one.
    target: 10,
    minPlayers: 2,
    scoring: {
      kind: "weighted",
      attempts: 6,
      options: [
        { label: "Full snooker", points: 2 },
        { label: "Forced kick", points: 1 },
        { label: "Missed", points: 0 },
      ],
    },
  },
] as const;

export function drillById(id: string): Drill | undefined {
  return DRILLS.find((d) => d.id === id);
}

/** Highest score obtainable in a drill — used to render progress honestly. */
export function drillMaxScore(drill: Drill): number {
  if (drill.scoring.kind === "per-attempt") return drill.scoring.attempts;
  const best = Math.max(...drill.scoring.options.map((o) => o.points));
  return drill.scoring.attempts * best;
}

/** What a practice session stores in `practice_sessions.drill_type`. */
export type DrillPlan = { id: string; target: number }[];

export function parseDrillPlan(raw: string | null | undefined): DrillPlan {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (typeof entry === "string") {
          const d = drillById(entry);
          return d ? { id: d.id, target: d.target } : null;
        }
        if (entry && typeof entry === "object" && typeof entry.id === "string") {
          const d = drillById(entry.id);
          if (!d) return null;
          const target =
            typeof entry.target === "number" && entry.target > 0
              ? entry.target
              : d.target;
          return { id: d.id, target };
        }
        return null;
      })
      .filter((x): x is { id: string; target: number } => x !== null);
  } catch {
    return [];
  }
}

export function serializeDrillPlan(plan: DrillPlan): string {
  return JSON.stringify(plan);
}
