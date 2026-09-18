\set ON_ERROR_STOP on
-- Guests: one account can enter an opponent, seat them, and score for them —
-- and nobody can use that door to mint an account or edit someone else's.

insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000001','host@x','{"name":"Host"}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002','other@x','{"name":"Other"}'::jsonb);

-- --- creating -------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';

insert into public.profiles (id, name, is_guest, guest_owner, skill_levels)
values ('cccccccc-0000-0000-0000-000000000001','Dave',true,
        'bbbbbbbb-0000-0000-0000-000000000001','{"8-ball":4}'::jsonb);
select 'a host can enter a guest' t,
       (select is_guest from public.profiles
         where id='cccccccc-0000-0000-0000-000000000001') ok;

-- An ownerless guest fails the policy first — a row with no owner can't match
-- `guest_owner = auth.uid()` — so RLS is what the client actually hits.
do $$
begin
  insert into public.profiles (id, name, is_guest) values (gen_random_uuid(),'Half',true);
  raise exception 'SHOULD NOT REACH: ownerless guest was allowed';
exception when insufficient_privilege then raise notice 'OK: ownerless guest refused by RLS';
end $$;

-- The insert policy is the only door; it must not open onto other people.
do $$
begin
  insert into public.profiles (id, name, is_guest, guest_owner)
  values (gen_random_uuid(),'Theirs',true,'bbbbbbbb-0000-0000-0000-000000000002');
  raise exception 'SHOULD NOT REACH: guest planted on another account';
exception when insufficient_privilege then raise notice 'OK: foreign guest refused';
end $$;

-- A profile that is not a guest still has to be your own id.
do $$
begin
  insert into public.profiles (id, name) values (gen_random_uuid(),'Ghost account');
  raise exception 'SHOULD NOT REACH: free-floating account was allowed';
exception when insufficient_privilege then raise notice 'OK: free-floating account refused';
end $$;

-- The constraint behind it, on the paths RLS doesn't police: a migration, the
-- SQL editor, the service role.
reset role;
reset request.jwt.claim.sub;
do $$
begin
  insert into public.profiles (id, name, is_guest) values (gen_random_uuid(),'Half',true);
  raise exception 'SHOULD NOT REACH: ownerless guest stored';
exception when check_violation then raise notice 'OK: ownerless guest refused by the constraint';
end $$;
do $$
begin
  insert into public.profiles (id, name, guest_owner)
  values (gen_random_uuid(),'Owned but not a guest','bbbbbbbb-0000-0000-0000-000000000001');
  raise exception 'SHOULD NOT REACH: owned non-guest stored';
exception when check_violation then raise notice 'OK: owned non-guest refused';
end $$;
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';

-- --- editing --------------------------------------------------------------
update public.profiles set name='Dave R', skill_levels='{"8-ball":5}'::jsonb
 where id='cccccccc-0000-0000-0000-000000000001';
select 'the owner can edit their guest' t,
       (select name='Dave R' from public.profiles
         where id='cccccccc-0000-0000-0000-000000000001') ok;

set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.profiles set name='Hijacked'
 where id='cccccccc-0000-0000-0000-000000000001';
select 'a stranger cannot edit someone elses guest' t,
       (select name='Dave R' from public.profiles
         where id='cccccccc-0000-0000-0000-000000000001') ok;

-- --- the door stays shut --------------------------------------------------
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
do $$
begin
  update public.profiles set is_guest=false, guest_owner=null
   where id='cccccccc-0000-0000-0000-000000000001';
  raise exception 'SHOULD NOT REACH: guest promoted to an account';
exception when insufficient_privilege then raise notice 'OK: promotion refused';
end $$;

do $$
begin
  update public.profiles set guest_owner='bbbbbbbb-0000-0000-0000-000000000002'
   where id='cccccccc-0000-0000-0000-000000000001';
  raise exception 'SHOULD NOT REACH: guest reassigned';
exception when insufficient_privilege then raise notice 'OK: reassignment refused';
end $$;

-- A guest has no login, so a roster link would be a link to nobody.
reset role;
reset request.jwt.claim.sub;
do $$
begin
  update public.profiles set apa_member_id='99999999'
   where id='cccccccc-0000-0000-0000-000000000001';
  raise exception 'SHOULD NOT REACH: guest linked to a roster player';
exception when check_violation then raise notice 'OK: guest roster link refused';
end $$;

-- --- seating and scoring --------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';

