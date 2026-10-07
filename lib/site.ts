import type { Metadata } from "next";
import { TEAM_NAME, TEAM_TAGLINE } from "@/lib/config";

/**
 * Site identity for SEO and link previews.
 *
 * `SITE_URL` is the canonical origin. Next resolves every relative metadata
 * URL against it (og:image, canonical, og:url), and LinkedIn, iMessage and
 * Slack ignore an og:image that isn't absolute — so without it a shared link
 * shows no image at all. Override with NEXT_PUBLIC_SITE_URL for previews.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://poolmaxxing.com").replace(/\/+$/, "");

export const SITE_NAME = `${TEAM_NAME} Pool`;

export const SITE_TITLE = `${TEAM_NAME} — APA Pool Team, South Jersey`;

export const SITE_DESCRIPTION =
  `${TEAM_NAME} is an APA 8-ball team in South Jersey. Live roster and skill levels, ` +
  "match schedule and recaps, division standings, the Patch Watch leaderboard, " +
  "a full training library of shots and drills, and match-night streams.";

export const SITE_KEYWORDS = [
  TEAM_NAME,
  "Top Dawgs Pool",
  "APA pool",
  "APA 8-ball",
  "American Poolplayers Association",
  "South Jersey pool league",
  "pool team",
  "billiards",
  "8-ball",
  "pool drills",
  "Kinister shots",
  "pool practice",
  "Rack Up",
];

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * The site card, rendered by app/opengraph-image.tsx.
 *
 * Next only fills in a file-based og:image for pages that leave `openGraph`
 * alone — it replaces the object wholesale, images included — so pages that
 * set their own og tags name the card explicitly.
 */
export const SITE_OG_IMAGE = {
  url: "/opengraph-image",
  ...OG_IMAGE_SIZE,
  type: "image/png",
  alt: `${TEAM_NAME} — APA 8-ball pool team from South Jersey`,
};

/**
 * Metadata for a page: title, description, canonical URL and matching
 * Open Graph / Twitter tags.
 *
 * Next merges `openGraph` shallowly, so a page that sets only `title` keeps
 * the home page's og:title — every shared link would read "Top Dawgs — APA
 * Pool Team". Pages go through here so the preview names the page.
 *
 * The image is the site card. A page with its own `opengraph-image` file
 * passes `ownImage` — an explicit image here would override that file.
 */
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  noindex = false,
  ownImage = false,
}: {
  title: string;
  description: string;
  /** Path from the site root, e.g. "/roster". Used for canonical and og:url. */
  path: string;
  type?: "website" | "article" | "profile";
  noindex?: boolean;
  /** The route has its own `opengraph-image` file; don't name the site card. */
  ownImage?: boolean;
}): Metadata {
  const fullTitle = `${title} · ${TEAM_NAME}`;
  // Leave the key out entirely: even `images: undefined` stops Next filling in
  // the route's own card.
  const images = ownImage ? {} : { images: [SITE_OG_IMAGE] };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "en_US",
      type,
      ...images,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...images,
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** JSON-LD for the home page: the team, and the site it lives on. */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: TEAM_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en-US",
        publisher: { "@id": `${SITE_URL}/#team` },
      },
      {
        "@type": "SportsTeam",
        "@id": `${SITE_URL}/#team`,
        name: TEAM_NAME,
        sport: "Pool (cue sports)",
        description: `${TEAM_NAME} — ${TEAM_TAGLINE}.`,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        image: `${SITE_URL}/opengraph-image`,
        memberOf: {
          "@type": "SportsOrganization",
          name: "American Poolplayers Association",
          url: "https://poolplayers.com",
        },
        location: {
          "@type": "Place",
          address: { "@type": "PostalAddress", addressRegion: "NJ", addressCountry: "US" },
        },
      },
    ],
  };
}
