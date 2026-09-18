-- ===========================================================================
-- Rack Up — complete schema
-- ===========================================================================
-- Stands the whole Rack Up backend up from an empty Supabase project. Paste it
-- into the SQL editor of a brand-new project and it is ready to use.
--
-- This replaces the earlier pair of migrations, which were written to move the
-- Lovable app's existing database forward. That approach carried the old
-- schema's baggage and, worse, its triggers: the Lovable database fires
-- `update_player_stats_trigger` and `update_head_to_head_on_match_complete`
-- on `AFTER UPDATE OF winner_id … WHEN (NEW.winner_id IS NOT NULL AND
-- OLD.winner_id IS NULL)`, which is precisely what completing a match does
-- here — so those triggers and `rack_finalize_match()` would each have counted
-- the same win. Owning the schema outright removes that class of problem:
-- there is exactly one path that writes lifetime stats.
--
-- Deliberately not carried over from the old schema:
--
--   · `matches.action_history` / `current_player_index` / `rack_innings` /
--     `total_innings` — superseded by the `live_state` snapshot and the
--     `match_events` log.
--   · `matches.match_type` — a duplicate of `game_type`.
--   · `profiles.patches` / `favorite_music` — unused by this app.
--   · `tournament_stats` and its trigger — nothing reads it; tournament
--     results are derived from the bracket.
--   · The stats triggers above — `rack_finalize_match()` owns that job.
--
-- Row-level security is locked down from the start. The old database let any
-- signed-in user UPDATE any match and edit anyone's career record; here the
-- only write path for scoring is a SECURITY DEFINER function that checks the
-- caller.
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.rack_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  name                text not null,
  avatar_url          text,
  -- Per-game skill levels, e.g. {"8-ball": 5, "9-ball": 4}. `skill_level` is
  -- the fallback when a game has no specific entry.
  skill_level         integer,
  skill_levels        jsonb not null default '{}'::jsonb,
  preferred_game_type text,
  -- APA member number. Links this account to a roster player on the main site
  -- so their Rack Up record shows on /roster/<id>. Display-only: nothing here
  -- feeds the Patch Watch leaderboard.
  apa_member_id       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Partial, so the many unlinked profiles don't collide on null.
create unique index if not exists profiles_apa_member_id_key
  on public.profiles (apa_member_id)
  where apa_member_id is not null;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.rack_touch_updated_at();

-- Give every new account a profile. `name` comes from the sign-up metadata the
-- auth form sends, falling back to the local part of the email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------

