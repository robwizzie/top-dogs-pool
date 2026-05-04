/**
 * Scrape APA team data via the public SPA — incremental + multi-session.
 *
 * Architecture:
 *   data/cache/teams/<id>.json      raw teamPage / teamRoster / teamSchedule
 *   data/cache/matches/<id>.json    raw MatchPage scoresheet
 *   data/cache/members/<id>.json    raw AliasSessionStats etc.
 *   data/cache/meta.json            current session id, last scrape time
 *
 * Discovery walk:
 *   1. login                          (one-time per run)
 *   2. fetch CURRENT team             (always re-fetched)
 *   3. for each member on the roster, if cache is stale → fetch member
 *   4. from cached members, collect all past team IDs
 *   5. for each past team not cached → fetch
 *   6. for each match across all teams not cached or not finalized → fetch
 *   7. write cache/meta.json
 *
 * Then run `npm run project` to build data/apa.json from the cache.
 *
 * Env:
 *   APA_USERNAME / APA_PASSWORD — required (set in .env.local)
 *   APA_TEAM_URL                 — current team URL (defaults to Top Dogs)
 *   APA_HEADFUL=1                — visible browser (debug)
 *   APA_MEMBER_TTL_DAYS=7        — re-fetch members older than N days
 *   APA_MAX_PAST_SESSIONS=N      — cap past-team backfill (default: all)
 */
import { chromium } from "playwright";
import { config as loadEnv } from "dotenv";
import { ApaCache, ONE_DAY, olderThan } from "./scraper/cache";
import { GraphqlCapture } from "./scraper/capture";
import { authenticate } from "./scraper/auth";
import {
  divisionIdFromTeam,
  fetchDivision,
  fetchMatch,
  fetchMember,
  fetchTeam,
  isMatchFinalized,
  leagueSlug,
  matchIdsFromTeam,
  memberIdsFromTeam,
  teamIdsFromMember,
  type DivisionCacheEntry,
  type MatchCacheEntry,
  type MemberCacheEntry,
  type TeamCacheEntry,
} from "./scraper/operations";

loadEnv({ path: ".env.local" });
loadEnv();

const TEAM_URL =
  process.env.APA_TEAM_URL ??
  "https://league.poolplayers.com/southjersey/team/12894673";
const USERNAME = process.env.APA_USERNAME;
const PASSWORD = process.env.APA_PASSWORD;
const HEADFUL = process.env.APA_HEADFUL === "1";
const MEMBER_TTL =
  parseInt(process.env.APA_MEMBER_TTL_DAYS ?? "7", 10) * ONE_DAY;
const MAX_PAST_SESSIONS = parseInt(process.env.APA_MAX_PAST_SESSIONS ?? "0", 10);

const TEAM_ID = (() => {
  const m = TEAM_URL.match(/\/team\/(\d+)/);
  if (!m) throw new Error(`Cannot parse team id from APA_TEAM_URL: ${TEAM_URL}`);
  return parseInt(m[1], 10);
})();
const SLUG = leagueSlug(TEAM_URL);

if (!USERNAME || !PASSWORD) {
  console.error("Missing APA_USERNAME / APA_PASSWORD in .env.local");
  process.exit(2);
}

