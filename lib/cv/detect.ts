import { sampleColor, type Point } from "./tracking";

/**
 * Auto-detection of pool balls on a calibrated table. Avoids dragging in
 * OpenCV.js (~4MB wasm) — we know the felt color from the calibration
 * step, so we can do a simple color-segmentation + connected-components
 * pass to find every non-felt blob of roughly ball-size.
 *
 * Algorithm:
 *   1. Sample the felt color from the center of the calibrated quad.
 *   2. Mask every pixel whose color is "far" from the felt color.
 *   3. Run connected-components (union-find with 4-connectivity).
 *   4. Keep components in the right size range with roughly circular
 *      shape (bounding-box aspect ratio + pixel-fill density).
 *   5. Return centroid + average color of each remaining blob.
 *
 * Returns positions in **canvas-space** (the downsampled processing
 * canvas). Caller converts to display-space via `toDisplaySpace`.
 */

export type DetectedBall = {
  center: Point;
  color: [number, number, number];
  /** Pixel area of the blob — used to break ties by relative size. */
  area: number;
};

export type DetectOptions = {
  /** Polygon of the four calibrated table corners in canvas-space. */
  tableQuad?: [Point, Point, Point, Point];
  /** Sampled felt color in RGB. If omitted, sampled from quad center. */
  feltColor?: [number, number, number];
  /** How different from felt counts as "not felt" — higher = stricter. */
  colorDistance?: number;
  /** Min / max blob area in pixels (canvas-space). */
  minArea?: number;
  maxArea?: number;
};

const DEFAULTS = {
  colorDistance: 70,
  minArea: 60,
  maxArea: 1200,
};

export function detectBalls(
  image: ImageData,
  options: DetectOptions = {},
): DetectedBall[] {
  const { width, height, data } = image;
  const tableQuad = options.tableQuad;
  const colorDistance = options.colorDistance ?? DEFAULTS.colorDistance;
  const minArea = options.minArea ?? DEFAULTS.minArea;
  const maxArea = options.maxArea ?? DEFAULTS.maxArea;

  // (1) Establish felt reference. Sample from several spots on the felt
  // and take the median per channel. Robust to:
  //   - the foot spot / center marking many tables have
  //   - uneven lighting (window glare on one side, shadow on the other)
  //   - chalk smudges or a stray ball that happens to be near center
  const feltColor = options.feltColor ?? medianFeltSample(image, tableQuad);

  // (2) Mask non-felt pixels inside the table polygon. Pixels outside
  // the polygon never enter the search, so we don't pick up the rails
  // or the player's torso.
  const total = width * height;
  const mask = new Uint8Array(total);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tableQuad && !pointInQuad({ x, y }, tableQuad)) continue;
      const i = (y * width + x) * 4;
      const dr = data[i] - feltColor[0];
      const dg = data[i + 1] - feltColor[1];
      const db = data[i + 2] - feltColor[2];
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist > colorDistance) mask[y * width + x] = 1;
    }
  }

  // (3) Connected components (4-connectivity, union-find).
  const uf = new UnionFind(total);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      if (x > 0 && mask[i - 1]) uf.union(i, i - 1);
      if (y > 0 && mask[i - width]) uf.union(i, i - width);
    }
  }

  // (4) Aggregate stats per root.
  type Blob = {
    sumX: number;
    sumY: number;
    sumR: number;
    sumG: number;
    sumB: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    count: number;
  };
  const blobs = new Map<number, Blob>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const root = uf.find(i);
      let b = blobs.get(root);
      if (!b) {
        b = {
          sumX: 0,
          sumY: 0,
          sumR: 0,
          sumG: 0,
          sumB: 0,
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
          count: 0,
        };
        blobs.set(root, b);
      }
      const pi = i * 4;
      b.sumX += x;
      b.sumY += y;
      b.sumR += data[pi];
      b.sumG += data[pi + 1];
      b.sumB += data[pi + 2];
      if (x < b.minX) b.minX = x;
      if (y < b.minY) b.minY = y;
      if (x > b.maxX) b.maxX = x;
      if (y > b.maxY) b.maxY = y;
      b.count += 1;
    }
  }

  // (5) Filter by size + roughly circular geometry.
  const out: DetectedBall[] = [];
  for (const b of blobs.values()) {
    if (b.count < minArea || b.count > maxArea) continue;
    const w = b.maxX - b.minX + 1;
    const h = b.maxY - b.minY + 1;
    if (w < 6 || h < 6) continue;
    // Aspect ratio close to 1.
    const aspect = w > h ? w / h : h / w;
    if (aspect > 1.6) continue;
    // Fill density — a circle inscribed in its bounding box covers ~78%
    // of the box. Allow 0.55-0.95 to tolerate motion blur, shadows,
    // and partial occlusions.
    const density = b.count / (w * h);
    if (density < 0.55 || density > 0.98) continue;
    out.push({
      center: { x: b.sumX / b.count, y: b.sumY / b.count },
      color: [
        Math.round(b.sumR / b.count),
        Math.round(b.sumG / b.count),
        Math.round(b.sumB / b.count),
      ],
      area: b.count,
    });
  }

  // Sort by area descending — bigger blobs first, easier to pick out.
  out.sort((a, b) => b.area - a.area);
  return out;
}

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
  const { width, height } = image;

  // (1) Establish felt reference from the whole frame.
  const feltColor = medianFeltSample(image);

  // (2) Mask felt pixels — we use a slightly looser distance than the
  // ball detector since the table is huge and we want to catch the
  // whole thing including darker/lighter cloth sections.
  const total = width * height;
  const mask = new Uint8Array(total);
  const feltDistance = 90;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dr = image.data[i] - feltColor[0];
      const dg = image.data[i + 1] - feltColor[1];
      const db = image.data[i + 2] - feltColor[2];
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < feltDistance) mask[y * width + x] = 1;
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

