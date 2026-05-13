import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
  const routes = [
    "",
    "/roster",
    "/schedule",
    "/standings",
    "/leaderboard",
    "/clips",
    "/live",
    "/store",
  ];
  return routes.map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: p === "" ? 1 : 0.8,
  }));
}
