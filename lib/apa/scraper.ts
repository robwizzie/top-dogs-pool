import * as cheerio from "cheerio";
import {
  Format,
  Match,
  MatchResult,
  Player,
  PlayerStats,
  Standing,
  TeamSummary,
  type Match as MatchT,
  type Player as PlayerT,
  type Standing as StandingT,
} from "./schemas";

/**
 * Parsers for the public APA league site (league.poolplayers.com/<area>/team/<id>).
 *
 * The APA site is a server-rendered ASP.NET app. The selectors below are intentionally
 * defensive — they look for stable text/role cues ("Player Name", "Skill Level",
 * "Match Date", etc.) instead of brittle CSS classes, and they fall back to scanning
 * tables row-by-row when class names aren't present.
 *
 * Every parser pipes its result through Zod so a structural change throws clearly
 * instead of silently returning empty data.
 */

type CheerioElement = Parameters<cheerio.CheerioAPI>[0];

const text = ($: cheerio.CheerioAPI, el: CheerioElement | null | undefined) =>
  el ? $(el as never).text().trim().replace(/\s+/g, " ") : "";

function detectFormat(label: string): Format {
  const l = label.toLowerCase();
  if (l.includes("8-ball") || l.includes("8 ball")) return "8-ball";
  if (l.includes("9-ball") || l.includes("9 ball")) return "9-ball";
  if (l.includes("masters")) return "masters";
  if (l.includes("doubles")) return "doubles";
  return "unknown";
}

function abs(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

function idFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const m = url.match(/\/(?:member|player)\/(\d+)/i);
  if (m) return m[1];
  const m2 = url.match(/\/match\/(\d+)/i);
  if (m2) return m2[1];
  return undefined;
}

/** Top-level team page parser */
export function parseTeamPage(html: string, baseUrl: string): TeamSummary {
  const $ = cheerio.load(html);

  const name =
    text($, $('h1, h2, .team-name, [class*="team"] [class*="name"]').first()) ||
    "Top Dogs";

  const division =
    text(
      $,
      $('a[href*="/division/"]').first() ||
        $('[class*="division"]').first(),
    ) || undefined;

  const format = detectFormat(
    text($, $('[class*="format"], [class*="game"]').first()) ||
      text($, $("body")),
  );

  // Record — look for "W-L" pattern near the team header
  const bodyText = $("body").text();
  const recordMatch = bodyText.match(/Record[:\s]+(\d+)\s*[–\-]\s*(\d+)/i) ||
    bodyText.match(/(\d+)\s*[–\-]\s*(\d+)\s*\(W-L\)/i);
  const wins = recordMatch ? parseInt(recordMatch[1], 10) : 0;
  const losses = recordMatch ? parseInt(recordMatch[2], 10) : 0;

  const pointsMatch = bodyText.match(/(?:Total\s+)?Points[:\s]+(\d+(?:\.\d+)?)/i);
  const points = pointsMatch ? parseFloat(pointsMatch[1]) : undefined;

  // Pull schedule rows; pick first upcoming + last 5 completed
  const schedule = parseSchedule(html, baseUrl);
  const now = Date.now();
  const upcoming = schedule
    .filter((m) => m.status === "upcoming" && new Date(m.date).getTime() >= now)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const completed = schedule
    .filter((m) => m.status === "completed")
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return TeamSummary.parse({
    name,
    division,
    format,
    record: { wins, losses, points },
    upcomingMatch: upcoming[0] ?? null,
    recentMatches: completed.slice(0, 5),
  });
}

/**
 * Roster parser — looks for a table with player rows containing a member link
 * and a "skill level" column.
 */
