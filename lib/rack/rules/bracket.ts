/**
 * Tournament bracket engine.
 *
 * The Lovable app didn't actually run a bracket. It stored a `tournament_type`
 * of "single" or "double" and then, after every round, re-paired whoever was
 * still alive by win count (`generateFairMatchups`) — Swiss pairing wearing a
 * bracket's name. That produced rematches, byes that appeared out of nowhere,
 * a losers bracket that never really existed, and no way to draw the bracket
 * before it was played.
 *
 * This builds the whole bracket up front as a fixed graph of matches whose
 * slots reference other matches ("winner of W1-2", "loser of W2-1"). Nothing
 * is invented as you go: seeding a tournament produces every match it will
 * ever contain, which means the bracket can be drawn immediately, byes resolve
 * deterministically, and advancing a winner is a pure function.
 */

export type BracketType = "single" | "double";
export type BracketSide = "winners" | "losers" | "final";

/** Where a match's participant comes from. */
export type SlotRef =
  | { from: "seed"; seed: number }
  | { from: "winner"; match: string }
  | { from: "loser"; match: string };

export type BracketMatch = {
  /** Stable, human-readable id, e.g. "W1-3", "L2-1", "GF", "GF-RESET". */
  id: string;
  bracket: BracketSide;
  /** 1-based round within its bracket. */
  round: number;
  /** 1-based position within the round, top to bottom. */
  order: number;
  a: SlotRef;
  b: SlotRef;
  /** Label for the UI, e.g. "Winners Round 2". */
  label: string;
};

export type Bracket = {
  type: BracketType;
  /** Number of real entrants. */
  playerCount: number;
  /** Padded to the next power of two; the gap is byes. */
  size: number;
  matches: BracketMatch[];
};

/* -------------------------------------------------------------------------
 * Seeding
 * ---------------------------------------------------------------------- */

/**
 * Standard bracket seeding order for a power-of-two bracket: the slot order
 * that puts seed 1 and seed 2 on opposite halves, and pairs every seed with
 * its complement so the strongest entrants meet as late as possible.
 *
 * seedOrder(8) → [1, 8, 4, 5, 2, 7, 3, 6]
 *   i.e. 1-v-8, 4-v-5, 2-v-7, 3-v-6 — seeds 1 and 2 can only meet in the final.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const sum = order.length * 2 + 1;
    const next: number[] = [];
    for (const s of order) next.push(s, sum - s);
    order = next;
  }
  return order;
}

export function bracketSizeFor(playerCount: number): number {
  let size = 1;
  while (size < playerCount) size *= 2;
  return Math.max(2, size);
}

/* -------------------------------------------------------------------------
 * Construction
 * ---------------------------------------------------------------------- */

export function buildBracket(
  playerCount: number,
  type: BracketType,
): Bracket {
  const size = bracketSizeFor(playerCount);
  const rounds = Math.log2(size);
  const matches: BracketMatch[] = [];

  /* ---- Winners bracket ------------------------------------------------ */
  const order = seedOrder(size);
  for (let i = 0; i < size / 2; i++) {
    matches.push({
      id: `W1-${i + 1}`,
      bracket: "winners",
      round: 1,
      order: i + 1,
      a: { from: "seed", seed: order[i * 2] },
      b: { from: "seed", seed: order[i * 2 + 1] },
      label: winnersLabel(1, rounds, type),
    });
  }
  for (let r = 2; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let i = 0; i < count; i++) {
      matches.push({
        id: `W${r}-${i + 1}`,
        bracket: "winners",
        round: r,
        order: i + 1,
        a: { from: "winner", match: `W${r - 1}-${i * 2 + 1}` },
        b: { from: "winner", match: `W${r - 1}-${i * 2 + 2}` },
        label: winnersLabel(r, rounds, type),
      });
    }
  }

  if (type === "single") {
    return { type, playerCount, size, matches };
  }

  /* ---- Losers bracket -------------------------------------------------- */
  // Losers rounds alternate:
  //   odd  ("minor") — survivors of the previous losers round play each other
  //   even ("major") — those survivors meet the next wave dropping down from
  //                    the winners bracket
  // There are 2·(rounds−1) losers rounds in total.
  const losersRounds = 2 * (rounds - 1);

  for (let lr = 1; lr <= losersRounds; lr++) {
    const isMajor = lr % 2 === 0;
    // j indexes the winners round whose losers drop into this major round.
    const j = lr / 2; // only meaningful when isMajor
    const count = isMajor ? size / 2 ** (j + 1) : size / 2 ** ((lr + 1) / 2 + 1);

    for (let i = 0; i < count; i++) {
      let a: SlotRef;
      let b: SlotRef;

      if (lr === 1) {
        // First losers round pairs winners-round-1 losers with each other.
        a = { from: "loser", match: `W1-${i * 2 + 1}` };
        b = { from: "loser", match: `W1-${i * 2 + 2}` };
      } else if (isMajor) {
        // Survivor of the previous (minor) losers round vs a winners dropdown.
        // Dropdowns are crossed on alternating rounds so a player doesn't
        // immediately replay the person who knocked them down.
        const wbRound = j + 1;
        const dropIndex = j % 2 === 1 ? count - 1 - i : i;
        a = { from: "winner", match: `L${lr - 1}-${i + 1}` };
        b = { from: "loser", match: `W${wbRound}-${dropIndex + 1}` };
      } else {
        // Minor round: pair up the previous round's survivors.
        a = { from: "winner", match: `L${lr - 1}-${i * 2 + 1}` };
        b = { from: "winner", match: `L${lr - 1}-${i * 2 + 2}` };
      }

      matches.push({
        id: `L${lr}-${i + 1}`,
        bracket: "losers",
        round: lr,
        order: i + 1,
        a,
        b,
        label: `Losers Round ${lr}`,
      });
    }
  }

  /* ---- Grand final ----------------------------------------------------- */
  const wbFinal = `W${rounds}-1`;
  const lbFinal = losersRounds > 0 ? `L${losersRounds}-1` : wbFinal;
  matches.push({
    id: "GF",
    bracket: "final",
    round: rounds + 1,
    order: 1,
    a: { from: "winner", match: wbFinal },
    b:
      losersRounds > 0
        ? { from: "winner", match: lbFinal }
        : { from: "loser", match: wbFinal },
    label: "Grand Final",
  });
  // The winners-bracket player carries a one-loss cushion into the grand
  // final. If they lose it, both players have one loss and a deciding match
  // is played. It's created up front and skipped when it isn't needed.
  matches.push({
    id: "GF-RESET",
    bracket: "final",
    round: rounds + 2,
    order: 1,
    a: { from: "winner", match: "GF" },
    b: { from: "loser", match: "GF" },
    label: "Grand Final — Reset",
  });

  return { type, playerCount, size, matches };
}

