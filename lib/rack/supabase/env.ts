/**
 * Supabase connection details for the Rack Up section.
 *
 * The URL is a hostname and the publishable key is designed to ship to
 * browsers — it grants nothing on its own, because every table is behind
 * row-level security and every scoring write goes through a SECURITY DEFINER
 * function that checks the caller.
 *
 * The **secret key** (`sb_secret_…`, previously `service_role`) is a different
 * animal: it bypasses RLS entirely. This app never uses it, and the guard
 * below refuses to run with one in a `NEXT_PUBLIC_*` variable — anything with
 * that prefix is inlined into the client bundle at build time and served to
 * every visitor, so a mix-up there hands the whole database to the internet.
 *
 * When the values are missing the section degrades to a setup notice rather
 * than throwing, so the rest of the site still builds and deploys.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Supabase's dashboard now calls this the "Publishable key"; it used to be the
// "anon key". Accept either variable name so the value can be pasted from
// whichever the dashboard shows.
const RAW_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/**
 * True if this looks like a key that must never reach a browser: the new
 * `sb_secret_…` format, or a legacy JWT whose payload claims `service_role`.
 *
 * Exported so it can be tested directly — see tests/rack/key-guard.test.ts.
 */
export function isSecretKey(key: string): boolean {
  if (!key) return false;
  if (key.startsWith("sb_secret_")) return true;

  // Legacy keys are JWTs; the role lives in the payload.
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="))
        : Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json).role === "service_role";
  } catch {
    return false;
  }
}

const KEY_IS_SECRET = isSecretKey(RAW_KEY);

if (KEY_IS_SECRET) {
  // Loud, and on both server and client — whoever sees it first should act.
  console.error(
    "[rack] REFUSING TO START: a Supabase SECRET key is set in a NEXT_PUBLIC_ variable. " +
      "That key bypasses row-level security and NEXT_PUBLIC_ values are served to every " +
      "visitor. Replace it with the Publishable key from Project Settings → API, then " +
      "revoke the exposed secret key immediately.",
  );
}

export const SUPABASE_ANON_KEY = KEY_IS_SECRET ? "" : RAW_KEY;

/** True when the section has everything it needs to talk to Supabase. */
export const RACK_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const RACK_SETUP_HINT = KEY_IS_SECRET
  ? "A Supabase secret key is set where the publishable key belongs. Swap it for the Publishable key (Project Settings → API) and revoke the secret key — it has been exposed."
  : "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local, then apply supabase/migrations/.";
