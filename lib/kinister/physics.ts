import type { DiamondCoord, EnglishHit, KinisterShot, PocketId } from "./shots";
import { POCKETS } from "./shots";
import { BALL_R, UNIT } from "./geometry";

/**
 * Pool physics simulation for the shot diagrams.
 *
 * Models the things that actually decide where balls go on a real table:
 *
 *  - Cue strike: tip offset → initial top/back spin and side spin
 *    (hitting 2/5 R above center = natural roll, below = draw).
 *  - Sliding → rolling on the cloth: a sliding ball's spin bends its path
 *    (the classic follow/draw curve after contact) until it reaches natural
 *    roll, then rolling resistance slows it gradually.
 *  - Ball–ball collisions with cut-induced and spin-induced throw.
 *  - Cushion rebounds with energy loss and side-spin friction, so running
 *    english widens the rebound angle and reverse english shortens it.
 *  - Pocket mouths at the corners and sides (scratches happen).
 *
 * Units: lengths are in diamonds (same grid as the shot catalog, y down),
 * time in seconds. The frame is x right, y down, z down into the cloth —
 * right-handed — so the cloth contact point sits at +R on z.
 */

export type Vec2 = { x: number; y: number };

/** Ball radius in diamonds. Matches the rendered ball so contacts line up. */
export const R = BALL_R / UNIT;
/** One diamond on a 9' table is 12.5" = 0.3175 m. */
const M_PER_DIAMOND = 0.3175;
const G = 9.81 / M_PER_DIAMOND;
/** Ball–cloth sliding friction. */
const MU_SLIDE = 0.2;
/** Rolling resistance. */
const MU_ROLL = 0.011;
/** Spin (vertical-axis) friction — how fast side spin bleeds off the cloth. */
const MU_SPIN = 0.0127;
/** Ball–ball coefficient of restitution. */
const E_BALL = 0.95;
/** Cushion coefficient of restitution (rubber + rail). */
const E_RAIL = 0.86;
/** Ball–cushion friction — lets english grab the rail. */
const MU_RAIL = 0.22;
/**
 * Fraction of the topspin/backspin component normal to the cushion that the
 * rail nose (contact above the ball's equator) strips off on impact.
 */
const RAIL_SPIN_KEEP = 0.55;

/** Stroke power used when a shot has no calibrated `power`. */
export const DEFAULT_POWER = 0.45;

/** Max tip offset from center as a fraction of R (≈ miscue limit). */
export const MAX_TIP_OFFSET = 0.5;

/** Simulation step and recording interval (seconds). */
const DT = 1 / 1000;
const FRAME_DT = 1 / 120;
const MAX_TIME = 16;

/** Table bounds for ball centers. */
const X_MIN = R;
const X_MAX = 8 - R;
const Y_MIN = R;
const Y_MAX = 4 - R;
/** Half-width of the corner pocket mouth measured along each rail from the corner. */
const CORNER_MOUTH = 0.34;
/** Half-width of the side pocket mouth measured along the rail. */
const SIDE_MOUTH = 0.21;

/**
 * Cue speed (m/s) for a power setting in [0, 1]. Soft lag ≈ 0.6 m/s,
 * medium ≈ 2.4 m/s, firm ≈ 4.3 m/s, power stroke ≈ 7 m/s+. Squared so
 * the low end of the slider gets the fine control finesse shots need.
 */
export function powerToSpeed(power: number): number {
  const p = Math.max(0, Math.min(1, power));
  return 0.35 + 7.9 * p * p;
}

export function powerLabel(power: number): string {
  const v = powerToSpeed(power);
  if (v < 0.9) return "Soft touch";
  if (v < 1.7) return "Slow";
  if (v < 2.8) return "Medium";
  if (v < 4.2) return "Medium-firm";
  if (v < 6) return "Firm";
  return "Power";
}

type V3 = [number, number, number];

type Ball = {
  id: BallId;
  p: Vec2;
  v: Vec2;
  w: V3;
  pocketed: PocketId | null;
  moving: boolean;
};

export type BallId = "cue" | "object" | `other-${number}`;

