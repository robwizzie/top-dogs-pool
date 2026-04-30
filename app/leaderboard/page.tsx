import { PageHeader } from "@/components/ui/Section";
import { SweepRow } from "@/components/leaderboard/SweepRow";
import { getLeaderboard } from "@/lib/apa";

export const revalidate = 3600;

export const metadata = {
  title: "Sweeps Leaderboard",
  description:
    "Top Dogs sweeps and mini-sweeps tracker — derived live from APA match results.",
};

export default async function LeaderboardPage() {
  const rows = await getLeaderboard();
  const totalSweeps = rows.reduce((s, r) => s + r.sweeps, 0);
  const totalMini = rows.reduce((s, r) => s + r.miniSweeps, 0);

  return (
    <>
      <PageHeader
        eyebrow="Sweeps Tracker"
        title="Leaderboard"
        subtitle={`${totalSweeps} team sweep${totalSweeps === 1 ? "" : "s"} · ${totalMini} mini-sweep${totalMini === 1 ? "" : "s"} this season.`}
      />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        {rows.length === 0 ? (
          <p className="surface p-6 text-sm text-[var(--fg-dim)]">
            No leaderboard yet — once matches start being played, sweeps and
            mini-sweeps will land here automatically.
          </p>
        ) : (
          <div className="surface divide-y divide-[var(--border)]">
            {rows.map((row, i) => (
              <SweepRow
                key={row.playerId}
                row={row}
                rank={i + 1}
                celebrate={i < 3 && row.sweeps > 0}
              />
            ))}
          </div>
        )}

        <div className="surface mt-6 p-5 text-sm text-[var(--fg-dim)]">
          <h3 className="mb-2 font-semibold text-[var(--fg)]">How sweeps work</h3>
          <ul className="space-y-1.5 text-xs">
            <li>
              <strong className="text-[var(--color-pop-bright)]">Sweep</strong> — The team won a match without giving up a single point. Every player who participated gets credited.
            </li>
            <li>
              <strong className="text-[var(--color-brass-bright)]">Mini-Sweep</strong> — An individual Top Dogs player won their game without giving up a rack/point.
            </li>
            <li className="pt-2 italic">
              All numbers derived live from APA match results — nothing manually entered.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
