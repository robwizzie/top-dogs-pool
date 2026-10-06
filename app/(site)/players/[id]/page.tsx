import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/Section";
import { getAnyPlayerProfile, getCurrentSession } from "@/lib/apa";
import { cn } from "@/lib/utils";
import { PoolBall } from "@/components/brand/PoolBall";
import {
  NUM,
  SectionHead,
  StatRail,
  TABLE_WRAP,
  TH,
  THEAD_ROW,
  TR,
  TR_OURS,
} from "@/components/research/ScoutUI";

export const revalidate = 3600;

/** Rendered on first request per id, then cached. */
export function generateStaticParams() {
  return [];
}

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

      <div className="mx-auto max-w-7xl space-y-14 px-4 pb-16 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        {/* Career — on the rail */}
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <StatRail
            className="fade-in-up mt-2"
            stats={[
              {
                label: "Career win %",
                value: `${career.winPct}%`,
                sub: `${career.wins} of ${career.matchesPlayed} matches`,
                tone: "foil",
              },
              {
                label: "Current SL",
                value: profile.currentSkillLevel
                  ? `SL${profile.currentSkillLevel}`
                  : "—",
                sub: profile.current
                  ? `${profile.current.matchesPlayed ?? 0} matches this session`
                  : "no current session",
              },
              {
                label: "Sessions on record",
                value: String(sessions.length),
                sub: "across all teams we've scraped",
              },
            ]}
          />
          {profile.currentSkillLevel ? (
            <div
              aria-hidden
              className="fade-in-up relative hidden w-44 items-center justify-center lg:flex"
              style={{ animationDelay: "120ms" }}
            >
              <span className="absolute inset-4 rounded-full bg-[radial-gradient(circle,rgba(46,139,87,0.45),transparent_70%)] blur-xl" />
              <PoolBall
                number={profile.currentSkillLevel}
                size={128}
                className="relative drop-shadow-[0_30px_30px_rgba(0,0,0,0.7)]"
              />
            </div>
          ) : null}
        </div>

        {/* Per-session table */}
        {sessions.length > 0 && (
          <section>
            <SectionHead eyebrow="Every session" title="Session history" />
            <div className={cn(TABLE_WRAP, "pm-reveal")}>
              <table className="w-full min-w-[38rem] text-sm">
                <thead>
                  <tr className={THEAD_ROW}>
                    <th className={TH}>Session</th>
                    <th className={TH}>Team</th>
                    <th className={cn(TH, "text-center")}>SL</th>
                    <th className={cn(TH, "text-right")}>Record</th>
                    <th className={cn(TH, "text-right")}>Win %</th>
                    <th className={cn(TH, "text-right")}>PA</th>
                    <th className={cn(TH, "text-right")}>PPM</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const isCurrent =
                      currentSessionId != null && s.sessionId === currentSessionId;
                    return (
                      <tr
                        key={`${s.sessionId}-${s.teamId}`}
                        className={cn(TR, isCurrent && TR_OURS)}
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-cream)]/70">
                          <span className="flex items-center gap-2">
                            <span>{s.sessionName}</span>
                            {isCurrent && (
                              <span className="rounded-full bg-[var(--color-brass)]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-brass-bright)] ring-1 ring-inset ring-[var(--color-brass)]/40">
                                current
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/opponents/${s.teamId}`}
                            className="font-medium text-[var(--color-cream)] transition-colors hover:text-[var(--color-brass-bright)]"
                          >
                            {s.teamName}
                          </Link>
                        </td>
                        <td
                          className={cn(
                            NUM,
                            "px-3 py-3.5 text-center text-xl",
                            isCurrent
                              ? "text-[var(--color-brass-bright)]"
                              : "text-[var(--color-cream)]",
                          )}
                        >
                          {s.skillLevel ?? "—"}
                        </td>
                        <td className={cn(NUM, "px-3 py-3.5 text-right text-[var(--color-cream)]/60")}>
                          {s.wins ?? 0}/{s.matchesPlayed ?? 0}
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <WinPct pct={s.winPct} />
                        </td>
                        <td className={cn(NUM, "px-3 py-3.5 text-right text-[var(--color-cream)]/60")}>
                          {s.pa ?? "—"}
                        </td>
                        <td className={cn(NUM, "px-3 py-3.5 text-right text-[var(--color-cream)]/60")}>
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

        <p className="max-w-3xl border-t border-[var(--color-cream)]/[0.07] pt-5 text-xs leading-relaxed text-[var(--color-cream)]/45">
          Career stats from APA&apos;s league API. Per-match details (sweeps,
          B&amp;Rs, etc.) require parsing every scoresheet — currently only
          available for matches against us.
        </p>
      </div>
    </>
  );
}

/** Win % with a slim bar so a column of them reads at a glance. */
function WinPct({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-[var(--color-cream)]/40">—</span>;
  const tone =
    pct >= 60
      ? "bg-[var(--color-pop-bright)]"
      : pct <= 40
        ? "bg-[var(--color-felt-bright)]"
        : "bg-[var(--color-brass)]";
  return (
    <span className="inline-flex items-center justify-end gap-2.5">
      <span className="hidden h-1 w-14 overflow-hidden rounded-full bg-white/[0.06] sm:block">
        <span
          className={cn("block h-full rounded-full", tone)}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </span>
      <span className={cn(NUM, "w-14 text-right text-[var(--color-cream)]")}>{pct}%</span>
    </span>
  );
}
