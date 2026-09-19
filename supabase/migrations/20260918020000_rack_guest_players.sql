-- ===========================================================================
-- Rack Up — guest players, and tidying tables away
-- ===========================================================================
-- Two things the app needed and the schema could not express.
--
-- 1. GUESTS. Scoring a match required two accounts. That is the wrong price
--    for a Tuesday night: one person has the app open, the other three are
--    holding cues. A guest is somebody the host enters by name and skill
--    level so the match can be set up and scored from a single phone.
--
--    A guest is a `profiles` row, not a parallel kind of player. Every other
--    route was worse: `match_players`, `player_stats`, `head_to_head`,
--    `tournament_players`, `room_players` and `practice_session_players` all
--    reference `profiles(id)`, so a second identity type would mean a
--    nullable guest column and a two-branch join on all six, forever, in
--    every query. One identity type keeps every one of those tables, and the
--    finaliser that writes them, exactly as it is — and it means a guest
--    accumulates a real record, so "Dave is 3-1 against you" works without a
--    line of new code.
--
--    The price is the foreign key from `profiles.id` to `auth.users(id)`,
--    which has to go: a guest has no login. The delete cascade it provided is
--    replaced below by an explicit trigger, and RLS still pins a real user's
--    profile id to `auth.uid()`, so the key was never what stopped someone
--    inserting a profile they shouldn't.
--
-- 2. CLOSING AND DELETING TABLES. The host could already do both under RLS,
--    but nothing distinguished "we're done playing" from "delete this". The
--    first is the common one and must keep the match history; only the second
--    should remove anything. This adds `closed_at` so a closed table reads as
--    finished rather than merely inactive, and leaves the existing delete
--    policy to handle the rare case.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Profiles: drop the auth.users key, keep the cascade
-- ---------------------------------------------------------------------------

do $$
declare
  v_constraint text;
begin
  select con.conname into v_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'profiles'
    and con.contype = 'f'
    and con.confrelid = 'auth.users'::regclass;

  if v_constraint is not null then
    execute format('alter table public.profiles drop constraint %I', v_constraint);
  end if;
end $$;

-- What the foreign key used to do. A BEFORE trigger so the profile (and
-- everything cascading from it) is gone before the auth row it belonged to.
create or replace function public.rack_delete_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

drop trigger if exists rack_delete_profile_for_user on auth.users;
create trigger rack_delete_profile_for_user
  before delete on auth.users
  for each row execute function public.rack_delete_profile_for_user();

-- ---------------------------------------------------------------------------
-- 2. Guests
-- ---------------------------------------------------------------------------
-- Owned by an account rather than by a room: you enter your regular opponents
-- once and they are there at every table you host, with the record they have
-- built up, instead of being retyped every week as a stranger.

-- With the auth.users key gone, `id` has nothing to take its value from. A
-- real account still supplies `auth.uid()`; a guest has no id of their own, so
-- let the database mint one rather than trusting a browser to.
alter table public.profiles alter column id set default gen_random_uuid();

alter table public.profiles
  add column if not exists is_guest boolean not null default false;

alter table public.profiles
  add column if not exists guest_owner uuid references auth.users (id) on delete cascade;

-- The two columns are one fact; let the database keep them agreeing.
alter table public.profiles drop constraint if exists profiles_guest_owner_check;
alter table public.profiles
  add constraint profiles_guest_owner_check
  check (is_guest = (guest_owner is not null));

create index if not exists profiles_guest_owner_idx
  on public.profiles (guest_owner)
  where guest_owner is not null;

-- A guest has no login, so nothing can ever claim a roster player as one.
alter table public.profiles drop constraint if exists profiles_guest_not_linked_check;
alter table public.profiles
  add constraint profiles_guest_not_linked_check
  check (not (is_guest and (apa_member_id is not null or is_admin)));

-- ---------------------------------------------------------------------------
-- 3. Who may create, edit and remove a guest
-- ---------------------------------------------------------------------------

