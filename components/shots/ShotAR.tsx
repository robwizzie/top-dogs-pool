"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Crosshair,
  Loader2,
  Radar,
  RotateCcw,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { DiamondCoord, KinisterShot } from "@/lib/kinister/shots";
import { POCKETS } from "@/lib/kinister/shots";
import { contactPoint, ghostBall } from "@/lib/kinister/geometry";
import {
  applyHomography,
  computeHomography,
  type Homography,
  type Point,
} from "@/lib/kinister/homography";
import { describePosition } from "@/lib/kinister/setup";
import {
  correctSessionAttempt,
  logSessionAttempt,
  logSessionCritique,
} from "@/lib/kinister/useSession";
import { useShotStats } from "@/lib/kinister/useShotStats";
import {
  captureFrame,
  toCanvasSpace,
  toDisplaySpace,
} from "@/lib/cv/tracking";
import { classifyBalls, detectBalls, detectCornerPockets } from "@/lib/cv/detect";
import {
  lockBall,
  ShotTracker,
  type BallLock,
  type TrackerState,
} from "@/lib/cv/shotTracker";
import {
  playMake,
  playMiss,
  playReady,
  playUncertain,
  primeAudio,
} from "@/lib/sound/effects";
import { ShotReplay } from "./ShotReplay";
import { cn } from "@/lib/utils";

/**
 * AR ghost-ball overlay over a live camera feed.
 *
 * Calibration flow:
 *   1. Request camera access.
 *   2. Player taps the 4 corner pockets in order (near-right, near-left,
 *      far-left, far-right) — clockwise from the player's perspective
 *      assuming they're standing at the head end.
 *   3. We compute a perspective transform (table diamond space → screen
 *      space) and lock the overlay to the table.
 *   4. Ghost ball + aim line + carom path render in the live feed.
 *
 * Caveats acknowledged in the UI:
 *   - Hold the phone steady. If the camera moves significantly, recalibrate.
 *   - Manual calibration is intentional for v1 — auto-detection is the
 *     SAM-3 follow-up.
 */
