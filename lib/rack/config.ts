/**
 * Rack Up section configuration.
 *
 * The section lives at /rack and is styled as its own app rather than another
 * page of the team site — its own header, palette, type and theme toggle. It
 * keeps a single entry in the site's main nav and takes over from there.
 */

export const RACK_NAME = "Rack Up";
export const RACK_TAGLINE = "Keeping score on a napkin is so last century";

export const RACK_NAV = [
  { href: "/rack", label: "Tables" },
  { href: "/rack/stats", label: "Stats" },
] as const;

/** Where the light/dark choice is remembered. Read by the inline bootstrap in
 *  app/rack/layout.tsx, so the name has to stay in sync with it. */
export const RACK_THEME_STORAGE_KEY = "rackup:theme";

/** Room codes are short, unambiguous and shoutable across a pool hall. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
export const ROOM_CODE_LENGTH = 4;

export function generateRoomCode(): string {
  let out = "";
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

/**
 * Clean up a typed or pasted code. Characters the alphabet deliberately omits
 * (I, O, 0, 1 — the ones people mis-read across a room) are dropped rather
 * than remapped: there is no unambiguous character to remap them *to*, and
 * silently turning a typo into a different valid code is worse than rejecting
 * it.
 */
export function normalizeRoomCode(input: string): string {
  const allowed = new Set(CODE_ALPHABET);
  return [...input.toUpperCase()]
    .filter((c) => allowed.has(c))
    .join("")
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`).test(code);
}
