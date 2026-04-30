# Top Dogs 🎱

The official site for the **Top Dogs** APA pool team — South Jersey.

Live roster, schedule, deep player stats, sweeps & mini-sweeps leaderboard,
match recaps with embedded clips, and a TikTok live link. **All match data is
pulled fresh from APA every hour** — nothing is hand-maintained.

## Stack

- **Next.js 15** (App Router, React 19, TypeScript)
- **Tailwind CSS v4** with brand tokens
- **Framer Motion** for tasteful animations
- **Cheerio** + **Zod** to scrape and validate the public APA team page
- **YouTube Data API v3** for the highlight reel
- **next-themes** for dark (default) / light toggle
- **canvas-confetti** for sweep celebrations
- **Vercel** for hosting (auto-deploy on push)

## Getting started

```bash
cp .env.example .env.local
# fill in the env vars below

npm install
npm run dev
```

Open <http://localhost:3000>.

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `APA_TEAM_URL` | yes (default set) | Public APA team page to scrape every hour |
| `YOUTUBE_API_KEY` | optional | Enables the Clips section + Hero highlight reel |
| `YOUTUBE_PLAYLIST_ID` | optional | Playlist to pull clips from |
| `NEXT_PUBLIC_TIKTOK_HANDLE` | optional | TikTok username for the Live CTA (default `topdogspool`) |
| `REVALIDATE_SECRET` | recommended | Secret for `POST /api/revalidate` to force a fresh scrape |
| `NEXT_PUBLIC_SITE_URL` | recommended | Used by `sitemap.xml` / `robots.txt` |

The site renders gracefully when optional vars are missing — clips show a
polished empty state, leaderboard shows zeros until matches play, etc.

## How the data pipeline works

```
APA team page (public, no login)
        │
        ▼
  lib/apa/client.ts        ← cached fetch (1h ISR, tag "apa")
        │
        ▼
  lib/apa/scraper.ts       ← Cheerio parsers (Zod-validated)
        │
        ▼
  lib/apa/index.ts         ← getTeam / getRoster / getSchedule / getMatch / getStandings / getLeaderboard
        │
        ▼
  app/**/page.tsx          ← server components consume the typed data
```

`lib/apa/sweeps.ts` derives the sweeps & mini-sweeps leaderboard purely from
match results — no manual entry, no separate datastore. New match → next
revalidation cycle (≤1h) → leaderboard updates automatically.

### Forcing a refresh

```bash
curl -X POST -H "Authorization: Bearer $REVALIDATE_SECRET" \
  https://your-site.example.com/api/revalidate
```

## Tagging clips

Add tags in the YouTube video description to auto-attach clips to a match or
player:

- `#match-12345` → shows on `/matches/12345`
- `#player-9876` → shows on `/roster/9876`

Multiple `#player-*` tags per video are fine.

## Brand assets

The hero logo lives at `public/logo.svg` (a styled placeholder). Drop the real
team logo PNG at `public/logo.svg` (overwrite) or change the `src` in
`components/brand/Logo.tsx` to `/logo.png`.

## Deploy

Push to `main` on Vercel and set the env vars in the Vercel dashboard. ISR will
take care of keeping data fresh.

## Scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm run start      # start prod server
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```
