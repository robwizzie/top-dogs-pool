import Link from "next/link";
import { ArrowRight, Trophy, Users, Video } from "lucide-react";
import { Hero } from "@/components/hero/Hero";
import { Section } from "@/components/ui/Section";
import { MatchCard } from "@/components/cards/MatchCard";
import { PlayerCard } from "@/components/cards/PlayerCard";
import { YouTubeEmbed } from "@/components/clips/YouTubeEmbed";
import { PoolBall } from "@/components/brand/PoolBall";
import { getLeaderboard, getRoster, getStandings, getTeam } from "@/lib/apa";
import { getClips } from "@/lib/youtube/client";
import { TIKTOK_PROFILE_URL } from "@/lib/config";

export const revalidate = 3600;

export default async function HomePage() {
  const [team, roster, leaderboard, standings, clips] = await Promise.all([
    getTeam(),
    getRoster(),
    getLeaderboard(),
    getStandings(),
    getClips(),
  ]);

  const ourStanding = standings.find((s) => s.isOurs);
  const upcoming = team?.upcomingMatch ?? null;
  const recent = team?.recentMatches ?? [];
  const topSweepers = leaderboard.filter((r) => r.sweeps > 0 || r.miniSweeps > 0).slice(0, 3);
  const featuredClips = clips.slice(0, 3);
  const previewRoster = roster.slice(0, 4);

  return (
    <>
      <Hero
        record={team?.record ?? { wins: 0, losses: 0 }}
        division={team?.division}
      />

      {/* Upcoming + Standing snapshot */}
      <Section eyebrow="On Deck" title="Next Up">
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          {upcoming ? (
            <MatchCard match={upcoming} highlight />
          ) : (
            <EmptyCard message="No upcoming match scheduled — check back after the next league update." />
          )}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <SnapshotCard
              icon={<Trophy size={18} />}
              label="Division"
              value={
                ourStanding
                  ? `#${ourStanding.rank} of ${standings.length}`
                  : "—"
              }
              sub={ourStanding ? `${ourStanding.points} pts` : team?.division}
              href="/standings"
            />
            <SnapshotCard
              icon={<Users size={18} />}
              label="Roster"
              value={`${roster.length} players`}
              sub="Tap to see the team"
              href="/roster"
            />
          </div>
        </div>
      </Section>

      {/* Sweeps preview */}
      <Section
        eyebrow="Leaderboard"
        title="Sweeps & Mini-Sweeps"
        action={
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brass)] hover:text-[var(--color-brass-bright)]"
          >
            Full leaderboard <ArrowRight size={14} />
          </Link>
        }
      >
        {topSweepers.length ? (
          <ol className="surface divide-y divide-[var(--border)]">
            {topSweepers.map((row, i) => (
              <li key={row.playerId} className="flex items-center gap-4 p-4">
                <span className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--color-brass-bright)]">
                  {i + 1}
                </span>
                <PoolBall number={(i % 7) + 1} size={36} />
                <Link
                  href={`/roster/${row.playerId}`}
                  className="flex-1 truncate text-base font-medium hover:text-[var(--color-brass)]"
                >
                  {row.playerName}
                </Link>
                <div className="text-right">
                  <div className="text-sm">
                    <span className="font-bold text-[var(--color-pop-bright)]">
                      {row.sweeps}
                    </span>{" "}
                    <span className="text-[var(--fg-dim)]">sweep{row.sweeps === 1 ? "" : "s"}</span>
                  </div>
                  <div className="text-xs text-[var(--fg-dim)]">
                    {row.miniSweeps} mini · {row.wins}W
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyCard message="No sweeps yet this season — be the first to put one on the board." />
        )}
      </Section>

      {/* Roster preview */}
      <Section
        eyebrow="Pack"
        title="The Team"
        action={
          <Link
            href="/roster"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brass)] hover:text-[var(--color-brass-bright)]"
          >
            Full roster <ArrowRight size={14} />
          </Link>
        }
      >
        {previewRoster.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {previewRoster.map((p, i) => (
              <PlayerCard key={p.id} player={p} index={i} />
            ))}
          </div>
        ) : (
          <EmptyCard message="Roster is syncing from APA — refresh in a minute." />
        )}
      </Section>

      {/* Recent matches */}
      {recent.length > 0 && (
        <Section
          eyebrow="History"
          title="Recent Matches"
          action={
            <Link
              href="/schedule"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brass)] hover:text-[var(--color-brass-bright)]"
            >
              All matches <ArrowRight size={14} />
            </Link>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recent.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </Section>
      )}

      {/* Clips */}
      <Section
        eyebrow="Highlights"
        title="Match Clips"
        action={
          <Link
            href="/clips"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brass)] hover:text-[var(--color-brass-bright)]"
          >
            All clips <ArrowRight size={14} />
          </Link>
        }
      >
        {featuredClips.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featuredClips.map((c, i) => (
              <YouTubeEmbed key={c.id} clip={c} priority={i === 0} />
            ))}
          </div>
        ) : (
          <EmptyCard
            message="Clips will appear here once the YouTube playlist is connected. Set YOUTUBE_API_KEY and YOUTUBE_PLAYLIST_ID to go live."
            icon={<Video size={20} />}
          />
        )}
      </Section>

      {/* TikTok CTA */}
      <Section className="!pb-24" contentClassName="">
        <a
          href={TIKTOK_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="surface surface-hover relative flex flex-col items-start gap-4 overflow-hidden p-8 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="absolute -right-10 -top-10 opacity-15">
            <PoolBall number={8} size={220} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              Match nights
            </p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">
              Watch us live on TikTok
            </h3>
            <p className="mt-2 max-w-xl text-[var(--fg-dim)]">
              Live streams every match night — every shot, every break. Follow
              along, drop a comment, cheer the Top Dogs.
            </p>
          </div>
          <span className="relative inline-flex items-center gap-2 rounded-full bg-[var(--color-pop)] px-5 py-3 text-sm font-semibold text-white">
            <span className="h-2 w-2 animate-pulse-pop rounded-full bg-white" />
            Open TikTok
            <ArrowRight size={16} />
          </span>
        </a>
      </Section>
    </>
  );
}

function SnapshotCard({
  icon,
  label,
  value,
  sub,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="surface surface-hover group flex flex-col justify-between p-5"
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
        {icon}
        {label}
      </div>
      <div className="mt-3">
        <div className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--color-cream)]">
          {value}
        </div>
        {sub && <div className="mt-1 text-sm text-[var(--fg-dim)]">{sub}</div>}
      </div>
      <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--fg-dim)] transition-colors group-hover:text-[var(--color-brass)]">
        View <ArrowRight size={12} />
      </span>
    </Link>
  );
}

function EmptyCard({
  message,
  icon,
}: {
  message: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="surface flex items-center gap-3 p-6 text-sm text-[var(--fg-dim)]">
      {icon}
      {message}
    </div>
  );
}
