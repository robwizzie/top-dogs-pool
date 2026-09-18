/**
 * Supabase connection details for the Rack Up section.
 *
 * Both values are public by design: the URL is a hostname and the publishable
 * (anon) key is meant to ship to browsers — it grants nothing on its own,
 * because every table is behind row-level security and every scoring write
 * goes through a SECURITY DEFINER function that checks the caller. The
 * service-role key is *not* used anywhere in this app and must never be.
 *
 * When these are unset the section degrades to a clearly-worded setup notice
 * rather than throwing, so the rest of the site still builds and deploys.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when the section has everything it needs to talk to Supabase. */
export const RACK_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const RACK_SETUP_HINT =
  "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then apply supabase/migrations/.";
