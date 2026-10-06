/**
 * Shot tracker: turns per-frame blobs from `TableVision` into cue-ball and
 * object-ball trajectories, in table space.
 *
 *   setup ──(both balls found, on their spots, still)──▶ armed
 *   armed ──(cue ball leaves its spot)──────────────────▶ in-shot
 *   in-shot ──(everything stopped or dropped)───────────▶ done
 *
 * In setup we look for the cue ball (the whitest ball-sized blob) and the
 * object ball (the ball closest to where the drill puts it) every frame,
 * and arm automatically once both sit still on their spots — the player
 * never has to touch the phone between shots.
 *
 * While armed / in a shot, each ball is followed with a constant-velocity
 * prediction and gated nearest-blob association (colour as a tie-break),
 * with mean-shift to pull a ball off a blob it shares with the cue tip or
 * a hand. A ball that vanishes near a pocket has dropped; one that
 * vanishes under the player's body is "occluded" and coasts.
 */

import type { PocketId } from "@/lib/kinister/shots";
import { POCKETS } from "@/lib/kinister/shots";
import {
  cushionDistance,
  dist,
  nearestPocket,
  pocketCaptureRadius,
  type Pt,
} from "./table";
import {
  colorDistance,
  whiteness,
  type Blob,
  type RGB,
  type TableVision,
} from "./vision";

export type Sample = { t: number; x: number; y: number; seen: boolean };

export type BallStatus = "rest" | "moving" | "occluded" | "lost" | "pocketed";

export type BallTrack = {
  rest: Pt;
  color: RGB;
  pos: Pt;
  vel: Pt;
  status: BallStatus;
  pocket: PocketId | null;
  lastSeen: number;
  missed: number;
  samples: Sample[];
  /** Time the ball first left its rest spot. */
  movedAt: number | null;
};

export type SetupView = {
  cue: Pt | null;
  object: Pt | null;
  others: Pt[];
  /** Both balls found and steady for long enough. */
  steady: boolean;
  cueOnSpot: boolean;
  objectOnSpot: boolean;
};

export type ShotRecording = {
  startedAt: number;
  endedAt: number;
  cue: BallTrack;
  object: BallTrack;
  /** When the cue ball reached the object ball (OB started moving). */
  contactAt: number | null;
  /** Shot ended on a timeout or with a ball unaccounted for. */
  incomplete: boolean;
};

export type TrackerSnapshot =
  | { phase: "setup"; setup: SetupView }
  | { phase: "armed"; cue: BallTrack; object: BallTrack }
  | { phase: "in-shot"; cue: BallTrack; object: BallTrack }
  | { phase: "done"; recording: ShotRecording };

export type TrackerOptions = {
  /** Ball radius in diamonds. */
  ballR: number;
  /** Where the drill puts each ball (table space). */
  expectedCue: Pt;
  expectedObject: Pt;
  /** How close to its spot a ball must be to auto-arm (diamonds). */
  spotTolerance?: number;
};

/** Frames a setup must hold still before auto-arming. */
const STEADY_FRAMES = 18;
const STEADY_EPS = 0.04;
/** Speed below which a ball counts as stopped (diamonds / second). */
const STOP_SPEED = 0.22;
/** A ball that moved less than STILL_EPS over STILL_MS is at rest. */
const STILL_MS = 280;
const STILL_EPS = 0.035;
const SETTLE_MS = 650;
const MAX_SHOT_MS = 14_000;
/** Give up waiting on an occluded ball this long after everything else stopped. */
const OCCLUDED_GRACE_MS = 2_500;

export class ShotTracker {
  private phase: "setup" | "armed" | "in-shot" | "done" = "setup";
  private readonly r: number;
  private readonly tol: number;
  private setupHistory: { cue: Pt; object: Pt }[] = [];
  private setupView: SetupView = {
    cue: null,
    object: null,
    others: [],
    steady: false,
    cueOnSpot: false,
    objectOnSpot: false,
  };
  private setupColors: { cue: RGB; object: RGB } | null = null;
  private cue: BallTrack | null = null;
  private object: BallTrack | null = null;
  private others: Pt[] = [];
  private armedAt = 0;
  private startedAt = 0;
  private quietSince: number | null = null;
  private lastT = 0;
  private recording: ShotRecording | null = null;
  /** Earliest time setup may arm again (cool-down after a shot). */
  private armNotBefore = 0;

