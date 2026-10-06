/**
 * Synthetic camera for the AR tracker tests: a pool table rendered in
 * perspective with sensor noise, a lighting gradient, exposure drift, a
 * player's shadow and a cue stick, plus simple ball physics.
 */
import { computeHomography, invertHomography, applyHomography } from "@/lib/kinister/homography";
import { POCKETS } from "@/lib/kinister/shots";
import { ballRadius, tableCornersFor, type Pt } from "@/lib/cv/table";

export const FW = 640;
export const FH = 360;
export const R = ballRadius(7);
export const screen: [Pt, Pt, Pt, Pt] = [
  { x: 575, y: 312 },
  { x: 65, y: 312 },
  { x: 195, y: 62 },
  { x: 445, y: 62 },
];
export const Htf = computeHomography(tableCornersFor("head"), screen);
const Hft = invertHomography(Htf);

// Precompute table coords per frame pixel.
const tableAt: Pt[] = [];
for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) tableAt.push(applyHomography(Hft, { x: x + 0.5, y: y + 0.5 }));

export type Scene = {
  cue: Pt | null;
  obj: Pt | null;
  others?: Pt[];
  gain?: number;
  /** Cue stick tip position + direction it points (toward the CB). */
  stick?: { tip: Pt; dir: Pt } | null;
  shadow?: { c: Pt; rx: number; ry: number } | null;
};

let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// Static table (felt with a lighting gradient, cushions, rails, pockets).
const base = new Float32Array(FW * FH * 3);
for (let k = 0; k < FW * FH; k++) {
  const t = tableAt[k];
  let c: [number, number, number];
  const inTable = t.x >= -0.4 && t.x <= 8.4 && t.y >= -0.4 && t.y <= 4.4;
  if (!inTable) c = [52, 50, 56];
  else if (t.x < 0 || t.x > 8 || t.y < 0 || t.y > 4)
    c = t.x < -0.15 || t.x > 8.15 || t.y < -0.15 || t.y > 4.15 ? [92, 56, 30] : [30, 88, 58];
  else {
    const l = 0.82 + 0.18 * (t.x / 8);
    c = [38 * l, 112 * l, 72 * l];
  }
  for (const p of Object.values(POCKETS)) {
    if (Math.hypot(t.x - p.x, t.y - p.y) < 0.28) c = [14, 14, 14];
  }
  base.set(c, k * 3);
}

/** Pixel bounding box (frame space) of a table-space disc. */
function bbox(c: Pt, r: number) {
  const pts = [
    { x: c.x - r, y: c.y - r },
    { x: c.x + r, y: c.y - r },
    { x: c.x + r, y: c.y + r },
    { x: c.x - r, y: c.y + r },
  ].map((p) => applyHomography(Htf, p));
  return {
    x0: Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x))) - 1),
    x1: Math.min(FW - 1, Math.ceil(Math.max(...pts.map((p) => p.x))) + 1),
    y0: Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y))) - 1),
    y1: Math.min(FH - 1, Math.ceil(Math.max(...pts.map((p) => p.y))) + 1),
  };
}

export function render(s: Scene): Uint8ClampedArray {
  const img = base.slice();
  const paint = (c: Pt, r: number, fn: (k: number, t: Pt) => void) => {
    const b = bbox(c, r);
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const k = y * FW + x;
        fn(k, tableAt[k]);
      }
  };
  if (s.shadow) {
    const sh = s.shadow;
    paint(sh.c, Math.max(sh.rx, sh.ry), (k, t) => {
      const dx = (t.x - sh.c.x) / sh.rx;
      const dy = (t.y - sh.c.y) / sh.ry;
      if (dx * dx + dy * dy < 1) for (let i = 0; i < 3; i++) img[k * 3 + i] *= 0.68;
    });
  }
  const ball = (b: Pt | null | undefined, col: [number, number, number]) => {
    if (!b) return;
    paint(b, R, (k, t) => {
      const d = Math.hypot(t.x - b.x, t.y - b.y);
      if (d < R) {
        const shade = 1 - 0.25 * (d / R);
        img.set([col[0] * shade, col[1] * shade, col[2] * shade], k * 3);
      }
    });
  };
  ball(s.cue, [238, 236, 228]);
  ball(s.obj, [214, 40, 36]);
  for (const o of s.others ?? []) ball(o, [230, 190, 40]);
  if (s.stick) {
    const { tip, dir } = s.stick;
    const mid = { x: tip.x - dir.x * 1.5, y: tip.y - dir.y * 1.5 };
    paint(mid, 1.6, (k, t) => {
      const vx = t.x - tip.x;
      const vy = t.y - tip.y;
      const along = -(vx * dir.x + vy * dir.y);
      const perp = Math.abs(vx * -dir.y + vy * dir.x);
      if (along >= 0 && along < 3 && perp < 0.045 + along * 0.01) {
        img.set(along < 0.06 ? [240, 240, 235] : [196, 160, 112], k * 3);
      }
    });
  }
  const gain = s.gain ?? 1;
  const out = new Uint8ClampedArray(FW * FH * 4);
  for (let k = 0; k < FW * FH; k++) {
    const o = k * 4;
    out[o] = img[k * 3] * gain + (rand() - 0.5) * 12;
    out[o + 1] = img[k * 3 + 1] * gain + (rand() - 0.5) * 12;
    out[o + 2] = img[k * 3 + 2] * gain + (rand() - 0.5) * 12;
    out[o + 3] = 255;
  }
  return out;
}

export function cropOf(frame: Uint8ClampedArray, crop: { x: number; y: number; w: number; h: number }) {
  const out = new Uint8ClampedArray(crop.w * crop.h * 4);
  for (let y = 0; y < crop.h; y++) {
    const src = ((crop.y + y) * FW + crop.x) * 4;
    out.set(frame.subarray(src, src + crop.w * 4), y * crop.w * 4);
  }
  return out;
}

/** Simple physics: straight lines, linear deceleration, cushion bounces, pockets. */
export type Ball = { p: Pt; v: Pt; in: boolean };
export function stepBall(b: Ball, dt: number) {
  if (!b.in) return;
  const sp = Math.hypot(b.v.x, b.v.y);
  if (sp < 1e-3) return;
  const ns = Math.max(0, sp - 1.6 * dt);
  b.v = { x: (b.v.x / sp) * ns, y: (b.v.y / sp) * ns };
  b.p = { x: b.p.x + b.v.x * dt, y: b.p.y + b.v.y * dt };
  for (const pk of Object.values(POCKETS)) {
    if (Math.hypot(b.p.x - pk.x, b.p.y - pk.y) < 0.3) {
      b.in = false;
      return;
    }
  }
  if (b.p.x < R || b.p.x > 8 - R) {
    b.v.x = -b.v.x * 0.7;
    b.p.x = Math.min(8 - R, Math.max(R, b.p.x));
  }
  if (b.p.y < R || b.p.y > 4 - R) {
    b.v.y = -b.v.y * 0.7;
    b.p.y = Math.min(4 - R, Math.max(R, b.p.y));
  }
}

