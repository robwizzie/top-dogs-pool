import type { NextConfig } from "next";

type Rewrite = {
  source: string;
  destination: string;
  has?: { type: "query"; key: string; value: string }[];
  missing?: { type: "query"; key: string }[];
};

/**
 * Map `?key=value` onto the page's cached `/q/...` route (see
 * lib/query-segment.ts). One rule per combination of present params so the
 * public URLs stay exactly as they were. Keys missing from a combination are
 * filled with "-".
 */
function queryRewrites(source: string, keys: string[]): Rewrite[] {
  const rules: Rewrite[] = [];
  // Every non-empty subset of keys, largest first.
  for (let mask = (1 << keys.length) - 1; mask > 0; mask--) {
    const present = keys.filter((_, i) => mask & (1 << i));
    const absent = keys.filter((_, i) => !(mask & (1 << i)));
    const segments = keys.map((k) => (present.includes(k) ? `:${k}` : "-"));
    rules.push({
      source,
      destination: `${source}/q/${segments.join("/")}`,
      has: present.map((key) => ({ type: "query", key, value: `(?<${key}>.+)` })),
      ...(absent.length ? { missing: absent.map((key) => ({ type: "query" as const, key })) } : {}),
    });
  }
  return rules;
}

const config: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for the Docker image.
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "yt3.ggpht.com" },
      { protocol: "https", hostname: "league.poolplayers.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
    ],
    // Cache optimized variants for a year. Shopify CDN URLs and YouTube
    // thumbnails are content-addressed, so a stale image never goes out —
    // and we don't pay to re-optimize or re-fetch on every visitor.
    minimumCacheTTL: 31536000,
    // Trim the responsive variant matrix. Default is 8 device + 8 image
    // sizes = up to 16 variants per <Image>, each a separate optimizer
    // invocation + origin pull. Five each covers our breakpoints.
    deviceSizes: [640, 828, 1080, 1280, 1920],
    imageSizes: [64, 128, 256, 384],
    formats: ["image/webp"],
  },
  async rewrites() {
    return {
      // beforeFiles: these paths exist as pages, so the rewrite has to win
      // before the filesystem match does.
      beforeFiles: [
        ...queryRewrites("/leaderboard", ["session", "tourneys"]),
        ...queryRewrites("/roster", ["session"]),
        ...queryRewrites("/roster/:playerId", ["session"]),
        ...queryRewrites("/standings", ["session"]),
        ...queryRewrites("/schedule", ["session"]),
        ...queryRewrites("/briefing", ["available"]),
        ...queryRewrites("/matches/:matchId", ["team"]),
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  compiler: {
    // Strip console.* in production builds; warnings/errors still flow through.
    removeConsole: { exclude: ["error", "warn"] },
  },
};

export default config;
