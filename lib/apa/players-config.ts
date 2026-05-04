/**
 * Per-player display overrides.
 *
 * Source of truth: data/players-config.json (committed to repo). Edit that
 * file to:
 *   - hide a player from the roster + leaderboard (`visible: false`)
 *   - override the displayed name (`nickname: "..."`)
 *   - point to a profile image and an action shot (paths under public/)
 *
 * The projector reads this at build time and bakes the values into apa.json,
 * so the site doesn't need to load the config at runtime.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type PlayerOverride = {
  visible?: boolean;
  nickname?: string;
  profileImage?: string;
  actionImage?: string;
};

export type PlayersConfig = {
  players: Record<string, PlayerOverride>;
};

const CONFIG_PATH = resolve(process.cwd(), "data/players-config.json");
const EMPTY: PlayersConfig = { players: {} };

let cached: PlayersConfig | null = null;

export async function loadPlayersConfig(): Promise<PlayersConfig> {
  if (cached) return cached;
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as PlayersConfig;
    if (!parsed.players || typeof parsed.players !== "object") {
      cached = EMPTY;
      return EMPTY;
    }
    cached = parsed;
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      cached = EMPTY;
      return EMPTY;
    }
    console.warn("[players-config] load failed:", (err as Error).message);
    cached = EMPTY;
    return EMPTY;
  }
}

export function getOverride(
  config: PlayersConfig,
  memberNumber: string,
): PlayerOverride {
  return config.players[memberNumber] ?? {};
}

export function isVisible(
  config: PlayersConfig,
  memberNumber: string,
): boolean {
  const o = config.players[memberNumber];
  // Default: visible unless explicitly disabled.
  return o?.visible !== false;
}

/** Trim empty-string overrides so `?? fallback` works as expected. */
export function normalizedOverride(
  config: PlayersConfig,
  memberNumber: string,
): PlayerOverride {
  const o = config.players[memberNumber] ?? {};
  return {
    visible: o.visible !== false,
    nickname: o.nickname && o.nickname.trim() ? o.nickname.trim() : undefined,
    profileImage:
      o.profileImage && o.profileImage.trim() ? o.profileImage.trim() : undefined,
    actionImage:
      o.actionImage && o.actionImage.trim() ? o.actionImage.trim() : undefined,
  };
}