  constructor(private readonly opts: TrackerOptions) {
    this.r = opts.ballR;
    this.tol = opts.spotTolerance ?? 0.4;
  }

  snapshot(): TrackerSnapshot {
    switch (this.phase) {
      case "setup":
        return { phase: "setup", setup: this.setupView };
      case "armed":
        return { phase: "armed", cue: this.cue!, object: this.object! };
      case "in-shot":
        return { phase: "in-shot", cue: this.cue!, object: this.object! };
      case "done":
        return { phase: "done", recording: this.recording! };
    }
  }

  /** Back to looking for a fresh setup (after a result was shown). */
  reset(now: number, cooldownMs = 1500): void {
    this.phase = "setup";
    this.setupHistory = [];
    this.cue = null;
    this.object = null;
    this.recording = null;
    this.quietSince = null;
    this.armNotBefore = now + cooldownMs;
  }

  /**
   * Arm with the balls wherever they currently are, even off their spots.
   * Returns false if the cue ball and object ball aren't both visible.
   */
  armNow(vision: TableVision, now: number): boolean {
    const { cue, object } = this.setupView;
    if (!cue || !object || !this.setupColors) return false;
    this.arm(vision, now, cue, object);
    return true;
  }

  /**
   * Let the player pick the balls by tapping them (table-space points).
   * Snaps each tap to the nearest ball-sized blob.
   */
  armAt(vision: TableVision, now: number, cueTap: Pt, objectTap: Pt): boolean {
    const balls = this.ballCandidates(vision);
    const snap = (p: Pt) =>
      balls.reduce<{ b: Blob | null; d: number }>(
        (best, b) => {
          const d = dist(b.center, p);
          return d < best.d ? { b, d } : best;
        },
        { b: null, d: 4 * this.r },
      ).b;
    const cb = snap(cueTap);
    const ob = snap(objectTap);
    if (!cb || !ob || cb === ob) return false;
    this.setupColors = { cue: cb.color, object: ob.color };
    this.setupView = {
      ...this.setupView,
      others: balls.filter((b) => b !== cb && b !== ob).map((b) => b.center),
    };
    this.arm(vision, now, cb.center, ob.center);
    return true;
  }

  step(vision: TableVision, now: number): TrackerSnapshot {
    const dt = this.lastT ? Math.min(0.2, Math.max(0.005, (now - this.lastT) / 1000)) : 1 / 30;
    this.lastT = now;
    switch (this.phase) {
      case "setup":
        this.stepSetup(vision, now);
        break;
      case "armed":
      case "in-shot":
        this.stepTracking(vision, now, dt);
        break;
      case "done":
        break;
    }
    return this.snapshot();
  }

  // ---------- setup ----------

  /** Ball-sized, roughly round blobs on the playing surface. */
  private ballCandidates(vision: TableVision): Blob[] {
    return vision.blobs.filter((b) => {
      const a = b.area / vision.ballArea;
      if (a < 0.45 || a > 2.1) return false;
      const aspect = Math.max(b.w, b.h) / Math.max(1, Math.min(b.w, b.h));
      if (aspect > 1.8 || b.fill < 0.4) return false;
      return cushionDistance(b.center) > -this.r * 0.5;
    });
  }

