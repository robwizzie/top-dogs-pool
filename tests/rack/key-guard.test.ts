/**
 * The publishable key ships to browsers; the secret key bypasses row-level
 * security entirely. Supabase's dashboard lists them next to each other, and a
 * NEXT_PUBLIC_ variable is inlined into the client bundle — so pasting the
 * wrong one serves the whole database to every visitor. This guards that.
 */
import { isSecretKey } from "@/lib/rack/supabase/env";

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (!cond) {
    failures++;
    console.log("FAIL:", name, JSON.stringify(extra ?? ""));
  }
};

const b64url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const jwt = (role: string) =>
  `eyJhbGciOiJIUzI1NiJ9.${b64url({ iss: "supabase", ref: "abc", role })}.sig`;

// Safe to publish.
check("new publishable key is not secret", !isSecretKey("sb_publishable_AbC123"));
check("legacy anon JWT is not secret", !isSecretKey(jwt("anon")));
check("legacy authenticated JWT is not secret", !isSecretKey(jwt("authenticated")));
check("empty string is not secret", !isSecretKey(""));
check("garbage is not secret", !isSecretKey("not-a-key"));
check("a JWT with an unreadable payload is not flagged", !isSecretKey("a.b.c"));

// Must never reach a browser.
check("new secret key is caught", isSecretKey("sb_secret_AbC123"), "sb_secret_");
check("legacy service_role JWT is caught", isSecretKey(jwt("service_role")));

console.log(
  failures === 0 ? "ALL KEY-GUARD TESTS PASSED" : `${failures} FAILURES`,
);
process.exit(failures === 0 ? 0 : 1);
