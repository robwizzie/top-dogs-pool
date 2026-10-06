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
    <div className="relative z-[5] px-3 pt-1.5 sm:px-6 lg:px-8">
      {/* Felt bridge. Every page tucks its felt hero 5rem up under the
          header, but the banner pushes that hero down by its own height,
          which would leave a black band behind the header. This paints the
          hero's top-edge felt (lamp-lit centre, dark edges) over that band so
          the felt reads as one continuous surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[5rem] top-[calc(-5rem-env(safe-area-inset-top))] -z-10 [background:radial-gradient(rgba(0,0,0,0.22)_1px,transparent_1px)_0_0/5px_5px,linear-gradient(90deg,#164630_0%,#184e35_7%,#296041_21%,#40754f_35%,#548558_50%,#3f724e_65%,#286342_79%,#174f34_93%,#113826_100%)]"
      />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-[1.4rem] border border-[var(--color-brass)]/25 bg-[radial-gradient(120%_160%_at_50%_-40%,rgba(201,162,74,0.22),transparent_60%),color-mix(in_oklab,#0b0d0b_70%,transparent)] px-4 py-2.5 text-xs shadow-[0_16px_40px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150 sm:justify-start sm:rounded-full sm:py-2 sm:pl-4 sm:pr-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.32em] text-[var(--color-brass-bright)]">
          <Sparkles size={12} className="animate-pulse" />
          Fresh Season
        </span>
        <span className="text-center text-[var(--color-cream)]/70 sm:text-left">
          We&apos;re <span className="font-semibold tabular-nums text-[var(--color-cream)]">0–0</span>
          {team.session ? ` · ${team.session} just kicked off.` : "."} Let&apos;s build a new ladder.
        </span>
        {upcoming && (
          <div className="flex w-full justify-center sm:ml-auto sm:w-auto sm:justify-end">
            <Link
              href={`/matches/${upcoming.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brass)]/40 bg-black/30 px-3 py-1 text-[10px] font-semibold tracking-wider text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10"
            >
              First up: vs {upcoming.opponent} · {formatDate(upcoming.date)}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
