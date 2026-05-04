/**
 * Team research / analytics.
 *
 * Pure functions over the snapshot's matches map. Each helper takes the set
 * of in-scope matches (already filtered by session) plus the active roster,
 * and returns a structured insight ready for the Research page.
 *
 * "Lineup" = the unordered set of 5 player ids that played a given match.
 * "Order" = the per-position assignment (matchPosition 1..5).
 */
import type { Match, MatchResult, Player } from "@/lib/apa/schemas";
import { winsRequired } from "@/lib/apa/race";

/* ---------------------------------------------------------------- helpers */

function pointsForResult(r: MatchResult): number {
  let p = 0;
  if (r.sweep) p += 1;
  else if (r.miniSweep) p += 0.5;
  if (r.breakAndRun) p += 1;
  if (r.eightOnBreak) p += 1;
  return p;
}

function lineupKey(results: MatchResult[]): string {
  return results
    .map((r) => r.playerId)
    .filter((id) => !id.startsWith("ebp:"))
    .sort()
    .join("+");
}

function safeRate(num: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((num / denom) * 1000) / 10;
}

/**
 * Exponential-decay recency weight. Match played `date` is weighted relative
 * to `refDate`, with the given half-life: a match exactly half-life-old gets
 * weight 0.5, twice half-life gets 0.25, etc. Newer than refDate → 1.
 */
export function recencyWeight(
  date: string,
  refDate: Date = new Date(),
  halfLifeDays = 90,
): number {
  const ageMs = refDate.getTime() - new Date(date).getTime();
  if (ageMs <= 0) return 1;
  const ageDays = ageMs / 86_400_000;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/* ---------------------------------------------------------------- summary */

export type TeamSummaryInsight = {
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  totalPlayerMatches: number;
  totalPlayerWins: number;
  playerWinPct: number;
  totalSweeps: number;
  totalMiniSweeps: number;
  totalBreakAndRuns: number;
  totalEightOnBreaks: number;
  averagePointsScored: number;
  averagePointsConceded: number;
};

export function teamSummary(matches: Match[]): TeamSummaryInsight {
  const completed = matches.filter((m) => m.status === "completed");
  let wins = 0,
    losses = 0,
    ties = 0,
    pts = 0,
    oppPts = 0;
  for (const m of completed) {
    if (m.teamScore === undefined || m.opponentScore === undefined) continue;
    pts += m.teamScore;
    oppPts += m.opponentScore;
    if (m.teamScore > m.opponentScore) wins++;
    else if (m.teamScore < m.opponentScore) losses++;
    else ties++;
  }
  let totalPlayerMatches = 0,
    totalPlayerWins = 0,
    sweeps = 0,
    mini = 0,
    br = 0,
    eob = 0;
  for (const m of completed) {
    for (const r of m.results) {
      totalPlayerMatches++;
      if (r.outcome === "W") totalPlayerWins++;
      if (r.sweep) sweeps++;
      if (r.miniSweep) mini++;
      if (r.breakAndRun) br++;
      if (r.eightOnBreak) eob++;
    }
  }
  return {
    matchesPlayed: completed.length,
    wins,
    losses,
    ties,
    winPct: safeRate(wins, wins + losses),
    totalPlayerMatches,
    totalPlayerWins,
    playerWinPct: safeRate(totalPlayerWins, totalPlayerMatches),
    totalSweeps: sweeps,
    totalMiniSweeps: mini,
    totalBreakAndRuns: br,
    totalEightOnBreaks: eob,
    averagePointsScored: completed.length
      ? Math.round((pts / completed.length) * 10) / 10
      : 0,
    averagePointsConceded: completed.length
      ? Math.round((oppPts / completed.length) * 10) / 10
      : 0,
  };
}

/* ---------------------------------------------------------------- lineups */

export type LineupRow = {
  playerIds: string[];
  playerNames: string[];
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  pointsScored: number;
  pointsConceded: number;
  pointDiff: number;
  individualPoints: number; // sum of leaderboard points earned by the lineup
};

export function lineupBreakdown(
  matches: Match[],
  nameLookup: Map<string, string>,
): LineupRow[] {
  const buckets = new Map<string, LineupRow>();
  for (const m of matches) {
    if (m.status !== "completed") continue;
    if (m.results.length !== 5) continue;
    const key = lineupKey(m.results);
    if (!key) continue;
    const ids = key.split("+");
    if (ids.length !== 5) continue;

    let row = buckets.get(key);
    if (!row) {
      row = {
        playerIds: ids,
        playerNames: ids.map((id) => nameLookup.get(id) ?? id),
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winPct: 0,
        pointsScored: 0,
        pointsConceded: 0,
        pointDiff: 0,
        individualPoints: 0,
      };
      buckets.set(key, row);
    }
    row.matchesPlayed++;
    if (
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number"
    ) {
      if (m.teamScore > m.opponentScore) row.wins++;
      else if (m.teamScore < m.opponentScore) row.losses++;
      row.pointsScored += m.teamScore;
      row.pointsConceded += m.opponentScore;
    }
    for (const r of m.results) row.individualPoints += pointsForResult(r);
  }
  for (const row of buckets.values()) {
    row.winPct = safeRate(row.wins, row.wins + row.losses);
    row.pointDiff = row.pointsScored - row.pointsConceded;
  }
  return [...buckets.values()].sort(
    (a, b) =>
      b.wins - a.wins ||
      b.pointsScored - a.pointsScored ||
      b.matchesPlayed - a.matchesPlayed,
  );
}

/* ----------------------------------------------------- per-position table */

export type PositionRow = {
  playerId: string;
  playerName: string;
  // index 0 unused; positions[1..5] = { matches, wins }
  positions: Array<{ matches: number; wins: number; winPct: number } | null>;
  totalMatches: number;
  totalWins: number;
  bestPosition: number | null;
  bestPositionWinPct: number;
};

export function positionPerformance(
  matches: Match[],
  roster: Player[],
): PositionRow[] {
  const acc = new Map<string, PositionRow>();
  for (const p of roster) {
    if (p.visible === false) continue;
    acc.set(p.id, {
      playerId: p.id,
      playerName: p.name,
      positions: [
        null,
        { matches: 0, wins: 0, winPct: 0 },
        { matches: 0, wins: 0, winPct: 0 },
        { matches: 0, wins: 0, winPct: 0 },
        { matches: 0, wins: 0, winPct: 0 },
        { matches: 0, wins: 0, winPct: 0 },
      ],
      totalMatches: 0,
      totalWins: 0,
      bestPosition: null,
      bestPositionWinPct: 0,
    });
  }
  for (const m of matches) {
    if (m.status !== "completed") continue;
    for (const r of m.results) {
      if (!r.matchPosition || r.matchPosition < 1 || r.matchPosition > 5)
        continue;
      const row = acc.get(r.playerId);
      if (!row) continue;
      const slot = row.positions[r.matchPosition]!;
      slot.matches += 1;
      row.totalMatches += 1;
      if (r.outcome === "W") {
        slot.wins += 1;
        row.totalWins += 1;
      }
    }
  }
  for (const row of acc.values()) {
    let bestPos: number | null = null;
    let bestRate = -1;
    for (let i = 1; i <= 5; i++) {
      const slot = row.positions[i];
      if (!slot) continue;
      slot.winPct = safeRate(slot.wins, slot.matches);
      if (slot.matches >= 2 && slot.winPct > bestRate) {
        bestRate = slot.winPct;
        bestPos = i;
      }
    }
    row.bestPosition = bestPos;
    row.bestPositionWinPct = bestPos ? bestRate : 0;
  }
  return [...acc.values()].sort((a, b) => b.totalWins - a.totalWins);
}

/* ------------------------------------------------------- vs opponent team */

export type OpponentRow = {
  opponent: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsScored: number;
  pointsConceded: number;
};

export function vsOpponents(matches: Match[]): OpponentRow[] {
  const buckets = new Map<string, OpponentRow>();
  for (const m of matches) {
    if (m.status !== "completed") continue;
    if (m.opponent === "BYE") continue;
    let row = buckets.get(m.opponent);
    if (!row) {
      row = {
        opponent: m.opponent,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        winPct: 0,
        pointsScored: 0,
        pointsConceded: 0,
      };
      buckets.set(m.opponent, row);
    }
    row.matchesPlayed++;
    if (
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number"
    ) {
      row.pointsScored += m.teamScore;
      row.pointsConceded += m.opponentScore;
      if (m.teamScore > m.opponentScore) row.wins++;
      else if (m.teamScore < m.opponentScore) row.losses++;
      else row.ties++;
    }
  }
  for (const row of buckets.values())
    row.winPct = safeRate(row.wins, row.wins + row.losses);
  return [...buckets.values()].sort(
    (a, b) =>
      b.matchesPlayed - a.matchesPlayed || b.winPct - a.winPct,
  );
}

/* -------------------------------------------------------- home vs away */

export type SplitRow = {
  homeMatches: number;
  homeWins: number;
  homeLosses: number;
  homeWinPct: number;
  homePointsAvg: number;
  awayMatches: number;
  awayWins: number;
  awayLosses: number;
  awayWinPct: number;
  awayPointsAvg: number;
};

export function homeAwaySplit(matches: Match[]): SplitRow {
  let hM = 0,
    hW = 0,
    hL = 0,
    hP = 0;
  let aM = 0,
    aW = 0,
    aL = 0,
    aP = 0;
  for (const m of matches) {
    if (m.status !== "completed") continue;
    if (typeof m.teamScore !== "number" || typeof m.opponentScore !== "number")
      continue;
    if (m.isHome === true) {
      hM++;
      hP += m.teamScore;
      if (m.teamScore > m.opponentScore) hW++;
      else if (m.teamScore < m.opponentScore) hL++;
    } else if (m.isHome === false) {
      aM++;
      aP += m.teamScore;
      if (m.teamScore > m.opponentScore) aW++;
      else if (m.teamScore < m.opponentScore) aL++;
    }
  }
  return {
    homeMatches: hM,
    homeWins: hW,
    homeLosses: hL,
    homeWinPct: safeRate(hW, hW + hL),
    homePointsAvg: hM ? Math.round((hP / hM) * 10) / 10 : 0,
    awayMatches: aM,
    awayWins: aW,
    awayLosses: aL,
    awayWinPct: safeRate(aW, aW + aL),
    awayPointsAvg: aM ? Math.round((aP / aM) * 10) / 10 : 0,
  };
}

/* ----------------------------------------------------- vs skill-level grid */

export type SkillRow = {
  playerId: string;
  playerName: string;
  // bySL[2..7] = { matches, wins, winPct }
  bySL: Record<number, { matches: number; wins: number; winPct: number }>;
};

export function vsSkillLevelTable(
  matches: Match[],
  roster: Player[],
): SkillRow[] {
  const acc = new Map<string, SkillRow>();
  for (const p of roster) {
    if (p.visible === false) continue;
    acc.set(p.id, {
      playerId: p.id,
      playerName: p.name,
      bySL: Object.fromEntries(
        [2, 3, 4, 5, 6, 7].map((sl) => [sl, { matches: 0, wins: 0, winPct: 0 }]),
      ),
    });
  }
  for (const m of matches) {
    if (m.status !== "completed") continue;
    for (const r of m.results) {
      const row = acc.get(r.playerId);
      if (!row) continue;
      const oppSL = r.opponentSkillLevel;
      if (typeof oppSL !== "number" || oppSL < 2 || oppSL > 7) continue;
      const cell = row.bySL[oppSL];
      cell.matches++;
      if (r.outcome === "W") cell.wins++;
    }
  }
  for (const row of acc.values()) {
    for (const sl of [2, 3, 4, 5, 6, 7]) {
      const cell = row.bySL[sl];
      cell.winPct = safeRate(cell.wins, cell.matches);
    }
  }
  return [...acc.values()];
}

/* --------------------------------------------------- form / current streak */

export type FormRow = {
  playerId: string;
  playerName: string;
  recent: ("W" | "L")[]; // newest-first, up to 10
  currentStreak: { type: "W" | "L"; length: number } | null;
  longestWinStreak: number;
  longestLossStreak: number;
  last10WinPct: number;
};

export function playerForm(
  matches: Match[],
  roster: Player[],
): FormRow[] {
  // Sort matches oldest → newest so streaks build correctly.
  const sorted = [...matches]
    .filter((m) => m.status === "completed")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const result: FormRow[] = [];
  for (const p of roster) {
    if (p.visible === false) continue;
    const outcomes: ("W" | "L")[] = [];
    for (const m of sorted) {
      for (const r of m.results) {
        if (r.playerId !== p.id) continue;
        outcomes.push(r.outcome);
      }
    }
    if (outcomes.length === 0) {
      result.push({
        playerId: p.id,
        playerName: p.name,
        recent: [],
        currentStreak: null,
        longestWinStreak: 0,
        longestLossStreak: 0,
        last10WinPct: 0,
      });
      continue;
    }
    let lWS = 0,
      lLS = 0,
      curW = 0,
      curL = 0;
    for (const o of outcomes) {
      if (o === "W") {
        curW++;
        curL = 0;
        if (curW > lWS) lWS = curW;
      } else {
        curL++;
        curW = 0;
        if (curL > lLS) lLS = curL;
      }
    }
    const last = outcomes[outcomes.length - 1];
    let streakLen = 0;
    for (let i = outcomes.length - 1; i >= 0; i--) {
      if (outcomes[i] !== last) break;
      streakLen++;
    }
    const recent = outcomes.slice(-10).reverse();
    const last10 = outcomes.slice(-10);
    const last10W = last10.filter((o) => o === "W").length;
    result.push({
      playerId: p.id,
      playerName: p.name,
      recent,
      currentStreak: { type: last, length: streakLen },
      longestWinStreak: lWS,
      longestLossStreak: lLS,
      last10WinPct: safeRate(last10W, last10.length),
    });
  }
  return result;
}

/* --------------------------------------------- recommended starting five */

export type Recommendation = {
  /** Ordered list of recommendations: best player at position 1..5. */
  byPosition: Array<{
    position: number;
    playerId: string;
    playerName: string;
    winPct: number;
    matches: number;
  } | null>;
  /** Best 5 unique players, ordered by their ideal position. */
  pickedFive: Array<{ position: number; playerId: string; playerName: string; winPct: number }>;
};

/**
 * Cheap heuristic — for each position, pick the available roster member with
 * the highest win rate at that position (min 2 matches). Greedy: each player
 * can fill at most one position; ties broken by total matches and overall winPct.
 */
export function suggestedLineup(
  positions: PositionRow[],
): Recommendation {
  const used = new Set<string>();
  const byPosition: Recommendation["byPosition"] = [null, null, null, null, null, null];
  // Process positions in order of how strong the best candidate is.
  type Candidate = {
    position: number;
    playerId: string;
    playerName: string;
    winPct: number;
    matches: number;
  };
  const positionCandidates: Array<Candidate[]> = [
    [],
    [],
    [],
    [],
    [],
    [],
  ];
  for (const row of positions) {
    for (let pos = 1; pos <= 5; pos++) {
      const slot = row.positions[pos];
      if (!slot || slot.matches < 2) continue;
      positionCandidates[pos].push({
        position: pos,
        playerId: row.playerId,
        playerName: row.playerName,
        winPct: slot.winPct,
        matches: slot.matches,
      });
    }
  }
  for (const list of positionCandidates) {
    list.sort((a, b) => b.winPct - a.winPct || b.matches - a.matches);
  }
  // Greedy by best position-by-position rate.
  const order = [1, 2, 3, 4, 5].sort((a, b) => {
    const ta = positionCandidates[a][0]?.winPct ?? -1;
    const tb = positionCandidates[b][0]?.winPct ?? -1;
    return tb - ta;
  });
  for (const pos of order) {
    const cand = positionCandidates[pos].find((c) => !used.has(c.playerId));
    if (cand) {
      used.add(cand.playerId);
      byPosition[pos] = cand;
    }
  }
  const pickedFive = byPosition
    .filter((c): c is Candidate => !!c)
    .sort((a, b) => a.position - b.position);
  return { byPosition, pickedFive };
}

/* ---------------------------------------------- player reliability ranking */

export type ReliabilityRow = {
  playerId: string;
  playerName: string;
  matches: number;
  wins: number;
  winPct: number;
  /** Score = winPct (0-100) × log(1+matches) — favors both high win rate and volume. */
  score: number;
};

export function reliabilityRanking(
  matches: Match[],
  roster: Player[],
): ReliabilityRow[] {
  const acc = new Map<string, ReliabilityRow>();
  for (const p of roster) {
    if (p.visible === false) continue;
    acc.set(p.id, {
      playerId: p.id,
      playerName: p.name,
      matches: 0,
      wins: 0,
      winPct: 0,
      score: 0,
    });
  }
  for (const m of matches) {
    if (m.status !== "completed") continue;
    for (const r of m.results) {
      const row = acc.get(r.playerId);
      if (!row) continue;
      row.matches++;
      if (r.outcome === "W") row.wins++;
    }
  }
  for (const row of acc.values()) {
    row.winPct = safeRate(row.wins, row.matches);
    row.score = Math.round(row.winPct * Math.log(1 + row.matches) * 10) / 10;
  }
  return [...acc.values()].sort((a, b) => b.score - a.score);
}

/* ============================================================ NEW ============== */

/* ----------------------------------------------------------- hot / cold */

export type HotColdRow = {
  playerId: string;
  playerName: string;
  recentMatches: number;
  recentWinPct: number;
  baselineMatches: number;
  baselineWinPct: number;
  delta: number; // recent - baseline
  status: "hot" | "cold" | "steady";
};

/**
 * Compare last-N match win % vs the rest of their record. Players with at
 * least `minRecent` recent matches and a noticeable delta show up as hot
 * (above baseline) or cold (below). Defaults: window=10, threshold=±15.
 */
export function hotColdPlayers(
  matches: Match[],
  roster: Player[],
  opts: { window?: number; threshold?: number; minRecent?: number } = {},
): HotColdRow[] {
  const window = opts.window ?? 10;
  const threshold = opts.threshold ?? 15;
  const minRecent = opts.minRecent ?? 5;
  const sorted = [...matches]
    .filter((m) => m.status === "completed")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const result: HotColdRow[] = [];
  for (const p of roster) {
    if (p.visible === false) continue;
    const outcomes: ("W" | "L")[] = [];
    for (const m of sorted) {
      for (const r of m.results) {
        if (r.playerId !== p.id) continue;
        outcomes.push(r.outcome);
      }
    }
    const recent = outcomes.slice(-window);
    const baseline = outcomes.slice(0, -window);
    if (recent.length < minRecent) {
      result.push({
        playerId: p.id,
        playerName: p.name,
        recentMatches: recent.length,
        recentWinPct: safeRate(
          recent.filter((o) => o === "W").length,
          recent.length,
        ),
        baselineMatches: baseline.length,
        baselineWinPct: safeRate(
          baseline.filter((o) => o === "W").length,
          baseline.length,
        ),
        delta: 0,
        status: "steady",
      });
      continue;
    }
    const recentWinPct = safeRate(
      recent.filter((o) => o === "W").length,
      recent.length,
    );
    // Baseline = career outside the recency window. If they've played few
    // earlier matches, fall back to the entire body of work.
    const baselineSource = baseline.length >= 5 ? baseline : outcomes;
    const baselineWinPct = safeRate(
      baselineSource.filter((o) => o === "W").length,
      baselineSource.length,
    );
    const delta = Math.round((recentWinPct - baselineWinPct) * 10) / 10;
    const status: HotColdRow["status"] =
      delta >= threshold ? "hot" : delta <= -threshold ? "cold" : "steady";
    result.push({
      playerId: p.id,
      playerName: p.name,
      recentMatches: recent.length,
      recentWinPct,
      baselineMatches: baselineSource === outcomes ? outcomes.length : baseline.length,
      baselineWinPct,
      delta,
      status,
    });
  }
  return result.sort((a, b) => b.delta - a.delta);
}

/* -------------------------------------------------------- player chemistry */

export type ChemistryRow = {
  pair: [string, string]; // playerIds
  pairNames: [string, string];
  togetherMatches: number;
  togetherTeamWins: number;
  togetherTeamLosses: number;
  togetherWinPct: number;
  /**
   * Lift = together win % minus the average of each player's solo team-win %
   * (matches that included one but not the other). Positive means the duo
   * outperforms either alone.
   */
  lift: number;
};

/**
 * Each pair of current Top Dogs members → team match record when both played
 * together. Lift compares vs the average of their solo (only-one-of-them)
 * records.
 */
export function playerChemistry(
  matches: Match[],
  roster: Player[],
): ChemistryRow[] {
  const visible = roster.filter((p) => p.visible !== false);
  const completed = matches.filter(
    (m) =>
      m.status === "completed" &&
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number",
  );

  const out: ChemistryRow[] = [];
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i];
      const b = visible[j];
      let tog = 0,
        togW = 0,
        togL = 0;
      let aOnly = 0,
        aOnlyW = 0;
      let bOnly = 0,
        bOnlyW = 0;
      for (const m of completed) {
        const aIn = m.results.some((r) => r.playerId === a.id);
        const bIn = m.results.some((r) => r.playerId === b.id);
        const teamWon = (m.teamScore ?? 0) > (m.opponentScore ?? 0);
        const teamLost = (m.teamScore ?? 0) < (m.opponentScore ?? 0);
        if (aIn && bIn) {
          tog++;
          if (teamWon) togW++;
          if (teamLost) togL++;
        } else if (aIn && !bIn) {
          aOnly++;
          if (teamWon) aOnlyW++;
        } else if (!aIn && bIn) {
          bOnly++;
          if (teamWon) bOnlyW++;
        }
      }
      if (tog === 0) continue;
      const togPct = safeRate(togW, togW + togL);
      const aSoloPct = aOnly ? safeRate(aOnlyW, aOnly) : 0;
      const bSoloPct = bOnly ? safeRate(bOnlyW, bOnly) : 0;
      const avgSolo =
        aOnly && bOnly
          ? (aSoloPct + bSoloPct) / 2
          : aOnly
            ? aSoloPct
            : bOnly
              ? bSoloPct
              : togPct; // no comparison data → lift 0
      out.push({
        pair: [a.id, b.id],
        pairNames: [a.name, b.name],
        togetherMatches: tog,
        togetherTeamWins: togW,
        togetherTeamLosses: togL,
        togetherWinPct: togPct,
        lift: Math.round((togPct - avgSolo) * 10) / 10,
      });
    }
  }
  return out.sort((a, b) => b.lift - a.lift || b.togetherWinPct - a.togetherWinPct);
}

/* --------------------------------------------------- skill-level history */

export type SLHistoryRow = {
  playerId: string;
  playerName: string;
  bySL: Record<
    number,
    { matches: number; wins: number; losses: number; winPct: number }
  >;
  totalMatches: number;
  bestSL: { sl: number; winPct: number; matches: number } | null;
};

/**
 * For each player, group their match results by their SL *at the time*. Shows
 * how level changes affected (or didn't affect) their record.
 */
export function recordsBySkillLevel(
  matches: Match[],
  roster: Player[],
): SLHistoryRow[] {
  const acc = new Map<string, SLHistoryRow>();
  for (const p of roster) {
    if (p.visible === false) continue;
    acc.set(p.id, {
      playerId: p.id,
      playerName: p.name,
      bySL: {},
      totalMatches: 0,
      bestSL: null,
    });
  }
  for (const m of matches) {
    if (m.status !== "completed") continue;
    for (const r of m.results) {
      if (typeof r.skillLevel !== "number") continue;
      const row = acc.get(r.playerId);
      if (!row) continue;
      const sl = r.skillLevel;
      if (!row.bySL[sl]) row.bySL[sl] = { matches: 0, wins: 0, losses: 0, winPct: 0 };
      const cell = row.bySL[sl];
      cell.matches++;
      row.totalMatches++;
      if (r.outcome === "W") cell.wins++;
      else cell.losses++;
    }
  }
  for (const row of acc.values()) {
    let best: SLHistoryRow["bestSL"] = null;
    for (const slStr of Object.keys(row.bySL)) {
      const sl = parseInt(slStr, 10);
      const cell = row.bySL[sl];
      cell.winPct = safeRate(cell.wins, cell.matches);
      if (cell.matches >= 3 && (best === null || cell.winPct > best.winPct)) {
        best = { sl, winPct: cell.winPct, matches: cell.matches };
      }
    }
    row.bestSL = best;
  }
  return [...acc.values()]
    .filter((r) => r.totalMatches > 0)
    .sort((a, b) => b.totalMatches - a.totalMatches);
}

