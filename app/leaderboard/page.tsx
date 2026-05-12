import { PageHeader } from "@/components/ui/Section";
import { SweepRow } from "@/components/leaderboard/SweepRow";
import { SessionPicker } from "@/components/leaderboard/SessionPicker";
import {
  getCurrentSession,
  getLeaderboard,
  getPlayerHistory,
  getSessions,
} from "@/lib/apa";
import {
  parseSessionScope,
  resolveScope,
  scopeLabel,
} from "@/lib/session-scope";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Patch Watch",
  description:
    "Top Dawgs Patch Watch — points from sweeps, mini-sweeps, break-and-runs, 8-on-breaks, and level-ups (the things that earn an APA patch). Pick any session(s) or All Time.",
};

type Props = {
  searchParams: Promise<{ session?: string }>;
};

export default async function LeaderboardPage({ searchParams }: Props) {
  const { session } = await searchParams;
  const [sessions, currentSession] = await Promise.all([
    getSessions(),
    getCurrentSession(),
  ]);
  const allIds = sessions.map((s) => s.id);
  const scope = parseSessionScope(session, allIds);
  const selectedIds = resolveScope(scope, allIds, currentSession?.id);

  const [rows, history] = await Promise.all([
    getLeaderboard(scope.kind === "all" ? "all" : selectedIds),
    getPlayerHistory(),
  ]);
  const headerLabel = scopeLabel(selectedIds, sessions);
  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const totalSweeps = rows.reduce((s, r) => s + r.sweeps, 0);
  const totalMini = rows.reduce((s, r) => s + r.miniSweeps, 0);

  return (
    <>
      <PageHeader
        eyebrow="Patches Earned"
        title="Patch Watch"
        subtitle={`${headerLabel} · ${totalPoints.toFixed(1)} pts · ${totalSweeps} sweep${totalSweeps === 1 ? "" : "s"} · ${totalMini} mini`}
      />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5">
          <SessionPicker
            basePath="/leaderboard"
            sessions={sessions}
            selectedIds={selectedIds}
          />
        </div>

        {rows.length === 0 ? (
          <p className="surface p-6 text-sm text-[var(--fg-dim)]">
            No leaderboard data for this selection — pick a session that has
            played matches.
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
              <strong className="text-[var(--color-felt-bright)]">
                Level up
              </strong>{" "}
              · 1 pt each — every skill-level increase observed within the
              session counts.
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
