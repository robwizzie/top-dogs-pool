/**
 * Per-frame vision for the AR shot tracker. No external libraries.
 *
 * Pipeline, every frame:
 *   1. Rectify: warp the table region of the camera frame into a top-down
 *      image (PPD pixels per diamond) through a precomputed lookup table.
 *      From here on a ball is the same size everywhere on the table and
 *      positions come out directly in diamonds.
 *   2. Exposure: phone cameras re-expose constantly (a player walking
 *      into frame is enough), so we estimate a global gain against the
 *      background before comparing.
 *   3. Foreground: compare against a background model of the empty table
 *      using brightness/chromaticity distortion, so cast shadows (darker,
 *      same hue) aren't mistaken for balls while white, coloured and black
 *      balls all are.
 *   4. Blobs: connected components of the foreground with area, centroid,
 *      extent and mean colour, for the tracker to associate with balls.
 *
 * Inputs are raw RGBA arrays so the whole thing runs (and is tested)
 * outside the browser.
 */

import { applyHomography, type Homography } from "@/lib/kinister/homography";
import { POCKETS } from "@/lib/kinister/shots";
import type { Pt } from "./table";

/**
 * Pocket mouths cut into the corners/sides of the playing surface. They
 * are modelled like the margin (copied from the image) rather than as
 * felt, or every pocket would look like a ball sitting on the table.
 */
const POCKET_MOUTH = 0.3;
const POCKET_PTS = Object.values(POCKETS);

export function inPocketMouth(p: Pt): boolean {
  return POCKET_PTS.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < POCKET_MOUTH);
}

/** Rectified resolution: pixels per diamond. */
export const PPD = 48;
/** Diamonds of margin beyond the cushions (pocket mouths, rail edge). */
export const MARGIN = 0.4;
export const RECT_W = Math.round((8 + 2 * MARGIN) * PPD);
export const RECT_H = Math.round((4 + 2 * MARGIN) * PPD);

export type RGB = [number, number, number];

export type Crop = { x: number; y: number; w: number; h: number };

export type Blob = {
  /** Centroid in table space (diamonds). */
  center: Pt;
  /** Pixel area in the rectified image. */
  area: number;
  /** Bounding-box size in rectified pixels. */
  w: number;
  h: number;
  /** Fraction of the bounding box covered by the blob. */
  fill: number;
  color: RGB;
  /** Bounding box corners in table space. */
  min: Pt;
  max: Pt;
};

export function toRect(p: Pt): Pt {
  return { x: (p.x + MARGIN) * PPD, y: (p.y + MARGIN) * PPD };
}

export function fromRect(p: Pt): Pt {
  return { x: p.x / PPD - MARGIN, y: p.y / PPD - MARGIN };
}

/** Low-chroma brightness — high for the cue ball, low for coloured balls. */
export function whiteness(c: RGB): number {
  const max = Math.max(c[0], c[1], c[2]);
  const min = Math.min(c[0], c[1], c[2]);
  return (c[0] + c[1] + c[2]) / 3 - 1.5 * (max - min);
}

export function colorDistance(a: RGB, b: RGB): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Bounding box (in processing-frame pixels) that a table-space → frame
 * homography covers, including the margin. Used to read only the part of
 * each frame the table occupies.
 */
export function tableCrop(H: Homography, frameW: number, frameH: number): Crop {
  const pts = [
    { x: -MARGIN, y: -MARGIN },
    { x: 8 + MARGIN, y: -MARGIN },
    { x: 8 + MARGIN, y: 4 + MARGIN },
    { x: -MARGIN, y: 4 + MARGIN },
  ].map((p) => applyHomography(H, p));
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x))));
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y))));
  const x1 = Math.min(frameW, Math.ceil(Math.max(...pts.map((p) => p.x))) + 1);
  const y1 = Math.min(frameH, Math.ceil(Math.max(...pts.map((p) => p.y))) + 1);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

export class TableVision {
  readonly W = RECT_W;
  readonly H = RECT_H;
  /** Ball radius in rectified pixels. */
  readonly ballPx: number;
  readonly ballArea: number;

  /** Rect pixel → byte offset into the crop's RGBA data (-1 = off-frame). */
  private readonly lut: Int32Array;
  /** 1 where the rect pixel is on the playing surface (pocket mouths excluded). */
  readonly interior: Uint8Array;

