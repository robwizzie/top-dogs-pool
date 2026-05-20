"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Crosshair,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
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
  const [homography, setHomography] = useState<Homography | null>(null);
  const [orientation, setOrientation] = useState<"head" | "foot">("head");

  // Display-space dimensions of the <video> element. We recompute on
  // resize so the SVG overlay stays in lock-step with the rendered feed.
  const [vidBox, setVidBox] = useState({ width: 0, height: 0 });

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

  function handleOverlayClick(e: React.MouseEvent<SVGSVGElement>) {
    if (homography || corners.length >= 4) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCorners((prev) => [...prev, { x, y }]);
  }

  function recalibrate() {
    setCorners([]);
    setHomography(null);
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
        {!homography && (
          <CalibrationPrompt
            step={corners.length}
            total={CORNER_ORDER.length}
            currentLabel={CORNER_ORDER[corners.length]?.pocketLabel ?? ""}
            orientation={orientation}
            onSwitchOrientation={() =>
              setOrientation((o) => (o === "head" ? "foot" : "head"))
            }
          />
        )}

        {/* Once calibrated: control strip + (optional) analysis result */}
        {homography && (
          <CalibratedHud
            shot={shot}
            onRecalibrate={recalibrate}
            analysisState={analysisState}
            onAnalyze={analyzeShot}
            onClearAnalysis={clearAnalysis}
          />
        )}
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
}: {
  step: number;
  total: number;
  currentLabel: string;
  orientation: "head" | "foot";
  onSwitchOrientation: () => void;
}) {
  if (step >= total) return null;
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
}: {
  shot: KinisterShot;
  onRecalibrate: () => void;
  analysisState: AnalysisState;
  onAnalyze: () => void;
  onClearAnalysis: () => void;
}) {
  const busy =
    analysisState.kind === "recording" || analysisState.kind === "analyzing";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-4">
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
      <div className="pointer-events-auto flex w-full max-w-xl flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-black/70 px-4 py-3 backdrop-blur-md">
        <Target size={14} className="shrink-0 text-[var(--color-brass-bright)]" />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-xs font-semibold text-white">
            {shot.name}
          </p>
          <p className="truncate text-[10px] text-white/60">
            Cue: {describePosition(shot.cueBall)}
          </p>
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)] disabled:cursor-wait disabled:opacity-70"
          title="Capture a few seconds and ask the AI to critique your stroke"
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
              Analyze my shot
            </>
          )}
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

