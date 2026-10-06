import { Film, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { YouTubeEmbed } from "@/components/clips/YouTubeEmbed";
import { LiveCTA } from "@/components/live/LiveCTA";
import { PoolBall } from "@/components/brand/PoolBall";
import { getClips } from "@/lib/youtube/client";

export const revalidate = 21600;

export const metadata = {
  title: "Clips",
  description: "Highlights from Top Dawgs matches.",
};

export default async function ClipsPage() {
  const clips = await getClips();
  const [feature, ...rest] = clips;
  return (
    <>
      <PageHeader
        eyebrow="Highlights"
        title="Clips"
        subtitle={
          clips.length
            ? `${clips.length} clip${clips.length === 1 ? "" : "s"} from match nights.`
            : "Highlights from match nights."
        }
      />
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-2 sm:px-6 lg:px-8">
        {clips.length === 0 ? (
          <EmptyReel />
        ) : (
          <>
            {/* Latest clip gets the big screen. */}
            <div className="mb-6 flex items-end gap-4 sm:gap-6">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.34em] text-[var(--color-brass)]">
                  Latest
                </p>
                <h2 className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide text-[var(--color-cream)] sm:text-4xl">
                  Fresh off the felt
                </h2>
              </div>
              <div className="pm-rule mb-2 hidden flex-1 sm:block" aria-hidden />
            </div>
            <div className="mx-auto max-w-5xl">
              <YouTubeEmbed clip={feature} priority />
            </div>

            {rest.length > 0 && (
              <>
                <div className="mb-6 mt-14 flex items-end gap-4 sm:gap-6">
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.34em] text-[var(--color-brass)]">
                      The reel
                    </p>
                    <h2 className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide text-[var(--color-cream)] sm:text-4xl">
                      More from match nights
                    </h2>
                  </div>
                  <div className="pm-rule mb-2 hidden flex-1 sm:block" aria-hidden />
                </div>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {rest.map((c) => (
                    <YouTubeEmbed key={c.id} clip={c} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Empty state: a dark screen waiting for the first highlight. */
function EmptyReel() {
  return (
    <div className="pm-glass pm-grain relative overflow-hidden">
      <div className="relative z-[2] grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:p-12">
        {/* the screen */}
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/[0.08] bg-[radial-gradient(90%_80%_at_50%_0%,rgba(46,139,87,0.55),rgba(12,32,22,0.9)_60%,#050605)] shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]">
          {/* scan lines */}
          <div
            className="absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(0deg,#fff_0_1px,transparent_1px_4px)]"
            aria-hidden
          />
          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-md bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/60">
            <Film size={12} /> Reel 01
          </div>
          <div className="absolute bottom-[18%] left-[16%] opacity-80 drop-shadow-[0_12px_14px_rgba(0,0,0,0.6)]" aria-hidden>
            <PoolBall number={9} size={34} />
          </div>
          <div className="absolute right-[18%] top-[22%] opacity-70 blur-[1px] drop-shadow-[0_12px_14px_rgba(0,0,0,0.6)]" aria-hidden>
            <PoolBall number={6} size={28} />
          </div>
          <span className="absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--color-brass)]/40 bg-black/40 text-[var(--color-brass-bright)] shadow-[0_0_40px_-6px_rgba(201,162,74,0.6)] backdrop-blur-sm">
            <Play size={24} className="ml-0.5" fill="currentColor" />
          </span>
          {/* scrubber */}
          <div className="absolute inset-x-4 bottom-4 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div className="h-full w-[8%] rounded-full bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-brass-bright)]" />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[var(--color-brass)]">
            Coming soon
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-[0.9] tracking-wide text-[var(--color-cream)] sm:text-6xl">
            Highlights <span className="pm-serif text-[0.8em] text-[var(--color-brass-bright)]">on deck</span>
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-[var(--color-cream)]/70">
            Highlights coming soon — match clips will land here as we tag the
            YouTube playlist.
          </p>
          <div className="mt-7">
            <LiveCTA variant="ghost" />
          </div>
        </div>
      </div>
    </div>
  );
}