  readonly r: Uint8Array;
  readonly g: Uint8Array;
  readonly b: Uint8Array;
  private readonly bgR: Float32Array;
  private readonly bgG: Float32Array;
  private readonly bgB: Float32Array;
  private hasBg = false;
  /** Typical felt colour (median over the surface), for healing ghosts. */
  private felt: RGB = [40, 110, 70];
  /** Foreground mask for the current frame. */
  readonly fg: Uint8Array;
  /** Exposure gain of the current frame relative to the background. */
  gain = 1;

  private readonly labels: Int32Array;
  private readonly parent: Int32Array;
  blobs: Blob[] = [];

  constructor(
    /** Table space → processing-frame pixels. */
    H: Homography,
    /** Region of the processing frame that is handed to `ingest`. */
    readonly crop: Crop,
    /** Ball radius in diamonds. */
    ballRadius: number,
  ) {
    const n = this.W * this.H;
    this.lut = new Int32Array(n);
    this.interior = new Uint8Array(n);
    this.r = new Uint8Array(n);
    this.g = new Uint8Array(n);
    this.b = new Uint8Array(n);
    this.bgR = new Float32Array(n);
    this.bgG = new Float32Array(n);
    this.bgB = new Float32Array(n);
    this.fg = new Uint8Array(n);
    this.labels = new Int32Array(n);
    this.parent = new Int32Array(n);
    this.ballPx = ballRadius * PPD;
    this.ballArea = Math.PI * this.ballPx * this.ballPx;

    for (let j = 0; j < this.H; j++) {
      for (let i = 0; i < this.W; i++) {
        const k = j * this.W + i;
        const t = fromRect({ x: i + 0.5, y: j + 0.5 });
        if (t.x >= 0 && t.x <= 8 && t.y >= 0 && t.y <= 4 && !inPocketMouth(t)) this.interior[k] = 1;
        const p = applyHomography(H, t);
        const sx = Math.floor(p.x) - crop.x;
        const sy = Math.floor(p.y) - crop.y;
        this.lut[k] =
          sx >= 0 && sy >= 0 && sx < crop.w && sy < crop.h
            ? (sy * crop.w + sx) * 4
            : -1;
      }
    }
  }

  /** Process one frame (RGBA pixels of `crop`). */
  ingest(data: Uint8ClampedArray | Uint8Array): void {
    const n = this.W * this.H;
    const { lut, r, g, b } = this;
    for (let k = 0; k < n; k++) {
      const o = lut[k];
      if (o < 0) {
        r[k] = 0;
        g[k] = 0;
        b[k] = 0;
      } else {
        r[k] = data[o];
        g[k] = data[o + 1];
        b[k] = data[o + 2];
      }
    }
    if (!this.hasBg) this.initBackground();
    this.estimateGain();
    this.computeForeground();
    this.findBlobs();
  }

