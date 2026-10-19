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

/**
 * True when a rewritten `session` segment selects more than one session
 * ("138,137"). Those combinations are unbounded (2^n of them), never
 * prerendered, and only reachable by clicking — keep them out of search.
 */
export function isMultiSessionSegment(segment: string): boolean {
  const value = fromSegment(segment);
  return value !== undefined && value.includes(",");
}

/** Merge a noindex robots directive into page metadata for multi-session URLs. */
export function withSessionRobots<T extends object>(base: T, segment: string): T {
  if (!isMultiSessionSegment(segment)) return base;
  return { ...base, robots: { index: false, follow: false } };
}