function winnersLabel(round: number, rounds: number, type: BracketType): string {
  const prefix = type === "double" ? "Winners " : "";
  if (round === rounds) return type === "double" ? "Winners Final" : "Final";
  if (round === rounds - 1) return `${prefix}Semifinal`;
  if (round === rounds - 2) return `${prefix}Quarterfinal`;
  return `${prefix}Round ${round}`;
}

/* -------------------------------------------------------------------------
 * Resolution
 * ---------------------------------------------------------------------- */

/** A bye — a padded slot with no real entrant behind it. */
export const BYE = "__bye__";

export type MatchResults = Record<string, { winner: string } | undefined>;

export type ResolvedMatch = BracketMatch & {
  /** Resolved participants. `null` = not known yet, BYE = walkover. */
  aId: string | null;
  bId: string | null;
  winnerId: string | null;
  loserId: string | null;
  /** True when the match doesn't need to be played (a bye, or skipped reset). */
  walkover: boolean;
  /** True when both participants are known and it still needs playing. */
  playable: boolean;
};

export type ResolvedBracket = {
  bracket: Bracket;
  matches: ResolvedMatch[];
  byId: Map<string, ResolvedMatch>;
  /** Overall winner once the final is decided. */
  champion: string | null;
  /** Placements we can state with confidence: 1st, 2nd, and 3rd where defined. */
  placements: Map<string, number>;
  complete: boolean;
};

/**
 * Walk the bracket graph and fill in everything the recorded results imply.
 *
 * `seeds` maps seed number → player id; seeds past the entrant count are byes.
 * `results` maps match id → the winner's player id.
 */
export function resolveBracket(
  bracket: Bracket,
  seeds: Map<number, string>,
  results: MatchResults,
): ResolvedBracket {
  const byId = new Map<string, ResolvedMatch>();

  // Resolve in dependency order, not round order. Round numbers are per
  // bracket and therefore collide — losers round 1 and winners round 1 are
  // both "round 1" — so sorting by round can put a losers match ahead of the
  // winners match it takes a dropdown from, leaving its slot stuck on `null`
  // for the life of the tournament.
  for (const m of topoOrder(bracket.matches)) {
    const aId = resolveSlot(m.a, seeds, byId, bracket.playerCount);
    const bId = resolveSlot(m.b, seeds, byId, bracket.playerCount);

    let winnerId: string | null = null;
    let loserId: string | null = null;
    let walkover = false;

    if (aId === BYE && bId === BYE) {
      winnerId = BYE;
      loserId = BYE;
      walkover = true;
    } else if (aId === BYE && bId !== null) {
      winnerId = bId;
      loserId = BYE;
      walkover = true;
    } else if (bId === BYE && aId !== null) {
      winnerId = aId;
      loserId = BYE;
      walkover = true;
    } else {
      const recorded = results[m.id]?.winner ?? null;
      if (recorded && (recorded === aId || recorded === bId)) {
        winnerId = recorded;
        loserId = recorded === aId ? bId : aId;
      }
    }

    const resolved: ResolvedMatch = {
      ...m,
      aId,
      bId,
      winnerId,
      loserId,
      walkover,
      playable:
        !walkover &&
        winnerId === null &&
        aId !== null &&
        bId !== null &&
        aId !== BYE &&
        bId !== BYE,
    };
    byId.set(m.id, resolved);
  }

  // The reset only happens if the losers-bracket player won the grand final.
  if (bracket.type === "double") {
    const gf = byId.get("GF");
    const reset = byId.get("GF-RESET");
    if (gf && reset) {
      const wbFinalId = `W${Math.log2(bracket.size)}-1`;
      const wbChamp = byId.get(wbFinalId)?.winnerId ?? null;
      const needsReset = gf.winnerId !== null && gf.winnerId !== wbChamp;
      if (!needsReset) {
        reset.aId = null;
        reset.bId = null;
        reset.winnerId = null;
        reset.loserId = null;
        reset.playable = false;
        reset.walkover = true;
      }
    }
  }

  const { champion, placements, complete } = summarise(bracket, byId);
  return {
    bracket,
    matches: [...byId.values()],
    byId,
    champion,
    placements,
    complete,
  };
}

