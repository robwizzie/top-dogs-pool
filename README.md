# Top Dogs

The official site for the **Top Dogs** APA pool team — South Jersey.

Live roster, schedule, deep player stats, sweeps & mini-sweeps leaderboard,
match recaps with embedded clips, and a TikTok live link. Match data is
scraped from APA's member portal into a versioned local cache, then projected
into a single site-ready JSON file.

## Stack

- **Next.js 15** (App Router, React 19, TypeScript)
- **Tailwind CSS v4** with brand tokens
- **Framer Motion** for tasteful animations
- **Playwright** to drive APA's authenticated SPA + capture GraphQL responses
- **Zod** for typed snapshot validation
- **YouTube Data API v3** for the highlight reel
- **next-themes** for dark (default) / light toggle
- **canvas-confetti** for sweep celebrations

## Getting started

```bash
cp .env.example .env.local
# fill APA_USERNAME / APA_PASSWORD (member portal credentials)

npm install
npx playwright install chromium
npm run sync   # scrape APA + project into data/apa.json
npm run dev
```

Open <http://localhost:3000>.

## How the data pipeline works

```
APA member portal (login required)
        │
        ▼
  scripts/scrape-apa.ts        ← Playwright headless Chromium
        │  · login + OAuth consent
        │  · capture batched GraphQL responses
        │  · incrementally fetch teams/matches/members
        ▼
  data/cache/                  ← raw GraphQL payloads, content-addressable
    teams/<id>.json              · full team page + roster + schedule
    matches/<id>.json            · full scoresheet (per-player W/L)
    members/<id>.json            · alias + per-session stats
    meta.json                    · current session, last scrape time
        │
        ▼
  scripts/project-apa.ts       ← reads cache → builds…
        │
        ▼
  data/apa.json                ← single site-ready snapshot
        │
        ▼
  app/**/page.tsx              ← server components consume typed data
```

### Cache freshness

| Entity            | Re-fetch policy                          |
| ----------------- | ---------------------------------------- |
| Current team      | every run                                |
| Past team         | once (frozen — sessions don't change)    |
| Match scoresheet  | once `isFinalized`; otherwise every run  |
| Member career     | weekly (configurable via `APA_MEMBER_TTL_DAYS`) |
| Opponent teams    | every 5 days during their session (configurable via `APA_OPPONENT_TTL_DAYS`) — fetched for every team in our current-session schedule |

### Scripts

```bash
npm run scrape       # discover + fetch into data/cache/ (incremental)
npm run project      # build data/apa.json from data/cache/
npm run sync         # both: scrape + project
npm run scrape:headful   # show the browser (debug)
```

For diagnostic / debugging:

```bash
npx tsx scripts/probe-graphql.ts <url> [<url>...]
```

Captures every GraphQL request/response on the listed pages → `data/gql-captures.json`.

## Environment

| Variable                    | Required          | Purpose                                                   |
| --------------------------- | ----------------- | --------------------------------------------------------- |
| `APA_USERNAME`              | yes               | APA member portal email                                    |
| `APA_PASSWORD`              | yes               | APA member portal password                                 |
| `APA_TEAM_URL`              | yes (default set) | Public APA team page URL (drives the team id)              |
| `APA_MEMBER_TTL_DAYS`       | optional          | How often to re-fetch member career stats (default 7)      |
| `APA_OPPONENT_TTL_DAYS`     | optional          | How often to re-fetch opponent team data (default 5)       |
| `APA_MAX_PAST_SESSIONS`     | optional          | Cap past-team backfill (0 = unlimited, the default)        |
| `APA_HEADFUL`               | optional          | `1` to show the browser during a scrape                    |
| `YOUTUBE_API_KEY`           | optional          | Enables the Clips section + Hero highlight reel            |
| `YOUTUBE_PLAYLIST_ID`       | optional          | Playlist to pull clips from                                |
| `NEXT_PUBLIC_TIKTOK_HANDLE` | optional          | TikTok username for the Live CTA (default `aaronbic`)      |
| `REVALIDATE_SECRET`         | recommended       | Secret for `POST /api/revalidate` to force a fresh render  |
| `NEXT_PUBLIC_SITE_URL`      | recommended       | Used by `sitemap.xml` / `robots.txt`                       |

The site renders gracefully when the snapshot hasn't been generated yet —
empty states everywhere, with a banner pointing the operator at `npm run scrape`.

## Live page

Pool nights are **Tuesdays 7:30 – 11:30 pm Eastern**. The `/live` route and the
home-page TikTok CTA auto-toggle between "Live now" (links to
`tiktok.com/@aaronbic/live`) and "Off air, next stream Tuesday 7:30 pm" (links
to the profile). The header and mobile tab bar grow a pulsing red dot during
the live window. The check is reactive — the UI flips at 7:30 pm without a
page refresh.

## Tagging clips

Add tags in the YouTube video description to auto-attach clips to a match or
player:

- `#match-12345` → shows on `/matches/12345`
- `#player-9876` → shows on `/roster/9876`

Multiple `#player-*` tags per video are fine.

## Player config

Per-player display overrides live in [data/players-config.json](data/players-config.json).
For each member-number you can set:

| Key             | Effect                                                        |
| --------------- | ------------------------------------------------------------- |
| `visible`       | `false` removes them from /roster and /leaderboard (matches keep working) |
| `nickname`      | Displayed instead of their APA name everywhere                |
| `profileImage`  | Square avatar (replaces initials in cards/rows). Path under public/, e.g. `/players/meghan.jpg` |
| `actionImage`   | Wide action shot used as the hero on `/roster/<id>`           |

Drop images in `public/players/` (any filename you like) and reference them
from the config. Run `npm run project` after editing — the values are baked
into `data/apa.json` so the site renders them server-side.

## Leaderboard scoring

| Event             | Points |
| ----------------- | ------ |
| Sweep (won, opponent scored 0)                                 | 1.0 |
| Mini-sweep (won, opponent didn't reach the hill)               | 0.5 |
| Break-and-run                                                  | 1.0 |
| 8-on-the-break                                                 | 1.0 |
| Skill-level up (each step up observed within a session)        | 1.0 |

The "hill" is decided by APA's published 8-Ball race chart given each
player's skill level **at the time of the match**. The chart lives at
[lib/apa/race.ts](lib/apa/race.ts) — edit there if a cell is wrong.

The leaderboard splits by session (current session is the default landing
view) and includes an "All Time" pill that aggregates across every session
in the cache. Roster, schedule, standings, and player profiles all support
the same `?session=` query string.

## Brand assets

The hero logo lives at `public/logo.png` (a styled placeholder). Drop the real
team logo PNG at `public/logo.png` (overwrite) or change the `src` in
`components/brand/Logo.tsx` to `/logo.png`.

## Deploying

The Next.js app reads `data/apa.json` at request time, so deployment is plain
Vercel (or any Node host). The scraper does **not** run on Vercel — it needs a
real Chromium and credentials. Two clean options:

1. **GitHub Actions cron** that runs `npm run sync` on a Tuesday morning,
   commits the updated `data/apa.json`, and pushes — Vercel redeploys
   automatically.
2. **Local + manual push** — run `npm run sync` on your machine, commit, push.

Either way, `data/cache/` is committed to the repo so the historical archive
travels with the code (small JSON files, version-controlled diffs are clean).

## Scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm run start      # start prod server
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```