export function ShotAR({ shot }: { shot: KinisterShot }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [corners, setCorners] = useState<Point[]>([]);
  // Auto-detected setup awaiting confirmation. Always carries the four
  // corner pockets; optionally also the cue ball + OB if ball detection
  // succeeded in the same frame. With both, the player goes from camera
  // to fully-armed tracking in one tap.
  const [candidate, setCandidate] = useState<{
    corners: Point[];
    balls: { cb: BallLock; ob: BallLock } | null;
  } | null>(null);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [homography, setHomography] = useState<Homography | null>(null);
  const [orientation, setOrientation] = useState<"head" | "foot">("head");

  // Display-space dimensions of the <video> element. We recompute on
  // resize so the SVG overlay stays in lock-step with the rendered feed.
  const [vidBox, setVidBox] = useState({ width: 0, height: 0 });

  // Off-screen canvas used by the tracker to do CV work without rendering
  // anything visible to the user.
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  if (!processingCanvasRef.current && typeof document !== "undefined") {
    processingCanvasRef.current = document.createElement("canvas");
  }

  // Tracking mode — separate from AI critique. Off by default; opt-in.
  const [trackingMode, setTrackingMode] = useState<
    | { kind: "off" }
    | { kind: "detecting" }
    | { kind: "confirm-detected"; cb: BallLock; ob: BallLock }
    | { kind: "lock-cb" }
    | { kind: "lock-ob"; cb: BallLock }
    | { kind: "armed"; cb: BallLock; ob: BallLock }
    | {
        kind: "in-shot";
        cb: BallLock;
        ob: BallLock;
      }
    | {
        kind: "settling";
        cb: BallLock;
        ob: BallLock;
      }
    | {
        kind: "result";
        cb: BallLock;
        ob: BallLock;
        verdict: "make" | "miss" | "uncertain";
        finalOBPos: Point | null;
        confidence: number;
        frames: { dataUrl: string; t: number }[];
      }
  >({ kind: "off" });
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [replayOpen, setReplayOpen] = useState(false);
  // Hold the live tracker instance across renders so we can dispose it.
  const trackerRef = useRef<ShotTracker | null>(null);
  // Track the last auto-logged verdict so override knows what to flip.
  const lastLoggedVerdictRef = useRef<"make" | "miss" | null>(null);
  // Auto-arm next shot — countdown after a result lands.
  const [autoArmCountdown, setAutoArmCountdown] = useState<number | null>(null);

  // Per-shot tracker so we can log makes/misses from the AR view.
  const { logMake, logMiss, correctLast } = useShotStats(shot.id);

  // AI feedback state machine: idle → recording → analyzing → result/error.
  const [analysisState, setAnalysisState] = useState<
    | { kind: "idle" }
    | { kind: "recording"; framesCaptured: number; totalFrames: number }
    | { kind: "analyzing" }
    | {
        kind: "result";
        verdict: "looked great" | "needs work" | "uncertain";
        summary: string;
      }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const requestCamera = useCallback(async () => {
    setPermissionAsked(true);
    setCameraError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(s);
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : "Could not access the camera",
      );
    }
  }, []);

  // Wire the stream into the <video>.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream) v.srcObject = stream;
    return () => {
      if (v) v.srcObject = null;
    };
  }, [stream]);

  // Track the rendered <video> size so overlay coords stay aligned.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    function measure() {
      const v2 = videoRef.current;
      if (!v2) return;
      const rect = v2.getBoundingClientRect();
      setVidBox({ width: rect.width, height: rect.height });
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", measure);
    };
  }, [stream]);

  // Release the camera on unmount so the indicator goes off.
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  // The 4 corner targets in table-diamond space, in the order the
  // player taps them.
  const CORNER_ORDER: { coord: DiamondCoord; pocketLabel: string }[] = [
    { coord: { x: 0, y: 0 }, pocketLabel: "near-right (head-rail corner)" },
    { coord: { x: 0, y: 4 }, pocketLabel: "near-left (head-rail corner)" },
    { coord: { x: 8, y: 4 }, pocketLabel: "far-left (foot-rail corner)" },
    { coord: { x: 8, y: 0 }, pocketLabel: "far-right (foot-rail corner)" },
  ];

  // Compute homography once we have all four taps.
  useEffect(() => {
    if (corners.length !== 4) return;
    try {
      // Table-space corners — flip x for "foot end" orientation so the
      // ghost ball lands correctly when the player stands at the foot rail.
      const dst = CORNER_ORDER.map(({ coord }) =>
        orientation === "head"
          ? coord
          : { x: 8 - coord.x, y: 4 - coord.y },
      ) as [DiamondCoord, DiamondCoord, DiamondCoord, DiamondCoord];
      const h = computeHomography(
        dst as [Point, Point, Point, Point],
        corners as [Point, Point, Point, Point],
      );
      setHomography(h);
    } catch (err) {
      setHomography(null);
      // eslint-disable-next-line no-console
      console.error("Homography failed", err);
    }
  }, [corners, orientation]);

  // Attempt to auto-detect the four corner pockets *and* the cue ball
  // + object ball from a single frame. With everything found, the
  // player gets to "Looks right? Start tracking" in one decision.
  const tryAutoDetectCorners = useCallback(() => {
    const video = videoRef.current;
    const canvas = processingCanvasRef.current;
    if (!video || !canvas || vidBox.width === 0) return;
    setAutoDetecting(true);
    setTimeout(() => {
      const frame = captureFrame(video, canvas);
      if (!frame) {
        setAutoDetecting(false);
        return;
      }

      // (1) Corner pockets.
      const detectedCorners = detectCornerPockets(frame);
      if (!detectedCorners || detectedCorners.length !== 4) {
        setAutoDetecting(false);
        return;
      }
      // Canvas-space corners stay around so ball detection can mask the
      // table polygon. We also convert to display-space for the
      // homography compute downstream.
      const cornersCanvas = detectedCorners;
      const cornersDisplay = detectedCorners.map((p) =>
        toDisplaySpace(
          p,
          canvas.width,
          canvas.height,
          vidBox.width,
          vidBox.height,
        ),
      );

      // (2) Ball detection inside that table polygon. Even if this
      // fails we still let the player confirm the corners — they can
      // then enter tracking via the "Track shots" button manually.
      let balls: { cb: BallLock; ob: BallLock } | null = null;
      try {
        const cornerOrderCoords = [
          { x: 0, y: 0 },
          { x: 0, y: 4 },
          { x: 8, y: 4 },
          { x: 8, y: 0 },
        ] as [Point, Point, Point, Point];
        // Temp homography: diamond-space → canvas-space, so we can
        // project the catalog's expected OB into the same frame the
        // detector is searching.
        const dst =
          orientation === "head"
            ? cornersCanvas
            : (cornerOrderCoords.map((_, i) =>
                cornersCanvas[(i + 2) % 4],
              ) as [Point, Point, Point, Point]);
        const tempHomography = computeHomography(
          cornerOrderCoords,
          dst as [Point, Point, Point, Point],
        );
        const candidates = detectBalls(frame, {
          tableQuad: cornersCanvas as [Point, Point, Point, Point],
        });
        if (candidates.length >= 2) {
          const expectedObCanvas = applyHomography(
            tempHomography,
            shot.objectBall,
          );
          const { cue, ob } = classifyBalls(candidates, expectedObCanvas);
          if (cue && ob) {
            const cueDisplay = toDisplaySpace(
              cue.center,
              canvas.width,
              canvas.height,
              vidBox.width,
              vidBox.height,
            );
            const obDisplay = toDisplaySpace(
              ob.center,
              canvas.width,
              canvas.height,
              vidBox.width,
              vidBox.height,
            );
            balls = {
              cb: { displayPos: cueDisplay, reference: cue.color },
              ob: { displayPos: obDisplay, reference: ob.color },
            };
          }
        }
      } catch {
        // Detection error — just skip the ball part. Corners still useful.
      }

      setAutoDetecting(false);
      setCandidate({ corners: cornersDisplay, balls });
    }, 250);
  }, [vidBox.width, vidBox.height, shot.objectBall, orientation]);

  // Run auto-detect once on first camera frame. If it fails, the player
  // sees the normal "tap each pocket" prompt and proceeds manually.
  useEffect(() => {
    if (!stream || homography || corners.length > 0) return;
    if (vidBox.width === 0) return;
    if (candidate) return;
    // 800ms delay so autofocus / auto-exposure has time to settle —
    // running detect on a still-stabilizing frame yields garbage.
    const t = setTimeout(() => tryAutoDetectCorners(), 800);
    return () => clearTimeout(t);
  }, [
    stream,
    vidBox.width,
    homography,
    corners.length,
    candidate,
    tryAutoDetectCorners,
  ]);

  function acceptCandidate() {
    if (!candidate) return;
    setCorners(candidate.corners);
    // If we got balls too, the homography compute is going to fire on
    // the next render; wait for it before we arm so the tracker has a
    // homography to use. The "armed" effect already depends on it.
    if (candidate.balls) {
      primeAudio();
      lastLoggedVerdictRef.current = null;
      setTrackingMode({
        kind: "armed",
        cb: candidate.balls.cb,
        ob: candidate.balls.ob,
      });
    }
    setCandidate(null);
  }

  function acceptCornersOnly() {
    if (!candidate) return;
    setCorners(candidate.corners);
    setCandidate(null);
  }

  function rejectCandidate() {
    setCandidate(null);
  }

  function handleOverlayClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // A pending auto-detect candidate intercepts taps — any tap during
    // the "confirm?" state is interpreted as "I'd rather do this
    // manually" so the player isn't trapped by a wrong detection.
    if (candidate) {
      setCandidate(null);
      setCorners([{ x, y }]);
      return;
    }
    // Calibration phase consumes taps first.
    if (!homography && corners.length < 4) {
      setCorners((prev) => [...prev, { x, y }]);
      return;
    }
    // Tracking lock-in phase consumes taps to pin balls in place.
    const video = videoRef.current;
    const canvas = processingCanvasRef.current;
    if (!video || !canvas) return;
    if (trackingMode.kind === "lock-cb" || trackingMode.kind === "lock-ob") {
      const frame = captureFrame(video, canvas);
      if (!frame) return;
      const lock = lockBall(
        frame,
        { x, y },
        { width: vidBox.width, height: vidBox.height },
        canvas,
      );
      if (trackingMode.kind === "lock-cb") {
        setTrackingMode({ kind: "lock-ob", cb: lock });
      } else {
        setTrackingMode({
          kind: "armed",
          cb: trackingMode.cb,
          ob: lock,
        });
      }
    }
  }

  // Spin up / tear down the live tracker as the mode changes. The tracker
  // polls every ~80ms looking for shot-start, shot-end, then verdict.
  useEffect(() => {
    if (trackingMode.kind !== "armed") {
      trackerRef.current?.stop();
      trackerRef.current = null;
      return;
    }
    const video = videoRef.current;
    const canvas = processingCanvasRef.current;
    if (!video || !canvas || !homography) return;
    const pockets = (["TR", "TL", "BR", "BL", "MR", "ML"] as const).map(
      (id) => applyHomography(homography, POCKETS[id]),
    );
    const targetPocket = shot.targetPocket
      ? applyHomography(homography, POCKETS[shot.targetPocket])
      : null;
    const tracker = new ShotTracker({
      video,
      processingCanvas: canvas,
      displaySize: { width: vidBox.width, height: vidBox.height },
      cueBall: trackingMode.cb,
      objectBall: trackingMode.ob,
      targetPocket,
      pockets,
      onState: handleTrackerState,
    });
    trackerRef.current = tracker;
    tracker.arm();
    if (audioEnabled) playReady();
    return () => {
      tracker.stop();
      if (trackerRef.current === tracker) trackerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingMode.kind, homography, audioEnabled]);

  // Auto-arm: 5 seconds after a confident verdict lands, re-arm the
  // tracker for the next shot. Player can cancel by interacting (any
  // override / explicit Next Shot button click also cancels — both
  // call back into normal state transitions which clear the countdown).
  useEffect(() => {
    if (trackingMode.kind !== "result") {
      setAutoArmCountdown(null);
      return;
    }
    // Don't auto-arm if the verdict was uncertain — the user needs to
    // confirm what actually happened first.
    if (trackingMode.verdict === "uncertain") {
      setAutoArmCountdown(null);
      return;
    }
    let remaining = 5;
    setAutoArmCountdown(remaining);
    const tick = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(tick);
        setAutoArmCountdown(null);
        // armNextShot reads trackingMode at call time — wrap it so we
        // re-check (player might have ended tracking in those 5s).
        setTrackingMode((m) =>
          m.kind === "result"
            ? { kind: "armed", cb: m.cb, ob: m.ob }
            : m,
        );
        lastLoggedVerdictRef.current = null;
      } else {
        setAutoArmCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [trackingMode.kind, "verdict" in trackingMode ? trackingMode.verdict : null]);

  // Close the replay modal when a new shot starts.
  useEffect(() => {
    if (trackingMode.kind !== "result") setReplayOpen(false);
  }, [trackingMode.kind]);

  function handleTrackerState(state: TrackerState) {
    if (state.kind === "in-shot") {
      setTrackingMode((m) =>
        m.kind === "armed" || m.kind === "settling"
          ? { kind: "in-shot", cb: m.cb, ob: m.ob }
          : m,
      );
    } else if (state.kind === "settling") {
      setTrackingMode((m) =>
        m.kind === "in-shot"
          ? { kind: "settling", cb: m.cb, ob: m.ob }
          : m,
      );
    } else if (state.kind === "done") {
      const { verdict, finalOBPos, confidence, frames } = state.result;
      // Low-confidence verdicts get demoted to "uncertain" so we don't
      // auto-log on a wobbly read — the user gets the explicit confirm
      // buttons instead.
      const finalVerdict: "make" | "miss" | "uncertain" =
        confidence < 0.5 && verdict !== "uncertain" ? "uncertain" : verdict;
      setTrackingMode((m) => {
        if (
          m.kind === "armed" ||
          m.kind === "in-shot" ||
          m.kind === "settling"
        ) {
          return {
            kind: "result",
            cb: m.cb,
            ob: m.ob,
            verdict: finalVerdict,
            finalOBPos,
            confidence,
            frames,
          };
        }
        return m;
      });
      // Auto-log + audio.
      if (finalVerdict === "make") {
        logMake();
        logSessionAttempt(shot.id, true);
        lastLoggedVerdictRef.current = "make";
        if (audioEnabled) playMake();
      } else if (finalVerdict === "miss") {
        logMiss();
        logSessionAttempt(shot.id, false);
        lastLoggedVerdictRef.current = "miss";
        if (audioEnabled) playMiss();
      } else {
        lastLoggedVerdictRef.current = null;
        if (audioEnabled) playUncertain();
      }
    }
  }

  function startTracking() {
    primeAudio();
    lastLoggedVerdictRef.current = null;
    // Try to auto-find both balls. If we can't, fall back to the manual
    // tap-each-ball flow without bothering the player.
    const video = videoRef.current;
    const canvas = processingCanvasRef.current;
    if (!video || !canvas || !homography) {
      setTrackingMode({ kind: "lock-cb" });
      return;
    }
    setTrackingMode({ kind: "detecting" });
    // Give the camera a frame to settle, then run detection.
    setTimeout(() => {
      const frame = captureFrame(video, canvas);
      if (!frame) {
        setTrackingMode({ kind: "lock-cb" });
        return;
      }
      // Convert the four calibrated corners to canvas-space so detection
      // can mask the table polygon.
      const cornerCanvas = corners.map((p) =>
        toCanvasSpace(
          p,
          vidBox.width,
          vidBox.height,
          canvas.width,
          canvas.height,
        ),
      );
      const tableQuad =
        cornerCanvas.length === 4
          ? ([
              cornerCanvas[0],
              cornerCanvas[1],
              cornerCanvas[2],
              cornerCanvas[3],
            ] as [Point, Point, Point, Point])
          : undefined;
      const candidates = detectBalls(frame, { tableQuad });
      if (candidates.length < 2) {
        setTrackingMode({ kind: "lock-cb" });
        return;
      }
      // Where does the catalog say the OB should be? Project into canvas
      // space and use it as a hint for classification.
      const expectedObDisplay = applyHomography(homography, shot.objectBall);
      const expectedObCanvas = toCanvasSpace(
        expectedObDisplay,
        vidBox.width,
        vidBox.height,
        canvas.width,
        canvas.height,
      );
      const { cue, ob } = classifyBalls(candidates, expectedObCanvas);
      if (!cue || !ob) {
        setTrackingMode({ kind: "lock-cb" });
        return;
      }
      // Convert detected canvas-space positions back to display-space
      // and pack them into BallLocks (color we already have from
      // detection).
      const cueDisplay = toDisplaySpace(
        cue.center,
        canvas.width,
        canvas.height,
        vidBox.width,
        vidBox.height,
      );
      const obDisplay = toDisplaySpace(
        ob.center,
        canvas.width,
        canvas.height,
        vidBox.width,
        vidBox.height,
      );
      setTrackingMode({
        kind: "confirm-detected",
        cb: { displayPos: cueDisplay, reference: cue.color },
        ob: { displayPos: obDisplay, reference: ob.color },
      });
    }, 250);
  }

  function confirmDetection() {
    if (trackingMode.kind !== "confirm-detected") return;
    setTrackingMode({
      kind: "armed",
      cb: trackingMode.cb,
      ob: trackingMode.ob,
    });
  }

  function rejectDetectionForManual() {
    setTrackingMode({ kind: "lock-cb" });
  }

  function exitTracking() {
    trackerRef.current?.stop();
    trackerRef.current = null;
    lastLoggedVerdictRef.current = null;
    setTrackingMode({ kind: "off" });
  }

  function armNextShot() {
    if (trackingMode.kind !== "result") return;
    lastLoggedVerdictRef.current = null;
    setTrackingMode({
      kind: "armed",
      cb: trackingMode.cb,
      ob: trackingMode.ob,
    });
  }

  function overrideResult(verdict: "make" | "miss") {
    if (trackingMode.kind !== "result") return;
    const was = lastLoggedVerdictRef.current;
    const isNow = verdict === "make";
    if (was === verdict) return;
    if (was === null) {
      // The detector was "uncertain" — nothing was logged yet, so this
      // override is the first log for the attempt.
      if (isNow) {
        logMake();
        logSessionAttempt(shot.id, true);
      } else {
        logMiss();
        logSessionAttempt(shot.id, false);
      }
    } else {
      const wasMake = was === "make";
      correctLast(wasMake, isNow);
      correctSessionAttempt(shot.id, wasMake, isNow);
    }
    lastLoggedVerdictRef.current = verdict;
    setTrackingMode({ ...trackingMode, verdict });
    if (audioEnabled) {
      if (verdict === "make") playMake();
      else playMiss();
    }
  }

  function confirmUncertain(verdict: "make" | "miss") {
    overrideResult(verdict);
  }

  function recalibrate() {
    trackerRef.current?.stop();
    trackerRef.current = null;
    setTrackingMode({ kind: "off" });
    setCorners([]);
    setHomography(null);
    setCandidate(null);
    setAutoDetecting(false);
    setAnalysisState({ kind: "idle" });
  }

  /**
   * Capture ~10 frames spaced over a ~4 second window, then POST to the
   * AI feedback endpoint. We snapshot the live <video> element directly
   * — no MediaRecorder gymnastics, no separate upload step.
   */
  async function analyzeShot() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const TOTAL_FRAMES = 10;
    const INTERVAL_MS = 400;
    const frames: string[] = [];
    setAnalysisState({
      kind: "recording",
      framesCaptured: 0,
      totalFrames: TOTAL_FRAMES,
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setAnalysisState({
        kind: "error",
        message: "Couldn't open a canvas to capture frames.",
      });
      return;
    }

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.7));
      setAnalysisState({
        kind: "recording",
        framesCaptured: i + 1,
        totalFrames: TOTAL_FRAMES,
      });
      if (i < TOTAL_FRAMES - 1) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS));
      }
    }

    setAnalysisState({ kind: "analyzing" });
    try {
      const res = await fetch("/api/shot-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shotId: shot.id, frames }),
      });
      const data = await res.json();
      if (!data.ok) {
        setAnalysisState({
          kind: "error",
          message: data.error ?? "Analysis failed.",
        });
      } else {
        setAnalysisState({
          kind: "result",
          verdict: data.verdict,
          summary: data.summary,
        });
        // Persist the critique to the active session (no-op when not in
        // a Dawg Drill) so the end-of-session summary can replay what
        // the AI flagged.
        logSessionCritique(shot.id, {
          verdict: data.verdict,
          summary: data.summary,
        });
      }
    } catch (err) {
      setAnalysisState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Network error reaching feedback API",
      });
    }
  }

  function clearAnalysis() {
    setAnalysisState({ kind: "idle" });
  }

  // Compute overlay geometry from the homography and the catalogued shot.
  const overlay = homography
    ? buildOverlay(shot, homography)
    : null;

  // ---------- Render ----------

  if (!permissionAsked) {
    return (
      <PermissionGate shot={shot} onStart={requestCamera} />
    );
  }

  if (cameraError) {
    return (
      <CameraError
        message={cameraError}
        onRetry={requestCamera}
        shot={shot}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-black">
      <header className="flex items-center justify-between border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur">
        <Link
          href={`/shots/${shot.id}`}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/70 transition-colors hover:text-[var(--color-brass-bright)]"
        >
          <ArrowLeft size={14} />
          Back
        </Link>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
          AR · Shot {String(shot.number).padStart(2, "0")}
        </p>
      </header>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-black"
      >
        {/* The live camera feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* The interaction + overlay layer */}
        <svg
          viewBox={`0 0 ${Math.max(1, vidBox.width)} ${Math.max(1, vidBox.height)}`}
          width={vidBox.width || undefined}
          height={vidBox.height || undefined}
          onClick={handleOverlayClick}
          className={cn(
            "absolute inset-0 h-full w-full",
            !homography && "cursor-crosshair",
          )}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Tapped corner markers */}
          {corners.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={16}
                fill="rgba(232,82,72,0.25)"
                stroke="rgba(232,82,72,0.95)"
                strokeWidth={2}
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill="#fff"
              >
                {i + 1}
              </text>
            </g>
          ))}

          {/* Candidate auto-detected setup — corners outlined in brass
              with a connecting polygon, plus highlighted ball markers
              if detection nailed those too. Awaits player confirmation. */}
          {candidate && (
            <g>
              <polygon
                points={candidate.corners
                  .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                  .join(" ")}
                fill="rgba(201,162,74,0.08)"
                stroke="rgba(201,162,74,0.85)"
                strokeWidth={2}
                strokeDasharray="6 4"
                className="animate-pulse"
              />
              {candidate.corners.map((p, i) => (
                <g key={`cand-${i}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={20}
                    fill="rgba(201,162,74,0.2)"
                    stroke="rgba(255,235,180,0.95)"
                    strokeWidth={2.5}
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={4}
                    fill="rgba(255,235,180,0.95)"
                  />
                </g>
              ))}
              {candidate.balls && (
                <g>
                  <circle
                    cx={candidate.balls.cb.displayPos.x}
                    cy={candidate.balls.cb.displayPos.y}
                    r={18}
                    fill="rgba(255,255,255,0.18)"
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth={2.5}
                  />
                  <circle
                    cx={candidate.balls.ob.displayPos.x}
                    cy={candidate.balls.ob.displayPos.y}
                    r={18}
                    fill="rgba(224,168,46,0.22)"
                    stroke="rgba(224,168,46,0.95)"
                    strokeWidth={2.5}
                  />
                </g>
              )}
            </g>
          )}

          {/* AR overlay once calibrated */}
          {overlay && (
            <>
              {/* Approach line from CB → ghost ball */}
              <line
                x1={overlay.cueBall.x}
                y1={overlay.cueBall.y}
                x2={overlay.ghostBall.x}
                y2={overlay.ghostBall.y}
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={2}
                strokeDasharray="6 6"
              />
              {/* Cue-ball carom path */}
              {overlay.cuePath.length > 1 && (
                <path
                  d={polyD(overlay.cuePath)}
                  stroke="rgba(236,225,196,0.9)"
                  strokeWidth={3}
                  strokeDasharray="4 6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {/* OB path */}
              {overlay.obPath.length > 1 && (
                <path
                  d={polyD(overlay.obPath)}
                  stroke="rgba(224,190,107,0.9)"
                  strokeWidth={3}
                  strokeDasharray="8 8"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {/* Ghost ball — translucent outline */}
              <circle
                cx={overlay.ghostBall.x}
                cy={overlay.ghostBall.y}
                r={overlay.ballRadius}
                fill="rgba(255,255,255,0.15)"
                stroke="rgba(255,255,255,0.95)"
                strokeWidth={2}
                strokeDasharray="3 3"
              />
              <circle
                cx={overlay.ghostBall.x}
                cy={overlay.ghostBall.y}
                r={3}
                fill="#fff"
              />
              {/* Cue-ball marker (where it should sit at start) */}
              <circle
                cx={overlay.cueBall.x}
                cy={overlay.cueBall.y}
                r={overlay.ballRadius}
                fill="rgba(236,225,196,0.18)"
                stroke="rgba(236,225,196,0.95)"
                strokeWidth={2}
              />
              {/* Object-ball marker */}
              <circle
                cx={overlay.objectBall.x}
                cy={overlay.objectBall.y}
                r={overlay.ballRadius}
                fill="rgba(224,168,46,0.2)"
                stroke="rgba(224,168,46,0.95)"
                strokeWidth={2}
              />
              {/* Target pocket pulse */}
              {overlay.targetPocket && (
                <circle
                  cx={overlay.targetPocket.x}
                  cy={overlay.targetPocket.y}
                  r={overlay.ballRadius * 1.8}
                  fill="none"
                  stroke="rgba(232,82,72,0.85)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
              )}
            </>
          )}
        </svg>

        {/* Calibration prompt overlay */}
        {!homography && !candidate && (
          <CalibrationPrompt
            step={corners.length}
            total={CORNER_ORDER.length}
            currentLabel={CORNER_ORDER[corners.length]?.pocketLabel ?? ""}
            orientation={orientation}
            onSwitchOrientation={() =>
              setOrientation((o) => (o === "head" ? "foot" : "head"))
            }
            autoDetecting={autoDetecting}
            onRetryAutoDetect={tryAutoDetectCorners}
          />
        )}

        {/* Auto-detect confirmation banner — either corners + balls (one
            tap to fully armed) or just corners (one tap to overlay). */}
        {candidate && !homography && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-4">
            <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-[var(--color-brass)]/60 bg-black/80 px-5 py-4 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
                {candidate.balls
                  ? "Found everything — start tracking?"
                  : "Found your pockets — confirm?"}
              </p>
              <p className="mt-1 text-sm leading-snug text-white">
                {candidate.balls
                  ? "Pockets, cue ball, and object ball all auto-detected (highlighted). Tap to lock everything in and start watching for your shot."
                  : "The four highlighted spots are the corner pockets I picked out. Tap to use them, or tap any pocket on screen to take over manually."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {candidate.balls ? (
                  <>
                    <button
                      type="button"
                      onClick={acceptCandidate}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-felt-bright)]/55 bg-[var(--color-felt-deep)]/70 text-sm font-semibold text-[var(--color-felt-bright)] hover:bg-[var(--color-felt-deep)]"
                    >
                      ✓ Start tracking
                    </button>
                    <button
                      type="button"
                      onClick={acceptCornersOnly}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 text-xs font-semibold uppercase tracking-wider text-white hover:bg-white/20"
                      title="Use just the AR overlay without auto-tracking shots"
                    >
                      Overlay only
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={acceptCandidate}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-felt-bright)]/55 bg-[var(--color-felt-deep)]/70 text-sm font-semibold text-[var(--color-felt-bright)] hover:bg-[var(--color-felt-deep)]"
                  >
                    ✓ Use these
                  </button>
                )}
                <button
                  type="button"
                  onClick={rejectCandidate}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
                >
                  Tap manually
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Once calibrated: control strip + (optional) analysis result */}
        {homography && (
          <CalibratedHud
            shot={shot}
            onRecalibrate={recalibrate}
            analysisState={analysisState}
            onAnalyze={analyzeShot}
            onClearAnalysis={clearAnalysis}
            trackingMode={trackingMode}
            onStartTracking={startTracking}
            onExitTracking={exitTracking}
            onOverride={overrideResult}
            onConfirmUncertain={confirmUncertain}
            onArmNextShot={armNextShot}
            audioEnabled={audioEnabled}
            onToggleAudio={() => setAudioEnabled((a) => !a)}
            autoArmCountdown={autoArmCountdown}
            onCancelAutoArm={() => setAutoArmCountdown(null)}
            onOpenReplay={() => setReplayOpen(true)}
            onConfirmDetection={confirmDetection}
            onRejectDetection={rejectDetectionForManual}
          />
        )}

        {/* Slow-mo replay modal */}
        {replayOpen &&
          trackingMode.kind === "result" &&
          trackingMode.frames.length > 0 && (
            <ShotReplay
              frames={trackingMode.frames}
              obReference={trackingMode.ob.reference}
              onClose={() => setReplayOpen(false)}
            />
          )}

        {/* Tracking-mode visual overlays: locked balls + state pulse. */}
        {homography &&
          trackingMode.kind !== "off" &&
          (() => {
            const cb =
              "cb" in trackingMode ? trackingMode.cb.displayPos : null;
            const ob =
              "ob" in trackingMode ? trackingMode.ob.displayPos : null;
            return (
              <svg
                viewBox={`0 0 ${Math.max(1, vidBox.width)} ${Math.max(1, vidBox.height)}`}
                width={vidBox.width || undefined}
                height={vidBox.height || undefined}
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                {cb && (
                  <circle
                    cx={cb.x}
                    cy={cb.y}
                    r={overlay?.ballRadius ?? 18}
                    fill="rgba(255,255,255,0.18)"
                    stroke="rgba(255,255,255,0.95)"
                    strokeWidth={2.5}
                    className={cn(
                      trackingMode.kind === "armed" && "animate-pulse",
                    )}
                  />
                )}
                {ob && (
                  <circle
                    cx={ob.x}
                    cy={ob.y}
                    r={overlay?.ballRadius ?? 18}
                    fill="rgba(224,168,46,0.22)"
                    stroke="rgba(224,168,46,0.95)"
                    strokeWidth={2.5}
                    className={cn(
                      trackingMode.kind === "armed" && "animate-pulse",
                    )}
                  />
                )}
                {trackingMode.kind === "result" &&
                  trackingMode.finalOBPos && (
                    <g>
                      <circle
                        cx={trackingMode.finalOBPos.x}
                        cy={trackingMode.finalOBPos.y}
                        r={(overlay?.ballRadius ?? 18) + 4}
                        fill="none"
                        stroke={
                          trackingMode.verdict === "make"
                            ? "rgba(110,219,135,0.95)"
                            : "rgba(232,82,72,0.95)"
                        }
                        strokeWidth={3}
                        strokeDasharray="4 4"
                      />
                    </g>
                  )}
              </svg>
            );
          })()}
      </div>
    </div>
  );
}

// ----- subcomponents -----

function PermissionGate({
  shot,
  onStart,
}: {
  shot: KinisterShot;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-12 sm:px-6">
      <Link
        href={`/shots/${shot.id}`}
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
      >
        <ArrowLeft size={14} />
        Back to {shot.name}
      </Link>
      <div className="surface space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Crosshair
            size={24}
            className="text-[var(--color-brass-bright)]"
          />
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-wide">
            AR Aim
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-[var(--fg-dim)]">
          Point your phone&apos;s back camera at the pool table. Tap the
          four corner pockets when prompted, and we&apos;ll overlay the
          ghost ball, the aim line, and the cue-ball path right on the
          real table.
        </p>
        <ul className="space-y-2 text-xs leading-relaxed text-[var(--fg-dim)]">
          <li className="flex gap-2">
            <span className="text-[var(--color-brass-bright)]">•</span>
            Best with the phone in landscape, propped at eye level above the
            cue-ball end.
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--color-brass-bright)]">•</span>
            All four corner pockets should be visible in the frame.
          </li>
          <li className="flex gap-2">
            <span className="text-[var(--color-brass-bright)]">•</span>
            Hold the camera steady — if you bump it, hit Recalibrate.
          </li>
        </ul>
        <button
          type="button"
          onClick={onStart}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-5 text-sm font-semibold tracking-wide text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)]"
        >
          <Camera size={14} />
          Start AR
        </button>
      </div>
    </div>
  );
}

function CameraError({
  message,
  onRetry,
  shot,
}: {
  message: string;
  onRetry: () => void;
  shot: KinisterShot;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-12 sm:px-6">
      <Link
        href={`/shots/${shot.id}`}
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
      >
        <ArrowLeft size={14} />
        Back
      </Link>
      <div className="surface space-y-3 p-6">
        <p className="text-sm font-semibold text-[var(--color-pop-bright)]">
          Couldn&apos;t open the camera
        </p>
        <p className="text-sm leading-relaxed text-[var(--fg-dim)]">{message}</p>
        <p className="text-xs leading-relaxed text-[var(--fg-dim)]">
          AR needs camera permission. If you previously blocked it, you may
          need to re-enable it in your browser&apos;s site settings before
          retrying.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 text-sm font-semibold tracking-wide text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10"
        >
          <RotateCcw size={14} />
          Try again
        </button>
      </div>
    </div>
  );
}

function CalibrationPrompt({
  step,
  total,
  currentLabel,
  orientation,
  onSwitchOrientation,
  autoDetecting,
  onRetryAutoDetect,
}: {
  step: number;
  total: number;
  currentLabel: string;
  orientation: "head" | "foot";
  onSwitchOrientation: () => void;
  autoDetecting: boolean;
  onRetryAutoDetect: () => void;
}) {
  if (step >= total) return null;
  // While we're attempting auto-detection on the very first frames,
  // show the searching state instead of the "tap" prompt — saves the
  // player from racing the detector.
  if (autoDetecting && step === 0) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-4">
        <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-[var(--color-brass)]/55 bg-black/75 px-5 py-4 backdrop-blur-md">
          <Loader2
            size={16}
            className="shrink-0 animate-spin text-[var(--color-brass-bright)]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
              Looking for pockets…
            </p>
            <p className="mt-1 text-sm leading-snug text-white">
              Scanning the table corners. You can also tap the four corner
              pockets yourself.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-4">
      <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-white/15 bg-black/70 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
            Calibrate · step {step + 1} of {total}
          </p>
          <button
            type="button"
            onClick={onSwitchOrientation}
            className="text-[10px] font-semibold uppercase tracking-wider text-white/70 transition-colors hover:text-white"
            title="Flip which end of the table you're standing at"
          >
            Standing at {orientation === "head" ? "head" : "foot"} rail — flip
          </button>
        </div>
        <p className="text-sm leading-snug text-white">
          Tap the{" "}
          <span className="font-semibold text-[var(--color-brass-bright)]">
            {currentLabel}
          </span>{" "}
          pocket on the screen.
        </p>
        <div className="flex items-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full",
                i < step
                  ? "bg-[var(--color-brass-bright)]"
                  : i === step
                    ? "bg-[var(--color-brass)]/60"
                    : "bg-white/20",
              )}
            />
          ))}
        </div>
        {step === 0 && (
          <button
            type="button"
            onClick={onRetryAutoDetect}
            className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/10"
          >
            <Crosshair size={11} />
            Try auto-detect again
          </button>
        )}
      </div>
    </div>
  );
}

type AnalysisState =
  | { kind: "idle" }
  | { kind: "recording"; framesCaptured: number; totalFrames: number }
  | { kind: "analyzing" }
  | {
      kind: "result";
      verdict: "looked great" | "needs work" | "uncertain";
      summary: string;
    }
  | { kind: "error"; message: string };

function CalibratedHud({
  shot,
  onRecalibrate,
  analysisState,
  onAnalyze,
  onClearAnalysis,
  trackingMode,
  onStartTracking,
  onExitTracking,
  onOverride,
  onConfirmUncertain,
  onArmNextShot,
  audioEnabled,
  onToggleAudio,
  autoArmCountdown,
  onCancelAutoArm,
  onOpenReplay,
  onConfirmDetection,
  onRejectDetection,
}: {
  shot: KinisterShot;
  onRecalibrate: () => void;
  analysisState: AnalysisState;
  onAnalyze: () => void;
  onClearAnalysis: () => void;
  trackingMode:
    | { kind: "off" }
    | { kind: "detecting" }
    | { kind: "confirm-detected"; cb: BallLock; ob: BallLock }
    | { kind: "lock-cb" }
    | { kind: "lock-ob"; cb: BallLock }
    | { kind: "armed"; cb: BallLock; ob: BallLock }
    | { kind: "in-shot"; cb: BallLock; ob: BallLock }
    | { kind: "settling"; cb: BallLock; ob: BallLock }
    | {
        kind: "result";
        cb: BallLock;
        ob: BallLock;
        verdict: "make" | "miss" | "uncertain";
        finalOBPos: Point | null;
        confidence: number;
        frames: { dataUrl: string; t: number }[];
      };
  onStartTracking: () => void;
  onExitTracking: () => void;
  onOverride: (verdict: "make" | "miss") => void;
  onConfirmUncertain: (verdict: "make" | "miss") => void;
  onArmNextShot: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  autoArmCountdown: number | null;
  onCancelAutoArm: () => void;
  onOpenReplay: () => void;
  onConfirmDetection: () => void;
  onRejectDetection: () => void;
}) {
  const busy =
    analysisState.kind === "recording" || analysisState.kind === "analyzing";
  const tracking = trackingMode.kind !== "off";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-4">
      {/* Tracking result banner (highest priority — show on top) */}
      {trackingMode.kind === "result" && (
        <TrackingResultBanner
          verdict={trackingMode.verdict}
          confidence={trackingMode.confidence}
          hasFrames={trackingMode.frames.length > 0}
          onOverride={onOverride}
          onConfirmUncertain={onConfirmUncertain}
          onArmNextShot={() => {
            onCancelAutoArm();
            onArmNextShot();
          }}
          onOpenReplay={onOpenReplay}
          autoArmCountdown={autoArmCountdown}
          onCancelAutoArm={onCancelAutoArm}
        />
      )}

      {/* Confirm auto-detected balls before arming the tracker */}
      {trackingMode.kind === "confirm-detected" && (
        <ConfirmDetectionBanner
          onConfirm={onConfirmDetection}
          onReject={onRejectDetection}
        />
      )}

      {/* Tracking lock-in / armed / in-shot status */}
      {tracking &&
        trackingMode.kind !== "result" &&
        trackingMode.kind !== "confirm-detected" && (
          <TrackingStatusBanner mode={trackingMode} onExit={onExitTracking} />
        )}

      {/* Analysis result card */}
      {analysisState.kind === "result" && (
        <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/15 bg-black/80 px-4 py-3 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.28em]",
                  analysisState.verdict === "looked great"
                    ? "text-[var(--color-felt-bright)]"
                    : analysisState.verdict === "needs work"
                      ? "text-[var(--color-pop-bright)]"
                      : "text-white/70",
                )}
              >
                AI critique · {analysisState.verdict}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white">
                {analysisState.summary}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearAnalysis}
              className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-white/60 transition-colors hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {analysisState.kind === "error" && (
        <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-[var(--color-pop)]/55 bg-[var(--color-pop)]/15 px-4 py-3 text-sm text-white backdrop-blur-md">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-pop-bright)]">
            Analysis failed
          </p>
          <p className="mt-1 leading-relaxed">{analysisState.message}</p>
          <button
            type="button"
            onClick={onClearAnalysis}
            className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/70 transition-colors hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Bottom control strip */}
      <div className="pointer-events-auto flex w-full max-w-xl flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-black/70 px-3 py-2.5 backdrop-blur-md">
        <Target size={14} className="shrink-0 text-[var(--color-brass-bright)]" />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-xs font-semibold text-white">
            {shot.name}
          </p>
          <p className="truncate text-[10px] text-white/60">
            Cue: {describePosition(shot.cueBall)}
          </p>
        </div>
        {!tracking && (
          <button
            type="button"
            onClick={onStartTracking}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-felt-bright)]/60 bg-[var(--color-felt-deep)]/70 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-felt-bright)] transition-colors hover:bg-[var(--color-felt-deep)] disabled:opacity-50"
            title="Auto-track makes and misses from the camera feed"
          >
            <Radar size={12} />
            Track shots
          </button>
        )}
        <button
          type="button"
          onClick={onAnalyze}
          disabled={busy || tracking}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)] disabled:cursor-wait disabled:opacity-50"
          title={
            tracking
              ? "Exit tracking to run the AI critique"
              : "Capture a few seconds and ask the AI to critique your stroke"
          }
        >
          {analysisState.kind === "recording" ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              {analysisState.framesCaptured}/{analysisState.totalFrames}
            </>
          ) : analysisState.kind === "analyzing" ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles size={12} />
              AI critique
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleAudio}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
          title={audioEnabled ? "Mute make/miss sounds" : "Unmute make/miss sounds"}
          aria-pressed={audioEnabled}
        >
          {audioEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
        </button>
        <button
          type="button"
          onClick={onRecalibrate}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white/20 disabled:opacity-50"
        >
          <RotateCcw size={12} />
          Recalibrate
        </button>
      </div>
    </div>
  );
}

function TrackingStatusBanner({
  mode,
  onExit,
}: {
  mode:
    | { kind: "detecting" }
    | { kind: "lock-cb" }
    | { kind: "lock-ob"; cb: BallLock }
    | { kind: "armed"; cb: BallLock; ob: BallLock }
    | { kind: "in-shot"; cb: BallLock; ob: BallLock }
    | { kind: "settling"; cb: BallLock; ob: BallLock };
  onExit: () => void;
}) {
  const status =
    mode.kind === "detecting"
      ? {
          title: "Looking for your balls…",
          detail: "Scanning the table — this takes a moment.",
          tone: "brass" as const,
        }
      : mode.kind === "lock-cb"
        ? {
            title: "Tap the cue ball",
            detail: "Touch your real cue ball through the screen so we can lock onto its color.",
            tone: "brass" as const,
          }
        : mode.kind === "lock-ob"
          ? {
              title: "Tap the object ball",
              detail: "Now touch the object ball so we know what to watch.",
              tone: "brass" as const,
            }
          : mode.kind === "armed"
            ? {
                title: "Ready — take your shot",
                detail: "Watching for motion. I'll call it as soon as the balls stop.",
                tone: "felt" as const,
              }
            : mode.kind === "in-shot"
              ? {
                  title: "Shot in progress…",
                  detail: "Hold the phone steady — settling shortly.",
                  tone: "brass" as const,
                }
              : {
                  title: "Reading the table…",
                  detail: "Checking where the object ball ended up.",
                  tone: "brass" as const,
                };
  const accent =
    status.tone === "felt"
      ? "border-[var(--color-felt-bright)]/55 bg-[var(--color-felt-deep)]/70"
      : "border-[var(--color-brass)]/55 bg-black/75";
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md",
        accent,
      )}
    >
      <Radar
        size={16}
        className={cn(
          "shrink-0",
          status.tone === "felt"
            ? "text-[var(--color-felt-bright)]"
            : "text-[var(--color-brass-bright)]",
          (mode.kind === "armed" || mode.kind === "in-shot") && "animate-pulse",
        )}
      />
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-semibold text-white">{status.title}</p>
        <p className="text-[11px] leading-snug text-white/70">{status.detail}</p>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-white/70 transition-colors hover:text-white"
      >
        Exit tracking
      </button>
    </div>
  );
}

function ConfirmDetectionBanner({
  onConfirm,
  onReject,
}: {
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-[var(--color-brass)]/55 bg-black/80 px-4 py-3 backdrop-blur-md">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
        Found both balls — confirm?
      </p>
      <p className="mt-1 text-sm leading-snug text-white">
        Cue ball + object ball auto-detected (the circles highlighted on
        the table). Tap confirm if they look right, otherwise tap each
        ball yourself.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-felt-bright)]/55 bg-[var(--color-felt-deep)]/70 text-sm font-semibold text-[var(--color-felt-bright)] hover:bg-[var(--color-felt-deep)]"
        >
          ✓ Looks right
        </button>
        <button
          type="button"
          onClick={onReject}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
        >
          Tap manually
        </button>
      </div>
    </div>
  );
}

function TrackingResultBanner({
  verdict,
  confidence,
  hasFrames,
  onOverride,
  onConfirmUncertain,
  onArmNextShot,
  onOpenReplay,
  autoArmCountdown,
  onCancelAutoArm,
}: {
  verdict: "make" | "miss" | "uncertain";
  confidence: number;
  hasFrames: boolean;
  onOverride: (v: "make" | "miss") => void;
  onConfirmUncertain: (v: "make" | "miss") => void;
  onArmNextShot: () => void;
  onOpenReplay: () => void;
  autoArmCountdown: number | null;
  onCancelAutoArm: () => void;
}) {
  if (verdict === "uncertain") {
    return (
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/30 bg-black/80 px-4 py-3 backdrop-blur-md">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/80">
          Couldn&apos;t call it — log this one yourself
        </p>
        <p className="mt-1 text-[11px] leading-snug text-white/60">
          The detection wasn&apos;t confident enough (only{" "}
          {Math.round(confidence * 100)}% match). Tap whichever happened.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onConfirmUncertain("make")}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-felt-bright)]/55 bg-[var(--color-felt-deep)]/60 text-sm font-semibold text-[var(--color-felt-bright)] hover:bg-[var(--color-felt-deep)]/80"
          >
            ✓ I made it
          </button>
          <button
            type="button"
            onClick={() => onConfirmUncertain("miss")}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-pop)]/55 bg-[var(--color-pop)]/15 text-sm font-semibold text-[var(--color-pop-bright)] hover:bg-[var(--color-pop)]/25"
          >
            ✗ I missed
          </button>
        </div>
        {hasFrames && (
          <button
            type="button"
            onClick={onOpenReplay}
            className="mt-2 inline-flex h-8 w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/10"
          >
            Show me the replay
          </button>
        )}
      </div>
    );
  }
  const isMake = verdict === "make";
  const confidencePct = Math.round(confidence * 100);
  const confidenceLabel =
    confidence >= 0.85
      ? "high confidence"
      : confidence >= 0.65
        ? "medium confidence"
        : "low confidence — double-check";
  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-xl rounded-2xl border px-4 py-3 backdrop-blur-md",
        isMake
          ? "border-[var(--color-felt-bright)]/55 bg-[var(--color-felt-deep)]/85"
          : "border-[var(--color-pop)]/55 bg-[var(--color-pop)]/15",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full text-2xl",
              isMake
                ? "bg-[var(--color-felt-bright)] text-[var(--color-ink)]"
                : "bg-[var(--color-pop)] text-white",
            )}
          >
            {isMake ? "✓" : "✗"}
          </span>
          <div>
            <p
              className={cn(
                "font-[family-name:var(--font-display)] text-xl tracking-wide",
                isMake ? "text-[var(--color-felt-bright)]" : "text-[var(--color-pop-bright)]",
              )}
            >
              {isMake ? "Made it" : "Missed"}
              <span className="ml-2 align-middle text-xs font-mono text-white/70">
                {confidencePct}%
              </span>
            </p>
            <p className="text-[11px] uppercase tracking-wider text-white/60">
              {confidenceLabel}
              {autoArmCountdown !== null && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={onCancelAutoArm}
                    className="font-semibold text-white/80 underline-offset-2 hover:underline"
                  >
                    Re-arming in {autoArmCountdown}s — pause
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onArmNextShot}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-white/30 bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white/20"
        >
          Next shot
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onOverride(isMake ? "miss" : "make")}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-white/30 bg-white/5 text-[12px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white/15"
        >
          {isMake ? "Actually missed →" : "Actually made →"}
        </button>
        {hasFrames && (
          <button
            type="button"
            onClick={onOpenReplay}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-white/30 bg-white/5 px-4 text-[12px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white/15"
          >
            Replay
          </button>
        )}
      </div>
    </div>
  );
}

// ----- helpers -----

type Overlay = {
  cueBall: Point;
  objectBall: Point;
  ghostBall: Point;
  targetPocket: Point | null;
  cuePath: Point[];
  obPath: Point[];
  ballRadius: number;
};

function buildOverlay(shot: KinisterShot, h: Homography): Overlay {
  const proj = (d: DiamondCoord): Point =>
    applyHomography(h, { x: d.x, y: d.y });
  const cb = proj(shot.cueBall);
  const ob = proj(shot.objectBall);
  const target = shot.targetPocket ? proj(POCKETS[shot.targetPocket]) : null;
  const ghostDiamond = shot.targetPocket
    ? ghostBall(shot.objectBall, POCKETS[shot.targetPocket])
    : contactPoint(shot.cueBall, shot.objectBall);
  const ghost = proj(ghostDiamond);
  const cuePath = [
    cb,
    proj(contactPoint(shot.cueBall, shot.objectBall)),
    ...shot.cueBallPath.map(proj),
  ];
  const obPathDiamond = shot.objectBallPath ?? (shot.targetPocket ? [POCKETS[shot.targetPocket]] : []);
  const obPath = obPathDiamond.length > 0 ? [ob, ...obPathDiamond.map(proj)] : [];
  // Approximate ball radius in screen space — use the distance from the
  // OB's projection to a point one ball-radius away in table space.
  const r = ballRadiusInScreenSpace(shot.objectBall, h);
  return {
    cueBall: cb,
    objectBall: ob,
    ghostBall: ghost,
    targetPocket: target,
    cuePath,
    obPath,
    ballRadius: r,
  };
}

function ballRadiusInScreenSpace(
  near: DiamondCoord,
  h: Homography,
): number {
  // Pool ball radius ≈ 1.125 inches; table diamond ≈ ~12.7 inches → ~0.09
  // diamonds. Project a point that offset away from `near` and measure.
  const a = applyHomography(h, near);
  const b = applyHomography(h, { x: near.x + 0.09, y: near.y });
  return Math.max(6, Math.hypot(b.x - a.x, b.y - a.y));
}

function polyD(points: Point[]): string {
  return points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
    )
    .join(" ");
}

