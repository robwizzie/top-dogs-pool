import type { Match, MatchResult } from "@/lib/apa/schemas";

/**
 * Pick the Top Dogs player who performed best in this match — used as a
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
 *   "Top Dogs squeaked out a 12-11 win over Lights Out, with Patrick
 *    going 2-0 to seal it. Meghan's 5-0 sweep was the highlight."
 */
export function matchRecap(
  match: Match,
  /** Subject team's display name. Defaults to "Top Dogs" for backwards-
   *  compat with our-team views; pass the opp team's name when rendering
   *  one of their non-vs-us matches. */
  subjectName: string = "Top Dogs",
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