/* -------------------------------------------------- home/away × SL bracket */

export type HomeAwayBySL = {
  playerId: string;
  playerName: string;
  homeMatches: number;
  homeWins: number;
  homeWinPct: number;
  awayMatches: number;
  awayWins: number;
  awayWinPct: number;
  homeAwaySwing: number; // homeWinPct - awayWinPct
};

/** Per-player home vs away splits using each match's `isHome` flag. */
export function homeAwayPerPlayer(
  matches: Match[],
  roster: Player[],
): HomeAwayBySL[] {
  const acc = new Map<string, HomeAwayBySL>();
  for (const p of roster) {
    if (p.visible === false) continue;
    acc.set(p.id, {
      playerId: p.id,
      playerName: p.name,
      homeMatches: 0,
      homeWins: 0,
      homeWinPct: 0,
      awayMatches: 0,
      awayWins: 0,
      awayWinPct: 0,
      homeAwaySwing: 0,
    });
  }
  for (const m of matches) {
    if (m.status !== "completed") continue;
    if (m.isHome === undefined) continue;
    for (const r of m.results) {
      const row = acc.get(r.playerId);
      if (!row) continue;
      if (m.isHome) {
        row.homeMatches++;
        if (r.outcome === "W") row.homeWins++;
      } else {
        row.awayMatches++;
        if (r.outcome === "W") row.awayWins++;
      }
    }
  }
  for (const row of acc.values()) {
    row.homeWinPct = safeRate(row.homeWins, row.homeMatches);
    row.awayWinPct = safeRate(row.awayWins, row.awayMatches);
    row.homeAwaySwing = Math.round((row.homeWinPct - row.awayWinPct) * 10) / 10;
  }
  return [...acc.values()].filter(
    (r) => r.homeMatches > 0 || r.awayMatches > 0,
  );
}

/* ------------------------------------------------------ weekly trend */

export type WeeklyPoint = {
  week: number;
  date: string;
  opponent: string;
  matchId: string;
  teamScore?: number;
  opponentScore?: number;
  cumulativeWins: number;
  cumulativeLosses: number;
  outcome: "W" | "L" | "T" | "BYE";
};

export function weeklyTrend(matches: Match[]): WeeklyPoint[] {
  const sorted = [...matches]
    .filter((m) => m.status === "completed" || m.status === "bye")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const out: WeeklyPoint[] = [];
  let w = 0,
    l = 0;
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    let outcome: WeeklyPoint["outcome"] = "T";
    if (m.status === "bye") {
      outcome = "BYE";
    } else if (
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number"
    ) {
      if (m.teamScore > m.opponentScore) {
        w++;
        outcome = "W";
      } else if (m.teamScore < m.opponentScore) {
        l++;
        outcome = "L";
      }
    }
    out.push({
      week: m.week ?? i + 1,
      date: m.date,
      opponent: m.opponent,
      matchId: m.id,
      teamScore: m.teamScore,
      opponentScore: m.opponentScore,
      cumulativeWins: w,
      cumulativeLosses: l,
      outcome,
    });
  }
  return out;
}

/* ----------------------------------------- player × individual opponent */

export type OpponentMatchup = {
  opponentName: string;
  matches: number;
  wins: number;
  losses: number;
  winPct: number;
  /** Their most-recent skill level we've seen across our matches against them. */
  latestSkillLevel?: number;
};

export type PlayerOpponentRow = {
  playerId: string;
  playerName: string;
  totalOpponents: number;
  totalMatches: number;
  best: OpponentMatchup[]; // strongest matchups, min 2 games
  worst: OpponentMatchup[]; // weakest matchups, min 2 games
  all: OpponentMatchup[];
};

/**
 * For each Top Dogs player, group their results by individual opponent name.
 * Surface their strongest and weakest head-to-head records — strategic value
 * for "who to throw" in a given matchup.
 *
 * Note: APA opponent names are matched as strings (not member ids) so a name
 * collision across teams could merge two different opponents. In practice
 * that's rare in a single division.
 */
export function playerOpponentMatchups(
  matches: Match[],
  roster: Player[],
): PlayerOpponentRow[] {
  const playerMap = new Map<
    string,
    Map<
      string,
      {
        wins: number;
        losses: number;
        latestSL?: number;
        latestSLDate?: number;
      }
    >
  >();
  const nameOf = new Map<string, string>();
  for (const p of roster) {
    if (p.visible === false) continue;
    playerMap.set(p.id, new Map());
    nameOf.set(p.id, p.name);
  }

  for (const m of matches) {
    if (m.status !== "completed") continue;
    const matchTs = +new Date(m.date);
    for (const r of m.results) {
      const oppMap = playerMap.get(r.playerId);
      if (!oppMap) continue;
      const opp = (r.opponentName ?? "").trim();
      if (!opp || opp === "Opponent") continue;
      const e = oppMap.get(opp) ?? { wins: 0, losses: 0 };
      if (r.outcome === "W") e.wins++;
      else e.losses++;
      // Track the most-recent SL we've recorded for this opponent.
      if (
        typeof r.opponentSkillLevel === "number" &&
        r.opponentSkillLevel > 0 &&
        (e.latestSLDate === undefined || matchTs >= e.latestSLDate)
      ) {
        e.latestSL = r.opponentSkillLevel;
        e.latestSLDate = matchTs;
      }
      oppMap.set(opp, e);
    }
  }

  const out: PlayerOpponentRow[] = [];
  for (const [pid, oppMap] of playerMap) {
    const all = [...oppMap.entries()]
      .map(([name, rec]) => ({
        opponentName: name,
        matches: rec.wins + rec.losses,
        wins: rec.wins,
        losses: rec.losses,
        winPct: safeRate(rec.wins, rec.wins + rec.losses),
        latestSkillLevel: rec.latestSL,
      }))
      .sort((a, b) => b.matches - a.matches);
    if (all.length === 0) continue;

    // Strongest = most wins, then highest win %, then most matches
    const strong = all.filter((a) => a.matches >= 2 && a.wins > 0);
    const best = [...strong]
      .sort(
        (a, b) =>
          b.wins - a.wins || b.winPct - a.winPct || b.matches - a.matches,
      )
      .slice(0, 5);
    // Weakest = lowest win %, with at least 2 matches; tiebreak by losses, then matches
    const weak = all.filter((a) => a.matches >= 2);
    const worst = [...weak]
      .sort(
        (a, b) =>
          a.winPct - b.winPct || b.losses - a.losses || b.matches - a.matches,
      )
      .slice(0, 5);

    out.push({
      playerId: pid,
      playerName: nameOf.get(pid) ?? pid,
      totalOpponents: all.length,
      totalMatches: all.reduce((s, r) => s + r.matches, 0),
      best,
      worst,
      all,
    });
  }
  return out.sort((a, b) => b.totalMatches - a.totalMatches);
}

/* ------------------------------------------------------------ venues */

export type VenueRecord = {
  location: string;
  teamMatches: number;
  teamWins: number;
  teamLosses: number;
  teamWinPct: number;
  individualMatches: number;
  individualWins: number;
  individualWinPct: number;
  averageMargin: number; // ours minus opponents per team match
  isHomeVenue: boolean;
};

export function venueRecords(
  matches: Match[],
  homeVenueName?: string,
): VenueRecord[] {
  const map = new Map<string, VenueRecord>();
  for (const m of matches) {
    if (m.status !== "completed") continue;
    if (!m.location) continue;
    let row = map.get(m.location);
    if (!row) {
      row = {
        location: m.location,
        teamMatches: 0,
        teamWins: 0,
        teamLosses: 0,
        teamWinPct: 0,
        individualMatches: 0,
        individualWins: 0,
        individualWinPct: 0,
        averageMargin: 0,
        isHomeVenue: !!homeVenueName && m.location === homeVenueName,
      };
      map.set(m.location, row);
    }
    row.teamMatches++;
    if (
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number"
    ) {
      if (m.teamScore > m.opponentScore) row.teamWins++;
      else if (m.teamScore < m.opponentScore) row.teamLosses++;
      row.averageMargin += m.teamScore - m.opponentScore;
    }
    for (const r of m.results) {
      row.individualMatches++;
      if (r.outcome === "W") row.individualWins++;
    }
  }
  for (const row of map.values()) {
    row.teamWinPct = safeRate(row.teamWins, row.teamWins + row.teamLosses);
    row.individualWinPct = safeRate(row.individualWins, row.individualMatches);
    row.averageMargin = row.teamMatches
      ? Math.round((row.averageMargin / row.teamMatches) * 10) / 10
      : 0;
  }
  return [...map.values()].sort((a, b) => b.teamMatches - a.teamMatches);
}

export type PlayerVenueRow = {
  playerId: string;
  playerName: string;
  byVenue: Array<{
    location: string;
    matches: number;
    wins: number;
    winPct: number;
    isHomeVenue: boolean;
  }>;
  bestVenue: { location: string; winPct: number; matches: number } | null;
};

export function playerVenueRecords(
  matches: Match[],
  roster: Player[],
  homeVenueName?: string,
): PlayerVenueRow[] {
  const acc = new Map<
    string,
    { name: string; venues: Map<string, { matches: number; wins: number }> }
  >();
  for (const p of roster) {
    if (p.visible === false) continue;
    acc.set(p.id, { name: p.name, venues: new Map() });
  }
  for (const m of matches) {
    if (m.status !== "completed" || !m.location) continue;
    for (const r of m.results) {
      const row = acc.get(r.playerId);
      if (!row) continue;
      const v = row.venues.get(m.location) ?? { matches: 0, wins: 0 };
      v.matches++;
      if (r.outcome === "W") v.wins++;
      row.venues.set(m.location, v);
    }
  }
  const out: PlayerVenueRow[] = [];
  for (const [pid, { name, venues }] of acc) {
    const byVenue = [...venues.entries()].map(([loc, v]) => ({
      location: loc,
      matches: v.matches,
      wins: v.wins,
      winPct: safeRate(v.wins, v.matches),
      isHomeVenue: !!homeVenueName && loc === homeVenueName,
    }));
    if (byVenue.length === 0) continue;
    const eligible = byVenue.filter((v) => v.matches >= 3);
    const best = eligible.sort(
      (a, b) => b.winPct - a.winPct || b.matches - a.matches,
    )[0];
    out.push({
      playerId: pid,
      playerName: name,
      byVenue: byVenue.sort((a, b) => b.matches - a.matches),
      bestVenue: best
        ? { location: best.location, winPct: best.winPct, matches: best.matches }
        : null,
    });
  }
  return out.sort(
    (a, b) =>
      b.byVenue.reduce((s, v) => s + v.matches, 0) -
      a.byVenue.reduce((s, v) => s + v.matches, 0),
  );
}

/* ------------------------------------------------------- game insights */

export type GameInsights = {
  totalIndividualMatches: number;
  averageGamesPerMatch: number; // (ours + opp) average per individual match
  forfeitMatches: number;
  forfeitPct: number;
  incompleteMatches: number;
  decisiveTeamWins: { matchId: string; opponent: string; date: string; teamScore: number; opponentScore: number; margin: number } | null;
  closestTeamWin: { matchId: string; opponent: string; date: string; teamScore: number; opponentScore: number; margin: number } | null;
  largestTeamLoss: { matchId: string; opponent: string; date: string; teamScore: number; opponentScore: number; margin: number } | null;
  comebackWins: number; // approximated below
};

export function gameInsights(matches: Match[]): GameInsights {
  const completed = matches.filter((m) => m.status === "completed");

  let total = 0;
  let games = 0;
  let forfeit = 0;
  const incomplete = 0;
  let comebacks = 0;
  for (const m of completed) {
    for (const r of m.results) {
      total++;
      if (r.score) {
        const [a, b] = r.score.split("-").map((s) => parseInt(s, 10));
        if (Number.isFinite(a) && Number.isFinite(b)) games += a + b;
      }
      if (r.forfeited) forfeit++;
    }
    // "Comeback wins" — won a tight match (margin ≤ 2) that had a forfeit
    // against us in the lineup. Without per-individual-match timestamps we
    // can't do "trailed at half then won", so this is the best proxy: a
    // narrow win that wasn't a sweep.
    if (
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number" &&
      m.teamScore > m.opponentScore &&
      m.teamScore - m.opponentScore <= 3 &&
      m.results.some((r) => r.outcome === "L")
    ) {
      comebacks++;
    }
  }

  let decisive: GameInsights["decisiveTeamWins"] = null;
  let closest: GameInsights["closestTeamWin"] = null;
  let worstLoss: GameInsights["largestTeamLoss"] = null;
  for (const m of completed) {
    if (
      typeof m.teamScore !== "number" ||
      typeof m.opponentScore !== "number"
    )
      continue;
    const mg = m.teamScore - m.opponentScore;
    const obj = {
      matchId: m.id,
      opponent: m.opponent,
      date: m.date,
      teamScore: m.teamScore,
      opponentScore: m.opponentScore,
      margin: mg,
    };
    if (mg > 0) {
      if (!decisive || mg > decisive.margin) decisive = obj;
      if (!closest || mg < closest.margin) closest = obj;
    }
    if (mg < 0) {
      if (!worstLoss || mg < worstLoss.margin) worstLoss = obj;
    }
  }

  return {
    totalIndividualMatches: total,
    averageGamesPerMatch: total ? Math.round((games / total) * 10) / 10 : 0,
    forfeitMatches: forfeit,
    forfeitPct: safeRate(forfeit, total),
    incompleteMatches: incomplete,
    decisiveTeamWins: decisive,
    closestTeamWin: closest,
    largestTeamLoss: worstLoss,
    comebackWins: comebacks,
  };
}

/* ============================================================ NEXT-MATCH BRIEFING */

export type OpponentPlayerProfile = {
  name: string;
  appearances: number; // matches we've played them
  preferredPosition: number; // most common slot they put up at
  positionsByCount: Map<number, number>;
  averageSL: number;
  topSL: number;
  ourRecordVsThem: { wins: number; losses: number };
  bestCounter: { playerId: string; playerName: string; wins: number; losses: number; winPct: number } | null;
};

export type NextMatchBriefing = {
  match: Match;
  opponentName: string;
  opponentProfile: OpponentPlayerProfile[];
  suggestedCounters: Array<{
    position: number;
    opponentName: string | null;
    opponentSL: number | null;
    counterPlayerId: string;
    counterPlayerName: string;
    rationale: string;
  }>;
};

/**
 * Find the next upcoming match against a non-bye opponent and synthesize a
 * pre-match briefing from our cached scoresheets. Opponent rosters are
 * inferred from prior matches we've played them.
 */
export function nextMatchBriefing(
  schedule: Match[],
  allMatches: Match[],
  roster: Player[],
): NextMatchBriefing | null {
  const upcoming = schedule
    .filter((m) => m.status === "upcoming" && m.opponent !== "BYE")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0];
  if (!upcoming) return null;

  const oppName = upcoming.opponent;

  // Prior matches we've played against this opponent.
  const priors = allMatches.filter(
    (m) =>
      m.status === "completed" &&
      m.opponent === oppName &&
      m.results.length > 0,
  );

  // Build opponent player profile from their appearances.
  const opponentByName = new Map<
    string,
    {
      appearances: number;
      positions: Map<number, number>;
      sls: number[];
      ourWins: number;
      ourLosses: number;
      counters: Map<string, { wins: number; losses: number; name: string }>;
    }
  >();
  for (const m of priors) {
    for (const r of m.results) {
      const op = r.opponentName?.trim();
      if (!op || op === "Opponent") continue;
      let entry = opponentByName.get(op);
      if (!entry) {
        entry = {
          appearances: 0,
          positions: new Map(),
          sls: [],
          ourWins: 0,
          ourLosses: 0,
          counters: new Map(),
        };
        opponentByName.set(op, entry);
      }
      entry.appearances++;
      if (typeof r.matchPosition === "number") {
        entry.positions.set(
          r.matchPosition,
          (entry.positions.get(r.matchPosition) ?? 0) + 1,
        );
      }
      if (typeof r.opponentSkillLevel === "number")
        entry.sls.push(r.opponentSkillLevel);
      if (r.outcome === "W") entry.ourWins++;
      else entry.ourLosses++;
      const c = entry.counters.get(r.playerId) ?? {
        wins: 0,
        losses: 0,
        name: r.playerName,
      };
      if (r.outcome === "W") c.wins++;
      else c.losses++;
      entry.counters.set(r.playerId, c);
    }
  }

  const opponentProfile: OpponentPlayerProfile[] = [...opponentByName.entries()]
    .map(([name, e]) => {
      const positionsSorted = [...e.positions.entries()].sort(
        (a, b) => b[1] - a[1],
      );
      const preferredPosition = positionsSorted[0]?.[0] ?? 0;
      const avgSL = e.sls.length
        ? e.sls.reduce((s, n) => s + n, 0) / e.sls.length
        : 0;
      const topSL = e.sls.length ? Math.max(...e.sls) : 0;
      const counters = [...e.counters.entries()]
        .map(([pid, c]) => ({
          playerId: pid,
          playerName: c.name,
          wins: c.wins,
          losses: c.losses,
          winPct: safeRate(c.wins, c.wins + c.losses),
        }))
        .filter((c) =>
          roster.some((p) => p.id === c.playerId && p.visible !== false),
        )
        .sort(
          (a, b) =>
            b.winPct - a.winPct ||
            b.wins - a.wins ||
            (b.wins + b.losses) - (a.wins + a.losses),
        );
      return {
        name,
        appearances: e.appearances,
        preferredPosition,
        positionsByCount: e.positions,
        averageSL: Math.round(avgSL * 10) / 10,
        topSL,
        ourRecordVsThem: { wins: e.ourWins, losses: e.ourLosses },
        bestCounter: counters[0] ?? null,
      };
    })
    .sort((a, b) => b.appearances - a.appearances);

  // Suggested counters per position based on opponent's likely starters.
  const probableStarters: Array<OpponentPlayerProfile | null> = [
    null,
    null,
    null,
    null,
    null,
    null,
  ];
  // Greedy: take top opponents by appearance, place each at their preferred
  // position; if taken, fall back to next-most-common position.
  const usedSlots = new Set<number>();
  for (const opp of opponentProfile) {
    for (const [pos] of [...opp.positionsByCount.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      if (usedSlots.has(pos)) continue;
      probableStarters[pos] = opp;
      usedSlots.add(pos);
      break;
    }
    if (usedSlots.size === 5) break;
  }

  const usedCounters = new Set<string>();
  const suggestedCounters: NextMatchBriefing["suggestedCounters"] = [];
  for (let pos = 1; pos <= 5; pos++) {
    const starter = probableStarters[pos];
    if (!starter) {
      // Fall back: pick our highest-win-rate roster member at this position
      // who hasn't been used yet. (Skip — leaves a gap; UI handles it.)
      continue;
    }
    const candidates = (opponentByName.get(starter.name)?.counters
      ? [...opponentByName.get(starter.name)!.counters.entries()].map(
          ([pid, c]) => ({
            playerId: pid,
            playerName: c.name,
            wins: c.wins,
            losses: c.losses,
            winPct: safeRate(c.wins, c.wins + c.losses),
          }),
        )
      : [])
      .filter(
        (c) =>
          !usedCounters.has(c.playerId) &&
          roster.some((p) => p.id === c.playerId && p.visible !== false),
      )
      .sort(
        (a, b) => b.winPct - a.winPct || b.wins - a.wins,
      );
    const pick = candidates[0];
    if (pick) {
      usedCounters.add(pick.playerId);
      suggestedCounters.push({
        position: pos,
        opponentName: starter.name,
        opponentSL: starter.topSL || null,
        counterPlayerId: pick.playerId,
        counterPlayerName: pick.playerName,
        rationale: `${pick.wins}-${pick.losses} all-time (${pick.winPct}% vs ${starter.name})`,
      });
    } else {
      // No H2H data — skip. UI will show "—".
    }
  }

  return {
    match: upcoming,
    opponentName: oppName,
    opponentProfile,
    suggestedCounters,
  };
}

/* ============================================================ COUNTER-PICK */

export type CounterPickRow = {
  playerId: string;
  playerName: string;
  matches: number;
  wins: number;
  losses: number;
  winPct: number;
  /** Score = winPct (with prior — Beta(2,2) smoothing) for sample size sanity. */
  score: number;
};

/**
 * Given an opponent's name (and optional SL bucket), rank our roster by their
 * head-to-head record, with Beta-smoothing so 1-0 doesn't outrank 8-2.
 */
export function counterPickFor(
  opponentName: string,
  matches: Match[],
  roster: Player[],
): CounterPickRow[] {
  const target = opponentName.trim().toLowerCase();
  if (!target) return [];
  const acc = new Map<string, { name: string; wins: number; losses: number }>();
  for (const p of roster) {
    if (p.visible === false) continue;
    acc.set(p.id, { name: p.name, wins: 0, losses: 0 });
  }
  for (const m of matches) {
    if (m.status !== "completed") continue;
    for (const r of m.results) {
      if ((r.opponentName ?? "").trim().toLowerCase() !== target) continue;
      const row = acc.get(r.playerId);
      if (!row) continue;
      if (r.outcome === "W") row.wins++;
      else row.losses++;
    }
  }
  const out: CounterPickRow[] = [];
  for (const [pid, e] of acc) {
    const matches_ = e.wins + e.losses;
    if (matches_ === 0) continue;
    const winPct = safeRate(e.wins, matches_);
    // Beta(2,2) smoothing: pretends every player has 2 prior wins and 2 priors losses.
    const score =
      Math.round(((e.wins + 2) / (matches_ + 4)) * 1000) / 10;
    out.push({
      playerId: pid,
      playerName: e.name,
      matches: matches_,
      wins: e.wins,
      losses: e.losses,
      winPct,
      score,
    });
  }
  return out.sort(
    (a, b) => b.score - a.score || b.wins - a.wins || b.matches - a.matches,
  );
}

/* ============================================================ PLAYER IMPACT */

export type ImpactRow = {
  playerId: string;
  playerName: string;
  withMatches: number;
  withWins: number;
  withWinPct: number;
  withoutMatches: number;
  withoutWins: number;
  withoutWinPct: number;
  swing: number; // with - without
};

/**
 * Team record when this player IS in the lineup, vs when they aren't. Swing
 * quantifies how much their presence shifts our team win rate.
 */
export function playerImpact(matches: Match[], roster: Player[]): ImpactRow[] {
  const completed = matches.filter(
    (m) =>
      m.status === "completed" &&
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number",
  );
  const out: ImpactRow[] = [];
  for (const p of roster) {
    if (p.visible === false) continue;
    let withM = 0,
      withW = 0,
      woM = 0,
      woW = 0;
    for (const m of completed) {
      const teamWon = (m.teamScore ?? 0) > (m.opponentScore ?? 0);
      const teamLost = (m.teamScore ?? 0) < (m.opponentScore ?? 0);
      const inLineup = m.results.some((r) => r.playerId === p.id);
      if (inLineup) {
        withM++;
        if (teamWon) withW++;
        else if (teamLost) {
          /* loss */
        }
      } else {
        woM++;
        if (teamWon) woW++;
      }
    }
    if (withM === 0 && woM === 0) continue;
    const withWinPct = safeRate(withW, withM);
    const woWinPct = safeRate(woW, woM);
    out.push({
      playerId: p.id,
      playerName: p.name,
      withMatches: withM,
      withWins: withW,
      withWinPct,
      withoutMatches: woM,
      withoutWins: woW,
      withoutWinPct: woWinPct,
      swing: Math.round((withWinPct - woWinPct) * 10) / 10,
    });
  }
  return out.sort((a, b) => b.swing - a.swing);
}

