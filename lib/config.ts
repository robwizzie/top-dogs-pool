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

export const NAV_LINKS = [
  { href: "/", label: "Home", ball: 1 },
  { href: "/roster", label: "Roster", ball: 2 },
  { href: "/schedule", label: "Schedule", ball: 3 },
  { href: "/standings", label: "Standings", ball: 4 },
  { href: "/leaderboard", label: "Patch Watch", ball: 5 },
  { href: "/research", label: "Research", ball: 6 },
  { href: "/shots", label: "Shots", ball: 10 },
  { href: "/clips", label: "Clips", ball: 7 },
  { href: "/live", label: "Live", ball: 8 },
  { href: "/store", label: "Shop", ball: 9 },
] as const;
