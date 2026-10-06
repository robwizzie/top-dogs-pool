import { ArrowRight, Calendar, Heart, Radio } from "lucide-react";
import { PageHeader, Section } from "@/components/ui/Section";
import { YouTubeEmbed } from "@/components/clips/YouTubeEmbed";
import { Logo } from "@/components/brand/Logo";
import { RackArt } from "@/components/home/RackArt";
import { StreamCountdown } from "@/components/live/StreamCountdown";
import { getClips } from "@/lib/youtube/client";
import {
  TIKTOK_HANDLE,
  TIKTOK_LIVE_URL,
  TIKTOK_PROFILE_URL,
} from "@/lib/config";
import { formatDate, formatTime, isPoolNightLive, nextPoolNightStart } from "@/lib/utils";

// The live banner just flips on/off based on the schedule (Tue 7:30-11:30pm);
// a 5-min stale window is fine and saves a lot of background regen cycles.
export const revalidate = 300;

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
      >
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-pop)]/60 bg-[var(--color-pop)]/15 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-pop-bright)] backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse-pop rounded-full bg-[var(--color-pop-bright)]" />
              On air
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/70 backdrop-blur-sm">
              <Calendar size={12} className="text-[var(--color-brass-bright)]" />
              {formatDate(nextStart!)}
            </span>
          )}
          <a
            href={TIKTOK_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-[var(--color-brass-bright)] backdrop-blur-sm transition-colors hover:border-[var(--color-brass)]/50"
          >
            @{TIKTOK_HANDLE}
          </a>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-7xl px-4 pb-6 pt-2 sm:px-6 lg:px-8">
        <div className="grid items-stretch gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8">
          {/* The invite */}
          <div className="pm-glass pm-grain relative flex flex-col justify-center overflow-hidden p-7 sm:p-10 lg:p-12">
            <div
              className={`pointer-events-none absolute -left-24 -top-24 -z-10 h-80 w-80 rounded-full blur-3xl ${
                live ? "bg-[var(--color-pop)]/20" : "bg-[var(--color-felt-bright)]/20"
              }`}
              aria-hidden
            />
            <div className="relative z-[2]">
              {live ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-pop)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-white shadow-[0_0_24px_-4px_rgba(232,82,72,0.8)]">
                  <span className="h-2 w-2 animate-pulse-pop rounded-full bg-white" />
                  Live now
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brass)]/30 bg-[var(--color-brass)]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass-bright)]">
                  <Calendar size={12} />
                  Off air
                </span>
              )}

              <h2 className="mt-5 font-[family-name:var(--font-display)] text-5xl leading-[0.9] tracking-wide text-[var(--color-cream)] sm:text-6xl lg:text-7xl">
                {live ? (
                  <>
                    Watch the table <span className="pm-foil">now</span>
                  </>
                ) : (
                  <>
                    Catch us <span className="pm-foil">next Tuesday</span>
                  </>
                )}
              </h2>

              {live ? (
                <p className="mt-4 max-w-xl leading-relaxed text-[var(--color-cream)]/70">
                  Every match, every break, every shot. We&apos;re on the felt right
                  now — drop in, drop a comment, cheer the Top Dawgs.
                </p>
              ) : (
                <p className="mt-4 max-w-xl leading-relaxed text-[var(--color-cream)]/70">
                  Match night is Tuesday 7:30 – 11:30pm. Up next:{" "}
                  <span className="font-semibold text-[var(--color-cream)]">
                    {formatDate(nextStart!)} at {formatTime(nextStart!)}
                  </span>
                  . Follow{" "}
                  <span className="text-[var(--color-brass-bright)]">
                    @{TIKTOK_HANDLE}
                  </span>{" "}
                  on TikTok so the live stream pings you.
                </p>
              )}

              {!live && (
                <div className="mt-8">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-cream)]/45">
                    Next break in
                  </p>
                  <StreamCountdown target={nextStart!.toISOString()} />
                </div>
              )}

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href={live ? TIKTOK_LIVE_URL : TIKTOK_PROFILE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    live
                      ? "group inline-flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,#f0685e,var(--color-pop)_60%,#a82a24)] px-5 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_32px_-10px_rgba(232,82,72,0.8)] transition-[filter,transform] hover:-translate-y-px hover:brightness-110"
                      : "pm-btn group"
                  }
                >
                  {live ? (
                    <>
                      <Radio size={16} />
                      Open TikTok Live
                    </>
                  ) : (
                    <>Follow on TikTok</>
                  )}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </a>
                {live && (
                  <a
                    href={TIKTOK_PROFILE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-brass)]/40 bg-black/30 px-5 py-3 text-sm font-semibold text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10"
                  >
                    View profile →
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* The phone, tuned to the table */}
          <PhoneFrame live={live} />
        </div>

        {/* Stream schedule on the rail */}
        <dl className="pm-rail relative mt-12 grid grid-cols-2 sm:grid-cols-4">
          <RailCell label="Match night">Tuesdays</RailCell>
          <RailCell label="First break" accent>
            7:30<span className="text-[0.5em] text-[var(--color-cream)]/50">pm</span>
          </RailCell>
          <RailCell label="Last rack">
            11:30<span className="text-[0.5em] text-[var(--color-cream)]/50">pm</span>
          </RailCell>
          <RailCell label="Streaming on">TikTok</RailCell>
          {/* diamond sights inlaid along the rail (after the cells so the
              cells' :nth-child borders stay right) */}
          {[12.5, 37.5, 62.5, 87.5].map((x) => (
            <span key={x} aria-hidden className="pm-diamond hidden sm:block" style={{ left: `${x}%`, top: 14 }} />
          ))}
        </dl>
      </div>

      {clips.length > 0 && (
        <Section eyebrow="Replay the run" title="Recent Clips">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {clips.map((c, i) => (
              <YouTubeEmbed key={c.id} clip={c} priority={i === 0} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

const CELL =
  "relative min-w-0 border-[var(--color-cream)]/[0.07] px-5 py-5 even:border-l sm:px-6 sm:[&:not(:first-child)]:border-l [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0";

function RailCell({
  label,
  accent = false,
  children,
}: {
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={CELL}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/50">
        {label}
      </dt>
      <dd
        className={`mt-1.5 font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide tabular-nums sm:text-5xl ${
          accent ? "pm-foil" : "text-[var(--color-cream)]"
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

/** A stylised phone showing the stream: felt, the lamp, a fresh rack. */
function PhoneFrame({ live }: { live: boolean }) {
  return (
    <a
      href={live ? TIKTOK_LIVE_URL : TIKTOK_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={live ? "Open the TikTok live stream" : `Open @${TIKTOK_HANDLE} on TikTok`}
      className="group relative mx-auto block w-full max-w-[20rem] lg:max-w-[22rem]"
    >
      {/* felt glow pooling under the phone */}
      <div
        className="absolute inset-x-0 bottom-[-6%] top-[20%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(46,139,87,0.45),transparent)] blur-2xl"
        aria-hidden
      />
      <div className="relative rounded-[2.75rem] bg-[linear-gradient(160deg,#3a3326,#14120e_40%,#2a2419)] p-[9px] shadow-[0_50px_100px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,236,190,0.25),0_0_0_1px_rgba(201,162,74,0.35)] transition-transform duration-500 group-hover:-translate-y-1">
        <div className="pm-grain relative aspect-[9/17] overflow-hidden rounded-[2.2rem]">
          <div className="pm-felt absolute inset-0 -z-20" aria-hidden />
          <div className="pm-lamp pm-lamp-flicker absolute inset-0 -z-10" aria-hidden />
          <div
            className="absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_50%_40%,transparent_40%,rgba(0,0,0,0.7)_100%)]"
            aria-hidden
          />
          {/* dynamic island */}
          <div className="absolute left-1/2 top-2.5 z-[3] h-6 w-24 -translate-x-1/2 rounded-full bg-black" aria-hidden />

          {/* stream chrome */}
          <div className="absolute inset-x-0 top-11 z-[3] flex items-center justify-between px-4">
            <div className="flex min-w-0 items-center gap-2 rounded-full bg-black/45 py-1 pl-1 pr-3 backdrop-blur-sm">
              <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--color-brass)]/50">
                <Logo size={28} className="!h-7 !w-7" />
              </span>
              <span className="truncate text-[11px] font-semibold text-white/90">@{TIKTOK_HANDLE}</span>
            </div>
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-pop)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                <span className="h-1.5 w-1.5 animate-pulse-pop rounded-full bg-white" />
                Live
              </span>
            ) : (
              <span className="rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
                Off air
              </span>
            )}
          </div>

          {/* the table */}
          <div className="absolute inset-0 z-[2] flex items-center justify-center">
            <RackArt ball={30} className="rotate-[-8deg] drop-shadow-[0_24px_30px_rgba(0,0,0,0.6)] transition-transform duration-700 group-hover:rotate-[-4deg]" />
          </div>

          {/* side rail of reactions */}
          <div className="absolute bottom-24 right-3 z-[3] flex flex-col items-center gap-1 text-white/85" aria-hidden>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
              <Heart size={18} className="fill-[var(--color-pop-bright)] text-[var(--color-pop-bright)]" />
            </span>
          </div>

          {/* caption */}
          <div className="absolute inset-x-0 bottom-0 z-[3] bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-5 pt-14">
            <p className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide text-[var(--color-cream)]">
              Top Dawgs · <span className="text-[var(--color-brass-bright)]">match night</span>
            </p>
            <p className="mt-1.5 text-[11px] text-white/60">Tuesdays · 7:30 – 11:30pm</p>
          </div>
        </div>
      </div>
    </a>
  );
}
