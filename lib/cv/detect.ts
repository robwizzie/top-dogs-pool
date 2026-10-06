import { computeHomography, applyHomography } from "@/lib/kinister/homography";
import type { Pt } from "./table";

/**
 * The felt outline we find is the back edge of the cushion cloth, not
 * the cushion nose that bounds the playing surface (and that the diamond
 * grid is measured from). A cushion is roughly two inches wide.
 */
const CUSHION_DIAMONDS = 0.17;

/**
 * Auto-detection of the table outline for AR calibration. Avoids dragging
 * in OpenCV.js (~4MB wasm): the felt is the dominant single-colour region
 * in any pool-table shot, so a colour mask + connected components +
 * convex hull gets us the four corners.
 */

type Point = Pt;

/**
 * Auto-detect the four corner pockets of the table.
 *
 * Strategy: find the felt (the largest single-color region) and take its
 * bounding quadrilateral. The felt is the dominant continuous color
 * region in any pool-table photo — much more robust than looking for
 * dark blobs, which gets confused by shadows, clothing, the scoreboard,
 * or anything else dark in the room.
 *
 * Steps:
 *   1. Sample the assumed felt color from the median of 9 points
 *      spread across the frame (handles uneven lighting + center
 *      markings).
 *   2. Mask every pixel within colorDistance of that felt color.
 *   3. Union-find to identify connected felt regions.
 *   4. Keep only the largest — if it's at least 20% of the frame, we
 *      almost certainly have the table.
 *   5. Extract the boundary pixels of that region.
 *   6. Convex hull of the boundary, then iteratively simplify down to
 *      the 4 corners by removing the most-colinear vertex each pass.
 *   7. Order: near-right, near-left, far-left, far-right.
 *
 * Returns null if no confident table-shaped felt region is found.
 */
export function detectCornerPockets(image: ImageData): Point[] | null {
  const outer = detectFeltOutline(image);
  if (!outer) return null;
  // Map the outline onto a table expanded by the cushion width, then read
  // off where the real playing-surface corners fall. Perspective-correct,
  // and the same for any camera side since the inset is symmetric.
  const c = CUSHION_DIAMONDS;
  const inner: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: 0, y: 4 },
    { x: 8, y: 4 },
    { x: 8, y: 0 },
  ];
  const expanded = inner.map((p) => ({
    x: p.x === 0 ? -c : 8 + c,
    y: p.y === 0 ? -c : 4 + c,
  })) as [Point, Point, Point, Point];
  try {
    const H = computeHomography(expanded, outer as [Point, Point, Point, Point]);
    return inner.map((p) => applyHomography(H, p));
  } catch {
    return outer;
  }
}

