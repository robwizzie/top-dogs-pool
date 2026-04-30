import { unstable_cache } from "next/cache";
import {
  YOUTUBE_API_KEY,
  YOUTUBE_PLAYLIST_ID,
  YOUTUBE_REVALIDATE_SECONDS,
} from "@/lib/config";

export type Clip = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
  /** Tags parsed from description, e.g. "#match-1234", "#player-9876". */
  matchId?: string;
  playerIds: string[];
};

type YouTubeItem = {
  contentDetails: { videoId: string; videoPublishedAt?: string };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
      maxres?: { url: string };
    };
  };
};

function parseTags(description: string): { matchId?: string; playerIds: string[] } {
  const matchTag = description.match(/#match-(\w+)/i);
  const playerTags = [...description.matchAll(/#player-(\w+)/gi)].map((m) => m[1]);
  return { matchId: matchTag?.[1], playerIds: playerTags };
}

export const getClips = unstable_cache(
  async (): Promise<Clip[]> => {
    if (!YOUTUBE_API_KEY || !YOUTUBE_PLAYLIST_ID) return [];
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      url.searchParams.set("part", "snippet,contentDetails");
      url.searchParams.set("playlistId", YOUTUBE_PLAYLIST_ID);
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("key", YOUTUBE_API_KEY);

      const res = await fetch(url.toString(), {
        next: { revalidate: YOUTUBE_REVALIDATE_SECONDS, tags: ["youtube"] },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { items: YouTubeItem[] };

      return data.items.map((item) => {
        const id = item.contentDetails.videoId;
        const tags = parseTags(item.snippet.description ?? "");
        const t = item.snippet.thumbnails;
        const thumb =
          t.maxres?.url ?? t.high?.url ?? t.medium?.url ?? t.default?.url ?? "";
        return {
          id,
          title: item.snippet.title,
          description: item.snippet.description,
          publishedAt:
            item.contentDetails.videoPublishedAt ?? item.snippet.publishedAt,
          thumbnail: thumb,
          url: `https://www.youtube.com/watch?v=${id}`,
          ...tags,
        };
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[youtube] fetch failed:", (err as Error).message);
      }
      return [];
    }
  },
  ["youtube-clips"],
  { revalidate: YOUTUBE_REVALIDATE_SECONDS, tags: ["youtube"] },
);

export async function getClipsForMatch(matchId: string): Promise<Clip[]> {
  const all = await getClips();
  return all.filter((c) => c.matchId === matchId);
}

export async function getClipsForPlayer(playerId: string): Promise<Clip[]> {
  const all = await getClips();
  return all.filter((c) => c.playerIds.includes(playerId));
}
