-- ===========================================================================
-- Rack Up v2 — core schema
-- ===========================================================================
-- Brings the Rack Up tables forward for the Top Dawgs site. Everything here is
-- ADDITIVE: new columns are nullable or defaulted and no existing policy is
-- dropped, so the old Lovable app keeps working while the new section is being
-- rolled out. The RLS tightening lives in the companion `_lockdown` migration,
-- which should only be applied once the old app is retired.
--
-- Three things change shape:
--
--   1. A match gains an authoritative `live_state` snapshot plus a `version`,
--      and every scoring action is appended to `match_events`. Previously each
--      tap wrote several un-coordinated UPDATEs across `matches` and
--      `match_players`, so two phones scoring the same match silently
--      overwrote each other and undo worked from hand-written inverses.
--
--   2. Tournaments store a fully-generated bracket up front instead of
--      inventing each round from win counts. `tournament_matches` rows are now
--      keyed by a stable bracket slot id ("W1-3", "L2-1", "GF").
--
--   3. `profiles` can point at an APA member number, which is what links a
--      Rack Up player to their roster page on the rest of the site.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Profiles ⇄ APA roster
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists apa_member_id text;

comment on column public.profiles.apa_member_id is
  'APA member number linking this Rack Up profile to a roster player on the main site. Null for guests and non-members.';

-- One Rack Up profile per APA member. Partial so unlinked profiles don't
-- collide on null.
create unique index if not exists profiles_apa_member_id_key
  on public.profiles (apa_member_id)
  where apa_member_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Matches: authoritative live state
-- ---------------------------------------------------------------------------

alter table public.matches
  add column if not exists setup jsonb,
  add column if not exists live_state jsonb,
  add column if not exists version integer not null default 0,
  add column if not exists status text not null default 'in_progress',
  add column if not exists player_ids uuid[] not null default '{}'::uuid[],
  add column if not exists tournament_match_id uuid,
  add column if not exists finalized_at timestamptz;

comment on column public.matches.finalized_at is
  'Set once the match has been settled into player_stats / head_to_head. The finaliser refuses to run twice, so a retried request cannot double-count a win.';

comment on column public.matches.setup is
  'Immutable match setup (game type, players, skill levels, targets). Replaying match_events over this reproduces live_state exactly.';
comment on column public.matches.live_state is
  'Materialised MatchState snapshot. Derived from setup + match_events; stored so spectators and the TV display can read the whole match in one row.';
comment on column public.matches.version is
  'Sequence number of the last applied event. Used for optimistic concurrency.';
comment on column public.matches.player_ids is
  'Both participants, denormalised so authorisation checks do not need a join.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_status_check'
  ) then
    alter table public.matches
      add constraint matches_status_check
      check (status in ('in_progress', 'complete', 'abandoned'));
  end if;
end $$;

create index if not exists matches_room_status_idx
  on public.matches (room_id, status);
create index if not exists matches_player_ids_idx
  on public.matches using gin (player_ids);

-- ---------------------------------------------------------------------------
-- 3. The event log
-- ---------------------------------------------------------------------------

create table if not exists public.match_events (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  seq         integer not null,
  event       jsonb not null,
  actor_id    uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint match_events_seq_unique unique (match_id, seq),
  constraint match_events_seq_positive check (seq > 0)
);

comment on table public.match_events is
  'Append-only log of scoring actions. The match scoresheet is this table; matches.live_state is a cache of folding it.';

create index if not exists match_events_match_seq_idx
  on public.match_events (match_id, seq);

alter table public.match_events enable row level security;

drop policy if exists "Match events are viewable by everyone" on public.match_events;
create policy "Match events are viewable by everyone"
  on public.match_events for select
  using (true);

-- No direct INSERT policy: events are only ever written by
-- rack_append_match_event(), which is SECURITY DEFINER and does its own
-- authorisation. That is what stops a client rewriting history.

-- ---------------------------------------------------------------------------
-- 4. Scoring authorisation helper
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
  'True when the caller may score this match: the room host, or one of the two players. The old app allowed only the host, which meant the match froze if their phone died.';

-- ---------------------------------------------------------------------------
-- 5. Atomic event append (optimistic concurrency)
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
  v_status  text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not public.rack_can_score_match(p_match_id) then
    raise exception 'not allowed to score this match' using errcode = '42501';
  end if;

  -- Lock the match row so two concurrent scorers serialise here rather than
  -- racing through read-modify-write on the client.
  select m.version, m.status into v_current, v_status
  from public.matches m
  where m.id = p_match_id
  for update;

  if not found then
    raise exception 'match % not found', p_match_id using errcode = 'P0002';
  end if;

  -- Somebody else got there first. Hand back the authoritative state and let
  -- the caller replay on top of it instead of clobbering their work.
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
  'Appends one scoring event under a compare-and-swap on matches.version. Returns conflict=true (with the authoritative state) instead of overwriting when the caller is behind.';

-- ---------------------------------------------------------------------------
-- 6. Rewind (undo) — truncate the log and re-snapshot
-- ---------------------------------------------------------------------------

