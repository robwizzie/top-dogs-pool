/**
 * Turns a tracked shot into coaching feedback.
 *
 * Everything is measured in table space against the drill's intent:
 *   - Pot: did the object ball drop, and in which pocket?
 *   - Aim: the object ball's departure line vs the line into the target
 *     pocket — reported as over/under-cut in degrees and how far off the
 *     pocket centre that line arrives.
 *   - Position: where the cue ball stopped vs where the drill wants it,
 *     split into long/short along the intended path and off-line across it.
 *   - Path: rails the cue ball touched vs the drill's path; scratches.
 *   - Speed: cue-ball speed off the tip.
 */

import type { KinisterShot, PocketId } from "@/lib/kinister/shots";
import { POCKETS } from "@/lib/kinister/shots";
import type { ShotRecording, Sample } from "./shotTracker";
import { cushionDistance, dist, pocketName, type Pt } from "./table";

export type Verdict = "make" | "miss" | "uncertain";

export type ShotReport = {
  verdict: Verdict;
  /** Pocket the object ball dropped in, if any. */
  pocket: PocketId | null;
  targetPocket: PocketId | null;
  scratch: PocketId | null;
  hitObjectBall: boolean;
  aim: {
    /** + = overcut (too thin), − = undercut (too thick). Degrees. */
    errorDeg: number;
    /** Where the OB's line passes the pocket, inches from centre. */
    offsetIn: number;
    idealCutDeg: number;
    actualCutDeg: number;
  } | null;
  position: {
    actual: Pt;
    target: Pt;
    /** Diamonds. */
    error: number;
    /** + = long (past the target along the path), − = short. Diamonds. */
    along: number;
    /** Distance off the intended line. Diamonds. */
    across: number;
    /** Which rail the cue ball ended up closer to, relative to the line. */
    acrossToward: string | null;
  } | null;
  rails: { intended: number; actual: number } | null;
  /** Cue-ball speed off the tip, diamonds / second. */
  cueSpeed: number | null;
  /** Rough player-facing speed label. */
  speedLabel: string | null;
  /** 0–100. */
  score: number;
  headline: string;
  tips: string[];
  /** The tracking lost a ball or timed out — numbers are less reliable. */
  lowConfidence: boolean;
  /** Paths for drawing (table space). */
  cuePath: Pt[];
  objectPath: Pt[];
};

