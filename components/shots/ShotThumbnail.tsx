import type { KinisterShot } from "@/lib/kinister/shots";
import { POCKETS } from "@/lib/kinister/shots";
import {
  BALL_R,
  POCKET_R,
  RAIL,
  SURFACE_H,
  SURFACE_W,
  SVG_H,
  SVG_W,
  contactPoint,
  toSvg,
} from "@/lib/kinister/geometry";

/**
 * Compact, static "what does this shot look like" diagram. Same coord
 * system as PoolTable but stripped of gradients, diamonds, animation, and
 * the english indicator — designed to be cheap enough to render many at
 * once in the Dawg Drill builder catalog without slowing scroll.
 */
export function ShotThumbnail({
  shot,
  className,
}: {
  shot: KinisterShot;
  className?: string;
}) {
  const cb = toSvg(shot.cueBall);
  const ob = toSvg(shot.objectBall);
  const contact = contactPoint(shot.cueBall, shot.objectBall);

  // CB carom path: contact → each waypoint
  const cuePathPoints = [contact, ...shot.cueBallPath].map(toSvg);
  // CB approach line (start → contact)
  const approach = [toSvg(shot.cueBall), toSvg(contact)];
  // OB path (if a target pocket is set)
  const obPath: { x: number; y: number }[] | null = shot.targetPocket
    ? [ob, toSvg(POCKETS[shot.targetPocket])]
    : shot.objectBallPath
      ? [ob, ...shot.objectBallPath.map(toSvg)]
      : null;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`Setup preview: ${shot.name}`}
    >
      {/* Rail frame */}
      <rect
        x={0}
        y={0}
        width={SVG_W}
        height={SVG_H}
        rx={RAIL * 0.5}
        fill="#2a1808"
      />
      {/* Felt */}
      <rect
        x={RAIL}
        y={RAIL}
        width={SURFACE_W}
        height={SURFACE_H}
        fill="#0f3a2b"
      />
      {/* Pockets */}
      {(["TR", "BR", "TL", "BL", "MR", "ML"] as const).map((id) => {
        const p = toSvg(POCKETS[id]);
        return (
          <circle key={id} cx={p.x} cy={p.y} r={POCKET_R * 0.85} fill="#050505" />
        );
      })}

      {/* Approach line */}
      <PolyLine
        points={approach}
        stroke="rgba(236,225,196,0.45)"
        width={2}
        dash="2 5"
      />
      {/* CB carom path */}
      <PolyLine
        points={cuePathPoints}
        stroke="rgba(236,225,196,0.85)"
        width={2.5}
        dash="2 5"
      />
      {/* OB path */}
      {obPath && (
        <PolyLine
          points={obPath}
          stroke="rgba(224,190,107,0.85)"
          width={2.5}
          dash="6 6"
        />
      )}

      {/* Sequence shots: draw the rest of the rack balls */}
      {shot.sequence?.map((step, i) => {
        const p = toSvg(step.ball);
        return (
          <circle
            key={`seq-${i}`}
            cx={p.x}
            cy={p.y}
            r={BALL_R}
            fill="#e0a82e"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={0.8}
          />
        );
      })}

      {/* Other balls (static drill context) */}
      {shot.otherBalls?.map((b, i) => {
        const p = toSvg(b);
        return (
          <circle
            key={`oth-${i}`}
            cx={p.x}
            cy={p.y}
            r={BALL_R}
            fill="#e0a82e"
            opacity={0.65}
          />
        );
      })}

      {/* Object ball */}
      {!shot.sequence && (
        <g>
          <circle cx={ob.x} cy={ob.y} r={BALL_R} fill="#e0a82e" />
          <circle
            cx={ob.x}
            cy={ob.y}
            r={BALL_R}
            fill="none"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={0.8}
          />
        </g>
      )}

      {/* Cue ball */}
      <circle cx={cb.x} cy={cb.y} r={BALL_R} fill="#ece1c4" />
      <circle
        cx={cb.x}
        cy={cb.y}
        r={BALL_R}
        fill="none"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={0.8}
      />
    </svg>
  );
}

function PolyLine({
  points,
  stroke,
  width,
  dash,
}: {
  points: { x: number; y: number }[];
  stroke: string;
  width: number;
  dash?: string;
}) {
  if (points.length < 2) return null;
  const d = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
    )
    .join(" ");
  return (
    <path
      d={d}
      stroke={stroke}
      strokeWidth={width}
      strokeDasharray={dash}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

