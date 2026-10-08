import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import {
  outcomeOf,
  setupFromShot,
  simulateShot,
} from "@/lib/kinister/physics";

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (!cond) { failures++; console.log("FAIL:", name, JSON.stringify(extra ?? "")); }
};
const deg = (v: { x: number; y: number }) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

// --- physics sanity ---------------------------------------------------------
// Straight-in to the side pocket from 1.8 diamonds.
const straight = { cueBall: { x: 4, y: 3 }, objectBall: { x: 4, y: 1.2 }, targetPocket: "MR" as const };
{
  const draw = outcomeOf(simulateShot(straight, { power: 0.55, english: { x: 0, y: -0.6 } }), "MR");
  check("draw: OB pocketed", draw.madeTarget, draw);
  check("draw: CB comes back toward the shooter", draw.cueRest.y > 1.8, draw.cueRest);
  const follow = outcomeOf(simulateShot(straight, { power: 0.3, english: { x: 0, y: 0.6 } }), "MR");
  check("follow: CB rolls forward past the OB spot", follow.scratched !== null || follow.cueRest.y < 1.2, follow);
}

// Half-ball hit with a rolling cue ball: OB leaves ~30° off the line, CB ~34°.
{
  const R = 0.14;
  const setup = { cueBall: { x: 6, y: 2 }, objectBall: { x: 3, y: 2 + R }, targetPocket: null };
  const base = simulateShot(setup, { power: 0.35, english: { x: 0, y: 0.4 } });
  const off = 180 - deg(base.aim);
  const r = simulateShot(setup, { power: 0.35, english: { x: 0, y: 0.4 }, aimOffsetDeg: off > 180 ? off - 360 : off });
  const hit = r.events.find((e) => e.kind === "ball");
  check("half-ball: contact happens", !!hit);
  if (hit) {
    const i = Math.round(hit.t / r.frameDt);
    const ob = r.tracks.object.frames;
    const obAngle = 180 - Math.abs(deg({ x: ob[i + 20].x - ob[i].x, y: ob[i + 20].y - ob[i].y }));
    check("half-ball: OB ≈ 30°", Math.abs(obAngle - 30) < 3, obAngle);
  }
}

// Running vs reverse english off a cushion changes the rebound.
{
  const setup = { cueBall: { x: 2, y: 2 }, objectBall: { x: 7.8, y: 2 }, targetPocket: null };
  const restY = (x: number) =>
    simulateShot(setup, { power: 0.3, english: { x, y: 0 }, aimOffsetDeg: 30 }).tracks.cue.rest;
  const left = restY(-0.8);
  const right = restY(0.8);
  check("side spin changes the rebound", Math.hypot(left.x - right.x, left.y - right.y) > 0.3, { left, right });
}

// --- every catalog shot plays the way it's drawn with Bert's settings -------
for (const shot of KINISTER_SHOTS) {
  if (shot.sequence) continue;
  check(`${shot.id}: has calibrated power`, typeof shot.power === "number");
  const res = simulateShot(setupFromShot(shot), {
    power: shot.power ?? 0.45,
    english: shot.english ?? { x: 0, y: 0 },
  });
  const o = outcomeOf(res, shot.targetPocket);
  if (shot.targetPocket) check(`${shot.id}: pockets the OB`, o.madeTarget, o);
  check(`${shot.id}: no scratch`, o.scratched === null, o);
  const end = shot.cueBallPath[shot.cueBallPath.length - 1];
  const miss = Math.hypot(o.cueRest.x - end.x, o.cueRest.y - end.y);
  check(`${shot.id}: CB finishes on the drawn spot`, miss < 0.1, { miss, rest: o.cueRest, end });
  const drawnRails = shot.cueBallPath.slice(0, -1).length;
  check(`${shot.id}: rail count matches diagram`, o.cueRails === drawnRails, { sim: o.cueRails, drawn: drawnRails });
}

if (failures) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("kinister physics: all checks passed");