export function analyzeShot(
  shot: KinisterShot,
  rec: ShotRecording,
  opts: { ballR: number; inchesPerDiamond: number },
): ShotReport {
  const { ballR, inchesPerDiamond } = opts;
  const cueSamples = rec.cue.samples.filter((s) => s.t >= rec.startedAt - 100);
  const objSamples = rec.object.samples;
  const cuePath = smoothPath(cueSamples);
  const objectPath = smoothPath(objSamples.filter((s) => rec.contactAt === null || s.t >= rec.contactAt - 50));

  const hitObjectBall = rec.contactAt !== null;
  const pocket = rec.object.status === "pocketed" ? rec.object.pocket : null;
  const scratch = rec.cue.status === "pocketed" ? rec.cue.pocket : null;
  const targetPocket = shot.targetPocket;

  let verdict: Verdict;
  if (!targetPocket) verdict = "uncertain";
  else if (pocket === targetPocket && !scratch) verdict = "make";
  else if (pocket && pocket !== targetPocket) verdict = "miss";
  else if (scratch) verdict = "miss";
  else if (rec.object.status === "rest" || !hitObjectBall) verdict = "miss";
  else verdict = "uncertain";

  // ---- Aim ----
  let aim: ShotReport["aim"] = null;
  const aimTarget: Pt | null = shot.objectBallPath?.[0] ?? (targetPocket ? POCKETS[targetPocket] : null);
  if (hitObjectBall && aimTarget) {
    const dir = departureDirection(objSamples, rec.contactAt!, rec.object.rest, ballR);
    if (dir) {
      const ob = rec.object.rest;
      const cueRest = rec.cue.rest;
      const full = norm({ x: ob.x - cueRest.x, y: ob.y - cueRest.y });
      const ideal = norm({ x: aimTarget.x - ob.x, y: aimTarget.y - ob.y });
      if (full && ideal) {
        const idealCut = signedAngle(full, ideal);
        const actualCut = signedAngle(full, dir);
        // Overcut = the OB went further from the full-ball line than it
        // needed to. Over/under means nothing on a straight-in shot, so
        // there the error is the signed deviation (+ = to the left).
        const errorDeg =
          Math.abs(idealCut) < 1.5
            ? actualCut
            : Math.sign(idealCut) * (actualCut - idealCut);
        const toTarget = dist(ob, aimTarget);
        const devRad = (signedAngle(ideal, dir) * Math.PI) / 180;
        const offsetIn = Math.abs(Math.sin(devRad) * toTarget) * inchesPerDiamond;
        aim = { errorDeg, offsetIn, idealCutDeg: Math.abs(idealCut), actualCutDeg: Math.abs(actualCut) };
      }
    }
  }

  // ---- Position ----
  let position: ShotReport["position"] = null;
  const intended = shot.cueBallPath;
  const target = intended.length > 0 ? intended[intended.length - 1] : null;
  if (target && rec.cue.status !== "pocketed" && rec.cue.status !== "lost") {
    const actual = rec.cue.pos;
    // Direction of travel into the target: from the previous distinct
    // waypoint (or the object ball / cue ball start for a one-leg path).
    const prevPts = [shot.cueBall, shot.objectBall, ...intended.slice(0, -1)];
    let along0: Pt | null = null;
    for (let i = prevPts.length - 1; i >= 0 && !along0; i--) {
      if (dist(prevPts[i], target) > 0.05) along0 = norm({ x: target.x - prevPts[i].x, y: target.y - prevPts[i].y });
    }
    const d = { x: actual.x - target.x, y: actual.y - target.y };
    const along = along0 ? d.x * along0.x + d.y * along0.y : 0;
    const across = along0 ? Math.abs(d.x * -along0.y + d.y * along0.x) : Math.hypot(d.x, d.y);
    position = {
      actual,
      target,
      error: Math.hypot(d.x, d.y),
      along,
      across,
      acrossToward: across > 0.2 ? railToward(d, along0) : null,
    };
  }

  // ---- Rails ----
  let rails: ShotReport["rails"] = null;
  if (intended.length > 0) {
    // The last waypoint is where the cue ball stops, not a bounce.
    rails = {
      intended: intended.slice(0, -1).filter((p) => cushionDistance(p) < 0.2).length,
      actual: countRails(cueSamples, rec.contactAt, ballR),
    };
  }

  // ---- Speed ----
  const cueSpeed = initialSpeed(cueSamples, rec.startedAt);
  const speedLabel =
    cueSpeed === null ? null
    : cueSpeed < 2 ? "soft"
    : cueSpeed < 4.5 ? "medium"
    : cueSpeed < 8 ? "firm"
    : "hard";

  // ---- Score ----
  let score = 0;
  if (targetPocket) score += verdict === "make" ? 60 : 0;
  if (position) {
    const pScore = Math.max(0, 1 - position.error / 1.5);
    score += Math.round((targetPocket ? 40 : 100) * pScore);
  } else if (verdict === "make") {
    score += 20;
  }
  if (scratch) score = Math.min(score, 10);

  const { headline, tips } = coach(shot, {
    verdict,
    pocket,
    targetPocket,
    scratch,
    hitObjectBall,
    aim,
    position,
    rails,
    speedLabel,
    inchesPerDiamond,
    objectShort:
      rec.object.status === "rest" && targetPocket && hitObjectBall && aim && aim.offsetIn < 1.5
        ? dist(rec.object.pos, POCKETS[targetPocket])
        : null,
  });

  return {
    verdict,
    pocket,
    targetPocket,
    scratch,
    hitObjectBall,
    aim,
    position,
    rails,
    cueSpeed,
    speedLabel,
    score: Math.max(0, Math.min(100, score)),
    headline,
    tips,
    lowConfidence: rec.incomplete,
    cuePath,
    objectPath,
  };
}

// ---------- coaching copy ----------

