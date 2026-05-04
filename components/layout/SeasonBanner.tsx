import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getTeam } from "@/lib/apa";
import { formatDate } from "@/lib/utils";

/**
 * Slim site-wide ribbon shown when our team record is 0-0 — i.e. the new
 * session just kicked off and we haven't played yet (or have but the data
 * hasn't projected yet). Tucks just under the header.
 */
export async function SeasonBanner() {
  const team = await getTeam();
  if (!team) return null;
  const { wins, losses } = team.record;
  if (wins !== 0 || losses !== 0) return null;

  const upcoming = team.upcomingMatch;
  return (
    <div className="border-b border-[var(--border)] bg-[radial-gradient(120%_140%_at_50%_-30%,rgba(201,162,74,0.18),transparent_55%)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-xs sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.32em] text-[var(--color-brass-bright)]">
          <Sparkles size={12} className="animate-pulse" />
          Fresh Season
        </span>
        <span className="text-[var(--fg-dim)]">
          We&apos;re <span className="font-semibold tabular-nums text-[var(--color-cream)]">0–0</span>
          {team.session ? ` · ${team.session} just kicked off.` : "."} Let&apos;s build a new ladder.
        </span>
        {upcoming && (
          <Link
            href={`/matches/${upcoming.id}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brass)]/40 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-[var(--color-brass)] hover:bg-[var(--color-brass)]/10"
          >
            First up: vs {upcoming.opponent} · {formatDate(upcoming.date)}
          </Link>
        )}
      </div>
    </div>
  );
}
