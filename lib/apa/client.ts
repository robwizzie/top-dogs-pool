import { ApaSnapshot } from "./schemas";

export class ApaFetchError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApaFetchError";
  }
}

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

let cached: Promise<ApaSnapshot> | null = null;

/**
 * The committed data/apa.json snapshot, memoized per process / isolate.
 *
 * The file is bundled into the server build instead of being read from disk
 * at request time: Cloudflare Workers have no filesystem to read it from, and
 * on every other host (Vercel, Docker, `next dev`) it only ever changes
 * through a commit + rebuild anyway (the scraper workflow commits
 * data/apa.json, which triggers a redeploy). It is a dynamic import so the
 * multi-MB JSON.parse runs on the first call, not whenever a module that
 * imports this file is loaded — serving a cached page never pays for it.
 *
 * The snapshot is the committed output of our own scraper/projection
 * (`npm run sync`), so its shape is already guaranteed and every schema
 * default is materialized into the file. Running a full Zod `.parse()` over
 * the multi-MB object on every cold instance is therefore pure CPU waste
 * (Vercel Active CPU / the Workers CPU-time limit). We skip validation in
 * production and keep it in dev/preview as a safety net that catches a
 * malformed or hand-edited file before it ships.
 */
export function loadSnapshot(): Promise<ApaSnapshot> {
  cached ??= import("@/data/apa.json").then(
    (mod) => {
      const json: unknown = mod.default;
      return process.env.NODE_ENV === "production"
        ? (json as ApaSnapshot)
        : ApaSnapshot.parse(json);
    },
  ).catch((err: unknown) => {
    console.warn("[apa] failed to load snapshot:", (err as Error).message);
    return EMPTY_SNAPSHOT;
  });
  return cached;
}