/**
 * Order matches so every match comes after the matches its slots reference.
 * The graph is a DAG by construction (a slot only ever points backwards), so
 * a depth-first post-order is a valid topological sort.
 */
function topoOrder(matches: BracketMatch[]): BracketMatch[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const out: BracketMatch[] = [];

  const visit = (m: BracketMatch) => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    for (const slot of [m.a, m.b]) {
      if (slot.from === "seed") continue;
      const dep = byId.get(slot.match);
      if (dep) visit(dep);
    }
    out.push(m);
  };

  // Visit in a stable order so the output is deterministic run to run.
  for (const m of [...matches].sort(
    (a, b) => a.round - b.round || a.order - b.order,
  )) {
    visit(m);
  }
  return out;
}

function resolveSlot(
  slot: SlotRef,
  seeds: Map<number, string>,
  byId: Map<string, ResolvedMatch>,
  playerCount: number,
): string | null {
  if (slot.from === "seed") {
    if (slot.seed > playerCount) return BYE;
    return seeds.get(slot.seed) ?? BYE;
  }
  const src = byId.get(slot.match);
  if (!src) return null;
  return slot.from === "winner" ? src.winnerId : src.loserId;
}

function summarise(bracket: Bracket, byId: Map<string, ResolvedMatch>) {
  const placements = new Map<string, number>();
  const rounds = Math.log2(bracket.size);

  let champion: string | null = null;
  let runnerUp: string | null = null;

  if (bracket.type === "single") {
    const final = byId.get(`W${rounds}-1`);
    champion = final?.winnerId ?? null;
    runnerUp = final?.loserId ?? null;
  } else {
    const reset = byId.get("GF-RESET");
    const gf = byId.get("GF");
    if (reset && !reset.walkover && reset.winnerId) {
      champion = reset.winnerId;
      runnerUp = reset.loserId;
    } else if (gf && reset?.walkover && gf.winnerId) {
      champion = gf.winnerId;
      runnerUp = gf.loserId;
    }
  }

  if (champion && champion !== BYE) placements.set(champion, 1);
  if (runnerUp && runnerUp !== BYE) placements.set(runnerUp, 2);

  // Third place: in single elimination it's genuinely undecided between the
  // two semifinal losers (we don't run a consolation match), so only claim it
  // for double elimination, where the last losers-bracket match settles it.
  if (bracket.type === "double") {
    const losersRounds = 2 * (rounds - 1);
    if (losersRounds > 0) {
      const lbFinal = byId.get(`L${losersRounds}-1`);
      const third = lbFinal?.loserId ?? null;
      if (third && third !== BYE && !placements.has(third)) {
        placements.set(third, 3);
      }
    }
  }

  return { champion, placements, complete: champion !== null };
}

/** Matches that can be played right now, in the order they should be called. */
export function readyMatches(resolved: ResolvedBracket): ResolvedMatch[] {
  return resolved.matches
    .filter((m) => m.playable)
    .sort((a, b) => a.round - b.round || a.order - b.order);
}

/**
 * How many losses a player has taken. Drives the "lives" pill in the UI and,
 * in double elimination, tells you who is playing on the edge.
 */
export function lossesByPlayer(resolved: ResolvedBracket): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of resolved.matches) {
    if (m.walkover || !m.loserId || m.loserId === BYE) continue;
    out.set(m.loserId, (out.get(m.loserId) ?? 0) + 1);
  }
  return out;
}

export function isEliminated(
  resolved: ResolvedBracket,
  playerId: string,
): boolean {
  const limit = resolved.bracket.type === "double" ? 2 : 1;
  return (lossesByPlayer(resolved).get(playerId) ?? 0) >= limit;
}

/** Group matches into columns for drawing, per bracket side. */
export function bracketColumns(
  resolved: ResolvedBracket,
  side: BracketSide,
): { round: number; label: string; matches: ResolvedMatch[] }[] {
  const rounds = new Map<number, ResolvedMatch[]>();
  for (const m of resolved.matches) {
    if (m.bracket !== side) continue;
    if (m.walkover && m.id === "GF-RESET") continue;
    const list = rounds.get(m.round) ?? [];
    list.push(m);
    rounds.set(m.round, list);
  }
  return [...rounds.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, matches]) => ({
      round,
      label: matches[0]?.label ?? `Round ${round}`,
      matches: matches.sort((a, b) => a.order - b.order),
    }));
}
