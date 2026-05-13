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
 *   APA_TEAM_URL                 — current team URL (defaults to Top Dawgs)
 *   APA_HEADFUL=1                — visible browser (debug)
 *   APA_MEMBER_TTL_DAYS=7        — re-fetch members older than N days
 *   APA_OPPONENT_TTL_DAYS=5      — re-fetch opp teams older than N days
 *   APA_MAX_PAST_SESSIONS=N      — cap past-team backfill (default: all)
 *   APA_MAX_OPP_PAST_SESSIONS=3  — cap opp past-team backfill per member
 *   APA_TIME_BUDGET_MIN=45       — soft wall-clock cap; long-tail steps
 *                                  bail at this point so partial progress
 *                                  is committed (next run resumes). 0 disables.
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
  opponentTeamIdsFromMatch,
  teamIdsFromMember,
  teamNumberFromTeam,
  teamsFromMember,
  type DivisionCacheEntry,
  type MatchCacheEntry,
  type MemberCacheEntry,
  type TeamCacheEntry,
} from "./scraper/operations";

loadEnv({ path: ".env.local" });
loadEnv();

// Default URL is just a seed; the scraper auto-pivots to the newest-session
// team via the persistent team `number` (see auto-pivot block in main()).
const TEAM_URL =
  process.env.APA_TEAM_URL ??
  "https://league.poolplayers.com/southjersey/team/13022793";
const USERNAME = process.env.APA_USERNAME;
const PASSWORD = process.env.APA_PASSWORD;
const HEADFUL = process.env.APA_HEADFUL === "1";
const MEMBER_TTL =
  parseInt(process.env.APA_MEMBER_TTL_DAYS ?? "7", 10) * ONE_DAY;
const MAX_PAST_SESSIONS = parseInt(process.env.APA_MAX_PAST_SESSIONS ?? "0", 10);
// Opponent teams are re-fetched more often than past teams since their
// roster + record changes weekly during the active session.
const OPPONENT_TTL = parseInt(process.env.APA_OPPONENT_TTL_DAYS ?? "5", 10) * ONE_DAY;
// Wall-clock budget. The scrape always saves to cache as it goes, so a
// partial run is still useful — subsequent runs pick up where this one
// stopped. Default 45 min keeps GitHub Actions' 60-min cap from killing us
// mid-write. Set APA_TIME_BUDGET_MIN=0 to disable the soft cap entirely.
const TIME_BUDGET_MS =
  parseInt(process.env.APA_TIME_BUDGET_MIN ?? "45", 10) * 60 * 1000;
const startedAt = Date.now();
const budgetExceeded = () =>
  TIME_BUDGET_MS > 0 && Date.now() - startedAt > TIME_BUDGET_MS;

