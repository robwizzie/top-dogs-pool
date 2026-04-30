import { PageHeader } from "@/components/ui/Section";
import { getStandings } from "@/lib/apa";
import { cn, pct } from "@/lib/utils";

export const revalidate = 3600;

export const metadata = {
  title: "Standings",
  description: "Current division standings, synced from APA.",
};

export default async function StandingsPage() {
  const standings = await getStandings();
  const ours = standings.find((s) => s.isOurs);

  return (
    <>
      <PageHeader
        eyebrow="Division"
        title="Standings"
        subtitle={
          ours
            ? `Top Dogs sit at #${ours.rank} with ${ours.points} pts.`
            : "Live division standings."
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {standings.length === 0 ? (
          <p className="surface p-6 text-sm text-[var(--fg-dim)]">
            Standings syncing from APA — refresh in a minute.
          </p>
        ) : (
          <div className="surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3 text-right">W–L</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">Win %</th>
                  <th className="px-4 py-3 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s) => (
                  <tr
                    key={`${s.rank}-${s.team}`}
                    className={cn(
                      "border-b border-[var(--border)] last:border-0",
                      s.isOurs && "bg-[var(--color-felt-deep)]/40",
                    )}
                  >
                    <td className="px-4 py-3 font-[family-name:var(--font-display)] text-lg">
                      {s.rank}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <span
                        className={
                          s.isOurs
                            ? "rounded-full bg-[var(--color-brass)] px-2 py-0.5 text-[var(--color-ink)]"
                            : ""
                        }
                      >
                        {s.team}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {s.wins}–{s.losses}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                      {s.matchesPlayed ? `${pct(s.wins, s.matchesPlayed)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--color-brass-bright)] tabular-nums">
                      {s.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
