import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { Format } from "./schemas";
import type {
  PatchInstance,
  PatchInstanceKind,
  PlayerPatchInstances,
} from "./index";

/**
 * Manually-entered tournament results.
 *
 * Tournament games are played outside APA's tracked league (a different app we
 * can't scrape), so they never show up in data/apa.json. This file is the
 * hand-maintained companion: it lives in the repo (committed, like
 * data/players-config.json) and is folded into the leaderboard at *read time*
 * — no scraper or `npm run project` run required.
 *
 * Each entry is attributed to a league session id (so it can be filtered with
 * the session picker) and carries explicit patch flags + an optional free-form
 * bonus, since there's no scoresheet to detect them from.
 */

export const TournamentResult = z.object({
  /** APA member number, or any stable id for a non-member player. */
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  /** Skill level at the time of the tournament match. */
  skillLevel: z.number().int().min(0).max(9).optional(),
  opponentName: z.string().optional().default(""),
  opponentSkillLevel: z.number().int().min(0).max(9).optional(),
  outcome: z.enum(["W", "L"]),
  /** "X-Y" — player's games vs opponent's games. */
  score: z.string().optional(),
  /** Won without giving up a game. 1 pt. Mutually exclusive with miniSweep. */
  sweep: z.boolean().default(false),
  /** Won + opponent stayed off the hill. 0.5 pt. */
  miniSweep: z.boolean().default(false),
  /** Number of break-and-runs in this match. 1 pt each. */
  breakAndRuns: z.number().int().min(0).default(0),
  /** Number of 8-on-the-breaks in this match. 1 pt each. */
  eightOnBreaks: z.number().int().min(0).default(0),
  /** Skill-level increases credited from this match. 1 pt each. */
  levelUps: z.number().int().min(0).default(0),
  /** Player's first career win landed here. 1 pt. */
  firstWin: z.boolean().default(false),
  /** Free-form points for tournament-specific things (placement, awards…). */
  bonusPoints: z.number().default(0),
  bonusLabel: z.string().optional().default(""),
});
export type TournamentResult = z.infer<typeof TournamentResult>;

export const TournamentGame = z.object({
  id: z.string().min(1),
  /** Display name of the tournament / event. */
  name: z.string().min(1),
  /** ISO date (YYYY-MM-DD or full ISO). */
  date: z.string(),
  /** League session this entry is attributed to (for the session picker). */
  sessionId: z.number().int(),
  format: Format.default("8-ball"),
  results: z.array(TournamentResult).default([]),
});
export type TournamentGame = z.infer<typeof TournamentGame>;

export const TournamentFile = z.object({
  $comment: z.string().optional(),
  games: z.array(TournamentGame).default([]),
});
export type TournamentFile = z.infer<typeof TournamentFile>;

const TOURNAMENTS_PATH = resolve(process.cwd(), "data/tournaments.json");

const EMPTY_FILE: TournamentFile = { games: [] };

let cached: { mtime: number; data: TournamentFile } | null = null;

/** Load + validate data/tournaments.json. Cached in-process by mtime. */
export async function loadTournamentFile(): Promise<TournamentFile> {
  try {
    const s = await stat(TOURNAMENTS_PATH);
    if (cached && cached.mtime === s.mtimeMs) return cached.data;
    const raw = await readFile(TOURNAMENTS_PATH, "utf8");
    const parsed = TournamentFile.parse(JSON.parse(raw));
    cached = { mtime: s.mtimeMs, data: parsed };
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_FILE;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[tournaments] failed to load:", (err as Error).message);
    }
    return EMPTY_FILE;
  }
}

/** Convenience: just the games array. */
export async function loadTournaments(): Promise<TournamentGame[]> {
  return (await loadTournamentFile()).games;
}

/**
 * Persist the full file. Writing updates the mtime, so the in-process cache
 * (keyed by mtime) self-busts on the next read.
 *
 * NOTE: in the baked Docker image, data/ is copied in at build time. A runtime
 * write survives only as long as the container/disk lives — commit the file (or
 * mount a volume at /app/data) for changes to persist across redeploys.
 */
export async function writeTournamentFile(file: TournamentFile): Promise<void> {
  const validated = TournamentFile.parse(file);
  const body = JSON.stringify(validated, null, 2) + "\n";
  await writeFile(TOURNAMENTS_PATH, body, "utf8");
  cached = null;
}

