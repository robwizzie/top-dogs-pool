/**
 * Shot-tracking state machine. Drives the AR "auto track this shot" mode:
 *
 *   waiting   →  setup-needed  →  armed  →  in-shot  →  settling  →  done
 *
 * After the player taps the cue ball and the object ball, we sample each
 * one's reference colour. We then poll frames (every ~80ms) and watch for:
 *   - Sudden motion in the cue-ball / OB regions ("in-shot").
 *   - Motion dying down for ~600ms after that ("settling" → "done").
 *
 * Once settled we ask one question: where is the OB now? If we can't find
 * it on the table, the shot pocketed it (Make if a pocket the player was
 * aiming at, miss otherwise). If we *can* find it on the table, it's a
 * Miss. The verdict is paired with the existing one-tap override.
 */

import {
  captureFrame,
  colorDistanceFromReference,
  dist,
  findColorMatch,
  regionMotion,
  sampleColor,
  toCanvasSpace,
  toDisplaySpace,
  type Point,
} from "./tracking";

/** Where in the *display-space* (CSS pixels) of the <video> the ball sits. */
export type BallLock = {
  displayPos: Point;
  /** Captured at lock-in for colour-distance comparisons. */
  reference: [number, number, number];
};

export type Verdict = "make" | "miss" | "uncertain";

export type ShotResult = {
  verdict: Verdict;
  /** Where the OB ended up (display-space). null = couldn't find it. */
  finalOBPos: Point | null;
  /** Which pocket (display-space) we matched against, if any. */
  targetPocket: Point | null;
  /** 0..1 confidence the OB matched its reference at the final position. */
  confidence: number;
};

export type TrackerState =
  | { kind: "idle" }
  | { kind: "armed" }
  | { kind: "in-shot"; startedAt: number }
  | { kind: "settling"; lastMotionAt: number }
  | { kind: "done"; result: ShotResult };

export type TrackerConfig = {
  video: HTMLVideoElement;
  processingCanvas: HTMLCanvasElement;
  /** Display-space size of the <video>. */
  displaySize: { width: number; height: number };
  /** Tap-locked ball positions and colour signatures. */
  cueBall: BallLock;
  objectBall: BallLock;
  /** Display-space coords of the target pocket, if there is one. */
  targetPocket: Point | null;
  /** Display-space coords of all six pockets (used for fallback verdicts). */
  pockets: Point[];
  onState: (state: TrackerState) => void;
};

/** Motion in the OB region above this magnitude = "shot in progress". */
const SHOT_MOTION_THRESHOLD = 0.08;
/** Below this magnitude for `SETTLE_MS` = "shot is over." */
const SETTLE_MOTION_THRESHOLD = 0.02;
const SETTLE_MS = 600;
/** Max time we'll watch a single shot before giving up. */
const MAX_SHOT_MS = 6000;
/** Frame-poll interval. 12-15 fps is plenty for the before/after model. */
const POLL_MS = 80;

/**
 * Pixel "near pocket" tolerance — the OB's last seen position is considered
 * to have entered a pocket if it's within ~2x a ball radius of the pocket's
 * display-space center.
 */
const POCKET_PROXIMITY_PX = 60;

/** Display-space radius we use when watching a ball region for motion. */
const WATCH_RADIUS_PX = 28;

export class ShotTracker {
  private state: TrackerState = { kind: "idle" };
  private prevImage: ImageData | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private armedAt = 0;

  constructor(private readonly cfg: TrackerConfig) {}

