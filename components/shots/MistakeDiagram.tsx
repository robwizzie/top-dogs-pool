import type { DiamondCoord, KinisterShot } from "@/lib/kinister/shots";
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
} from "@/lib/kinister/geometry";

/**
 * Small, static "what goes wrong" diagram. Shares the same coord system as
 * PoolTable but renders only the table + balls + a single tinted carom path
 * showing the bad outcome. No controls, no animation, no english indicator
 * — designed to sit alongside the good shot at half size.
 */
export function MistakeDiagram({
  shot,
  mistake,
}: {
  shot: KinisterShot;
  mistake: NonNullable<KinisterShot["mistakeDiagrams"]>[number];
}) {
  const contact = contactPoint(shot.cueBall, shot.objectBall);
  const cb = toSvg(shot.cueBall);
  const ob = toSvg(shot.objectBall);

  // Build the bad CB path: start → contact → mistake.cueBallPath waypoints
  const path = [shot.cueBall, contact, ...mistake.cueBallPath];

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-[var(--color-pop)]/30 bg-[var(--bg-card)]">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="block h-auto w-full"
        role="img"
        aria-label={`Mistake outcome: ${mistake.mistake}`}
      >
        <defs>
          <radialGradient id={`m-felt-${shot.id}`} cx="50%" cy="40%" r="80%">
            <stop offset="0%" stopColor="#1f6e3d" />
            <stop offset="100%" stopColor="#0a2a20" />
          </radialGradient>
          <linearGradient id={`m-rail-${shot.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2410" />
            <stop offset="100%" stopColor="#1a0f06" />
          </linearGradient>
          <radialGradient id={`m-cb-${shot.id}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cfc7b0" />
          </radialGradient>
          <radialGradient id={`m-ob-${shot.id}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fff8d8" />
            <stop offset="60%" stopColor="#e0a82e" />
            <stop offset="100%" stopColor="#7a5610" />
          </radialGradient>
        </defs>

        <rect
          x={0}
          y={0}
          width={SVG_W}
          height={SVG_H}
          rx={RAIL * 0.5}
          fill={`url(#m-rail-${shot.id})`}
        />
        <rect
          x={RAIL}
          y={RAIL}
          width={SURFACE_W}
          height={SURFACE_H}
          fill={`url(#m-felt-${shot.id})`}
        />

        {/* Diamond markers */}
        {Array.from({ length: 7 }).map((_, i) => {
          const x = RAIL + (i + 1) * UNIT;
          return (
            <g key={`dx-${i}`}>
              <circle cx={x} cy={RAIL / 2} r={1.4} fill="#c9a24a" />
              <circle cx={x} cy={SVG_H - RAIL / 2} r={1.4} fill="#c9a24a" />
            </g>
          );
        })}
        {Array.from({ length: 3 }).map((_, i) => {
          const y = RAIL + (i + 1) * UNIT;
          return (
            <g key={`dy-${i}`}>
              <circle cx={RAIL / 2} cy={y} r={1.4} fill="#c9a24a" />
              <circle cx={SVG_W - RAIL / 2} cy={y} r={1.4} fill="#c9a24a" />
            </g>
          );
        })}

        {/* Pockets */}
        {(["TR", "BR", "TL", "BL", "MR", "ML"] as const).map((id) => {
          const p = toSvg(POCKETS[id]);
          return (
            <circle
              key={id}
              cx={p.x}
              cy={p.y}
              r={POCKET_R}
              fill="#050505"
            />
          );
        })}

        {/* Tinted "bad" CB path */}
        <MistakePathLine points={path} />

        {/* Object ball */}
        <g>
          <circle cx={ob.x} cy={ob.y} r={BALL_R} fill={`url(#m-ob-${shot.id})`} />
          <circle
            cx={ob.x}
            cy={ob.y}
            r={BALL_R}
            fill="none"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={0.8}
          />
        </g>

        {/* Cue ball at start (so the diagram reads from CB → bad outcome) */}
        <circle cx={cb.x} cy={cb.y} r={BALL_R} fill={`url(#m-cb-${shot.id})`} />
        <circle
          cx={cb.x}
          cy={cb.y}
          r={BALL_R}
          fill="none"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth={0.8}
        />

        {/* Mark the end of the bad path with a faded "where it ends up" ball */}
        {(() => {
          const endPos = mistake.cueBallPath[mistake.cueBallPath.length - 1];
          if (!endPos) return null;
          const e = toSvg(endPos);
          return (
            <circle
              cx={e.x}
              cy={e.y}
              r={BALL_R}
              fill="none"
              stroke="rgba(232,82,72,0.85)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          );
        })()}
      </svg>
    </div>
  );
}

function MistakePathLine({ points }: { points: DiamondCoord[] }) {
  if (points.length < 2) return null;
  const pts = points.map(toSvg);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  return (
    <path
      d={d}
      stroke="rgba(232,82,72,0.85)"
      strokeWidth={2}
      strokeDasharray="3 5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
