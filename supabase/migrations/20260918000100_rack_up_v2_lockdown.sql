-- ===========================================================================
-- Rack Up v2 — RLS lockdown
-- ===========================================================================
-- APPLY THIS ONLY AFTER THE OLD LOVABLE APP IS RETIRED.
--
-- The v2 core migration is deliberately additive so both apps can run side by
-- side during the cutover. This one is not: it removes the blanket
-- "any authenticated user can manage X" policies the old app relied on, and
-- routes every scoring write through the SECURITY DEFINER functions instead.
--
-- Before: any signed-in user could UPDATE any row of `matches` or
-- `match_players` for any match in any room — including one they had nothing
-- to do with. In practice that was a bug factory as much as a security hole,
-- because a stale tab could write to a match it no longer had correct state
-- for.
--
-- After: scoring goes through rack_append_match_event / rack_rewind_match /
-- rack_finalize_match, which check that the caller is the room host or one of
-- the two players, and serialise on the match row.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can update matches" on public.matches;
drop policy if exists "Room hosts can update matches"          on public.matches;
drop policy if exists "Authenticated users can create matches" on public.matches;

-- Creating a match still happens straight from the client (it is a plain
-- INSERT with no state to race on), but only into a room you host or are in.
drop policy if exists "Room members can create matches" on public.matches;
create policy "Room members can create matches"
  on public.matches for insert
  to authenticated
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

-- Only the host may abandon or rename a match directly; scoring updates come
-- from the RPCs, which run as definer and bypass RLS.
drop policy if exists "Room hosts can administer matches" on public.matches;
create policy "Room hosts can administer matches"
  on public.matches for update
  to authenticated
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_id and r.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.rooms r
      where r.id = room_id and r.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Match players
-- ---------------------------------------------------------------------------
-- These rows are now written exclusively by rack_finalize_match(). Nothing
-- client-side should be touching them.

drop policy if exists "Authenticated users can manage match players" on public.match_players;

drop policy if exists "Match players are viewable by everyone" on public.match_players;
create policy "Match players are viewable by everyone"
  on public.match_players for select
  using (true);

-- ---------------------------------------------------------------------------
-- Lifetime stats
-- ---------------------------------------------------------------------------
-- Written only by rack_finalize_match(). Leaving these writable by any signed
-- in user meant a player's career record was editable by anyone with a browser
-- console.

drop policy if exists "Stats updatable by system"          on public.player_stats;
drop policy if exists "System can manage head to head"     on public.head_to_head;
drop policy if exists "Head to head manageable by system"  on public.head_to_head;

-- SELECT policies from the baseline are left in place: both tables stay
-- publicly readable, which is what the stats pages need.

-- ---------------------------------------------------------------------------
-- Tournaments
-- ---------------------------------------------------------------------------
-- The bracket is generated once at seeding time and then only ever has results
-- recorded against it, so only the host needs write access.

drop policy if exists "Authenticated users can manage tournament matches" on public.tournament_matches;
drop policy if exists "Authenticated users can manage tournament players" on public.tournament_players;

drop policy if exists "Room hosts can manage tournament matches" on public.tournament_matches;
create policy "Room hosts can manage tournament matches"
  on public.tournament_matches for all
  to authenticated
  using (
    exists (
      select 1
      from public.tournaments t
      join public.rooms r on r.id = t.room_id
      where t.id = tournament_id and r.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tournaments t
      join public.rooms r on r.id = t.room_id
      where t.id = tournament_id and r.created_by = auth.uid()
    )
  );

drop policy if exists "Room hosts can manage tournament players" on public.tournament_players;
create policy "Room hosts can manage tournament players"
  on public.tournament_players for all
  to authenticated
  using (
    exists (
      select 1
      from public.tournaments t
      join public.rooms r on r.id = t.room_id
      where t.id = tournament_id and r.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tournaments t
      join public.rooms r on r.id = t.room_id
      where t.id = tournament_id and r.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
-- A player may link their own profile to an APA member number, but must not be
-- able to claim somebody else's. The column is covered by the existing
-- "Users can update own profile" policy (id = auth.uid()), which is the right
-- rule — this is just a note that the uniqueness index in the core migration
-- is what stops two accounts claiming the same member number.
