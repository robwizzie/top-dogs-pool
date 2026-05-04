/**
 * Per-entity fetch operations.
 *
 * Each operation:
 *   1. navigates to a URL on league.poolplayers.com
 *   2. waits for the GraphQL queries that page fires
 *   3. extracts the relevant payloads
 *   4. writes them to the cache
 *
 * Returns the data object so callers can chain (e.g. discover related team
 * IDs from a member's session list).
 */
import type { Page } from "playwright";
import type { ApaCache } from "./cache";
import type { GraphqlCapture } from "./capture";

const HOST = "https://league.poolplayers.com";

function leagueSlug(teamUrl: string): string {
  // teamUrl is like https://league.poolplayers.com/southjersey/team/<id>
  const m = new URL(teamUrl).pathname.match(/^\/([^/]+)\//);
  return m ? m[1] : "southjersey";
}

async function navigate(page: Page, url: string) {
  if (page.url() === url) return;
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
}

/* ------------------------------------------------------------------ Team */

export type TeamCacheEntry = {
  teamPage: Record<string, unknown>;
  teamRoster: Record<string, unknown>;
  teamSchedule: Record<string, unknown>;
};

export async function fetchTeam(
  page: Page,
  capture: GraphqlCapture,
  cache: ApaCache,
  teamId: number,
  slug: string,
): Promise<TeamCacheEntry> {
  const teamUrl = `${HOST}/${slug}/team/${teamId}`;
  const startedAt = Date.now();

  // Visit each tab so the matching query fires. Apollo dedupes on the first
  // visit of a session, so we have to navigate to each route to populate.
  for (const u of [
    teamUrl,
    `${teamUrl}/schedule`,
    `${teamUrl}/roster`,
    `${teamUrl}/stats`,
  ]) {
    try {
      await navigate(page, u);
      await page.waitForTimeout(800);
    } catch {
      // Swallow individual tab navigation failures — we'll surface the
      // missing-data error at the end if a critical query never landed.
    }
  }

  const [teamPageOp, teamRosterOp, teamScheduleOp] = await Promise.all([
    capture.waitFor("teamPage", { minCapturedAt: startedAt, timeoutMs: 20_000 }),
    capture.waitFor("teamRoster", { minCapturedAt: startedAt, timeoutMs: 20_000 }),
    capture.waitFor("teamSchedule", { minCapturedAt: startedAt, timeoutMs: 20_000 }),
  ]);

  if (!teamPageOp?.data || !teamRosterOp?.data || !teamScheduleOp?.data) {
    throw new Error(
      `Failed to capture team queries for #${teamId}.  ` +
        `teamPage=${!!teamPageOp?.data} teamRoster=${!!teamRosterOp?.data} teamSchedule=${!!teamScheduleOp?.data}`,
    );
  }

  const entry: TeamCacheEntry = {
    teamPage: teamPageOp.data,
    teamRoster: teamRosterOp.data,
    teamSchedule: teamScheduleOp.data,
  };
  await cache.write("teams", teamId, entry);
  return entry;
}

/* -------------------------------------------------------------- Division */

export type DivisionCacheEntry = {
  /** Full divsionStandings response — list of all teams with standings/points. */
  divsionStandings: Record<string, unknown>;
  /** divisionLayout — division metadata (name/format/session). */
  divisionLayout?: Record<string, unknown>;
};

export async function fetchDivision(
  page: Page,
  capture: GraphqlCapture,
  cache: ApaCache,
  divisionId: string | number,
  slug: string,
): Promise<DivisionCacheEntry> {
  const url = `${HOST}/${slug}/divisions/${divisionId}/standings`;
  const startedAt = Date.now();
  await navigate(page, url);
  await page.waitForTimeout(1500);
  // The standings query is unfortunately named "divsionStandings" (typo) in
  // APA's bundle. Match it verbatim.
  const standings = await capture.waitFor("divsionStandings", {
    minCapturedAt: startedAt,
    timeoutMs: 15_000,
  });
  if (!standings?.data) {
    throw new Error(
      `Failed to capture divsionStandings for division #${divisionId}`,
    );
  }
  const layout = capture.latest("divisionLayout");
  const entry: DivisionCacheEntry = {
    divsionStandings: standings.data,
    divisionLayout: layout?.data ?? undefined,
  };
  await cache.write("divisions", divisionId, entry);
  return entry;
}

/** Pull every team's id from a divsionStandings payload. */
export function teamIdsFromDivision(entry: DivisionCacheEntry): number[] {
  type T = { id?: number };
  type Data = { division?: { teams?: T[] } };
  const data = entry.divsionStandings as Data;
  const out: number[] = [];
  for (const t of data?.division?.teams ?? []) {
    if (typeof t.id === "number") out.push(t.id);
  }
  return out;
}

/* ----------------------------------------------------------------- Match */

export type MatchCacheEntry = {
  match: Record<string, unknown>;
};

export async function fetchMatch(
  page: Page,
  capture: GraphqlCapture,
  cache: ApaCache,
  matchId: string | number,
  slug: string,
): Promise<MatchCacheEntry> {
  const url = `${HOST}/${slug}/match/${matchId}`;
  const startedAt = Date.now();
  await navigate(page, url);
  await page.waitForTimeout(600);
  const op = await capture.waitFor("MatchPage", {
    minCapturedAt: startedAt,
    timeoutMs: 15_000,
  });
  if (!op?.data) {
    throw new Error(`Failed to capture MatchPage for #${matchId}`);
  }
  const matchEntity = (op.data as { match?: Record<string, unknown> }).match;
  if (!matchEntity) {
    throw new Error(`MatchPage data has no 'match' field for #${matchId}`);
  }
  const entry: MatchCacheEntry = { match: matchEntity };
  await cache.write("matches", matchId, entry);
  return entry;
}

/* ---------------------------------------------------------------- Member */

export type MemberCacheEntry = {
  /** AliasSessionStats data — players[].team gives us past team IDs. */
  aliasSessionStats: Record<string, unknown>;
  aliasSessionStatsDropdown?: Record<string, unknown>;
  getEightBallStats?: Record<string, unknown>;
  getMembershipHistory?: Record<string, unknown>;
};

export async function fetchMember(
  page: Page,
  capture: GraphqlCapture,
  cache: ApaCache,
  memberInternalId: string | number,
  slug: string,
): Promise<MemberCacheEntry> {
  const url = `${HOST}/${slug}/member/${memberInternalId}`;
  const startedAt = Date.now();
  await navigate(page, url);
  // Member page fires several queries; give it a bit longer to settle.
  await page.waitForTimeout(1500);

  // The page fires AliasSessionStats twice — once filtered to the current
  // session and once with session=null (all sessions). We want the
  // unfiltered one so we can discover past teams. Pick the response with
  // the most player rows.
  const all = capture.all("AliasSessionStats", { minCapturedAt: startedAt });
  if (all.length === 0) {
    // No response yet — wait for at least one.
    const fallback = await capture.waitFor("AliasSessionStats", {
      minCapturedAt: startedAt,
      timeoutMs: 15_000,
    });
    if (fallback) all.push(fallback);
    // Give it another moment for the second query to land.
    await page.waitForTimeout(1500);
    all.push(...capture.all("AliasSessionStats", { minCapturedAt: startedAt }));
  }
  if (all.length === 0) {
    throw new Error(
      `Failed to capture AliasSessionStats for member #${memberInternalId}`,
    );
  }
  const broadest = all.reduce((best, op) => {
    type Player = { team?: { id?: number } };
    type Data = { alias?: { players?: Player[] } };
    const cur = ((op.data as Data)?.alias?.players ?? []).length;
    const bst = ((best.data as Data)?.alias?.players ?? []).length;
    return cur > bst ? op : best;
  });

  const dropdown = capture.latest("AliasSessionStatsDropdown");
  const eightBallStats = capture.latest("getEightBallStats");
  const membershipHistory = capture.latest("getMembershipHistory");

  const entry: MemberCacheEntry = {
    aliasSessionStats: broadest.data!,
    aliasSessionStatsDropdown: dropdown?.data ?? undefined,
    getEightBallStats: eightBallStats?.data ?? undefined,
    getMembershipHistory: membershipHistory?.data ?? undefined,
  };
  await cache.write("members", memberInternalId, entry);
  return entry;
}

/* ------------------------------------------------------- ID extraction */

/** Pull the internal `member.id` for every roster entry. */
export function memberIdsFromTeam(team: TeamCacheEntry): number[] {
  type Player = {
    member?: { id?: number };
  };
  type RosterTeam = { roster?: Player[] };
  type RosterData = { team?: RosterTeam };
  const data = team.teamRoster as RosterData;
  const ids: number[] = [];
  for (const p of data?.team?.roster ?? []) {
    if (typeof p.member?.id === "number") ids.push(p.member.id);
  }
  return ids;
}

/** Extract every team-id this member has played on (any session, any format). */
export function teamIdsFromMember(member: MemberCacheEntry): number[] {
  type Player = { team?: { id?: number } };
  type Alias = { players?: Player[] };
  type Data = { alias?: Alias };
  const data = member.aliasSessionStats as Data;
  const out = new Set<number>();
  for (const p of data?.alias?.players ?? []) {
    if (typeof p.team?.id === "number") out.add(p.team.id);
  }
  return [...out];
}

/** Pull `team.division.id` from a cached team's teamPage payload. */
export function divisionIdFromTeam(team: TeamCacheEntry): number | null {
  type Page = { team?: { division?: { id?: number } } };
  const id = (team.teamPage as Page).team?.division?.id;
  return typeof id === "number" ? id : null;
}

/** Extract every match-id from the team's schedule. */
export function matchIdsFromTeam(team: TeamCacheEntry): number[] {
  type Match = { id?: number };
  type ScheduleTeam = { matches?: Match[] };
  type Data = { team?: ScheduleTeam };
  const data = team.teamSchedule as Data;
  const out: number[] = [];
  for (const m of data?.team?.matches ?? []) {
    if (typeof m.id === "number") out.push(m.id);
  }
  return out;
}

/** Whether a cached match is finalized (and therefore frozen). */
export function isMatchFinalized(entry: MatchCacheEntry): boolean {
  type M = { isFinalized?: boolean; isBye?: boolean };
  const m = entry.match as M;
  return m.isFinalized === true || m.isBye === true;
}

/**
 * Pull opponent team ids from a cached match. APA stores both teams in
 * `match.matchTeams[].team.id`; we filter out our own team.
 */
export function opponentTeamIdsFromMatch(
  entry: MatchCacheEntry,
  ourTeamId: number,
): number[] {
  type Team = { id?: number };
  type MatchTeam = { team?: Team };
  type M = { matchTeams?: MatchTeam[] };
  const m = entry.match as M;
  const out: number[] = [];
  for (const mt of m.matchTeams ?? []) {
    if (typeof mt.team?.id === "number" && mt.team.id !== ourTeamId) {
      out.push(mt.team.id);
    }
  }
  return out;
}

/** league slug helper exported so the orchestrator can derive it once. */
export { leagueSlug };
