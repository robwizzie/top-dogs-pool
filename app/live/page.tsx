import { ArrowRight, Calendar, Radio } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { YouTubeEmbed } from "@/components/clips/YouTubeEmbed";
import { PoolBall } from "@/components/brand/PoolBall";
import { getClips } from "@/lib/youtube/client";
import {
  TIKTOK_HANDLE,
  TIKTOK_LIVE_URL,
  TIKTOK_PROFILE_URL,
} from "@/lib/config";
import { formatDate, formatTime, isPoolNightLive, nextPoolNightStart } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Live",
  description: "Watch Top Dawgs match nights live on TikTok — Tuesdays 7:30pm.",
};

export default async function LivePage() {
  const clips = (await getClips()).slice(0, 6);
  const live = isPoolNightLive();
  const nextStart = live ? null : nextPoolNightStart();

  return (
    <>
      <PageHeader
        eyebrow="Match Nights"
        title={live ? "Live Now on TikTok" : "Next Stream Tuesday 7:30pm"}
        subtitle={`Tuesdays 7:30 – 11:30pm. Follow @${TIKTOK_HANDLE} on TikTok.`}
      />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="surface relative overflow-hidden p-8 sm:p-12">
          <div className="absolute -right-10 -top-10 opacity-20">
            <PoolBall number={8} size={260} />
          </div>
          <div className="absolute right-12 bottom-8 hidden opacity-30 sm:block">
            <PoolBall number={6} size={120} />
          </div>

          <div className="relative">
            {live ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-pop)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-white">
                <span className="h-2 w-2 animate-pulse-pop rounded-full bg-white" />
                Live now
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brass)]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass-bright)]">
                <Calendar size={12} />
                Off air
              </span>
            )}

            <h2 className="mt-4 font-[family-name:var(--font-display)] text-5xl tracking-wide sm:text-6xl">
              {live ? "Watch the table now" : "Catch us next Tuesday"}
            </h2>

            {live ? (
              <p className="mt-3 max-w-xl text-[var(--fg-dim)]">
                Every match, every break, every shot. We&apos;re on the felt right
                now — drop in, drop a comment, cheer the Top Dawgs.
              </p>
            ) : (
              <p className="mt-3 max-w-xl text-[var(--fg-dim)]">
                Match night is Tuesday 7:30 – 11:30pm. Up next:{" "}
                <span className="font-semibold text-[var(--fg)]">
                  {formatDate(nextStart!)} at {formatTime(nextStart!)}
                </span>
                . Follow{" "}
                <span className="text-[var(--color-brass)]">
                  @{TIKTOK_HANDLE}
                </span>{" "}
                on TikTok so the live stream pings you.
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={live ? TIKTOK_LIVE_URL : TIKTOK_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-pop)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-pop-bright)]"
              >
                {live ? (
                  <>
                    <Radio size={16} />
                    Open TikTok Live
                  </>
                ) : (
                  <>Follow on TikTok</>
                )}
                <ArrowRight size={16} />
              </a>
              {live && (
                <a
                  href={TIKTOK_PROFILE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[var(--fg-dim)] hover:text-[var(--color-brass)]"
                >
                  View profile →
                </a>
              )}
            </div>
          </div>
        </div>

        {clips.length > 0 && (
          <section className="mt-12">
            <h3 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide">
              Recent Clips
            </h3>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
