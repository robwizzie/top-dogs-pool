import type { ReactNode } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { PoolBall } from "@/components/brand/PoolBall";
import { FeltStage } from "@/components/ui/FeltStage";

/**
 * Team-password lock screen: a glass card set on lamp-lit felt. Purely
 * presentational — the page owns the server action and passes it in.
 */
export function LockScreen({
  title,
  blurb,
  passwordLabel,
  submitLabel,
  action,
  next,
  error,
}: {
  title: ReactNode;
  blurb: ReactNode;
  passwordLabel: string;
  submitLabel: string;
  action: (formData: FormData) => Promise<void>;
  next: string;
  error?: boolean;
}) {
  return (
    <FeltStage>
      {/* Balls resting on the felt, out of focus, either side of the card. */}
      <div
        className="pointer-events-none absolute bottom-[18%] left-[16%] hidden opacity-60 blur-[1.5px] drop-shadow-[0_30px_30px_rgba(0,0,0,0.7)] md:block"
        aria-hidden
      >
        <PoolBall number={6} size={96} />
      </div>
      <div
        className="pointer-events-none absolute right-[9%] top-[40%] hidden opacity-55 blur-[2.5px] drop-shadow-[0_40px_40px_rgba(0,0,0,0.7)] md:block"
        aria-hidden
      >
        <PoolBall number={8} size={150} />
      </div>

      <div className="fade-in-up relative w-full max-w-md">
        {/* Pool of lamp light the card sits in */}
        <div
          className="absolute -inset-x-16 -inset-y-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(255,226,160,0.14),transparent)] blur-2xl"
          aria-hidden
        />
        <div className="pm-glass relative overflow-hidden p-7 sm:p-9">
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-brass-bright)]/70 to-transparent"
            aria-hidden
          />
          <div className="flex items-center gap-4">
            <span className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--color-brass)]/40 bg-[radial-gradient(circle_at_35%_30%,rgba(224,190,107,0.28),rgba(0,0,0,0.35)_70%)] text-[var(--color-brass-bright)] shadow-[0_0_30px_-6px_rgba(201,162,74,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]">
              <Lock size={20} strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[var(--color-brass)]">
                Top Dawgs only
              </p>
              <h1 className="mt-1.5 font-[family-name:var(--font-display)] text-4xl leading-[0.9] tracking-wide text-[var(--color-cream)] sm:text-[2.75rem]">
                {title}
              </h1>
            </div>
          </div>

          <div className="pm-rule mt-6" aria-hidden />

          <p className="mt-5 text-sm leading-relaxed text-[var(--color-cream)]/65">{blurb}</p>

          <form action={action} className="mt-7 space-y-4">
            <input type="hidden" name="next" value={next} />
            <label className="block text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/55">
              {passwordLabel}
              <input
                name="password"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                aria-invalid={error || undefined}
                className={`mt-2.5 block w-full rounded-2xl border bg-black/35 px-4 py-3.5 font-sans text-base normal-case tracking-normal text-[var(--color-cream)] shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--color-cream)]/25 focus:border-[var(--color-brass)]/70 focus:shadow-[inset_0_2px_8px_rgba(0,0,0,0.45),0_0_0_4px_rgba(201,162,74,0.15)] ${
                  error ? "border-[var(--color-pop)]/60" : "border-white/10"
                }`}
              />
            </label>
            {error && (
              <p className="flex items-center gap-2 rounded-xl border border-[var(--color-pop)]/30 bg-[var(--color-pop)]/10 px-3 py-2 text-xs text-[var(--color-pop-bright)]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-pop-bright)]" aria-hidden />
                That password didn&apos;t match. Try again.
              </p>
            )}
            <button type="submit" className="pm-btn group w-full justify-center">
              {submitLabel}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>
        </div>
      </div>
    </FeltStage>
  );
}
