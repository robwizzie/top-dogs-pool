import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/Section";
import { getAnyPlayerProfile, getCurrentSession } from "@/lib/apa";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const { profile } = await getAnyPlayerProfile(id);
  return {
    title: profile ? `${profile.name} · Player` : "Player",
    description: profile
      ? `${profile.name} — career profile, session-by-session record, and skill level history.`
      : "Player profile.",
  };
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  const [{ profile, isOpponent }, currentSession] = await Promise.all([
    getAnyPlayerProfile(id),
    getCurrentSession(),
  ]);
  if (!profile) notFound();
  // For OUR players, redirect to the existing roster page (richer feature set).
  if (!isOpponent) redirect(`/roster/${id}`);

  // Opp player view — simpler than the full roster page; surfaces career,
  // per-session SL trajectory, and team affiliations.
  const career = profile.career;
  const sessions = profile.sessions;
  const currentSessionId = currentSession?.id ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Opposing player"
        title={profile.name}
        subtitle={`${career.matchesPlayed} matches · ${career.wins}–${career.losses} (${career.winPct}%)${profile.currentSkillLevel ? ` · current SL${profile.currentSkillLevel}` : ""}`}
      />

      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        {/* Career card */}
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Career win %"
            value={`${career.winPct}%`}
            sub={`${career.wins} of ${career.matchesPlayed} matches`}
          />
          <Stat
            label="Current SL"
            value={profile.currentSkillLevel ? `SL${profile.currentSkillLevel}` : "—"}
            sub={
              profile.current
                ? `${profile.current.matchesPlayed ?? 0} matches this session`
                : "no current session"
            }
          />
          <Stat
            label="Sessions on record"
            value={String(sessions.length)}
            sub="across all teams we've scraped"
          />
        </section>

        {/* Per-session table */}
        {sessions.length > 0 && (
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-3xl tracking-wide">
              Session history
            </h2>
            <div className="surface overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-soft)] text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-3 py-3 text-center">SL</th>
                    <th className="px-3 py-3 text-right">Record</th>
                    <th className="px-3 py-3 text-right">Win %</th>
                    <th className="px-3 py-3 text-right">PA</th>
                    <th className="px-3 py-3 text-right">PPM</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const isCurrent =
                      currentSessionId != null && s.sessionId === currentSessionId;
                    return (
                      <tr
                        key={`${s.sessionId}-${s.teamId}`}
                        className={cn(
                          "border-b border-[var(--border)] last:border-0",
                          isCurrent && "bg-[var(--color-brass)]/10",
                        )}
                      >
                        <td className="px-4 py-3 text-[var(--fg-dim)]">
                          <span className="flex items-baseline gap-2">
                            <span>{s.sessionName}</span>
                            {isCurrent && (
                              <span className="rounded-full bg-[var(--color-brass)]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-brass-bright)]">
                                current
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/opponents/${s.teamId}`}
                            className="hover:text-[var(--color-brass)]"
                          >
                            {s.teamName}
                          </Link>
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3 text-center font-semibold tabular-nums",
                            isCurrent && "text-[var(--color-brass-bright)]",
                          )}
                        >
                          {s.skillLevel ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[var(--fg-dim)]">
                          {s.wins ?? 0}/{s.matchesPlayed ?? 0}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {s.winPct != null ? `${s.winPct}%` : "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[var(--fg-dim)]">
                          {s.pa ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[var(--fg-dim)]">
                          {s.ppm ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="text-xs text-[var(--fg-dim)]">
          Career stats from APA&apos;s league API. Per-match details (sweeps,
          B&amp;Rs, etc.) require parsing every scoresheet — currently only
          available for matches against us.
        </p>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide tabular-nums">
        {value}
      </p>
      {sub && <p className="text-[10px] text-[var(--fg-dim)]">{sub}</p>}
    </div>
  );
}