  private stepSetup(vision: TableVision, now: number): void {
    const balls = this.ballCandidates(vision);
    // Keep the background tracking lighting while we wait, but never let
    // balls bleed into it.
    vision.adapt(
      0.04,
      balls.map((b) => ({ center: b.center, r: this.r * 2 })),
    );

    let cue: Blob | null = null;
    for (const b of balls) {
      if (whiteness(b.color) < 55) continue;
      if (!cue || whiteness(b.color) > whiteness(cue.color)) cue = b;
    }
    let object: Blob | null = null;
    for (const b of balls) {
      if (b === cue) continue;
      if (!object || dist(b.center, this.opts.expectedObject) < dist(object.center, this.opts.expectedObject)) {
        object = b;
      }
    }

    const cuePos = cue ? vision.refine(cue.center, cue.color).center : null;
    const objPos = object ? vision.refine(object.center, object.color).center : null;
    if (cuePos && objPos) {
      this.setupHistory.push({ cue: cuePos, object: objPos });
      if (this.setupHistory.length > STEADY_FRAMES) this.setupHistory.shift();
      this.setupColors = { cue: cue!.color, object: object!.color };
    } else {
      this.setupHistory = [];
    }
    const steady =
      this.setupHistory.length >= STEADY_FRAMES &&
      this.setupHistory.every(
        (h) =>
          dist(h.cue, cuePos!) < STEADY_EPS && dist(h.object, objPos!) < STEADY_EPS,
      );
    const cueOnSpot = !!cuePos && dist(cuePos, this.opts.expectedCue) < this.tol;
    const objectOnSpot = !!objPos && dist(objPos, this.opts.expectedObject) < this.tol;
    this.setupView = {
      cue: cuePos,
      object: objPos,
      others: balls.filter((b) => b !== cue && b !== object).map((b) => b.center),
      steady,
      cueOnSpot,
      objectOnSpot,
    };
    if (steady && cueOnSpot && objectOnSpot && now >= this.armNotBefore) {
      this.arm(vision, now, cuePos!, objPos!);
    }
  }

  private arm(vision: TableVision, now: number, cuePos: Pt, objPos: Pt): void {
    const colors = this.setupColors!;
    this.others = this.setupView.others.slice();
    // At this moment the only things on the felt should be balls. Pull
    // everything else into the background so the shot starts clean.
    vision.absorb(
      [cuePos, objPos, ...this.others].map((center) => ({ center, r: this.r * 1.8 })),
    );
    const mk = (pos: Pt, color: RGB): BallTrack => ({
      rest: pos,
      color: vision.sampleColor(pos, this.r * 0.8) ?? color,
      pos,
      vel: { x: 0, y: 0 },
      status: "rest",
      pocket: null,
      lastSeen: now,
      missed: 0,
      samples: [{ t: now, x: pos.x, y: pos.y, seen: true }],
      movedAt: null,
    });
    this.cue = mk(cuePos, colors.cue);
    this.object = mk(objPos, colors.object);
    this.phase = "armed";
    this.armedAt = now;
    this.quietSince = null;
  }

  // ---------- tracking ----------

  private stepTracking(vision: TableVision, now: number, dt: number): void {
    const cue = this.cue!;
    const object = this.object!;
    const candidates = vision.blobs.filter(
      (b) => b.area >= vision.ballArea * 0.35 && b.area <= vision.ballArea * 7,
    );
    const occluders = vision.blobs.filter((b) => b.area > vision.ballArea * 7);

    const claimCue = this.associate(vision, cue, candidates, dt, true);
    const claimObj = this.associate(vision, object, candidates, dt, false);
    // Both balls want the same blob — happens for a frame or two at
    // contact. The closer one gets it; the other coasts.
    let cueBlob = claimCue;
    let objBlob = claimObj;
    if (cueBlob && objBlob && cueBlob.blob === objBlob.blob) {
      if (cueBlob.d <= objBlob.d) objBlob = null;
      else cueBlob = null;
    }
    this.update(vision, cue, cueBlob?.blob ?? null, occluders, now, dt);
    this.update(vision, object, objBlob?.blob ?? null, occluders, now, dt);

    // While armed, keep the background fresh around (but not on) the balls.
    if (this.phase === "armed") {
      vision.adapt(0.03, [cue, object].map((b) => ({ center: b.pos, r: this.r * 2.2 })).concat(
        this.others.map((center) => ({ center, r: this.r * 1.8 })),
      ));
    }

    const leave = Math.max(0.1, this.r * 1.1);
    for (const b of [cue, object]) {
      if (b.movedAt === null && b.status !== "occluded" && dist(b.pos, b.rest) > leave) {
        // Backdate to the first sample that had started to move.
        const first = b.samples.find((s) => s.seen && dist(s, b.rest) > this.r * 0.35);
        b.movedAt = first?.t ?? now;
      }
    }

    if (this.phase === "armed") {
      if (cue.movedAt !== null) {
        this.phase = "in-shot";
        this.startedAt = cue.movedAt;
      } else if (object.movedAt !== null) {
        // The object ball moved first — someone touched it. Start over.
        this.reset(now, 600);
        return;
      } else if (now - this.armedAt > 120_000) {
        this.reset(now, 0);
        return;
      }
      // Trim pre-shot history; only the last second is interesting.
      for (const b of [cue, object]) {
        while (b.samples.length > 2 && b.samples[0].t < now - 1000) b.samples.shift();
      }
      return;
    }

    // In-shot: a practice stroke that nudged the cue ball and nothing else
    // can come back to its spot — treat that as a false start.
    if (
      object.movedAt === null &&
      now - this.startedAt < 900 &&
      cue.status === "rest" &&
      dist(cue.pos, cue.rest) < this.r * 0.4
    ) {
      this.phase = "armed";
      cue.movedAt = null;
      return;
    }

    const done = (b: BallTrack) => b.status === "pocketed" || b.status === "rest";
    const allDone = done(cue) && done(object);
    const settledExceptOccluded =
      [cue, object].every((b) => done(b) || b.status === "occluded" || b.status === "lost");

    if (allDone) {
      this.quietSince ??= now;
      if (now - this.quietSince >= SETTLE_MS) this.finish(vision, now, false);
    } else if (settledExceptOccluded) {
      this.quietSince ??= now;
      if (now - this.quietSince >= OCCLUDED_GRACE_MS) this.finish(vision, now, true);
    } else {
      this.quietSince = null;
    }
    if (this.phase === "in-shot" && now - this.startedAt > MAX_SHOT_MS) {
      this.finish(vision, now, true);
    }
  }

