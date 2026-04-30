import { unstable_cache } from "next/cache";
import { APA_REVALIDATE_SECONDS } from "@/lib/config";

const UA =
  "Mozilla/5.0 (compatible; TopDogsPool/1.0; +https://github.com/robwizzie/top-dogs-pool)";

export class ApaFetchError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApaFetchError";
  }
}

async function rawFetch(url: string, attempt = 0): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: APA_REVALIDATE_SECONDS, tags: ["apa"] },
    });
    if (!res.ok) {
      throw new ApaFetchError(`APA ${url} → ${res.status}`, res.status);
    }
    return await res.text();
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return rawFetch(url, attempt + 1);
    }
    throw err instanceof ApaFetchError
      ? err
      : new ApaFetchError(`Network error fetching ${url}: ${(err as Error).message}`);
  }
}

/** Cached HTML fetcher. Pages depending on this will revalidate hourly. */
export const fetchApaHtml = unstable_cache(
  async (url: string) => rawFetch(url),
  ["apa-html-v1"],
  { revalidate: APA_REVALIDATE_SECONDS, tags: ["apa"] },
);
