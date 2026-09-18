import { buildSetup, replay, reduce, initialState, earnedPatches, hillState, sweepWatch, type MatchEvent } from "@/lib/rack/rules/match";
import { targetFor, timeoutsPerRack } from "@/lib/rack/rules/race";

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (!cond) { failures++; console.log("FAIL:", name, JSON.stringify(extra ?? "")); }
};

// --- race chart sanity (the thing the old app got wrong) -------------------
check("8ball SL4 vs SL7 -> 2", targetFor("8-ball", 4, 7) === 2, targetFor("8-ball", 4, 7));
check("8ball SL7 vs SL4 -> 5", targetFor("8-ball", 7, 4) === 5, targetFor("8-ball", 7, 4));
check("8ball SL2 vs SL7 -> 2", targetFor("8-ball", 2, 7) === 2);
check("8ball SL7 vs SL2 -> 7", targetFor("8-ball", 7, 2) === 7);
check("8ball SL5 vs SL5 -> 4", targetFor("8-ball", 5, 5) === 4);
check("9ball SL5 -> 38", targetFor("9-ball", 5, 9) === 38, targetFor("9-ball", 5, 9));
check("9ball SL9 -> 75", targetFor("9-ball", 9, 1) === 75);
check("timeouts SL3 -> 2", timeoutsPerRack("8-ball", 3) === 2);
check("timeouts SL5 -> 1", timeoutsPerRack("8-ball", 5) === 1);
check("missing skill refuses", targetFor("8-ball", null, 5) === null);

// --- setup ----------------------------------------------------------------
const built = buildSetup({
  game: "8-ball", isCasual: false, breaker: 0,
  players: [{ userId: "u1", name: "Rob", skill: 5 }, { userId: "u2", name: "Pete", skill: 7 }],
});
check("setup ok", built.ok === true);
if (!built.ok) throw new Error(built.error);
const setup = built.setup;
check("Rob target 3 (SL5 v SL7)", setup.players[0].target === 3, setup.players[0]);
check("Pete target 5 (SL7 v SL5)", setup.players[1].target === 5, setup.players[1]);

const missing = buildSetup({ game: "8-ball", isCasual: false, breaker: 0,
  players: [{ userId: "u1", name: "Rob", skill: 5 }, { userId: "u2", name: "Pete", skill: null }] });
check("missing skill refused with name", !missing.ok && missing.error.includes("Pete"), missing);

// --- innings --------------------------------------------------------------
{
  let s = initialState(setup);
  s = reduce(s, { type: "turn_over" });            // -> Pete
  check("no inning after one turn", s.totalInnings === 0, s.totalInnings);
  s = reduce(s, { type: "turn_over" });            // -> back to breaker Rob
  check("inning after round trip", s.totalInnings === 1, s.totalInnings);
  check("per-player innings", s.players[0].innings === 1 && s.players[1].innings === 1, s.players.map(p=>p.innings));
}

// --- timeouts reset each rack --------------------------------------------
{
  let s = initialState(setup);
  check("SL5 gets 1 timeout", s.players[0].timeoutsRemaining === 1);
  check("SL7 gets 1 timeout", s.players[1].timeoutsRemaining === 1);
  s = reduce(s, { type: "timeout", side: 0 });
  check("timeout spent", s.players[0].timeoutsRemaining === 0 && s.players[0].timeoutsUsed === 1);
  const blocked = reduce(s, { type: "timeout", side: 0 });
  check("cannot overspend timeouts", blocked === s, blocked.players[0]);
  s = reduce(s, { type: "rack_won", side: 0, kind: "normal" });
  check("timeouts reset on new rack", s.players[0].timeoutsRemaining === 1 && s.players[0].timeoutsUsed === 0);
  check("winner breaks next", s.breaker === 0 && s.turn === 0);
  check("rack advanced", s.rack === 2);
  check("rack innings reset", s.rackInnings === 0);
}

// --- sweep (opponent scores zero) ----------------------------------------
{
  const events: MatchEvent[] = [
    { type: "rack_won", side: 0, kind: "normal" },
    { type: "rack_won", side: 0, kind: "break_and_run" },
    { type: "rack_won", side: 0, kind: "normal" },
  ];
  const s = replay(setup, events);
  check("match complete", s.status === "complete" && s.winner === 0, s.status);
  const patches = earnedPatches(s);
  check("sweep detected", patches.some(p => p.kind === "sweep" && p.side === 0), patches);
  check("break-and-run counted", patches.some(p => p.kind === "break-and-run" && p.count === 1), patches);
  check("no mini-sweep when sweep", !patches.some(p => p.kind === "mini-sweep"), patches);
}

// --- mini-sweep (opponent scored but never reached the hill) --------------
{
  // Pete races to 5, so his hill is 4. Pete gets 2 -> never on the hill.
  const events: MatchEvent[] = [
    { type: "rack_won", side: 1, kind: "normal" },
    { type: "rack_won", side: 1, kind: "normal" },
    { type: "rack_won", side: 0, kind: "normal" },
    { type: "rack_won", side: 0, kind: "normal" },
    { type: "rack_won", side: 0, kind: "normal" },
  ];
  const s = replay(setup, events);
  check("mini-sweep match complete", s.status === "complete" && s.winner === 0);
  const patches = earnedPatches(s);
  check("mini-sweep detected", patches.some(p => p.kind === "mini-sweep" && p.side === 0), patches);
  check("not a sweep", !patches.some(p => p.kind === "sweep"), patches);
}

