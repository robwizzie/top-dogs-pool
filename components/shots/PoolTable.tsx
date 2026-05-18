"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type {
  DiamondCoord,
  EnglishHit,
  KinisterShot,
} from "@/lib/kinister/shots";
import { POCKETS } from "@/lib/kinister/shots";
import {
  BALL_R,
  POCKET_R,
  RAIL,
  SURFACE_H,
  SURFACE_W,
  SVG_H,
  SVG_W,
  UNIT,
  contactPoint,
  toSvg,
  walkPath,
} from "@/lib/kinister/geometry";
import { cn } from "@/lib/utils";

type Props = {
  shot: KinisterShot;
  /** Render with playback controls. False = static diagram only. */
  interactive?: boolean;
  /** Render a smaller preview (used in list cards). Disables controls. */
  preview?: boolean;
  className?: string;
};

/** Phase 1 of the animation: cue ball travels from start to OB contact. */
const APPROACH_FRACTION = 0.32;
const TOTAL_MS = 2200;

export function PoolTable({ shot, interactive = false, preview = false, className }: Props) {
  const [progress, setProgress] = useState(0); // 0..1
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const startFromRef = useRef(0);

  const sequence = shot.sequence;
  const stepCount = sequence?.length ?? 1;
  const totalMs = TOTAL_MS * stepCount;

  const contact = useMemo(
    () => contactPoint(shot.cueBall, shot.objectBall),
    [shot.cueBall, shot.objectBall],
  );

  // Static (or final) positions for the diagram lines.
  const obFinalPath: DiamondCoord[] =
    shot.objectBallPath ??
    (shot.targetPocket ? [POCKETS[shot.targetPocket]] : []);

  // Stop the animation if the shot changes.
  useEffect(() => {
    setProgress(0);
    setPlaying(false);
  }, [shot.id]);

  useEffect(() => {
    if (!playing) return;
    startedAtRef.current = null;
    startFromRef.current = progress >= 1 ? 0 : progress;
    if (progress >= 1) setProgress(0);

    const tick = (now: number) => {
      if (startedAtRef.current === null) startedAtRef.current = now;
      const elapsed = now - startedAtRef.current;
      const p = Math.min(1, startFromRef.current + elapsed / totalMs);
      setProgress(p);
      if (p >= 1) {
        setPlaying(false);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, totalMs]);

  // Derive live positions from `progress`.
  let cuePos: DiamondCoord;
  let obPos: DiamondCoord;
  // For sequence shots: how many balls have been pocketed already, and the
  // current active step's ball + ob animation position.
  let pocketedCount = 0;
  let activeStepIdx = 0;

  if (sequence && sequence.length > 0) {
    const stepProgress = progress * sequence.length;
    activeStepIdx = Math.min(sequence.length - 1, Math.floor(stepProgress));
    const localProgress = stepProgress - activeStepIdx;
    pocketedCount = progress >= 1 ? sequence.length : activeStepIdx;
    const prevCue =
      activeStepIdx === 0
        ? shot.cueBall
        : sequence[activeStepIdx - 1].cueAfter;
    const step = sequence[activeStepIdx];
    const stepContact = contactPoint(prevCue, step.ball);
    const stepOBPath: DiamondCoord[] = [POCKETS[step.pocket]];

    if (localProgress < APPROACH_FRACTION) {
      const t = localProgress / APPROACH_FRACTION;
      cuePos = walkPath(prevCue, [stepContact], t);
      obPos = step.ball;
    } else {
      const t = (localProgress - APPROACH_FRACTION) / (1 - APPROACH_FRACTION);
      cuePos = walkPath(stepContact, [step.cueAfter], t);
      obPos = walkPath(step.ball, stepOBPath, t);
    }
  } else if (progress <= 0) {
    cuePos = shot.cueBall;
    obPos = shot.objectBall;
  } else if (progress < APPROACH_FRACTION) {
    const t = progress / APPROACH_FRACTION;
    cuePos = walkPath(shot.cueBall, [contact], t);
    obPos = shot.objectBall;
  } else {
    const t = (progress - APPROACH_FRACTION) / (1 - APPROACH_FRACTION);
    cuePos = walkPath(contact, shot.cueBallPath, t);
    obPos =
      obFinalPath.length > 0
        ? walkPath(shot.objectBall, obFinalPath, t)
        : shot.objectBall;
  }

  // SVG transforms.
  const cb = toSvg(cuePos);
  const ob = toSvg(obPos);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-felt)]">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          xmlns="http://www.w3.org/2000/svg"
          className="block h-auto w-full"
          role="img"
          aria-label={`Diagram of ${shot.name}`}
        >
          <defs>
            <radialGradient id="felt-grad" cx="50%" cy="40%" r="80%">
              <stop offset="0%" stopColor="#1f6e3d" />
              <stop offset="100%" stopColor="#0a2a20" />
            </radialGradient>
            <linearGradient id="rail-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a2410" />
              <stop offset="100%" stopColor="#1a0f06" />
            </linearGradient>
            <radialGradient id="cb-grad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#cfc7b0" />
            </radialGradient>
            <radialGradient id="ob-grad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fff8d8" />
              <stop offset="60%" stopColor="#e0a82e" />
              <stop offset="100%" stopColor="#7a5610" />
            </radialGradient>
            <pattern id="felt-grit" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="transparent" />
              <circle cx="1" cy="1" r="0.5" fill="rgba(0,0,0,0.18)" />
              <circle cx="4" cy="3" r="0.4" fill="rgba(255,255,255,0.04)" />
            </pattern>
          </defs>

          {/* Rail frame */}
          <rect
            x={0}
            y={0}
            width={SVG_W}
            height={SVG_H}
            rx={RAIL * 0.5}
            fill="url(#rail-grad)"
          />
          {/* Brass inner trim */}
          <rect
            x={RAIL - 4}
            y={RAIL - 4}
            width={SURFACE_W + 8}
            height={SURFACE_H + 8}
            rx={6}
            fill="none"
            stroke="rgba(201,162,74,0.55)"
            strokeWidth={1.5}
          />

          {/* Felt */}
          <rect
            x={RAIL}
            y={RAIL}
            width={SURFACE_W}
            height={SURFACE_H}
            fill="url(#felt-grad)"
          />
          <rect
            x={RAIL}
            y={RAIL}
            width={SURFACE_W}
            height={SURFACE_H}
            fill="url(#felt-grit)"
            opacity={0.4}
          />

          {/* Head string (vertical at x = 2 diamonds) */}
          <line
            x1={RAIL + 2 * UNIT}
            y1={RAIL}
            x2={RAIL + 2 * UNIT}
            y2={RAIL + SURFACE_H}
            stroke="rgba(236,225,196,0.18)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          {/* Foot spot */}
          <circle
            cx={RAIL + 6 * UNIT}
            cy={RAIL + 2 * UNIT}
            r={2.5}
            fill="rgba(236,225,196,0.35)"
          />

          {/* Diamond markers on the rails */}
          {Array.from({ length: 7 }).map((_, i) => {
            const x = RAIL + (i + 1) * UNIT;
            return (
              <g key={`dx-${i}`}>
                <circle cx={x} cy={RAIL / 2} r={2} fill="#c9a24a" />
                <circle cx={x} cy={SVG_H - RAIL / 2} r={2} fill="#c9a24a" />
              </g>
            );
          })}
          {Array.from({ length: 3 }).map((_, i) => {
            const y = RAIL + (i + 1) * UNIT;
            return (
              <g key={`dy-${i}`}>
                <circle cx={RAIL / 2} cy={y} r={2} fill="#c9a24a" />
                <circle cx={SVG_W - RAIL / 2} cy={y} r={2} fill="#c9a24a" />
              </g>
            );
          })}

          {/* Pockets */}
          {(["TR", "BR", "TL", "BL", "MR", "ML"] as const).map((id) => {
            const p = toSvg(POCKETS[id]);
            return (
              <g key={id}>
                <circle cx={p.x} cy={p.y} r={POCKET_R} fill="#050505" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={POCKET_R}
                  fill="none"
                  stroke="rgba(201,162,74,0.45)"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}

          {sequence && sequence.length > 0 ? (
            <>
              {/* Per-step OB → pocket lines (dashed brass) */}
              {sequence.map((step, i) => (
                <PathLine
                  key={`seq-ob-${i}`}
                  start={step.ball}
                  waypoints={[POCKETS[step.pocket]]}
                  stroke="rgba(224,190,107,0.55)"
                  strokeWidth={1.6}
                  dash="6 6"
                />
              ))}
              {/* Continuous CB path through every step (solid cream dotted) */}
              <PathLine
                start={shot.cueBall}
                waypoints={(() => {
                  const pts: DiamondCoord[] = [];
                  let prev = shot.cueBall;
                  for (const step of sequence) {
                    pts.push(contactPoint(prev, step.ball));
                    pts.push(step.cueAfter);
                    prev = step.cueAfter;
                  }
                  return pts;
                })()}
                stroke="rgba(236,225,196,0.55)"
                strokeWidth={1.6}
                dash="2 5"
              />
            </>
          ) : (
            <>
              {/* OB path (dashed brass) */}
              {obFinalPath.length > 0 && (
                <PathLine
                  start={shot.objectBall}
                  waypoints={obFinalPath}
                  stroke="rgba(224,190,107,0.7)"
                  strokeWidth={2}
                  dash="6 6"
                />
              )}

              {/* CB path (solid cream) */}
              <PathLine
                start={shot.cueBall}
                waypoints={[contact, ...shot.cueBallPath]}
                stroke="rgba(236,225,196,0.75)"
                strokeWidth={2}
                dash="2 5"
              />

              {/* Direction arrows */}
              {obFinalPath.length > 0 && (
                <Arrow
                  from={obFinalPath[obFinalPath.length - 2] ?? shot.objectBall}
                  to={obFinalPath[obFinalPath.length - 1]}
                  fill="rgba(224,190,107,0.85)"
                />
              )}
              {shot.cueBallPath.length > 0 && (
                <Arrow
                  from={
                    shot.cueBallPath[shot.cueBallPath.length - 2] ?? contact
                  }
                  to={shot.cueBallPath[shot.cueBallPath.length - 1]}
                  fill="rgba(236,225,196,0.9)"
                />
              )}
            </>
          )}

          {/* Other balls on the table (static — multi-ball drill context, non-sequence shots only) */}
          {!sequence &&
            shot.otherBalls?.map((b, i) => {
              const p = toSvg(b);
              return (
                <g key={`other-${i}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={BALL_R}
                    fill="url(#ob-grad)"
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={0.8}
                    opacity={0.75}
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={BALL_R * 0.45}
                    fill="#fff"
                    opacity={0.75}
                  />
                </g>
              );
            })}

          {/* Sequence balls: numbered, future balls visible, pocketed balls hidden */}
          {sequence?.map((step, i) => {
            if (i < pocketedCount) return null; // already pocketed
            const isActive = i === activeStepIdx && progress > 0 && progress < 1;
            const pos = isActive ? obPos : step.ball;
            const p = toSvg(pos);
            const isUpcoming = i > activeStepIdx || progress <= 0;
            return (
              <g key={`seq-ball-${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={BALL_R}
                  fill="url(#ob-grad)"
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={0.8}
                  opacity={isUpcoming && i !== activeStepIdx ? 0.85 : 1}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={BALL_R * 0.6}
                  fill="rgba(255,255,255,0.92)"
                />
                <text
                  x={p.x}
                  y={p.y + 3}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={700}
                  fill="#1a0f06"
                  pointerEvents="none"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* Object ball (single-shot only) */}
          {!sequence && (
            <g>
              <circle
                cx={ob.x}
                cy={ob.y}
                r={BALL_R}
                fill="url(#ob-grad)"
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={0.8}
              />
              <circle cx={ob.x} cy={ob.y} r={BALL_R * 0.45} fill="#fff" />
            </g>
          )}

          {/* Cue ball */}
          <circle
            cx={cb.x}
            cy={cb.y}
            r={BALL_R}
            fill="url(#cb-grad)"
            stroke="rgba(0,0,0,0.45)"
            strokeWidth={0.8}
          />

          {/* Target pocket pulse */}
          {shot.targetPocket && !sequence && (
            <circle
              cx={toSvg(POCKETS[shot.targetPocket]).x}
              cy={toSvg(POCKETS[shot.targetPocket]).y}
              r={POCKET_R + 4}
              fill="none"
              stroke="rgba(232,82,72,0.6)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          )}
        </svg>
      </div>

      {shot.english && !preview && (
        <EnglishIndicator english={shot.english} />
      )}

      {interactive && !preview && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)] px-4 text-sm font-semibold tracking-wide text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)] hover:text-[var(--color-ink)]"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pause" : progress >= 1 ? "Replay" : "Play shot"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setProgress(0);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
            aria-label="Reset"
          >
            <RotateCcw size={14} />
          </button>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            onChange={(e) => {
              setPlaying(false);
              setProgress(Number(e.target.value) / 1000);
            }}
            className="flex-1 accent-[var(--color-brass-bright)]"
            aria-label="Shot progress"
          />
        </div>
      )}
    </div>
  );
}

function PathLine({
  start,
  waypoints,
  stroke,
  strokeWidth,
  dash,
}: {
  start: DiamondCoord;
  waypoints: DiamondCoord[];
  stroke: string;
  strokeWidth: number;
  dash?: string;
}) {
  if (waypoints.length === 0) return null;
  const points = [start, ...waypoints].map(toSvg);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  return (
    <path
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={dash}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Arrow({
  from,
  to,
  fill,
}: {
  from: DiamondCoord;
  to: DiamondCoord;
  fill: string;
}) {
  const a = toSvg(from);
  const b = toSvg(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  // Pull the tip back so it doesn't crash into the pocket / waypoint.
  const tipX = b.x - ux * 8;
  const tipY = b.y - uy * 8;
  const size = 9;
  const baseX = tipX - ux * size;
  const baseY = tipY - uy * size;
  const perpX = -uy;
  const perpY = ux;
  const p1x = baseX + perpX * size * 0.5;
  const p1y = baseY + perpY * size * 0.5;
  const p2x = baseX - perpX * size * 0.5;
  const p2y = baseY - perpY * size * 0.5;
  return (
    <polygon
      points={`${tipX},${tipY} ${p1x},${p1y} ${p2x},${p2y}`}
      fill={fill}
    />
  );
}

function englishLabel(e: EnglishHit): string {
  const v =
    e.y > 0.55 ? "High" : e.y > 0.15 ? "Above center" :
    e.y < -0.55 ? "Low" : e.y < -0.15 ? "Below center" :
    "";
  const h =
    e.x > 0.55 ? "right" : e.x > 0.15 ? "slight right" :
    e.x < -0.55 ? "left" : e.x < -0.15 ? "slight left" :
    "";
  if (!v && !h) return "Dead center";
  if (!h) return `${v} (center)`;
  if (!v) return `${h.charAt(0).toUpperCase()}${h.slice(1)} english`;
  return `${v} ${h}`;
}

function EnglishIndicator({ english }: { english: EnglishHit }) {
  const SIZE = 88;
  const R = 32;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  // Keep the hit dot inside the cue ball — max excursion 70% of the radius
  // so a small ring of white shows around the contact point.
  const HIT_REACH = R * 0.7;
  // SVG y-axis is flipped: positive english.y (follow/high) → smaller SVG y.
  const dotX = cx + english.x * HIT_REACH;
  const dotY = cy - english.y * HIT_REACH;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="shrink-0"
        role="img"
        aria-label={`Hit the cue ball at ${englishLabel(english)}`}
      >
        <defs>
          <radialGradient id="english-cb" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cfc7b0" />
          </radialGradient>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="url(#english-cb)"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth={1.2}
        />
        <line
          x1={cx - R}
          y1={cy}
          x2={cx + R}
          y2={cy}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth={0.6}
          strokeDasharray="2 2"
        />
        <line
          x1={cx}
          y1={cy - R}
          x2={cx}
          y2={cy + R}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth={0.6}
          strokeDasharray="2 2"
        />
        <circle
          cx={dotX}
          cy={dotY}
          r={5.5}
          fill="#e85248"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth={1}
        />
      </svg>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
          Hit the cue ball here
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--fg)]">
          {englishLabel(english)}
        </p>
        <p className="mt-0.5 text-[11px] leading-tight text-[var(--fg-dim)]">
          Red dot shows where your tip should contact the cue ball.
        </p>
      </div>
    </div>
  );
}