/* ============================================================ ACHIEVEMENTS */

export type Badge = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  playerId: string;
  playerName: string;
  value: string;
};

/** Auto-derive ~10 badges from current scope's data + assigns to players. */
export function achievements(
  matches: Match[],
  roster: Player[],
): { byPlayer: Map<string, Badge[]>; flat: Badge[] } {
  const completed = matches.filter((m) => m.status === "completed");
  type Stat = {
    name: string;
    sweeps: number;
    miniSweeps: number;
    breakAndRuns: number;
    eightOnBreaks: number;
    matches: number;
    wins: number;
    points: number;
    longestWinStreak: number;
    currentStreak: number;
    venuesPlayed: Set<string>;
  };
  const acc = new Map<string, Stat>();
  for (const p of roster) {
    if (p.visible === false) continue;
    acc.set(p.id, {
      name: p.name,
      sweeps: 0,
      miniSweeps: 0,
      breakAndRuns: 0,
      eightOnBreaks: 0,
      matches: 0,
      wins: 0,
      points: 0,
      longestWinStreak: 0,
      currentStreak: 0,
      venuesPlayed: new Set(),
    });
  }

  // Build chronological outcome list per player to compute streaks.
  const sorted = [...completed].sort(
    (a, b) => +new Date(a.date) - +new Date(b.date),
  );
  const playerStreak = new Map<string, { cur: number; longest: number }>();
  for (const m of sorted) {
    for (const r of m.results) {
      const stat = acc.get(r.playerId);
      if (!stat) continue;
      stat.matches++;
      if (r.outcome === "W") stat.wins++;
      if (r.sweep) stat.sweeps++;
      if (r.miniSweep) stat.miniSweeps++;
      if (r.breakAndRun) stat.breakAndRuns++;
      if (r.eightOnBreak) stat.eightOnBreaks++;
      if (r.sweep) stat.points += 1;
      else if (r.miniSweep) stat.points += 0.5;
      if (r.breakAndRun) stat.points += 1;
      if (r.eightOnBreak) stat.points += 1;
      if (m.location) stat.venuesPlayed.add(m.location);
      const ps = playerStreak.get(r.playerId) ?? { cur: 0, longest: 0 };
      if (r.outcome === "W") ps.cur++;
      else ps.cur = 0;
      if (ps.cur > ps.longest) ps.longest = ps.cur;
      playerStreak.set(r.playerId, ps);
    }
  }
  for (const [pid, ps] of playerStreak) {
    const s = acc.get(pid);
    if (!s) continue;
    s.longestWinStreak = ps.longest;
    s.currentStreak = ps.cur;
  }

  const flat: Badge[] = [];
  function award(
    id: string,
    label: string,
    emoji: string,
    description: string,
    pick: (entries: [string, Stat][]) => [string, Stat] | undefined,
    valueOf: (s: Stat) => string | null,
  ) {
    const entries = [...acc.entries()];
    const winner = pick(entries);
    if (!winner) return;
    const [pid, s] = winner;
    const v = valueOf(s);
    if (!v) return;
    flat.push({
      id,
      label,
      emoji,
      description,
      playerId: pid,
      playerName: s.name,
      value: v,
    });
  }

  award(
    "sweep-king",
    "Sweep King",
    "👑",
    "Most full-shutout wins in scope.",
    (es) =>
      es
        .filter(([, s]) => s.sweeps > 0)
        .sort((a, b) => b[1].sweeps - a[1].sweeps)[0],
    (s) => `${s.sweeps} sweeps`,
  );
  award(
    "mini-master",
    "Mini Master",
    "🥷",
    "Most mini-sweeps in scope.",
    (es) =>
      es
        .filter(([, s]) => s.miniSweeps > 0)
        .sort((a, b) => b[1].miniSweeps - a[1].miniSweeps)[0],
    (s) => `${s.miniSweeps} mini-sweeps`,
  );
  award(
    "iron-player",
    "Iron Player",
    "🏋️",
    "Most individual matches played in scope.",
    (es) => es.sort((a, b) => b[1].matches - a[1].matches)[0],
    (s) => (s.matches > 0 ? `${s.matches} matches` : null),
  );
  award(
    "highlight-reel",
    "Highlight Reel",
    "🎬",
    "Most break-and-runs + 8-on-breaks combined.",
    (es) =>
      es
        .filter(([, s]) => s.breakAndRuns + s.eightOnBreaks > 0)
        .sort(
          (a, b) =>
            b[1].breakAndRuns +
            b[1].eightOnBreaks -
            (a[1].breakAndRuns + a[1].eightOnBreaks),
        )[0],
    (s) =>
      `${s.breakAndRuns + s.eightOnBreaks} (${s.breakAndRuns} B&R · ${s.eightOnBreaks} 8oB)`,
  );
  award(
    "win-king",
    "Crusher",
    "⚔️",
    "Most individual wins.",
    (es) => es.sort((a, b) => b[1].wins - a[1].wins)[0],
    (s) => (s.wins > 0 ? `${s.wins} wins` : null),
  );
  award(
    "win-pct-king",
    "Mr. Reliable",
    "🎯",
    "Highest win % (min 5 matches).",
    (es) =>
      es
        .filter(([, s]) => s.matches >= 5)
        .sort(
          (a, b) =>
            b[1].wins / b[1].matches - a[1].wins / a[1].matches,
        )[0],
    (s) =>
      s.matches >= 5 ? `${Math.round((s.wins / s.matches) * 1000) / 10}%` : null,
  );
  award(
    "long-streak",
    "Streaker",
    "🔥",
    "Longest single win streak in scope.",
    (es) => es.sort((a, b) => b[1].longestWinStreak - a[1].longestWinStreak)[0],
    (s) =>
      s.longestWinStreak >= 3 ? `${s.longestWinStreak} in a row` : null,
  );
  award(
    "hot-hand",
    "Hot Hand",
    "♨️",
    "Currently riding the longest active win streak.",
    (es) =>
      es.filter(([, s]) => s.currentStreak >= 2).sort(
        (a, b) => b[1].currentStreak - a[1].currentStreak,
      )[0],
    (s) => (s.currentStreak >= 2 ? `${s.currentStreak} active` : null),
  );
  award(
    "bar-hopper",
    "Bar Hopper",
    "🍻",
    "Played at the most different venues.",
    (es) => es.sort((a, b) => b[1].venuesPlayed.size - a[1].venuesPlayed.size)[0],
    (s) => (s.venuesPlayed.size >= 2 ? `${s.venuesPlayed.size} venues` : null),
  );
  award(
    "point-leader",
    "Top Scorer",
    "🏆",
    "Most leaderboard points earned.",
    (es) => es.sort((a, b) => b[1].points - a[1].points)[0],
    (s) =>
      s.points > 0 ? `${Math.round(s.points * 10) / 10} pts` : null,
  );

  const byPlayer = new Map<string, Badge[]>();
  for (const b of flat) {
    const list = byPlayer.get(b.playerId) ?? [];
    list.push(b);
    byPlayer.set(b.playerId, list);
  }
  return { byPlayer, flat };
}

/* ============================================================ RECORDS BOOK */

export type RecordEntry = {
  label: string;
  value: string;
  detail?: string;
  matchId?: string;
  playerId?: string;
  playerName?: string;
};

