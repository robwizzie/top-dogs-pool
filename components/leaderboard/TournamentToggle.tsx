import Link from "next/link";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TournamentMode } from "@/lib/apa";

/**
 * Three-way filter for whether manually-entered tournament results are mixed
 * into the leaderboard:
 *   League        → league matches only (default, no `tourneys` param)
 *   + Tournaments → league + tournament games
 *   Tournaments   → tournament games on their own
 *
 * Preserves the active `?session=` selection across toggles.
 */
const OPTIONS: { label: string; mode: TournamentMode; param?: string }[] = [
  { label: "League", mode: "exclude" },
  { label: "+ Tournaments", mode: "include", param: "on" },
  { label: "Tournaments", mode: "only", param: "only" },
];

export function TournamentToggle({
  basePath,
  sessionParam,
  mode,
}: {
  basePath: string;
  sessionParam?: string;
  mode: TournamentMode;
}) {
  const hrefFor = (param?: string) => {
    const parts: string[] = [];
    if (sessionParam) parts.push(`session=${encodeURIComponent(sessionParam)}`);
    if (param) parts.push(`tourneys=${param}`);
    return `${basePath}${parts.length ? `?${parts.join("&")}` : ""}`;
  };

  return (
    <div className="surface flex flex-wrap items-center gap-2 p-3">
      <span className="inline-flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        <Trophy size={12} />
        Games
      </span>
      {OPTIONS.map((o) => {
        const active = o.mode === mode;
        return (
          <Link
            key={o.mode}
            href={hrefFor(o.param)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "border-[var(--color-brass)] bg-[var(--color-brass)] text-[var(--color-ink)]"
                : "border-[var(--border)] text-[var(--fg-dim)] hover:border-[var(--color-brass)] hover:text-[var(--fg)]",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Parse the `?tourneys=` param into a TournamentMode. */
export function parseTournamentMode(param: string | undefined): TournamentMode {
  if (param === "on" || param === "include") return "include";
  if (param === "only") return "only";
  return "exclude";
}
