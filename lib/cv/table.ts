/**
 * Table geometry shared by the AR tracker.
 *
 * Everything the tracker measures lives in *table space*: the same diamond
 * grid the shot catalog uses (x 0..8 head → foot rail, y 0..4 right → left
 * rail, seen by a player standing at the head rail). Camera pixels only
 * exist at the edges of the pipeline — a homography takes table space to
 * video pixels, and a "contain" transform takes video pixels to the CSS
 * pixels of the on-screen <video>.
 */

import type { PocketId } from "@/lib/kinister/shots";
import { POCKETS } from "@/lib/kinister/shots";

export type Pt = { x: number; y: number };

export type TableSize = 7 | 8 | 9;

/** Playing-surface length per diamond, by nominal table size. */
export const TABLE_SIZES: Record<TableSize, { label: string; inchesPerDiamond: number }> = {
  7: { label: "7 ft", inchesPerDiamond: 9.75 },
  8: { label: "8 ft", inchesPerDiamond: 11 },
  9: { label: "9 ft", inchesPerDiamond: 12.5 },
};

const BALL_DIAMETER_IN = 2.25;

/** Ball radius in diamonds for a given table size. */
export function ballRadius(size: TableSize): number {
  return BALL_DIAMETER_IN / 2 / TABLE_SIZES[size].inchesPerDiamond;
}

export const POCKET_IDS: readonly PocketId[] = ["TR", "TL", "BR", "BL", "MR", "ML"];

export function isCornerPocket(id: PocketId): boolean {
  return id !== "MR" && id !== "ML";
}

export function pocketName(id: PocketId): string {
  switch (id) {
    case "TR":
      return "head-right corner";
    case "TL":
      return "head-left corner";
    case "BR":
      return "foot-right corner";
    case "BL":
      return "foot-left corner";
    case "MR":
      return "right side pocket";
    case "ML":
      return "left side pocket";
  }
}

/** Where the camera sits relative to the table. */
export type CameraSide = "head" | "foot" | "right" | "left";

export const CAMERA_SIDES: { id: CameraSide; label: string }[] = [
  { id: "head", label: "Head rail" },
  { id: "foot", label: "Foot rail" },
  { id: "right", label: "Right rail" },
  { id: "left", label: "Left rail" },
];

/**
 * Table-space corners in screen order (near-right, near-left, far-left,
 * far-right) for a camera at the given side of the table.
 */
export function tableCornersFor(side: CameraSide): [Pt, Pt, Pt, Pt] {
  switch (side) {
    case "head":
      return [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 8, y: 4 }, { x: 8, y: 0 }];
    case "foot":
      return [{ x: 8, y: 4 }, { x: 8, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 4 }];
    case "right":
      return [{ x: 8, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 4 }, { x: 8, y: 4 }];
    case "left":
      return [{ x: 0, y: 4 }, { x: 8, y: 4 }, { x: 8, y: 0 }, { x: 0, y: 0 }];
  }
}

/**
 * Sort four screen points into near-right, near-left, far-left, far-right.
 * "Near" is lower on screen. Lets the player tap corners in any order.
 */
export function orderScreenCorners(pts: readonly Pt[]): [Pt, Pt, Pt, Pt] {
  const sorted = [...pts].sort((a, b) => b.y - a.y);
  const near = sorted.slice(0, 2).sort((a, b) => b.x - a.x);
  const far = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [near[0], near[1], far[0], far[1]];
}

/** Distance from a table point to the nearest cushion (0 on the cushion). */
export function cushionDistance(p: Pt): number {
  return Math.min(p.x, 8 - p.x, p.y, 4 - p.y);
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function nearestPocket(p: Pt): { id: PocketId; d: number } {
  let best: { id: PocketId; d: number } = { id: "TR", d: Infinity };
  for (const id of POCKET_IDS) {
    const d = dist(p, POCKETS[id]);
    if (d < best.d) best = { id, d };
  }
  return best;
}

/**
 * Radius around a pocket's table-space point inside which a ball that
 * disappears is considered to have dropped.
 */
export function pocketCaptureRadius(id: PocketId, r: number): number {
  return (isCornerPocket(id) ? 0.42 : 0.36) + r;
}

// ----- video ↔ display mapping -----

/**
 * The <video> renders with `object-fit: contain`, so the frame is scaled
 * uniformly and letterboxed. This captures that mapping so overlay
 * coordinates line up exactly with the pixels the tracker reads.
 */
export type ContainMap = { scale: number; ox: number; oy: number };

export function containMap(
  videoW: number,
  videoH: number,
  boxW: number,
  boxH: number,
): ContainMap {
  if (!videoW || !videoH || !boxW || !boxH) return { scale: 1, ox: 0, oy: 0 };
  const scale = Math.min(boxW / videoW, boxH / videoH);
  return {
    scale,
    ox: (boxW - videoW * scale) / 2,
    oy: (boxH - videoH * scale) / 2,
  };
}

export function videoToDisplay(m: ContainMap, p: Pt): Pt {
  return { x: m.ox + p.x * m.scale, y: m.oy + p.y * m.scale };
}

export function displayToVideo(m: ContainMap, p: Pt): Pt {
  return { x: (p.x - m.ox) / m.scale, y: (p.y - m.oy) / m.scale };
}
