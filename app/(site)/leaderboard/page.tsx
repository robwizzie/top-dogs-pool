import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { SweepRow } from "@/components/leaderboard/SweepRow";
import { SessionPicker } from "@/components/leaderboard/SessionPicker";
import { ShareLeaderboardButton } from "@/components/leaderboard/ShareLeaderboardButton";
import { WeekRecap } from "@/components/leaderboard/WeekRecap";
import { Podium } from "@/components/leaderboard/Podium";
import { StatTiles, ScoringKey, type Tile } from "@/components/leaderboard/StatTiles";
import {
  TournamentToggle,
  parseTournamentMode,
} from "@/components/leaderboard/TournamentToggle";
import {
  getCurrentSession,
  getLeaderboard,
  getPatchInstances,
  getPlayerHistory,
  getSessions,
} from "@/lib/apa";
import {
  attachCurrentRanks,
  attachWeekPatches,
  getWeekRecap,
} from "@/lib/apa/week";
import { rankWithTies } from "@/lib/apa/rank";
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

  // "This week" only means something for a single session. Across a multi-select
  // or All Time there is no shared match night to recap.
  const recapSessionId =
    scope.kind !== "all" && selectedIds.size === 1
      ? [...selectedIds][0]
      : undefined;

  const [rows, history, patchInstances, recap] = await Promise.all([
    getLeaderboard(leaderScope, { tournaments: tournamentMode }),
    getPlayerHistory(),
    getPatchInstances(leaderScope, { tournaments: tournamentMode }),
    recapSessionId === undefined
      ? Promise.resolve(null)
      : getWeekRecap(recapSessionId),
  ]);

  // The week's points come from the same patch instances the season totals
  // are built from, and the rank movement is arithmetic on the rows actually
  // on screen — so neither can disagree with the board beneath them. Patches
  // first: the ranks need to know what was gained.
  if (recap) {
    const nameOf = (playerId: string) =>
      rows.find((r) => r.playerId === playerId)?.playerName ?? playerId;
    attachWeekPatches(recap, patchInstances, nameOf);
    attachCurrentRanks(recap, rows);
  }
  const weekPatches = recap?.patches ?? [];

  const previousRanks: Record<string, number> = Object.fromEntries(
    recap ? [...recap.priorRanks] : [],
  );
  const rankDeltas = new Map<string, number | null>(recap?.rankDeltas ?? []);

  const headerLabel = scopeLabel(selectedIds, sessions);
  const modeSuffix =
    tournamentMode === "include"
      ? " + tournaments"
      : tournamentMode === "only"
        ? " · tournaments only"
        : "";

  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const totalSweeps = rows.reduce((s, r) => s + r.sweeps + r.miniSweeps, 0);
  const totalFeats = rows.reduce(
    (s, r) => s + r.breakAndRuns + r.eightOnBreaks,
    0,
  );
  const totalPatches = rows.reduce(
    (s, r) =>
      s +
      r.sweeps +
      r.miniSweeps +
      r.breakAndRuns +
      r.eightOnBreaks +
      r.levelUps +
      r.firstWin +
      r.mvp,
    0,
  );

  const weekSweeps = weekPatches.filter(
    (p) => p.kind === "sweep" || p.kind === "mini-sweep",
  ).length;
  const weekFeats = weekPatches.filter(
    (p) => p.kind === "break-and-run" || p.kind === "8-on-break",
  ).length;

  const tiles: Tile[] = [
    {
      label: "Patch points",
      value: totalPoints,
      decimals: totalPoints % 1 === 0 ? 0 : 1,
      delta: recap?.teamPoints ?? null,
      accent: "var(--color-brass-bright)",
    },
    { label: "Patches", value: totalPatches, delta: weekPatches.length || null },
    { label: "Sweeps", value: totalSweeps, delta: weekSweeps || null },
    { label: "Break & runs", value: totalFeats, delta: weekFeats || null },
  ];

  // Points decide rank; the sort's tiebreakers only decide print order. Three
  // players on one point are joint first, and the board should say so.
  const ranked = rankWithTies(rows, (r) => r.points);
  const rest = ranked.slice(3);

  return (
    <>
      <PageHeader
        eyebrow="Patches Earned"
        title="Patch Watch"
        subtitle={`${headerLabel}${modeSuffix}`}
      />

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        {/* --- controls --------------------------------------------------- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          <>
            {/* --- the week's news ------------------------------------- */}
            <WeekRecap recap={recap} patches={weekPatches} />

            {/* --- season totals --------------------------------------- */}
            <StatTiles tiles={tiles} />

            {/* --- the podium ------------------------------------------ */}
            <Podium
              entries={ranked.slice(0, 3)}
              patchInstances={patchInstances}
              rankDeltas={rankDeltas}
            />

            {/* --- everyone else --------------------------------------- */}
            {rest.length > 0 && (
              <div className="surface divide-y divide-[var(--border)]">
                {rest.map(({ row, rank, tied }) => {
                  const h = history.get(row.playerId);
                  return (
                    <SweepRow
                      key={row.playerId}
                      row={row}
                      rank={rank}
                      tied={tied}
                      streak={h?.streak ?? null}
                      outcomes={h?.outcomes}
                      patchInstances={patchInstances.get(row.playerId)}
                      rankDelta={rankDeltas.get(row.playerId) ?? null}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        <ScoringKey>
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
        </ScoringKey>
      </div>
    </>
  );
}
