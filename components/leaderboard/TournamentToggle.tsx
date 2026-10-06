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
    <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--color-cream)]/10 bg-black/35 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
      <span className="hidden items-center gap-1.5 pl-2.5 pr-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)] sm:inline-flex">
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
              "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200",
              active
                ? "bg-[linear-gradient(180deg,#f0d48a,#c9a24a_55%,#b38b36)] text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_6px_18px_-8px_rgba(201,162,74,0.8)]"
                : "text-[var(--color-cream)]/60 hover:bg-white/[0.05] hover:text-[var(--color-cream)]",
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
