import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/Section";
import { getOpponentTeam } from "@/lib/apa";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ teamId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { teamId } = await params;
  const team = await getOpponentTeam(teamId);
  return {
    title: team ? `${team.name} · Opponent` : "Opponent",
    description: team
      ? `Scouting profile for ${team.name} — roster, schedule, and our matches against them.`
      : "Opponent team profile.",
  };
}

export default async function OpponentTeamPage({ params }: Props) {
  const { teamId } = await params;
  const team = await getOpponentTeam(teamId);
  if (!team) notFound();

  const upcoming = team.schedule.filter((m) => m.status === "upcoming");
  const completed = team.schedule.filter((m) => m.status === "completed");

  return (
    <>
      <PageHeader
        eyebrow={team.division ?? "Opposing team"}
        title={team.name}
        subtitle={`${team.record.wins}–${team.record.losses}${team.record.rank ? ` · #${team.record.rank} in division` : ""}${team.sessionName ? ` · ${team.sessionName}` : ""}`}
      />

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        {/* Roster */}
        <section>
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-3xl tracking-wide">
            Roster
          </h2>
          {team.roster.length === 0 ? (
            <p className="surface p-6 text-sm text-[var(--fg-dim)]">
              No roster data yet.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {team.roster.map((p) => (
                <li key={p.id} className="surface p-4">
                  <Link
                    href={`/players/${p.id}`}
                    className="block font-[family-name:var(--font-display)] text-xl tracking-wide hover:text-[var(--color-brass)]"
                  >
                    {p.name}
                  </Link>
                  <p className="text-xs text-[var(--fg-dim)]">
                    {p.skillLevel != null && `SL${p.skillLevel}`}
                    {p.stats?.matchesPlayed != null && (
                      <>
                        {" · "}
                        <span>
                          {p.stats.wins ?? 0}/{p.stats.matchesPlayed}{" "}
                          ({p.stats.winPct ?? 0}%)
                        </span>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-3xl tracking-wide">
              Upcoming
            </h2>
            <ul className="surface divide-y divide-[var(--border)]">
              {upcoming.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between px-4 py-3">
                  <span>vs {m.opponent}</span>
                  <span className="text-xs text-[var(--fg-dim)]">
                    {formatDate(m.date)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-3xl tracking-wide">
              This session ({completed.length} matches)
            </h2>
            <ul className="surface divide-y divide-[var(--border)]">
              {completed.map((m) => {
                const won =
                  typeof m.teamScore === "number" &&
                  typeof m.opponentScore === "number" &&
                  m.teamScore > m.opponentScore;
                const lost =
                  typeof m.teamScore === "number" &&
                  typeof m.opponentScore === "number" &&
                  m.teamScore < m.opponentScore;
                return (
                  <li
                    key={m.id}
                    className="flex items-baseline justify-between px-4 py-3"
                  >
                    <span>
                      {team.matchesVsUs.includes(m.id) && (
                        <span className="mr-2 rounded-full bg-[var(--color-brass)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-brass-bright)]">
                          vs us
                        </span>
                      )}
                      vs {m.opponent}
                    </span>
                    <span className="flex items-baseline gap-3 text-sm tabular-nums">
                      <span
                        className={
                          won
                            ? "font-semibold text-[var(--color-felt-bright)]"
                            : lost
                              ? "font-semibold text-[var(--color-pop-bright)]"
                              : "text-[var(--fg-dim)]"
                        }
                      >
                        {m.teamScore ?? "-"}–{m.opponentScore ?? "-"}
                      </span>
                      <span className="text-xs text-[var(--fg-dim)]">
                        {formatDate(m.date)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="text-xs text-[var(--fg-dim)]">
          Last fetched {formatDate(team.lastFetched)} ·{" "}
          {team.url && (
            <a
              href={team.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--color-brass)] hover:underline"
            >
              View on APA league portal →
            </a>
          )}
        </p>
      </div>
    </>
  );
}