  private associate(
    vision: TableVision,
    ball: BallTrack,
    candidates: Blob[],
    dt: number,
    isCue: boolean,
  ): { blob: Blob; d: number } | null {
    if (ball.status === "pocketed") return null;
    const pred = { x: ball.pos.x + ball.vel.x * dt, y: ball.pos.y + ball.vel.y * dt };
    const speed = Math.hypot(ball.vel.x, ball.vel.y);
    const gate = Math.min(
      2.5,
      this.r * 2.5 + speed * dt * 1.5 + ball.missed * this.r * 0.8,
    );
    const refWhite = whiteness(ball.color);
    let best: { blob: Blob; d: number; cost: number } | null = null;
    for (const b of candidates) {
      const d = dist(b.center, pred);
      if (d > gate) continue;
      // Leave other balls on the table alone unless this ball is heading
      // right at them.
      if (this.others.some((o) => dist(o, b.center) < this.r * 1.2) && d > this.r * 1.5) continue;
      const colorCost = isCue
        ? Math.max(0, refWhite - whiteness(b.color)) / 90
        : colorDistance(b.color, ball.color) / 140;
      const cost = d / gate + colorCost;
      if (!best || cost < best.cost) best = { blob: b, d, cost };
    }
    if (best) return best;

    // Lost for a few frames — look anywhere for something that matches.
    if (ball.missed >= 3 && ball.status !== "occluded") {
      for (const b of candidates) {
        const a = b.area / vision.ballArea;
        if (a > 2.5) continue;
        if (this.others.some((o) => dist(o, b.center) < this.r * 1.2)) continue;
        const ok = isCue
          ? whiteness(b.color) > refWhite - 45
          : colorDistance(b.color, ball.color) < 70;
        if (!ok) continue;
        const d = dist(b.center, ball.pos);
        if (!best || d < best.d) best = { blob: b, d, cost: 0 };
      }
    }
    return best;
  }

