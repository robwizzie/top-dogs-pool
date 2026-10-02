# Deploying to Cloudflare Workers (free plan)

The site runs on Cloudflare Workers through the official adapter,
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Everything here
is additive: Vercel and the Docker image build exactly as before and ignore
`wrangler.jsonc` / `open-next.config.ts`.

Cloudflare dashboard labels move around; where this guide names one, look for
the closest match.

## What you need

- A Cloudflare account (free plan is fine).
- Access to the GitHub repo `robwizzie/top-dogs-pool`.
- `poolmaxxing.com` added to Cloudflare as a zone (step 4). Workers custom
  domains only work on domains whose DNS is on Cloudflare.

## 1. Create the Worker from the GitHub repo

1. Cloudflare dashboard → **Workers & Pages** → **Create** → import a
   repository (connect GitHub and authorize the Cloudflare app for
   `robwizzie/top-dogs-pool` if asked).
2. Settings for the new Worker:

   | Setting | Value |
   |---|---|
   | Worker / project name | `top-dogs-pool` — **must equal `name` in `wrangler.jsonc`**, or the build fails |
   | Production branch | `main` |
   | Build command | `npx opennextjs-cloudflare build` |
   | Deploy command | `npx opennextjs-cloudflare deploy` |
   | Non-production branch deploy command | `npx opennextjs-cloudflare upload` |
   | Root directory / path | `/` (repo root) |

   Use `opennextjs-cloudflare deploy`, **not** the default `npx wrangler
   deploy`: the OpenNext deploy step is what uploads the prerendered pages
   (see Caching). With plain `wrangler deploy` the site still works but every
   page is rendered on demand.
