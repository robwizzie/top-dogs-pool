import type { DiamondCoord, PocketId } from "./shots";
import { POCKETS } from "./shots";

/**
 * Pool-table SVG geometry.
 *
 * The playing surface is 8 diamonds long × 4 diamonds wide. We render it at
 * 100 SVG units per diamond → 800 × 400. The rail frame adds RAIL_THICKNESS
 * around the surface. SVG origin (0,0) sits at the outer top-left corner.
 *
 * In viewer-space we put the head rail on the LEFT and the foot rail on
 * the RIGHT — i.e. shoot left-to-right. Diamond coord (x, y) → SVG
 * (RAIL + x * UNIT, RAIL + y * UNIT).
 */

export const UNIT = 100;
export const RAIL = 38;
export const SURFACE_W = 8 * UNIT;
export const SURFACE_H = 4 * UNIT;
export const SVG_W = SURFACE_W + RAIL * 2;
export const SVG_H = SURFACE_H + RAIL * 2;

export const BALL_R = 14;
export const POCKET_R = 22;

export function toSvg(p: DiamondCoord): { x: number; y: number } {
  return {
    x: RAIL + p.x * UNIT,
    y: RAIL + p.y * UNIT,
  };
}

export function pocketCoord(id: PocketId): DiamondCoord {
  return POCKETS[id];
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPoint(
  a: DiamondCoord,
  b: DiamondCoord,
  t: number,
): DiamondCoord {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/**
 * Total length of a polyline through `points`, in diamond units.
 */
export function pathLength(points: DiamondCoord[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.hypot(dx, dy);
  }
  return len;
}

/**
 * Cubic ease-out. Starts fast, decelerates smoothly to rest — matches how
 * a pool ball decelerates from friction once it leaves the cue tip.
 */
export function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

/**
 * Walk a polyline (start → waypoints) by a fractional progress in [0, 1],
 * weighted by segment length so motion is at constant speed.
 */
export function walkPath(
  start: DiamondCoord,
  waypoints: DiamondCoord[],
  t: number,
): DiamondCoord {
  if (waypoints.length === 0) return start;
  const points = [start, ...waypoints];
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const len = Math.hypot(dx, dy);
    segLengths.push(len);
    total += len;
  }
  if (total === 0) return start;
  const target = Math.max(0, Math.min(1, t)) * total;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    if (acc + segLengths[i] >= target) {
      const local = (target - acc) / segLengths[i];
      return lerpPoint(points[i], points[i + 1], local);
    }
    acc += segLengths[i];
  }
  return points[points.length - 1];
}

/**
 * Contact point a ball-diameter back along the line from CB to OB.
 * We use this so the cue ball visually "touches" the object ball rather
 * than overlapping it during the animation.
 */
export function contactPoint(
  cue: DiamondCoord,
  ob: DiamondCoord,
): DiamondCoord {
  const dx = cue.x - ob.x;
  const dy = cue.y - ob.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return cue;
  // ball diameter in diamond units ≈ 2 * BALL_R / UNIT
  const offset = (2 * BALL_R) / UNIT;
  return {
    x: ob.x + (dx / dist) * offset,
    y: ob.y + (dy / dist) * offset,
  };
}