// --- opponent reached the hill -> neither sweep nor mini-sweep ------------
{
  const events: MatchEvent[] = [
    ...Array(4).fill(0).map(() => ({ type: "rack_won", side: 1, kind: "normal" } as MatchEvent)),
    ...Array(3).fill(0).map(() => ({ type: "rack_won", side: 0, kind: "normal" } as MatchEvent)),
  ];
  const s = replay(setup, events);
  check("winner is Rob", s.winner === 0, s.winner);
  const patches = earnedPatches(s);
  check("no sweep patches when opponent hit the hill", !patches.some(p => p.kind === "sweep" || p.kind === "mini-sweep"), patches);
}

// --- hill / hill-hill -----------------------------------------------------
{
  let s = replay(setup, [
    { type: "rack_won", side: 0, kind: "normal" },
    { type: "rack_won", side: 0, kind: "normal" },  // Rob 2/3 -> on hill
  ]);
  check("Rob on hill", hillState(s).onHill.includes(0), hillState(s));
  check("sweep watch live", sweepWatch(s) === 0, sweepWatch(s));
  s = replay(setup, [
    ...Array(2).fill(0).map(() => ({ type: "rack_won", side: 0, kind: "normal" } as MatchEvent)),
    ...Array(4).fill(0).map(() => ({ type: "rack_won", side: 1, kind: "normal" } as MatchEvent)),
  ]);
  check("hill-hill", hillState(s).hillHill === true, hillState(s));
  check("sweep watch cleared once opponent scores", sweepWatch(s) === null);
}

// --- undo by replay -------------------------------------------------------
{
  const events: MatchEvent[] = [
    { type: "rack_won", side: 0, kind: "break_and_run" },
    { type: "timeout", side: 1 },
    { type: "rack_won", side: 1, kind: "normal" },
  ];
  const full = replay(setup, events);
  const undone = replay(setup, events.slice(0, -1));
  check("undo restores score", undone.players[1].score === 0, undone.players[1].score);
  check("undo restores breaker", undone.breaker === 0, undone.breaker);
  check("undo restores rack number", undone.rack === 2, undone.rack);
  check("undo keeps the break-and-run", undone.players[0].breakAndRuns === 1);
  check("undo restores the spent timeout", undone.players[1].timeoutsUsed === 1, undone.players[1]);
  check("redo matches original", JSON.stringify(reduce(undone, events[2])) === JSON.stringify(full));
}

// --- 9-ball ---------------------------------------------------------------
{
  const nine = buildSetup({ game: "9-ball", isCasual: false, breaker: 0,
    players: [{ userId: "u1", name: "Rob", skill: 5 }, { userId: "u2", name: "Pete", skill: 3 }] });
  if (!nine.ok) throw new Error(nine.error);
  check("9ball Rob target 38", nine.setup.players[0].target === 38, nine.setup.players[0].target);
  check("9ball Pete target 25", nine.setup.players[1].target === 25, nine.setup.players[1].target);
  let s = initialState(nine.setup);
  s = reduce(s, { type: "points", side: 0, points: 8 });
  s = reduce(s, { type: "points", side: 0, points: 2, nineOnSnap: true });
  check("9ball points accumulate", s.players[0].score === 10, s.players[0].score);
  check("9ball rack points tracked", s.rackPoints === 10, s.rackPoints);
  check("9-on-snap counted", s.players[0].nineOnSnaps === 1);
  s = reduce(s, { type: "rack_end" });
  check("9ball rack advanced", s.rack === 2 && s.rackPoints === 0);
  // Ride to the target
  for (let i = 0; i < 3; i++) s = reduce(s, { type: "points", side: 0, points: 10 });
  check("9ball not won at 40 < ... wait target 38", s.status === "complete" && s.winner === 0, { score: s.players[0].score, status: s.status });
  const p = earnedPatches(s);
  check("9-on-snap patch surfaced", p.some(x => x.kind === "9-on-snap"), p);
}

// --- forfeit --------------------------------------------------------------
{
  const s = replay(setup, [{ type: "forfeit", side: 1 }]);
  check("forfeit gives win to other side", s.status === "complete" && s.winner === 0);
  check("forfeit records who quit", s.forfeitedBy === 1);
  check("forfeit earns no sweep", earnedPatches(s).length === 0, earnedPatches(s));
}

// --- version increments monotonically ------------------------------------
{
  const events: MatchEvent[] = [
    { type: "turn_over" }, { type: "safety", side: 1 }, { type: "turn_over" },
    { type: "defensive_shot", side: 0 }, { type: "rack_won", side: 0, kind: "normal" },
  ];
  const s = replay(setup, events);
  check("version == event count", s.version === events.length, s.version);
}

console.log(failures === 0 ? "ALL MATCH TESTS PASSED" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
