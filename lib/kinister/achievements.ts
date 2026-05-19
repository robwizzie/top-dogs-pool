import type { KinisterShot } from "./shots";
import type { ShotStats } from "./useShotStats";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress?: { current: number; goal: number };
};

/**
 * Derived list of achievement badges based on the user's tracker data and
 * drilled set. Pure computation — no storage of its own; recomputes any
 * time the underlying numbers change.
 */
export function computeAchievements(args: {
  shots: KinisterShot[];
  stats: Record<string, ShotStats>;
  drilled: Set<string>;
}): Achievement[] {
  const { shots, stats, drilled } = args;

  let totalAttempts = 0;
  let totalMakes = 0;
  const shotsTried = new Set<string>();
  const allDates = new Set<string>();
  let bestStreak20Plus = 0; // best make rate on any shot with 20+ attempts

  for (const [id, s] of Object.entries(stats)) {
    totalAttempts += s.totalAttempts;
    totalMakes += s.totalMakes;
    if (s.totalAttempts > 0) shotsTried.add(id);
    for (const session of s.sessions) allDates.add(session.date);
    if (s.totalAttempts >= 20) {
      const pct = (s.totalMakes / s.totalAttempts) * 100;
      if (pct > bestStreak20Plus) bestStreak20Plus = pct;
    }
  }

  const dailyStreak = currentDailyStreak(allDates);
  const foundationalIds = shots
    .filter((s) => s.difficulty === "Foundational")
    .map((s) => s.id);
  const intermediateIds = shots
    .filter((s) => s.difficulty === "Intermediate")
    .map((s) => s.id);
  const advancedIds = shots
    .filter((s) => s.difficulty === "Advanced")
    .map((s) => s.id);

  const ach: Achievement[] = [];

  ach.push({
    id: "first-attempt",
    title: "First attempt",
    description: "Log your first practice rep.",
    unlocked: totalAttempts >= 1,
    progress: { current: Math.min(totalAttempts, 1), goal: 1 },
  });

  const makeMilestones = [10, 50, 100, 500];
  for (const goal of makeMilestones) {
    ach.push({
      id: `makes-${goal}`,
      title: `${goal} makes`,
      description: `Pocket ${goal} object balls in tracked sessions.`,
      unlocked: totalMakes >= goal,
      progress: { current: Math.min(totalMakes, goal), goal },
    });
  }

  const streakMilestones = [3, 7, 30];
  for (const goal of streakMilestones) {
    ach.push({
      id: `streak-${goal}`,
      title: `${goal}-day streak`,
      description: `Practice ${goal} days in a row.`,
      unlocked: dailyStreak >= goal,
      progress: { current: Math.min(dailyStreak, goal), goal },
    });
  }

  ach.push({
    id: "drilled-foundational",
    title: "Foundations complete",
    description: "Mark every Foundational shot as drilled.",
    unlocked: foundationalIds.every((id) => drilled.has(id)),
    progress: {
      current: foundationalIds.filter((id) => drilled.has(id)).length,
      goal: foundationalIds.length,
    },
  });
  ach.push({
    id: "drilled-intermediate",
    title: "Intermediate complete",
    description: "Mark every Intermediate shot as drilled.",
    unlocked: intermediateIds.every((id) => drilled.has(id)),
    progress: {
      current: intermediateIds.filter((id) => drilled.has(id)).length,
      goal: intermediateIds.length,
    },
  });
  ach.push({
    id: "drilled-advanced",
    title: "Advanced complete",
    description: "Mark every Advanced shot as drilled.",
    unlocked: advancedIds.every((id) => drilled.has(id)),
    progress: {
      current: advancedIds.filter((id) => drilled.has(id)).length,
      goal: advancedIds.length,
    },
  });

  ach.push({
    id: "variety",
    title: "Variety pack",
    description: "Log practice on 10 different shots.",
    unlocked: shotsTried.size >= 10,
    progress: { current: Math.min(shotsTried.size, 10), goal: 10 },
  });

  ach.push({
    id: "sniper",
    title: "Sniper",
    description: "Hit 80% on any shot with 20+ attempts.",
    unlocked: bestStreak20Plus >= 80,
    progress: {
      current: Math.min(Math.round(bestStreak20Plus), 80),
      goal: 80,
    },
  });

  return ach;
}

/**
 * Streak of consecutive days ending today on which the player logged at
 * least one attempt across any shot.
 */
export function currentDailyStreak(allDates: Set<string>): number {
  if (allDates.size === 0) return 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const key = dateKey(cursor);
    if (allDates.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      // Allow today to have zero attempts (player hasn't practiced yet
      // today) — streak still counts if yesterday was logged.
      if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
  }
  return streak;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
