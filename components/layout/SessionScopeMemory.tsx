"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "topdogs:session-scope";

/**
 * Keeps the `?session=` query param sticky across the site. When the user
 * picks a session on /leaderboard, it carries to /roster, /standings, etc.
 *
 * - On any tracked page WITH `?session=`, persists the value to localStorage.
 * - On any tracked page WITHOUT `?session=`, restores the persisted value.
 * - Untracked pages are left alone.
 *
 * Tracked routes: /roster, /leaderboard, /standings, /schedule, /research,
 * /opponents, and any nested pages under those.
 */
const TRACKED_PREFIXES = [
  "/roster",
  "/leaderboard",
  "/standings",
  "/schedule",
  "/research",
  "/opponents",
];

export function SessionScopeMemory() {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    const tracked = TRACKED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (!tracked) return;

    const current = search.get("session");

    if (current) {
      try {
        window.localStorage.setItem(STORAGE_KEY, current);
      } catch {
        /* ignore — private mode, etc */
      }
      return;
    }

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (!stored) return;

    const params = new URLSearchParams(search.toString());
    params.set("session", stored);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, search, router]);

  return null;
}
