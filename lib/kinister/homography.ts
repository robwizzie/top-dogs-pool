/**
 * Minimal 4-point homography helpers for the AR ghost-ball overlay.
 *
 * Given four screen-space pixel coordinates (where the player tapped the
 * four corner pockets on the live camera feed) and four table-space
 * coordinates (the corner pockets in diamond units), we solve a 3×3
 * perspective transform that maps one space to the other. The transform
 * lets us project any table-space point (cue ball, ghost ball, rail
 * bounce…) to its screen position, so the overlay tracks the real table.
 *
 * Math: standard Direct Linear Transformation. We fix the bottom-right
 * matrix entry h8 = 1 and solve the remaining 8 unknowns from the 8
 * linear equations the four point correspondences give us.
 */

export type Point = { x: number; y: number };

/**
 * 3×3 homography matrix flattened row-major: [h0..h8].
 * Maps (x, y, 1) → (x', y', w) with x'/w, y'/w yielding the destination.
 */
export type Homography = readonly number[];

/**
 * Solve for a homography sending each `src[i]` to `dst[i]`.
 * Pass exactly four correspondences (no more, no fewer).
 */
export function computeHomography(
  src: readonly [Point, Point, Point, Point],
  dst: readonly [Point, Point, Point, Point],
): Homography {
  // Two equations per correspondence:
  //   sx*h0 + sy*h1 + h2 - sx*dx*h6 - sy*dx*h7 = dx
  //   sx*h3 + sy*h4 + h5 - sx*dy*h6 - sy*dy*h7 = dy
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }
  const h = solve8x8(A, b);
  if (!h) throw new Error("Degenerate calibration — pick four distinct corners");
  return [...h, 1];
}

/**
 * Apply a homography to a single point.
 */
export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  if (Math.abs(w) < 1e-9) return p; // shouldn't happen for a well-conditioned H
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

/**
 * Invert a homography (so a forward transform can be reversed). Uses
 * cofactor expansion since the matrix is 3×3.
 */
export function invertHomography(h: Homography): Homography {
  const a = h[0],
    b = h[1],
    c = h[2],
    d = h[3],
    e = h[4],
    f = h[5],
    g = h[6],
    hh = h[7],
    i = h[8];
  const A = e * i - f * hh;
  const B = -(d * i - f * g);
  const C = d * hh - e * g;
  const D = -(b * i - c * hh);
  const E = a * i - c * g;
  const F = -(a * hh - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) {
    throw new Error("Singular homography");
  }
  const k = 1 / det;
  return [A * k, D * k, G * k, B * k, E * k, H * k, C * k, F * k, I * k];
}

function solve8x8(A: number[][], b: number[]): number[] | null {
  const n = 8;
  // Augmented matrix.
  const M: number[][] = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    // Partial pivot — swap in the row with the largest absolute value in
    // column i to keep the elimination numerically stable.
    let pivot = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[pivot][i])) pivot = k;
    }
    if (Math.abs(M[pivot][i]) < 1e-12) return null;
    if (pivot !== i) [M[i], M[pivot]] = [M[pivot], M[i]];
    // Eliminate below.
    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      if (factor === 0) continue;
      for (let j = i; j <= n; j++) M[k][j] -= factor * M[i][j];
    }
  }
  // Back-substitution.
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
  }
  return x;
}
