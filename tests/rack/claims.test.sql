\set ON_ERROR_STOP on
-- Roster claims: linking must be admin-approved, and unapprovable by the client.

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001','rob@x','{"name":"Rob"}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000002','pete@x','{"name":"Pete"}'::jsonb),
  ('aaaaaaaa-0000-0000-0000-000000000003','imposter@x','{"name":"Imposter"}'::jsonb);

-- Rob is the team admin. Promotion happens from the SQL editor, which has no
-- JWT — exactly the path the guard has to keep open.
reset request.jwt.claim.sub;
update public.profiles set is_admin = true where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'dashboard can promote an admin' t,
       (select is_admin from public.profiles
         where id='aaaaaaaa-0000-0000-0000-000000000001') ok;

-- --- the hole this closes ------------------------------------------------
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
do $$
begin
  update public.profiles set apa_member_id = '08211481'
   where id = 'aaaaaaaa-0000-0000-0000-000000000003';
  raise exception 'SHOULD NOT REACH: direct self-link was allowed';
exception when insufficient_privilege then
  raise notice 'OK: direct self-link refused';
end $$;
select 'direct self-link blocked' t,
       (select apa_member_id is null from public.profiles
         where id='aaaaaaaa-0000-0000-0000-000000000003') ok;

do $$
begin
  update public.profiles set is_admin = true
   where id = 'aaaaaaaa-0000-0000-0000-000000000003';
  raise exception 'SHOULD NOT REACH: self-promotion was allowed';
exception when insufficient_privilege then
  raise notice 'OK: self-promotion refused';
end $$;
select 'self-promotion blocked' t,
       (select not is_admin from public.profiles
         where id='aaaaaaaa-0000-0000-0000-000000000003') ok;

-- Ordinary profile edits still work.
update public.profiles set name = 'Imposter Renamed'
 where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select 'ordinary profile edits still allowed' t,
       (select name = 'Imposter Renamed' from public.profiles
         where id='aaaaaaaa-0000-0000-0000-000000000003') ok;

-- --- requesting ----------------------------------------------------------
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select 'pete can request' t, public.rack_request_roster_claim('08203852','I am Pete') is not null ok;
select 'request does not link yet' t,
       (select apa_member_id is null from public.profiles
         where id='aaaaaaaa-0000-0000-0000-000000000002') ok;

-- Re-requesting replaces rather than stacking.
select public.rack_request_roster_claim('08203845','actually this one') as _;
select 'one open claim per user' t, count(*) = 1 ok
from public.rack_roster_claims
 where user_id='aaaaaaaa-0000-0000-0000-000000000002' and status='pending';

-- A non-admin cannot approve their own claim.
do $$
declare c uuid;
begin
  select id into c from public.rack_roster_claims
   where user_id='aaaaaaaa-0000-0000-0000-000000000002' and status='pending';
  perform public.rack_decide_roster_claim(c, true);
  raise exception 'SHOULD NOT REACH: non-admin approved a claim';
exception when insufficient_privilege then
  raise notice 'OK: non-admin approval refused';
end $$;

-- --- approving -----------------------------------------------------------
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$
declare c uuid;
begin
  select id into c from public.rack_roster_claims
   where user_id='aaaaaaaa-0000-0000-0000-000000000002' and status='pending';
  perform public.rack_decide_roster_claim(c, true);
end $$;

select 'approval links the profile' t,
       (select apa_member_id = '08203845' from public.profiles
         where id='aaaaaaaa-0000-0000-0000-000000000002') ok;
select 'approval clears the import stamp' t,
       (select apa_imported_at is null from public.profiles
         where id='aaaaaaaa-0000-0000-0000-000000000002') ok;
select 'claim marked approved' t, count(*) = 1 ok
from public.rack_roster_claims
 where user_id='aaaaaaaa-0000-0000-0000-000000000002' and status='approved';

-- Somebody else can no longer claim that same roster player.
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
do $$
begin
  perform public.rack_request_roster_claim('08203845','me too');
  raise exception 'SHOULD NOT REACH: claimed an already-linked player';
exception when unique_violation then
  raise notice 'OK: already-linked player refused';
end $$;

-- --- unlinking -----------------------------------------------------------
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.rack_unlink_roster() as _;
select 'can unlink yourself' t,
       (select apa_member_id is null from public.profiles
         where id='aaaaaaaa-0000-0000-0000-000000000002') ok;

-- --- visibility ----------------------------------------------------------
-- Claims carry notes addressed to an admin, so they must not be readable by
-- everyone the way the rest of the schema is. Checked under a non-superuser
-- role, because superusers bypass row-level security entirely.
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
select public.rack_request_roster_claim('08203852','visible to me only') as _;

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
-- Pete has an approved claim from earlier plus this new pending one, so the
-- property that matters is that everything he can see is his.
select 'a player sees only their own claims' t,
       count(*) > 0 and bool_and(user_id = 'aaaaaaaa-0000-0000-0000-000000000002') ok
  from public.rack_roster_claims;

set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000003';
select 'a stranger sees no claims' t, count(*) = 0 ok
  from public.rack_roster_claims;

set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'an admin sees every claim' t, count(*) > 0 ok
  from public.rack_roster_claims;
reset role;
