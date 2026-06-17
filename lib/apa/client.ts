import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { ApaSnapshot } from "./schemas";

export class ApaFetchError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApaFetchError";
  }
}

const SNAPSHOT_PATH = resolve(process.cwd(), "data/apa.json");

const EMPTY_SNAPSHOT: ApaSnapshot = {
  lastUpdated: "1970-01-01T00:00:00.000Z",
  teamId: 0,
  currentSession: null,
  sessions: [],
  team: {
    name: "Top Dawgs",
    format: "8-ball",
    record: { wins: 0, losses: 0 },
    upcomingMatch: null,
    recentMatches: [],
  },
  roster: [],
  schedule: [],
  standings: [],
  matches: {},
  players: {},
  leaderboards: {},
  sessionRosters: {},
  sessionStandings: {},
  opponentTeams: {},
  opponentPlayers: {},
};

let cached: { mtime: number; data: ApaSnapshot } | null = null;

/**
 * Load data/apa.json. Cached in-process by mtime — Next.js may call this
 * many times per render and the file rarely changes.
 *
 * The snapshot is the committed output of our own scraper/projection
 * (`npm run sync`), so its shape is already guaranteed and every schema
 * default is materialized into the file. Running a full Zod `.parse()` over
 * the multi-MB object on every cold function instance is therefore pure CPU
 * waste — on Vercel's Fluid Compute it shows up directly as Active CPU. We
 * skip validation in production and keep it in dev/preview as a safety net
 * that catches a malformed or hand-edited file before it ships.
 */
export async function loadSnapshot(): Promise<ApaSnapshot> {
  try {
    const s = await stat(SNAPSHOT_PATH);
    if (cached && cached.mtime === s.mtimeMs) return cached.data;
    const raw = await readFile(SNAPSHOT_PATH, "utf8");
    const json = JSON.parse(raw);
    const parsed =
      process.env.NODE_ENV === "production"
        ? (json as ApaSnapshot)
        : ApaSnapshot.parse(json);
    cached = { mtime: s.mtimeMs, data: parsed };
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return EMPTY_SNAPSHOT;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[apa] failed to load snapshot:", (err as Error).message);
    }
    return EMPTY_SNAPSHOT;
  }
}
