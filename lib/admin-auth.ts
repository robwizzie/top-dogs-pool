import { cookies } from "next/headers";

/**
 * Auth for the tournament-entry admin area. Mirrors the /research password gate
 * (middleware.ts + /research-login): the cookie holds the SHA-256 of
 * ADMIN_PASSWORD so the secret never leaves the server.
 *
 *   middleware.ts          → bounces unauthed /leaderboard/admin to /admin-login
 *   /admin-login           → verifies the password, sets the cookie
 *   /api/tournaments       → re-checks the cookie before any write
 *
 * If ADMIN_PASSWORD is unset, the area is open in development only — writes are
 * refused in production so a misconfigured deploy can't expose an open endpoint.
 */
export const ADMIN_COOKIE = "td_admin";

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** True if the current request is allowed to read/write tournament data. */
export async function isAdminAuthed(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return process.env.NODE_ENV !== "production";
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  return !!token && token === (await sha256(password));
}
