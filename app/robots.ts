import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Never useful in search. Pages that are private but get shared by
        // link (research, briefing, Rack Up rooms) aren't listed: some preview
        // bots honour robots.txt and the link would stop unfurling. They carry
        // a noindex robots meta tag instead.
        disallow: [
          "/api/",
          "/research-login",
          "/admin-login",
          "/leaderboard/admin",
          "/store/checkout",
          "/rack/admin",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