export function recordsBook(matches: Match[], roster: Player[]): RecordEntry[] {
  const completed = matches.filter((m) => m.status === "completed");
  const out: RecordEntry[] = [];

  // Highest team point total / lowest
  let highest: Match | null = null;
  let lowest: Match | null = null;
  let widestWin: Match | null = null;
  let worstLoss: Match | null = null;
  for (const m of completed) {
    if (typeof m.teamScore !== "number" || typeof m.opponentScore !== "number")
      continue;
    if (!highest || m.teamScore > highest.teamScore!) highest = m;
    if (!lowest || m.teamScore < lowest.teamScore!) lowest = m;
    const margin = m.teamScore - m.opponentScore;
    if (margin > 0 && (!widestWin || margin > widestWin.teamScore! - widestWin.opponentScore!)) {
      widestWin = m;
    }
    if (margin < 0 && (!worstLoss || margin < worstLoss.teamScore! - worstLoss.opponentScore!)) {
      worstLoss = m;
    }
  }

  if (highest)
    out.push({
      label: "Highest team score",
      value: String(highest.teamScore),
      detail: `vs ${highest.opponent} · ${formatRecordDate(highest.date)}`,
      matchId: highest.id,
    });
  if (lowest)
    out.push({
      label: "Lowest team score",
      value: String(lowest.teamScore),
      detail: `vs ${lowest.opponent} · ${formatRecordDate(lowest.date)}`,
      matchId: lowest.id,
    });
  if (widestWin)
    out.push({
      label: "Widest win",
      value: `${widestWin.teamScore}–${widestWin.opponentScore}`,
      detail: `vs ${widestWin.opponent} · ${formatRecordDate(widestWin.date)}`,
      matchId: widestWin.id,
    });
  if (worstLoss)
    out.push({
      label: "Worst loss",
      value: `${worstLoss.teamScore}–${worstLoss.opponentScore}`,
      detail: `vs ${worstLoss.opponent} · ${formatRecordDate(worstLoss.date)}`,
      matchId: worstLoss.id,
    });

  // Longest team win streak
  const sortedMatches = [...completed].sort(
    (a, b) => +new Date(a.date) - +new Date(b.date),
  );
  let curWin = 0,
    longestWin = 0;
  let curLoss = 0,
    longestLoss = 0;
  for (const m of sortedMatches) {
    if (typeof m.teamScore !== "number" || typeof m.opponentScore !== "number")
      continue;
    if (m.teamScore > m.opponentScore) {
      curWin++;
      curLoss = 0;
      if (curWin > longestWin) longestWin = curWin;
    } else if (m.teamScore < m.opponentScore) {
      curLoss++;
      curWin = 0;
      if (curLoss > longestLoss) longestLoss = curLoss;
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }
  if (longestWin > 0)
    out.push({ label: "Longest team win streak", value: `${longestWin} matches` });
  if (longestLoss > 0)
    out.push({ label: "Longest team losing streak", value: `${longestLoss} matches` });

  // Per-player records
  type Career = { name: string; sweeps: number; mini: number; br: number; eob: number; wins: number; matches: number; longestStreak: number };
  const careers = new Map<string, Career>();
  for (const p of roster) {
    if (p.visible === false) continue;
    careers.set(p.id, { name: p.name, sweeps: 0, mini: 0, br: 0, eob: 0, wins: 0, matches: 0, longestStreak: 0 });
  }
  const streak = new Map<string, { cur: number; longest: number }>();
  let mostBRsInMatch: { count: number; name: string; matchId: string; opponent: string } | null = null;

  for (const m of sortedMatches) {
    const playerBRThisMatch = new Map<string, number>();
    for (const r of m.results) {
      const c = careers.get(r.playerId);
      if (!c) continue;
      c.matches++;
      if (r.outcome === "W") c.wins++;
      if (r.sweep) c.sweeps++;
      if (r.miniSweep) c.mini++;
      if (r.breakAndRun) c.br++;
      if (r.eightOnBreak) c.eob++;
      const ps = streak.get(r.playerId) ?? { cur: 0, longest: 0 };
      if (r.outcome === "W") ps.cur++;
      else ps.cur = 0;
      if (ps.cur > ps.longest) ps.longest = ps.cur;
      streak.set(r.playerId, ps);

      if (r.breakAndRun) {
        playerBRThisMatch.set(
          r.playerId,
          (playerBRThisMatch.get(r.playerId) ?? 0) + 1,
        );
      }
    }
    for (const [pid, count] of playerBRThisMatch) {
      if (count >= (mostBRsInMatch?.count ?? 0)) {
        mostBRsInMatch = {
          count,
          name: careers.get(pid)?.name ?? pid,
          matchId: m.id,
          opponent: m.opponent,
        };
      }
    }
  }
  for (const [pid, ps] of streak) {
    const c = careers.get(pid);
    if (c) c.longestStreak = ps.longest;
  }

  // Top recordholders (single records — pick best across all players)
  const careerArr = [...careers.entries()];
  function topPerCategory(
    label: string,
    selector: (c: Career) => number,
    valueFmt: (n: number) => string,
    minThreshold = 1,
  ) {
    const top = careerArr
      .filter(([, c]) => selector(c) >= minThreshold)
      .sort((a, b) => selector(b[1]) - selector(a[1]))[0];
    if (!top) return;
    out.push({
      label,
      value: valueFmt(selector(top[1])),
      detail: top[1].name,
      playerId: top[0],
      playerName: top[1].name,
    });
  }
  topPerCategory("Most career sweeps", (c) => c.sweeps, (n) => `${n}`, 1);
  topPerCategory("Most career mini-sweeps", (c) => c.mini, (n) => `${n}`, 1);
  topPerCategory("Most career break-and-runs", (c) => c.br, (n) => `${n}`, 1);
  topPerCategory("Most career 8-on-the-breaks", (c) => c.eob, (n) => `${n}`, 1);
  topPerCategory("Most career wins", (c) => c.wins, (n) => `${n}`, 1);
  topPerCategory(
    "Longest individual win streak",
    (c) => c.longestStreak,
    (n) => `${n} in a row`,
    3,
  );

  if (mostBRsInMatch && mostBRsInMatch.count >= 1) {
    out.push({
      label: "Most B&Rs in one match",
      value: `${mostBRsInMatch.count}`,
      detail: `${mostBRsInMatch.name} vs ${mostBRsInMatch.opponent}`,
      matchId: mostBRsInMatch.matchId,
    });
  }

  return out;
}

function formatRecordDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ============================================================ MVP RACE */

export type MVPRacePoint = {
  playerId: string;
  playerName: string;
  series: Array<{ date: string; matchId: string; cumulativePoints: number }>;
};

export function mvpRaceData(
  matches: Match[],
  roster: Player[],
): MVPRacePoint[] {
  const sorted = [...matches]
    .filter((m) => m.status === "completed")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const series = new Map<string, MVPRacePoint["series"]>();
  for (const p of roster) {
    if (p.visible === false) continue;
    series.set(p.id, []);
  }
  const totals = new Map<string, number>();
  for (const m of sorted) {
    const earnedThisMatch = new Map<string, number>();
    for (const r of m.results) {
      let pts = 0;
      if (r.sweep) pts += 1;
      else if (r.miniSweep) pts += 0.5;
      if (r.breakAndRun) pts += 1;
      if (r.eightOnBreak) pts += 1;
      earnedThisMatch.set(
        r.playerId,
        (earnedThisMatch.get(r.playerId) ?? 0) + pts,
      );
    }
    for (const [pid, s] of series) {
      const inThisMatch = earnedThisMatch.has(pid);
      if (!inThisMatch) continue;
      const total = (totals.get(pid) ?? 0) + (earnedThisMatch.get(pid) ?? 0);
      totals.set(pid, total);
      s.push({
        date: m.date,
        matchId: m.id,
        cumulativePoints: Math.round(total * 10) / 10,
      });
    }
  }
  const out: MVPRacePoint[] = [];
  for (const [pid, s] of series) {
    if (s.length === 0) continue;
    out.push({
      playerId: pid,
      playerName: roster.find((p) => p.id === pid)?.name ?? pid,
      series: s,
    });
  }
  return out.sort((a, b) => {
    const al = a.series[a.series.length - 1]?.cumulativePoints ?? 0;
    const bl = b.series[b.series.length - 1]?.cumulativePoints ?? 0;
    return bl - al;
  });
}

/* ============================================================ RADAR STATS */

export type RadarRow = {
  playerId: string;
  playerName: string;
  /** All five values normalized to 0..100 across the team (max=100). */
  axes: { winPct: number; sweepRate: number; miniRate: number; brRate: number; eobRate: number };
  /** Raw rates for tooltips. */
  raw: { winPct: number; sweepRate: number; miniRate: number; brRate: number; eobRate: number };
  matches: number;
};

export function radarStats(
  matches: Match[],
  roster: Player[],
): RadarRow[] {
  const rows: Array<RadarRow & { _matches: number }> = [];
  const visible = roster.filter((p) => p.visible !== false);
  for (const p of visible) {
    let mp = 0,
      w = 0,
      sw = 0,
      mini = 0,
      br = 0,
      eob = 0;
    for (const m of matches) {
      if (m.status !== "completed") continue;
      for (const r of m.results) {
        if (r.playerId !== p.id) continue;
        mp++;
        if (r.outcome === "W") w++;
        if (r.sweep) sw++;
        if (r.miniSweep) mini++;
        if (r.breakAndRun) br++;
        if (r.eightOnBreak) eob++;
      }
    }
    if (mp === 0) continue;
    const raw = {
      winPct: safeRate(w, mp),
      sweepRate: safeRate(sw, mp),
      miniRate: safeRate(mini, mp),
      brRate: safeRate(br, mp),
      eobRate: safeRate(eob, mp),
    };
    rows.push({
      playerId: p.id,
      playerName: p.name,
      axes: { ...raw },
      raw,
      matches: mp,
      _matches: mp,
    });
  }
  // Normalize each axis so the team's max = 100 (visual scaling).
  const axes = ["winPct", "sweepRate", "miniRate", "brRate", "eobRate"] as const;
  for (const ax of axes) {
    const max = Math.max(...rows.map((r) => r.raw[ax]), 0.01);
    for (const r of rows) {
      r.axes[ax] = Math.round((r.raw[ax] / max) * 100 * 10) / 10;
    }
  }
  return rows
    .sort((a, b) => b._matches - a._matches)
    .map(({ _matches, ...rest }) => {
      void _matches;
      return rest;
    });
}

/* ============================================================ CALENDAR HEATMAP */

export type CalendarCell = {
  matchId: string;
  date: string;
  week?: number;
  outcome: "W" | "L" | "T" | "BYE" | "UPCOMING";
  margin: number; // teamScore - oppScore (0 for bye/upcoming)
  teamScore?: number;
  opponentScore?: number;
  opponent: string;
};

export function calendarHeatmap(matches: Match[]): CalendarCell[] {
  return [...matches]
    .filter((m) => m.status !== "forfeit")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .map((m): CalendarCell => {
      let outcome: CalendarCell["outcome"] = "T";
      if (m.status === "bye") outcome = "BYE";
      else if (m.status === "upcoming") outcome = "UPCOMING";
      else if (
        typeof m.teamScore === "number" &&
        typeof m.opponentScore === "number"
      ) {
        if (m.teamScore > m.opponentScore) outcome = "W";
        else if (m.teamScore < m.opponentScore) outcome = "L";
      }
      const margin =
        typeof m.teamScore === "number" && typeof m.opponentScore === "number"
          ? m.teamScore - m.opponentScore
          : 0;
      return {
        matchId: m.id,
        date: m.date,
        week: m.week,
        outcome,
        margin,
        teamScore: m.teamScore,
        opponentScore: m.opponentScore,
        opponent: m.opponent,
      };
    });
}

/* ============================================================ LEVEL-UP WATCH */

export type LevelUpRow = {
  playerId: string;
  playerName: string;
  currentSL: number | null;
  currentPA: number | null;
  paTrend: number[]; // last few sessions PA, oldest→newest
  trend: "up" | "down" | "flat";
  /** PA delta vs previous session. */
  delta: number;
};

type LevelUpInput = {
  id: string;
  name: string;
  skillLevel: number | null;
  visible?: boolean;
  sessions?: Array<{ pa?: number; sessionId: number; skillLevel?: number }>;
};

/**
 * Players whose recent PA trajectory suggests a level change is coming.
 * (APA's exact thresholds aren't published per-SL, so this is a directional
 * read — show the delta and let the team interpret.)
 */
export function levelUpWatch(players: LevelUpInput[]): LevelUpRow[] {
  const out: LevelUpRow[] = [];
  for (const p of players) {
    if (p.visible === false) continue;
    const sessions = (p.sessions ?? [])
      .filter((s) => typeof s.pa === "number")
      .slice()
      .sort((a, b) => a.sessionId - b.sessionId); // oldest → newest
    if (sessions.length < 2) {
      out.push({
        playerId: p.id,
        playerName: p.name,
        currentSL: p.skillLevel,
        currentPA: sessions[sessions.length - 1]?.pa ?? null,
        paTrend: sessions.map((s) => s.pa!),
        trend: "flat",
        delta: 0,
      });
      continue;
    }
    const last3 = sessions.slice(-3);
    const cur = last3[last3.length - 1].pa!;
    const prev = last3[last3.length - 2].pa!;
    const delta = Math.round((cur - prev) * 10) / 10;
    const trend: LevelUpRow["trend"] =
      delta > 1.5 ? "up" : delta < -1.5 ? "down" : "flat";
    out.push({
      playerId: p.id,
      playerName: p.name,
      currentSL: p.skillLevel,
      currentPA: cur,
      paTrend: sessions.map((s) => s.pa!).slice(-5),
      trend,
      delta,
    });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/* ============================================================ EXPECTED vs ACTUAL */

export type ExpectedActual = {
  matches: number;
  actualWins: number;
  expectedWins: number;
  delta: number; // actual - expected
  perMatch: Array<{
    matchId: string;
    date: string;
    opponent: string;
    expected: number; // 0..1 win probability we assigned
    actual: 0 | 1 | 0.5;
  }>;
};

/**
 * Compute expected wins from each opponent's overall win rate in the data
 * we have. If their full-division win rate is X, our expected probability of
 * beating them is roughly (1 - X) — clamped to [0.2, 0.8] to avoid extreme
 * predictions on small samples. Sum across matches.
 */
export function expectedVsActual(matches: Match[]): ExpectedActual {
  const completed = matches.filter(
    (m) =>
      m.status === "completed" &&
      typeof m.teamScore === "number" &&
      typeof m.opponentScore === "number",
  );

  // Each opponent's win rate against US (proxy for their strength relative
  // to us). Higher → tougher opponent → lower expected prob for us.
  const oppRecord = new Map<string, { wins: number; losses: number }>();
  for (const m of completed) {
    const e = oppRecord.get(m.opponent) ?? { wins: 0, losses: 0 };
    if ((m.teamScore ?? 0) > (m.opponentScore ?? 0)) e.losses++; // they lost
    else if ((m.teamScore ?? 0) < (m.opponentScore ?? 0)) e.wins++; // they won
    oppRecord.set(m.opponent, e);
  }

  let actualWins = 0;
  let expectedWins = 0;
  const perMatch: ExpectedActual["perMatch"] = [];
  for (const m of completed) {
    const e = oppRecord.get(m.opponent);
    const total = (e?.wins ?? 0) + (e?.losses ?? 0);
    // Default 0.5 if no prior data; otherwise (their losses / total) — i.e. their
    // historical record vs us, used as our prior probability of winning.
    let pWin = 0.5;
    if (total >= 1) {
      pWin = (e!.losses + 1) / (total + 2); // smoothed
    }
    pWin = Math.max(0.2, Math.min(0.8, pWin));
    expectedWins += pWin;
    const won = (m.teamScore ?? 0) > (m.opponentScore ?? 0) ? 1 : 0;
    if (won) actualWins++;
    perMatch.push({
      matchId: m.id,
      date: m.date,
      opponent: m.opponent,
      expected: Math.round(pWin * 1000) / 1000,
      actual: won as 0 | 1,
    });
  }
  return {
    matches: completed.length,
    actualWins,
    expectedWins: Math.round(expectedWins * 10) / 10,
    delta: Math.round((actualWins - expectedWins) * 10) / 10,
    perMatch,
  };
}

/* ============================================================ HOMEPAGE MOMENTUM */

export type MomentumChip = {
  matchId: string;
  outcome: "W" | "L" | "T";
  teamScore?: number;
  opponentScore?: number;
  opponent: string;
  date: string;
};

/**
 * Compact list of the team's last N completed-match outcomes (oldest → newest),
 * for the homepage "momentum strip" pill row.
 */
export function teamMomentum(matches: Match[], n = 10): MomentumChip[] {
  return matches
    .filter(
      (m) =>
        m.status === "completed" &&
        typeof m.teamScore === "number" &&
        typeof m.opponentScore === "number",
    )
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .slice(-n)
    .map((m) => ({
      matchId: m.id,
      outcome:
        m.teamScore! > m.opponentScore!
          ? ("W" as const)
          : m.teamScore! < m.opponentScore!
            ? ("L" as const)
            : ("T" as const),
      teamScore: m.teamScore,
      opponentScore: m.opponentScore,
      opponent: m.opponent,
      date: m.date,
    }));
}

/** Current run from the most recent backwards (e.g. W-W-W → 3-win streak). */
export function currentTeamStreak(matches: Match[]): {
  outcome: "W" | "L" | "T" | null;
  count: number;
} {
  const m = teamMomentum(matches, 50);
  if (m.length === 0) return { outcome: null, count: 0 };
  const head = m[m.length - 1].outcome;
  let count = 0;
  for (let i = m.length - 1; i >= 0; i--) {
    if (m[i].outcome === head) count += 1;
    else break;
  }
  return { outcome: head, count };
}

/* ============================================================ POINT TRAJECTORIES (sparkline data) */

/**
 * For each requested playerId, return their cumulative leaderboard-points
 * series over their last `window` individual matches (oldest → newest), in
 * chronological order. Drives the leaderboard sparklines on the homepage.
 *
 * Each match contributes: 1 if win else 0, plus sweep/mini/B&R/8oB bonuses
 * (matches the same scoring used to rank players). The returned list always
 * starts at 0 so a flat string of zeros still draws a recognizable line.
 */
export function playerPointsTrajectories(
  matches: Match[],
  playerIds: string[],
  window = 10,
): Map<string, number[]> {
  const ids = new Set(playerIds);
  // Per-player chronological list of [date, contribution]
  const perPlayer = new Map<string, Array<{ date: string; pts: number }>>();
  for (const id of ids) perPlayer.set(id, []);

  for (const m of matches) {
    if (m.status !== "completed") continue;
    for (const r of m.results) {
      if (!ids.has(r.playerId)) continue;
      let pts = pointsForResult(r);
      if (r.outcome === "W") pts += 1;
      perPlayer.get(r.playerId)!.push({ date: m.date, pts });
    }
  }

  const out = new Map<string, number[]>();
  for (const [id, rows] of perPlayer) {
    rows.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const tail = rows.slice(-window);
    const series: number[] = [0];
    let cum = 0;
    for (const r of tail) {
      cum += r.pts;
      series.push(Math.round(cum * 10) / 10);
    }
    out.set(id, series);
  }
  return out;
}

/* ============================================================ THROW ADVISOR
 *
 * Live during pool night: given who the opponent just put up (name + SL),
 * which match-of-the-night this is, the bar we're at, and which of our
 * players are (a) here tonight and (b) haven't already been thrown — rank
 * the remaining roster by their fit and explain *why*.
 *
 * The scoring blends six recency-weighted components:
 *   1. Head-to-head record vs *this specific opponent player*
 *   2. Record vs opponents at this exact skill level
 *   3. Record vs this opponent team (any of their players)
 *   4. Record at this venue
 *   5. Recent form (last-N individual matches, exp-decayed)
 *   6. Win % at this match position (lead/anchor/etc.)
 * Plus a race-chart equity bonus: the APA 8-ball race chart hands the lower
 * SL fewer games to win, which is real "free equity" we should respect.
 *
 * Strategy layer: the APA 8-ball "23 rule" caps any 5-player lineup at
 * skill-level total ≤ 23. The advisor projects the remaining SL budget after
 * each throw so far tonight, flags candidates whose SL would make the rest of
 * the night infeasible, and surfaces "save for later" picks when burning a
 * stud here would force weak SLs into anchor slots.
 */

// 120-day half life — matches from 4 months ago count half as much as last
// week, 8-month-old matches a quarter, etc. Tight enough that this season's
// form drives the score; loose enough that an opponent we've only played
// twice in 18 months still tells us something.
const THROW_RECENCY_HALFLIFE_DAYS = 120;
// Form looks at the most-recent matches, also recency-weighted, so an
// 8-game window picks up the "is this player on a heater right now" signal.
const THROW_FORM_WINDOW = 8;
const THROW_FORM_HALFLIFE_DAYS = 45; // form should react quickly
const APA_SL_BUDGET = 23; // 8-ball: sum of SLs in a 5-player lineup ≤ 23

export type ThrowMatchLog = {
  /** 1..5 — which slot was filled. */
  position: number;
  ourPlayerId: string;
  ourSkillLevel: number | null;
  oppName: string;
  oppSkillLevel: number | null;
  /** "W" if we won this individual match; "L" if we lost; "pending" if mid-game. */
  outcome: "W" | "L" | "pending";
  /**
   * Per-individual-match race score. Optional — if absent, the recap renders
   * just "W"/"L" with no game score. Populated by the race-score result step.
   * Game wins for our player (0..our race target).
   */
  ourGames?: number;
  /** Game wins for the opponent's player (0..their race target). */
  theirGames?: number;
};

export type ThrowAdvisorInput = {
  opponentTeam: string;
  location?: string;
  /** 1..5. The slot we're picking for right now. */
  currentPosition: number;
  /** Opponent's putup for this slot. */
  opponentName: string;
  opponentSkillLevel: number;
  /** Players who are physically at the bar tonight. */
  availablePlayerIds: Set<string>;
  /** Throws already locked in earlier tonight. */
  log: ThrowMatchLog[];
  /**
   * Opponent team's known roster — used by the save-for-later engine to spot
   * whether a tougher matchup is still on their bench. Each entry is one of
   * their players we have history on; `latestSL` is the most-recent SL we've
   * recorded for them.
   */
  opponentRoster?: Array<{ name: string; latestSL: number | null }>;
};

export type ThrowComponentScore = {
  /** Beta(2,2)-smoothed win-rate, 0..100. Used in the composite. */
  smoothed: number;
  /** Raw win rate, 0..100 (for display). */
  rate: number;
  /** Sample size. */
  matches: number;
  wins: number;
  losses: number;
  /** True when no data exists for this candidate × component. */
  noData: boolean;
  /** "high" ≥4 matches, "medium" 2-3, "low" 1, "none" 0 — drives the weight. */
  confidence: "high" | "medium" | "low" | "none";
};

export type ThrowVerdict =
  | "top-pick"
  | "strong"
  | "viable"
  | "save"
  | "stretch"
  | "infeasible";

export type ThrowCandidate = {
  playerId: string;
  playerName: string;
  skillLevel: number | null;
  /** Composite 0..100, used for ranking. Includes the lookahead penalty. */
  overall: number;
  /**
   * Win probability (0..100) for this individual matchup BEFORE the lineup-
   * wide lookahead penalty. Reflects pure "what's the likelihood this player
   * beats this opponent?" — what you'd quote to a teammate.
   */
  matchupScore: number;
  /**
   * Chronological per-match history for this candidate against the named
   * opponent (counter-pick mode only). Empty when the opener (blind) function
   * was used.
   */
  h2hHistory: Array<{ date: string; outcome: "W" | "L"; matchId: string }>;
  /** Tier label. */
  verdict: ThrowVerdict;
  components: {
    h2h: ThrowComponentScore;
    vsSL: ThrowComponentScore;
    vsTeam: ThrowComponentScore;
    venue: ThrowComponentScore;
    form: ThrowComponentScore;
    position: ThrowComponentScore;
    /**
     * Clutch performance — the player's win rate in tight team-match states
     * (current team score gap ≤ 1). High clutch = they step up under
     * pressure; low clutch = they fold. Used as a small log-odds nudge when
     * the current state itself is tight.
     */
    clutch: ThrowComponentScore;
    /**
     * Race-chart equity: 0..100. Their required wins ÷ (mine + theirs).
     * Above 50 = race favors us.
     */
    raceEquity: number;
    /**
     * Lookahead — lineup-wide team value if this candidate plays the current
     * slot and the remaining roster is greedily assigned to the future slots
     * (best slot-fit per remaining slot, no double-use). Higher = this player
     * leaves the rest of the night in a better spot. Range: 0..100.
     */
    lookahead: number;
    /**
     * Lookahead delta vs the BEST team-value across all candidates at this
     * slot. 0 = team-optimal pick. Negative numbers mean burning this player
     * here costs N points of expected lineup value.
     */
    lookaheadDelta: number;
  };
  /**
   * 95% confidence interval on the matchupScore, in absolute % points.
   * `[lo, hi]` — narrow when we have lots of data, wide when we don't.
   * Honest about prediction uncertainty.
   */
  matchupScoreCI: [number, number];
  /**
   * Combined per-match leaderboard-points rate (sweep×1 + mini×0.5 + B&R×1 +
   * 8oB×1, divided by matches). Used as a tiebreaker when win % is close —
   * a player who racks up special shots is worth more team points per match.
   */
  specialShotsRate: number;
  /**
   * Days since this player's most recent match. >42 = "rusty" warning,
   * since form data may be stale. null = never played.
   */
  lastPlayedDaysAgo: number | null;
  /**
   * Current consecutive run of identical outcomes (W or L) from the most
   * recent matches. Null = no matches. Used as a small log-odds nudge for
   * streaks ≥ 3 — captures "on a heater" beyond what form averaging shows.
   */
  currentStreak: { type: "W" | "L"; length: number } | null;
  /**
   * Probability of winning the team match if THIS specific candidate is
   * locked at the current slot (Markov over remaining slots, with greedy
   * SL-pairing for future slots). Lets the UI show "what-if" comparisons.
   */
  nightWinProbIfPicked: number;
  /** Bullet reasons, ordered from strongest to weakest. */
  reasoning: string[];
  /** Caveats / yellow flags. */
  flags: string[];
  /** Would using this player here keep the rest of the night SL-feasible? */
  feasible: boolean;
  feasibilityNote?: string;
  /** True if this player should be kept dry for a later slot. */
  saveForLater: boolean;
  /**
   * If a tougher / fairer matchup is still on the opponent's bench, this
   * describes it: who they are, their SL, and the race-equity comparison.
   * Drives the "save your SL7 for their SL7" save-for-later trigger.
   */
  idealUpcomingMatchup?: {
    opponentName: string;
    opponentSL: number;
    raceEquityHere: number; // 0..100 race equity vs the current putup
    raceEquityThere: number; // 0..100 race equity vs the better future opponent
  } | null;
};

export type MatchUrgency = "must-win" | "leverage" | "comfortable" | "even";

export type ThrowAdvisorResult = {
  candidates: ThrowCandidate[];
  topPick: ThrowCandidate | null;
  context: {
    /** Slots remaining AFTER this one. */
    remainingPositionsAfter: number;
    /** Sum of SLs for the slots already locked in. */
    usedSLBudget: number;
    /** What's left of the 23-budget, BEFORE this pick is applied. */
    remainingSLBudget: number;
    /** Worst-case minimum SL average needed for the slots after this one if a given SL is used here. */
    minAvgSLAfter: number;
    /** Running team score from the throws-so-far log. */
    ourScore: number;
    theirScore: number;
    /** Pool nights are race to 5; we map score gap onto urgency. */
    urgency: MatchUrgency;
    /** Heuristic narrative the UI prints up top. */
    narrative: string;
    /**
     * Highest SL still on the opponent team's bench (not yet thrown tonight),
     * derived from their known roster. Null when we have no roster data.
     * Drives strategic decisions like "save the SL7 for their SL7".
     */
    opponentHighestPendingSL: number | null;
    /** The pending opponent player's name, for display. */
    opponentHighestPendingName: string | null;
    /**
     * Probability of winning the team match (race-to-3 individual wins),
     * given:
     *   - Current score (ourScore-theirScore)
     *   - The top-pick's matchup score for the CURRENT slot
     *   - Greedy-paired race-equity estimates for each FUTURE slot
     * Computed by exact Markov enumeration over the remaining slots.
     * 0..100. Drives the captain's "are we already golden / must-win"
     * decision much more precisely than the bucketed urgency label.
     */
    nightWinProbability: number;
    /** 95% CI on nightWinProbability, in absolute % points. */
    nightWinProbabilityCI: [number, number];
    /** Pending opponent SLs in descending order — for "their bench" display. */
    pendingOpponentSLs: number[];
  };
};

/**
 * Beta(2,2)-smoothed rate, percent. 1-0 → 60, 0-0 → 50, 5-0 → ~78.
 * Keeps tiny samples from dominating on raw 100% / 0% rates.
 */
function smoothedRate(wins: number, losses: number): number {
  const n = wins + losses;
  if (n === 0) return 50; // prior: coin flip
  return Math.round(((wins + 2) / (n + 4)) * 1000) / 10;
}

function rawRate(wins: number, losses: number): number {
  const n = wins + losses;
  if (n === 0) return 0;
  return Math.round((wins / n) * 1000) / 10;
}

function confidenceFor(matches: number): ThrowComponentScore["confidence"] {
  if (matches >= 4) return "high";
  if (matches >= 2) return "medium";
  if (matches >= 1) return "low";
  return "none";
}

function emptyComponent(): ThrowComponentScore {
  return {
    smoothed: 50,
    rate: 0,
    matches: 0,
    wins: 0,
    losses: 0,
    noData: true,
    confidence: "none",
  };
}

function buildComponent(
  weighted: { wins: number; losses: number; rawWins: number; rawLosses: number },
): ThrowComponentScore {
  const matches = weighted.rawWins + weighted.rawLosses;
  if (matches === 0) return emptyComponent();
  // Smoothing operates on the recency-weighted counts (so a recent match
  // carries more weight than a 2-year-old one) — but `matches` and confidence
  // use raw counts so the UI shows real W-L totals.
  return {
    smoothed: smoothedRate(weighted.wins, weighted.losses),
    rate: rawRate(weighted.rawWins, weighted.rawLosses),
    matches,
    wins: weighted.rawWins,
    losses: weighted.rawLosses,
    noData: false,
    confidence: confidenceFor(matches),
  };
}

/** Confidence multiplier — high samples lift component weight, none zeroes it. */
function confidenceWeight(c: ThrowComponentScore["confidence"]): number {
  switch (c) {
    case "high":
      return 0.85;
    case "medium":
      return 0.50;
    case "low":
      return 0.18;
    case "none":
      return 0;
  }
}

/* ---------------------------------------- Bayesian win-probability helpers */

/**
 * Logit (log-odds) of a probability. Clamped to avoid Infinity at 0 / 1.
 */
function logit(p: number): number {
  const c = Math.max(0.005, Math.min(0.995, p));
  return Math.log(c / (1 - c));
}

/**
 * Inverse of logit. Maps any real number to (0, 1).
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Wilson-style 95% confidence interval for a binomial proportion. Takes the
 * point estimate `p` (as a fraction 0..1) and the effective sample size `n`.
 * Returns the lower and upper bounds as fractions, clamped to [0, 1].
 *
 * For the throw advisor we use this to put an honest uncertainty band on
 * the win-probability gauge — a 65% predicted from 2 matches is much less
 * sure than 65% predicted from 30 matches.
 */
function wilson95(p: number, n: number): [number, number] {
  if (n <= 0) return [0, 1];
  const z = 1.96; // 95% normal approximation
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const spread = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  const lo = Math.max(0, center - spread);
  const hi = Math.min(1, center + spread);
  return [lo, hi];
}

/**
 * Probability of winning the team match (first to 3 individual wins) given:
 *   - currentWins:  individual matches we've already won tonight
 *   - currentLosses:individual matches we've already lost
 *   - slotProbs:    probability of winning each remaining slot, in order
 *
 * Implementation: exhaustive recursive Markov over the remaining outcomes.
 * For ≤ 5 slots this is at most 32 branches — instant.
 */
function nightWinProbability(
  currentOurPoints: number,
  currentTheirPoints: number,
  slotProbs: number[],
): number {
  // Each slot's outcome distribution, conditional on W or L. These are
  // approximate league averages; tuned defaults work well enough across
  // the throw advisor without per-player customisation.
  // P(sweep | W) = 0.20, P(mini | W) = 0.50, P(hill-hill | W) = 0.30.
  // Same for losses.
  const SWEEP_P = 0.20;
  const MINI_P = 0.50;
  const HILL_P = 0.30;
  // We track only the point delta — collapses state to a single dimension.
  // Each slot can change delta by +3/+2/+1/-1/-2/-3 depending on outcome.
  function recur(delta: number, idx: number): number {
    if (idx >= slotProbs.length) {
      if (delta > 0) return 1;
      if (delta < 0) return 0;
      return 0.5; // tie — APA rules sometimes have tiebreakers; we split the diff
    }
    const p = slotProbs[idx];
    return (
      p *
        (SWEEP_P * recur(delta + 3, idx + 1) + // we sweep: +3
          MINI_P * recur(delta + 2, idx + 1) + // we mini-sweep: +2
          HILL_P * recur(delta + 1, idx + 1)) + // hill-hill win: +1 net
      (1 - p) *
        (HILL_P * recur(delta - 1, idx + 1) + // hill-hill loss: -1 net
          MINI_P * recur(delta - 2, idx + 1) + // got mini-swept: -2
          SWEEP_P * recur(delta - 3, idx + 1)) // got swept: -3
    );
  }
  return recur(currentOurPoints - currentTheirPoints, 0);
}

/**
 * Estimate per-future-slot win probability via greedy SL-pairing.
 *
 * For each (our remaining candidate × their pending opponent) pair, we
 * estimate a win prob by anchoring on race equity and adjusting by the
 * candidate's form (skill above/below average). Then we greedily assign
 * the highest-prob pairs first, marking each candidate and opponent used
 * exactly once. The result is a list of expected win probs, one per
 * remaining slot, used to feed the night-win-probability Markov.
 *
 * This is a heuristic — APA captains don't always pair optimally — but
 * it gives a directionally-honest "what's the rest of the night look like
 * if we play smart" estimate.
 */
function estimateFutureSlotProbs(
  remainingCandidates: ThrowCandidate[],
  pendingOpponentSLs: number[],
): number[] {
  if (remainingCandidates.length === 0 || pendingOpponentSLs.length === 0) {
    return [];
  }
  type Pair = { ci: number; oi: number; prob: number };
  const pairs: Pair[] = [];
  for (let ci = 0; ci < remainingCandidates.length; ci++) {
    const c = remainingCandidates[ci];
    if (typeof c.skillLevel !== "number") continue;
    for (let oi = 0; oi < pendingOpponentSLs.length; oi++) {
      const oppSL = pendingOpponentSLs[oi];
      const re = raceEquity(c.skillLevel, oppSL) / 100;
      // Form skill-nudge: a hot player playing above their SL gets bumped.
      let prob = re;
      if (!c.components.form.noData) {
        const cw = confidenceWeight(c.components.form.confidence);
        const formNudge =
          0.5 * cw * (logit(c.components.form.smoothed / 100) - logit(0.5));
        prob = sigmoid(logit(re) + formNudge);
      }
      // Clamp extremes — no future slot is a 99% lock.
      prob = Math.max(0.1, Math.min(0.9, prob));
      pairs.push({ ci, oi, prob });
    }
  }
  pairs.sort((a, b) => b.prob - a.prob);
  const usedC = new Set<number>();
  const usedO = new Set<number>();
  const probs: number[] = [];
  for (const p of pairs) {
    if (usedC.has(p.ci) || usedO.has(p.oi)) continue;
    usedC.add(p.ci);
    usedO.add(p.oi);
    probs.push(p.prob);
  }
  return probs;
}

/**
 * Reconstruct the team-score state at the time of each individual match.
 *
 * The scoresheet gives us per-individual-match results with `matchPosition`
 * (1..5). Walking through them in slot order, we can compute the score
 * BEFORE each match — i.e. how tight the team match was when this player
 * went up. Used by the `clutch` component to bucket past matches by state.
 *
 * Returns a map: matchId → matchPosition → { ourScoreBefore, theirScoreBefore }
 */
function teamScoreStatesBeforeMatch(
  match: Match,
): Map<number, { ourBefore: number; theirBefore: number }> {
  const states = new Map<number, { ourBefore: number; theirBefore: number }>();
  // Sort by matchPosition; missing positions go last.
  const sorted = [...match.results].sort((a, b) => {
    const ap = a.matchPosition ?? 99;
    const bp = b.matchPosition ?? 99;
    return ap - bp;
  });
  let ourCum = 0;
  let theirCum = 0;
  for (const r of sorted) {
    const pos = r.matchPosition;
    if (typeof pos === "number") {
      states.set(pos, { ourBefore: ourCum, theirBefore: theirCum });
    }
    if (r.outcome === "W") ourCum++;
    else theirCum++;
  }
  return states;
}

/**
 * "Tight" state: |ourScore - theirScore| ≤ 1 in TEAM-MATCH POINTS, with
 * neither side at the clinched threshold. Captures "the pressure is on"
 * for the clutch component. Used when scoring historical individual
 * matches (where we walk the slot order) and when classifying the current
 * live state.
 */
function isTightTeamState(our: number, their: number): boolean {
  return Math.abs(our - their) <= 1;
}

/**
 * APA team-match points awarded for a single completed individual match.
 *
 * Per APA 8-ball rules:
 *   - Sweep (loser scored 0 games):                 winner 3, loser 0
 *   - Mini-sweep (loser ≥1 but didn't reach hill):  winner 2, loser 0
 *   - Hill-hill (loser at hill, winner went over):  winner 2, loser 1
 *
 * Symmetric for losses. If game scores aren't recorded, falls back to a
 * neutral 2-0 / 0-2 split based on outcome alone.
 */
function teamMatchPoints(t: ThrowMatchLog): { ourPts: number; theirPts: number } {
  if (t.outcome === "pending") return { ourPts: 0, theirPts: 0 };
  if (
    typeof t.ourGames !== "number" ||
    typeof t.theirGames !== "number" ||
    t.ourSkillLevel == null ||
    t.oppSkillLevel == null
  ) {
    return t.outcome === "W"
      ? { ourPts: 2, theirPts: 0 }
      : { ourPts: 0, theirPts: 2 };
  }
  const ourRace = winsRequired(t.ourSkillLevel, t.oppSkillLevel);
  const theirRace = winsRequired(t.oppSkillLevel, t.ourSkillLevel);
  const ourHill = ourRace - 1;
  const theirHill = theirRace - 1;
  if (t.outcome === "W") {
    if (t.theirGames === 0) return { ourPts: 3, theirPts: 0 };
    if (t.theirGames >= theirHill) return { ourPts: 2, theirPts: 1 };
    return { ourPts: 2, theirPts: 0 };
  }
  // Loss
  if (t.ourGames === 0) return { ourPts: 0, theirPts: 3 };
  if (t.ourGames >= ourHill) return { ourPts: 1, theirPts: 2 };
  return { ourPts: 0, theirPts: 2 };
}

/**
 * Sum the team-match score from the throw log.
 */
function tallyTeamScore(log: ThrowMatchLog[]): { our: number; their: number } {
  let our = 0;
  let their = 0;
  for (const t of log) {
    const pts = teamMatchPoints(t);
    our += pts.ourPts;
    their += pts.theirPts;
  }
  return { our, their };
}

/**
 * Recompute win probability for a candidate against a *hypothetical* opponent
 * SL — used by the adversarial opener model to estimate "what if they
 * counter-pick with their SL X". Reuses the candidate's existing form/slot/
 * vs-team/clutch components but swaps in a fresh race-equity for the
 * hypothetical opponent. H2H and vs-SL are deliberately treated as no-data
 * because the hypothesised opponent is, well, hypothesized.
 */
function hypotheticalWinProbability(
  candidate: ThrowCandidate,
  hypotheticalOppSL: number,
  isCurrentlyTight: boolean,
): number {
  const hypotheticalComponents = {
    ...candidate.components,
    h2h: emptyComponent(),
    vsSL: emptyComponent(),
    raceEquity: raceEquity(candidate.skillLevel, hypotheticalOppSL),
  };
  const { matchupScore } = computeWinProbability(
    hypotheticalComponents,
    isCurrentlyTight,
    candidate.currentStreak,
  );
  // Apply SL-mismatch penalty in the hypothetical too.
  const slAdj = slMismatchAdjustment(candidate.skillLevel, hypotheticalOppSL);
  return Math.max(5, Math.min(95, matchupScore + slAdj.penalty));
}

/**
 * Win probability from the candidate's component scores via Bayesian
 * log-odds blending.
 *
 * Key insight: the **vs-SL component already incorporates the race-chart
 * handicap**. When Aaron is 8-2 against SL2s, those matches were already
 * races where the SL2 only needed 2 wins and Aaron needed 7. Aaron's 71%
 * win rate IS his calibrated win probability against SL2s. We must NOT
 * additionally apply race-equity as a prior on top of this — that's
 * double-counting the handicap and was what was driving SL7 win-prob
 * artificially low for strong players.
 *
 * The flow:
 *   1. Pick the **base prediction**:
 *      - If vs-SL has high/medium confidence (≥ 4 matches), it IS the base.
 *      - If vs-SL has low confidence (1-3 matches), blend with race-equity.
 *      - If no vs-SL data, race-equity is the structural fallback.
 *   2. Each remaining component (h2h, form, slot, vs-team) contributes a
 *      log-odds nudge above/below the base. Form gets a heavier weight
 *      when vs-SL is missing (it has to do more work to estimate skill);
 *      a lighter weight when vs-SL is the base (it's a recency adjustment).
 *   3. Clamp to [5, 95]. No certainties.
 *
 * Why log-odds and not a linear weighted average?
 *   - Probabilities combine multiplicatively, not linearly.
 *   - Log-odds nudges are zero-centered: a 50% component contributes 0,
 *     a 70% one contributes +0.847, a 30% one −0.847.
 */
function computeWinProbability(
  components: ThrowCandidate["components"],
  /**
   * Whether the team match itself is currently in a tight state (score gap
   * ≤ 1). When true, the clutch component gets weighted; otherwise it
   * sits silent.
   */
  isCurrentlyTight: boolean,
  /**
   * Player's current streak (last consecutive run of W or L outcomes).
   * Streaks ≥ 3 get a small log-odds nudge — a heater is a real signal
   * beyond what form-averaging captures.
   */
  currentStreak: { type: "W" | "L"; length: number } | null,
): { matchupScore: number; ci: [number, number] } {
  const vsSLConf = confidenceWeight(components.vsSL.confidence);

  // Base prediction in log-odds space.
  let logOdds: number;
  if (vsSLConf >= 0.50) {
    logOdds = logit(components.vsSL.smoothed / 100);
  } else if (vsSLConf > 0) {
    const blended =
      vsSLConf * (components.vsSL.smoothed / 100) +
      (1 - vsSLConf) * (components.raceEquity / 100);
    logOdds = logit(blended);
  } else {
    logOdds = logit(components.raceEquity / 100);
  }

  const formWeight = vsSLConf >= 0.50 ? 0.40 : 0.85;
  // Clutch only nudges when we're actually in a tight state — a clutch
  // performer's edge appears under pressure, not in blowouts.
  const clutchWeight = isCurrentlyTight ? 0.30 : 0.0;

  const nudges: Array<{
    rate: number;
    weight: number;
    conf: ThrowComponentScore["confidence"];
  }> = [
    { rate: components.h2h.smoothed, weight: 0.6, conf: components.h2h.confidence },
    { rate: components.form.smoothed, weight: formWeight, conf: components.form.confidence },
    { rate: components.position.smoothed, weight: 0.25, conf: components.position.confidence },
    { rate: components.vsTeam.smoothed, weight: 0.25, conf: components.vsTeam.confidence },
    { rate: components.clutch.smoothed, weight: clutchWeight, conf: components.clutch.confidence },
  ];

  for (const e of nudges) {
    const cw = confidenceWeight(e.conf);
    if (cw === 0 || e.weight === 0) continue;
    logOdds += e.weight * cw * (logit(e.rate / 100) - logit(0.5));
  }

  // Streak nudge — small log-odds shift when the player's on a heater
  // (3+ wins) or skid (3+ losses). Caps at length 6 to avoid runaway
  // confidence on long streaks. Sign: +0.10 logit-units per game ≥ 3
  // for wins, mirror for losses. So a 5-game W streak adds ~+0.30 logit
  // ≈ +7pp at 50% baseline.
  if (currentStreak && currentStreak.length >= 3) {
    const len = Math.min(currentStreak.length, 6);
    const sign = currentStreak.type === "W" ? 1 : -1;
    logOdds += sign * 0.10 * (len - 2); // 0.10 at 3, 0.20 at 4, …, 0.40 at 6
  }

  const p = sigmoid(logOdds);
  const clamped = Math.max(0.05, Math.min(0.95, p));
  const matchupScore = Math.round(clamped * 1000) / 10;

  // Confidence interval — Wilson-style on an "effective sample size"
  // computed by summing each component's matches, scaled by its weight in
  // the blend. Components with no data contribute 0.
  const effN =
    (components.h2h.matches || 0) * 1.0 + // H2H matches count fully
    (components.vsSL.matches || 0) * 0.7 +
    (components.form.matches || 0) * 0.5 +
    (components.vsTeam.matches || 0) * 0.3 +
    (components.position.matches || 0) * 0.3 +
    (isCurrentlyTight ? (components.clutch.matches || 0) * 0.3 : 0);
  // Add a small "race-chart prior" effective N so we never report n=0.
  const n = Math.max(2, effN);
  const [lo, hi] = wilson95(clamped, n);
  return {
    matchupScore,
    ci: [
      Math.round(Math.max(5, lo * 100) * 10) / 10,
      Math.round(Math.min(95, hi * 100) * 10) / 10,
    ],
  };
}

/**
 * Race-chart equity. APA 8-ball uses an asymmetric race chart so the lower
 * skill level needs fewer wins to clinch. Equity above 50 means our racetable
 * advantage favors us BEFORE any skill is applied.
 */
function raceEquity(mySL: number | null, oppSL: number): number {
  if (typeof mySL !== "number") return 50;
  const mine = winsRequired(mySL, oppSL);
  const theirs = winsRequired(oppSL, mySL);
  if (!mine || !theirs) return 50;
  // Theirs/(mine+theirs): if I race to 2 and they race to 4, equity=66.
  return Math.round((theirs / (mine + theirs)) * 1000) / 10;
}

/**
 * APA SL-mismatch tactical adjustment.
 *
 * The APA 8-ball race chart hands the lower-SL player a shorter race when
 * SLs are mismatched — the structural handicap. SL7 vs SL2 is 7-vs-2
 * (we have to win 7 games, they only need 2). SL7 vs SL5 is 5-vs-3 (still
 * lopsided — they need 60% of our race target). Same-SL is fully even.
 *
 * On top of the race-equity component (which numerically captures the
 * handicap), this helper applies a tactical *strategic* penalty for the
 * larger gaps. Why two penalties? Two reasons:
 *   1. Equity is one component among many — without an explicit nudge, a
 *      stud's H2H/form data can outweigh the handicap and the tool would
 *      still recommend SL7 vs SL2.
 *   2. There's an opportunity cost beyond the race math: burning a high-SL
 *      player here also wastes 23-rule SL budget you'll want for closer
 *      matches later.
 *
 * Convention: `diff = ourSL - theirSL` (positive = we're the higher SL).
 *   diff ≥ +5  (e.g., 7 vs 2): -25 pts — severe waste, save them
 *   diff ≥ +4  (e.g., 7 vs 3): -16 pts — bad spot
 *   diff ≥ +3  (e.g., 7 vs 4 or 6 vs 3): -9 pts — borderline
 *   diff = +2  (e.g., 7 vs 5 or 5 vs 3): -4 pts — slight, but real edge to
 *                                         the lower SL per the race chart
 *   diff ≤ -2  (we're 2+ SL lower): +4 pts + positive flag — race-chart
 *                                   leans our way, send the underdog
 *   else:      neutral (diffs of 0 or ±1 race close enough to ignore)
 */
function slMismatchAdjustment(
  ourSL: number | null,
  theirSL: number,
): { penalty: number; flag?: string; reason?: string } {
  if (ourSL == null) return { penalty: 0 };
  const diff = ourSL - theirSL;
  const myReq = winsRequired(ourSL, theirSL);
  const theirReq = winsRequired(theirSL, ourSL);
  if (diff >= 5) {
    return {
      penalty: -25,
      flag: `Bad SL spot: SL${ourSL} vs SL${theirSL} — race chart is ${myReq}–${theirReq}, we'd have to win ${myReq} games while they only need ${theirReq}. Save SL${ourSL} for a closer matchup.`,
    };
  }
  if (diff >= 4) {
    return {
      penalty: -16,
      flag: `Wasteful SL pairing: SL${ourSL} vs SL${theirSL} (race ${myReq}–${theirReq}). A closer-SL teammate gets a much fairer race here.`,
    };
  }
  if (diff >= 3) {
    return {
      penalty: -9,
      flag: `SL mismatch: race ${myReq}–${theirReq} — they have a structural edge. Closer SL would race more evenly.`,
    };
  }
  if (diff === 2) {
    return {
      penalty: -4,
      flag: `Slight SL edge to them: race ${myReq}–${theirReq}. A closer-SL teammate races more evenly here.`,
    };
  }
  if (diff <= -2) {
    return {
      penalty: 4,
      reason: `Underdog spot — race chart hands us the structural edge (we race to ${myReq}, they race to ${theirReq}).`,
    };
  }
  return { penalty: 0 };
}

function urgencyFor(ourScore: number, theirScore: number, remainingAfter: number): MatchUrgency {
  // Scores here are in TEAM-MATCH POINTS, with each remaining slot capable of
  // awarding up to 3 points to either side (sweep). The team match is decided
  // by total points after all 5 slots.
  const remaining = remainingAfter + 1; // include this match
  const maxRemainingForOpp = 3 * remaining;
  const maxRemainingForUs = 3 * remaining;
  const gap = ourScore - theirScore;
  // Already clinched? (we lead by more than they could possibly catch up)
  if (gap > maxRemainingForOpp) return "comfortable";
  // Already lost? (we're behind by more than we could possibly recover)
  if (-gap > maxRemainingForUs) return "must-win";
  if (gap === 0) return "even";
  if (gap > 0) return "leverage";
  return "must-win";
}

/**
 * Build per-candidate component scores from cached match history.
 *
 * `matches` should be the in-scope completed matches (typically the current
 * session, with a recency half-life applied so older sessions still count
 * but not as much).
 */

/**
 * Recency-weighted, smoothed slot-fit score for `player` at `position`. Used
 * by the lookahead engine to estimate how well a player would do at any
 * given slot. Range: 0..100 (with smoothing, a no-data slot returns 50).
 */
function slotFitScore(
  player: Player,
  position: number,
  matches: Match[],
  refDate: Date,
): number {
  let wW = 0,
    wL = 0;
  for (const m of matches) {
    if (m.status !== "completed") continue;
    const w = recencyWeight(m.date, refDate, THROW_RECENCY_HALFLIFE_DAYS);
    for (const r of m.results) {
      if (r.playerId !== player.id) continue;
      if (r.matchPosition !== position) continue;
      if (r.outcome === "W") wW += w;
      else wL += w;
    }
  }
  return smoothedRate(wW, wL);
}

/**
 * Greedy maximum-fit assignment of `available` players to `positions`. For
 * each (player, position) pair, score with `slotFit`, sort all pairs desc,
 * iterate top-down assigning the first unused player to the first unused
 * position. Returns sum of assigned scores.
 *
 * Approximates the optimal assignment well enough at this scale (≤ 9 players,
 * ≤ 4 future positions). A full Hungarian solver would be ~5% better in the
 * worst case and isn't worth the complexity here.
 */
function greedyAssignmentValue(
  available: Player[],
  positions: number[],
  slotFit: (p: Player, pos: number) => number,
): number {
  if (positions.length === 0) return 0;
  type Pair = { player: string; pos: number; score: number };
  const pairs: Pair[] = [];
  for (const p of available) {
    for (const pos of positions) {
      pairs.push({ player: p.id, pos, score: slotFit(p, pos) });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const usedPlayer = new Set<string>();
  const usedPos = new Set<number>();
  let total = 0;
  for (const pair of pairs) {
    if (usedPlayer.has(pair.player) || usedPos.has(pair.pos)) continue;
    usedPlayer.add(pair.player);
    usedPos.add(pair.pos);
    total += pair.score;
    if (usedPos.size === positions.length) break;
  }
  // Penalize unfilled slots at a "no data" baseline so a tight roster doesn't
  // get artificially praised.
  const unfilled = positions.length - usedPos.size;
  total += unfilled * 35;
  return total;
}

function scoreCandidate(
  player: Player,
  ctx: {
    matches: Match[];
    input: ThrowAdvisorInput;
    refDate: Date;
    /** True if the team match score gap is ≤ 1 right now. Drives clutch weight. */
    isCurrentlyTight: boolean;
  },
): ThrowCandidate {
  const { matches, input, refDate, isCurrentlyTight } = ctx;
  const oppNameKey = input.opponentName.trim().toLowerCase();
  const oppTeamKey = input.opponentTeam.trim().toLowerCase();
  const venueKey = (input.location ?? "").trim().toLowerCase();

  const acc = {
    h2h: { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 },
    vsSL: { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 },
    vsTeam: { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 },
    venue: { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 },
    position: { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 },
    /** Performance in tight team-match states (current score gap ≤ 1). */
    clutch: { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 },
  };
  // Form = chronological recent outcomes (recency-weighted).
  const formOutcomes: Array<{ date: string; outcome: "W" | "L"; drift: number }> = [];
  // Per-opponent history strip — chronological W/L for the radar/H2H chart.
  const h2hHistory: Array<{ date: string; outcome: "W" | "L"; matchId: string }> = [];
  // Special-shots tally (sweep + mini×0.5 + B&R + 8oB) for the tiebreaker.
  let specialShotsTotal = 0;
  let specialShotsMatches = 0;
  // Most-recent match date the player appeared in — for rust warning.
  let lastPlayedTs = 0;

  for (const m of matches) {
    if (m.status !== "completed") continue;
    const baseW = recencyWeight(m.date, refDate, THROW_RECENCY_HALFLIFE_DAYS);
    // Reconstruct the team-score state at each individual match in this team
    // match. Used for the clutch component.
    let scoreStates: Map<number, { ourBefore: number; theirBefore: number }> | null = null;
    for (const r of m.results) {
      if (r.playerId !== player.id) continue;
      // SL drift: down-weight historical data from when this player was at
      // a different SL. The race chart they were playing under was different,
      // and their absolute skill was likely different too. Same SL → 1.0;
      // ±1 drift → 0.65; ±2 → 0.40; ≥3 SL difference → 0.25.
      const slDrift =
        typeof r.skillLevel === "number" &&
        typeof player.skillLevel === "number"
          ? Math.abs(r.skillLevel - player.skillLevel)
          : 0;
      const driftFactor =
        slDrift === 0 ? 1.0 : slDrift === 1 ? 0.65 : slDrift === 2 ? 0.40 : 0.25;
      const w = baseW * driftFactor;
      const won = r.outcome === "W";
      const isWin = won ? 1 : 0;
      const isLoss = won ? 0 : 1;
      const matchTs = +new Date(m.date);
      if (matchTs > lastPlayedTs) lastPlayedTs = matchTs;

      // Form (any match — uses chronology, weighted at score time)
      formOutcomes.push({ date: m.date, outcome: r.outcome, drift: driftFactor });

      // Special shots — counts toward leaderboard points; used as tiebreaker.
      specialShotsMatches += 1;
      if (r.sweep) specialShotsTotal += 1;
      else if (r.miniSweep) specialShotsTotal += 0.5;
      if (r.breakAndRun) specialShotsTotal += 1;
      if (r.eightOnBreak) specialShotsTotal += 1;

      // Clutch — was this individual match in a tight team-state? Reconstruct
      // the team's score before this slot started.
      if (typeof r.matchPosition === "number") {
        if (!scoreStates) scoreStates = teamScoreStatesBeforeMatch(m);
        const state = scoreStates.get(r.matchPosition);
        if (state && isTightTeamState(state.ourBefore, state.theirBefore)) {
          acc.clutch.wins += isWin * w;
          acc.clutch.losses += isLoss * w;
          acc.clutch.rawWins += isWin;
          acc.clutch.rawLosses += isLoss;
        }
      }

      // H2H vs this opponent player
      if (
        oppNameKey &&
        (r.opponentName ?? "").trim().toLowerCase() === oppNameKey
      ) {
        acc.h2h.wins += isWin * w;
        acc.h2h.losses += isLoss * w;
        acc.h2h.rawWins += isWin;
        acc.h2h.rawLosses += isLoss;
        h2hHistory.push({ date: m.date, outcome: r.outcome, matchId: m.id });
      }
      // vs this exact SL bracket
      if (
        typeof r.opponentSkillLevel === "number" &&
        r.opponentSkillLevel === input.opponentSkillLevel
      ) {
        acc.vsSL.wins += isWin * w;
        acc.vsSL.losses += isLoss * w;
        acc.vsSL.rawWins += isWin;
        acc.vsSL.rawLosses += isLoss;
      }
      // vs this opponent team (any of their players)
      if (oppTeamKey && (m.opponent ?? "").trim().toLowerCase() === oppTeamKey) {
        acc.vsTeam.wins += isWin * w;
        acc.vsTeam.losses += isLoss * w;
        acc.vsTeam.rawWins += isWin;
        acc.vsTeam.rawLosses += isLoss;
      }
      // at this venue
      if (venueKey && (m.location ?? "").trim().toLowerCase() === venueKey) {
        acc.venue.wins += isWin * w;
        acc.venue.losses += isLoss * w;
        acc.venue.rawWins += isWin;
        acc.venue.rawLosses += isLoss;
      }
      // at this position
      if (r.matchPosition === input.currentPosition) {
        acc.position.wins += isWin * w;
        acc.position.losses += isLoss * w;
        acc.position.rawWins += isWin;
        acc.position.rawLosses += isLoss;
      }
    }
  }

  // Compute form
  const sortedForm = formOutcomes
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .slice(-THROW_FORM_WINDOW);
  const formWeighted = { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 };
  for (const f of sortedForm) {
    const w = recencyWeight(f.date, refDate, THROW_FORM_HALFLIFE_DAYS) * f.drift;
    if (f.outcome === "W") {
      formWeighted.wins += w;
      formWeighted.rawWins += 1;
    } else {
      formWeighted.losses += w;
      formWeighted.rawLosses += 1;
    }
  }

  // ---- Current streak (last consecutive run of same outcome) -----
  // A separate signal from form: a player on a 4-game heater is qualitatively
  // different from someone hitting 50% form. Computed by walking form
  // chronologically newest→oldest until the outcome changes.
  const sortedFormDesc = [...formOutcomes].sort(
    (a, b) => +new Date(b.date) - +new Date(a.date),
  );
  let streakType: "W" | "L" | null = null;
  let streakLength = 0;
  for (const f of sortedFormDesc) {
    if (streakType === null) {
      streakType = f.outcome;
      streakLength = 1;
    } else if (f.outcome === streakType) {
      streakLength++;
    } else {
      break;
    }
  }
  const currentStreak: { type: "W" | "L"; length: number } | null =
    streakType !== null && streakLength > 0
      ? { type: streakType, length: streakLength }
      : null;

  const components = {
    h2h: buildComponent(acc.h2h),
    vsSL: buildComponent(acc.vsSL),
    vsTeam: buildComponent(acc.vsTeam),
    venue: buildComponent(acc.venue),
    form: buildComponent(formWeighted),
    position: buildComponent(acc.position),
    clutch: buildComponent(acc.clutch),
    raceEquity: raceEquity(player.skillLevel, input.opponentSkillLevel),
    // Filled in later by recommendThrow once it knows the field.
    lookahead: 0,
    lookaheadDelta: 0,
  };

  // Win probability via Bayesian log-odds blending — race equity is the
  // structural prior, observed components are evidence. See
  // computeWinProbability() for the math. This is the actual probability
  // estimate we expose as "matchupScore" in the UI.
  const { matchupScore, ci: matchupScoreCI } = computeWinProbability(
    components,
    isCurrentlyTight,
    currentStreak,
  );
  // The "overall" ranking score starts at the win probability and gets
  // strategic adjustments (SL mismatch, lookahead) layered on later in
  // recommendThrow. Ranking and probability are intentionally separated.
  const overall = matchupScore;

  // Special-shots rate (0..1, but typically 0..0.5).
  const specialShotsRate =
    specialShotsMatches > 0 ? specialShotsTotal / specialShotsMatches : 0;
  // Days since last match.
  const lastPlayedDaysAgo =
    lastPlayedTs > 0
      ? Math.round((refDate.getTime() - lastPlayedTs) / 86_400_000)
      : null;

  // Reasoning. Ordered: strongest evidence first.
  const reasons: string[] = [];
  const flags: string[] = [];
  const verb = (rate: number) => {
    if (rate >= 70) return "strong";
    if (rate >= 55) return "solid";
    if (rate >= 45) return "even";
    if (rate >= 30) return "below-even";
    return "rough";
  };

  if (!components.h2h.noData) {
    reasons.push(
      `${verb(components.h2h.rate)} head-to-head vs ${input.opponentName} (${components.h2h.wins}-${components.h2h.losses})`,
    );
  } else {
    flags.push(`No prior match vs ${input.opponentName}`);
  }
  if (!components.vsSL.noData) {
    reasons.push(
      `${components.vsSL.wins}-${components.vsSL.losses} vs SL${input.opponentSkillLevel}s overall (${components.vsSL.rate}%)`,
    );
  }
  if (!components.form.noData) {
    const recentN = components.form.matches;
    reasons.push(
      `Recent form: ${components.form.wins}-${components.form.losses} over last ${recentN} (${components.form.rate}%)`,
    );
  }
  if (!components.position.noData && components.position.matches >= 2) {
    reasons.push(
      `Slot ${input.currentPosition} record: ${components.position.wins}-${components.position.losses} (${components.position.rate}%)`,
    );
  }
  if (!components.vsTeam.noData && components.vsTeam.matches >= 2) {
    reasons.push(
      `vs ${input.opponentTeam}: ${components.vsTeam.wins}-${components.vsTeam.losses}`,
    );
  }
  if (!components.venue.noData && components.venue.matches >= 2 && input.location) {
    reasons.push(
      `${verb(components.venue.rate)} at ${input.location} (${components.venue.wins}-${components.venue.losses})`,
    );
  }
  // Race-chart commentary — only printed for the non-mismatched cases. Severe
  // mismatches get the more informative flag from slMismatchAdjustment below.
  if (
    typeof player.skillLevel === "number" &&
    Math.abs(player.skillLevel - input.opponentSkillLevel) < 3
  ) {
    if (components.raceEquity >= 55) {
      reasons.push(
        `Race-chart edge: SL${player.skillLevel} → ${winsRequired(player.skillLevel, input.opponentSkillLevel)} games vs ${winsRequired(input.opponentSkillLevel, player.skillLevel)}`,
      );
    } else if (components.raceEquity <= 45) {
      flags.push(
        `Race chart isn't kind: needs ${winsRequired(player.skillLevel, input.opponentSkillLevel)} games to their ${winsRequired(input.opponentSkillLevel, player.skillLevel)}`,
      );
    }
  }
  if (typeof player.skillLevel !== "number") {
    flags.push("Skill level unknown — race equity ignored");
  }
  if (
    components.h2h.noData &&
    components.vsSL.noData &&
    components.form.noData
  ) {
    flags.push("Thin data — ranking is mostly priors");
  }

  // SL mismatch is a strategic ranking adjustment (opportunity cost of
  // burning a stud here) — it does NOT change the pure win probability.
  // The race-chart handicap is already captured in matchupScore via the
  // race-equity prior. This penalty layers strategy on top for ranking only.
  const slAdj = slMismatchAdjustment(player.skillLevel, input.opponentSkillLevel);
  const adjustedOverall = Math.round(
    Math.max(0, Math.min(100, overall + slAdj.penalty)) * 10,
  ) / 10;
  if (slAdj.flag) flags.unshift(slAdj.flag);
  if (slAdj.reason) reasons.unshift(slAdj.reason);

  // Sort H2H history newest-first and trim — the chart only needs ~12.
  h2hHistory.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const trimmedHistory = h2hHistory.slice(0, 12);

  return {
    playerId: player.id,
    playerName: player.name,
    skillLevel: player.skillLevel,
    overall: adjustedOverall, // ranking — includes SL-mismatch strategic penalty
    matchupScore, // pure win probability — race equity + observed evidence
    matchupScoreCI,
    specialShotsRate,
    lastPlayedDaysAgo,
    currentStreak,
    nightWinProbIfPicked: 0, // filled in later by recommendThrow
    h2hHistory: trimmedHistory,
    verdict: "viable", // placeholder — re-tagged after we know the field
    components,
    reasoning: reasons,
    flags,
    feasible: true,
    saveForLater: false,
  };
}

export function recommendThrow(
  input: ThrowAdvisorInput,
  matches: Match[],
  roster: Player[],
  refDate: Date = new Date(),
): ThrowAdvisorResult {
  // Throws-so-far state.
  const usedSLBudget = input.log.reduce(
    (s, t) => s + (t.ourSkillLevel ?? 0),
    0,
  );
  // Team-match points (per APA 8-ball: sweep=3, mini=2, hill-hill=2-1).
  const teamScore = tallyTeamScore(input.log);
  const ourScore = teamScore.our;
  const theirScore = teamScore.their;
  const positionsLockedIn = new Set(input.log.map((t) => t.position));
  const remainingPositions = [1, 2, 3, 4, 5].filter(
    (p) => !positionsLockedIn.has(p) && p !== input.currentPosition,
  );
  const remainingPositionsAfter = remainingPositions.length;
  const remainingSLBudget = APA_SL_BUDGET - usedSLBudget;

  const urgency = urgencyFor(ourScore, theirScore, remainingPositionsAfter);
  const isCurrentlyTight = isTightTeamState(ourScore, theirScore);

  const usedPlayerIds = new Set(input.log.map((t) => t.ourPlayerId));
  const eligible = roster.filter(
    (p) =>
      p.visible !== false &&
      !usedPlayerIds.has(p.id) &&
      input.availablePlayerIds.has(p.id),
  );

  const candidates = eligible.map((p) =>
    scoreCandidate(p, { matches, input, refDate, isCurrentlyTight }),
  );

  // Feasibility check (23-rule):
  // After picking this player at SL_p here, the remaining `remainingPositionsAfter`
  // slots must collectively fit in (remainingSLBudget − SL_p). We estimate
  // feasibility by (a) the lowest SL combination available among other eligible
  // players for the remaining slots, and (b) APA's hard floor of SL≥2.
  const otherSLs = candidates
    .map((c) => c.skillLevel)
    .filter((sl): sl is number => typeof sl === "number")
    .sort((a, b) => a - b);

  for (const c of candidates) {
    if (typeof c.skillLevel !== "number") continue;
    const slLeft = remainingSLBudget - c.skillLevel;
    if (slLeft < 0) {
      c.feasible = false;
      c.feasibilityNote = `SL${c.skillLevel} blows the 23-rule budget (${remainingSLBudget} left).`;
      c.flags.push(c.feasibilityNote);
      continue;
    }
    if (remainingPositionsAfter === 0) continue;
    // Multiset of remaining-candidate SLs with one instance of c removed.
    const ms = [...otherSLs];
    const idx = ms.indexOf(c.skillLevel);
    if (idx >= 0) ms.splice(idx, 1);
    const need = remainingPositionsAfter;
    if (ms.length < need) {
      // Not enough warm bodies (some slots will be EBP/forfeit or under-staffed)
      c.flags.push(
        `Only ${ms.length} other player${ms.length === 1 ? "" : "s"} available for the remaining ${need} slot${need === 1 ? "" : "s"} — confirm subs.`,
      );
      continue;
    }
    const minSumAfter = ms.slice(0, need).reduce((s, v) => s + v, 0);
    if (minSumAfter > slLeft) {
      c.feasible = false;
      c.feasibilityNote = `Picking SL${c.skillLevel} here forces the rest over the 23-rule budget (need at least ${minSumAfter} more; only ${slLeft} left).`;
      c.flags.push(c.feasibilityNote);
    } else {
      // How tight is it? (For "save for later" reasoning.)
      const slack = slLeft - minSumAfter;
      if (slack <= 1) {
        c.flags.push(
          `Tight on SL budget after this pick: ${slack} room over the minimum.`,
        );
      }
    }
  }

  // ----- Lookahead --------------------------------------------------
  // Compute lineup-wide team value for every feasible candidate. For each
  // candidate we lock them at the current slot, then greedily assign the
  // remaining roster to the future slots by slot-fit. The candidate that
  // maximizes this total is the team-optimal pick.
  const futurePositions = remainingPositions.slice();
  const eligibleAtThisSlot = candidates.filter((c) => c.feasible);
  const slotFitMemo = new Map<string, number>();
  const slotFit = (p: Player, pos: number) => {
    const key = `${p.id}|${pos}`;
    let v = slotFitMemo.get(key);
    if (v === undefined) {
      v = slotFitScore(p, pos, matches, refDate);
      slotFitMemo.set(key, v);
    }
    return v;
  };
  let bestTeamValue = 0;
  for (const c of eligibleAtThisSlot) {
    const candidatePlayer = roster.find((p) => p.id === c.playerId);
    if (!candidatePlayer) continue;
    const myFit = slotFit(candidatePlayer, input.currentPosition);
    const others = roster.filter(
      (p) =>
        p.id !== c.playerId &&
        p.visible !== false &&
        !usedPlayerIds.has(p.id) &&
        input.availablePlayerIds.has(p.id),
    );
    const futureValue = greedyAssignmentValue(others, futurePositions, slotFit);
    // Normalize: total possible is (futurePositions.length + 1) * 100. Convert
    // to 0..100 so it sits next to the other component bars.
    const slots = futurePositions.length + 1;
    const teamValue = Math.round(((myFit + futureValue) / (slots * 100)) * 1000) / 10;
    c.components.lookahead = teamValue;
    if (teamValue > bestTeamValue) bestTeamValue = teamValue;
  }
  for (const c of eligibleAtThisSlot) {
    c.components.lookaheadDelta = Math.round(
      (c.components.lookahead - bestTeamValue) * 10,
    ) / 10;
  }
  // Fold lookahead into the composite — small but meaningful nudge so the
  // team-optimal pick climbs ahead of "I have one good H2H but I'm needed
  // elsewhere later".
  for (const c of eligibleAtThisSlot) {
    // 0..-15-pt penalty proportional to how much team value we'd give up.
    // Cap at -15 so a single component doesn't fully dominate.
    const penalty = Math.max(c.components.lookaheadDelta * 0.5, -15);
    c.overall = Math.round((c.overall + penalty) * 10) / 10;
  }

  // Sort by overall (feasible first, then highest score).
  candidates.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    return b.overall - a.overall;
  });

  // ----- Save-for-later: opponent-roster awareness ------------------
  // For each candidate, find their "ideal upcoming matchup" by checking
  // which of the opponent's known players (a) haven't been thrown yet and
  // (b) would race against the candidate at higher race-equity than this
  // current putup. Higher race-equity for our player = closer race or
  // bigger handicap edge — strategically a better spot to use them.
  //
  // This is the right signal for "when to play your SL7": the ideal spot
  // is when their highest-SL player is up. If we know they have an SL7 on
  // the bench, hold ours.
  const usedOppNames = new Set(
    input.log.map((t) => (t.oppName ?? "").trim().toLowerCase()),
  );
  // The current putup is also "used" for the purpose of looking at what
  // remains AFTER this slot.
  usedOppNames.add(input.opponentName.trim().toLowerCase());
  const pendingOpponents = (input.opponentRoster ?? []).filter(
    (p) =>
      typeof p.latestSL === "number" &&
      !usedOppNames.has(p.name.trim().toLowerCase()),
  );
  const pendingHighestSL = pendingOpponents.length
    ? Math.max(...pendingOpponents.map((p) => p.latestSL!))
    : null;

  // For each candidate find their ideal pending opponent — the one with the
  // **closest SL**. APA strategy says match SLs as closely as possible:
  //   - Same-SL pairings are fair fights (50% race equity)
  //   - Sending a high-SL stud at a low-SL opponent wastes them (handicap
  //     hurts us AND skill edge isn't enough to break the chart)
  //   - Sending a low-SL underdog at a high-SL opponent gets the handicap
  //     edge but the skill gap means it's still a long shot in practice
  // So "ideal" = closest SL, not "best race equity". Race equity is what
  // gets DISPLAYED to explain the upgrade, but the trigger is SL distance.
  for (const c of candidates) {
    if (!c.feasible || typeof c.skillLevel !== "number") continue;
    const ourSL = c.skillLevel;
    const currentDiff = Math.abs(ourSL - input.opponentSkillLevel);
    let bestDiff = currentDiff;
    let bestOpp: { name: string; sl: number } | null = null;
    for (const op of pendingOpponents) {
      const diff = Math.abs(ourSL - op.latestSL!);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestOpp = { name: op.name, sl: op.latestSL! };
      }
    }
    c.idealUpcomingMatchup = bestOpp
      ? {
          opponentName: bestOpp.name,
          opponentSL: bestOpp.sl,
          raceEquityHere: raceEquity(ourSL, input.opponentSkillLevel),
          raceEquityThere: raceEquity(ourSL, bestOpp.sl),
        }
      : null;
  }

  // ----- Save-for-later (informed by lookahead + opponent roster) ----
  // A candidate gets the save-for-later flag when one of these holds:
  //   - lookaheadDelta ≤ -6: picking them costs ≥6 pts of team-wide value
  //   - idealUpcomingMatchup gives ≥15pp better race equity than current
  //     (e.g., our SL7 vs their SL2 = 22% equity, but their SL7 is still
  //     unthrown → using our SL7 now gives up a 28pp upgrade)
  // Combined with: there's an acceptable sub here, no must-win pressure,
  // not the anchor slot.
  const top = candidates.find((c) => c.feasible) ?? null;
  const acceptableSubs = candidates.filter(
    (c) => c.feasible && c !== top && c.overall >= 55,
  );
  const noPressure = urgency === "leverage" || urgency === "comfortable" || urgency === "even";

  if (top && acceptableSubs.length >= 1 && input.currentPosition < 5 && noPressure) {
    // Helper: does this candidate have a much closer-SL opponent pending?
    const slDiffUpgrade = (c: ThrowCandidate): number => {
      if (typeof c.skillLevel !== "number" || !c.idealUpcomingMatchup) return 0;
      const currentDiff = Math.abs(c.skillLevel - input.opponentSkillLevel);
      const idealDiff = Math.abs(c.skillLevel - c.idealUpcomingMatchup.opponentSL);
      return currentDiff - idealDiff;
    };
    // Flag any candidate whose ideal pending opponent is meaningfully closer
    // in SL than the current one. The trigger threshold is "≥ 3 SL closer" —
    // big enough that the upgrade matters strategically, not just slightly.
    // This is exactly the SL7-vs-SL2-when-their-SL7-is-pending case.
    for (const c of candidates) {
      if (!c.feasible || c.saveForLater) continue;
      const upgrade = slDiffUpgrade(c);
      const lookaheadCost = c === top && c.components.lookaheadDelta <= -6;
      const significantSLUpgrade = upgrade >= 3;
      if (significantSLUpgrade) {
        c.saveForLater = true;
        const ci = c.idealUpcomingMatchup!;
        c.reasoning.unshift(
          `Save for later — their SL${ci.opponentSL} (${ci.opponentName}) is still on the bench. SL${c.skillLevel} vs SL${ci.opponentSL} is a much closer race (${Math.round(ci.raceEquityThere)}%) than vs SL${input.opponentSkillLevel} here (${Math.round(ci.raceEquityHere)}%).`,
        );
      } else if (c === top && lookaheadCost) {
        // Fall back to lookahead-driven save when SL-upgrade isn't strong.
        c.saveForLater = true;
        const sub = acceptableSubs[0];
        c.reasoning.unshift(
          `Save for later — costs ~${Math.abs(c.components.lookaheadDelta).toFixed(1)} pts of lineup value to use here. ${sub.playerName} (${sub.overall}) is a viable sub.`,
        );
      }
    }
  }

  // Re-tag verdicts.
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.feasible) {
      c.verdict = "infeasible";
      continue;
    }
    if (c.saveForLater) {
      c.verdict = "save";
      continue;
    }
    if (i === 0) c.verdict = "top-pick";
    else if (c.overall >= 60) c.verdict = "strong";
    else if (c.overall >= 50) c.verdict = "viable";
    else c.verdict = "stretch";
  }

  // The top pick that ISN'T flagged save-for-later — that's what we lead with.
  const topPick = candidates.find((c) => c.feasible && !c.saveForLater) ?? null;

  // Min average SL across remaining slots if we use top pick — for the
  // narrative.
  let minAvgSLAfter = 0;
  if (topPick && typeof topPick.skillLevel === "number" && remainingPositionsAfter > 0) {
    const slLeft = remainingSLBudget - topPick.skillLevel;
    minAvgSLAfter = Math.round((slLeft / remainingPositionsAfter) * 10) / 10;
  }

  // Narrative.
  const narrativeBits: string[] = [];
  if (urgency === "must-win") {
    narrativeBits.push(
      `Down ${theirScore}-${ourScore} with ${remainingPositionsAfter + 1} match${remainingPositionsAfter === 0 ? "" : "es"} left — burn your best.`,
    );
  } else if (urgency === "comfortable") {
    narrativeBits.push(
      `Up ${ourScore}-${theirScore} — you can afford to save a stud for later.`,
    );
  } else if (urgency === "leverage") {
    narrativeBits.push(
      `Up ${ourScore}-${theirScore} — pressure their lineup.`,
    );
  } else if (urgency === "even") {
    if (input.log.length === 0) {
      narrativeBits.push("Opening match. Set the tone.");
    } else {
      narrativeBits.push(
        `Tied ${ourScore}-${theirScore} — every slot matters now.`,
      );
    }
  }
  narrativeBits.push(
    `${remainingSLBudget} SL left in the 23 budget across ${remainingPositionsAfter + 1} remaining slot${remainingPositionsAfter === 0 ? "" : "s"}.`,
  );
  if (topPick && topPick.saveForLater) {
    narrativeBits.push(
      `${topPick.playerName} is the highest-rated pick but probably better held for a tougher slot.`,
    );
  }
  // Surface their highest pending SL when notable.
  const opponentHighestPendingName = pendingOpponents.find(
    (p) => p.latestSL === pendingHighestSL,
  )?.name ?? null;
  if (
    pendingHighestSL !== null &&
    pendingHighestSL >= 6 &&
    pendingHighestSL > input.opponentSkillLevel
  ) {
    narrativeBits.push(
      `Their SL${pendingHighestSL}${opponentHighestPendingName ? ` (${opponentHighestPendingName})` : ""} is still on the bench — likely coming.`,
    );
  }
  // ----- Special-shots tiebreaker -----------------------------------
  // Among the feasible candidates, when overalls are within ~5 pts of each
  // other, prefer the one with the higher special-shots rate (sweeps,
  // mini-sweeps, B&Rs, 8-on-breaks) — they bring more leaderboard points
  // per match. Apply a tiny ranking nudge: up to +2 pts to overall for the
  // candidate with the highest special rate among feasibles.
  const feasibleNonSave = candidates.filter((c) => c.feasible && !c.saveForLater);
  if (feasibleNonSave.length > 1) {
    const maxSpecial = Math.max(
      0,
      ...feasibleNonSave.map((c) => c.specialShotsRate),
    );
    if (maxSpecial > 0) {
      for (const c of feasibleNonSave) {
        const fraction = c.specialShotsRate / maxSpecial;
        const bonus = Math.round(fraction * 2 * 10) / 10; // 0..2 pts
        c.overall = Math.round((c.overall + bonus) * 10) / 10;
      }
      // Re-sort to reflect tiebreaker.
      candidates.sort((a, b) => {
        if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
        if (a.saveForLater !== b.saveForLater) return a.saveForLater ? 1 : -1;
        return b.overall - a.overall;
      });
    }
  }

  // ----- Player rust flag -------------------------------------------
  // Players who haven't played in 6+ weeks have stale form data — surface
  // a warning so the captain factors it in.
  for (const c of candidates) {
    if (c.lastPlayedDaysAgo !== null && c.lastPlayedDaysAgo > 42) {
      c.flags.unshift(
        `Hasn't played in ${c.lastPlayedDaysAgo} days — form data may be stale.`,
      );
    }
  }

  // ----- Night win probability (per-candidate) ---------------------
  // Compute "night win prob if you pick THIS candidate" for every feasible
  // candidate. The recommendation uses the top non-saved candidate's value;
  // the rest power "what-if" comparisons in the UI when the user wonders
  // about overriding.
  // Each candidate's night-win-prob:
  //   - current slot uses their own matchupScore
  //   - future slots: greedy SL-pairing of remaining roster (without this
  //     candidate) vs opponent's pending bench
  const pendingOppSLs = pendingOpponents.map((p) => p.latestSL!);
  for (const c of candidates) {
    if (!c.feasible) continue;
    const remainingIfPicked = candidates.filter(
      (x) => x.feasible && x !== c,
    );
    const futureSlotProbs = estimateFutureSlotProbs(
      remainingIfPicked,
      pendingOppSLs,
    );
    const padded = futureSlotProbs.slice(0, remainingPositionsAfter);
    while (padded.length < remainingPositionsAfter) padded.push(0.5);
    const slotProbs = [c.matchupScore / 100, ...padded];
    c.nightWinProbIfPicked = Math.round(
      nightWinProbability(ourScore, theirScore, slotProbs) * 1000,
    ) / 10;
  }

  // Recommendation-level night win prob: take the recommended pick's value
  // (top non-saved feasible). CI uses its matchupScoreCI bounds.
  const topForNight = candidates.find((c) => c.feasible && !c.saveForLater);
  let nightWinProbCI: [number, number] = [0, 100];
  let nightWinProbPct = 50;
  if (topForNight) {
    nightWinProbPct = topForNight.nightWinProbIfPicked;
    const remainingForFuture = candidates.filter(
      (c) => c.feasible && c !== topForNight,
    );
    const futureSlotProbs = estimateFutureSlotProbs(
      remainingForFuture,
      pendingOppSLs,
    );
    const padded = futureSlotProbs.slice(0, remainingPositionsAfter);
    while (padded.length < remainingPositionsAfter) padded.push(0.5);
    const loProbs = [topForNight.matchupScoreCI[0] / 100, ...padded];
    const hiProbs = [topForNight.matchupScoreCI[1] / 100, ...padded];
    nightWinProbCI = [
      Math.round(nightWinProbability(ourScore, theirScore, loProbs) * 1000) / 10,
      Math.round(nightWinProbability(ourScore, theirScore, hiProbs) * 1000) / 10,
    ];
  }

  // Add a one-line night-prob summary to the narrative.
  if (topForNight) {
    if (ourScore >= 3) {
      narrativeBits.push("Match clinched.");
    } else if (theirScore >= 3) {
      narrativeBits.push("Match lost.");
    } else if (nightWinProbPct >= 80) {
      narrativeBits.push(`Night win prob: ${nightWinProbPct}% — looking strong.`);
    } else if (nightWinProbPct <= 25) {
      narrativeBits.push(`Night win prob: ${nightWinProbPct}% — uphill from here.`);
    } else {
      narrativeBits.push(`Night win prob: ${nightWinProbPct}%.`);
    }
  }

  const narrative = narrativeBits.join(" ");
  // Sort pending opponent SLs descending for "their bench" display.
  const pendingOpponentSLs = pendingOpponents
    .map((p) => p.latestSL!)
    .sort((a, b) => b - a);

  return {
    candidates,
    topPick,
    context: {
      remainingPositionsAfter,
      usedSLBudget,
      remainingSLBudget,
      minAvgSLAfter,
      ourScore,
      theirScore,
      urgency,
      narrative,
      opponentHighestPendingSL: pendingHighestSL,
      opponentHighestPendingName,
      nightWinProbability: nightWinProbPct,
      nightWinProbabilityCI: nightWinProbCI,
      pendingOpponentSLs,
    },
  };
}

