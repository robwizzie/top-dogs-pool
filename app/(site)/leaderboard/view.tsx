import Link from "next/link";
import { Crown, Plus } from "lucide-react";
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
import { pageMetadata } from "@/lib/site";



export const metadata = pageMetadata({
  title: "Patch Watch",
  description:
    "Top Dawgs Patch Watch — the leaderboard for sweeps, mini-sweeps, break-and-runs, 8-on-the-breaks, and level-ups. Pick any session or All Time.",
  path: "/leaderboard",
});

type Props = {
  query: { session?: string; tourneys?: string };
};

export async function LeaderboardView({ query }: Props) {
  const { session, tourneys } = query;
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
      >
        {ranked[0] && ranked[0].row.points > 0 && (
          <p className="inline-flex max-w-full items-center gap-2.5 rounded-[1.4rem] border border-[var(--color-brass)]/30 bg-black/30 py-1.5 pl-1.5 pr-4 text-sm text-[var(--color-cream)]/75 backdrop-blur-sm">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,#f0d48a,#c9a24a_55%,#b38b36)] text-[var(--color-ink)]">
              <Crown size={14} />
            </span>
            <span className="min-w-0">
              <span className="pm-serif mr-1.5 text-base text-[var(--color-cream)]/60">led by</span>
              <span className="font-semibold text-[var(--color-cream)]">
                {ranked
                  .filter((r) => r.rank === 1)
                  .map((r) => r.row.playerName)
                  .join(" & ")}
              </span>
              <span className="text-[var(--color-cream)]/45"> · </span>
              <span className="whitespace-nowrap">
              <span className="font-[family-name:var(--font-display)] text-lg leading-none tracking-wide text-[var(--color-brass-bright)]">
                {ranked[0].row.points % 1 === 0 ? ranked[0].row.points : ranked[0].row.points.toFixed(1)}
              </span>
              <span className="text-xs text-[var(--color-cream)]/45"> pts</span>
              </span>
            </span>
          </p>
        )}
      </PageHeader>

      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-14 pt-4 sm:px-6 lg:px-8">
        {/* --- controls --------------------------------------------------- */}
        <div className="space-y-3">
          <SessionPicker
            basePath="/leaderboard"
            sessions={sessions}
            selectedIds={selectedIds}
          />
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <TournamentToggle
              basePath="/leaderboard"
              sessionParam={session}
              mode={tournamentMode}
            />
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/leaderboard/admin"
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-[var(--color-cream)]/55 transition-colors hover:bg-white/[0.05] hover:text-[var(--color-cream)]"
              >
                <Plus size={13} />
                <span className="hidden sm:inline">Add tournament results</span>
                <span className="sm:hidden">Tournament</span>
              </Link>
              <ShareLeaderboardButton
                rows={rows}
                scopeLabel={headerLabel}
                sessionParam={session}
                previousRanks={previousRanks}
              />
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="pm-glass p-6 text-sm text-[var(--color-cream)]/60">
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
              <div className="pm-glass space-y-0.5 p-1.5 sm:p-2">
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