export type SimEvent =
  | { t: number; kind: "strike"; ball: BallId; p: Vec2 }
  | { t: number; kind: "ball"; a: BallId; b: BallId; p: Vec2 }
  | { t: number; kind: "rail"; ball: BallId; p: Vec2 }
  | { t: number; kind: "pocket"; ball: BallId; pocket: PocketId; p: Vec2 }
  | { t: number; kind: "rest"; ball: BallId; p: Vec2 };

export type BallTrack = {
  id: BallId;
  /** Positions sampled at `frameDt` intervals until the ball stops / drops. */
  frames: Vec2[];
  /** Index after which the ball is gone (pocketed). -1 if never pocketed. */
  pocketedAtFrame: number;
  pocket: PocketId | null;
  rest: Vec2;
};

export type SimResult = {
  frameDt: number;
  duration: number;
  tracks: Record<string, BallTrack>;
  events: SimEvent[];
  /** Aim direction actually used (unit vector, diamond frame). */
  aim: Vec2;
};

export type ShotSettings = {
  /** 0..1 — see powerToSpeed. */
  power: number;
  /** Tip position, same convention as KinisterShot.english. */
  english: EnglishHit;
  /** Extra aim rotation in degrees (positive = clockwise on screen). */
  aimOffsetDeg?: number;
};

export type SimSetup = {
  cueBall: DiamondCoord;
  objectBall: DiamondCoord;
  otherBalls?: DiamondCoord[];
  /** Where to send the object ball. Null = aim at the OB's center. */
  targetPocket: PocketId | null;
};

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: Vec2) => Math.hypot(a.x, a.y);
const norm = (a: Vec2): Vec2 => {
  const l = len(a);
  return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
};
const cross3 = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/** I = 2/5 m R² → angular impulse per unit (linear impulse / m) is (r × J) / (0.4 R²). */
const INV_I = 1 / (0.4 * R * R);

/** Point on the pocket where the object ball should be sent. */
export function pocketAimPoint(id: PocketId): Vec2 {
  const p = POCKETS[id];
  // Side pockets: aim a touch past the rail line so the ball goes in
  // through the middle of the mouth rather than at the facing points.
  if (id === "MR") return { x: p.x, y: p.y - 0.1 };
  if (id === "ML") return { x: p.x, y: p.y + 0.1 };
  return p;
}

function makeBall(id: BallId, p: DiamondCoord): Ball {
  return { id, p: { ...p }, v: { x: 0, y: 0 }, w: [0, 0, 0], pocketed: null, moving: false };
}

/**
 * Apply the cue strike. `dir` is the unit aim direction, `speed` in
 * diamonds/s. Side offset is along the shooter's right; vertical offset is
 * up (−z).
 */
function strike(b: Ball, dir: Vec2, speed: number, english: EnglishHit) {
  const a = Math.max(-1, Math.min(1, english.x)) * MAX_TIP_OFFSET;
  const c = Math.max(-1, Math.min(1, english.y)) * MAX_TIP_OFFSET;
  // Shooter's right in a y-down screen frame.
  const right = { x: -dir.y, y: dir.x };
  b.v = { x: dir.x * speed, y: dir.y * speed };
  const r: V3 = [a * R * right.x, a * R * right.y, -c * R];
  const J: V3 = [dir.x * speed, dir.y * speed, 0];
  const dw = cross3(r, J);
  b.w = [dw[0] * INV_I, dw[1] * INV_I, dw[2] * INV_I];
  b.moving = true;
}

function stepCloth(b: Ball, dt: number) {
  const ux = b.v.x + R * b.w[1];
  const uy = b.v.y - R * b.w[0];
  const us = Math.hypot(ux, uy);
  const speed = Math.hypot(b.v.x, b.v.y);
  if (us > 1e-3) {
    // Sliding: friction opposes the slip. The slip itself decays at
    // 7/2 μg, so cap the step so it doesn't overshoot past zero.
    const decel = MU_SLIDE * G;
    const maxDt = us / (3.5 * decel);
    const h = Math.min(dt, maxDt);
    const fx = (-decel * ux) / us;
    const fy = (-decel * uy) / us;
    b.v.x += fx * h;
    b.v.y += fy * h;
    // torque = (0,0,R) × F → (−R Fy, R Fx, 0); dω = torque / I (per unit mass)
    b.w[0] += -R * fy * h * INV_I;
    b.w[1] += R * fx * h * INV_I;
    if (h < dt) rollStep(b, dt - h);
  } else if (speed > 1e-4) {
    rollStep(b, dt);
  } else {
    b.v.x = 0;
    b.v.y = 0;
    b.w[0] = 0;
    b.w[1] = 0;
  }
  // Vertical-axis (side) spin bleeds off independently.
  const spinDecay = ((5 * MU_SPIN * G) / (2 * R)) * dt;
  if (Math.abs(b.w[2]) <= spinDecay) b.w[2] = 0;
  else b.w[2] -= Math.sign(b.w[2]) * spinDecay;
}

