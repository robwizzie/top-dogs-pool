\set ON_ERROR_STOP on
-- Two users, a room, and a match.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','rob@example.com'),
  ('22222222-2222-2222-2222-222222222222','pete@example.com')
on conflict do nothing;
insert into public.profiles (id, name, skill_level) values
  ('11111111-1111-1111-1111-111111111111','Rob',5),
  ('22222222-2222-2222-2222-222222222222','Pete',7)
on conflict do nothing;
insert into public.rooms (id, code, name, created_by) values
  ('33333333-3333-3333-3333-333333333333','ABCD','Table 1','11111111-1111-1111-1111-111111111111');
insert into public.matches (id, room_id, match_type, game_type, player_ids, setup, live_state, version)
values ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','8-ball','8-ball',
  array['11111111-1111-1111-1111-111111111111'::uuid,'22222222-2222-2222-2222-222222222222'::uuid],
  '{"game":"8-ball","isCasual":false}'::jsonb,
  '{"status":"in_progress","version":0}'::jsonb, 0);

-- Impersonate Rob (a player, not the host is also fine - he IS the host here).
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';  -- Pete: a player, not host
select 'pete can score' as t, public.rack_can_score_match('44444444-4444-4444-4444-444444444444') as ok;

-- A stranger cannot.
insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999','nope@example.com');
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select 'stranger cannot score' as t, not public.rack_can_score_match('44444444-4444-4444-4444-444444444444') as ok;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Append event 1.
select 'append v1' as t, version = 1 and conflict = false as ok
from public.rack_append_match_event('44444444-4444-4444-4444-444444444444', 0,
  '{"type":"turn_over"}'::jsonb, '{"status":"in_progress","version":1}'::jsonb);

-- A stale client tries to append with the same expected version -> conflict,
-- and must NOT write an event.
select 'stale write conflicts' as t, conflict = true and version = 1 as ok
from public.rack_append_match_event('44444444-4444-4444-4444-444444444444', 0,
  '{"type":"turn_over"}'::jsonb, '{"status":"in_progress","version":1}'::jsonb);

select 'only one event stored' as t, count(*) = 1 as ok from public.match_events
 where match_id = '44444444-4444-4444-4444-444444444444';

-- Catch up and append again.
select 'append v2' as t, version = 2 and conflict = false as ok
from public.rack_append_match_event('44444444-4444-4444-4444-444444444444', 1,
  '{"type":"safety","side":0}'::jsonb, '{"status":"in_progress","version":2}'::jsonb);

-- Rewind to v1.
select 'rewind to v1' as t, version = 1 and conflict = false as ok
from public.rack_rewind_match('44444444-4444-4444-4444-444444444444', 1,
  '{"status":"in_progress","version":1}'::jsonb);
select 'rewind dropped the event' as t, count(*) = 1 as ok from public.match_events
 where match_id = '44444444-4444-4444-4444-444444444444';

-- Complete the match: winner side 0 (Rob), Pete on 0 -> a sweep.
select 'complete match' as t, version = 2 as ok
from public.rack_append_match_event('44444444-4444-4444-4444-444444444444', 1,
  '{"type":"rack_won","side":0,"kind":"normal"}'::jsonb,
  '{"status":"complete","winner":0,"isCasual":false,"game":"8-ball","version":2,
    "players":[
      {"userId":"11111111-1111-1111-1111-111111111111","score":3,"target":3,"innings":7,"safeties":2,"defensiveShots":1,"timeoutsUsed":1,"timeoutsRemaining":0,"breakAndRuns":1,"eightOnBreaks":0,"rackless":0,"brokeFirst":true},
      {"userId":"22222222-2222-2222-2222-222222222222","score":0,"target":5,"innings":6,"safeties":1,"defensiveShots":0,"timeoutsUsed":0,"timeoutsRemaining":1,"breakAndRuns":0,"eightOnBreaks":0,"rackless":0,"brokeFirst":false}
    ]}'::jsonb);

select 'winner_id + ended_at set' as t,
       winner_id = '11111111-1111-1111-1111-111111111111' and ended_at is not null and status='complete' as ok
from public.matches where id='44444444-4444-4444-4444-444444444444';

-- Finalize, twice, to prove idempotency.
select public.rack_finalize_match('44444444-4444-4444-4444-444444444444');
select public.rack_finalize_match('44444444-4444-4444-4444-444444444444');

select 'match_players rows = 2' as t, count(*) = 2 as ok from public.match_players
 where match_id='44444444-4444-4444-4444-444444444444';
select 'rob stats not double counted' as t, matches_played = 1 and wins = 1 and break_and_runs = 1 as ok
 from public.player_stats where user_id='11111111-1111-1111-1111-111111111111' and game_type='8-ball';
select 'pete stats' as t, matches_played = 1 and losses = 1 as ok
 from public.player_stats where user_id='22222222-2222-2222-2222-222222222222' and game_type='8-ball';
select 'head to head single row' as t, count(*) = 1 as ok from public.head_to_head;
select 'h2h wins not doubled' as t, (player1_wins + player2_wins) = 1 as ok from public.head_to_head;

-- A stranger cannot append.
set request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
do $$
begin
  perform public.rack_append_match_event('44444444-4444-4444-4444-444444444444', 2,
    '{"type":"turn_over"}'::jsonb, '{}'::jsonb);
  raise exception 'SHOULD HAVE BEEN REJECTED';
exception when insufficient_privilege then
  raise notice 'OK: stranger append rejected';
end $$;
