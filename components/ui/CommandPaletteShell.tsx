import { CommandPalette, type SearchItem } from "./CommandPalette";
import {
  getOpponentTeams,
  getRoster,
  getSessions,
} from "@/lib/apa";
import { loadSnapshot } from "@/lib/apa/client";
import { NAV_LINKS } from "@/lib/config";

/**
 * Server-rendered shell that builds the command-palette search index from
 * the snapshot once per request, then hands it to the client palette.
 */
export async function CommandPaletteShell() {
  const [roster, opponentTeams, sessions] = await Promise.all([
    getRoster(),
    getOpponentTeams(),
    getSessions(),
  ]);
  const snap = await loadSnapshot();

  const items: SearchItem[] = [];

  for (const link of NAV_LINKS) {
    items.push({
      id: `nav:${link.href}`,
      label: link.label,
      kind: "Navigate",
      href: link.href,
      keywords: link.label.toLowerCase(),
    });
  }

  for (const p of roster) {
    if (p.visible === false) continue;
    items.push({
      id: `player:${p.id}`,
      label: p.name,
      sublabel:
        p.skillLevel != null
          ? `SL${p.skillLevel}${p.format !== "unknown" ? ` · ${p.format}` : ""}`
          : p.format !== "unknown"
            ? p.format
            : undefined,
      kind: "Player",
      href: `/roster/${p.id}`,
      keywords: [p.name, p.firstName, p.lastName, p.nickname]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      thumb: p.profileImage,
    });
  }

  for (const t of opponentTeams) {
    items.push({
      id: `team:${t.id}`,
      label: t.name,
      sublabel: `Opponent${t.number ? ` · ${t.number}` : ""}${t.homeLocation ? ` · ${t.homeLocation}` : ""}`,
      kind: "Team",
      href: `/opponents/${t.id}`,
      keywords: `${t.name} ${t.homeLocation ?? ""} ${t.number ?? ""}`.toLowerCase(),
    });
  }

  // Recent matches — last 30 completed, newest first.
  const matches = Object.values(snap.matches)
    .filter((m) => m.status === "completed")
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 30);
  for (const m of matches) {
    const score =
      m.teamScore !== undefined && m.opponentScore !== undefined
        ? `${m.teamScore}–${m.opponentScore}`
        : "";
    items.push({
      id: `match:${m.id}`,
      label: `vs ${m.opponent}`,
      sublabel: [
        new Date(m.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        score,
        m.sessionName,
      ]
        .filter(Boolean)
        .join(" · "),
      kind: "Match",
      href: `/matches/${m.id}`,
      keywords: `${m.opponent} ${m.sessionName ?? ""} ${m.date}`.toLowerCase(),
    });
  }

  // Session shortcuts — jump to leaderboard scoped to a session.
  for (const s of sessions) {
    items.push({
      id: `session:${s.id}`,
      label: `Patch Watch · ${s.name}`,
      sublabel: "Leaderboard for this session",
      kind: "Session",
      href: `/leaderboard?session=${s.id}`,
      keywords: `patch watch sweeps leaderboard ${s.name}`.toLowerCase(),
    });
  }

  return <CommandPalette items={items} />;
}