function rollStep(b: Ball, dt: number) {
  const speed = len(b.v);
  const dv = MU_ROLL * G * dt;
  const ns = Math.max(0, speed - dv);
  const k = speed > 0 ? ns / speed : 0;
  b.v.x *= k;
  b.v.y *= k;
  // Natural roll: slip = 0 → ωy = −vx/R, ωx = vy/R
  b.w[0] = b.v.y / R;
  b.w[1] = -b.v.x / R;
}

/** Ball–ball collision with friction (throw). n points from a to b. */
function collide(a: Ball, b: Ball) {
  const n = norm(sub(b.p, a.p));
  const vn = (a.v.x - b.v.x) * n.x + (a.v.y - b.v.y) * n.y;
  if (vn <= 0) return;
  const ca: V3 = [n.x * R, n.y * R, 0];
  const cb: V3 = [-n.x * R, -n.y * R, 0];
  const wa = cross3(a.w, ca);
  const wb = cross3(b.w, cb);
  const rel: V3 = [
    a.v.x + wa[0] - (b.v.x + wb[0]),
    a.v.y + wa[1] - (b.v.y + wb[1]),
    wa[2] - wb[2],
  ];
  const relN = rel[0] * n.x + rel[1] * n.y;
  const t: V3 = [rel[0] - relN * n.x, rel[1] - relN * n.y, rel[2]];
  const tLen = Math.hypot(t[0], t[1], t[2]);

  const Jn = ((1 + E_BALL) * vn) / 2;
  a.v.x -= Jn * n.x;
  a.v.y -= Jn * n.y;
  b.v.x += Jn * n.x;
  b.v.y += Jn * n.y;

  if (tLen > 1e-6) {
    // Throw friction falls off with sliding speed (Alciatore's fit).
    const vRel = tLen * M_PER_DIAMOND;
    const mu = 0.01 + 0.108 * Math.exp(-1.088 * vRel);
    const Jt = Math.min(mu * Jn, tLen / 7);
    const J: V3 = [(t[0] / tLen) * Jt, (t[1] / tLen) * Jt, (t[2] / tLen) * Jt];
    a.v.x -= J[0];
    a.v.y -= J[1];
    b.v.x += J[0];
    b.v.y += J[1];
    const dwa = cross3(ca, [-J[0], -J[1], -J[2]]);
    const dwb = cross3(cb, J);
    for (let i = 0; i < 3; i++) {
      a.w[i] += dwa[i] * INV_I;
      b.w[i] += dwb[i] * INV_I;
    }
  }
  a.moving = true;
  b.moving = true;
}

/** Cushion rebound. `n` is the inward normal (pointing onto the table). */
function cushion(b: Ball, n: Vec2) {
  const vn = b.v.x * n.x + b.v.y * n.y;
  if (vn >= 0) return;
  const t = { x: -n.y, y: n.x };
  // Contact at the equator, on the rail side of the ball.
  const c: V3 = [-n.x * R, -n.y * R, 0];
  const wc = cross3(b.w, c);
  const s = (b.v.x + wc[0]) * t.x + (b.v.y + wc[1]) * t.y;
  // Speed-dependent restitution: hard shots lose more into the rubber.
  const e = Math.max(0.68, E_RAIL - 0.025 * Math.abs(vn) * M_PER_DIAMOND);
  const Jn = -(1 + e) * vn;
  b.v.x += Jn * n.x;
  b.v.y += Jn * n.y;
  if (Math.abs(s) > 1e-6) {
    const Jt = -Math.sign(s) * Math.min(MU_RAIL * Jn, Math.abs(s) / 3.5);
    b.v.x += Jt * t.x;
    b.v.y += Jt * t.y;
    const dw = cross3(c, [Jt * t.x, Jt * t.y, 0]);
    b.w[2] += dw[2] * INV_I;
  }
  // The cushion nose sits above the equator and scrubs off part of the
  // roll component that was driving the ball into the rail.
  const roll = { x: b.w[0], y: b.w[1] };
  // Roll axis associated with motion along n is (n.y, −n.x).
  const axis = { x: n.y, y: -n.x };
  const along = roll.x * axis.x + roll.y * axis.y;
  b.w[0] -= (1 - RAIL_SPIN_KEEP) * along * axis.x;
  b.w[1] -= (1 - RAIL_SPIN_KEEP) * along * axis.y;
}

