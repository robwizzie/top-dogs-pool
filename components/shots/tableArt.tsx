import type { DiamondCoord, EnglishHit } from "@/lib/kinister/shots";
import { POCKETS } from "@/lib/kinister/shots";
import {
  POCKET_R,
  BALL_R,
  RAIL,
  SURFACE_H,
  SURFACE_W,
  SVG_H,
  SVG_W,
  UNIT,
  toSvg,
} from "@/lib/kinister/geometry";

/** Shared SVG pieces for the shot diagrams (scripted and physics). */
/**
 * Static table art shared by every diagram: gradients, rails, felt, head
 * string, foot spot, diamonds and pockets. Gradient ids are global to the
 * document, so every instance defines the same ones.
 */
export function TableSurface() {
  return (
    <>
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
    </>
  );
}

export function PathLine({
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

export function Arrow({
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

/**
 * Render the ghost-ball aim aid: a faint cue-ball outline at the ghost-ball
 * position (where the cue ball must be at impact to send the OB to the
 * pocket), plus a thin dotted line from the cue ball's starting position
 * through the ghost ball — the player's aim line.
 */
export function GhostBallAim({
  cueBall,
  ghost,
}: {
  cueBall: DiamondCoord;
  ghost: DiamondCoord;
}) {
  const cb = toSvg(cueBall);
  const g = toSvg(ghost);
  return (
    <g>
      <line
        x1={cb.x}
        y1={cb.y}
        x2={g.x}
        y2={g.y}
        stroke="rgba(255,255,255,0.32)"
        strokeWidth={1}
        strokeDasharray="3 5"
      />
      <circle
        cx={g.x}
        cy={g.y}
        r={BALL_R}
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={1.2}
        strokeDasharray="2 3"
      />
      <circle
        cx={g.x}
        cy={g.y}
        r={1.8}
        fill="rgba(255,255,255,0.65)"
      />
    </g>
  );
}

export function englishLabel(e: EnglishHit): string {
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