function detectFeltOutline(image: ImageData): Point[] | null {
  const { width, height } = image;

  // (1) Establish felt reference from the whole frame.
  const feltColor = medianFeltSample(image);

  // (2) Mask felt pixels by chromaticity: same hue as the felt at any
  // reasonable brightness, so the shaded end of the table and the cushion
  // cloth count, while a grey floor or a brown rail (close in raw RGB
  // distance to dark felt) doesn't.
  const total = width * height;
  const mask = new Uint8Array(total);
  const [fr, fg, fb] = feltColor;
  const fn = fr * fr + fg * fg + fb * fb + 1;
  const fMag = Math.sqrt(fn);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = image.data[i];
      const g = image.data[i + 1];
      const b = image.data[i + 2];
      const alpha = (r * fr + g * fg + b * fb) / fn;
      if (alpha < 0.45 || alpha > 1.8) continue;
      const er = r - alpha * fr;
      const eg = g - alpha * fg;
      const eb = b - alpha * fb;
      if (Math.sqrt(er * er + eg * eg + eb * eb) < 8 + 0.2 * fMag * alpha) mask[y * width + x] = 1;
    }
  }

  // (3) Largest connected felt region.
  const largest = largestConnectedComponent(mask, width, height);
  if (!largest) return null;
  if (largest.size < 0.18 * total) return null; // table not dominant in frame

  // (5) Boundary pixels of the largest felt region.
  const boundary: Point[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!largest.mask[i]) continue;
      // Boundary if any 4-neighbor is NOT in the region.
      if (
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        !largest.mask[i - 1] ||
        !largest.mask[i + 1] ||
        !largest.mask[i - width] ||
        !largest.mask[i + width]
      ) {
        boundary.push({ x, y });
      }
    }
  }
  if (boundary.length < 20) return null;

  // (6) Convex hull → simplify to 4 vertices by removing
  // most-colinear vertices iteratively.
  const hull = convexHull(boundary);
  if (hull.length < 4) return null;
  let corners = hull.slice();
  while (corners.length > 4) {
    let mostColinearIdx = 0;
    let mostColinearAngle = -Infinity;
    for (let i = 0; i < corners.length; i++) {
      const prev = corners[(i - 1 + corners.length) % corners.length];
      const cur = corners[i];
      const next = corners[(i + 1) % corners.length];
      const a = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      const b = Math.hypot(next.x - cur.x, next.y - cur.y);
      const c = Math.hypot(next.x - prev.x, next.y - prev.y);
      if (a < 1e-3 || b < 1e-3) {
        // Degenerate — remove immediately.
        mostColinearAngle = Infinity;
        mostColinearIdx = i;
        break;
      }
      const cos = Math.max(
        -1,
        Math.min(1, (a * a + b * b - c * c) / (2 * a * b)),
      );
      const angle = Math.acos(cos);
      if (angle > mostColinearAngle) {
        mostColinearAngle = angle;
        mostColinearIdx = i;
      }
    }
    corners = corners.filter((_, i) => i !== mostColinearIdx);
  }
  if (corners.length !== 4) return null;
  const fitted = quadFromHull(hull);
  if (fitted && quadArea(fitted as [Point, Point, Point, Point]) > 0.8 * quadArea(corners as [Point, Point, Point, Point])) {
    corners = fitted;
  }

  // (7) Final sanity: quad must cover a reasonable fraction of the frame.
  const area = quadArea(corners as [Point, Point, Point, Point]);
  if (area < 0.1 * width * height) return null;

  return orderCornersForCalibration(
    corners as [Point, Point, Point, Point],
  );
}

/**
 * Find the largest connected component in a binary mask. Returns the
 * mask of just that component plus its pixel count, or null if empty.
 */
function largestConnectedComponent(
  mask: Uint8Array,
  width: number,
  height: number,
): { mask: Uint8Array; size: number } | null {
  const total = width * height;
  const uf = new UnionFind(total);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      if (x > 0 && mask[i - 1]) uf.union(i, i - 1);
      if (y > 0 && mask[i - width]) uf.union(i, i - width);
    }
  }
  const sizes = new Map<number, number>();
  for (let i = 0; i < total; i++) {
    if (!mask[i]) continue;
    const r = uf.find(i);
    sizes.set(r, (sizes.get(r) ?? 0) + 1);
  }
  if (sizes.size === 0) return null;
  let bestRoot = -1;
  let bestSize = 0;
  for (const [r, s] of sizes) {
    if (s > bestSize) {
      bestSize = s;
      bestRoot = r;
    }
  }
  if (bestRoot === -1) return null;
  const out = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (mask[i] && uf.find(i) === bestRoot) out[i] = 1;
  }
  return { mask: out, size: bestSize };
}

/**
 * Order four pocket-corner points in the same sequence the manual
 * calibration uses: near-right, near-left, far-left, far-right —
 * clockwise from the player at the head (bottom of the frame).
 */
function orderCornersForCalibration(
  pts: [Point, Point, Point, Point],
): Point[] {
  // Split into near (higher y, lower on screen) and far (lower y).
  const sorted = [...pts].sort((a, b) => b.y - a.y);
  const near = sorted.slice(0, 2);
  const far = sorted.slice(2, 4);
  // Right = larger x; left = smaller x.
  near.sort((a, b) => b.x - a.x); // [near-right, near-left]
  far.sort((a, b) => a.x - b.x); // [far-left, far-right]
  return [near[0], near[1], far[0], far[1]];
}