/** Returns the pocket a ball reaching the rail at `p` falls into, if any. */
function pocketAt(p: Vec2): PocketId | null {
  const nearHead = p.x < CORNER_MOUTH + R;
  const nearFoot = p.x > 8 - CORNER_MOUTH - R;
  const nearTop = p.y < CORNER_MOUTH + R;
  const nearBottom = p.y > 4 - CORNER_MOUTH - R;
  if (nearHead && nearTop) return "TR";
  if (nearHead && nearBottom) return "TL";
  if (nearFoot && nearTop) return "BR";
  if (nearFoot && nearBottom) return "BL";
  if (Math.abs(p.x - 4) < SIDE_MOUTH) {
    if (p.y <= Y_MIN + 1e-3) return "MR";
    if (p.y >= Y_MAX - 1e-3) return "ML";
  }
  return null;
}

/**
 * Aim direction that sends the object ball at `target`, accounting for
 * throw. Starts from the ghost-ball line and refines with a few secant
 * iterations on the object ball's actual departure angle.
 */
export function solveAim(
  setup: SimSetup,
  settings: ShotSettings,
): Vec2 {
  const cue = setup.cueBall;
  const ob = setup.objectBall;
  if (!setup.targetPocket) return norm(sub(ob, cue));
  const target = pocketAimPoint(setup.targetPocket);
  const want = norm(sub(target, ob));
  const ghost = { x: ob.x - want.x * 2 * R, y: ob.y - want.y * 2 * R };
  const base = Math.atan2(ghost.y - cue.y, ghost.x - cue.x);
  const wantAng = Math.atan2(want.y, want.x);

  const err = (ang: number): number | null => {
    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
    const obDir = firstContactDirection(setup, settings, dir);
    if (!obDir) return null;
    let d = Math.atan2(obDir.y, obDir.x) - wantAng;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };

  let a0 = base;
  let e0 = err(a0);
  if (e0 === null) return { x: Math.cos(base), y: Math.sin(base) };
  let a1 = base + 0.004;
  let e1 = err(a1);
  for (let i = 0; i < 6 && e1 !== null && Math.abs(e1) > 1e-5; i++) {
    const denom = e1 - e0;
    if (Math.abs(denom) < 1e-12) break;
    const a2 = a1 - (e1 * (a1 - a0)) / denom;
    a0 = a1;
    e0 = e1;
    a1 = a2;
    e1 = err(a1);
  }
  const best = e1 !== null && Math.abs(e1) < Math.abs(e0) ? a1 : a0;
  return { x: Math.cos(best), y: Math.sin(best) };
}

/** Simulate only until the cue ball first touches the object ball. */
function firstContactDirection(
  setup: SimSetup,
  settings: ShotSettings,
  dir: Vec2,
): Vec2 | null {
  const res = run(setup, settings, dir, { stopAtFirstContact: true });
  return res.obDir;
}

/**
 * Simulate a shot. The aim is solved so the object ball heads for the
 * target pocket (throw included), then rotated by `aimOffsetDeg`.
 */
export function simulateShot(setup: SimSetup, settings: ShotSettings): SimResult {
  let aim = solveAim(setup, settings);
  if (settings.aimOffsetDeg) {
    const a = Math.atan2(aim.y, aim.x) + (settings.aimOffsetDeg * Math.PI) / 180;
    aim = { x: Math.cos(a), y: Math.sin(a) };
  }
  return run(setup, settings, aim, {}).result;
}

export function setupFromShot(shot: KinisterShot): SimSetup {
  return {
    cueBall: shot.cueBall,
    objectBall: shot.objectBall,
    otherBalls: shot.otherBalls,
    targetPocket: shot.targetPocket,
  };
}

