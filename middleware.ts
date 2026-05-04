import { NextResponse, type NextRequest } from "next/server";

/**
 * Password gate for /research. Opponents shouldn't see our scouting reports.
 * The cookie token is the SHA-256 of RESEARCH_PASSWORD so the secret never
 * leaves the server. /research-login posts the password, the route handler
 * verifies + sets the cookie, and the browser is bounced back to wherever
 * they were trying to go.
 *
 * Flow:
 *   missing/invalid cookie → 302 to /research-login?next=/research/...
 *   valid cookie           → pass through
 *
 * Set RESEARCH_PASSWORD in .env.local. If the env var is unset, the gate
 * lets requests through (so dev/preview don't lock out the maintainer who
 * hasn't bothered to set one).
 */
export async function middleware(req: NextRequest) {
  const password = process.env.RESEARCH_PASSWORD;
  if (!password) return NextResponse.next();

  const cookie = req.cookies.get("td_research")?.value;
  const expected = await sha256(password);
  if (cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  const target = url.pathname + url.search;
  url.pathname = "/research-login";
  url.search = `?next=${encodeURIComponent(target)}`;
  return NextResponse.redirect(url);
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const config = {
  matcher: ["/research", "/research/:path*"],
};