/**
 * Andrew's monotone chain — standard convex-hull algorithm, O(n log n).
 * Returns vertices in counter-clockwise order.
 */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points.slice();
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Point[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function quadArea(q: [Point, Point, Point, Point]): number {
  const [a, b, c, d] = q;
  return (
    0.5 *
    Math.abs(
      a.x * b.y -
        b.x * a.y +
        b.x * c.y -
        c.x * b.y +
        c.x * d.y -
        d.x * c.y +
        d.x * a.y -
        a.x * d.y,
    )
  );
}

// ----- helpers -----

class UnionFind {
  private parent: Int32Array;
  private rank: Uint8Array;
  constructor(n: number) {
    this.parent = new Int32Array(n);
    this.rank = new Uint8Array(n);
    for (let i = 0; i < n; i++) this.parent[i] = i;
  }
  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    // Path compression.
    let cur = x;
    while (this.parent[cur] !== root) {
      const next = this.parent[cur];
      this.parent[cur] = root;
      cur = next;
    }
    return root;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else {
      this.parent[rb] = ra;
      this.rank[ra] += 1;
    }
  }
}

/**
 * Sample 9 points spread around the frame centre and return the median
 * R/G/B per channel. The median shrugs off the centre spot, a chalk
 * smudge, a ball near a sample point, and half-lit tables.
 */
function medianFeltSample(image: ImageData): [number, number, number] {
  const cx = image.width / 2;
  const cy = image.height / 2;
  const r = Math.min(image.width, image.height) * 0.2;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (const dx of [-r, 0, r]) {
    for (const dy of [-r, 0, r]) {
      const [cr, cg, cb] = meanColor(image, { x: cx + dx, y: cy + dy }, 8);
      rs.push(cr);
      gs.push(cg);
      bs.push(cb);
    }
  }
  return [median(rs), median(gs), median(bs)];
}

function meanColor(image: ImageData, c: Point, radius: number): [number, number, number] {
  let n = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let y = Math.max(0, Math.floor(c.y - radius)); y <= Math.min(image.height - 1, c.y + radius); y++) {
    for (let x = Math.max(0, Math.floor(c.x - radius)); x <= Math.min(image.width - 1, c.x + radius); x++) {
      const i = (y * image.width + x) * 4;
      r += image.data[i];
      g += image.data[i + 1];
      b += image.data[i + 2];
      n++;
    }
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[m - 1] + sorted[m]) / 2
    : sorted[m];
}

/**
 * The pocket cut-outs chamfer the felt's corners, so its convex hull is
 * roughly an octagon. Merge consecutive hull edges that run in the same
 * direction, keep the four longest runs (the rails), fit a line to each
 * and intersect neighbours — that lands on the true corners of the cloth
 * rather than on a chamfer.
 */
function quadFromHull(hull: Point[]): Point[] | null {
  const n = hull.length;
  if (n < 4) return null;
  type Run = { pts: Point[]; len: number; dir: number; start: number };
  const angle = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);
  const diff = (a: number, b: number) => {
    let d = Math.abs(a - b) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  };
  const MAX_TURN = (10 * Math.PI) / 180;
  // Start at the sharpest turn so no run straddles the starting point.
  let start = 0;
  let sharpest = -1;
  for (let i = 0; i < n; i++) {
    const t = diff(angle(hull[(i - 1 + n) % n], hull[i]), angle(hull[i], hull[(i + 1) % n]));
    if (t > sharpest) {
      sharpest = t;
      start = i;
    }
  }
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    const a = hull[i];
    const b = hull[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dir = angle(a, b);
    if (cur && diff(dir, cur.dir) < MAX_TURN) {
      cur.pts.push(b);
      // Length-weighted running direction.
      const total = cur.len + len;
      const vx = Math.cos(cur.dir) * cur.len + Math.cos(dir) * len;
      const vy = Math.sin(cur.dir) * cur.len + Math.sin(dir) * len;
      cur.dir = Math.atan2(vy, vx);
      cur.len = total;
    } else {
      cur = { pts: [a, b], len, dir, start: k };
      runs.push(cur);
    }
  }
  if (runs.length < 4) return null;
  const sides = [...runs].sort((a, b) => b.len - a.len).slice(0, 4).sort((a, b) => a.start - b.start);
  const lines = sides.map((r) => {
    const a = r.pts[0];
    const b = r.pts[r.pts.length - 1];
    return { p: a, d: { x: b.x - a.x, y: b.y - a.y } };
  });
  const out: Point[] = [];
  for (let i = 0; i < 4; i++) {
    const l1 = lines[(i + 3) % 4];
    const l2 = lines[i];
    const den = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
    if (Math.abs(den) < 1e-6) return null;
    const t = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / den;
    out.push({ x: l1.p.x + l1.d.x * t, y: l1.p.y + l1.d.y * t });
  }
  return out;
}
