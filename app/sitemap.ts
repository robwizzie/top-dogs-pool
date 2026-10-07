import type { MetadataRoute } from "next";
import { getRoster } from "@/lib/apa";
import { DRILLS } from "@/lib/kinister/drills";
import { KINISTER_SHOTS } from "@/lib/kinister/shots";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

type Entry = MetadataRoute.Sitemap[number];

/** Public, indexable pages. Gated and private ones (research, briefing,
 *  admin, Rack Up rooms) are left out — see app/robots.ts. */
const PAGES: [path: string, priority: number, changeFrequency: Entry["changeFrequency"]][] = [
  ["", 1, "daily"],
  ["/roster", 0.9, "weekly"],
  ["/schedule", 0.9, "daily"],
  ["/standings", 0.8, "weekly"],
  ["/leaderboard", 0.8, "weekly"],
  ["/shots", 0.8, "monthly"],
  ["/dawg-drill", 0.6, "monthly"],
  ["/glossary", 0.6, "monthly"],
  ["/clips", 0.7, "weekly"],
  ["/live", 0.7, "weekly"],
  ["/store", 0.6, "weekly"],
  ["/rack", 0.7, "monthly"],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const roster = await getRoster().catch(() => []);
  const entry = (path: string, priority: number, changeFrequency: Entry["changeFrequency"]): Entry => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });
  return [
    ...PAGES.map(([p, priority, freq]) => entry(p, priority, freq)),
    ...roster.filter((p) => p.visible !== false).map((p) => entry(`/roster/${p.id}`, 0.6, "weekly")),
    ...KINISTER_SHOTS.map((s) => entry(`/shots/${s.id}`, 0.5, "monthly")),
    ...DRILLS.map((d) => entry(`/drills/${d.id}`, 0.5, "monthly")),
  ];
}
