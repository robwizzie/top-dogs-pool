import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { YouTubeEmbed } from "@/components/clips/YouTubeEmbed";
import { PoolBall } from "@/components/brand/PoolBall";
import { getLeaderboard, getPlayer, getSchedule } from "@/lib/apa";
import { getClipsForPlayer } from "@/lib/youtube/client";
import { formatDate, pct } from "@/lib/utils";

export const revalidate = 3600;

type Props = { params: Promise<{ playerId: string }> };

export async function generateMetadata({ params }: Props) {
  const { playerId } = await params;
  const { player } = await getPlayer(playerId);
  return { title: player?.name ?? "Player" };
}

export default async function PlayerPage({ params }: Props) {
  const { playerId } = await params;
  const [{ player, stats }, leaderboard, schedule, clips] = await Promise.all([
    getPlayer(playerId),
    getLeaderboard(),
    getSchedule(),
    getClipsForPlayer(playerId),
  ]);

  if (!player) notFound();

  const sweepRow = leaderboard.find((r) => r.playerId === playerId);
  const matchHistory = schedule
    .filter((m) => m.status === "completed")
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 8);

  const wins = stats?.wins ?? sweepRow?.wins ?? 0;
  const losses = stats?.losses ?? Math.max((sweepRow?.matchesPlayed ?? 0) - (sweepRow?.wins ?? 0), 0);
  const matchesPlayed = stats?.matchesPlayed ?? sweepRow?.matchesPlayed ?? 0;

  return (
    <>
      <PageHeader
        eyebrow={player.format !== "unknown" ? player.format : "Player"}
        title={player.name}
        subtitle={
          player.skillLevel ? `Skill Level ${player.skillLevel}` : undefined
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/roster"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--fg-dim)] hover:text-[var(--color-brass)]"
        >
          <ArrowLeft size={14} /> Back to roster
        </Link>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Record">
            {wins}<span className="text-[var(--fg-dim)]">–</span>{losses}
          </StatTile>
          <StatTile label="Win %">
            {matchesPlayed ? `${pct(wins, matchesPlayed)}%` : "—"}
          </StatTile>
          <StatTile label="Sweeps" accent>
            {sweepRow?.sweeps ?? 0}
          </StatTile>
          <StatTile label="Mini-Sweeps" accent>
            {sweepRow?.miniSweeps ?? 0}
          </StatTile>
          {stats?.innings !== undefined && (
            <StatTile label="Innings">{stats.innings}</StatTile>
          )}
          {stats?.defensiveShots !== undefined && (
            <StatTile label="Def. Shots">{stats.defensiveShots}</StatTile>
          )}
          {stats?.pa !== undefined && (
            <StatTile label="PA">{stats.pa.toFixed(2)}</StatTile>
          )}
          {stats?.mpr !== undefined && (
            <StatTile label="MPR">{stats.mpr.toFixed(2)}</StatTile>
          )}
        </div>

        <section className="mt-12">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide">
            Recent Matches
          </h2>
          {matchHistory.length === 0 ? (
            <p className="surface p-6 text-sm text-[var(--fg-dim)]">
              No completed matches yet.
            </p>
          ) : (
            <ul className="surface divide-y divide-[var(--border)]">
              {matchHistory.map((m) => {
                const mine = m.results.find((r) => r.playerId === playerId);
                return (
                  <li key={m.id}>
                    <Link
                      href={`/matches/${m.id}`}
                      className="flex items-center gap-4 p-4 hover:bg-[var(--bg-soft)]"
                    >
                      <PoolBall
                        number={mine?.outcome === "W" ? 6 : 8}
                        size={28}
                      />
                      <div className="flex-1 truncate">
                        <p className="text-sm font-medium">vs {m.opponent}</p>
                        <p className="text-xs text-[var(--fg-dim)]">
                          {formatDate(m.date)}
                          {mine?.score && ` · ${mine.score}`}
                        </p>
                      </div>
                      <span
                        className={
                          mine?.outcome === "W"
                            ? "text-sm font-bold text-[var(--color-felt-bright)]"
                            : mine?.outcome === "L"
                              ? "text-sm font-bold text-[var(--color-pop-bright)]"
                              : "text-sm text-[var(--fg-dim)]"
                        }
                      >
                        {mine?.outcome ?? "—"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {clips.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide">
              Highlight Reel
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

function StatTile({
  label,
  children,
  accent = false,
}: {
  label: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="surface px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        {label}
      </p>
      <p
        className={`mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide ${
          accent ? "text-[var(--color-pop-bright)]" : "text-[var(--color-cream)]"
        }`}
      >
        {children}
      </p>
    </div>
  );
}