/** Leaderboard points earned by a single tournament result. */
export function tournamentResultPoints(r: TournamentResult): number {
  let p = 0;
  if (r.sweep) p += 1;
  else if (r.miniSweep) p += 0.5;
  p += r.breakAndRuns;
  p += r.eightOnBreaks;
  p += r.levelUps;
  if (r.firstWin) p += 1;
  p += r.bonusPoints;
  return p;
}

/** Additive contribution a tournament makes to a player's leaderboard row. */
export type TournamentRowDelta = {
  playerId: string;
  playerName: string;
  skillLevel?: number;
  points: number;
  sweeps: number;
  miniSweeps: number;
  breakAndRuns: number;
  eightOnBreaks: number;
  levelUps: number;
  firstWin: number;
  matchesPlayed: number;
  wins: number;
};

/**
 * Sum tournament results into per-player row deltas, restricted to the given
 * session filter (`null` = every session). Returned keyed by playerId.
 */
export function tournamentRowDeltas(
  games: TournamentGame[],
  sessionFilter: Set<number> | null,
): Map<string, TournamentRowDelta> {
  const out = new Map<string, TournamentRowDelta>();
  for (const g of games) {
    if (sessionFilter !== null && !sessionFilter.has(g.sessionId)) continue;
    for (const r of g.results) {
      let cur = out.get(r.playerId);
      if (!cur) {
        cur = {
          playerId: r.playerId,
          playerName: r.playerName,
          skillLevel: r.skillLevel,
          points: 0,
          sweeps: 0,
          miniSweeps: 0,
          breakAndRuns: 0,
          eightOnBreaks: 0,
          levelUps: 0,
          firstWin: 0,
          matchesPlayed: 0,
          wins: 0,
        };
        out.set(r.playerId, cur);
      }
      cur.points += tournamentResultPoints(r);
      if (r.sweep) cur.sweeps += 1;
      else if (r.miniSweep) cur.miniSweeps += 1;
      cur.breakAndRuns += r.breakAndRuns;
      cur.eightOnBreaks += r.eightOnBreaks;
      cur.levelUps += r.levelUps;
      if (r.firstWin) cur.firstWin = 1;
      cur.matchesPlayed += 1;
      if (r.outcome === "W") cur.wins += 1;
      if (typeof r.skillLevel === "number") cur.skillLevel = r.skillLevel;
    }
  }
  return out;
}

/**
 * Build the per-patch "earned in" lists for tournament games in scope — mirrors
 * getPatchInstances but reads explicit flags rather than detecting them. Each
 * instance is tagged with the tournament name so it's distinguishable in the UI.
 */
export function tournamentPatchInstances(
  games: TournamentGame[],
  sessionFilter: Set<number> | null,
): Map<string, PlayerPatchInstances> {
  const out = new Map<string, PlayerPatchInstances>();
  const ensure = (pid: string): PlayerPatchInstances => {
    let cur = out.get(pid);
    if (!cur) {
      cur = {};
      out.set(pid, cur);
    }
    return cur;
  };
  const push = (pid: string, kind: PatchInstanceKind, inst: PatchInstance) => {
    const bag = ensure(pid);
    (bag[kind] ??= []).push(inst);
  };
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  };

  const sorted = [...games].sort(
    (a, b) => +new Date(a.date) - +new Date(b.date),
  );
  for (const g of sorted) {
    if (sessionFilter !== null && !sessionFilter.has(g.sessionId)) continue;
    for (const r of g.results) {
      const opponent =
        r.opponentName && typeof r.opponentSkillLevel === "number"
          ? { name: r.opponentName, skillLevel: r.opponentSkillLevel }
          : undefined;
      const base: PatchInstance = {
        date: g.date,
        label: `${fmtDate(g.date)} · ${g.name}`,
        score: r.score,
        sublabel: "Tournament",
        opponent,
      };
      if (r.sweep) push(r.playerId, "sweep", base);
      else if (r.miniSweep) push(r.playerId, "mini-sweep", base);
      for (let i = 0; i < r.breakAndRuns; i += 1) {
        push(r.playerId, "break-and-run", base);
      }
      for (let i = 0; i < r.eightOnBreaks; i += 1) {
        push(r.playerId, "8-on-break", base);
      }
      for (let i = 0; i < r.levelUps; i += 1) {
        push(r.playerId, "level-up", { ...base, sublabel: "Tournament · level up" });
      }
      if (r.firstWin) {
        push(r.playerId, "first-win", {
          ...base,
          sublabel: "Tournament · first win",
        });
      }
    }
  }
  return out;
}