function run(
  setup: SimSetup,
  settings: ShotSettings,
  aim: Vec2,
  opts: { stopAtFirstContact?: boolean },
): { result: SimResult; obDir: Vec2 | null } {
  const balls: Ball[] = [
    makeBall("cue", setup.cueBall),
    makeBall("object", setup.objectBall),
    ...(setup.otherBalls ?? []).map((p, i) => makeBall(`other-${i}`, p)),
  ];
  const cue = balls[0];
  const events: SimEvent[] = [];
  const speed = powerToSpeed(settings.power) / M_PER_DIAMOND;
  strike(cue, aim, speed, settings.english);
  events.push({ t: 0, kind: "strike", ball: "cue", p: { ...cue.p } });

  const tracks: Record<string, BallTrack> = {};
  for (const b of balls) {
    tracks[b.id] = { id: b.id, frames: [{ ...b.p }], pocketedAtFrame: -1, pocket: null, rest: { ...b.p } };
  }

  let t = 0;
  let nextFrame = FRAME_DT;
  let obDir: Vec2 | null = null;
  // Track which pairs were touching last step so we don't re-collide.
  const touching = new Set<number>();

  while (t < MAX_TIME) {
    // Integrate cloth friction + motion.
    for (const b of balls) {
      if (b.pocketed || !b.moving) continue;
      stepCloth(b, DT);
      b.p.x += b.v.x * DT;
      b.p.y += b.v.y * DT;
    }

    // Ball–ball contacts.
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.pocketed) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.pocketed) continue;
        if (!a.moving && !b.moving) continue;
        const key = i * 64 + j;
        const ddx = b.p.x - a.p.x;
        const ddy = b.p.y - a.p.y;
        if (ddx * ddx + ddy * ddy >= 4 * R * R) {
          if (touching.size) touching.delete(key);
          continue;
        }
        const d = { x: ddx, y: ddy };
        const dist = len(d);
        {
          if (touching.has(key)) continue;
          // Rewind both balls along their velocities to the exact contact.
          const dv = sub(b.v, a.v);
          const A = dv.x * dv.x + dv.y * dv.y;
          const B = 2 * (d.x * dv.x + d.y * dv.y);
          const C = dist * dist - 4 * R * R;
          let back = 0;
          if (A > 1e-12) {
            const disc = B * B - 4 * A * C;
            if (disc >= 0) {
              const root = (-B - Math.sqrt(disc)) / (2 * A);
              if (root < 0 && root > -DT * 2) back = root;
            }
          }
          a.p.x += a.v.x * back;
          a.p.y += a.v.y * back;
          b.p.x += b.v.x * back;
          b.p.y += b.v.y * back;
          collide(a, b);
          a.p.x -= a.v.x * back;
          a.p.y -= a.v.y * back;
          b.p.x -= b.v.x * back;
          b.p.y -= b.v.y * back;
          touching.add(key);
          const mid = { x: (a.p.x + b.p.x) / 2, y: (a.p.y + b.p.y) / 2 };
          events.push({ t, kind: "ball", a: a.id, b: b.id, p: mid });
          if (opts.stopAtFirstContact && a.id === "cue" && b.id === "object") {
            obDir = norm(b.v);
            return { result: finish(), obDir };
          }
        }
      }
    }

    // Cushions and pockets.
    for (const b of balls) {
      if (b.pocketed || !b.moving) continue;
      // Corner capture: ball rolling deep into the corner.
      const nearCorner =
        (b.p.x < 0.5 || b.p.x > 7.5) && (b.p.y < 0.5 || b.p.y > 3.5);
      if (nearCorner) for (const id of ["TR", "TL", "BR", "BL"] as const) {
        const pp = POCKETS[id];
        if (Math.hypot(b.p.x - pp.x, b.p.y - pp.y) < R + 0.13) {
          sink(b, id);
          break;
        }
      }
      if (b.pocketed) continue;
      const hits: Vec2[] = [];
      if (b.p.x < X_MIN && b.v.x < 0) hits.push({ x: 1, y: 0 });
      if (b.p.x > X_MAX && b.v.x > 0) hits.push({ x: -1, y: 0 });
      if (b.p.y < Y_MIN && b.v.y < 0) hits.push({ x: 0, y: 1 });
      if (b.p.y > Y_MAX && b.v.y > 0) hits.push({ x: 0, y: -1 });
      if (hits.length === 0) continue;
      const pocket = pocketAt(b.p);
      if (pocket) {
        sink(b, pocket);
        continue;
      }
      for (const n of hits) {
        cushion(b, n);
        events.push({ t, kind: "rail", ball: b.id, p: { ...b.p } });
      }
      b.p.x = Math.min(X_MAX, Math.max(X_MIN, b.p.x));
      b.p.y = Math.min(Y_MAX, Math.max(Y_MIN, b.p.y));
    }

    t += DT;

    // Rest detection.
    let anyMoving = false;
    for (const b of balls) {
      if (b.pocketed || !b.moving) continue;
      const still =
        Math.abs(b.v.x) + Math.abs(b.v.y) < 1e-4 &&
        Math.abs(b.v.x + R * b.w[1]) + Math.abs(b.v.y - R * b.w[0]) < 1e-3;
      if (still) {
        b.moving = false;
        b.v.x = 0;
        b.v.y = 0;
        events.push({ t, kind: "rest", ball: b.id, p: { ...b.p } });
      } else {
        anyMoving = true;
      }
    }

    if (t >= nextFrame) {
      for (const b of balls) {
        const tr = tracks[b.id];
        if (tr.pocketedAtFrame >= 0) continue;
        tr.frames.push({ ...b.p });
      }
      nextFrame += FRAME_DT;
    }
    if (!anyMoving) break;
  }

  function sink(b: Ball, pocket: PocketId) {
    b.pocketed = pocket;
    b.moving = false;
    const pp = POCKETS[pocket];
    const tr = tracks[b.id];
    tr.frames.push({ ...b.p });
    tr.frames.push({ ...pp });
    tr.pocketedAtFrame = tr.frames.length - 1;
    tr.pocket = pocket;
    events.push({ t, kind: "pocket", ball: b.id, pocket, p: { ...pp } });
  }

  function finish(): SimResult {
    let maxFrames = 0;
    for (const b of balls) {
      const tr = tracks[b.id];
      if (!b.pocketed) {
        const last = tr.frames[tr.frames.length - 1];
        if (last.x !== b.p.x || last.y !== b.p.y) tr.frames.push({ ...b.p });
      }
      tr.rest = { ...tr.frames[tr.frames.length - 1] };
      maxFrames = Math.max(maxFrames, tr.frames.length);
    }
    return {
      frameDt: FRAME_DT,
      duration: (maxFrames - 1) * FRAME_DT,
      tracks,
      events,
      aim,
    };
  }

  return { result: finish(), obDir };
}