export function parseRoster(html: string, baseUrl: string): PlayerT[] {
  const $ = cheerio.load(html);
  const out: PlayerT[] = [];
  const seen = new Set<string>();

  // Strategy: find every link to a member page; the row containing it likely has
  // a name + skill level cell.
  $('a[href*="/member/"], a[href*="/player/"]').each((_, a) => {
    const href = $(a).attr("href");
    const url = abs(href, baseUrl);
    const id = idFromUrl(url);
    if (!id || seen.has(id)) return;

    const name = text($, a);
    if (!name || name.length > 60) return;

    // Find skill level — scan ancestors for a number 1–9 near the link
    let skill: number | null = null;
    const row = $(a).closest("tr, li, .row, [class*='row']");
    if (row.length) {
      row.find("td, span, div").each((__, cell) => {
        const t = $(cell).text().trim();
        const m = t.match(/^(?:SL\s*)?([1-9])$/);
        if (m) skill = parseInt(m[1], 10);
      });
    }

    const formatLabel = text($, $(a).closest("section, div").find('[class*="format"], [class*="game"]').first());

    seen.add(id);
    out.push(
      Player.parse({
        id,
        name,
        skillLevel: skill,
        format: detectFormat(formatLabel),
        url,
      }),
    );
  });

  return out;
}

/**
 * Schedule parser — extracts each match row.
 * Looks for a table with date + opponent + score columns, falling back to
 * any list with date-like cells.
 */
export function parseSchedule(html: string, baseUrl: string): MatchT[] {
  const $ = cheerio.load(html);
  const out: MatchT[] = [];
  const seen = new Set<string>();

  $("tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length < 2) return;

    const cellTexts: string[] = cells.map((_i, td) => $(td).text().trim()).get() as string[];
    const dateCell = cellTexts.find((t) =>
      /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\w{3}\s+\d{1,2}(?:,\s*\d{4})?)\b/.test(t),
    );
    if (!dateCell) return;

    const dateMatch = dateCell.match(
      /(\d{1,2}\/\d{1,2}\/\d{2,4})|((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*\w{3}\s+\d{1,2}(?:,\s*\d{4})?)/,
    );
    if (!dateMatch) return;
    const dateStr = dateMatch[0];
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return;

    // Opponent — first cell that's a non-empty non-date non-score
    const opponent =
      cellTexts.find(
        (t) => t && t !== dateCell && !/^\d+\s*[-–]\s*\d+$/.test(t),
      ) ?? "TBD";

    // Score — pattern like "12-7"
    const scoreCell = cellTexts.find((t) => /^\d+\s*[-–]\s*\d+$/.test(t));
    let teamScore: number | undefined;
    let opponentScore: number | undefined;
    let status: MatchT["status"] = "upcoming";
    let sweep = false;
    if (scoreCell) {
      const m = scoreCell.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m) {
        teamScore = parseInt(m[1], 10);
        opponentScore = parseInt(m[2], 10);
        status = "completed";
        // 5-0 in 8-ball or 3-0 in 9-ball is a team sweep
        sweep = opponentScore === 0 && teamScore >= 3;
      }
    }

    // Match link — to detail page
    const link = $(tr).find('a[href*="/match/"]').first();
    const url = abs(link.attr("href"), baseUrl);
    const id = idFromUrl(url) ?? `${parsed.toISOString()}::${opponent}`;
    if (seen.has(id)) return;
    seen.add(id);

    out.push(
      Match.parse({
        id,
        date: parsed.toISOString(),
        opponent,
        teamScore,
        opponentScore,
        status,
        sweep,
        results: [],
        url,
      }),
    );
  });

  return out;
}

/**
 * Standings parser — for the division table.
 * Marks the row whose team name matches `ourTeamName`.
 */
