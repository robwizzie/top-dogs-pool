export const TEAM_NAME = "Top Dawgs";
export const TEAM_TAGLINE = "APA Pool — South Jersey";

export const APA_TEAM_URL =
  process.env.APA_TEAM_URL ?? "https://league.poolplayers.com/southjersey/team/12894673";

export const TIKTOK_HANDLE =
  process.env.NEXT_PUBLIC_TIKTOK_HANDLE ?? "topdogspool";

export const TIKTOK_PROFILE_URL = `https://www.tiktok.com/@${TIKTOK_HANDLE}`;
export const TIKTOK_LIVE_URL = `https://www.tiktok.com/@${TIKTOK_HANDLE}/live`;

export const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? "";
export const YOUTUBE_PLAYLIST_ID = process.env.YOUTUBE_PLAYLIST_ID ?? "";

export const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? "";

/** ISR revalidation seconds for APA scrape — 1h */
export const APA_REVALIDATE_SECONDS = 60 * 60;
/** ISR revalidation for YouTube — 30m */
export const YOUTUBE_REVALIDATE_SECONDS = 30 * 60;

export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; items: readonly NavItem[] };
export type NavEntry = NavItem | NavGroup;

export const NAV_GROUPS: readonly NavEntry[] = [
  { href: "/", label: "Home" },
  {
    label: "Season",
    items: [
      { href: "/roster", label: "Roster" },
      { href: "/schedule", label: "Schedule" },
      { href: "/standings", label: "Standings" },
      { href: "/leaderboard", label: "Patch Watch" },
      { href: "/research", label: "Research" },
    ],
  },
  {
    label: "Training",
    items: [
      { href: "/shots", label: "Shots" },
      { href: "/clips", label: "Clips" },
    ],
  },
  { href: "/live", label: "Live" },
  { href: "/store", label: "Shop" },
] as const;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

/** Flat list of every nav destination — used by the command palette and mobile menu. */
export const NAV_LINKS: readonly NavItem[] = NAV_GROUPS.flatMap((entry) =>
  isNavGroup(entry) ? [...entry.items] : [entry],
);