  private update(
    vision: TableVision,
    ball: BallTrack,
    blob: Blob | null,
    occluders: Blob[],
    now: number,
    dt: number,
  ): void {
    if (ball.status === "pocketed") return;
    if (blob) {
      // A blob bigger than one ball is this ball merged with something —
      // the other ball at contact, the cue tip, a hand. Mean-shift onto
      // the part that has this ball's colour, starting from the
      // prediction. (Fast balls smear into long blobs; their centroid is
      // already the best estimate.)
      const speed = Math.hypot(ball.vel.x, ball.vel.y);
      const pred = { x: ball.pos.x + ball.vel.x * dt, y: ball.pos.y + ball.vel.y * dt };
      const merged = blob.area > vision.ballArea * 1.35;
      const pos =
        merged && speed < 3
          ? vision.refine(pred, ball.color).center
          : merged
            ? blob.center
            : vision.refine(blob.center, ball.color).center;
      const v = { x: (pos.x - ball.pos.x) / dt, y: (pos.y - ball.pos.y) / dt };
      const a = ball.missed > 0 ? 0.5 : 0.6;
      ball.vel = {
        x: a * v.x + (1 - a) * ball.vel.x,
        y: a * v.y + (1 - a) * ball.vel.y,
      };
      ball.pos = pos;
      ball.lastSeen = now;
      ball.missed = 0;
      ball.samples.push({ t: now, x: pos.x, y: pos.y, seen: true });
      ball.status = isStill(ball, now) ? "rest" : "moving";
      return;
    }

    ball.missed++;
    // Under a hand / the player's body?
    const covered =
      vision.coverage(ball.pos, this.r) > 0.4 &&
      occluders.some(
        (o) =>
          ball.pos.x >= o.min.x - this.r &&
          ball.pos.x <= o.max.x + this.r &&
          ball.pos.y >= o.min.y - this.r &&
          ball.pos.y <= o.max.y + this.r,
      );
    const speed = Math.hypot(ball.vel.x, ball.vel.y);
    if (covered && speed < 1) {
      ball.status = "occluded";
      ball.vel = { x: ball.vel.x * 0.5, y: ball.vel.y * 0.5 };
      return;
    }

    // Did it just drop? Look at where it was heading.
    const ahead = { x: ball.pos.x + ball.vel.x * dt, y: ball.pos.y + ball.vel.y * dt };
    for (const p of [ball.pos, ahead]) {
      const np = nearestPocket(p);
      const inPocket =
        np.d < pocketCaptureRadius(np.id, this.r) || cushionDistance(p) < -this.r * 0.6;
      // Gone (not just hanging in the jaws, still visible)?
      const gone = vision.coverage(ball.pos, this.r) < 0.25;
      if (inPocket && gone && (speed > 0.3 || ball.missed >= 2)) {
        ball.status = "pocketed";
        ball.pocket = np.id;
        ball.pos = ball.missed >= 2 ? ball.pos : ahead;
        ball.vel = { x: 0, y: 0 };
        ball.samples.push({ t: now, x: POCKETS[np.id].x, y: POCKETS[np.id].y, seen: false });
        return;
      }
    }

    // Coast a couple of frames on the prediction, then hold.
    if (ball.missed <= 3 && speed > STOP_SPEED) {
      ball.pos = ahead;
      ball.samples.push({ t: now, x: ahead.x, y: ahead.y, seen: false });
    }
    ball.status = "lost";
  }

  private finish(vision: TableVision, now: number, incomplete: boolean): void {
    const cue = this.cue!;
    const object = this.object!;
    // One last look for anything still unaccounted for.
    for (const [b, isCue] of [[cue, true], [object, false]] as const) {
      if (b.status !== "lost" && b.status !== "occluded") continue;
      const hit = this.associate(vision, { ...b, missed: 6, status: "lost" }, vision.blobs, 0, isCue);
      if (hit) {
        b.pos = hit.blob.center;
        b.status = "rest";
        b.samples.push({ t: now, x: b.pos.x, y: b.pos.y, seen: true });
      }
    }
    const contactAt = object.movedAt;
    this.recording = {
      startedAt: this.startedAt,
      endedAt: now,
      cue,
      object,
      contactAt,
      incomplete:
        incomplete || cue.status === "lost" || cue.status === "occluded" ||
        object.status === "lost" || object.status === "occluded",
    };
    this.phase = "done";
  }
}

function isStill(ball: BallTrack, now: number): boolean {
  const s = ball.samples;
  const last = s[s.length - 1];
  for (let i = s.length - 1; i >= 0; i--) {
    if (!s[i].seen) return false;
    if (dist(s[i], last) > STILL_EPS) return false;
    if (now - s[i].t >= STILL_MS) return true;
  }
  // Not enough history yet: fall back to the smoothed velocity.
  return Math.hypot(ball.vel.x, ball.vel.y) < STOP_SPEED;
}
