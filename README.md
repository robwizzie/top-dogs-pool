# Top Dawgs

The official site for the **Top Dawgs** APA pool team — South Jersey.

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
| `NEXT_PUBLIC_SUPABASE_URL`  | for `/rack`       | Supabase project URL for the Rack Up section (public)      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | for `/rack` | Supabase publishable key (public). `NEXT_PUBLIC_SUPABASE_ANON_KEY` also accepted. Never the secret key. |

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

## Rack Up — live scoring (`/rack`)

A second, interactive half of the site: score a match at the table from your
phone, run a tournament bracket, log practice drills, and put the scoreboard on
a TV. It is the old [rack-up](https://github.com/robwizzie/rack-up) Lovable
project rebuilt in this codebase.

```
phone (scorer)  ─┐
phone (scorer)  ─┼─→  rack_append_match_event()  ─→  matches.live_state + match_events
TV display      ─┘         (compare-and-swap)              │
                                                           ▼
                                        realtime ──→ every device re-renders
```

### How a match is stored

A match is an **immutable setup** plus an **append-only event log**. Current
state is always `replay(setup, events)` — see
[lib/rack/rules/match.ts](lib/rack/rules/match.ts). `matches.live_state` caches
the fold so a spectator or the TV can read the whole scoreboard in one row.

Every tap goes through `rack_append_match_event()`, which compare-and-swaps on
`matches.version`. If another device scored first, the call returns
`conflict = true` with the authoritative state rather than overwriting, and the
client replays on top. Undo truncates the log and re-snapshots, so it is exact
rather than a hand-written inverse per action.

When a match ends, `rack_finalize_match()` settles it into `match_players`,
`player_stats` and `head_to_head`, once, guarded by `finalized_at` under a row
lock.

### Handicaps

8-ball races come from the same chart the leaderboard scores against
([lib/apa/race.ts](lib/apa/race.ts)) — asymmetric, so the lower skill level gets
the shorter race. 9-ball is point-based off the APA 9-ball chart; a rack is 10
points (8 balls + 2 for the nine). A match will not start if either player is
missing a skill level for the game being played.

### Playing someone without an account

One phone is enough. A **guest** is somebody you enter by name and skill level
so a match can be set up and scored entirely from the host's device — the other
player never signs up.

A guest is a `profiles` row, not a second kind of player. Every table that
identifies a player (`match_players`, `player_stats`, `head_to_head`,
`room_players`, `tournament_players`, `practice_session_players`) references
`profiles(id)`, so a parallel identity type would have meant a nullable guest
column and a two-branch join on all six, in every query, forever. One identity
type leaves all of them — and `rack_finalize_match()` — untouched, which is also
why a guest accumulates a real record: *Dave is 3–1 against you* needs no new
code.

The cost is the foreign key from `profiles.id` to `auth.users(id)`, which a
guest cannot satisfy. It is gone, replaced by an explicit delete trigger that
does the same cascade. Two columns take its place:

| column | meaning |
| --- | --- |
| `is_guest` | has no login |
| `guest_owner` | the account that entered them, and may edit or remove them |

A check constraint keeps the pair agreeing, RLS confines inserts, updates and
deletes to guests you own, and the `profiles` guard trigger refuses any client
update that flips `is_guest` or moves `guest_owner` — so the guest door cannot
be used to mint an account or to edit somebody else's. `rack_can_score_match()`
additionally admits a guest's owner, so whoever entered them can score for them
at a table someone else is hosting.

Guests belong to the account, not the table: you add Dave once and he is there
every week, with the record he has built up.

### Closing a table

The host can **close** a table — it leaves the tables list and stops accepting
matches, while every match it hosted, and everyone's record, stays. Deleting is
separate and rarer: it removes the table and its scoresheets, but lifetime
totals already settled by `rack_finalize_match()` live in `player_stats` and
`head_to_head`, which hang off profiles rather than rooms, so they survive.

### Its own app

Rack Up does not share the site's chrome. `app/layout.tsx` is the document
shell and nothing more; the Top Dawgs header, season banner, mobile tab bar,
footer, cart and command palette live in `app/(site)/layout.tsx`, and `/rack`
sits outside that group with its own header and footer. Two navbars and two
design languages on one screen was the thing to avoid.

Route groups don't affect URLs — `app/(site)/roster` is still `/roster`.

Inside the section there's a second split: `app/rack/(app)/` carries the Rack Up
shell, while `/rack/display/<code>` sits outside it and gets only the theme
canvas, because a TV scoreboard needs no navigation at all.

`app/not-found.tsx` brings the site header and footer along itself, since it
renders in the bare root layout.

### Its own skin

Rack Up is styled as a separate app rather than another page of the team site:
the retro 8-ball badge, the outlined RackUp wordmark (Lilita One), Poppins
headings, chalk-blue/coral/gold on warm surfaces, and a light/dark toggle. All
of it lives in `app/rack/rack.css` under `[data-rack]`, so the section's tokens
and the site's felt-and-brass ones never touch each other.

The look is the original Lovable app's, kept deliberately. What changed is
polish: dark mode has depth rather than being flat slate, elevation is a real
three-step scale, every foreground/background pair clears 4.5:1 contrast (muted
text on cream was about 3.4:1), and focus states exist.

### Connection to the league side

A Rack Up profile can be linked to an APA roster player. Once linked, that
player's Rack Up record appears on their `/roster/<id>` page, **and their roster
photo and skill level are imported automatically** — nobody retypes what the
league already knows. `profiles.apa_imported_at` makes that a one-time import,
so a later manual edit is never silently overwritten; there's a re-sync button
for when it should be.

**Linking is not self-service.** Anyone can create an account here, so a
dropdown of roster names would let a stranger — or a team-mate — attach their
account to someone else's page. Instead:

```
player  → rack_request_roster_claim(member_id, note)   → pending
admin   → rack_decide_roster_claim(claim_id, true)     → linked + imported
```

A trigger on `profiles` refuses any client update that moves `apa_member_id` or
`is_admin`, so the claim flow isn't something the client can skip by PATCHing
the column directly. Updates without a JWT — the SQL editor, migrations, the
service role — pass, which is how the first admin gets promoted.

Unlinking yourself needs no approval: it only ever removes a claim.

**Bootstrap the first admin** in the SQL editor, once:

```sql
update public.profiles set is_admin = true
 where id = (select id from auth.users where email = 'you@example.com');
```

Admins then see an **Admin** tab in the Rack Up header, listing open claims with
who is asking, which player they say they are, and whatever note they left.

**Rack Up results never touch Patch Watch.** The leaderboard stays sourced from
APA scoresheets plus hand-entered tournament results, so a casual Tuesday
session cannot move the standings. The link is display-only in both directions.

### Setup

The section runs on its own Supabase project, created and owned by us. (It
began life on a Lovable-provisioned backend, which is why the old rack-up repo
points at a different project — that one lives on infrastructure Lovable
controls, with no dashboard access, no service-role key and no `pg_dump`. This
schema is standalone precisely so none of that matters.)

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
   (any region near the team; the free tier is plenty).

2. Apply everything in
   [`supabase/migrations/`](supabase/migrations/) in filename order — every
   table, policy, function, trigger, the avatars bucket and the realtime
   publication. The first file stands the whole schema up on its own; the
   later ones add roster claims and guest players. They are idempotent, so
   applying them twice is harmless. Either route works:

   - **SQL Editor → New query →** paste the file → Run. Immediate, and the
     right choice the first time.
   - **The GitHub integration**, which watches `supabase/migrations/` and
     applies new files when the configured branch updates. `supabase/config.toml`
     carries the project ref it needs. Note that it only runs on *pushes to the
     branch it is configured for* — usually `main` — so on a feature branch the
     migration lands when the PR merges, not before.

3. **Project Settings → API** → copy into `.env.local`, and into Vercel scoped
   to Production, Preview and Development:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   ```

   That page lists a **Publishable key** and a **Secret key**. Use the
   publishable one — it's the renamed anon key, meant to ship to browsers.
   The secret key (formerly `service_role`) bypasses row-level security, and a
   `NEXT_PUBLIC_*` value is compiled into the client bundle and served to every
   visitor, so putting it there would hand the database to anyone who opens the
   site. `lib/rack/supabase/env.ts` refuses to start on either the
   `sb_secret_…` prefix or a legacy JWT claiming `service_role`, but treat that
   as a backstop, not a licence to paste carelessly.

   `NEXT_PUBLIC_SUPABASE_ANON_KEY` is still accepted as the variable name for
   projects created before the rename. Leave both blank to disable the section;
   `/rack` then shows a setup notice and the rest of the site is unaffected.

4. **Authentication → URL Configuration** → set the Site URL to the deployed
   site and add the preview domains to Redirect URLs, or sign-up confirmation
   emails will bounce people somewhere unhelpful. For a team this small it is
   reasonable to turn *Confirm email* off under **Authentication → Providers →
   Email**, which makes sign-up a single step at the table.

That's the whole setup. Realtime needs no clicking — the schema adds the tables
to the `supabase_realtime` publication itself. To confirm:

```sql
select tablename from pg_publication_tables
 where pubname = 'supabase_realtime' order by tablename;
```

### Schema notes

A few things are deliberately *absent* compared with the original app's
database, and they matter:

- **No stats triggers.** The old schema updated `player_stats` and
  `head_to_head` from triggers on `matches.winner_id`. `rack_finalize_match()`
  does the same job, so keeping both would have counted every win twice. There
  is exactly one write path for lifetime stats.
- **No `action_history` / `rack_innings` / `current_player_index`.** Superseded
  by the `live_state` snapshot and the `match_events` log.
- **No client write access to `match_events`, `match_players`, `player_stats`
  or `head_to_head`.** They are written only by the definer functions. That is
  what stops someone editing their own career record from a browser console.

### Tests

```bash
npm run test:rack            # rules engine + bracket engine (pure, fast)
./tests/rack/run-rpc-test.sh # stands up a throwaway Postgres and exercises the SQL
```

The RPC test stands up an empty Postgres with the Supabase bits stubbed,
applies `supabase/migrations/` to it, then runs every `tests/rack/*.test.sql`.
Between them they assert the signup trigger, optimistic concurrency, undo,
scoring authorisation, that the finaliser cannot double-count a win, and that
roster claims cannot be self-approved or bypassed. It needs `postgresql`
installed locally and nothing else — the schema is self-contained.

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
npm run test:rack  # Rack Up rules + bracket engines
```