async function main() {
  const cache = new ApaCache();
  console.log(
    `→ scraping team #${TEAM_ID} (${SLUG}); cache=${cache.root}\n`,
  );

  const browser = await chromium.launch({ headless: !HEADFUL });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  const capture = new GraphqlCapture();
  capture.attach(page);

  // 1. Auth.
  await page.goto(TEAM_URL, { waitUntil: "networkidle", timeout: 45_000 });
  await authenticate(
    page,
    { username: USERNAME!, password: PASSWORD! },
    { screenshotOnFailure: "data/login-failure.png" },
  );

  const stats = {
    teamsFetched: 0,
    teamsCached: 0,
    matchesFetched: 0,
    matchesCached: 0,
    membersFetched: 0,
    membersCached: 0,
    divisionsFetched: 0,
    divisionsCached: 0,
  };

  // 2. Always re-fetch the CURRENT team.
  console.log("==> fetching current team");
  const currentTeam = await fetchTeam(page, capture, cache, TEAM_ID, SLUG);
  stats.teamsFetched++;
  const currentSessionId = pickSessionId(currentTeam);
  console.log(
    `   ✓ team #${TEAM_ID}, session=${currentSessionId ?? "?"}, ${memberIdsFromTeam(currentTeam).length} roster\n`,
  );

  // 3. Members — fetch any whose cache is missing or stale.
  console.log("==> ensuring member data is fresh");
  const memberIds = memberIdsFromTeam(currentTeam);
  for (const id of memberIds) {
    const cached = await cache.read<MemberCacheEntry>("members", id);
    const stale = !cached || olderThan(cached, MEMBER_TTL);
    if (!stale) {
      stats.membersCached++;
      console.log(`   · member #${id} cached`);
      continue;
    }
    try {
      await fetchMember(page, capture, cache, id, SLUG);
      stats.membersFetched++;
      console.log(`   ✓ fetched member #${id}`);
    } catch (e) {
      console.warn(`   ✗ member #${id}: ${(e as Error).message}`);
    }
  }
  console.log();

  // 4. Past teams — collect IDs, fetch any that aren't cached.
  console.log("==> backfilling past teams");
  const allTeamIds = new Set<number>([TEAM_ID]);
  for (const id of memberIds) {
    const m = await cache.read<MemberCacheEntry>("members", id);
    if (!m) continue;
    for (const t of teamIdsFromMember(m.data)) allTeamIds.add(t);
  }
  console.log(
    `   discovered ${allTeamIds.size} team(s) across all member histories`,
  );

  // Optionally cap how many past sessions we backfill on first run.
  const pastTeamIds = [...allTeamIds]
    .filter((id) => id !== TEAM_ID)
    .sort((a, b) => b - a); // newest first (id is monotonic)
  const toBackfill =
    MAX_PAST_SESSIONS > 0
      ? pastTeamIds.slice(0, MAX_PAST_SESSIONS)
      : pastTeamIds;

  for (const id of toBackfill) {
    const cached = await cache.read<TeamCacheEntry>("teams", id);
    if (cached) {
      stats.teamsCached++;
      continue;
    }
    try {
      await fetchTeam(page, capture, cache, id, SLUG);
      stats.teamsFetched++;
      console.log(`   ✓ fetched past team #${id}`);
    } catch (e) {
      console.warn(`   ✗ team #${id}: ${(e as Error).message}`);
    }
  }
  console.log();

  // 5. Matches — every match across every cached team.
  console.log("==> backfilling match scoresheets");
  const allMatchIds = new Set<number>();
  for (const teamId of allTeamIds) {
    const t = await cache.read<TeamCacheEntry>("teams", teamId);
    if (!t) continue;
    for (const mid of matchIdsFromTeam(t.data)) allMatchIds.add(mid);
  }
  console.log(`   discovered ${allMatchIds.size} match(es) total`);

  let i = 0;
  for (const id of allMatchIds) {
    i++;
    const cached = await cache.read<MatchCacheEntry>("matches", id);
    if (cached && isMatchFinalized(cached.data)) {
      stats.matchesCached++;
      continue;
    }
    try {
      await fetchMatch(page, capture, cache, id, SLUG);
      stats.matchesFetched++;
      if (i % 10 === 0 || i === allMatchIds.size) {
        console.log(
          `   ✓ ${i}/${allMatchIds.size} (cached=${stats.matchesCached}, fetched=${stats.matchesFetched})`,
        );
      }
    } catch (e) {
      console.warn(`   ✗ match #${id}: ${(e as Error).message}`);
    }
  }
  console.log();

  // 5b. Fetch the division standings for each cached team's division.
  // Always re-fetch the CURRENT division (rankings change weekly); past
  // divisions are immutable once the session ends.
  console.log("==> backfilling division standings");
  const divisionIds = new Set<number>();
  for (const teamId of allTeamIds) {
    const t = await cache.read<TeamCacheEntry>("teams", teamId);
    if (!t) continue;
    const did = divisionIdFromTeam(t.data);
    if (did) divisionIds.add(did);
  }
  console.log(`   discovered ${divisionIds.size} unique division(s)`);
  for (const id of divisionIds) {
    const cached = await cache.read<DivisionCacheEntry>("divisions", id);
    const isCurrentTeamDiv =
      divisionIdFromTeam(currentTeam) === id;
    if (cached && !isCurrentTeamDiv) {
      stats.divisionsCached++;
      continue;
    }
    try {
      await fetchDivision(page, capture, cache, id, SLUG);
      stats.divisionsFetched++;
      console.log(`   ✓ fetched division #${id}`);
    } catch (e) {
      console.warn(`   ✗ division #${id}: ${(e as Error).message}`);
    }
  }
  console.log();

  // 6. Persist meta.
  await cache.writeMeta({
    teamId: TEAM_ID,
    sourceUrl: TEAM_URL,
    leagueSlug: SLUG,
    currentSessionId,
    lastScrapeAt: new Date().toISOString(),
  });

  console.log("== summary ==");
  console.log(
    `  teams:     fetched=${stats.teamsFetched}  cached-hit=${stats.teamsCached}`,
  );
  console.log(
    `  members:   fetched=${stats.membersFetched}  cached-hit=${stats.membersCached}`,
  );
  console.log(
    `  matches:   fetched=${stats.matchesFetched}  cached-hit=${stats.matchesCached}`,
  );
  console.log(
    `  divisions: fetched=${stats.divisionsFetched}  cached-hit=${stats.divisionsCached}`,
  );

  await browser.close();
  console.log("\nNext: run `npm run project` to build data/apa.json from the cache.");
}

function pickSessionId(team: TeamCacheEntry): number | null {
  type Session = { id?: number };
  type Page = { team?: { session?: Session } };
  const id = (team.teamPage as Page).team?.session?.id;
  return typeof id === "number" ? id : null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