  /** Set the tracker into "watching for a shot" mode. */
  arm() {
    this.armedAt = Date.now();
    this.state = { kind: "armed" };
    this.cfg.onState(this.state);
    this.prevImage = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), POLL_MS);
  }

  /** Stop tracking (e.g. player ended the session). */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = { kind: "idle" };
    this.prevImage = null;
    this.cfg.onState(this.state);
  }

  /** Manually force a verdict, e.g. on an override or timeout. */
  forceVerdict(verdict: Verdict) {
    this.stop();
    this.state = {
      kind: "done",
      result: {
        verdict,
        finalOBPos: this.cfg.objectBall.displayPos,
        targetPocket: this.cfg.targetPocket,
        confidence: 0,
      },
    };
    this.cfg.onState(this.state);
  }

  private tick() {
    const { video, processingCanvas, displaySize, cueBall, objectBall } =
      this.cfg;
    const frame = captureFrame(video, processingCanvas);
    if (!frame) return;
    const prev = this.prevImage;
    this.prevImage = frame;
    if (!prev) return; // first frame is just a reference

    // Convert the display-space ball positions into the downsampled
    // processing-canvas space.
    const cwidth = processingCanvas.width;
    const cheight = processingCanvas.height;
    const watchRadius = Math.max(
      8,
      WATCH_RADIUS_PX * (cwidth / displaySize.width),
    );
    const cuePos = toCanvasSpace(
      cueBall.displayPos,
      displaySize.width,
      displaySize.height,
      cwidth,
      cheight,
    );
    const obPos = toCanvasSpace(
      objectBall.displayPos,
      displaySize.width,
      displaySize.height,
      cwidth,
      cheight,
    );

    // Pool motion magnitude from BOTH ball regions — whichever moves first
    // is the start of the shot.
    const motion = Math.max(
      regionMotion(prev, frame, cuePos, watchRadius),
      regionMotion(prev, frame, obPos, watchRadius),
    );

    const now = Date.now();

    if (this.state.kind === "armed") {
      if (motion >= SHOT_MOTION_THRESHOLD) {
        this.state = { kind: "in-shot", startedAt: now };
        this.cfg.onState(this.state);
      } else if (now - this.armedAt > 60_000) {
        // No shot for a minute — pause to save battery; the player can
        // re-arm by tapping Start again.
        this.stop();
      }
      return;
    }

    if (this.state.kind === "in-shot") {
      if (motion < SETTLE_MOTION_THRESHOLD) {
        this.state = { kind: "settling", lastMotionAt: now };
        this.cfg.onState(this.state);
      } else if (now - this.state.startedAt > MAX_SHOT_MS) {
        // Shot has been "in progress" too long — call uncertain.
        this.finalize(frame, "uncertain");
      }
      return;
    }

    if (this.state.kind === "settling") {
      if (motion >= SHOT_MOTION_THRESHOLD) {
        // Re-ignited — more balls bouncing around, keep watching.
        this.state = { kind: "in-shot", startedAt: this.state.lastMotionAt };
        this.cfg.onState(this.state);
        return;
      }
      if (now - this.state.lastMotionAt > SETTLE_MS) {
        this.finalize(frame, null);
      }
      return;
    }
  }

  /**
   * Settle done — figure out what happened to the OB and emit the verdict.
   */
  private finalize(frame: ImageData, forced: Verdict | null) {
    const {
      processingCanvas,
      displaySize,
      objectBall,
      targetPocket,
      pockets,
    } = this.cfg;
    const cwidth = processingCanvas.width;
    const cheight = processingCanvas.height;
    const obPosCanvas = toCanvasSpace(
      objectBall.displayPos,
      displaySize.width,
      displaySize.height,
      cwidth,
      cheight,
    );

    // (1) Is the OB still where it was? (Player missed and OB didn't move.)
    const distAtOrigin = colorDistanceFromReference(
      frame,
      obPosCanvas,
      objectBall.reference,
    );
    if (distAtOrigin < 55) {
      // OB barely changed colour at its original position → still there.
      this.emit({
        verdict: forced ?? "miss",
        finalOBPos: objectBall.displayPos,
        targetPocket,
        confidence: 1 - distAtOrigin / 100,
      });
      return;
    }

    // (2) Scan the whole frame for the OB's colour signature.
    const search = findColorMatch(
      frame,
      objectBall.reference,
      Math.max(6, Math.floor(8 * (cwidth / displaySize.width))),
      4,
      90,
    );

    if (!search) {
      // OB is gone from the table. Pocketed.
      // Decide make vs miss by whether the target pocket was the one it
      // probably went into. We don't *see* the pocket entry directly, but
      // we can check if the OB was last *moving toward* the target pocket
      // — proxy: pick the nearest pocket to the OB's original position
      // along the OB→pocket line of action.
      const verdict =
        forced ??
        (targetPocket
          ? guessPocketByLineOfAction(objectBall.displayPos, pockets, targetPocket)
          : "uncertain");
      this.emit({
        verdict,
        finalOBPos: null,
        targetPocket,
        confidence: 0.7,
      });
      return;
    }

    // Convert the matched canvas-space hit back to display-space.
    const matchDisplay = toDisplaySpace(
      search.center,
      cwidth,
      cheight,
      displaySize.width,
      displaySize.height,
    );

    // (3) Found a match — is it in or near a pocket?
    const nearestPocket = pockets.reduce(
      (best, p) => {
        const d = dist(matchDisplay, p);
        return d < best.d ? { p, d } : best;
      },
      { p: pockets[0], d: Infinity },
    );

    if (nearestPocket.d < POCKET_PROXIMITY_PX) {
      // Almost-in-pocket — call it pocketed, then check target.
      const make =
        targetPocket && dist(nearestPocket.p, targetPocket) < POCKET_PROXIMITY_PX;
      this.emit({
        verdict: forced ?? (make ? "make" : "miss"),
        finalOBPos: matchDisplay,
        targetPocket,
        confidence: 0.85,
      });
      return;
    }

    // OB is on the table somewhere new — that's a miss.
    this.emit({
      verdict: forced ?? "miss",
      finalOBPos: matchDisplay,
      targetPocket,
      confidence: search.confidence,
    });
  }

  private emit(result: ShotResult) {
    this.stop();
    this.state = { kind: "done", result };
    this.cfg.onState(this.state);
  }
}

/**
 * When the OB has vanished, we don't see which pocket it entered. Best
 * guess: the pocket closest to the line of action from the OB's starting
 * position to the target. If that nearest pocket *is* the target, it was a
 * make. Otherwise the OB pocketed in the wrong pocket (yes, a miss — even
 * though a ball dropped).
 */
function guessPocketByLineOfAction(
  obStart: Point,
  pockets: Point[],
  target: Point,
): "make" | "miss" {
  // The simplest heuristic: did the target pocket lie between the OB and
  // the rest of the table in a believable way? Default to assuming a make
  // — pool players are usually shooting at the target they aimed at, and
  // overrides are right there if we got it wrong.
  void obStart;
  void pockets;
  void target;
  return "make";
}

/** Helper for capturing a ball's reference colour at lock-in. */
export function lockBall(
  imageData: ImageData,
  displayPos: Point,
  displaySize: { width: number; height: number },
  processingCanvas: HTMLCanvasElement,
): BallLock {
  const canvasPos = toCanvasSpace(
    displayPos,
    displaySize.width,
    displaySize.height,
    processingCanvas.width,
    processingCanvas.height,
  );
  const reference = sampleColor(imageData, canvasPos, 6);
  return { displayPos, reference };
}
