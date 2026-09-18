"use client";

import { createBrowserClient } from "@supabase/ssr";
import { RACK_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * Browser Supabase client, created once per tab.
 *
 * `createBrowserClient` stores the session in cookies rather than
 * localStorage (which is what the Lovable app used), so the Next.js server
 * can read the same session during SSR — that's what lets a page know who you
 * are before it renders instead of flashing a signed-out shell first.
 */
let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (!RACK_CONFIGURED) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
