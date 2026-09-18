#!/usr/bin/env bash
# Runs tests/rack/rpc.test.sql against a throwaway Postgres.
#
# The Rack Up write path is Postgres functions, not TypeScript: optimistic
# concurrency, undo and the once-only finaliser all live in plpgsql. This
# spins up an empty local database with just enough of Supabase stubbed to be
# realistic, applies supabase/migrations/ to it, and asserts the functions
# behave. Every assertion prints `t`; any `f` is a failure.
#
#   ./tests/rack/run-rpc-test.sh
#
# Requires: postgresql-16 (or any 14+). Nothing else — the schema is
# self-contained, so this no longer needs the old rack-up repo alongside it.
set -euo pipefail

PGPORT="${PGPORT:-55433}"
PGDATA="${PGDATA:-/tmp/rackup-test-pgdata}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || echo "")"
export PATH="${PGBIN:+$PGBIN:}$PATH"

# Postgres refuses to run as root. In a container that is exactly who we are,
# so shell out to the `postgres` system user for the server lifecycle bits.
if [ "$(id -u)" -eq 0 ] && id postgres >/dev/null 2>&1; then
  as_pg() { su postgres -s /bin/bash -c "PATH=$PATH $*"; }
  PGDATA="${PGDATA_ROOT:-/var/lib/postgresql/rackup-rpc-test}"
  mkdir -p "$(dirname "$PGDATA")"
  chown postgres:postgres "$(dirname "$PGDATA")"
else
  as_pg() { eval "$@"; }
fi

cleanup() { as_pg "pg_ctl -D $PGDATA stop -m immediate" >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$PGDATA"
as_pg "initdb -D $PGDATA -U postgres --auth=trust" >/dev/null
as_pg "pg_ctl -D $PGDATA -o '-p $PGPORT -k /tmp' -l $PGDATA/server.log start" >/dev/null
sleep 2

PSQL=(psql -h /tmp -p "$PGPORT" -U postgres -q)
"${PSQL[@]}" -c "create database rackup;"
DB=(psql -h /tmp -p "$PGPORT" -U postgres -d rackup)

# Minimal Supabase surface: auth.uid() reads a session GUC so the test can
# impersonate different users.
"${DB[@]}" -q <<'SQL'
create schema auth; create schema storage;
create extension if not exists pgcrypto;
create table auth.users (id uuid primary key default gen_random_uuid(), email text,
  raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
create function auth.role() returns text language sql stable as $$ select 'authenticated'; $$;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text,
  name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/'); $$;
-- Roles the migrations GRANT to.
do $$ begin
  create role anon;          exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role;  exception when duplicate_object then null; end $$;
create publication supabase_realtime;
SQL

for f in "$REPO"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  "${DB[@]}" -v ON_ERROR_STOP=1 -q -f "$f"
done

failed=0
for t in "$HERE"/*.test.sql; do
  echo
  echo "--- $(basename "$t") ---"
  # psql exits non-zero on the first error (ON_ERROR_STOP), and `set -e` would
  # kill the run before the failure could be reported. Capture and carry on.
  out="$("${DB[@]}" -f "$t" 2>&1)" || true
  if [ -n "${RACK_TEST_VERBOSE:-}" ]; then echo "$out"; fi
  echo "$out" | grep -E "\| [ft]$|NOTICE|ERROR|SHOULD NOT REACH" | sed 's/^ *//'
  if echo "$out" | grep -qE "\| f$"; then failed=1; fi
  # psql prefixes errors with "psql:<file>:<line>: ", so an anchored ^ERROR
  # match misses every one of them — and ON_ERROR_STOP means such an error
  # aborts the rest of that file, which then reports as a pass.
  if echo "$out" | grep -qE "(^|:[[:space:]])ERROR:"; then failed=1; fi
  if echo "$out" | grep -q "SHOULD NOT REACH"; then failed=1; fi
done

echo
if [ "$failed" -ne 0 ]; then echo "SQL TESTS FAILED"; exit 1; fi
echo "ALL SQL TESTS PASSED"