/* ============================================================ OPENER (blind)
 *
 * When we put up first we don't know who they'll counter with. The opener
 * recommendation is a different beast than the counter-pick:
 *   - H2H drops out (no specific opponent yet)
 *   - vs SL drops out (we don't know their SL)
 *   - We rely on: form, vs-team baseline, slot fit, venue
 *   - "Don't burn your stud blind" — the algorithm prefers a mid-rated player
 *     when the gap to the top is small, and explicitly saves your aces for
 *     situations where you have actual H2H data on a known opponent putup.
 *
 * Same 23-rule + urgency + reasoning machinery as recommendThrow.
 */

export type OpenerAdvisorInput = {
  opponentTeam: string;
  location?: string;
  currentPosition: number;
  availablePlayerIds: Set<string>;
  log: ThrowMatchLog[];
  /**
   * Opponent team's known roster — used by the *adversarial* opener model.
   * When we throw first, the opponent counter-picks to MINIMIZE our win
   * probability. Knowing their pending players lets us predict the worst-
   * case counter for each of our candidates and rank by minimax.
   */
  opponentRoster?: Array<{ name: string; latestSL: number | null }>;
};

function scoreOpenerCandidate(
  player: Player,
  ctx: {
    matches: Match[];
    input: OpenerAdvisorInput;
    refDate: Date;
    isCurrentlyTight: boolean;
  },
): ThrowCandidate {
  const { matches, input, refDate, isCurrentlyTight } = ctx;
  const oppTeamKey = input.opponentTeam.trim().toLowerCase();
  const venueKey = (input.location ?? "").trim().toLowerCase();

  const acc = {
    vsTeam: { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 },
    venue: { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 },
    position: { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 },
    clutch: { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 },
  };
  const formOutcomes: Array<{ date: string; outcome: "W" | "L"; drift: number }> = [];
  let specialShotsTotal = 0;
  let specialShotsMatches = 0;
  let lastPlayedTs = 0;

  for (const m of matches) {
    if (m.status !== "completed") continue;
    const baseW = recencyWeight(m.date, refDate, THROW_RECENCY_HALFLIFE_DAYS);
    let scoreStates: Map<number, { ourBefore: number; theirBefore: number }> | null = null;
    for (const r of m.results) {
      if (r.playerId !== player.id) continue;
      // SL drift down-weighting (see scoreCandidate for rationale).
      const slDrift =
        typeof r.skillLevel === "number" &&
        typeof player.skillLevel === "number"
          ? Math.abs(r.skillLevel - player.skillLevel)
          : 0;
      const driftFactor =
        slDrift === 0 ? 1.0 : slDrift === 1 ? 0.65 : slDrift === 2 ? 0.40 : 0.25;
      const w = baseW * driftFactor;
      const won = r.outcome === "W";
      const isWin = won ? 1 : 0;
      const isLoss = won ? 0 : 1;
      const matchTs = +new Date(m.date);
      if (matchTs > lastPlayedTs) lastPlayedTs = matchTs;
      formOutcomes.push({ date: m.date, outcome: r.outcome, drift: driftFactor });

      specialShotsMatches += 1;
      if (r.sweep) specialShotsTotal += 1;
      else if (r.miniSweep) specialShotsTotal += 0.5;
      if (r.breakAndRun) specialShotsTotal += 1;
      if (r.eightOnBreak) specialShotsTotal += 1;

      if (typeof r.matchPosition === "number") {
        if (!scoreStates) scoreStates = teamScoreStatesBeforeMatch(m);
        const state = scoreStates.get(r.matchPosition);
        if (state && isTightTeamState(state.ourBefore, state.theirBefore)) {
          acc.clutch.wins += isWin * w;
          acc.clutch.losses += isLoss * w;
          acc.clutch.rawWins += isWin;
          acc.clutch.rawLosses += isLoss;
        }
      }

      if (oppTeamKey && (m.opponent ?? "").trim().toLowerCase() === oppTeamKey) {
        acc.vsTeam.wins += isWin * w;
        acc.vsTeam.losses += isLoss * w;
        acc.vsTeam.rawWins += isWin;
        acc.vsTeam.rawLosses += isLoss;
      }
      if (venueKey && (m.location ?? "").trim().toLowerCase() === venueKey) {
        acc.venue.wins += isWin * w;
        acc.venue.losses += isLoss * w;
        acc.venue.rawWins += isWin;
        acc.venue.rawLosses += isLoss;
      }
      if (r.matchPosition === input.currentPosition) {
        acc.position.wins += isWin * w;
        acc.position.losses += isLoss * w;
        acc.position.rawWins += isWin;
        acc.position.rawLosses += isLoss;
      }
    }
  }

  const sortedForm = formOutcomes
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .slice(-THROW_FORM_WINDOW);
  const formWeighted = { wins: 0, losses: 0, rawWins: 0, rawLosses: 0 };
  for (const f of sortedForm) {
    const w = recencyWeight(f.date, refDate, THROW_FORM_HALFLIFE_DAYS) * f.drift;
    if (f.outcome === "W") {
      formWeighted.wins += w;
      formWeighted.rawWins += 1;
    } else {
      formWeighted.losses += w;
      formWeighted.rawLosses += 1;
    }
  }
  // Current streak — see scoreCandidate for explanation.
  const sortedFormDescOpener = [...formOutcomes].sort(
    (a, b) => +new Date(b.date) - +new Date(a.date),
  );
  let openerStreakType: "W" | "L" | null = null;
  let openerStreakLength = 0;
  for (const f of sortedFormDescOpener) {
    if (openerStreakType === null) {
      openerStreakType = f.outcome;
      openerStreakLength = 1;
    } else if (f.outcome === openerStreakType) {
      openerStreakLength++;
    } else {
      break;
    }
  }
  const openerCurrentStreak: { type: "W" | "L"; length: number } | null =
    openerStreakType !== null && openerStreakLength > 0
      ? { type: openerStreakType, length: openerStreakLength }
      : null;

  const components = {
    h2h: emptyComponent(),
    vsSL: emptyComponent(),
    vsTeam: buildComponent(acc.vsTeam),
    venue: buildComponent(acc.venue),
    form: buildComponent(formWeighted),
    position: buildComponent(acc.position),
    clutch: buildComponent(acc.clutch),
    raceEquity: 50, // unknown opponent SL → neutral
    lookahead: 0,
    lookaheadDelta: 0,
  };

  // Blind opener: same Bayesian log-odds blending, but the prior is a true
  // 50% (opponent SL unknown, no race-chart anchor) and H2H/vs-SL drop out.
  // Form, vs-team, slot are the only evidence. Use computeWinProbability
  // directly — it gracefully ignores no-data components.
  const { matchupScore, ci: matchupScoreCI } = computeWinProbability(
    components,
    isCurrentlyTight,
    openerCurrentStreak,
  );
  const overall = matchupScore;
  const specialShotsRate =
    specialShotsMatches > 0 ? specialShotsTotal / specialShotsMatches : 0;
  const lastPlayedDaysAgo =
    lastPlayedTs > 0
      ? Math.round((refDate.getTime() - lastPlayedTs) / 86_400_000)
      : null;

  const reasons: string[] = [];
  const flags: string[] = [];
  const verb = (rate: number) => {
    if (rate >= 70) return "strong";
    if (rate >= 55) return "solid";
    if (rate >= 45) return "even";
    if (rate >= 30) return "below-even";
    return "rough";
  };

  if (!components.form.noData) {
    reasons.push(
      `Recent form: ${components.form.wins}-${components.form.losses} over last ${components.form.matches} (${components.form.rate}%)`,
    );
  }
  if (!components.vsTeam.noData && components.vsTeam.matches >= 2) {
    reasons.push(
      `${verb(components.vsTeam.rate)} vs ${input.opponentTeam}: ${components.vsTeam.wins}-${components.vsTeam.losses}`,
    );
  } else {
    flags.push(`No prior data vs ${input.opponentTeam}`);
  }
  if (!components.position.noData && components.position.matches >= 2) {
    reasons.push(
      `Slot ${input.currentPosition} record: ${components.position.wins}-${components.position.losses} (${components.position.rate}%)`,
    );
  }
  if (!components.venue.noData && components.venue.matches >= 2 && input.location) {
    reasons.push(
      `${verb(components.venue.rate)} at ${input.location}`,
    );
  }
  if (
    components.form.noData &&
    components.vsTeam.noData &&
    components.position.noData
  ) {
    flags.push("No data — going on prior alone");
  }
  flags.push("Blind throw: their SL is unknown, race equity assumed neutral");

  return {
    playerId: player.id,
    playerName: player.name,
    skillLevel: player.skillLevel,
    overall,
    matchupScore, // blind win-prob (no H2H/vsSL evidence; race equity is neutral 50)
    matchupScoreCI,
    specialShotsRate,
    lastPlayedDaysAgo,
    currentStreak: openerCurrentStreak,
    nightWinProbIfPicked: 0, // filled in later by recommendOpener
    h2hHistory: [], // blind/opener mode — no opponent named yet
    verdict: "viable",
    components,
    reasoning: reasons,
    flags,
    feasible: true,
    saveForLater: false,
  };
}