insert into public.rooms (id, code, name, created_by)
values ('dddddddd-0000-0000-0000-000000000001','GST1','Guest table',
        'bbbbbbbb-0000-0000-0000-000000000001');
insert into public.room_players (room_id, user_id) values
  ('dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001'),
  ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001');
select 'a guest can be seated at a table' t, count(*) = 2 ok
  from public.room_players where room_id='dddddddd-0000-0000-0000-000000000001';

insert into public.matches (id, room_id, game_type, status, setup, live_state, version, player_ids)
values ('eeeeeeee-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001',
        '8-ball','in_progress',
        '{"game":"8-ball","isCasual":false,"players":[
            {"userId":"bbbbbbbb-0000-0000-0000-000000000001","name":"Host","skill":5,"target":4},
            {"userId":"cccccccc-0000-0000-0000-000000000001","name":"Dave R","skill":5,"target":4}]}'::jsonb,
        '{"status":"in_progress"}'::jsonb, 0,
        array['bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001']::uuid[]);

select 'the host can score a match against a guest' t,
       public.rack_can_score_match('eeeeeeee-0000-0000-0000-000000000001') ok;

set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select 'a stranger still cannot score it' t,
       not public.rack_can_score_match('eeeeeeee-0000-0000-0000-000000000001') ok;

-- --- a guest keeps a record ----------------------------------------------
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';
select public.rack_append_match_event(
  'eeeeeeee-0000-0000-0000-000000000001', 0,
  '{"type":"rack","winner":1}'::jsonb,
  '{"status":"complete","winner":1,"game":"8-ball","isCasual":false,"players":[
      {"userId":"bbbbbbbb-0000-0000-0000-000000000001","name":"Host","score":2,"target":4,
       "innings":5,"safeties":1,"defensiveShots":0,"timeoutsUsed":0,"timeoutsRemaining":1,
       "breakAndRuns":0,"eightOnBreaks":0,"rackless":0,"brokeFirst":true},
      {"userId":"cccccccc-0000-0000-0000-000000000001","name":"Dave R","score":4,"target":4,
       "innings":5,"safeties":0,"defensiveShots":0,"timeoutsUsed":1,"timeoutsRemaining":0,
       "breakAndRuns":1,"eightOnBreaks":0,"rackless":0,"brokeFirst":false}]}'::jsonb) as _;
select public.rack_finalize_match('eeeeeeee-0000-0000-0000-000000000001') as _;

select 'a guest accumulates a lifetime record' t,
       (select wins = 1 and matches_played = 1 from public.player_stats
         where user_id='cccccccc-0000-0000-0000-000000000001' and game_type='8-ball') ok;
select 'head-to-head works against a guest' t, count(*) = 1 ok
  from public.head_to_head
 where player1_id in ('bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001')
   and player2_id in ('bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001');

-- --- removing -------------------------------------------------------------
delete from public.profiles where id='cccccccc-0000-0000-0000-000000000001';
select 'the owner can delete their guest' t, count(*) = 0 ok
  from public.profiles where id='cccccccc-0000-0000-0000-000000000001';
select 'deleting a guest takes their record with them' t, count(*) = 0 ok
  from public.player_stats where user_id='cccccccc-0000-0000-0000-000000000001';
select 'the match it was played in survives' t, count(*) = 1 ok
  from public.matches where id='eeeeeeee-0000-0000-0000-000000000001';

-- --- the cascade the dropped foreign key used to provide -------------------
reset role;
reset request.jwt.claim.sub;
insert into public.profiles (id, name, is_guest, guest_owner)
values ('cccccccc-0000-0000-0000-000000000002','Owned',true,
        'bbbbbbbb-0000-0000-0000-000000000002');
delete from auth.users where id='bbbbbbbb-0000-0000-0000-000000000002';
select 'deleting an account still deletes its profile' t, count(*) = 0 ok
  from public.profiles where id='bbbbbbbb-0000-0000-0000-000000000002';
select 'and the guests it owned' t, count(*) = 0 ok
  from public.profiles where id='cccccccc-0000-0000-0000-000000000002';

-- --- leave the database as we found it ------------------------------------
-- These files share one database and run in turn, and rpc.test.sql asserts on
-- global counts (`only the two players have stats`). Deleting the account
-- cascades to its profile, its guests, their stats and the rooms and matches
-- they played in, so nothing here leaks into the next file.
delete from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select 'this file leaves no stats behind' t, count(*) = 0 ok
  from public.player_stats
 where user_id in ('bbbbbbbb-0000-0000-0000-000000000001',
                   'cccccccc-0000-0000-0000-000000000001');
