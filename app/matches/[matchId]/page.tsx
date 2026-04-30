import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { YouTubeEmbed } from "@/components/clips/YouTubeEmbed";
import { getMatch } from "@/lib/apa";
import { getClipsForMatch } from "@/lib/youtube/client";
import { formatDate, formatTime } from "@/lib/utils";

export const revalidate = 3600;

type Props = { params: Promise<{ matchId: string }> };

export async function generateMetadata({ params }: Props) {
  const { matchId } = await params;
  const match = await getMatch(matchId);
  return { title: match ? `vs ${match.opponent}` : "Match" };
}

export default async function MatchPage({ params }: Props) {
  const { matchId } = await params;
  const [match, clips] = await Promise.all([
    getMatch(matchId),
    getClipsForMatch(matchId),
  ]);
  if (!match) notFound();

  const isWin =
    match.teamScore !== undefined &&
    match.opponentScore !== undefined &&
    match.teamScore > match.opponentScore;
  const eyebrow = match.status === "completed" ? (isWin ? "WIN" : "LOSS") : "UPCOMING";

  return (
    <>
      <PageHeader
        eyebrow={eyebrow + (match.sweep ? " · SWEEP" : "")}
        title={<span>vs <span className="text-[var(--color-brass-bright)]">{match.opponent}</span></span>}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--fg-dim)]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} />
              {formatDate(match.date)} · {formatTime(match.date)}
            </span>
            {match.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} />
                {match.location}
              </span>
            )}
          </span>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/schedule"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--fg-dim)] hover:text-[var(--color-brass)]"
        >
          <ArrowLeft size={14} /> Back to schedule
        </Link>

        {match.teamScore !== undefined && (
          <div className="surface mb-8 flex items-center justify-around gap-6 p-8">
            <ScoreBlock label="Top Dogs" score={match.teamScore} winner={isWin} />
            <span className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--fg-dim)]">
              vs
            </span>
            <ScoreBlock
              label={match.opponent}
              score={match.opponentScore ?? 0}
              winner={!isWin && match.status === "completed"}
            />
          </div>
        )}

        {match.results.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide">
              Individual Results
            </h2>
            <ul className="surface divide-y divide-[var(--border)]">
              {match.results.map((r) => (
                <li key={`${r.playerId}-${r.opponentName}`} className="flex items-center gap-4 p-4">
                  <span
                    className={
                      r.outcome === "W"
                        ? "inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-felt-bright)]/20 text-xs font-bold text-[var(--color-felt-bright)]"
                        : "inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-pop)]/20 text-xs font-bold text-[var(--color-pop-bright)]"
                    }
                  >
                    {r.outcome}
                  </span>
                  <div className="flex-1 truncate">
                    <Link
                      href={`/roster/${r.playerId}`}
                      className="text-sm font-medium hover:text-[var(--color-brass)]"
                    >
                      {r.playerName}
                    </Link>
                    <p className="text-xs text-[var(--fg-dim)]">vs {r.opponentName}</p>
                  </div>
                  <div className="text-right text-sm">
                    {r.score && <span className="font-medium">{r.score}</span>}
                    {r.miniSweep && (
                      <span className="ml-2 inline-block rounded-full bg-[var(--color-brass)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-brass-bright)]">
                        Mini Sweep
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {clips.length > 0 && (
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide">
              Match Clips
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clips.map((c, i) => (
                <YouTubeEmbed key={c.id} clip={c} priority={i === 0} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function ScoreBlock({
  label,
  score,
  winner,
}: {
  label: string;
  score: number;
  winner?: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${
          winner ? "text-[var(--color-brass)]" : "text-[var(--fg-dim)]"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 font-[family-name:var(--font-display)] text-6xl leading-none tracking-wide ${
          winner ? "text-[var(--color-brass-bright)]" : "text-[var(--fg)]"
        }`}
      >
        {score}
      </p>
    </div>
  );
}