export function recommendOpener(
  input: OpenerAdvisorInput,
  matches: Match[],
  roster: Player[],
  refDate: Date = new Date(),
): ThrowAdvisorResult {
  const usedSLBudget = input.log.reduce(
    (s, t) => s + (t.ourSkillLevel ?? 0),
    0,
  );
  // Team-match points (per APA 8-ball: sweep=3, mini=2, hill-hill=2-1).
  const teamScore = tallyTeamScore(input.log);
  const ourScore = teamScore.our;
  const theirScore = teamScore.their;
  const positionsLockedIn = new Set(input.log.map((t) => t.position));
  const remainingPositions = [1, 2, 3, 4, 5].filter(
    (p) => !positionsLockedIn.has(p) && p !== input.currentPosition,
  );
  const remainingPositionsAfter = remainingPositions.length;
  const remainingSLBudget = APA_SL_BUDGET - usedSLBudget;
  const urgency = urgencyFor(ourScore, theirScore, remainingPositionsAfter);
  const isCurrentlyTight = isTightTeamState(ourScore, theirScore);

  const usedPlayerIds = new Set(input.log.map((t) => t.ourPlayerId));
  const eligible = roster.filter(
    (p) =>
      p.visible !== false &&
      !usedPlayerIds.has(p.id) &&
      input.availablePlayerIds.has(p.id),
  );
  const candidates = eligible.map((p) =>
    scoreOpenerCandidate(p, { matches, input, refDate, isCurrentlyTight }),
  );

  // ----- Adversarial opener model -----------------------------------
  // When we throw blind, the opponent will counter-pick to MINIMIZE our
  // win probability. For each candidate, find their worst-case counter
  // among the opponent's pending roster, then use the resulting
  // worst-case win probability as the candidate's matchup score.
  // This is a minimax: pick the candidate whose worst-case counter
  // gives us the best worst-case win prob. Classic APA opener strategy.
  const usedOppNamesOpener = new Set(
    input.log.map((t) => (t.oppName ?? "").trim().toLowerCase()),
  );
  const pendingOppOpener = (input.opponentRoster ?? []).filter(
    (p) =>
      typeof p.latestSL === "number" &&
      !usedOppNamesOpener.has(p.name.trim().toLowerCase()),
  );
  if (pendingOppOpener.length > 0) {
    for (const c of candidates) {
      if (typeof c.skillLevel !== "number") continue;
      let worstProb = c.matchupScore;
      let worstCounter: { name: string; sl: number } | null = null;
      for (const op of pendingOppOpener) {
        const sl = op.latestSL!;
        const wp = hypotheticalWinProbability(c, sl, isCurrentlyTight);
        if (wp < worstProb) {
          worstProb = wp;
          worstCounter = { name: op.name, sl };
        }
      }
      if (worstCounter) {
        c.matchupScore = Math.round(worstProb * 10) / 10;
        c.overall = c.matchupScore;
        c.reasoning.unshift(
          `Likely counter: SL${worstCounter.sl} (${worstCounter.name}) — they'll throw their toughest matchup vs SL${c.skillLevel}.`,
        );
      }
    }
  }

  // 23-rule feasibility (same logic as recommendThrow).
  const otherSLs = candidates
    .map((c) => c.skillLevel)
    .filter((sl): sl is number => typeof sl === "number")
    .sort((a, b) => a - b);
  for (const c of candidates) {
    if (typeof c.skillLevel !== "number") continue;
    const slLeft = remainingSLBudget - c.skillLevel;
    if (slLeft < 0) {
      c.feasible = false;
      c.feasibilityNote = `SL${c.skillLevel} blows the 23-rule budget (${remainingSLBudget} left).`;
      c.flags.push(c.feasibilityNote);
      continue;
    }
    if (remainingPositionsAfter === 0) continue;
    const ms = [...otherSLs];
    const idx = ms.indexOf(c.skillLevel);
    if (idx >= 0) ms.splice(idx, 1);
    const need = remainingPositionsAfter;
    if (ms.length < need) {
      c.flags.push(
        `Only ${ms.length} other player${ms.length === 1 ? "" : "s"} available for the remaining ${need} slot${need === 1 ? "" : "s"} — confirm subs.`,
      );
      continue;
    }
    const minSumAfter = ms.slice(0, need).reduce((s, v) => s + v, 0);
    if (minSumAfter > slLeft) {
      c.feasible = false;
      c.feasibilityNote = `Picking SL${c.skillLevel} here forces the rest over the 23-rule budget (need at least ${minSumAfter} more; only ${slLeft} left).`;
      c.flags.push(c.feasibilityNote);
    }
  }

  // Lookahead — same algorithm as recommendThrow.
  const futurePositions = remainingPositions.slice();
  const eligibleAtThisSlot = candidates.filter((c) => c.feasible);
  const slotFitMemo = new Map<string, number>();
  const slotFit = (p: Player, pos: number) => {
    const key = `${p.id}|${pos}`;
    let v = slotFitMemo.get(key);
    if (v === undefined) {
      v = slotFitScore(p, pos, matches, refDate);
      slotFitMemo.set(key, v);
    }
    return v;
  };
  let bestTeamValue = 0;
  for (const c of eligibleAtThisSlot) {
    const candidatePlayer = roster.find((p) => p.id === c.playerId);
    if (!candidatePlayer) continue;
    const myFit = slotFit(candidatePlayer, input.currentPosition);
    const others = roster.filter(
      (p) =>
        p.id !== c.playerId &&
        p.visible !== false &&
        !usedPlayerIds.has(p.id) &&
        input.availablePlayerIds.has(p.id),
    );
    const futureValue = greedyAssignmentValue(others, futurePositions, slotFit);
    const slots = futurePositions.length + 1;
    const teamValue = Math.round(((myFit + futureValue) / (slots * 100)) * 1000) / 10;
    c.components.lookahead = teamValue;
    if (teamValue > bestTeamValue) bestTeamValue = teamValue;
  }
  for (const c of eligibleAtThisSlot) {
    c.components.lookaheadDelta = Math.round(
      (c.components.lookahead - bestTeamValue) * 10,
    ) / 10;
  }
  for (const c of eligibleAtThisSlot) {
    const penalty = Math.max(c.components.lookaheadDelta * 0.5, -15);
    c.overall = Math.round((c.overall + penalty) * 10) / 10;
  }

  candidates.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    return b.overall - a.overall;
  });

  // Blind-throw save logic: we're eager to save aces when we don't know who
  // they're putting up. Use lookahead delta as the primary signal.
  const top = candidates.find((c) => c.feasible) ?? null;
  const acceptableSubs = candidates.filter(
    (c) => c.feasible && c !== top && c.overall >= 50,
  );
  const noPressure = urgency === "leverage" || urgency === "comfortable" || urgency === "even";
  if (
    top &&
    top.components.lookaheadDelta <= -4 &&
    acceptableSubs.length >= 1 &&
    input.currentPosition < 5 &&
    noPressure
  ) {
    top.saveForLater = true;
    const sub = acceptableSubs[0];
    top.reasoning.unshift(
      `Hold ${top.playerName.split(" ")[0]} for a known counter — costs ~${Math.abs(top.components.lookaheadDelta).toFixed(1)} pts of lineup value to use blind. ${sub.playerName} (${sub.overall}) is a solid opener.`,
    );
  }

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.feasible) {
      c.verdict = "infeasible";
      continue;
    }
    if (c.saveForLater) {
      c.verdict = "save";
      continue;
    }
    if (i === 0) c.verdict = "top-pick";
    else if (c.overall >= 60) c.verdict = "strong";
    else if (c.overall >= 50) c.verdict = "viable";
    else c.verdict = "stretch";
  }

  const topPick = candidates.find((c) => c.feasible && !c.saveForLater) ?? null;
  let minAvgSLAfter = 0;
  if (topPick && typeof topPick.skillLevel === "number" && remainingPositionsAfter > 0) {
    const slLeft = remainingSLBudget - topPick.skillLevel;
    minAvgSLAfter = Math.round((slLeft / remainingPositionsAfter) * 10) / 10;
  }

  const narrativeBits: string[] = [];
  if (urgency === "must-win") {
    narrativeBits.push(
      `Down ${theirScore}-${ourScore} — even blind, send your most reliable player.`,
    );
  } else if (urgency === "comfortable") {
    narrativeBits.push(
      `Up ${ourScore}-${theirScore} — opener doesn't need to be your best; keep aces dry for a known counter.`,
    );
  } else if (urgency === "leverage") {
    narrativeBits.push(
      `Up ${ourScore}-${theirScore} — solid opener keeps the foot on their throat.`,
    );
  } else if (urgency === "even") {
    if (input.log.length === 0) {
      narrativeBits.push("First putup. Don't tip your hand — opener should be a steady mid-tier pick.");
    } else {
      narrativeBits.push(
        `Tied ${ourScore}-${theirScore} — pick blind but reliable.`,
      );
    }
  }
  narrativeBits.push(
    `${remainingSLBudget} SL left across ${remainingPositionsAfter + 1} remaining slot${remainingPositionsAfter === 0 ? "" : "s"}.`,
  );
  if (topPick && topPick.saveForLater) {
    narrativeBits.push(
      `${topPick.playerName} is the highest-rated, but better held until we know who they're putting up.`,
    );
  }

  // Opener: per-candidate night-win-prob (powers what-if comparisons).
  //   - CURRENT slot uses the candidate's adversarial matchupScore.
  //   - FUTURE slots use a *neutral* estimate (median pending opp SL) — APA
  //     throw order alternates, so future slots average between adversarial
  //     and counter-pick scenarios.
  const pendingSLsSorted = pendingOppOpener
    .map((p) => p.latestSL!)
    .sort((a, b) => a - b);
  const medianPendingSL =
    pendingSLsSorted.length > 0
      ? pendingSLsSorted[Math.floor(pendingSLsSorted.length / 2)]
      : 4;
  for (const c of candidates) {
    if (!c.feasible) continue;
    const remainingIfPicked = candidates.filter(
      (x) => x.feasible && x !== c,
    );
    const futureProbs = remainingIfPicked
      .slice(0, remainingPositionsAfter)
      .map((x) =>
        typeof x.skillLevel === "number"
          ? hypotheticalWinProbability(x, medianPendingSL, isCurrentlyTight) / 100
          : x.matchupScore / 100,
      );
    while (futureProbs.length < remainingPositionsAfter) futureProbs.push(0.5);
    const slotProbs = [c.matchupScore / 100, ...futureProbs];
    c.nightWinProbIfPicked = Math.round(
      nightWinProbability(ourScore, theirScore, slotProbs) * 1000,
    ) / 10;
  }
  let openerNightProb = 0.5;
  let openerNightCI: [number, number] = [0, 100];
  const topForNight = candidates.find((c) => c.feasible && !c.saveForLater);
  if (topForNight) {
    openerNightProb = topForNight.nightWinProbIfPicked / 100;
    const remainingForFuture = candidates.filter(
      (c) => c.feasible && c !== topForNight,
    );
    const futureProbs = remainingForFuture
      .slice(0, remainingPositionsAfter)
      .map((c) =>
        typeof c.skillLevel === "number"
          ? hypotheticalWinProbability(c, medianPendingSL, isCurrentlyTight) / 100
          : c.matchupScore / 100,
      );
    while (futureProbs.length < remainingPositionsAfter) futureProbs.push(0.5);
    const loProbs = [topForNight.matchupScoreCI[0] / 100, ...futureProbs];
    const hiProbs = [topForNight.matchupScoreCI[1] / 100, ...futureProbs];
    openerNightCI = [
      Math.round(nightWinProbability(ourScore, theirScore, loProbs) * 1000) / 10,
      Math.round(nightWinProbability(ourScore, theirScore, hiProbs) * 1000) / 10,
    ];
  }

  return {
    candidates,
    topPick,
    context: {
      remainingPositionsAfter,
      usedSLBudget,
      remainingSLBudget,
      minAvgSLAfter,
      ourScore,
      theirScore,
      urgency,
      narrative: narrativeBits.join(" "),
      // Opener doesn't peek at the opponent roster (we don't know who's
      // coming up since they'll be reacting to our pick).
      opponentHighestPendingSL: null,
      opponentHighestPendingName: null,
      nightWinProbability: Math.round(openerNightProb * 1000) / 10,
      nightWinProbabilityCI: openerNightCI,
      pendingOpponentSLs: [],
    },
  };
}