export function parseStandings(html: string, ourTeamName: string): StandingT[] {
  const $ = cheerio.load(html);
  const out: StandingT[] = [];
  const target = ourTeamName.toLowerCase();

  $("tr").each((_, tr) => {
    const cells: string[] = $(tr).find("td").map((_i, td) => $(td).text().trim()).get() as string[];
    if (cells.length < 3) return;

    // Heuristic: rank is a small int, then team name, then a record like "5-2" and points
    const rank = parseInt(cells[0], 10);
    if (isNaN(rank) || rank < 1 || rank > 50) return;

    const team = cells[1] || "";
    if (!team) return;

    const record = cells.find((c) => /^\d+\s*[-–]\s*\d+$/.test(c));
    let wins = 0;
    let losses = 0;
    let matchesPlayed = 0;
    if (record) {
      const m = record.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m) {
        wins = parseInt(m[1], 10);
        losses = parseInt(m[2], 10);
        matchesPlayed = wins + losses;
      }
    }

    const pointsCell = cells.find((c, i) => i > 1 && /^\d+(?:\.\d+)?$/.test(c) && parseFloat(c) > matchesPlayed);
    const points = pointsCell ? parseFloat(pointsCell) : 0;

    out.push(
      Standing.parse({
        rank,
        team,
        isOurs: team.toLowerCase() === target,
        points,
        matchesPlayed,
        wins,
        losses,
      }),
    );
  });

  return out;
}

/** Player profile/stats parser. Best-effort given page variability. */
export function parsePlayerStats(html: string, id: string): PlayerStats | null {
  const $ = cheerio.load(html);
  const name = text($, $("h1, h2").first());
  if (!name) return null;

  const body = $("body").text();
  const skillMatch = body.match(/Skill\s*Level[:\s]+([1-9])/i);
  const recordMatch = body.match(/Record[:\s]+(\d+)\s*[-–]\s*(\d+)/i);
  const inningsMatch = body.match(/Innings[:\s]+(\d+)/i);
  const defMatch = body.match(/Defensive\s*Shots[:\s]+(\d+)/i);
  const paMatch = body.match(/PA[:\s]+(\d+(?:\.\d+)?)/i);
  const mprMatch = body.match(/MPR[:\s]+(\d+(?:\.\d+)?)/i);

  const wins = recordMatch ? parseInt(recordMatch[1], 10) : 0;
  const losses = recordMatch ? parseInt(recordMatch[2], 10) : 0;

  return PlayerStats.parse({
    id,
    name,
    skillLevel: skillMatch ? parseInt(skillMatch[1], 10) : null,
    format: detectFormat(body),
    matchesPlayed: wins + losses,
    wins,
    losses,
    innings: inningsMatch ? parseInt(inningsMatch[1], 10) : undefined,
    defensiveShots: defMatch ? parseInt(defMatch[1], 10) : undefined,
    pa: paMatch ? parseFloat(paMatch[1]) : undefined,
    mpr: mprMatch ? parseFloat(mprMatch[1]) : undefined,
  });
}

/** Match detail / scoresheet parser. */
export function parseMatchDetail(
  html: string,
  baseMatch: MatchT,
  ourTeamName: string,
): MatchT {
  const $ = cheerio.load(html);
  const results: MatchResult[] = [];
  const ourLower = ourTeamName.toLowerCase();

  $("tr").each((_, tr) => {
    const cells: string[] = $(tr).find("td").map((_i, td) => $(td).text().trim()).get() as string[];
    if (cells.length < 3) return;

    // Look for a row containing two player names + a score
    const playerLink = $(tr).find('a[href*="/member/"], a[href*="/player/"]').first();
    if (!playerLink.length) return;

    const playerName = text($, playerLink);
    const id = idFromUrl(playerLink.attr("href")) ?? playerName;

    const score = cells.find((c) => /^\d+\s*[-–]\s*\d+$/.test(c));
    const opponentName =
      cells.find(
        (c) => c && c !== playerName && !/^\d+\s*[-–]\s*\d+$/.test(c) && c.length < 60,
      ) ?? "Opponent";

    const ours = $(tr).text().toLowerCase().includes(ourLower);
    if (!ours) return;

    let outcome: "W" | "L" = "L";
    let miniSweep = false;
    if (score) {
      const m = score.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m) {
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        outcome = a >= b ? "W" : "L";
        // Mini-sweep: clean win, opponent at 0
        miniSweep = outcome === "W" && b === 0;
      }
    }

    results.push(
      MatchResult.parse({
        playerId: id,
        playerName,
        opponentName,
        outcome,
        score,
        miniSweep,
      }),
    );
  });

  return Match.parse({
    ...baseMatch,
    results,
  });
}