create table if not exists public.rooms (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  name             text not null,
  created_by       uuid not null references auth.users (id) on delete cascade,
  current_match_id uuid,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists rooms_active_idx on public.rooms (is_active, created_at desc);

create table if not exists public.room_players (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.rooms (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create index if not exists room_players_room_idx on public.room_players (room_id);

-- ---------------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------------

create table if not exists public.matches (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references public.rooms (id) on delete cascade,
  game_type           text not null default '8-ball',
  is_casual           boolean not null default false,
  status              text not null default 'in_progress',
  -- Immutable setup: game, both players, skill levels and targets. Replaying
  -- match_events over this reproduces live_state exactly.
  setup               jsonb,
  -- Materialised MatchState snapshot — what spectators and the TV display read
  -- in a single row rather than reassembling from several tables.
  live_state          jsonb,
  -- Sequence number of the last applied event; the compare-and-swap target.
  version             integer not null default 0,
  -- Both participants, denormalised so authorisation needs no join.
  player_ids          uuid[] not null default '{}'::uuid[],
  winner_id           uuid references public.profiles (id) on delete set null,
  tournament_match_id uuid,
  notes               text,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  -- Set once settled into the lifetime tables. The finaliser refuses to run
  -- twice, so a retry cannot inflate a record.
  finalized_at        timestamptz,
  created_at          timestamptz not null default now(),
  constraint matches_status_check check (status in ('in_progress', 'complete', 'abandoned')),
  constraint matches_game_type_check check (game_type in ('8-ball', '9-ball'))
);

create index if not exists matches_room_status_idx on public.matches (room_id, status);
create index if not exists matches_player_ids_idx on public.matches using gin (player_ids);

alter table public.rooms
  drop constraint if exists rooms_current_match_id_fkey;
alter table public.rooms
  add constraint rooms_current_match_id_fkey
  foreign key (current_match_id) references public.matches (id) on delete set null;

-- The scoresheet itself: append-only, one row per scoring action.
create table if not exists public.match_events (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  seq        integer not null,
  event      jsonb not null,
  actor_id   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint match_events_seq_unique unique (match_id, seq),
  constraint match_events_seq_positive check (seq > 0)
);

create index if not exists match_events_match_seq_idx on public.match_events (match_id, seq);

-- The settled per-player line, written once by rack_finalize_match().
create table if not exists public.match_players (
  id                 uuid primary key default gen_random_uuid(),
  match_id           uuid not null references public.matches (id) on delete cascade,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  score              integer not null default 0,
  race_to            integer not null,
  innings            integer not null default 0,
  safeties           integer not null default 0,
  defensive_shots    integer not null default 0,
  timeouts_used      integer not null default 0,
  timeouts_remaining integer not null default 0,
  break_and_runs     integer not null default 0,
  eight_on_breaks    integer not null default 0,
  rackless           integer not null default 0,
  broke_first        boolean not null default false,
  unique (match_id, user_id)
);

create index if not exists match_players_user_idx on public.match_players (user_id);

-- ---------------------------------------------------------------------------
-- Lifetime stats
-- ---------------------------------------------------------------------------

create table if not exists public.player_stats (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  game_type       text not null default '8-ball',
  matches_played  integer not null default 0,
  wins            integer not null default 0,
  losses          integer not null default 0,
  break_and_runs  integer not null default 0,
  eight_on_breaks integer not null default 0,
  total_innings   integer not null default 0,
  total_safeties  integer not null default 0,
  -- Positive = current winning streak, negative = losing streak.
  current_streak  integer not null default 0,
  longest_streak  integer not null default 0,
  skill_level     integer,
  unique (user_id, game_type)
);

-- Stored with the lower uuid first so a pairing has exactly one row.
create table if not exists public.head_to_head (
  id              uuid primary key default gen_random_uuid(),
  player1_id      uuid not null references public.profiles (id) on delete cascade,
  player2_id      uuid not null references public.profiles (id) on delete cascade,
  player1_wins    integer not null default 0,
  player2_wins    integer not null default 0,
  last_match_date timestamptz,
  unique (player1_id, player2_id),
  constraint head_to_head_ordered check (player1_id < player2_id)
);

-- ---------------------------------------------------------------------------
-- Tournaments
-- ---------------------------------------------------------------------------

create table if not exists public.tournaments (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  name         text not null,
  game_type    text not null default '8-ball',
  bracket_type text not null default 'single',
  -- The whole bracket, generated once at seeding: every match it can contain,
  -- with slots referencing other matches. Never re-derived from win counts.
  bracket      jsonb,
  -- Seed number -> user id. Seeds past the entrant count are byes.
  seeds        jsonb,
  status       text not null default 'pending',
  winner_id    uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz,
  constraint tournaments_bracket_type_check check (bracket_type in ('single', 'double')),
  constraint tournaments_status_check check (status in ('pending', 'in_progress', 'complete'))
);

create index if not exists tournaments_room_idx on public.tournaments (room_id, status);

create table if not exists public.tournament_players (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  seed           integer not null,
  placement      integer,
  eliminated_at  timestamptz,
  created_at     timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table if not exists public.tournament_matches (
  id               uuid primary key default gen_random_uuid(),
  tournament_id    uuid not null references public.tournaments (id) on delete cascade,
  -- Stable bracket slot, e.g. "W1-3", "L2-1", "GF".
  bracket_match_id text,
  round            integer not null,
  match_number     integer not null,
  bracket          text not null default 'winners',
  player1_id       uuid references public.profiles (id) on delete set null,
  player2_id       uuid references public.profiles (id) on delete set null,
  winner_id        uuid references public.profiles (id) on delete set null,
  -- The live match this slot is being played as, if any.
  match_id         uuid references public.matches (id) on delete set null,
  status           text not null default 'pending',
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- Deliberately NOT partial. A client upsert emits
-- `ON CONFLICT (tournament_id, bracket_match_id)` with no WHERE clause, and
-- Postgres will not infer a partial index from that — it fails at runtime on
-- the first recorded result. Nulls are distinct for uniqueness, so this still
-- permits rows that aren't tied to a bracket slot.
create unique index if not exists tournament_matches_slot_key
  on public.tournament_matches (tournament_id, bracket_match_id);

-- ---------------------------------------------------------------------------
-- Practice
-- ---------------------------------------------------------------------------

create table if not exists public.practice_sessions (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  -- JSON-encoded [{id, target}] — see lib/rack/rules/drills.ts.
  drill_type text not null,
  created_at timestamptz not null default now(),
  ended_at   timestamptz
);

create table if not exists public.practice_session_players (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.practice_sessions (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  score        integer not null default 0,
  attempts     integer not null default 0,
  drill_scores jsonb not null default '{}'::jsonb,
  unique (session_id, user_id)
);

create table if not exists public.practice_stats (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  drill_type     text not null,
  best_score     integer not null default 0,
  completions    integer not null default 0,
  total_attempts integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, drill_type)
);

drop trigger if exists practice_stats_touch_updated_at on public.practice_stats;
create trigger practice_stats_touch_updated_at
  before update on public.practice_stats
  for each row execute function public.rack_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Authorisation helper
-- ---------------------------------------------------------------------------

create or replace function public.rack_can_score_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    join public.rooms r on r.id = m.room_id
    where m.id = p_match_id
      and (
        r.created_by = auth.uid()          -- the room host
        or auth.uid() = any(m.player_ids)  -- either player at the table
      )
  );
$$;

comment on function public.rack_can_score_match(uuid) is
  'True when the caller may score this match: the room host, or one of the two players.';

-- ---------------------------------------------------------------------------
-- Scoring: atomic append with optimistic concurrency
-- ---------------------------------------------------------------------------

create or replace function public.rack_append_match_event(
  p_match_id         uuid,
  p_expected_version integer,
  p_event            jsonb,
  p_state            jsonb
)
returns table (version integer, live_state jsonb, conflict boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_current integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not public.rack_can_score_match(p_match_id) then
    raise exception 'not allowed to score this match' using errcode = '42501';
  end if;

  -- Serialise concurrent scorers here rather than letting them race through
  -- read-modify-write on the client.
  select m.version into v_current
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception 'match % not found', p_match_id using errcode = 'P0002';
  end if;

  -- Someone else got there first. Hand back the truth and let the caller
  -- replay on top of it instead of clobbering their work.
  if v_current <> p_expected_version then
    return query
      select m.version, m.live_state, true
      from public.matches m
      where m.id = p_match_id;
    return;
  end if;

  insert into public.match_events (match_id, seq, event, actor_id)
  values (p_match_id, p_expected_version + 1, p_event, auth.uid());

  update public.matches m
     set version    = p_expected_version + 1,
         live_state = p_state,
         status     = coalesce(p_state ->> 'status', m.status),
         ended_at   = case
                        when p_state ->> 'status' = 'complete' then coalesce(m.ended_at, now())
                        else null
                      end,
         winner_id  = case
                        when p_state ->> 'status' = 'complete'
                             and (p_state ->> 'winner') is not null
                        then (
                          p_state -> 'players'
                                  -> (p_state ->> 'winner')::int
                                  ->> 'userId'
                        )::uuid
                        else null
                      end
   where m.id = p_match_id;

  return query
    select m.version, m.live_state, false
    from public.matches m
    where m.id = p_match_id;
end;
$$;

comment on function public.rack_append_match_event is
  'Appends one scoring event under a compare-and-swap on matches.version. Returns conflict=true with the authoritative state instead of overwriting when the caller is behind.';

-- ---------------------------------------------------------------------------
-- Undo
-- ---------------------------------------------------------------------------

create or replace function public.rack_rewind_match(
  p_match_id   uuid,
  p_to_version integer,
  p_state      jsonb
)
returns table (version integer, live_state jsonb, conflict boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_current integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not public.rack_can_score_match(p_match_id) then
    raise exception 'not allowed to score this match' using errcode = '42501';
  end if;

  select m.version into v_current
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception 'match % not found', p_match_id using errcode = 'P0002';
  end if;

  if p_to_version < 0 or p_to_version >= v_current then
    return query
      select m.version, m.live_state, true
      from public.matches m
      where m.id = p_match_id;
    return;
  end if;

  delete from public.match_events
   where match_id = p_match_id
     and seq > p_to_version;

  update public.matches m
     set version    = p_to_version,
         live_state = p_state,
         status     = coalesce(p_state ->> 'status', 'in_progress'),
         ended_at   = case when p_state ->> 'status' = 'complete' then m.ended_at else null end,
         winner_id  = case
                        when p_state ->> 'status' = 'complete'
                             and (p_state ->> 'winner') is not null
                        then (
                          p_state -> 'players'
                                  -> (p_state ->> 'winner')::int
                                  ->> 'userId'
                        )::uuid
                        else null
                      end
   where m.id = p_match_id;

  return query
    select m.version, m.live_state, false
    from public.matches m
    where m.id = p_match_id;
end;
$$;

comment on function public.rack_rewind_match is
  'Undo: drops every event after p_to_version and stores the replayed snapshot. Exact by construction — there are no per-action inverses to get wrong.';

-- ---------------------------------------------------------------------------
-- Settling a finished match
-- ---------------------------------------------------------------------------
-- The ONLY thing that writes player_stats and head_to_head. The old schema
-- also had triggers doing this on winner_id, which would double-count against
-- this function; they are deliberately absent.

create or replace function public.rack_finalize_match(p_match_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_state     jsonb;
  v_finalized timestamptz;
  v_casual    boolean;
  v_game      text;
  v_winner    uuid;
  v_side      int;
  v_player    jsonb;
  v_user      uuid;
  v_won       boolean;
  v_a         uuid;
  v_b         uuid;
begin
  if not public.rack_can_score_match(p_match_id) then
    raise exception 'not allowed to finalize this match' using errcode = '42501';
  end if;

  -- Lock before reading finalized_at so two clients racing to settle the same
  -- match serialise here and only one does the work. Without this the counters
  -- below are `+ 1` on every call and a retry inflates a player's record.
  select m.live_state, m.winner_id, m.finalized_at
    into v_state, v_winner, v_finalized
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found or v_finalized is not null then
    return; -- already settled
  end if;

  if v_state is null or v_state ->> 'status' <> 'complete' then
    return; -- nothing to settle yet
  end if;

  v_casual := coalesce((v_state ->> 'isCasual')::boolean, false);
  v_game   := coalesce(v_state ->> 'game', '8-ball');

  for v_side in 0..1 loop
    v_player := v_state -> 'players' -> v_side;
    v_user   := (v_player ->> 'userId')::uuid;
    v_won    := (v_winner is not null and v_user = v_winner);

    insert into public.match_players (
      match_id, user_id, score, race_to, innings, safeties,
      defensive_shots, timeouts_used, timeouts_remaining,
      break_and_runs, eight_on_breaks, rackless, broke_first
    )
    values (
      p_match_id, v_user,
      (v_player ->> 'score')::int,
      (v_player ->> 'target')::int,
      (v_player ->> 'innings')::int,
      (v_player ->> 'safeties')::int,
      (v_player ->> 'defensiveShots')::int,
      (v_player ->> 'timeoutsUsed')::int,
      (v_player ->> 'timeoutsRemaining')::int,
      (v_player ->> 'breakAndRuns')::int,
      (v_player ->> 'eightOnBreaks')::int,
      (v_player ->> 'rackless')::int,
      (v_player ->> 'brokeFirst')::boolean
    )
    on conflict (match_id, user_id) do update set
      score              = excluded.score,
      race_to            = excluded.race_to,
      innings            = excluded.innings,
      safeties           = excluded.safeties,
      defensive_shots    = excluded.defensive_shots,
      timeouts_used      = excluded.timeouts_used,
      timeouts_remaining = excluded.timeouts_remaining,
      break_and_runs     = excluded.break_and_runs,
      eight_on_breaks    = excluded.eight_on_breaks,
      rackless           = excluded.rackless,
      broke_first        = excluded.broke_first;

    continue when v_casual;

    insert into public.player_stats (
      user_id, game_type, matches_played, wins, losses,
      break_and_runs, eight_on_breaks, total_innings, total_safeties,
      current_streak, longest_streak
    )
    values (
      v_user, v_game, 1,
      case when v_won then 1 else 0 end,
      case when v_won then 0 else 1 end,
      (v_player ->> 'breakAndRuns')::int,
      (v_player ->> 'eightOnBreaks')::int,
      (v_player ->> 'innings')::int,
      (v_player ->> 'safeties')::int,
      case when v_won then 1 else -1 end,
      case when v_won then 1 else 0 end
    )
    on conflict (user_id, game_type) do update set
      matches_played  = public.player_stats.matches_played + 1,
      wins            = public.player_stats.wins   + case when v_won then 1 else 0 end,
      losses          = public.player_stats.losses + case when v_won then 0 else 1 end,
      break_and_runs  = public.player_stats.break_and_runs  + (v_player ->> 'breakAndRuns')::int,
      eight_on_breaks = public.player_stats.eight_on_breaks + (v_player ->> 'eightOnBreaks')::int,
      total_innings   = public.player_stats.total_innings   + (v_player ->> 'innings')::int,
      total_safeties  = public.player_stats.total_safeties  + (v_player ->> 'safeties')::int,
      current_streak  = case
                          when v_won then greatest(public.player_stats.current_streak, 0) + 1
                          else least(public.player_stats.current_streak, 0) - 1
                        end,
      longest_streak  = greatest(
                          public.player_stats.longest_streak,
                          case when v_won then greatest(public.player_stats.current_streak, 0) + 1 else 0 end
                        );
  end loop;

  if not v_casual and v_winner is not null then
    v_a := least((v_state -> 'players' -> 0 ->> 'userId')::uuid,
                 (v_state -> 'players' -> 1 ->> 'userId')::uuid);
    v_b := greatest((v_state -> 'players' -> 0 ->> 'userId')::uuid,
                    (v_state -> 'players' -> 1 ->> 'userId')::uuid);

    insert into public.head_to_head (player1_id, player2_id, player1_wins, player2_wins, last_match_date)
    values (
      v_a, v_b,
      case when v_winner = v_a then 1 else 0 end,
      case when v_winner = v_b then 1 else 0 end,
      now()
    )
    on conflict (player1_id, player2_id) do update set
      player1_wins    = public.head_to_head.player1_wins + case when v_winner = v_a then 1 else 0 end,
      player2_wins    = public.head_to_head.player2_wins + case when v_winner = v_b then 1 else 0 end,
      last_match_date = now();
  end if;

  update public.matches set finalized_at = now() where id = p_match_id;
end;
$$;

comment on function public.rack_finalize_match is
  'Settles a completed match into match_players / player_stats / head_to_head, exactly once, guarded by finalized_at under a row lock.';

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
-- Reading is open: the scoreboard, the TV display and the stats pages are all
-- meant to be watchable without an account. Writing is narrow.

alter table public.profiles                 enable row level security;
alter table public.rooms                    enable row level security;
alter table public.room_players             enable row level security;
alter table public.matches                  enable row level security;
alter table public.match_events             enable row level security;
alter table public.match_players            enable row level security;
alter table public.player_stats             enable row level security;
alter table public.head_to_head             enable row level security;
alter table public.tournaments              enable row level security;
alter table public.tournament_players       enable row level security;
alter table public.tournament_matches       enable row level security;
alter table public.practice_sessions        enable row level security;
alter table public.practice_session_players enable row level security;
alter table public.practice_stats           enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'rooms', 'room_players', 'matches', 'match_events',
    'match_players', 'player_stats', 'head_to_head', 'tournaments',
    'tournament_players', 'tournament_matches', 'practice_sessions',
    'practice_session_players', 'practice_stats'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select using (true)',
      t || '_select', t
    );
  end loop;
end $$;

-- Profiles: you may only edit your own. The unique index on apa_member_id is
-- what stops two accounts claiming the same roster player.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- Rooms: anyone signed in can open one; only the host can change or close it.
drop policy if exists rooms_insert on public.rooms;
create policy rooms_insert on public.rooms
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists rooms_update_host on public.rooms;
create policy rooms_update_host on public.rooms
  for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists rooms_delete_host on public.rooms;
create policy rooms_delete_host on public.rooms
  for delete to authenticated using (created_by = auth.uid());

-- Room membership: join and leave as yourself; the host can remove anyone.
drop policy if exists room_players_insert_self on public.room_players;
create policy room_players_insert_self on public.room_players
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists room_players_delete on public.room_players;
create policy room_players_delete on public.room_players
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.created_by = auth.uid()
    )
  );

-- Matches: created from the client (a plain insert with no state to race on)
-- by someone in the room. Scoring updates arrive only through the definer
-- functions above, which bypass RLS and do their own checks; the update policy
-- here is just for the host abandoning a match.
drop policy if exists matches_insert_member on public.matches;
create policy matches_insert_member on public.matches
  for insert to authenticated
  with check (
    exists (
      select 1 from public.rooms r
      where r.id = room_id
        and (
          r.created_by = auth.uid()
          or exists (
            select 1 from public.room_players rp
            where rp.room_id = r.id and rp.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists matches_update_host on public.matches;
create policy matches_update_host on public.matches
  for update to authenticated
  using (
    exists (select 1 from public.rooms r where r.id = room_id and r.created_by = auth.uid())
  )
  with check (
    exists (select 1 from public.rooms r where r.id = room_id and r.created_by = auth.uid())
  );

-- match_events, match_players, player_stats and head_to_head are written
-- exclusively by the definer functions. No client-side write policy exists for
-- them on purpose: that is what stops someone rewriting history or editing
-- their own career record from a browser console.

-- Tournaments: the host runs them.
drop policy if exists tournaments_insert_host on public.tournaments;
create policy tournaments_insert_host on public.tournaments
  for insert to authenticated
  with check (
    exists (select 1 from public.rooms r where r.id = room_id and r.created_by = auth.uid())
  );

drop policy if exists tournaments_update_host on public.tournaments;
create policy tournaments_update_host on public.tournaments
  for update to authenticated
  using (
    exists (select 1 from public.rooms r where r.id = room_id and r.created_by = auth.uid())
  )
  with check (
    exists (select 1 from public.rooms r where r.id = room_id and r.created_by = auth.uid())
  );

do $$
declare
  t text;
begin
  foreach t in array array['tournament_players', 'tournament_matches'] loop
    execute format('drop policy if exists %I on public.%I', t || '_host_all', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
      using (
        exists (
          select 1 from public.tournaments tt
          join public.rooms r on r.id = tt.room_id
          where tt.id = tournament_id and r.created_by = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.tournaments tt
          join public.rooms r on r.id = tt.room_id
          where tt.id = tournament_id and r.created_by = auth.uid()
        )
      )
    $f$, t || '_host_all', t);
  end loop;
end $$;

-- Practice: anyone in the room can run and score a session.
drop policy if exists practice_sessions_write on public.practice_sessions;
create policy practice_sessions_write on public.practice_sessions
  for all to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_id
        and (
          r.created_by = auth.uid()
          or exists (
            select 1 from public.room_players rp
            where rp.room_id = r.id and rp.user_id = auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.rooms r
      where r.id = room_id
        and (
          r.created_by = auth.uid()
          or exists (
            select 1 from public.room_players rp
            where rp.room_id = r.id and rp.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists practice_session_players_write on public.practice_session_players;
create policy practice_session_players_write on public.practice_session_players
  for all to authenticated
  using (
    exists (
      select 1
      from public.practice_sessions ps
      join public.rooms r on r.id = ps.room_id
      where ps.id = session_id
        and (
          r.created_by = auth.uid()
          or exists (
            select 1 from public.room_players rp
            where rp.room_id = r.id and rp.user_id = auth.uid()
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.practice_sessions ps
      join public.rooms r on r.id = ps.room_id
      where ps.id = session_id
        and (
          r.created_by = auth.uid()
          or exists (
            select 1 from public.room_players rp
            where rp.room_id = r.id and rp.user_id = auth.uid()
          )
        )
    )
  );

-- Practice stats roll up at the end of a session, written by whoever is
-- running it.
drop policy if exists practice_stats_write on public.practice_stats;
create policy practice_stats_write on public.practice_stats
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Avatars
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Each user owns a folder named after their uid, so nobody can overwrite
-- somebody else's picture.
drop policy if exists "Users manage their own avatar" on storage.objects;
create policy "Users manage their own avatar"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
-- One row update per tap keeps the room in sync, because `matches.live_state`
-- carries the whole scoreboard.

alter table public.matches            replica identity full;
alter table public.rooms              replica identity full;
alter table public.room_players       replica identity full;
alter table public.tournament_matches replica identity full;
alter table public.profiles           replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array[
    'matches', 'match_events', 'rooms', 'room_players',
    'tournament_matches', 'practice_session_players', 'profiles'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then
        raise notice 'publication supabase_realtime does not exist; skipping %', t;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

grant execute on function public.rack_can_score_match(uuid)                          to authenticated;
grant execute on function public.rack_append_match_event(uuid, integer, jsonb, jsonb) to authenticated;
grant execute on function public.rack_rewind_match(uuid, integer, jsonb)              to authenticated;
grant execute on function public.rack_finalize_match(uuid)                            to authenticated;
