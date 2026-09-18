import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { SweepRow } from "@/components/leaderboard/SweepRow";
import { SessionPicker } from "@/components/leaderboard/SessionPicker";
import { ShareLeaderboardButton } from "@/components/leaderboard/ShareLeaderboardButton";
import {
  TournamentToggle,
  parseTournamentMode,
} from "@/components/leaderboard/TournamentToggle";
import {
  getCurrentSession,
  getLeaderboard,
  getPatchInstances,
  getPlayerHistory,
  getPreviousWeekRanks,
  getSessions,
} from "@/lib/apa";
import {
  parseSessionScope,
  resolveScope,
  scopeLabel,
} from "@/lib/session-scope";

export const revalidate = 3600;

export const metadata = {
  title: "Patch Watch",
  description:
    "Top Dawgs Patch Watch — points from sweeps, mini-sweeps, break-and-runs, 8-on-breaks, and level-ups (the things that earn an APA patch). Pick any session(s) or All Time.",
};

type Props = {
  searchParams: Promise<{ session?: string; tourneys?: string }>;
};

export default async function LeaderboardPage({ searchParams }: Props) {
  const { session, tourneys } = await searchParams;
  const tournamentMode = parseTournamentMode(tourneys);
  const [sessions, currentSession] = await Promise.all([
    getSessions(),
    getCurrentSession(),
  ]);
  const allIds = sessions.map((s) => s.id);
  const scope = parseSessionScope(session, allIds);
  const selectedIds = resolveScope(scope, allIds, currentSession?.id);
  const leaderScope = scope.kind === "all" ? "all" : selectedIds;

  const [rows, history, patchInstances, prevRanks] = await Promise.all([
    getLeaderboard(leaderScope, { tournaments: tournamentMode }),
    getPlayerHistory(),
    getPatchInstances(leaderScope, { tournaments: tournamentMode }),
    // Week-over-week deltas are league-only; tournament games have no "weeks".
    getPreviousWeekRanks(leaderScope),
  ]);
  const previousRanks: Record<string, number> = Object.fromEntries(prevRanks);
  const headerLabel = scopeLabel(selectedIds, sessions);
  const modeSuffix =
    tournamentMode === "include"
      ? " + tournaments"
      : tournamentMode === "only"
        ? " · tournaments only"
        : "";
  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const totalSweeps = rows.reduce((s, r) => s + r.sweeps, 0);
  const totalMini = rows.reduce((s, r) => s + r.miniSweeps, 0);
  const totalFirstWins = rows.reduce((s, r) => s + r.firstWin, 0);
  const totalMvp = rows.reduce((s, r) => s + r.mvp, 0);

  return (
    <>
      <PageHeader
        eyebrow="Patches Earned"
        title="Patch Watch"
        subtitle={`${headerLabel}${modeSuffix} · ${totalPoints.toFixed(1)} pts · ${totalSweeps} sweep${totalSweeps === 1 ? "" : "s"} · ${totalMini} mini${totalFirstWins > 0 ? ` · ${totalFirstWins} first win${totalFirstWins === 1 ? "" : "s"}` : ""}${totalMvp > 0 ? ` · ${totalMvp} MVP${totalMvp === 1 ? "" : "s"}` : ""}`}
      />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <SessionPicker
            basePath="/leaderboard"
            sessions={sessions}
            selectedIds={selectedIds}
          />
          <ShareLeaderboardButton
            rows={rows}
            scopeLabel={headerLabel}
            sessionParam={session}
            previousRanks={previousRanks}
          />
        </div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <TournamentToggle
            basePath="/leaderboard"
            sessionParam={session}
            mode={tournamentMode}
          />
          <Link
            href="/leaderboard/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--fg-dim)] transition-colors hover:border-[var(--color-brass)] hover:text-[var(--fg)]"
          >
            <Plus size={13} />
            Add tournament results
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="surface p-6 text-sm text-[var(--fg-dim)]">
            {tournamentMode === "only" ? (
              <>
                No tournament results for this selection yet.{" "}
                <Link
                  href="/leaderboard/admin"
                  className="font-semibold text-[var(--color-brass-bright)] hover:underline"
                >
                  Add some
                </Link>
                .
              </>
            ) : (
              <>
                No leaderboard data for this selection — pick a session that has
                played matches.
              </>
            )}
          </p>
        ) : (
          <div className="surface divide-y divide-[var(--border)]">
            {rows.map((row, i) => {
              const h = history.get(row.playerId);
              return (
                <SweepRow
                  key={row.playerId}
                  row={row}
                  rank={i + 1}
                  celebrate={i < 3 && row.points > 0}
                  streak={h?.streak ?? null}
                  outcomes={h?.outcomes}
                  patchInstances={patchInstances.get(row.playerId)}
                />
              );
            })}
          </div>
        )}

        <div className="surface mt-6 p-5 text-sm text-[var(--fg-dim)]">
          <h3 className="mb-2 font-semibold text-[var(--fg)]">
            How points work
          </h3>
          <ul className="space-y-1.5 text-xs">
            <li>
              <strong className="text-[var(--color-pop-bright)]">Sweep</strong> ·
              1 pt — won your match without giving up a single game.
            </li>
            <li>
              <strong className="text-[var(--color-brass-bright)]">
                Mini-sweep
              </strong>{" "}
              · 0.5 pt — won your match while keeping your opponent off the
              hill (more than one game shy of their race-to).
            </li>
            <li>
              <strong className="text-[var(--color-felt-bright)]">
                Break-and-run
              </strong>{" "}
              · 1 pt each — ran the rack from the break.
            </li>
            <li>
              <strong className="text-[var(--color-cream)]">
                8-on-the-break
              </strong>{" "}
              · 1 pt each — sank the 8 on the break for an instant win.
            </li>
            <li>
              <strong className="text-[var(--color-tie-bright)]">
                Level up
              </strong>{" "}
              · 1 pt each — every skill-level increase observed within the
              session counts.
            </li>
            <li>
              <strong className="text-[var(--color-six-ball)]">
                First win
              </strong>{" "}
              · 1 pt — a brand-new player&apos;s first-ever career win on the
              Top Dawgs. Awarded once per player, in the session it happens.
            </li>
            <li>
              <strong style={{ color: "#4ca0d8" }}>Session MVP</strong> · 1 pt
              — finishing 1st in APA&apos;s MVP rank for a Top Dawgs session.
              Pulled from each member&apos;s Teams page on poolplayers.com.
            </li>
            <li className="pt-2 italic">
              Pick multiple sessions to combine totals, or hit{" "}
              <span className="text-[var(--color-pop-bright)]">All</span> for
              career.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