-- The existing insert policy pins id to auth.uid(), which is exactly right for
-- a real account and impossible for a guest. This is the second door, and it
-- is just as narrow: you may only insert a guest that you own.
drop policy if exists profiles_insert_guest on public.profiles;
create policy profiles_insert_guest on public.profiles
  for insert to authenticated
  with check (is_guest and guest_owner = auth.uid());

drop policy if exists profiles_update_guest on public.profiles;
create policy profiles_update_guest on public.profiles
  for update to authenticated
  using (is_guest and guest_owner = auth.uid())
  with check (is_guest and guest_owner = auth.uid());

-- Deleting a guest takes their match lines and lifetime record with them
-- (every referencing table cascades from profiles). The matches themselves
-- survive: `matches.setup` carries the names it was played with.
drop policy if exists profiles_delete_guest on public.profiles;
create policy profiles_delete_guest on public.profiles
  for delete to authenticated
  using (is_guest and guest_owner = auth.uid());

-- Nobody promotes a guest into an account, or hands one to somebody else, by
-- editing a row from the browser.
create or replace function public.rack_guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('rack.privileged', true), '') = 'on' then
    return new;
  end if;

  -- No JWT means this isn't a request from the app: the SQL editor, a
  -- migration, psql, or the service role. Those are already trusted with
  -- everything, and this is how the first admin gets promoted.
  if auth.uid() is null then
    return new;
  end if;

  if new.apa_member_id is distinct from old.apa_member_id then
    raise exception
      'apa_member_id is set by approving a roster claim, not by editing your profile'
      using errcode = '42501';
  end if;

  if new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin cannot be changed from the app'
      using errcode = '42501';
  end if;

  if new.is_guest is distinct from old.is_guest
     or new.guest_owner is distinct from old.guest_owner then
    raise exception 'a guest cannot be converted or reassigned from the app'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists rack_guard_profile_columns on public.profiles;
create trigger rack_guard_profile_columns
  before update on public.profiles
  for each row execute function public.rack_guard_profile_columns();

-- ---------------------------------------------------------------------------
-- 4. Seating a guest at a table
-- ---------------------------------------------------------------------------
-- `room_players_insert_self` pins user_id to auth.uid(); a guest can't insert
-- themselves because a guest never holds a session. Their owner does it.

drop policy if exists room_players_insert_guest on public.room_players;
create policy room_players_insert_guest on public.room_players
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = user_id and p.guest_owner = auth.uid()
    )
  );

-- Leave as yourself, or be removed by the room's host — plus, now, by whoever
-- owns the guest.
drop policy if exists room_players_delete on public.room_players;
create policy room_players_delete on public.room_players
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.created_by = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = user_id and p.guest_owner = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Scoring on a guest's behalf
-- ---------------------------------------------------------------------------
-- A guest cannot call anything, so somebody scores for them. The host already
-- qualifies; this adds the owner, so a guest entered by one player can be
-- scored by that player at a table someone else is hosting.

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
        or exists (                        -- whoever entered a guest playing in it
          select 1 from public.profiles p
          where p.id = any(m.player_ids)
            and p.guest_owner = auth.uid()
        )
      )
  );
$$;

comment on function public.rack_can_score_match(uuid) is
  'True when the caller may score this match: the room host, one of the two players, or the owner of a guest playing in it.';

-- ---------------------------------------------------------------------------
-- 6. Closing a table
-- ---------------------------------------------------------------------------
-- `is_active` already existed but said nothing about when or why. A closed
-- table keeps every match it hosted; deleting one is a separate, rarer act the
-- existing `rooms_delete_host` policy covers.

alter table public.rooms
  add column if not exists closed_at timestamptz;

-- Backfill: anything already inactive was closed at some point we can't know,
-- so date it from creation rather than pretending it just happened.
update public.rooms set closed_at = created_at
 where is_active is not true and closed_at is null;

create index if not exists rooms_created_by_idx
  on public.rooms (created_by, created_at desc);
