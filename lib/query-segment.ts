/**
 * Query params → cacheable path segments.
 *
 * Pages like /leaderboard?session=138 used to read `searchParams`, which
 * makes Next render them on every request — a Vercel function invocation per
 * page view, bots included. Instead, `rewrites` in next.config.ts map each
 * query onto a hidden `/q/...` route at the CDN layer, and that route is ISR:
 * rendered once per distinct value, then served from cache for the hour.
 * Public URLs keep their `?session=` form; the `/q/` paths are internal.
 *
 * A param that wasn't supplied becomes `NO_VALUE` in the path.
 */
export const NO_VALUE = "-";

/** Decode one rewritten segment back into the original query value. */
export function fromSegment(segment: string): string | undefined {
  if (segment === NO_VALUE || segment === "") return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
