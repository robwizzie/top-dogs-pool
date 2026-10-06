import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CueBall } from "@/components/brand/PoolBall";
import { FeltStage } from "@/components/ui/FeltStage";

/* The cue ball rolls in from the left, teeters on the lip and drops into the
 * pocket, on a slow loop. The ball sits in a box clipped at the pocket's
 * mid-line, so the near lip swallows it as it falls. Reduced motion gets a
 * still frame: the ball hanging on the lip. */
const SCENE_CSS = `
@keyframes nf-roll {
  0%   { transform: translate3d(-340px, 0, 0); opacity: 0; }
  6%   { opacity: 1; }
  44%  { transform: translate3d(0, 0, 0); animation-timing-function: ease-in-out; }
  50%  { transform: translate3d(4px, 5px, 0); animation-timing-function: cubic-bezier(.5,0,1,.6); }
  60%  { transform: translate3d(4px, 86px, 0); opacity: 1; }
  61%, 100% { transform: translate3d(4px, 86px, 0); opacity: 0; }
}
@keyframes nf-shadow {
  0%   { transform: translate3d(-340px, 0, 0) scaleX(1); opacity: 0; }
  6%   { opacity: .9; }
  44%  { transform: translate3d(0, 0, 0) scaleX(1); opacity: .9; }
  50%, 100% { transform: translate3d(4px, 0, 0) scaleX(.4); opacity: 0; }
}
@keyframes nf-thud {
  0%, 58%, 100% { opacity: 0; transform: scale(.6); }
  62%  { opacity: 1; transform: scale(1); }
  80%  { opacity: 0; transform: scale(1.5); }
}
.nf-ball   { animation: nf-roll 6.5s cubic-bezier(.22,.7,.3,1) .4s infinite both; }
.nf-shadow { animation: nf-shadow 6.5s cubic-bezier(.22,.7,.3,1) .4s infinite both; }
.nf-thud   { animation: nf-thud 6.5s ease-out .4s infinite both; }
@media (prefers-reduced-motion: reduce) {
  .nf-ball, .nf-shadow, .nf-thud { animation: none !important; }
  .nf-ball   { transform: translate3d(-14px, 2px, 0); }
  .nf-shadow { transform: translate3d(-14px, 0, 0); opacity: .9; }
  .nf-thud   { opacity: 0; }
}
`;

export default function NotFound() {
  return (
    <FeltStage contentClassName="text-center">
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />

      {/* Giant hollow 404 behind everything */}
      <span
        aria-hidden
        className="pm-outline pointer-events-none absolute left-1/2 top-[calc(5rem+env(safe-area-inset-top)+8rem)] -z-[1] -translate-x-1/2 select-none font-[family-name:var(--font-display)] text-[clamp(10rem,38vw,26rem)] leading-none opacity-[0.12] [-webkit-text-stroke-width:1px] sm:top-[calc(5rem+env(safe-area-inset-top)+6rem)]"
      >
        404
      </span>

      <p className="fade-in-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)] backdrop-blur-sm sm:text-[11px]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-pop-bright)] shadow-[0_0_10px_2px_rgba(232,82,72,0.7)]" />
        Foul · 404
      </p>

      <h1
        className="fade-in-up mt-5 font-[family-name:var(--font-display)] text-[clamp(5.5rem,20vw,11rem)] leading-[0.82] tracking-[0.01em] drop-shadow-[0_10px_40px_rgba(0,0,0,0.55)]"
        style={{ animationDelay: "80ms" }}
      >
        <span className="pm-foil">Scratch</span>
        <span className="ml-[0.04em] inline-block h-[0.13em] w-[0.13em] rounded-full bg-[radial-gradient(circle_at_35%_30%,#ff8a7f,var(--color-pop)_60%,#6e1612)] align-baseline shadow-[0_0_24px_rgba(232,82,72,0.55)]" />
      </h1>

      <PocketScene />

      <p
        className="fade-in-up mx-auto mt-2 max-w-md text-base leading-relaxed text-[var(--color-cream)]/75 sm:text-lg"
        style={{ animationDelay: "180ms" }}
      >
        That page is in the pocket — but not the one you wanted. Let&apos;s rack
        &apos;em up again.
      </p>

      <div
        className="fade-in-up mt-8 flex flex-col items-center gap-5"
        style={{ animationDelay: "260ms" }}
      >
        <Link href="/" className="pm-btn group">
          Back to the table
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm text-[var(--color-cream)]/55">
          <span className="pm-serif mr-1 text-lg text-[var(--color-brass-bright)]">Ball in hand —</span>
          {[
            ["/schedule", "Schedule"],
            ["/roster", "Roster"],
            ["/leaderboard", "Patch Watch"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-full border border-[var(--color-brass)]/30 bg-black/30 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-[var(--color-cream)]/80 transition-colors hover:border-[var(--color-brass)]/60 hover:bg-[var(--color-brass)]/10 hover:text-[var(--color-brass-bright)]"
            >
              {label}
            </Link>
          ))}
        </p>
      </div>
    </FeltStage>
  );
}

/** A corner pocket in the felt, with the cue ball rolling in. */
function PocketScene() {
  return (
    <div
      aria-hidden
      className="fade-in-up relative mx-auto -mt-2 h-[132px] w-full max-w-[560px] sm:mt-0"
      style={{ animationDelay: "120ms" }}
    >
      {/* chalk line the ball travels along */}
      <div className="absolute bottom-[48px] left-[6%] right-1/2 h-px bg-gradient-to-r from-transparent to-[var(--color-cream)]/15" />

      {/* Pocket: leather jaws with a brass rim, then the hole */}
      <div className="absolute bottom-[14px] left-1/2 h-[58px] w-[150px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(60%_70%_at_50%_40%,#3a2616,#1a0f08_70%)] shadow-[0_0_0_2px_rgba(201,162,74,0.45),0_0_0_7px_rgba(20,10,4,0.55),0_18px_30px_-6px_rgba(0,0,0,0.8),inset_0_2px_0_rgba(255,220,170,0.18)]" />
      <div className="absolute bottom-[22px] left-1/2 h-[40px] w-[118px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(70%_80%_at_50%_70%,#000,#050505_55%,#1b120b)] shadow-[inset_0_8px_14px_rgba(0,0,0,0.95)]" />
      {/* thud ring when the ball drops */}
      <div className="nf-thud absolute bottom-[18px] left-1/2 -ml-[75px] h-[48px] w-[150px] rounded-[50%] border border-[var(--color-brass-bright)]/50" />

      {/* Ball shadow on the felt */}
      <div className="absolute bottom-[38px] left-1/2 -ml-[30px] h-[60px] w-[60px]">
        <div className="nf-shadow absolute inset-x-1 bottom-0 h-3 rounded-[50%] bg-black/70 blur-[3px]" />
      </div>

      {/* Ball, clipped at the pocket mid-line so the near lip hides it */}
      <div className="absolute inset-x-0 bottom-[42px] top-0 overflow-hidden">
        <div className="nf-ball absolute bottom-0 left-1/2 -ml-[29px]">
          <div className="drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]">
            <CueBall size={58} />
          </div>
        </div>
      </div>
    </div>
  );
}