function coach(
  shot: KinisterShot,
  r: {
    verdict: Verdict;
    pocket: PocketId | null;
    targetPocket: PocketId | null;
    scratch: PocketId | null;
    hitObjectBall: boolean;
    aim: ShotReport["aim"];
    position: ShotReport["position"];
    rails: ShotReport["rails"];
    speedLabel: string | null;
    inchesPerDiamond: number;
    /** OB stopped on a good line this far (◆) from the pocket. */
    objectShort: number | null;
  },
): { headline: string; tips: string[] } {
  const tips: string[] = [];
  let headline: string;
  const fmtD = (d: number) => `${d.toFixed(1)}◆`;
  const fmtIn = (d: number) => `~${Math.round(d * r.inchesPerDiamond)}″`;

  if (!r.hitObjectBall) {
    headline = "Missed the object ball";
    tips.push("The cue ball never touched the object ball — slow down and aim at the ghost ball, not the object ball.");
  } else if (r.scratch) {
    headline = `Scratch — cue ball went in the ${pocketName(r.scratch)}`;
  } else if (r.verdict === "make") {
    headline = r.position && r.position.error < 0.3 ? "Made it — and nailed the shape" : "Made it";
  } else if (r.pocket && r.targetPocket && r.pocket !== r.targetPocket) {
    headline = `Dropped in the ${pocketName(r.pocket)}, not the ${pocketName(r.targetPocket)}`;
  } else if (r.verdict === "miss") {
    headline = "Missed";
  } else {
    headline = r.targetPocket ? "Couldn't see where the object ball went" : "Shot tracked";
  }

  if (r.objectShort !== null && r.objectShort > 0.25) {
    tips.push(
      `Good line, but the object ball stopped ${r.objectShort.toFixed(1)}◆ short of the pocket — give it a touch more pace.`,
    );
  }

  // Aim.
  if (r.aim && r.targetPocket) {
    const e = r.aim.errorDeg;
    const straight = r.aim.idealCutDeg < 1.5;
    if (straight) {
      if (Math.abs(e) >= 0.8) {
        tips.push(
          `Straight-in shot, but the object ball left ${Math.abs(e).toFixed(1)}° to the ${e > 0 ? "left" : "right"} (${r.aim.offsetIn.toFixed(1)}″ off the pocket centre). Check that your stroke goes straight through the cue ball — no steering.`,
        );
      } else if (r.verdict === "make") {
        tips.push("Dead straight. That's the stroke.");
      }
    } else if (Math.abs(e) >= 0.8) {
      const over = e > 0;
      tips.push(
        `${over ? "Overcut" : "Undercut"} by ${Math.abs(e).toFixed(1)}° — the object ball's line arrived ${r.aim.offsetIn.toFixed(1)}″ off the pocket centre. Aim a touch ${over ? "fuller (thicker)" : "thinner"}.`,
      );
      if (shot.english && Math.abs(shot.english.x) > 0.2) {
        tips.push("This shot uses side spin — remember throw pushes the object ball off the contact line, so adjust your aim for it.");
      }
    } else if (r.verdict === "make") {
      tips.push(`Line was on — within ${Math.max(0.1, Math.abs(e)).toFixed(1)}° of perfect.`);
    } else if (r.verdict === "miss" && !r.scratch && r.objectShort === null) {
      tips.push("Your line was close to perfect — the miss came from something else: speed, throw from side spin, or the ball rattling in the jaws.");
    }
  }

  // Position.
  if (r.position) {
    const { along, across, error, acrossToward } = r.position;
    if (error < 0.3) {
      tips.push(`Cue ball finished ${fmtD(error)} from the target — great shape.`);
    } else {
      const parts: string[] = [];
      if (Math.abs(along) >= 0.2) parts.push(`${fmtD(Math.abs(along))} (${fmtIn(Math.abs(along))}) ${along > 0 ? "long" : "short"}`);
      if (across >= 0.2) parts.push(`${fmtD(across)} off the line${acrossToward ? ` toward the ${acrossToward}` : ""}`);
      tips.push(`Cue ball finished ${parts.join(" and ") || fmtD(error) + " away"}.`);
      const draw = (shot.english?.y ?? 0) < -0.2;
      const follow = (shot.english?.y ?? 0) > 0.2;
      if (along <= -0.3) {
        tips.push(
          draw
            ? "Came up short — you need more draw: lower on the cue ball and accelerate through."
            : follow
              ? "Came up short — more follow (hit higher) or a little more speed."
              : "Came up short — a little more speed.",
        );
      } else if (along >= 0.3) {
        tips.push(
          draw
            ? "Drew too far — ease off the speed or hit a touch less low."
            : follow
              ? "Rolled too far — softer, or less follow."
              : "Too much speed — soften the stroke.",
        );
      }
      if (across >= 0.4 && r.aim && Math.abs(r.aim.errorDeg) >= 1.5) {
        tips.push("The off-line finish is mostly from the cut error — a different hit on the object ball changes the cue ball's tangent line.");
      } else if (across >= 0.4 && shot.english && Math.abs(shot.english.x) > 0.2) {
        tips.push("Off the intended line — check your side spin; too much or too little changes the angle off the rail.");
      }
    }
  }

  if (r.rails && r.rails.intended !== r.rails.actual && !r.scratch) {
    tips.push(
      `Cue ball took ${r.rails.actual} rail${r.rails.actual === 1 ? "" : "s"}; the drill path uses ${r.rails.intended}.`,
    );
  }
  if (r.scratch) {
    tips.push("Scratched — on this shot that usually means too much speed or follow. Note which pocket and adjust.");
  }
  if (r.speedLabel) tips.push(`Stroke speed: ${r.speedLabel}.`);

  return { headline, tips };
}