/* ---------------- Server-side prep for the Throw Advisor UI ---------------- */

export type ThrowAdvisorOpponentInfo = {
  /** Opponent team name we have history against. */
  team: string;
  /** Opponent player names we've recorded SLs/positions for. */
  knownPlayers: Array<{
    name: string;
    latestSL: number | null;
    /** Most-common slot they put up at. */
    preferredPosition: number | null;
  }>;
};

/**
 * Pre-computes per-opponent autocomplete data for the Throw Advisor UI:
 * known putup players + their latest skill level. Saves the user from typing
 * SLs every time and reduces typos. The UI still allows free-form override.
 */
export function throwAdvisorOpponents(
  matches: Match[],
): ThrowAdvisorOpponentInfo[] {
  const teams = new Map<
    string,
    Map<
      string,
      { latestSL: number | null; latestSLDate: number; positions: Map<number, number> }
    >
  >();
  for (const m of matches) {
    if (m.status !== "completed") continue;
    if (!m.opponent || m.opponent === "BYE") continue;
    let team = teams.get(m.opponent);
    if (!team) {
      team = new Map();
      teams.set(m.opponent, team);
    }
    const ts = +new Date(m.date);
    for (const r of m.results) {
      const name = (r.opponentName ?? "").trim();
      if (!name || name === "Opponent") continue;
      let entry = team.get(name);
      if (!entry) {
        entry = { latestSL: null, latestSLDate: 0, positions: new Map() };
        team.set(name, entry);
      }
      if (
        typeof r.opponentSkillLevel === "number" &&
        r.opponentSkillLevel > 0 &&
        ts >= entry.latestSLDate
      ) {
        entry.latestSL = r.opponentSkillLevel;
        entry.latestSLDate = ts;
      }
      if (typeof r.matchPosition === "number") {
        entry.positions.set(
          r.matchPosition,
          (entry.positions.get(r.matchPosition) ?? 0) + 1,
        );
      }
    }
  }
  const out: ThrowAdvisorOpponentInfo[] = [];
  for (const [teamName, players] of teams) {
    const knownPlayers = [...players.entries()].map(([name, e]) => {
      const positions = [...e.positions.entries()].sort((a, b) => b[1] - a[1]);
      return {
        name,
        latestSL: e.latestSL,
        preferredPosition: positions[0]?.[0] ?? null,
      };
    });
    knownPlayers.sort((a, b) => a.name.localeCompare(b.name));
    out.push({ team: teamName, knownPlayers });
  }
  out.sort((a, b) => a.team.localeCompare(b.team));
  return out;
}

/* ============================================================ SCOUTING REPORT
 *
 * In-depth pre-match scouting on the opponent team — drives the Briefing
 * tab. Aggregates everything our scoresheets reveal about them:
 *   - Team record vs us (this session + lifetime)
 *   - Per-player: SL, record vs us, win rate, recent form, preferred slot,
 *     suspected real SL based on game-score margins
 *   - Hot / cold flags per player
 *   - Their lineup tendencies (high-SL slot patterns)
 */

export type OpponentScoutingPlayer = {
  name: string;
  /** Player id when we have a scraped profile — links to /players/[id]. */
  playerId: string | null;
  /** Latest SL we've seen them at. */
  latestSL: number | null;
  /** Career record against us. */
  vsUs: { wins: number; losses: number; winPct: number };
  /** Career record across the league (only when scraped via opp scraper). */
  career: { wins: number; losses: number; matchesPlayed: number; winPct: number } | null;
  /** Per-session SL trajectory (only when scraped). Latest first. */
  slTrajectory: Array<{ sessionName: string; skillLevel: number | null; matchesPlayed: number; winPct?: number }>;
  /** Most-recent N matches vs us (oldest → newest), bounded to 6. */
  recent: Array<"W" | "L">;
  /** Form trend: hot/cold/steady based on recent vs lifetime. */
  trend: "hot" | "cold" | "steady";
  /** Slot they put up at most often. */
  preferredPosition: number | null;
  /** Average game margin (their wins minus our wins) when they win — large
   *  margin suggests they're playing above their stated SL. */
  avgWinMargin: number;
  /** Suspected real SL — if their average game-margin against same-SL opps
   *  is well above what the race chart would predict for an "average" player
   *  at their SL, they're probably underrated. Null if we can't tell. */
  suspectedRealSL: number | null;
  /** Top counter on our roster (the player who beats them most). */
  topCounter: { playerId: string; playerName: string; wins: number; losses: number } | null;
  /**
   * Every individual match between our roster and this opp player. Drives
   * the expandable "match history" dropdown in the scouting card.
   */
  matchHistory: Array<{
    matchId: string;
    date: string;
    /** From our perspective. */
    outcome: "W" | "L";
    ourPlayerId: string;
    ourPlayerName: string;
    ourSL: number | null;
    theirSL: number | null;
    /** Game score "ourGames-theirGames" if recorded. */
    score: string | null;
    matchPosition: number | null;
  }>;
};

export type OpponentScoutingReport = {
  team: string;
  /** Our team record vs them across the in-scope sessions. */
  vsUs: { wins: number; losses: number; winPct: number };
  /** Our team record vs them this session only (matches w/ sessionId == currentSessionId). */
  vsUsThisSession: { wins: number; losses: number; winPct: number } | null;
  /** Per-player scouting. */
  players: OpponentScoutingPlayer[];
  /** Their highest-SL putup we've seen — drives strategy. */
  topSL: number | null;
  /** Aggregate win % vs us across all their players (individual-level). */
  individualWinPctVsUs: number;
};

