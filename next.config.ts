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