// ---------- geometry helpers ----------

function norm(v: Pt): Pt | null {
  const m = Math.hypot(v.x, v.y);
  return m < 1e-9 ? null : { x: v.x / m, y: v.y / m };
}

/**
 * Signed angle from a to b in degrees. Positive = b is to the shooter's
 * left of a (diamond y grows toward the left rail).
 */
function signedAngle(a: Pt, b: Pt): number {
  return (Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y) * 180) / Math.PI;
}

/**
 * Direction the object ball left in: a least-squares line through its
 * first stretch of travel (until a cushion or ~1.2 diamonds), anchored at
 * the rest spot.
 */
function departureDirection(samples: Sample[], contactAt: number, rest: Pt, r: number): Pt | null {
  const pts: Pt[] = [];
  for (const s of samples) {
    if (s.t < contactAt - 20 || !s.seen) continue;
    // Skip the contact frames, where the two balls touch and the object
    // ball's position is least certain.
    if (dist(s, rest) < r * 2.5) continue;
    if (cushionDistance(s) < r * 1.3) break;
    pts.push(s);
    if (dist(s, rest) > 1.2) break;
  }
  if (pts.length === 0) {
    // Fall back to rest → last known position.
    const last = samples[samples.length - 1];
    return last && dist(last, rest) > 0.2 ? norm({ x: last.x - rest.x, y: last.y - rest.y }) : null;
  }
  // Fit through the rest spot: direction minimising perpendicular error.
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    const dx = p.x - rest.x;
    const dy = p.y - rest.y;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let dir = { x: Math.cos(theta), y: Math.sin(theta) };
  const last = pts[pts.length - 1];
  if (dir.x * (last.x - rest.x) + dir.y * (last.y - rest.y) < 0) dir = { x: -dir.x, y: -dir.y };
  return dir;
}

function countRails(samples: Sample[], contactAt: number | null, r: number): number {
  const seen = samples.filter((s) => s.seen && (contactAt === null || s.t >= contactAt));
  let rails = 0;
  let lastHit = -Infinity;
  for (let i = 1; i < seen.length - 1; i++) {
    const p = seen[i];
    if (cushionDistance(p) > r * 1.8) continue;
    const a = seen[i - 1];
    const b = seen[i + 1];
    // Normal velocity flips sign at a cushion.
    const nx = p.x < r * 2 || p.x > 8 - r * 2;
    const ny = p.y < r * 2 || p.y > 4 - r * 2;
    const flipX = nx && Math.sign(p.x - a.x) !== Math.sign(b.x - p.x) && Math.abs(b.x - a.x) > 0.01;
    const flipY = ny && Math.sign(p.y - a.y) !== Math.sign(b.y - p.y) && Math.abs(b.y - a.y) > 0.01;
    if ((flipX || flipY) && p.t - lastHit > 150) {
      rails++;
      lastHit = p.t;
    }
  }
  return rails;
}

function initialSpeed(samples: Sample[], startedAt: number): number | null {
  const s = samples.filter((p) => p.seen && p.t >= startedAt - 40 && p.t <= startedAt + 200);
  if (s.length < 2) return null;
  const a = s[0];
  const b = s[s.length - 1];
  const dt = (b.t - a.t) / 1000;
  return dt > 0 ? dist(a, b) / dt : null;
}

function railToward(d: Pt, along: Pt | null): string | null {
  // Name the rail the cue ball drifted toward (perpendicular component).
  const perp = along ? { x: d.x - (d.x * along.x + d.y * along.y) * along.x, y: d.y - (d.x * along.x + d.y * along.y) * along.y } : d;
  if (Math.abs(perp.x) > Math.abs(perp.y)) return perp.x > 0 ? "foot rail" : "head rail";
  return perp.y > 0 ? "left rail" : "right rail";
}

/** Light smoothing for drawing: drop unseen coast points except pocket drops. */
function smoothPath(samples: Sample[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!s.seen && i !== samples.length - 1) continue;
    const prev = samples[i - 1];
    const next = samples[i + 1];
    if (s.seen && prev?.seen && next?.seen) {
      out.push({ x: (prev.x + 2 * s.x + next.x) / 4, y: (prev.y + 2 * s.y + next.y) / 4 });
    } else {
      out.push({ x: s.x, y: s.y });
    }
  }
  return out;
}
