import { buildBracket, resolveBracket, readyMatches, seedOrder, BYE, type MatchResults } from "@/lib/rack/rules/bracket";

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (!cond) { failures++; console.log("FAIL:", name, extra ?? ""); }
};

console.log("seedOrder(8) =", seedOrder(8).join(","));
check("seedOrder(8)", seedOrder(8).join(",") === "1,8,4,5,2,7,3,6");
check("seedOrder(4)", seedOrder(4).join(",") === "1,4,2,3");

// Simulate a whole tournament by always letting the better seed win.
function simulate(playerCount: number, type: "single" | "double") {
  const b = buildBracket(playerCount, type);
  const seeds = new Map<number, string>();
  for (let s = 1; s <= playerCount; s++) seeds.set(s, `P${s}`);
  const seedOf = (id: string) => parseInt(id.slice(1), 10);

  const results: MatchResults = {};
  let guard = 0;
  let r = resolveBracket(b, seeds, results);
  while (!r.complete && guard++ < 500) {
    const ready = readyMatches(r);
    if (ready.length === 0) break;
    for (const m of ready) {
      const winner = seedOf(m.aId!) < seedOf(m.bId!) ? m.aId! : m.bId!;
      results[m.id] = { winner };
    }
    r = resolveBracket(b, seeds, results);
  }
  return { b, r, played: Object.keys(results).length };
}

for (const type of ["single", "double"] as const) {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 11, 16, 23, 32]) {
    const { b, r, played } = simulate(n, type);
    check(`${type} n=${n} completes`, r.complete, { champion: r.champion });
    check(`${type} n=${n} champion is seed 1`, r.champion === "P1", r.champion);
    check(`${type} n=${n} no null participants in played matches`,
      r.matches.every(m => m.walkover || m.winnerId !== null || !m.playable));
    // No player should appear twice in the same match.
    check(`${type} n=${n} no self-matches`,
      r.matches.every(m => m.aId === null || m.bId === null || m.aId !== m.bId || m.aId === BYE));
    const elimCount = [...r.placements.entries()].length;
    console.log(`${type.padEnd(6)} n=${String(n).padStart(2)} size=${String(b.size).padStart(2)} matches=${String(b.matches.length).padStart(3)} played=${String(played).padStart(3)} champ=${r.champion} placements=${elimCount}`);
  }
}

// Double-elim reset: losers-bracket player wins the grand final -> reset is played.
{
  const b = buildBracket(4, "double");
  const seeds = new Map([[1,"A"],[2,"B"],[3,"C"],[4,"D"]]);
  const results: MatchResults = {};
  let r = resolveBracket(b, seeds, results);
  // Play out so the WB champ loses the GF.
  const step = (winnerFor: (m: any) => string) => {
    for (const m of readyMatches(r)) results[m.id] = { winner: winnerFor(m) };
    r = resolveBracket(b, seeds, results);
  };
  step(m => m.aId);          // W1-1, W1-2
  step(m => m.aId);          // W2-1 and L1-1
  step(m => m.aId);          // L2-1
  // Now GF: make the LOSERS bracket player win.
  const gf = r.byId.get("GF")!;
  const wbChamp = r.byId.get("W2-1")!.winnerId;
  const lbChamp = gf.aId === wbChamp ? gf.bId! : gf.aId!;
  results["GF"] = { winner: lbChamp };
  r = resolveBracket(b, seeds, results);
  check("reset becomes playable after LB wins GF", r.byId.get("GF-RESET")!.playable, r.byId.get("GF-RESET"));
  check("not complete until reset played", !r.complete);
  results["GF-RESET"] = { winner: lbChamp };
  r = resolveBracket(b, seeds, results);
  check("complete after reset", r.complete);
  check("reset winner is champion", r.champion === lbChamp, r.champion);
  console.log("reset path OK, champion =", r.champion);
}

// Double-elim no reset: WB champ wins GF -> reset skipped.
{
  const b = buildBracket(4, "double");
  const seeds = new Map([[1,"A"],[2,"B"],[3,"C"],[4,"D"]]);
  const results: MatchResults = {};
  let r = resolveBracket(b, seeds, results);
  let guard = 0;
  while (!r.complete && guard++ < 50) {
    for (const m of readyMatches(r)) results[m.id] = { winner: m.aId! };
    r = resolveBracket(b, seeds, results);
  }
  check("no-reset path complete", r.complete);
  check("reset stays walkover", r.byId.get("GF-RESET")!.walkover);
  console.log("no-reset path OK, champion =", r.champion, "3rd =", [...r.placements].find(([,p])=>p===3)?.[0]);
}

console.log(failures === 0 ? "\nALL BRACKET TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
