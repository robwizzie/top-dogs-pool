-- ===========================================================================
-- Rack Up — verified roster claims
-- ===========================================================================
-- Previously any signed-in account could pick a name out of the roster
-- dropdown and claim it. Nothing stopped someone who is not on the team — or
-- someone on the team picking a team-mate — from attaching their account to
-- another player's roster page and having their record show up there.
--
-- Linking is now a request that a team admin approves:
--
--   player           → rack_request_roster_claim(member_id, note)  → pending
--   admin            → rack_decide_roster_claim(claim_id, true)    → linked
--
-- `profiles.apa_member_id` is no longer writable by the account that owns the
-- profile at all; only the approval function sets it. That is the part that
-- actually closes the hole — without it, the claim flow would just be a
-- politeness the client could skip.
--
-- Admins are `profiles.is_admin`. There is no self-service route to that flag;
-- it is set in the dashboard. Bootstrap the first one with:
--
--   update public.profiles set is_admin = true
--    where id = (select id from auth.users where email = 'you@example.com');
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Admins, and the import stamp
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists apa_imported_at timestamptz;

comment on column public.profiles.is_admin is
  'Can approve roster claims. Set manually in the dashboard — deliberately no in-app route to granting it.';
comment on column public.profiles.apa_imported_at is
  'When name/skill levels/photo were last pulled from the APA roster. Null means never, which is what triggers the one-time import after a claim is approved.';

create or replace function public.rack_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Claims
-- ---------------------------------------------------------------------------

create table if not exists public.rack_roster_claims (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  apa_member_id text not null,
  status        text not null default 'pending',
  -- Free text from the claimant: "I'm Rob, I captain the team" — context for
  -- whoever approves, not a credential.
  note          text,
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.profiles (id) on delete set null,
  constraint rack_roster_claims_status_check
    check (status in ('pending', 'approved', 'rejected'))
);

create index if not exists rack_roster_claims_status_idx
  on public.rack_roster_claims (status, requested_at);

-- One open request per account, and one per roster player: two people can't
-- both have a live claim on the same member number.
create unique index if not exists rack_roster_claims_one_open_per_user
  on public.rack_roster_claims (user_id) where status = 'pending';
create unique index if not exists rack_roster_claims_one_open_per_member
  on public.rack_roster_claims (apa_member_id) where status = 'pending';

alter table public.rack_roster_claims enable row level security;

-- You can see your own claims; admins see all of them. Deliberately not
-- world-readable: the notes are addressed to an admin, not the internet.
drop policy if exists rack_roster_claims_select on public.rack_roster_claims;
create policy rack_roster_claims_select on public.rack_roster_claims
  for select to authenticated
  using (user_id = auth.uid() or public.rack_is_admin());

-- No insert/update/delete policies: both functions below are SECURITY DEFINER
-- and do their own checks.

-- ---------------------------------------------------------------------------
-- 3. Requesting
-- ---------------------------------------------------------------------------

create or replace function public.rack_request_roster_claim(
  p_apa_member_id text,
  p_note          text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_member text := nullif(btrim(p_apa_member_id), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_member is null then
    raise exception 'a roster player is required' using errcode = '22023';
  end if;

  if exists (select 1 from public.profiles where apa_member_id = v_member) then
    raise exception 'That roster player is already linked to an account.'
      using errcode = '23505';
  end if;

  -- Replace your own open request rather than stacking them up, so changing
  -- your mind about which name you picked doesn't need an admin rejection
  -- first.
  delete from public.rack_roster_claims
   where user_id = auth.uid() and status = 'pending';

  insert into public.rack_roster_claims (user_id, apa_member_id, note)
  values (auth.uid(), v_member, nullif(btrim(p_note), ''))
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.rack_request_roster_claim is
  'Opens a roster-link request for the calling account. Approval is a separate, admin-only step.';

-- ---------------------------------------------------------------------------
-- 4. Close the self-serve write path
-- ---------------------------------------------------------------------------
-- The profile update policy lets the owner set any column on their own row,
-- apa_member_id included — row-level security has no notion of "this row but
-- not that column". A trigger is the way to express it: ordinary client
-- updates cannot move apa_member_id or is_admin, while the definer functions
-- below announce themselves with a transaction-local setting and pass.
--
-- Without this the claim flow would be decoration: the client could simply
-- PATCH the column directly and skip it.

create or replace function public.rack_guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Definer functions set a flag so they can bypass this; ordinary client
  -- updates arrive without it.
  if coalesce(current_setting('rack.privileged', true), '') = 'on' then
    return new;
  end if;

  -- No JWT means this isn't a request from the app: the SQL editor, a
  -- migration, a psql session, or the service role. Those are already trusted
  -- with everything, and this is how the first admin gets promoted — the
  -- bootstrap UPDATE at the top of this file runs with no auth.uid().
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

  return new;
end;
$$;

drop trigger if exists rack_guard_profile_columns on public.profiles;
create trigger rack_guard_profile_columns
  before update on public.profiles
  for each row execute function public.rack_guard_profile_columns();

-- ---------------------------------------------------------------------------
-- 5. Deciding, and unlinking
-- ---------------------------------------------------------------------------

create or replace function public.rack_decide_roster_claim(
  p_claim_id uuid,
  p_approve  boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user   uuid;
  v_member text;
begin
  if not public.rack_is_admin() then
    raise exception 'only a team admin can decide roster claims'
      using errcode = '42501';
  end if;

  select user_id, apa_member_id into v_user, v_member
  from public.rack_roster_claims
  where id = p_claim_id and status = 'pending'
  for update;

  if not found then
    raise exception 'no open claim with that id' using errcode = 'P0002';
  end if;

  if p_approve then
    if exists (select 1 from public.profiles where apa_member_id = v_member) then
      raise exception 'That roster player is already linked to an account.'
        using errcode = '23505';
    end if;

    perform set_config('rack.privileged', 'on', true);
    update public.profiles
       set apa_member_id = v_member,
           apa_imported_at = null
     where id = v_user;
    perform set_config('rack.privileged', 'off', true);
  end if;

  update public.rack_roster_claims
     set status     = case when p_approve then 'approved' else 'rejected' end,
         decided_at = now(),
         decided_by = auth.uid()
   where id = p_claim_id;
end;
$$;

-- Disowning your own link is always allowed: it only ever removes a claim on
-- someone else's roster page, so there is nothing to verify.
create or replace function public.rack_unlink_roster()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform set_config('rack.privileged', 'on', true);
  update public.profiles
     set apa_member_id = null, apa_imported_at = null
   where id = auth.uid();
  perform set_config('rack.privileged', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
-- The base schema's `grant select on all tables` ran before this table
-- existed, and that form only affects tables present at the time — it is not a
-- default privilege. Without an explicit grant here, the select policy above
-- would never even be reached.

grant select on public.rack_roster_claims to authenticated;

grant execute on function public.rack_is_admin()                             to authenticated;
grant execute on function public.rack_request_roster_claim(text, text)       to authenticated;
grant execute on function public.rack_decide_roster_claim(uuid, boolean)     to authenticated;
grant execute on function public.rack_unlink_roster()                        to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.rack_roster_claims;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