/** Position of a ball at time `t` (seconds), interpolated between frames. */
export function positionAt(track: BallTrack, t: number, frameDt: number): Vec2 | null {
  const f = t / frameDt;
  const i = Math.floor(f);
  if (track.pocketedAtFrame >= 0 && i >= track.pocketedAtFrame) return null;
  if (i >= track.frames.length - 1) return track.frames[track.frames.length - 1];
  if (i < 0) return track.frames[0];
  const a = track.frames[i];
  const b = track.frames[i + 1];
  const k = f - i;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/** Simplified polyline for drawing a ball's path. */
export function trackPolyline(track: BallTrack, step = 2): Vec2[] {
  const pts: Vec2[] = [];
  const n = track.frames.length;
  for (let i = 0; i < n; i += step) pts.push(track.frames[i]);
  if (n > 0 && pts[pts.length - 1] !== track.frames[n - 1]) pts.push(track.frames[n - 1]);
  return pts;
}

/** Summary of how a simulated shot played out. */
export type ShotOutcome = {
  objectPocketed: PocketId | null;
  madeTarget: boolean;
  scratched: PocketId | null;
  cueRest: Vec2;
  objectRest: Vec2;
  cueRails: number;
};

export function outcomeOf(res: SimResult, target: PocketId | null): ShotOutcome {
  const cue = res.tracks.cue;
  const ob = res.tracks.object;
  return {
    objectPocketed: ob.pocket,
    madeTarget: target !== null && ob.pocket === target,
    scratched: cue.pocket,
    cueRest: cue.rest,
    objectRest: ob.rest,
    cueRails: res.events.filter((e) => e.kind === "rail" && e.ball === "cue").length,
  };
}