export function opponentScoutingReport(
  opponentTeam: string,
  matches: Match[],
  roster: Player[],
  currentSessionId?: number,
  /**
   * Map of opponent player profiles (from snapshot.opponentPlayers).
   * Optional — when present, enriches the per-player section with full
   * career stats and per-session SL trajectory pulled from the league API.
   */
  opponentPlayers?: Record<string, import("@/lib/apa/schemas").PlayerProfile>,
): OpponentScoutingReport {
  const teamKey = opponentTeam.trim().toLowerCase();
  const matchesVsThem = matches.filter(
    (m) =>
      m.status === "completed" &&
      (m.opponent ?? "").trim().toLowerCase() === teamKey,
  );

  // Team-level record vs them.
  let teamW = 0;
  let teamL = 0;
  let teamWThisSession = 0;
  let teamLThisSession = 0;
  for (const m of matchesVsThem) {
    if (typeof m.teamScore !== "number" || typeof m.opponentScore !== "number") continue;
    const isThisSession =
      currentSessionId !== undefined && m.sessionId === currentSessionId;
    if (m.teamScore > m.opponentScore) {
      teamW++;
      if (isThisSession) teamWThisSession++;
    } else if (m.teamScore < m.opponentScore) {
      teamL++;
      if (isThisSession) teamLThisSession++;
    }
  }

  // Per-opponent-player aggregation.
  type Bucket = {
    name: string;
    /** Each individual match outcome from THEIR perspective (W = they won vs us). */
    outcomes: Array<{ matchId: string; date: string; theirWon: boolean; theirGames: number; ourGames: number; ourSL?: number; theirSL?: number; matchPosition?: number; ourPlayerId: string; ourPlayerName: string }>;
    slMap: Map<number, number>; // SL → count
    posMap: Map<number, number>; // position → count
    counters: Map<string, { id: string; name: string; ourWins: number; ourLosses: number }>;
  };
  const buckets = new Map<string, Bucket>();

  for (const m of matchesVsThem) {
    for (const r of m.results) {
      const theirName = (r.opponentName ?? "").trim();
      if (!theirName || theirName === "Opponent") continue;
      let bucket = buckets.get(theirName);
      if (!bucket) {
        bucket = {
          name: theirName,
          outcomes: [],
          slMap: new Map(),
          posMap: new Map(),
          counters: new Map(),
        };
        buckets.set(theirName, bucket);
      }
      const theirSL = r.opponentSkillLevel;
      const ourSL = r.skillLevel;
      const theirWon = r.outcome === "L"; // From our perspective, "L" means they beat us
      // Game scores: r.score is "ourGames-theirGames"
      let ourGames = 0;
      let theirGames = 0;
      if (r.score && r.score.includes("-")) {
        const [a, b] = r.score.split("-").map((s) => parseInt(s, 10));
        if (Number.isFinite(a)) ourGames = a;
        if (Number.isFinite(b)) theirGames = b;
      }
      bucket.outcomes.push({
        matchId: m.id,
        date: m.date,
        theirWon,
        theirGames,
        ourGames,
        ourSL: ourSL ?? undefined,
        theirSL: theirSL ?? undefined,
        matchPosition: r.matchPosition ?? undefined,
        ourPlayerId: r.playerId,
        ourPlayerName: r.playerName,
      });
      if (typeof theirSL === "number") {
        bucket.slMap.set(theirSL, (bucket.slMap.get(theirSL) ?? 0) + 1);
      }
      if (typeof r.matchPosition === "number") {
        bucket.posMap.set(
          r.matchPosition,
          (bucket.posMap.get(r.matchPosition) ?? 0) + 1,
        );
      }
      // Track our players who faced them.
      const counter = bucket.counters.get(r.playerId) ?? {
        id: r.playerId,
        name: r.playerName,
        ourWins: 0,
        ourLosses: 0,
      };
      if (r.outcome === "W") counter.ourWins++;
      else counter.ourLosses++;
      bucket.counters.set(r.playerId, counter);
    }
  }

  // Build OpponentScoutingPlayer entries.
  const players: OpponentScoutingPlayer[] = [];
  let totalIndW = 0;
  let totalIndL = 0;
  let topSLObserved = 0;
  for (const b of buckets.values()) {
    const wins = b.outcomes.filter((o) => o.theirWon).length;
    const losses = b.outcomes.filter((o) => !o.theirWon).length;
    totalIndW += losses; // OUR wins against them
    totalIndL += wins; // OUR losses to them
    const winPct =
      wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : 0;
    // Latest SL = most recent match's SL we have (chronologically).
    const sorted = [...b.outcomes].sort(
      (a, c) => +new Date(c.date) - +new Date(a.date),
    );
    const latestSL = sorted.find((o) => typeof o.theirSL === "number")?.theirSL ?? null;
    if (latestSL !== null) topSLObserved = Math.max(topSLObserved, latestSL);
    // Recent form (last 6 matches, chronological).
    const recent: Array<"W" | "L"> = sorted
      .slice(0, 6)
      .reverse()
      .map((o) => (o.theirWon ? "W" : "L"));
    // Trend: compare last 4 win rate to lifetime.
    const last4 = sorted.slice(0, 4);
    const last4WinPct =
      last4.length > 0
        ? last4.filter((o) => o.theirWon).length / last4.length
        : 0;
    const lifetimeWinPct = wins / Math.max(1, wins + losses);
    let trend: "hot" | "cold" | "steady" = "steady";
    if (last4.length >= 3) {
      if (last4WinPct - lifetimeWinPct >= 0.20) trend = "hot";
      else if (last4WinPct - lifetimeWinPct <= -0.20) trend = "cold";
    }
    // Preferred position (most-played).
    const positions = [...b.posMap.entries()].sort((a, c) => c[1] - a[1]);
    const preferredPosition = positions[0]?.[0] ?? null;
    // Average margin when they won.
    const winsList = b.outcomes.filter((o) => o.theirWon);
    const avgWinMargin =
      winsList.length > 0
        ? winsList.reduce((s, o) => s + (o.theirGames - o.ourGames), 0) /
          winsList.length
        : 0;
    // Suspected real SL: if average win margin vs same-SL opponents is wide
    // (≥ 2 games beyond the race chart's expected margin), suggest a +1 SL.
    let suspectedRealSL: number | null = null;
    if (latestSL !== null && winsList.length >= 3) {
      // For an "average" player at their SL, expected margin vs same-SL = 1
      // (race target − loser's typical hill). If avgWinMargin ≥ 2.5, bump.
      if (avgWinMargin >= 3.0 && latestSL < 7) suspectedRealSL = latestSL + 1;
      else if (avgWinMargin >= 4.0 && latestSL < 6)
        suspectedRealSL = latestSL + 2;
    }
    // Top counter from our roster.
    const ourCounters = [...b.counters.values()]
      .filter((c) => roster.some((p) => p.id === c.id && p.visible !== false))
      .sort(
        (a, c) =>
          c.ourWins - a.ourWins ||
          c.ourWins / Math.max(1, c.ourWins + c.ourLosses) -
            a.ourWins / Math.max(1, a.ourWins + a.ourLosses),
      );
    const topCounter =
      ourCounters[0] && ourCounters[0].ourWins > 0
        ? {
            playerId: ourCounters[0].id,
            playerName: ourCounters[0].name,
            wins: ourCounters[0].ourWins,
            losses: ourCounters[0].ourLosses,
          }
        : null;
    // Enrich with scraped opp player profile when available — gives us their
    // FULL career stats (across the whole league, not just vs us) plus SL
    // trajectory across sessions.
    let playerId: string | null = null;
    let careerEnrichment: OpponentScoutingPlayer["career"] = null;
    let slTrajectory: OpponentScoutingPlayer["slTrajectory"] = [];
    if (opponentPlayers) {
      // Find by name match (we don't have a stable id from scoresheets — APA
      // scoresheets give the opponent display name only).
      const match = Object.values(opponentPlayers).find(
        (op) => op.name.trim().toLowerCase() === b.name.trim().toLowerCase(),
      );
      if (match) {
        playerId = match.id;
        careerEnrichment = {
          wins: match.career.wins,
          losses: match.career.losses,
          matchesPlayed: match.career.matchesPlayed,
          winPct: match.career.winPct,
        };
        slTrajectory = match.sessions
          .slice(0, 6)
          .map((s) => ({
            sessionName: s.sessionName,
            skillLevel: s.skillLevel ?? null,
            matchesPlayed: s.matchesPlayed ?? 0,
            winPct: s.winPct,
          }));
      }
    }
    // Per-match history vs our roster, newest first.
    const matchHistory = [...b.outcomes]
      .sort((a, c) => +new Date(c.date) - +new Date(a.date))
      .map((o) => ({
        matchId: o.matchId,
        date: o.date,
        outcome: (o.theirWon ? "L" : "W") as "W" | "L",
        ourPlayerId: o.ourPlayerId,
        ourPlayerName: o.ourPlayerName,
        ourSL: o.ourSL ?? null,
        theirSL: o.theirSL ?? null,
        score:
          o.ourGames || o.theirGames
            ? `${o.ourGames}-${o.theirGames}`
            : null,
        matchPosition: o.matchPosition ?? null,
      }));
    players.push({
      name: b.name,
      playerId,
      latestSL,
      vsUs: { wins, losses, winPct },
      career: careerEnrichment,
      slTrajectory,
      recent,
      trend,
      preferredPosition,
      avgWinMargin: Math.round(avgWinMargin * 10) / 10,
      suspectedRealSL,
      topCounter,
      matchHistory,
    });
  }
  // Sort: hot players first, then by appearances (proxy for "how often we'll see them").
  players.sort((a, b) => {
    const at = a.trend === "hot" ? 0 : a.trend === "steady" ? 1 : 2;
    const bt = b.trend === "hot" ? 0 : b.trend === "steady" ? 1 : 2;
    if (at !== bt) return at - bt;
    return (b.vsUs.wins + b.vsUs.losses) - (a.vsUs.wins + a.vsUs.losses);
  });

  const teamWinPct =
    teamW + teamL > 0 ? Math.round((teamW / (teamW + teamL)) * 1000) / 10 : 0;
  const sessionTeamRecord =
    teamWThisSession + teamLThisSession > 0
      ? {
          wins: teamWThisSession,
          losses: teamLThisSession,
          winPct:
            Math.round(
              (teamWThisSession / (teamWThisSession + teamLThisSession)) * 1000,
            ) / 10,
        }
      : null;

  return {
    team: opponentTeam,
    vsUs: { wins: teamW, losses: teamL, winPct: teamWinPct },
    vsUsThisSession: sessionTeamRecord,
    players,
    topSL: topSLObserved > 0 ? topSLObserved : null,
    individualWinPctVsUs:
      totalIndW + totalIndL > 0
        ? Math.round((totalIndW / (totalIndW + totalIndL)) * 1000) / 10
        : 0,
  };
}

/* ============================================================ PREDICTED LINEUP
 *
 * Build a 5-slot prediction of how the night could play out under each
 * starting throw order (we-throw-first vs they-throw-first). Each slot
 * alternates per APA rule. Per slot:
 *   - If we throw first: pick our blind opener (recommendOpener-style),
 *     then predict their counter (their not-yet-used player whose race
 *     equity vs our pick is best for them).
 *   - If they throw first: predict their putup (their highest-SL not-yet-
 *     used player, then fall back to preferred-slot heuristics), then
 *     pick our counter (recommendThrow-style).
 *
 * Output is a list of 5 PredictedSlot entries with the matchup, the
 * predicted win prob, and which side picked first that slot.
 */

export type PredictedSlot = {
  position: number;
  weThrowFirst: boolean;
  ourPlayerId: string | null;
  ourPlayerName: string;
  ourSkillLevel: number | null;
  oppName: string | null;
  oppSL: number | null;
  /** 0..100 win probability for our pick at this slot. */
  winProb: number;
};

export type PredictedLineup = {
  scenario: "we-first" | "they-first";
  slots: PredictedSlot[];
  /** Our predicted total team-match points. */
  ourPoints: number;
  /** Opp's predicted total team-match points. */
  theirPoints: number;
  /** Probability we win the team match. */
  nightWinProbability: number;
};

export function predictLineup(
  scenario: "we-first" | "they-first",
  matches: Match[],
  roster: Player[],
  opponentTeam: string,
  opponentRoster: Array<{ name: string; latestSL: number | null; preferredPosition?: number | null }>,
  location?: string,
  refDate: Date = new Date(),
): PredictedLineup {
  const usedOurIds = new Set<string>();
  const usedOppNames = new Set<string>();
  const slots: PredictedSlot[] = [];
  const slotProbs: number[] = [];

  for (let pos = 1; pos <= 5; pos++) {
    const weThrowFirst =
      scenario === "we-first" ? pos % 2 === 1 : pos % 2 === 0;
    const remainingOpp = opponentRoster.filter(
      (p) => !usedOppNames.has(p.name),
    );

    if (weThrowFirst) {
      // Use the opener engine — adversarial picks our minimax pick.
      const result = recommendOpener(
        {
          opponentTeam,
          location,
          currentPosition: pos,
          availablePlayerIds: new Set(
            roster
              .filter((p) => p.visible !== false && !usedOurIds.has(p.id))
              .map((p) => p.id),
          ),
          log: [],
          opponentRoster: remainingOpp.map((p) => ({
            name: p.name,
            latestSL: p.latestSL,
          })),
        },
        matches,
        roster,
        refDate,
      );
      const top = result.topPick;
      if (!top) {
        slots.push({
          position: pos,
          weThrowFirst,
          ourPlayerId: null,
          ourPlayerName: "(no pick)",
          ourSkillLevel: null,
          oppName: null,
          oppSL: null,
          winProb: 50,
        });
        slotProbs.push(0.5);
        continue;
      }
      // Predict their counter — the opp player giving us the worst race.
      let worstOpp: { name: string; sl: number | null } | null = null;
      let worstWinProb = top.matchupScore;
      for (const op of remainingOpp) {
        if (typeof op.latestSL !== "number") continue;
        const re = raceEquity(top.skillLevel, op.latestSL);
        // Use race equity directly as their counter-strength signal.
        if (re < worstWinProb) {
          worstWinProb = re;
          worstOpp = { name: op.name, sl: op.latestSL };
        }
      }
      const finalOpp = worstOpp ?? {
        name: remainingOpp[0]?.name ?? "TBD",
        sl: remainingOpp[0]?.latestSL ?? null,
      };
      usedOurIds.add(top.playerId);
      usedOppNames.add(finalOpp.name);
      slots.push({
        position: pos,
        weThrowFirst: true,
        ourPlayerId: top.playerId,
        ourPlayerName: top.playerName,
        ourSkillLevel: top.skillLevel,
        oppName: finalOpp.name,
        oppSL: finalOpp.sl,
        winProb: top.matchupScore,
      });
      slotProbs.push(top.matchupScore / 100);
    } else {
      // They throw first → predict their putup (highest pending SL,
      // tie-break by preferred position match), then we counter.
      const sortedOpp = [...remainingOpp].sort((a, c) => {
        const slDiff = (c.latestSL ?? 0) - (a.latestSL ?? 0);
        if (slDiff !== 0) return slDiff;
        const aPref = a.preferredPosition === pos ? 1 : 0;
        const cPref = c.preferredPosition === pos ? 1 : 0;
        return cPref - aPref;
      });
      const oppPick = sortedOpp[0];
      if (!oppPick || typeof oppPick.latestSL !== "number") {
        slots.push({
          position: pos,
          weThrowFirst: false,
          ourPlayerId: null,
          ourPlayerName: "(no opp data)",
          ourSkillLevel: null,
          oppName: oppPick?.name ?? null,
          oppSL: oppPick?.latestSL ?? null,
          winProb: 50,
        });
        slotProbs.push(0.5);
        continue;
      }
      const result = recommendThrow(
        {
          opponentTeam,
          location,
          currentPosition: pos,
          opponentName: oppPick.name,
          opponentSkillLevel: oppPick.latestSL,
          availablePlayerIds: new Set(
            roster
              .filter((p) => p.visible !== false && !usedOurIds.has(p.id))
              .map((p) => p.id),
          ),
          log: [],
          opponentRoster: opponentRoster.map((p) => ({
            name: p.name,
            latestSL: p.latestSL,
          })),
        },
        matches,
        roster,
        refDate,
      );
      const top = result.candidates.find((c) => c.feasible);
      if (!top) {
        usedOppNames.add(oppPick.name);
        slots.push({
          position: pos,
          weThrowFirst: false,
          ourPlayerId: null,
          ourPlayerName: "(no pick)",
          ourSkillLevel: null,
          oppName: oppPick.name,
          oppSL: oppPick.latestSL,
          winProb: 50,
        });
        slotProbs.push(0.5);
        continue;
      }
      usedOurIds.add(top.playerId);
      usedOppNames.add(oppPick.name);
      slots.push({
        position: pos,
        weThrowFirst: false,
        ourPlayerId: top.playerId,
        ourPlayerName: top.playerName,
        ourSkillLevel: top.skillLevel,
        oppName: oppPick.name,
        oppSL: oppPick.latestSL,
        winProb: top.matchupScore,
      });
      slotProbs.push(top.matchupScore / 100);
    }
  }

  // Estimate team-match points from slot probs using the same league-average
  // sweep/mini/hill distribution the engine uses elsewhere.
  let ourPts = 0;
  let theirPts = 0;
  for (const p of slotProbs) {
    // Expected ours: p × (0.20×3 + 0.50×2 + 0.30×2) + (1-p) × (0.30×1) =
    //               p × 2.20 + (1-p) × 0.30
    // Expected theirs: p × (0.30×1) + (1-p) × (0.20×3 + 0.50×2 + 0.30×2) =
    //               p × 0.30 + (1-p) × 2.20
    ourPts += p * 2.2 + (1 - p) * 0.3;
    theirPts += p * 0.3 + (1 - p) * 2.2;
  }
  const nightProb = nightWinProbability(0, 0, slotProbs);

  return {
    scenario,
    slots,
    ourPoints: Math.round(ourPts * 10) / 10,
    theirPoints: Math.round(theirPts * 10) / 10,
    nightWinProbability: Math.round(nightProb * 1000) / 10,
  };
}

/* ============================================================ CALIBRATION BACKTEST
 *
 * Replay the engine on every historical individual match using ONLY data
 * that existed before that match's date, and compare the predicted win
 * probability to the actual outcome. Outputs:
 *   - Brier score (lower is better; 0 = perfect, 0.25 = random, > 0.25 = bad)
 *   - Calibration bins (do 70% predictions actually win 70% of the time?)
 *   - Per-prediction list for inspection
 *
 * This is the trust-building tool: tells us whether the win probabilities
 * the captain sees are actually well-calibrated.
 */

export type CalibrationPrediction = {
  matchId: string;
  date: string;
  playerId: string;
  playerName: string;
  playerSL: number | null;
  oppName: string;
  oppSL: number | null;
  matchPosition: number | null;
  /** Predicted win probability, 0..1. */
  predicted: number;
  /** Actual outcome — 1 if player won, 0 if they lost. */
  actual: 0 | 1;
};

export type CalibrationBin = {
  /** Bin's prediction range, e.g. [0.5, 0.6]. */
  range: [number, number];
  /** Number of predictions in this bin. */
  n: number;
  /** Average predicted probability of those in this bin. */
  predicted: number;
  /** Actual win rate (fraction) of those in this bin. */
  actual: number;
};

export type CalibrationResult = {
  predictions: CalibrationPrediction[];
  /** Brier score = mean((predicted - actual)^2). 0 = perfect. */
  brier: number;
  /** Reliability bins for the calibration plot (10 bins). */
  bins: CalibrationBin[];
  /** Mean absolute calibration error across bins (lower is better). */
  meanAbsError: number;
};

/**
 * Run the backtest. For every individual match in `matches`, replay the
 * engine using only matches dated strictly before. Skips early matches
 * (< 5 prior matches) since the engine has nothing to go on.
 *
 * Cost: O(N²) where N is total individual matches. ~30k ops at our scale,
 * so it's fast enough to run on the server.
 */
export function calibrationBacktest(
  matches: Match[],
  roster: Player[],
): CalibrationResult {
  const sortedMatches = [...matches]
    .filter((m) => m.status === "completed")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const predictions: CalibrationPrediction[] = [];
  const rosterById = new Map(roster.map((p) => [p.id, p]));

  for (let i = 0; i < sortedMatches.length; i++) {
    const m = sortedMatches[i];
    const priorMatches = sortedMatches.slice(0, i);
    if (priorMatches.length < 5) continue; // need a minimum of priors
    const refDate = new Date(m.date);
    for (const r of m.results) {
      const player = rosterById.get(r.playerId);
      if (!player) continue;
      // Skip non-real results (EBP placeholders).
      if (r.playerId.startsWith("ebp:")) continue;
      if (typeof r.opponentSkillLevel !== "number") continue;
      if (!r.opponentName || r.opponentName === "Opponent") continue;

      // Reconstruct what the team-score was BEFORE this individual match
      // (so we know if it was a tight state, for clutch).
      const states = teamScoreStatesBeforeMatch(m);
      const state = state_(states, r.matchPosition);
      const tight = state ? isTightTeamState(state.ourBefore, state.theirBefore) : false;

      // Build a fake input as if the captain were predicting THIS throw.
      const fakeInput: ThrowAdvisorInput = {
        opponentTeam: m.opponent,
        location: m.location,
        currentPosition: r.matchPosition ?? 1,
        opponentName: r.opponentName,
        opponentSkillLevel: r.opponentSkillLevel,
        availablePlayerIds: new Set([player.id]),
        log: [],
      };
      // Score against priorMatches only — that's all the engine "knows".
      const candidate = scoreCandidate(player, {
        matches: priorMatches,
        input: fakeInput,
        refDate,
        isCurrentlyTight: tight,
      });
      // We use matchupScore (pre-lookahead, pre-strategic-penalty) — that's
      // the pure win probability prediction.
      predictions.push({
        matchId: m.id,
        date: m.date,
        playerId: r.playerId,
        playerName: player.name,
        playerSL: r.skillLevel ?? null,
        oppName: r.opponentName,
        oppSL: r.opponentSkillLevel,
        matchPosition: r.matchPosition ?? null,
        predicted: candidate.matchupScore / 100,
        actual: r.outcome === "W" ? 1 : 0,
      });
    }
  }

  // Brier score
  const brier =
    predictions.length > 0
      ? predictions.reduce(
          (s, p) => s + (p.predicted - p.actual) ** 2,
          0,
        ) / predictions.length
      : 0;

  // Calibration bins (10 buckets across [0, 1])
  const bins: CalibrationBin[] = [];
  const numBins = 10;
  for (let b = 0; b < numBins; b++) {
    const lo = b / numBins;
    const hi = (b + 1) / numBins;
    const inBin = predictions.filter(
      (p) => p.predicted >= lo && p.predicted < (b === numBins - 1 ? hi + 0.001 : hi),
    );
    if (inBin.length === 0) {
      bins.push({ range: [lo, hi], n: 0, predicted: (lo + hi) / 2, actual: 0 });
      continue;
    }
    const avgPred = inBin.reduce((s, p) => s + p.predicted, 0) / inBin.length;
    const actualRate = inBin.filter((p) => p.actual === 1).length / inBin.length;
    bins.push({ range: [lo, hi], n: inBin.length, predicted: avgPred, actual: actualRate });
  }

  // Mean absolute calibration error across non-empty bins, weighted by bin size
  const totalN = predictions.length || 1;
  const meanAbsError = bins.reduce(
    (s, b) =>
      b.n > 0 ? s + (Math.abs(b.predicted - b.actual) * b.n) / totalN : s,
    0,
  );

  return {
    predictions,
    brier: Math.round(brier * 10000) / 10000,
    bins,
    meanAbsError: Math.round(meanAbsError * 1000) / 1000,
  };
}

/** Helper: safe access to score-states map keyed by position. */
function state_(
  states: Map<number, { ourBefore: number; theirBefore: number }>,
  position: number | undefined,
): { ourBefore: number; theirBefore: number } | undefined {
  if (typeof position !== "number") return undefined;
  return states.get(position);
}
