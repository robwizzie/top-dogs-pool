/**
 * Lightweight computer-vision helpers for the AR shot tracker. No external
 * libraries — we run on the Canvas 2D API + raw ImageData.
 *
 * Design philosophy: don't try to track a ball at 30+ mph through motion
 * blur (that path requires real ML hardware and ends in disappointment).
 * Instead:
 *   1. Capture a colour signature of the cue ball and the object ball
 *      while they're at rest, on the player's first taps.
 *   2. Watch a small region around each ball for *motion* — any frame
 *      that's significantly different from the previous frame in that
 *      region tells us a shot is happening.
 *   3. When motion has been seen, then dies down, sample the table again
 *      and ask: is the OB still on the table? If yes, where? If gone,
 *      did the disturbance pass through the target pocket?
 *
 * That gives us reliable Make / Miss verdicts in the 70-85% range in
 * realistic conditions, which we pair with a one-tap override so the
 * 15-30% don't sink trust.
 */

export type Point = { x: number; y: number };

/** Average RGB colour of a circular region in `imageData` around `center`. */
export function sampleColor(
  imageData: ImageData,
  center: Point,
  radius = 8,
): [number, number, number] {
  const { data, width, height } = imageData;
  const r0 = Math.max(0, Math.floor(center.x - radius));
  const r1 = Math.min(width - 1, Math.floor(center.x + radius));
  const c0 = Math.max(0, Math.floor(center.y - radius));
  const c1 = Math.min(height - 1, Math.floor(center.y + radius));
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;
  const r2 = radius * radius;
  for (let y = c0; y <= c1; y++) {
    for (let x = r0; x <= r1; x++) {
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy > r2) continue;
      const i = (y * width + x) * 4;
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
      count += 1;
    }
  }
  if (count === 0) return [0, 0, 0];
  return [rSum / count, gSum / count, bSum / count];
}

/**
 * How much motion is happening in the given circular region between two
 * frames. Returns a normalized value in [0, 1] — small numbers (≤ 0.05)
 * are noise, anything > 0.15 is "something is definitely moving."
 */
export function regionMotion(
  prev: ImageData,
  curr: ImageData,
  center: Point,
  radius: number,
): number {
  if (prev.width !== curr.width || prev.height !== curr.height) return 0;
  const { data: a } = prev;
  const { data: b } = curr;
  const { width, height } = curr;
  const r0 = Math.max(0, Math.floor(center.x - radius));
  const r1 = Math.min(width - 1, Math.floor(center.x + radius));
  const c0 = Math.max(0, Math.floor(center.y - radius));
  const c1 = Math.min(height - 1, Math.floor(center.y + radius));
  let total = 0;
  let count = 0;
  const r2 = radius * radius;
  for (let y = c0; y <= c1; y++) {
    for (let x = r0; x <= r1; x++) {
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy > r2) continue;
      const i = (y * width + x) * 4;
      const dr = a[i] - b[i];
      const dg = a[i + 1] - b[i + 1];
      const db = a[i + 2] - b[i + 2];
      total += Math.abs(dr) + Math.abs(dg) + Math.abs(db);
      count += 1;
    }
  }
  if (count === 0) return 0;
  // Normalize: max possible per-pixel delta is 3 * 255 = 765.
  return total / (count * 765);
}

/**
 * "Is the ball still here?" check — average colour distance between the
 * region around `center` in `imageData` and the original reference colour
 * captured at lock-in. Distance is in the standard [0, ~441] RGB range;
 * threshold around 60-90 to call it "still present."
 */
export function colorDistanceFromReference(
  imageData: ImageData,
  center: Point,
  reference: [number, number, number],
  radius = 8,
): number {
  const [r, g, b] = sampleColor(imageData, center, radius);
  const dr = r - reference[0];
  const dg = g - reference[1];
  const db = b - reference[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Scan the whole table region for the OB's colour signature and return the
 * brightest match's centroid plus a confidence value. Used after the shot
 * settles to figure out where the OB ended up (or that it's gone).
 *
 * `step` controls the sampling stride — larger = faster but coarser.
 */
export function findColorMatch(
  imageData: ImageData,
  reference: [number, number, number],
  searchRadius: number,
  step = 4,
  maxDistance = 100,
): { center: Point; confidence: number } | null {
  const { data, width, height } = imageData;
  // Score grid — quick sum-of-similarity in step-sized cells.
  let bestX = 0;
  let bestY = 0;
  let bestScore = 0;
  const halfWindow = searchRadius;
  for (let y = halfWindow; y < height - halfWindow; y += step) {
    for (let x = halfWindow; x < width - halfWindow; x += step) {
      const i = (y * width + x) * 4;
      const dr = data[i] - reference[0];
      const dg = data[i + 1] - reference[1];
      const db = data[i + 2] - reference[2];
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist > maxDistance) continue;
      const score = maxDistance - dist;
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }
  if (bestScore === 0) return null;
  return {
    center: { x: bestX, y: bestY },
    confidence: bestScore / maxDistance,
  };
}

/** Distance between two points. */
export function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Capture a video frame to an off-screen canvas and return its ImageData. */
export function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): ImageData | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  // Downscale to ~640px wide for snappier processing — pool tracking
  // doesn't need 1080p.
  const target = 640;
  const scale = Math.min(1, target / video.videoWidth);
  const w = Math.max(1, Math.floor(video.videoWidth * scale));
  const h = Math.max(1, Math.floor(video.videoHeight * scale));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Project a screen-space point (in CSS-pixel space) into the off-screen
 * processing canvas's pixel space. The processing canvas is downscaled to
 * ~640px wide; the player tapped in display-space on a full-resolution
 * <video> element. This bridge lets us compare apples to apples.
 */
export function toCanvasSpace(
  p: Point,
  displayWidth: number,
  displayHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): Point {
  return {
    x: (p.x / displayWidth) * canvasWidth,
    y: (p.y / displayHeight) * canvasHeight,
  };
}

/** Reverse of toCanvasSpace. */
export function toDisplaySpace(
  p: Point,
  canvasWidth: number,
  canvasHeight: number,
  displayWidth: number,
  displayHeight: number,
): Point {
  return {
    x: (p.x / canvasWidth) * displayWidth,
    y: (p.y / canvasHeight) * displayHeight,
  };
}