3. Before the first build, add the **build** variables from the table below
   (in the build settings' variables section). Then save and deploy.

Dependencies are installed automatically from `package-lock.json`. A build
takes roughly 2–3 minutes.

## 2. Environment variables

`NEXT_PUBLIC_*` values are compiled into the bundle, so they belong in the
**build** variables (Worker → Settings → Build → Variables and secrets).
Everything read by server code at request time belongs in the **runtime**
variables (Worker → Settings → Variables and Secrets). Use the *Secret* type
for passwords and keys. Some values are needed in both places because pages
are also prerendered during the build.

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | build | `https://poolmaxxing.com` — used by robots.txt / sitemap.xml |
| `NEXT_PUBLIC_TIKTOK_HANDLE` | build | optional |
| `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` | build | storefront (all three together) |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN` | build | public Storefront token |
| `NEXT_PUBLIC_SHOPIFY_API_VERSION` | build | optional, default `2024-10` |
| `NEXT_PUBLIC_SUPABASE_URL` | build | Rack Up |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | build | the *publishable* key (`NEXT_PUBLIC_SUPABASE_ANON_KEY` also accepted). Never the secret key. |
| `YOUTUBE_API_KEY` | build **and** runtime (secret) | Clips + home highlight reel |
| `YOUTUBE_PLAYLIST_ID` | build **and** runtime | |
| `APA_TEAM_URL` | build and runtime | optional, has a default |
| `RESEARCH_PASSWORD` | runtime (secret) | `/research` password gate (middleware). Unset = no gate |
| `ADMIN_PASSWORD` | runtime (secret) | `/leaderboard/admin` (see limitations) |
| `REVALIDATE_SECRET` | runtime (secret) | `/api/revalidate` (see Caching) |
| `GEMINI_API_KEY` | runtime (secret) | `/api/shot-feedback`; `GOOGLE_GENERATIVE_AI_API_KEY` also accepted |
| `GEMINI_MODEL` | runtime | optional |

Not needed on Cloudflare: `APA_USERNAME`, `APA_PASSWORD` and the other
`APA_*` scraper settings — they live in GitHub Actions secrets only.
`wrangler.jsonc` sets `keep_vars: true`, so runtime variables set in the
dashboard survive each deploy. After changing a **build** variable, trigger a
new build (Deployments → retry, or push a commit).

## 3. Check it on workers.dev

The first deploy is reachable at `https://top-dogs-pool.<your-subdomain>.workers.dev`.
Note that the per-data-center page cache (below) does not run on workers.dev,
so pages may be slower there than on the real domain.

## 4. Move poolmaxxing.com

1. Cloudflare dashboard → **Add a domain** → `poolmaxxing.com` → Free plan.
   Cloudflare scans the existing DNS records.
2. At the domain registrar, replace the nameservers with the two Cloudflare
   gives you. Wait until Cloudflare shows the zone as active (minutes to a few
   hours).
3. In the zone's DNS records, **delete** the records that point at Vercel
   (`A 76.76.21.21`, `CNAME cname.vercel-dns.com`, for `poolmaxxing.com` and
   `www`). A custom domain cannot be added while a conflicting record exists.
   Keep any mail (MX/TXT) records.
4. Worker → Settings → Domains & Routes → Add → **Custom domain** →
   `poolmaxxing.com`. Repeat for `www.poolmaxxing.com` if you use it.
   Cloudflare creates the DNS record and certificate itself.
5. Vercel: Project → Settings → Domains → remove `poolmaxxing.com` (and
   `www`). Then disconnect the Git repository (or delete the project) so
   pushes stop building there too.

A plain CNAME from a DNS provider outside Cloudflare to `*.workers.dev` does
not work; the domain has to be a Cloudflare zone.

## 5. Data updates (the scraper)

Nothing changes in `.github/workflows/scrape-apa.yml`. It commits
`data/apa.json` and pushes to `main`; the Cloudflare GitHub app sees the push
and builds + deploys, exactly as Vercel did. (Pushes made with the Actions
`GITHUB_TOKEN` do not trigger other *Actions* workflows, but they do reach
external apps like Cloudflare's.) `data/apa.json` is bundled into the Worker
at build time — Workers have no filesystem — so a deploy is the only way new
data goes live, and every deploy replaces all cached pages.

## Caching (ISR) on the free plan

Configured in `open-next.config.ts`, with nothing to create in the dashboard:

- Pages prerendered by `next build` — every normal page, and on Cloudflare
  builds also every player (`/roster/[id]`), match (`/matches/[id]`) and
  opponent (`/opponents/[id]`) page (`lib/prerender.ts`) — are uploaded with
  the static assets and served from there.
- Pages rendered later (ISR revalidation after `revalidate` expires, session
  filter variants like `?session=…`, opp-vs-opp matches) are stored in the
  Workers Cache API of the data center that rendered them, for the page's
  `revalidate` window. A stale page is served immediately and refreshed in
  the background.

Trade-offs, compared with Vercel's global ISR cache:

- The Cache API is per data center and best effort, so the same page may be
  rendered once per region per hour. Fine for this site's traffic.
- `/api/revalidate` returns `ok` but does not purge anything. Pages refresh
  on their own `revalidate` timers (clips 6 h, store/live 5 min, the rest 1 h)
  or immediately on the next deploy.
- `/leaderboard/admin` can't save on Workers (no filesystem to write
  `data/tournaments.json`; it couldn't on Vercel either). Edit the file and
  commit it.

If a shared, durable cache is ever needed: create an R2 bucket (R2's free tier
needs a payment method on file), add it to `wrangler.jsonc` as
`NEXT_INC_CACHE_R2_BUCKET`, and swap the static-assets store in
`open-next.config.ts` for `r2IncrementalCache`
(see <https://opennext.js.org/cloudflare/caching>).

## Images

Workers have no built-in image optimizer, so Cloudflare builds use
`lib/cloudflare-image-loader.ts`: Shopify product images are resized by
Shopify's CDN (`?width=`), and everything else is served as the original file.
No Cloudflare Images quota is used. Vercel/Docker keep Next's optimizer.

## Free-plan limits to watch

- **Worker size**: 3 MiB gzipped. Currently ~2.6 MiB (`npx wrangler deploy
  --dry-run --outdir /tmp/cf` prints it after a build). The biggest pieces are
  Next.js itself, `data/apa.json` (~270 KiB gzipped) and the OG image renderer
  (`resvg.wasm`, ~520 KiB). If `apa.json` keeps growing, this is the number to
  check.
- **CPU**: 10 ms per request. Cached pages are well under it. A page rendered
  on demand (first hit of a filter variant, a background refresh, `/research`)
  can go over it, and `/leaderboard/share-image` (renders a PNG on every
  request) almost certainly does. Over the limit the request fails with
  Cloudflare error 1102. If that shows up in the Worker's logs, the fix is the
  Workers Paid plan ($5/month, 30 s CPU); no code changes needed.
- **Requests**: 100,000 per day (static files are free and unlimited).
- **Static assets**: 20,000 files per deploy (currently ~1,000).

## Local preview

```bash
npm run preview          # build for Workers and serve on http://localhost:8787
```

Runtime variables for the preview go in `.dev.vars` (git-ignored), e.g.
`RESEARCH_PASSWORD=…`. Build variables are read from the shell or `.env*`.
`npm run deploy` builds and deploys from your machine (`npx wrangler login`
first) — not needed once Workers Builds is connected.
