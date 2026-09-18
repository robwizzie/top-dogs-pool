import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { RACK_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Server Supabase client bound to the request's cookies.
 *
 * Used by server components to read the signed-in user and any data that can
 * be rendered ahead of time. Writes still go through the browser client so
 * they carry the user's own session into the RLS checks.
 */
export async function getSupabaseServer() {
  if (!RACK_CONFIGURED) return null;
  const jar = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
        // Server components can't set cookies. Supabase calls this after a
        // token refresh; ignoring it is safe because the browser client
        // refreshes independently and middleware isn't gating this section.
        try {
          for (const { name, value, options } of toSet) {
            jar.set(name, value, options);
          }
        } catch {
          /* read-only cookie store — nothing to do */
        }
      },
    },
  });
}

/** The signed-in user for this request, or null. */
export async function getRackUser() {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
