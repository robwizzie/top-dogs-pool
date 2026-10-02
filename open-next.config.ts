// OpenNext config for the Cloudflare Workers build (`opennextjs-cloudflare`).
// Vercel and the Docker image ignore this file entirely.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";
import type { CacheEntryType, IncrementalCache } from "@opennextjs/aws/types/overrides.js";

// Tell next.config.ts / lib/prerender.ts that this `next build` is for Workers.
// This file is loaded in-process by the OpenNext CLI right before it spawns
// `npm run build`, so the variable reaches that build.
process.env.NEXT_DEPLOY_TARGET ??= "cloudflare";

/**
 * Read-only store over the pages prerendered by `next build`, which
 * `opennextjs-cloudflare deploy` uploads alongside the static assets.
 *
 * Next >= 15.5.26 looks responses up under owner-scoped keys
 * ("/route-cache/APP_PAGE/<sha256 of the source route>/$/roster") while the
 * build output is stored under the plain path ("/roster"). Next's own
 * filesystem cache bridges the two by reading the build seed whose
 * `meta.routeCache.key` matches; OpenNext 1.20 does not, so without this every
 * prerendered page would be ignored and rendered again on first request. This
 * applies the same verified fallback.
 */
const prerenderedPages: IncrementalCache = {
  // Must keep the static-assets cache's name: `opennextjs-cloudflare deploy`
  // keys off it to upload the prerendered pages with the assets.
  name: staticAssetsIncrementalCache.name,
  async get<T extends CacheEntryType = "cache">(key: string, cacheType?: T) {
    const direct = await staticAssetsIncrementalCache.get(key, cacheType);
    if (direct || !key.startsWith("/route-cache/")) return direct;
    const marker = key.indexOf("/$/");
    if (marker === -1) return null;
    const seed = await staticAssetsIncrementalCache.get(key.slice(marker + 2), cacheType);
    const meta = (seed?.value as { meta?: { routeCache?: { key?: string } } } | undefined)?.meta;
    return meta?.routeCache?.key === key ? seed : null;
  },
  // Writes land in the regional (Cache API) layer only.
  async set() {},
  async delete() {},
};

/**
 * Zero-setup, free-plan ISR cache (no KV namespace or R2 bucket to create):
 *
 *  - Pages prerendered at build are served from the static assets (above).
 *  - Anything rendered at request time (on-demand pages, ISR revalidations)
 *    is kept in the Workers Cache API of the data center that rendered it,
 *    for the page's own `revalidate` window. The Cache API is free but
 *    per-data-center and best-effort, and it only works on a custom domain
 *    (not on *.workers.dev).
 *  - Every deploy gets a new build id, so a deploy (e.g. the weekly APA
 *    scrape commit) replaces every cached page at once.
 *
 * See DEPLOY-CLOUDFLARE.md ("Caching") for the trade-offs and how to move to
 * R2 if a shared, durable cache is ever needed.
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(prerenderedPages, {
    mode: "long-lived",
    // The assets copy never changes within a deploy — don't re-read it on
    // every Cache API hit.
    shouldLazilyUpdateOnCacheHit: false,
  }),
  // Background ISR revalidation via the WORKER_SELF_REFERENCE binding.
  queue: memoryQueue,
  // Cache interception (serving cached pages before Next.js boots) looks
  // pages up under the plain path, but revalidated pages are written under
  // Next's owner-scoped keys (see above), so with it on a page that went
  // stale was re-rendered on every request. Leave it off.
  enableCacheInterception: false,
});
