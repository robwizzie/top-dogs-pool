import type { Match, MatchResult } from "@/lib/apa/schemas";
import { winsRequired } from "@/lib/apa/race";

/**
 * Pick the Top Dawgs player who performed best in this match — used as a
 * "Match MVP" headline. Score weights: win=10, sweep=+3, mini=+1, B&R=+2,
 * 8oB=+2, plus 0.5 per game won. Ties broken by win-margin then name.
 */
export type MatchMvp = {
  playerId: string;
  playerName: string;
  outcome: "W" | "L";
  score?: string;
  sweep: boolean;
  miniSweep: boolean;
  breakAndRun: boolean;
  eightOnBreak: boolean;
};

export function matchMvp(match: Match): MatchMvp | null {
  if (match.status !== "completed") return null;
  if (match.results.length === 0) return null;
  let best: MatchResult | null = null;
  let bestScore = -1;
  for (const r of match.results) {
    if (r.playerId.startsWith("ebp:")) continue;
    if (r.playerId.startsWith("hidden:")) continue;
    let s = 0;
    if (r.outcome === "W") s += 10;
    if (r.sweep) s += 3;
    else if (r.miniSweep) s += 1;
    if (r.breakAndRun) s += 2;
    if (r.eightOnBreak) s += 2;
    if (r.score) {
      const m = r.score.match(/(\d+)\s*-\s*(\d+)/);
      if (m) {
        const w = parseInt(m[1], 10);
        s += w * 0.5;
      }
    }
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  if (!best) return null;
  return {
    playerId: best.playerId,
    playerName: best.playerName,
    outcome: best.outcome,
    score: best.score,
    sweep: best.sweep,
    miniSweep: best.miniSweep,
    breakAndRun: best.breakAndRun,
    eightOnBreak: best.eightOnBreak,
  };
}

/**
 * Auto-generate a short narrative summary of a completed match. Pure
 * function from the match's results — no LLM, just template stitching
 * that reads like a tidy recap line.
 *
 *   "Top Dawgs squeaked out a 12-11 win over Lights Out, with Patrick
 *    going 2-0 to seal it. Meghan's 5-0 sweep was the highlight."
 */
export function matchRecap(
  match: Match,
  /** Subject team's display name. Defaults to "Top Dawgs" for backwards-
   *  compat with our-team views; pass the opp team's name when rendering
   *  one of their non-vs-us matches. */
  subjectName: string = "Top Dawgs",
): string | null {
  if (match.status !== "completed") return null;
  if (
    typeof match.teamScore !== "number" ||
    typeof match.opponentScore !== "number"
  )
    return null;

  const margin = match.teamScore - match.opponentScore;
  const verb =
    margin > 5
      ? "rolled past"
      : margin > 2
        ? "took down"
        : margin > 0
          ? "edged"
          : margin < -5
            ? "got rolled by"
            : margin < -2
              ? "dropped one to"
              : margin < 0
                ? "fell to"
                : "tied";
  const result =
    margin > 0 ? "win" : margin < 0 ? "loss" : "tie";

  let lead = `${subjectName} ${verb} ${match.opponent} ${match.teamScore}-${match.opponentScore}`;
  if (margin === 0) lead = `${subjectName} tied ${match.opponent} ${match.teamScore}-${match.opponentScore}`;

  // Skip anonymized rows (hidden:* and ebp:*) from highlight selection so we
  // never produce "Unknown's sweep was the highlight."
  const namedResults = match.results.filter(
    (r) => !r.playerId.startsWith("hidden:") && !r.playerId.startsWith("ebp:"),
  );
  const wins = namedResults.filter((r) => r.outcome === "W");
  const sweeps = namedResults.filter((r) => r.sweep);
  const minis = namedResults.filter((r) => r.miniSweep);
  const brs = namedResults.filter((r) => r.breakAndRun);
  const eobs = namedResults.filter((r) => r.eightOnBreak);

  // Highlight: the most decisive event.
  const highlights: string[] = [];
  if (sweeps.length) {
    const s = sweeps[0];
    highlights.push(
      `${firstName(s.playerName)}'s ${s.score ?? "shutout"} sweep`,
    );
  } else if (minis.length) {
    const m = minis[0];
    highlights.push(
      `${firstName(m.playerName)}'s mini-sweep`,
    );
  }
  if (brs.length) {
    const b = brs[0];
    highlights.push(
      `${firstName(b.playerName)} ${brs.length > 1 ? `had ${brs.length} break-and-runs` : "ran the rack from the break"}`,
    );
  }
  if (eobs.length) {
    const e = eobs[0];
    highlights.push(
      `${firstName(e.playerName)} put the 8 on the break`,
    );
  }

  // Top scorer (winner with best score margin)
  const decisive = wins
    .filter((r) => r.score)
    .sort((a, b) => {
      const am = scoreMargin(a.score!);
      const bm = scoreMargin(b.score!);
      return bm - am;
    })[0];

  let lead2 = "";
  if (decisive && !sweeps.length) {
    lead2 = ` ${firstName(decisive.playerName)} led the way at ${decisive.score}.`;
  }

  let highlightSentence = "";
  if (highlights.length === 1) {
    highlightSentence = ` ${cap(highlights[0])} was the highlight.`;
  } else if (highlights.length === 2) {
    highlightSentence = ` ${cap(highlights[0])} and ${highlights[1]} stood out.`;
  } else if (highlights.length >= 3) {
    highlightSentence = ` Highlights: ${highlights.slice(0, 3).join(", ")}.`;
  }

  // Drama indicator
  const drama =
    margin === 1 || margin === -1
      ? " Came down to the final match."
      : margin === 0
        ? " A real grinder."
        : "";

  void result;
  return `${lead}.${lead2}${highlightSentence}${drama}`.trim();
}

function firstName(full: string): string {
  return full.split(" ")[0] ?? full;
}

function cap(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

function scoreMargin(score: string): number {
  const m = score.match(/(\d+)\s*-\s*(\d+)/);
  if (!m) return 0;
  return parseInt(m[1], 10) - parseInt(m[2], 10);
}

/* ===================================================================
 * CHALK TALK — post-match coach's-corner breakdown
 *
 * Mines a finished match for narrative-level insights: what the team
 * leaned on to win (or hold the game close), and where the cracks were.
 *
 * Pure function — no LLM, no I/O. Inputs: the Match itself; outputs a
 * structured set of insights the UI can render as little chalkboard
 * cards. Keep ordering deterministic so the same match always produces
 * the same write-up.
 * =================================================================== */

export type Insight = {
  /** Short emoji marker — sets visual tone on the chalkboard card. */
  emoji: string;
  /** Headline (3–5 words). Imperative or noun-phrase. */
  title: string;
  /** One-sentence detail that cites real numbers from the match. */
  detail: string;
};

export type KeyMoment = {
  /** APA round / match position (1=Lead, 5=Anchor). */
  round: number;
  /** "swing" = momentum flip, "highlight" = stand-out win, "stumble" = let-down. */
  kind: "swing" | "highlight" | "stumble";
  text: string;
};

export type MatchBreakdown = {
  outcome: "W" | "L" | "T";
  /** One-line headline for the chalkboard. */
  headline: string;
  /** "Did well" insights. Most impactful first. */
  didWell: Insight[];
  /** "Could clean up" insights. Most impactful first. */
  couldImprove: Insight[];
  /** Round-by-round narrative beats (max 3). */
  keyMoments: KeyMoment[];
  /** Forward-looking takeaway for the next match (1–2 sentences). */
  takeaway: string;
};

/** Build a coach's-corner breakdown of a completed match. Returns null for
 *  matches that haven't finished or have no scoresheet rows. The
 *  `subjectName` is the team perspective: defaults to "Top Dawgs" so the
 *  home/match views work, but pass the opp name when rendering the page
 *  from an opp team's perspective. */
export function matchBreakdown(
  match: Match,
  subjectName: string = "Top Dawgs",
): MatchBreakdown | null {
  if (match.status !== "completed") return null;
  if (
    typeof match.teamScore !== "number" ||
    typeof match.opponentScore !== "number"
  ) {
    return null;
  }

  const margin = match.teamScore - match.opponentScore;
  const outcome: "W" | "L" | "T" = margin > 0 ? "W" : margin < 0 ? "L" : "T";

  // Strip anonymized scoresheet rows (forfeits / extra-bonus-points).
  const named = match.results.filter(
    (r) => !r.playerId.startsWith("hidden:") && !r.playerId.startsWith("ebp:"),
  );

  // Per-round ordering (1..5). Each round is the 5-of-X slot from the
  // scoresheet — round 1 = Lead, round 5 = Anchor. A round can hold more
  // than one row in rare data quirks; treat the first non-anonymous row as
  // the decider for momentum.
  const byRound = new Map<number, MatchResult[]>();
  for (const r of named) {
    if (typeof r.matchPosition !== "number") continue;
    const list = byRound.get(r.matchPosition) ?? [];
    list.push(r);
    byRound.set(r.matchPosition, list);
  }
  const rounds = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pos, rows]) => ({ pos, decider: rows[0], rows }));

  // Running cumulative individual-wins arc — drives momentum analysis.
  let usCum = 0;
  let themCum = 0;
  const arc = rounds.map((r) => {
    if (r.decider.outcome === "W") usCum += 1;
    else themCum += 1;
    return { pos: r.pos, us: usCum, them: themCum, decider: r.decider };
  });

  // ---- helpers ----------------------------------------------------------
  const isHillHillWin = (r: MatchResult): boolean => {
    if (r.outcome !== "W") return false;
    if (!r.score) return false;
    const m = r.score.match(/(\d+)-(\d+)/);
    if (!m) return false;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const need = winsRequired(r.skillLevel, r.opponentSkillLevel);
    // "Hill-hill" = both sides reached one game from winning before the
    // decider landed. For race-to-N, that's winner has N, loser has N-1.
    return a === need && b === need - 1;
  };
  const isHillHillLoss = (r: MatchResult): boolean => {
    if (r.outcome !== "L") return false;
    if (!r.score) return false;
    const m = r.score.match(/(\d+)-(\d+)/);
    if (!m) return false;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const need = winsRequired(r.opponentSkillLevel, r.skillLevel);
    return b === need && a === need - 1;
  };
  /** Higher-SL opponents need MORE wins to take the match — they're the
   *  structural underdog *of the handicap*, but the lower SL is the
   *  "underdog by ability". For "upset" framing we flag wins where the
   *  opponent's SL was higher than ours (we beat a bigger fish). */
  const isUpsetWin = (r: MatchResult): boolean =>
    r.outcome === "W" &&
    typeof r.skillLevel === "number" &&
    typeof r.opponentSkillLevel === "number" &&
    r.opponentSkillLevel > r.skillLevel;
  const isUpsetLoss = (r: MatchResult): boolean =>
    r.outcome === "L" &&
    typeof r.skillLevel === "number" &&
    typeof r.opponentSkillLevel === "number" &&
    r.opponentSkillLevel < r.skillLevel;

  // ---- counts -----------------------------------------------------------
  const ourWins = named.filter((r) => r.outcome === "W");
  const ourLosses = named.filter((r) => r.outcome === "L");
  const ourSweeps = ourWins.filter((r) => r.sweep);
  const ourMinis = ourWins.filter((r) => !r.sweep && r.miniSweep);
  const oppSweeps = ourLosses.filter((r) => r.sweep);
  const oppMinis = ourLosses.filter((r) => !r.sweep && r.miniSweep);
  const ourBR = ourWins.filter((r) => r.breakAndRun);
  const ourEOB = ourWins.filter((r) => r.eightOnBreak);
  const oppBR = ourLosses.filter((r) => r.breakAndRun);
  const oppEOB = ourLosses.filter((r) => r.eightOnBreak);
  const hillHillWins = ourWins.filter(isHillHillWin);
  const hillHillLosses = ourLosses.filter(isHillHillLoss);
  const upsetWins = ourWins.filter(isUpsetWin);
  const upsetLosses = ourLosses.filter(isUpsetLoss);
  const forfeitsByUs = named.filter((r) => r.outcome === "L" && r.forfeited);

  const lead = rounds[0]?.decider ?? null;
  const anchor = rounds[rounds.length - 1]?.decider ?? null;

  // Comeback detection — was the team ever behind by 2+ in the arc?
  let maxDeficit = 0;
  let maxLead = 0;
  for (const a of arc) {
    maxDeficit = Math.max(maxDeficit, a.them - a.us);
    maxLead = Math.max(maxLead, a.us - a.them);
  }
  const comebackWin = outcome === "W" && maxDeficit >= 2;
  const blownLeadLoss = outcome === "L" && maxLead >= 2;

  // ---- did well ---------------------------------------------------------
  const didWell: Insight[] = [];

  if (lead && lead.outcome === "W") {
    didWell.push({
      emoji: "🚀",
      title: "Fast start",
      detail: `${firstName(lead.playerName)} took the lead-off${lead.score ? ` ${lead.score}` : ""} and set the tone right out of the gate.`,
    });
  }
  if (anchor && anchor.outcome === "W" && rounds.length >= 4) {
    didWell.push({
      emoji: "🔒",
      title: "Closed the door",
      detail: `${firstName(anchor.playerName)} ${anchor.sweep ? "swept" : "took"} the anchor${anchor.score ? ` ${anchor.score}` : ""} — clutch in the closer's seat.`,
    });
  }
  if (comebackWin) {
    didWell.push({
      emoji: "📈",
      title: "Refused to fold",
      detail: `Down ${maxDeficit} at the low point and still found a way${margin > 0 ? ` to ${marginWord(margin)} ${margin === 0 ? "tie" : "win"}` : ""}. Real grit.`,
    });
  }
  if (ourSweeps.length >= 1) {
    if (ourSweeps.length === 1) {
      const s = ourSweeps[0];
      didWell.push({
        emoji: "🧹",
        title: "Sweep on the board",
        detail: `${firstName(s.playerName)} blanked their opponent ${s.score ?? ""}${s.score ? "" : "for the shutout"} — full leaderboard point earned.`,
      });
    } else {
      didWell.push({
        emoji: "🧹",
        title: `${ourSweeps.length} sweeps in one night`,
        detail: `${listNames(ourSweeps)} ${allOrBoth(ourSweeps.length)} hung shutouts on the opp — a stack of bonus points before bonuses are even counted.`,
      });
    }
  } else if (ourMinis.length >= 2) {
    didWell.push({
      emoji: "✨",
      title: "Stingy on the felt",
      detail: `${ourMinis.length} mini-sweeps (${listNames(ourMinis)}) — opponents never reached the hill.`,
    });
  }
  if (ourBR.length + ourEOB.length >= 1) {
    const parts: string[] = [];
    if (ourBR.length) {
      parts.push(
        ourBR.length === 1
          ? `${firstName(ourBR[0].playerName)} ran the rack from the break`
          : `${ourBR.length} break-and-runs (${listNames(ourBR)})`,
      );
    }
    if (ourEOB.length) {
      parts.push(
        ourEOB.length === 1
          ? `${firstName(ourEOB[0].playerName)} dropped the 8 on the break`
          : `${ourEOB.length} eights on the break (${listNames(ourEOB)})`,
      );
    }
    didWell.push({
      emoji: "💥",
      title: "Bonus-point hunting",
      detail: parts.join(" · ") + ". Free points off the rack.",
    });
  }
  if (upsetWins.length >= 1) {
    if (upsetWins.length === 1) {
      const u = upsetWins[0];
      didWell.push({
        emoji: "🐺",
        title: "Punched up",
        detail: `${firstName(u.playerName)} (SL${u.skillLevel}) took down a SL${u.opponentSkillLevel} — the kind of W that swings a night.`,
      });
    } else {
      didWell.push({
        emoji: "🐺",
        title: `${upsetWins.length} upset wins`,
        detail: `${listNames(upsetWins)} ${allOrBoth(upsetWins.length)} beat higher-SL opponents. Handicap chart didn't see it coming.`,
      });
    }
  }
  if (hillHillWins.length >= 1) {
    if (hillHillWins.length === 1) {
      const h = hillHillWins[0];
      didWell.push({
        emoji: "🎯",
        title: "Won the heart-rate test",
        detail: `${firstName(h.playerName)} closed out a hill-hill ${h.score ?? ""}. Mental game showed up.`,
      });
    } else {
      didWell.push({
        emoji: "🎯",
        title: `${hillHillWins.length}-for-${hillHillWins.length} on the hill`,
        detail: `${listNames(hillHillWins)} ${allOrBoth(hillHillWins.length)} closed out hill-hill races. Cool under pressure.`,
      });
    }
  }
  const sweepsConceded = oppSweeps.length + oppMinis.length;
  if (named.length >= 4 && sweepsConceded === 0 && oppBR.length + oppEOB.length === 0) {
    didWell.push({
      emoji: "🛡️",
      title: "Nothing given away",
      detail: `Zero sweeps conceded, zero bonus shots allowed. Tight defense across the whole night.`,
    });
  }
  const winRate = named.length ? ourWins.length / named.length : 0;
  if (winRate >= 0.6 && named.length >= 4 && didWell.length < 3) {
    didWell.push({
      emoji: "📊",
      title: "Win rate that travels",
      detail: `${ourWins.length}-of-${named.length} individual wins (${Math.round(winRate * 100)}%) — keep this on the road and it's a playoff team.`,
    });
  }

  // ---- could improve ----------------------------------------------------
  const couldImprove: Insight[] = [];

  if (forfeitsByUs.length >= 1) {
    couldImprove.push({
      emoji: "📋",
      title: forfeitsByUs.length > 1 ? "Forfeits hurt" : "A forfeit hurt",
      detail: `Gave up ${forfeitsByUs.length} match${forfeitsByUs.length > 1 ? "es" : ""} on the lineup card without firing a shot. Roster math matters.`,
    });
  }
  if (lead && lead.outcome === "L") {
    couldImprove.push({
      emoji: "🐢",
      title: "Slow out of the gate",
      detail: `Dropped the lead-off${lead.score ? ` ${lead.score}` : ""} — playing from behind all night is harder than it needs to be.`,
    });
  }
  if (
    anchor &&
    anchor.outcome === "L" &&
    rounds.length >= 4 &&
    Math.abs(margin) <= 2 &&
    outcome !== "W"
  ) {
    couldImprove.push({
      emoji: "🚪",
      title: "Couldn't shut the door",
      detail: `Anchor went down${anchor.score ? ` ${anchor.score}` : ""} with the team match within reach. That's the one to win.`,
    });
  }
  if (blownLeadLoss) {
    couldImprove.push({
      emoji: "🧊",
      title: "Lost the lead",
      detail: `Was up by ${maxLead} at the high-water mark. Bleeding a lead in the back half is fixable — usually pace or shot selection.`,
    });
  }
  if (oppSweeps.length + oppMinis.length >= 1) {
    const swept = [...oppSweeps, ...oppMinis];
    couldImprove.push({
      emoji: "💀",
      title:
        oppSweeps.length >= 1
          ? oppSweeps.length > 1
            ? `${oppSweeps.length} sweeps conceded`
            : "Conceded a sweep"
          : "Gave up a mini-sweep",
      detail: `${listNames(swept)} got blanked — those are the matches that flip a tight night. Bench depth / pre-match feel matters.`,
    });
  }
  if (hillHillLosses.length >= 1) {
    couldImprove.push({
      emoji: "🫀",
      title:
        hillHillLosses.length > 1
          ? `${hillHillLosses.length} hill-hill losses`
          : "Lost the heart-rate test",
      detail:
        hillHillLosses.length > 1
          ? `${listNames(hillHillLosses)} ${allOrBoth(hillHillLosses.length)} dropped hill-hill matches. Closing-out drills pay back fast.`
          : `${firstName(hillHillLosses[0].playerName)} dropped a hill-hill ${hillHillLosses[0].score ?? ""}. One ball away — sharpen the close.`,
    });
  }
  if (upsetLosses.length >= 1) {
    if (upsetLosses.length === 1) {
      const u = upsetLosses[0];
      couldImprove.push({
        emoji: "🪤",
        title: "Got caught looking down",
        detail: `${firstName(u.playerName)} (SL${u.skillLevel}) dropped to a SL${u.opponentSkillLevel}. Handicap was on our side — that's a win we leave on the table.`,
      });
    } else {
      couldImprove.push({
        emoji: "🪤",
        title: `${upsetLosses.length} losses to lower SLs`,
        detail: `${listNames(upsetLosses)} ${allOrBoth(upsetLosses.length)} lost to lower-skilled opponents. Respect the handicap chart, then run the table.`,
      });
    }
  }
  if (oppBR.length + oppEOB.length >= 2) {
    couldImprove.push({
      emoji: "🎲",
      title: "Out-bonused on the break",
      detail: `Opp picked up ${oppBR.length + oppEOB.length} bonus point${oppBR.length + oppEOB.length > 1 ? "s" : ""} (${oppBR.length} B&R · ${oppEOB.length} 8oB) to our ${ourBR.length + ourEOB.length}. Break box positioning and 8-on-break reads.`,
    });
  }
  if (
    outcome === "L" &&
    Math.abs(margin) <= 2 &&
    couldImprove.length < 3 &&
    hillHillLosses.length === 0
  ) {
    couldImprove.push({
      emoji: "🔍",
      title: "Right there, just short",
      detail: `Only ${Math.abs(margin)} point${Math.abs(margin) > 1 ? "s" : ""} away from flipping the result. Every bonus and every game matters in nights this tight.`,
    });
  }

  // Empty-state fallbacks so the chalkboard never looks broken.
  if (didWell.length === 0) {
    didWell.push({
      emoji: "🐾",
      title: "Showed up",
      detail:
        outcome === "L"
          ? "Tough night on paper — but every match is data for the next one. The roster fired all five shots."
          : "Got the W. Sometimes that's the whole story — collect the points and move on.",
    });
  }
  if (couldImprove.length === 0) {
    couldImprove.push({
      emoji: "🎩",
      title: "Tip-the-hat night",
      detail:
        "Nothing obvious to clean up on the scoresheet — no forfeits, no sweeps conceded, no hill-hill drops. Bottle this lineup.",
    });
  }

  // ---- key moments ------------------------------------------------------
  const keyMoments: KeyMoment[] = [];
  // Round 1 swing
  if (rounds.length >= 1) {
    const r = rounds[0];
    const tone = r.decider.outcome === "W" ? "highlight" : "stumble";
    keyMoments.push({
      round: r.pos,
      kind: tone,
      text:
        r.decider.outcome === "W"
          ? `Lead-off goes our way — ${firstName(r.decider.playerName)} ${r.decider.sweep ? "with a sweep" : `wins${r.decider.score ? ` ${r.decider.score}` : ""}`}.`
          : `Lead-off goes to ${r.decider.opponentName}${r.decider.score ? ` ${r.decider.score}` : ""}. ${firstName(r.decider.playerName)} swims upstream from here.`,
    });
  }
  // First momentum swing — find the round where the leading side flipped.
  for (let i = 1; i < arc.length; i++) {
    const prev = arc[i - 1];
    const curr = arc[i];
    const prevLead = prev.us - prev.them;
    const currLead = curr.us - curr.them;
    if (Math.sign(prevLead) !== Math.sign(currLead) && prevLead !== 0) {
      const winning = curr.us > curr.them ? subjectName : match.opponent;
      keyMoments.push({
        round: curr.pos,
        kind: "swing",
        text: `Round ${curr.pos} flips the lead — ${winning} in front ${curr.us}-${curr.them}.`,
      });
      break;
    }
  }
  // Anchor moment if 5+ rounds.
  if (rounds.length >= 4) {
    const last = rounds[rounds.length - 1];
    const tone = last.decider.outcome === "W" ? "highlight" : "stumble";
    const finalLine = arc[arc.length - 1];
    keyMoments.push({
      round: last.pos,
      kind: tone,
      text:
        last.decider.outcome === "W"
          ? `Anchor delivers — ${firstName(last.decider.playerName)}${last.decider.score ? ` ${last.decider.score}` : ""}. Books closed at ${finalLine.us}-${finalLine.them}.`
          : `Anchor goes the other way${last.decider.score ? ` (${last.decider.score})` : ""}. Final ${finalLine.us}-${finalLine.them} on individual matches.`,
    });
  }

  // ---- takeaway ---------------------------------------------------------
  let takeaway: string;
  if (outcome === "W") {
    if (couldImprove.length > 0 && couldImprove[0].title !== "Tip-the-hat night") {
      takeaway = `Banked the W ${match.teamScore}-${match.opponentScore}. Next week's lineup-card focus: ${couldImprove[0].title.toLowerCase()}.`;
    } else {
      takeaway = `${match.teamScore}-${match.opponentScore} on the board and the chalkboard is clean. Stack the next one.`;
    }
  } else if (outcome === "L") {
    takeaway = `${match.teamScore}-${match.opponentScore} loss, but ${didWell[0].title.toLowerCase()} is something to build on. Fix one thing, not five.`;
  } else {
    takeaway = `${match.teamScore}-${match.opponentScore} tie. The night was decided by a couple of close games — sharpen those and the next one is a W.`;
  }

  const headline =
    outcome === "W"
      ? margin >= 6
        ? "Statement night"
        : margin >= 3
          ? "Solid W"
          : "Edged it"
      : outcome === "L"
        ? margin <= -6
          ? "Tough night"
          : margin <= -3
            ? "Took an L"
            : "Dropped a close one"
        : "Even split";

  return {
    outcome,
    headline,
    didWell: didWell.slice(0, 4),
    couldImprove: couldImprove.slice(0, 4),
    keyMoments: keyMoments.slice(0, 3),
    takeaway,
  };
}

function listNames(rows: MatchResult[]): string {
  const names = rows.map((r) => firstName(r.playerName));
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** "all" vs "both" agreement helper. For lists of 2 use "both", for 3+ use
 *  "all" — single-item is handled by callers that branch on length. */
function allOrBoth(n: number): string {
  return n === 2 ? "both" : "all";
}

function marginWord(margin: number): string {
  const m = Math.abs(margin);
  if (m === 0) return "earn the";
  if (m === 1) return "edge the";
  if (m <= 3) return "lock in the";
  return "roll to the";
}
