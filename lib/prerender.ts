import { loadSnapshot } from "@/lib/apa/client";

/**
 * Which on-demand ISR pages to prerender at build time.
 *
 * On Vercel / Docker these routes render on first request and are then
 * cached for the hour (generateStaticParams returns []), which keeps the
 * build short. On Cloudflare Workers the free plan caps CPU at 10 ms per
 * request, and a cold render of these pages (parse the multi-MB snapshot +
 * React render) costs more than that. Prerendering them at build moves that
 * work into the build, so a visitor is always served a cached page — after
 * the `revalidate` window a stale copy is served while it re-renders in the
 * background, and a failed background render never reaches the visitor.
 *
 * `NEXT_DEPLOY_TARGET` is set by open-next.config.ts (Cloudflare builds only).
 */
const PRERENDER_ALL = process.env.NEXT_DEPLOY_TARGET === "cloudflare";

/** Our players' profile pages (/roster/[playerId]). */
export async function prerenderPlayerIds(): Promise<string[]> {
  if (!PRERENDER_ALL) return [];
  return Object.keys((await loadSnapshot()).players);
}

/** Our matches (/matches/[matchId]). Opp-vs-opp matches stay on-demand. */
export async function prerenderMatchIds(): Promise<string[]> {
  if (!PRERENDER_ALL) return [];
  const snap = await loadSnapshot();
  return [...new Set([...Object.keys(snap.matches), ...snap.schedule.map((m) => m.id)])];
}

/** Opponent team pages (/opponents/[teamId]). */
export async function prerenderOpponentTeamIds(): Promise<string[]> {
  if (!PRERENDER_ALL) return [];
  return Object.keys((await loadSnapshot()).opponentTeams);
}
