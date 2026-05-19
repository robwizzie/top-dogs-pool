import type { EnglishHit } from "./shots";

/**
 * High-level english categories. A single shot can belong to several at once
 * (e.g. high-left = both "follow" and "left"). Used for filtering and for
 * "related shots" recommendations.
 */
export type EnglishCategory =
  | "center"
  | "follow"
  | "draw"
  | "left"
  | "right";

const THRESHOLD = 0.2;

/**
 * Categorize an english hit point. Returns every category that applies —
 * "center" only when the point is near the middle on both axes.
 */
export function englishCategory(e: EnglishHit): EnglishCategory[] {
  const cats: EnglishCategory[] = [];
  if (e.y > THRESHOLD) cats.push("follow");
  if (e.y < -THRESHOLD) cats.push("draw");
  if (e.x > THRESHOLD) cats.push("right");
  if (e.x < -THRESHOLD) cats.push("left");
  if (cats.length === 0) cats.push("center");
  return cats;
}

/**
 * Cosine-like similarity between two english hit points. 1 = identical
 * direction & magnitude, 0 = unrelated, negative = opposite. Used to find
 * "related" shots that drill the same kind of stroke.
 */
export function englishSimilarity(a: EnglishHit, b: EnglishHit): number {
  const am = Math.hypot(a.x, a.y);
  const bm = Math.hypot(b.x, b.y);
  if (am < 0.05 && bm < 0.05) return 1; // both center
  if (am < 0.05 || bm < 0.05) return 0;
  return (a.x * b.x + a.y * b.y) / (am * bm);
}
