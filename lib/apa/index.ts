import { unstable_cache } from "next/cache";
import { APA_REVALIDATE_SECONDS, APA_TEAM_URL, TEAM_NAME } from "@/lib/config";
import { fetchApaHtml, ApaFetchError } from "./client";
import {
  parseMatchDetail,
  parsePlayerStats,
  parseRoster,
  parseSchedule,
  parseStandings,
  parseTeamPage,
} from "./scraper";
import { buildLeaderboard } from "./sweeps";
import type {
  LeaderboardRow,
  Match,
  Player,
  PlayerStats,
  Standing,
  TeamSummary,
} from "./schemas";

const cacheOpts = {
  revalidate: APA_REVALIDATE_SECONDS,
  tags: ["apa"],
};

/** Wraps a data accessor so a scrape error returns null instead of crashing the page. */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[apa] scrape failed:", (err as Error).message);
    }
    return null;
  }
}

export const getTeam = unstable_cache(
  async (): Promise<TeamSummary | null> =>
    safe(async () => {
      const html = await fetchApaHtml(APA_TEAM_URL);
      return parseTeamPage(html, APA_TEAM_URL);
    }),
  ["apa-team"],
  cacheOpts,
);

export const getRoster = unstable_cache(
  async (): Promise<Player[]> =>
    (await safe(async () => {
      const html = await fetchApaHtml(APA_TEAM_URL);
      return parseRoster(html, APA_TEAM_URL);
    })) ?? [],
  ["apa-roster"],
  cacheOpts,
);

export const getSchedule = unstable_cache(
  async (): Promise<Match[]> =>
    (await safe(async () => {
      const html = await fetchApaHtml(APA_TEAM_URL);
      return parseSchedule(html, APA_TEAM_URL);
    })) ?? [],
  ["apa-schedule"],
  cacheOpts,
);

/** Fetches a player profile page if available; falls back to roster info. */
export async function getPlayer(id: string): Promise<{
  player: Player | null;
  stats: PlayerStats | null;
}> {
  const roster = await getRoster();
  const player = roster.find((p) => p.id === id) ?? null;

  let stats: PlayerStats | null = null;
  if (player?.url) {
    stats = await safe(async () => {
      const html = await fetchApaHtml(player.url!);
      return parsePlayerStats(html, id);
    });
  }
  return { player, stats };
}

/** Match detail — fetches scoresheet if a URL is available. */
export async function getMatch(id: string): Promise<Match | null> {
  const schedule = await getSchedule();
  const base = schedule.find((m) => m.id === id);
  if (!base) return null;
  if (!base.url) return base;

  const enriched = await safe(async () => {
    const html = await fetchApaHtml(base.url!);
    return parseMatchDetail(html, base, TEAM_NAME);
  });
  return enriched ?? base;
}

/** Standings — APA exposes a /division/<id>/standings page; we discover it from the team page. */
export const getStandings = unstable_cache(
  async (): Promise<Standing[]> =>
    (await safe(async () => {
      const teamHtml = await fetchApaHtml(APA_TEAM_URL);
      const m = teamHtml.match(/href="([^"]*\/division\/\d+[^"]*)"/i);
      if (!m) return [] as Standing[];
      const standingsUrl = new URL(m[1], APA_TEAM_URL).toString();
      const html = await fetchApaHtml(standingsUrl);
      return parseStandings(html, TEAM_NAME);
    })) ?? [],
  ["apa-standings"],
  cacheOpts,
);

/** Leaderboard derived from completed matches, no manual entry. */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const [roster, schedule] = await Promise.all([getRoster(), getSchedule()]);
  // Enrich completed matches with scoresheets so per-player results are populated.
  const completed = schedule.filter((m) => m.status === "completed");
  const enriched = await Promise.all(completed.map((m) => getMatch(m.id)));
  const matches = enriched.filter((m): m is Match => m !== null);
  return buildLeaderboard(roster, matches);
}

export { ApaFetchError };