// `let` because we may pivot to a newer-session team id if APA has rolled
// over into the next session. See "auto-pivot" block in main() below.
let TEAM_ID = (() => {
  const m = TEAM_URL.match(/\/team\/(\d+)/);
  if (!m) throw new Error(`Cannot parse team id from APA_TEAM_URL: ${TEAM_URL}`);
  return parseInt(m[1], 10);
})();
let TEAM_URL_RESOLVED = TEAM_URL;
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

  const refreshMembers = async (ids: number[]) => {
    for (const id of ids) {
      const cached = await cache.read<MemberCacheEntry>("members", id);
      // A cached file from before the MVP scraper migration won't carry a
      // `memberTeams` field — force a re-fetch in that case so we pick up
      // the Teams-page payload exactly once. After the migration the field
      // is always at least an empty object, so this check is idempotent.
      const missingTeamsCapture =
        cached !== null && cached.data.memberTeams === undefined;
      const stale =
        !cached || olderThan(cached, MEMBER_TTL) || missingTeamsCapture;
      if (!stale) {
        stats.membersCached++;
        console.log(`   · member #${id} cached`);
        continue;
      }
      if (missingTeamsCapture) {
        console.log(`   ↻ member #${id} missing memberTeams — re-fetching`);
      }
      try {
        await fetchMember(page, capture, cache, id, SLUG);
        stats.membersFetched++;
        console.log(`   ✓ fetched member #${id}`);
      } catch (e) {
        console.warn(`   ✗ member #${id}: ${(e as Error).message}`);
      }
    }
  };

  // 2. Always re-fetch the CURRENT team.
  console.log("==> fetching current team");
  let currentTeam = await fetchTeam(page, capture, cache, TEAM_ID, SLUG);
  stats.teamsFetched++;
  let currentSessionId = pickSessionId(currentTeam);
  console.log(
    `   ✓ team #${TEAM_ID}, session=${currentSessionId ?? "?"}, ${memberIdsFromTeam(currentTeam).length} roster\n`,
  );

  // 3. Members — fetch any whose cache is missing or stale.
  console.log("==> ensuring member data is fresh");
  let memberIds = memberIdsFromTeam(currentTeam);
  await refreshMembers(memberIds);
  console.log();

  // 3b. Auto-pivot to a newer session if APA has rolled the team forward.
  //
  // The configured APA_TEAM_URL may point at a team id that's now in a
  // past session (the team got a fresh `team/<id>` URL for the new
  // session). The team `number` (e.g. "06806") is persistent across
  // sessions, so we can scan every roster member's alias data for newer
  // entries with the same `team.number` — if found, that's the new
  // current team. Pivot, re-fetch its roster, and continue as if it had
  // been configured directly.
  //
  // Without this, scrapes silently keep refreshing the old (finalized)
  // team forever and never pick up the new session's schedule.
  const ourTeamNumber = teamNumberFromTeam(currentTeam);
  if (ourTeamNumber) {
    let newestId = TEAM_ID;
    for (const id of memberIds) {
      const m = await cache.read<MemberCacheEntry>("members", id);
      if (!m) continue;
      for (const t of teamsFromMember(m.data)) {
        if (t.number === ourTeamNumber && t.id > newestId) newestId = t.id;
      }
    }
    if (newestId !== TEAM_ID) {
      console.log(
        `==> detected newer session: pivoting current team #${TEAM_ID} → #${newestId} (team number ${ourTeamNumber})`,
      );
      TEAM_ID = newestId;
      TEAM_URL_RESOLVED = `https://league.poolplayers.com/${SLUG}/team/${TEAM_ID}`;
      currentTeam = await fetchTeam(page, capture, cache, TEAM_ID, SLUG);
      stats.teamsFetched++;
      currentSessionId = pickSessionId(currentTeam);
      memberIds = memberIdsFromTeam(currentTeam);
      console.log(
        `   ✓ pivoted to team #${TEAM_ID}, session=${currentSessionId ?? "?"}, ${memberIds.length} roster`,
      );
      console.log("==> ensuring new-session member data is fresh");
      await refreshMembers(memberIds);
      console.log();
    }
  }

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

  // 5c. Opponent teams in our CURRENT-session schedule.
  //
  // For every team we're scheduled to play this session, fetch their full
  // team profile (roster + their schedule + record). Then for each of their
  // roster members, fetch career stats (TTL-gated). This builds up an
  // incremental knowledge base of opposing teams over the season — re-run
  // weekly to keep the upcoming opponent fresh, and the rest of the
  // division backfills naturally.
  console.log("==> fetching opponent teams from our schedule");
  const ourScheduleMatchIds = matchIdsFromTeam(currentTeam);
  const opponentTeamIds = new Set<number>();
  for (const mid of ourScheduleMatchIds) {
    const m = await cache.read<MatchCacheEntry>("matches", mid);
    if (!m) continue;
    for (const oid of opponentTeamIdsFromMatch(m.data, TEAM_ID)) {
      opponentTeamIds.add(oid);
    }
  }
  console.log(
    `   discovered ${opponentTeamIds.size} opponent team(s) in this session's schedule`,
  );

  // Opponent teams: refresh on a 5-day TTL. The CURRENT opponent (next
  // scheduled match) is fetched first so it's always populated even if the
  // wall-clock budget cuts the rest off. Past-team backfill from member
  // histories already covered the once-and-done case; this loop keeps
  // active opponents current.
  //
  // Determine the next scheduled opponent first so we prioritize them.
  const nextOpponentTeamId = (() => {
    type ScheduleMatch = {
      id?: number;
      isFinalized?: boolean;
      isBye?: boolean;
      startTime?: string;
      home?: { id?: number };
      away?: { id?: number };
    };
    type ScheduleShape = { team?: { matches?: ScheduleMatch[] } };
    const sched = (currentTeam.teamSchedule as ScheduleShape).team?.matches ?? [];
    const upcoming = sched
      .filter((m) => !m.isFinalized && !m.isBye && m.startTime)
      .sort(
        (a, b) =>
          +new Date(a.startTime ?? 0) - +new Date(b.startTime ?? 0),
      );
    for (const m of upcoming) {
      const oid =
        m.home?.id === TEAM_ID ? m.away?.id : m.away?.id === TEAM_ID ? m.home?.id : null;
      if (typeof oid === "number") return oid;
    }
    return null;
  })();
  const orderedOppTeamIds = [...opponentTeamIds].sort((a, b) => {
    if (a === nextOpponentTeamId) return -1;
    if (b === nextOpponentTeamId) return 1;
    return 0;
  });
  const opponentMemberIds = new Set<number>();
  let oppTeamsSkipped = 0;
  for (const oid of orderedOppTeamIds) {
    if (oid === TEAM_ID) continue;
    if (budgetExceeded()) {
      oppTeamsSkipped++;
      continue;
    }
    const cached = await cache.read<TeamCacheEntry>("teams", oid);
    const stale = !cached || olderThan(cached, OPPONENT_TTL);
    let teamEntry: TeamCacheEntry | null = cached?.data ?? null;
    if (!stale) {
      stats.teamsCached++;
    } else {
      try {
        teamEntry = await fetchTeam(page, capture, cache, oid, SLUG);
        stats.teamsFetched++;
        console.log(`   ✓ fetched opp team #${oid}`);
      } catch (e) {
        console.warn(`   ✗ opp team #${oid}: ${(e as Error).message}`);
      }
    }
    if (!teamEntry) continue;
    for (const mid of memberIdsFromTeam(teamEntry)) opponentMemberIds.add(mid);
  }
  if (oppTeamsSkipped > 0) {
    console.log(
      `   ⏱  budget exceeded — skipped ${oppTeamsSkipped} opp team(s); they'll be picked up next run`,
    );
  }
  console.log();

  // 5d. Opponent members — same TTL as our roster. Skipped entirely once
  // we hit the time budget; partial-cache state is still useful (current
  // opp's members have already been collected from step 5c above).
  console.log("==> fetching opponent members");
  console.log(
    `   ${opponentMemberIds.size} unique opp member(s) discovered`,
  );
  let oppMembersSkipped = 0;
  for (const id of opponentMemberIds) {
    if (budgetExceeded()) {
      oppMembersSkipped++;
      continue;
    }
    const cached = await cache.read<MemberCacheEntry>("members", id);
    const stale = !cached || olderThan(cached, MEMBER_TTL);
    if (!stale) {
      stats.membersCached++;
      continue;
    }
    try {
      await fetchMember(page, capture, cache, id, SLUG);
      stats.membersFetched++;
      console.log(`   ✓ fetched opp member #${id}`);
    } catch (e) {
      console.warn(`   ✗ opp member #${id}: ${(e as Error).message}`);
    }
  }
  if (oppMembersSkipped > 0) {
    console.log(
      `   ⏱  budget exceeded — skipped ${oppMembersSkipped} opp member(s); they'll be picked up next run`,
    );
  }
  console.log();

  // 5e. Opp-member past-team backfill.
  //
  // Without this, the projector can't map an opp player's session history:
  // their per-team `aliasSessionStats` entries reference team ids whose
  // sessions we haven't cached, so we drop the rows. Result: empty career
  // + empty SL trajectory in the scouting report.
  //
  // Fix: walk each opp member's history, queue every team id we haven't
  // already cached, fetch them. Capped by APA_MAX_OPP_PAST_SESSIONS (low
  // default since this is the long tail and respects no TTL — once cached,
  // never re-fetched). Bails entirely once the wall-clock budget runs out.
  const MAX_OPP_PAST_SESSIONS = parseInt(
    process.env.APA_MAX_OPP_PAST_SESSIONS ?? "3",
    10,
  );
  console.log("==> backfilling opp members' past teams");
  const oppPastTeamIds = new Set<number>();
  for (const memberId of opponentMemberIds) {
    const m = await cache.read<MemberCacheEntry>("members", memberId);
    if (!m) continue;
    for (const t of teamIdsFromMember(m.data)) oppPastTeamIds.add(t);
  }
  // Skip teams already cached (incl. current opp teams) and our own.
  const toBackfillOpp = [...oppPastTeamIds]
    .filter((id) => id !== TEAM_ID && !allTeamIds.has(id) && !opponentTeamIds.has(id))
    .sort((a, b) => b - a) // newest first
    .slice(0, MAX_OPP_PAST_SESSIONS * Math.max(1, opponentMemberIds.size));
  console.log(
    `   ${oppPastTeamIds.size} past team(s) referenced; backfilling up to ${toBackfillOpp.length}`,
  );
  let oppPastSkipped = 0;
  for (const id of toBackfillOpp) {
    if (budgetExceeded()) {
      oppPastSkipped++;
      continue;
    }
    const cached = await cache.read<TeamCacheEntry>("teams", id);
    if (cached) {
      stats.teamsCached++;
      continue;
    }
    try {
      await fetchTeam(page, capture, cache, id, SLUG);
      stats.teamsFetched++;
      console.log(`   ✓ fetched opp past team #${id}`);
    } catch (e) {
      console.warn(`   ✗ opp past team #${id}: ${(e as Error).message}`);
    }
  }
  if (oppPastSkipped > 0) {
    console.log(
      `   ⏱  budget exceeded — skipped ${oppPastSkipped} past team(s); they'll be picked up next run`,
    );
  }
  const elapsedMin = (Date.now() - startedAt) / 60000;
  console.log(`   total scrape time so far: ${elapsedMin.toFixed(1)} min`);
  console.log();

  // 6. Persist meta.
  await cache.writeMeta({
    teamId: TEAM_ID,
    sourceUrl: TEAM_URL_RESOLVED,
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