/**
 * Pick which detected ball is the cue ball (whitest) and which is the
 * object ball (closest to the catalog's projected OB position, of the
 * remaining candidates).
 */
export function classifyBalls(
  candidates: DetectedBall[],
  expectedObCanvas: Point,
): { cue: DetectedBall | null; ob: DetectedBall | null } {
  if (candidates.length === 0) return { cue: null, ob: null };

  // Cue ball = the whitest (highest sum of RGB while also being low
  // chroma — a yellow ball is bright too). Score = brightness − chroma.
  const scoreWhite = (b: DetectedBall) => {
    const [r, g, b2] = b.color;
    const brightness = (r + g + b2) / 3;
    const max = Math.max(r, g, b2);
    const min = Math.min(r, g, b2);
    const chroma = max - min;
    return brightness - chroma * 2;
  };
  const cue = [...candidates].sort((a, b) => scoreWhite(b) - scoreWhite(a))[0];
  const remaining = candidates.filter((c) => c !== cue);
  if (remaining.length === 0) return { cue, ob: null };

  // OB = closest to where the catalog says it should be.
  const ob = remaining.reduce(
    (best, c) => {
      const d = Math.hypot(
        c.center.x - expectedObCanvas.x,
        c.center.y - expectedObCanvas.y,
      );
      return d < best.d ? { c, d } : best;
    },
    { c: remaining[0], d: Infinity },
  ).c;

  return { cue, ob };
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
 * Sample 9 points spread across the felt and return the median R/G/B
 * per channel. The median is far more robust than the mean to outliers
 * (center spot, chalk smudge, a ball that happens to be near the
 * sample) and to half-lit tables.
 */
function medianFeltSample(
  image: ImageData,
  tableQuad?: [Point, Point, Point, Point],
): [number, number, number] {
  const samples: Point[] = [];
  if (tableQuad) {
    // Bilinear blend over the quad — 9 interior points at the (¼, ½, ¾)
    // grid. None at the corners (rails / pockets).
    const fractions = [0.25, 0.5, 0.75];
    for (const u of fractions) {
      for (const v of fractions) {
        samples.push(bilinear(tableQuad, u, v));
      }
    }
  } else {
    const cx = image.width / 2;
    const cy = image.height / 2;
    const r = Math.min(image.width, image.height) * 0.2;
    for (const dx of [-r, 0, r]) {
      for (const dy of [-r, 0, r]) {
        samples.push({ x: cx + dx, y: cy + dy });
      }
    }
  }
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (const p of samples) {
    const [r, g, b] = sampleColor(image, p, 8);
    rs.push(r);
    gs.push(g);
    bs.push(b);
  }
  return [median(rs), median(gs), median(bs)];
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[m - 1] + sorted[m]) / 2
    : sorted[m];
}

function bilinear(
  q: [Point, Point, Point, Point],
  u: number,
  v: number,
): Point {
  // Quad order is the player's tap order: near-right, near-left,
  // far-left, far-right. u runs near→far, v runs right→left.
  const top = { x: lerp(q[0].x, q[1].x, v), y: lerp(q[0].y, q[1].y, v) };
  const bot = { x: lerp(q[3].x, q[2].x, v), y: lerp(q[3].y, q[2].y, v) };
  return { x: lerp(top.x, bot.x, u), y: lerp(top.y, bot.y, u) };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Point-in-quadrilateral test using the crossing-number algorithm.
 * Quad vertices must be in order (clockwise or counter-clockwise).
 */
function pointInQuad(p: Point, q: [Point, Point, Point, Point]): boolean {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const xi = q[i].x;
    const yi = q[i].y;
    const xj = q[j].x;
    const yj = q[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