create or replace function public.rack_rewind_match(
  p_match_id      uuid,
  p_to_version    integer,
  p_state         jsonb
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
-- 7. Finalising a match into the queryable tables
-- ---------------------------------------------------------------------------

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
  v_casual  boolean;
  v_game    text;
  v_winner  uuid;
  v_side    int;
  v_player  jsonb;
  v_user    uuid;
  v_won     boolean;
begin
  if not public.rack_can_score_match(p_match_id) then
    raise exception 'not allowed to finalize this match' using errcode = '42501';
  end if;

  -- Take the row lock *before* reading finalized_at, so two clients racing to
  -- settle the same match serialise here and only one of them does the work.
  -- Without this the lifetime counters below are `+ 1` on every call and a
  -- retried request silently inflates a player's record.
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

    -- Per-match row: the settled scoresheet line for this player.
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

    -- Lifetime stats, per game type.
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
      case when v_won then 1 else 0 end,
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

  -- Head to head, stored with the lower uuid first so a pair has one row.
  if not v_casual and v_winner is not null then
    declare
      v_a uuid := least((v_state -> 'players' -> 0 ->> 'userId')::uuid,
                        (v_state -> 'players' -> 1 ->> 'userId')::uuid);
      v_b uuid := greatest((v_state -> 'players' -> 0 ->> 'userId')::uuid,
                           (v_state -> 'players' -> 1 ->> 'userId')::uuid);
    begin
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
    end;
  end if;

  update public.matches set finalized_at = now() where id = p_match_id;
end;
$$;

comment on function public.rack_finalize_match is
  'Settles a completed match into match_players / player_stats / head_to_head. Idempotent per match via the unique keys below, so a double tap or a retried request cannot double-count a win.';

-- Uniqueness the finaliser's ON CONFLICT clauses rely on.
--
-- The baseline schema already declares all three (match_players
-- (match_id,user_id), player_stats (user_id,game_type), head_to_head
-- (player1_id,player2_id)), so there is nothing to create here — and nothing
-- to de-duplicate, because those constraints have always prevented duplicates.
-- What matters is that they are still present: without them the ON CONFLICT
-- targets above raise at runtime, on the first match anyone finishes. Fail
-- here, at migration time, with a message that says what to do instead.
do $$
declare
  missing text[] := '{}';
begin
  if not exists (
    select 1 from pg_index x join pg_class c on c.oid = x.indrelid
     where c.relname = 'match_players' and x.indisunique
       and pg_get_indexdef(x.indexrelid) like '%%(match_id, user_id)'
  ) then missing := missing || 'match_players (match_id, user_id)'; end if;

  if not exists (
    select 1 from pg_index x join pg_class c on c.oid = x.indrelid
     where c.relname = 'player_stats' and x.indisunique
       and pg_get_indexdef(x.indexrelid) like '%%(user_id, game_type)'
  ) then missing := missing || 'player_stats (user_id, game_type)'; end if;

  if not exists (
    select 1 from pg_index x join pg_class c on c.oid = x.indrelid
     where c.relname = 'head_to_head' and x.indisunique
       and pg_get_indexdef(x.indexrelid) like '%%(player1_id, player2_id)'
  ) then missing := missing || 'head_to_head (player1_id, player2_id)'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Rack Up v2 needs unique constraints that are missing: %. Add them (de-duplicating any existing rows first) before applying this migration.',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Tournaments: a real bracket, generated up front
-- ---------------------------------------------------------------------------

alter table public.tournaments
  add column if not exists bracket_type text not null default 'single',
  add column if not exists bracket jsonb,
  add column if not exists seeds jsonb;

comment on column public.tournaments.bracket is
  'The generated bracket graph: every match the tournament can contain, with slots referencing other matches. Drawn immediately, never re-derived from win counts.';
comment on column public.tournaments.seeds is
  'Seed number -> user id. Seeds beyond the entrant count are byes.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tournaments_bracket_type_check'
  ) then
    alter table public.tournaments
      add constraint tournaments_bracket_type_check
      check (bracket_type in ('single', 'double'));
  end if;
end $$;

alter table public.tournament_matches
  add column if not exists bracket_match_id text;

comment on column public.tournament_matches.bracket_match_id is
  'Stable bracket slot this row records a result for, e.g. "W1-3", "L2-1", "GF".';

create unique index if not exists tournament_matches_slot_key
  on public.tournament_matches (tournament_id, bracket_match_id)
  where bracket_match_id is not null;

-- ---------------------------------------------------------------------------
-- 9. Realtime
-- ---------------------------------------------------------------------------
-- The TV display and every phone in the room subscribe to these. `matches`
-- carries the whole scoreboard in live_state, so one row update per tap is
-- enough to keep the room in sync — the old app fanned out several row updates
-- per tap across two tables and let clients reassemble them, which is where
-- the drift came from.

alter table public.matches replica identity full;
alter table public.rooms replica identity full;
alter table public.tournament_matches replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.matches;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.match_events;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.rooms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.room_players;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.tournament_matches;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.practice_session_players;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Grants
-- ---------------------------------------------------------------------------

grant execute on function public.rack_can_score_match(uuid)        to authenticated;
grant execute on function public.rack_append_match_event(uuid, integer, jsonb, jsonb) to authenticated;
grant execute on function public.rack_rewind_match(uuid, integer, jsonb) to authenticated;
grant execute on function public.rack_finalize_match(uuid)         to authenticated;
