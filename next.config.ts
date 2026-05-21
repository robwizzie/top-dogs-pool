import type { NextConfig } from "next";

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
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  compiler: {
    // Strip console.* in production builds; warnings/errors still flow through.
    removeConsole: { exclude: ["error", "warn"] },
  },
};

export default config;