  /**
   * Seed the background from the current frame. The playing surface is
   * modelled as a smooth field of per-cell medians (so balls sitting on
   * the table at calibration don't end up "in" the background); the
   * margin — pockets, cushions — is copied as-is.
   */
  private initBackground(): void {
    const CELL = Math.round(PPD / 2);
    const cols = Math.ceil(this.W / CELL);
    const rows = Math.ceil(this.H / CELL);
    const cellR = new Float32Array(cols * rows);
    const cellG = new Float32Array(cols * rows);
    const cellB = new Float32Array(cols * rows);
    const cellOk = new Uint8Array(cols * rows);
    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        rs.length = gs.length = bs.length = 0;
        for (let j = cy * CELL; j < Math.min(this.H, (cy + 1) * CELL); j++) {
          for (let i = cx * CELL; i < Math.min(this.W, (cx + 1) * CELL); i++) {
            const k = j * this.W + i;
            if (!this.interior[k] || this.lut[k] < 0) continue;
            rs.push(this.r[k]);
            gs.push(this.g[k]);
            bs.push(this.b[k]);
          }
        }
        if (rs.length < 8) continue;
        const c = cy * cols + cx;
        cellR[c] = median(rs);
        cellG[c] = median(gs);
        cellB[c] = median(bs);
        cellOk[c] = 1;
      }
    }
    {
      const okR: number[] = [];
      const okG: number[] = [];
      const okB: number[] = [];
      for (let c = 0; c < cols * rows; c++) {
        if (!cellOk[c]) continue;
        okR.push(cellR[c]);
        okG.push(cellG[c]);
        okB.push(cellB[c]);
      }
      if (okR.length) this.felt = [median(okR), median(okG), median(okB)];
    }
    // Fill cells with no interior pixels from their nearest valid neighbour.
    for (let pass = 0; pass < cols + rows; pass++) {
      let missing = 0;
      for (let c = 0; c < cols * rows; c++) {
        if (cellOk[c]) continue;
        missing++;
        const cx = c % cols;
        const cy = Math.floor(c / cols);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const nc = ny * cols + nx;
          if (cellOk[nc] !== 1) continue;
          cellR[c] = cellR[nc];
          cellG[c] = cellG[nc];
          cellB[c] = cellB[nc];
          cellOk[c] = 2;
          break;
        }
      }
      for (let c = 0; c < cols * rows; c++) if (cellOk[c] === 2) cellOk[c] = 1;
      if (missing === 0) break;
    }
    for (let j = 0; j < this.H; j++) {
      for (let i = 0; i < this.W; i++) {
        const k = j * this.W + i;
        if (!this.interior[k]) {
          this.bgR[k] = this.r[k];
          this.bgG[k] = this.g[k];
          this.bgB[k] = this.b[k];
          continue;
        }
        // Bilinear between cell centres.
        const fx = Math.min(cols - 1, Math.max(0, (i + 0.5) / CELL - 0.5));
        const fy = Math.min(rows - 1, Math.max(0, (j + 0.5) / CELL - 0.5));
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = Math.min(cols - 1, x0 + 1);
        const y1 = Math.min(rows - 1, y0 + 1);
        const tx = fx - x0;
        const ty = fy - y0;
        const c00 = y0 * cols + x0;
        const c10 = y0 * cols + x1;
        const c01 = y1 * cols + x0;
        const c11 = y1 * cols + x1;
        const lerp2 = (a: Float32Array) =>
          (a[c00] * (1 - tx) + a[c10] * tx) * (1 - ty) +
          (a[c01] * (1 - tx) + a[c11] * tx) * ty;
        this.bgR[k] = lerp2(cellR);
        this.bgG[k] = lerp2(cellG);
        this.bgB[k] = lerp2(cellB);
      }
    }
    this.hasBg = true;
  }

  /** Throw the background away; it is rebuilt from the next frame. */
  resetBackground(): void {
    this.hasBg = false;
  }

  private estimateGain(): void {
    let num = 0;
    let den = 0;
    const n = this.W * this.H;
    for (let k = 0; k < n; k += 13) {
      if (!this.interior[k] || this.fg[k] || this.lut[k] < 0) continue;
      const f = this.r[k] + this.g[k] + this.b[k];
      const bg = this.bgR[k] + this.bgG[k] + this.bgB[k];
      if (bg < 30) continue;
      const ratio = f / bg;
      // Trim: big changes are foreground, not exposure.
      if (ratio < 0.6 / this.gain || ratio > 1.6 / this.gain) continue;
      num += f;
      den += bg;
    }
    this.gain = den > 0 ? Math.min(2, Math.max(0.5, num / den)) : 1;
  }

  private computeForeground(): void {
    const n = this.W * this.H;
    const gain = this.gain;
    for (let k = 0; k < n; k++) {
      if (this.lut[k] < 0) {
        this.fg[k] = 0;
        continue;
      }
      const cr = this.r[k];
      const cg = this.g[k];
      const cb = this.b[k];
      const br = this.bgR[k] * gain;
      const bgc = this.bgG[k] * gain;
      const bb = this.bgB[k] * gain;
      const dr = cr - br;
      const dg = cg - bgc;
      const db = cb - bb;
      const absDiff = Math.sqrt(dr * dr + dg * dg + db * db);
      if (absDiff < 20) {
        this.fg[k] = 0;
        continue;
      }
      // Brightness distortion α and chromaticity distortion CD
      // (Horprasert et al.): a shadow scales the background colour
      // (α < 1, small CD); a ball changes its hue or brightens it.
      const bn = br * br + bgc * bgc + bb * bb + 1;
      const alpha = (cr * br + cg * bgc + cb * bb) / bn;
      const er = cr - alpha * br;
      const eg = cg - alpha * bgc;
      const eb = cb - alpha * bb;
      const cd = Math.sqrt(er * er + eg * eg + eb * eb);
      const bgMag = Math.sqrt(bn);
      const isFg = cd > 10 + 0.09 * bgMag || alpha > 1.3 || alpha < 0.38;
      this.fg[k] = isFg ? 1 : 0;
    }
  }

  /**
   * Blend the current frame into the background wherever nothing is
   * happening, so lighting drift and table markings fade out of the
   * foreground. Foreground pixels that now look like plain felt (a shadow
   * or hand that was in the first frame and has since left) heal at
   * `healRate`. `protect` discs (table space) are left alone.
   */
  adapt(rate: number, protect: { center: Pt; r: number }[] = [], healRate = 0.2): void {
    const n = this.W * this.H;
    const keep = this.labels; // reuse as scratch: 1 = protected
    keep.fill(0);
    for (const d of protect) {
      const c = toRect(d.center);
      const rp = d.r * PPD;
      const i0 = Math.max(0, Math.floor(c.x - rp));
      const i1 = Math.min(this.W - 1, Math.ceil(c.x + rp));
      const j0 = Math.max(0, Math.floor(c.y - rp));
      const j1 = Math.min(this.H - 1, Math.ceil(c.y + rp));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = i + 0.5 - c.x;
          const dy = j + 0.5 - c.y;
          if (dx * dx + dy * dy <= rp * rp) keep[j * this.W + i] = 1;
        }
      }
    }
    const [fr, fgc, fb] = this.felt;
    const fn = fr * fr + fgc * fgc + fb * fb + 1;
    const fMag = Math.sqrt(fn);
    for (let k = 0; k < n; k++) {
      if (keep[k] || this.lut[k] < 0) continue;
      let a = rate;
      if (this.fg[k]) {
        if (!this.interior[k]) continue;
        // Felt-like: same chromaticity as the felt at any brightness.
        const cr = this.r[k];
        const cg = this.g[k];
        const cb = this.b[k];
        const alpha = (cr * fr + cg * fgc + cb * fb) / fn;
        if (alpha < 0.45 || alpha > 1.8) continue;
        const er = cr - alpha * fr;
        const eg = cg - alpha * fgc;
        const eb = cb - alpha * fb;
        if (Math.sqrt(er * er + eg * eg + eb * eb) > 8 + 0.1 * fMag * alpha) continue;
        a = healRate;
      }
      this.bgR[k] += a * (this.r[k] - this.bgR[k]);
      this.bgG[k] += a * (this.g[k] - this.bgG[k]);
      this.bgB[k] += a * (this.b[k] - this.bgB[k]);
    }
  }

  /**
   * Hard-reset the background to the current frame everywhere except
   * the given discs and existing foreground. Called when a shot is armed:
   * at that moment the only things on the felt should be the balls.
   */
  absorb(protect: { center: Pt; r: number }[]): void {
    this.adapt(1, protect, 1);
    this.computeForeground();
    this.findBlobs();
  }

  /** Connected components (4-connectivity) of the foreground mask. */
  private findBlobs(): void {
    const { W, H, fg, labels, parent } = this;
    const n = W * H;
    for (let k = 0; k < n; k++) {
      labels[k] = -1;
    }
    let next = 0;
    const find = (x: number) => {
      let root = x;
      while (parent[root] !== root) root = parent[root];
      while (parent[x] !== root) {
        const nx = parent[x];
        parent[x] = root;
        x = nx;
      }
      return root;
    };
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (!fg[k]) continue;
        const left = i > 0 && fg[k - 1] ? labels[k - 1] : -1;
        const up = j > 0 && fg[k - W] ? labels[k - W] : -1;
        if (left < 0 && up < 0) {
          parent[next] = next;
          labels[k] = next++;
        } else if (left >= 0 && up >= 0) {
          const a = find(left);
          const b = find(up);
          if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
          labels[k] = Math.min(a, b);
        } else {
          labels[k] = left >= 0 ? left : up;
        }
      }
    }
    type Acc = {
      n: number;
      sx: number;
      sy: number;
      sr: number;
      sg: number;
      sb: number;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
    const acc = new Map<number, Acc>();
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (labels[k] < 0) continue;
        const root = find(labels[k]);
        labels[k] = root;
        let a = acc.get(root);
        if (!a) {
          a = { n: 0, sx: 0, sy: 0, sr: 0, sg: 0, sb: 0, x0: i, y0: j, x1: i, y1: j };
          acc.set(root, a);
        }
        a.n++;
        a.sx += i + 0.5;
        a.sy += j + 0.5;
        a.sr += this.r[k];
        a.sg += this.g[k];
        a.sb += this.b[k];
        if (i < a.x0) a.x0 = i;
        if (i > a.x1) a.x1 = i;
        if (j < a.y0) a.y0 = j;
        if (j > a.y1) a.y1 = j;
      }
    }
    const minArea = Math.max(4, this.ballArea * 0.3);
    const blobs: Blob[] = [];
    for (const a of acc.values()) {
      if (a.n < minArea) continue;
      const w = a.x1 - a.x0 + 1;
      const h = a.y1 - a.y0 + 1;
      blobs.push({
        center: fromRect({ x: a.sx / a.n, y: a.sy / a.n }),
        area: a.n,
        w,
        h,
        fill: a.n / (w * h),
        color: [a.sr / a.n, a.sg / a.n, a.sb / a.n],
        min: fromRect({ x: a.x0, y: a.y0 }),
        max: fromRect({ x: a.x1 + 1, y: a.y1 + 1 }),
      });
    }
    this.blobs = blobs;
  }

  /**
   * Mean-shift a ball-sized window towards the foreground mass that looks
   * like `color`. Used to pull a ball's position off a blob it shares with
   * a hand or the cue tip. Returns the refined centre and how much of the
   * disc is covered (0..1).
   */
  refine(start: Pt, color: RGB | null): { center: Pt; coverage: number } {
    let c = toRect(start);
    const rp = this.ballPx * 1.15;
    let coverage = 0;
    for (let iter = 0; iter < 5; iter++) {
      let sw = 0;
      let sx = 0;
      let sy = 0;
      let count = 0;
      const i0 = Math.max(0, Math.floor(c.x - rp));
      const i1 = Math.min(this.W - 1, Math.ceil(c.x + rp));
      const j0 = Math.max(0, Math.floor(c.y - rp));
      const j1 = Math.min(this.H - 1, Math.ceil(c.y + rp));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = i + 0.5 - c.x;
          const dy = j + 0.5 - c.y;
          if (dx * dx + dy * dy > rp * rp) continue;
          count++;
          const k = j * this.W + i;
          if (!this.fg[k]) continue;
          let w = 1;
          if (color) {
            const d = colorDistance([this.r[k], this.g[k], this.b[k]], color);
            w = 0.25 + 0.75 * Math.exp(-(d * d) / (2 * 55 * 55));
          }
          sw += w;
          sx += w * (i + 0.5);
          sy += w * (j + 0.5);
        }
      }
      if (sw === 0) return { center: fromRect(c), coverage: 0 };
      const nc = { x: sx / sw, y: sy / sw };
      coverage = count > 0 ? sw / count : 0;
      const moved = Math.hypot(nc.x - c.x, nc.y - c.y);
      c = nc;
      if (moved < 0.2) break;
    }
    return { center: fromRect(c), coverage };
  }

  /** Mean colour of the foreground inside a disc (table space). */
  sampleColor(center: Pt, radius: number): RGB | null {
    const c = toRect(center);
    const rp = radius * PPD;
    let n = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let j = Math.max(0, Math.floor(c.y - rp)); j <= Math.min(this.H - 1, Math.ceil(c.y + rp)); j++) {
      for (let i = Math.max(0, Math.floor(c.x - rp)); i <= Math.min(this.W - 1, Math.ceil(c.x + rp)); i++) {
        const dx = i + 0.5 - c.x;
        const dy = j + 0.5 - c.y;
        if (dx * dx + dy * dy > rp * rp) continue;
        const k = j * this.W + i;
        if (!this.fg[k]) continue;
        n++;
        sr += this.r[k];
        sg += this.g[k];
        sb += this.b[k];
      }
    }
    return n > 0 ? [sr / n, sg / n, sb / n] : null;
  }

  /** Fraction of a disc (table space) that is foreground. */
  coverage(center: Pt, radius: number): number {
    const c = toRect(center);
    const rp = radius * PPD;
    let n = 0;
    let f = 0;
    for (let j = Math.max(0, Math.floor(c.y - rp)); j <= Math.min(this.H - 1, Math.ceil(c.y + rp)); j++) {
      for (let i = Math.max(0, Math.floor(c.x - rp)); i <= Math.min(this.W - 1, Math.ceil(c.x + rp)); i++) {
        const dx = i + 0.5 - c.x;
        const dy = j + 0.5 - c.y;
        if (dx * dx + dy * dy > rp * rp) continue;
        n++;
        if (this.fg[j * this.W + i]) f++;
      }
    }
    return n > 0 ? f / n : 0;
  }

  /** Write the rectified frame with the foreground tinted, for debugging. */
  renderDebug(out: Uint8ClampedArray): void {
    const n = this.W * this.H;
    for (let k = 0; k < n; k++) {
      const o = k * 4;
      if (this.fg[k]) {
        out[o] = 255;
        out[o + 1] = 60 + this.g[k] * 0.4;
        out[o + 2] = 200;
      } else {
        out[o] = this.r[k] * 0.55;
        out[o + 1] = this.g[k] * 0.55;
        out[o + 2] = this.b[k] * 0.55;
      }
      out[o + 3] = 255;
    }
  }
}

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
