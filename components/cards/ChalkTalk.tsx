import { ArrowRight } from "lucide-react";
import type { MatchBreakdown } from "@/lib/recap";

/**
 * "Chalk Talk" — the post-match coach's-corner card. Renders the structured
 * breakdown from `matchBreakdown()` as a chalkboard-themed surface: a
 * headline, two columns of insight chips (did-well / clean-up), a key-moments
 * timeline, and a forward-looking takeaway.
 *
 * Visual goals: feels like a locker-room whiteboard — not another stats
 * table. Dashed border, mono-leaning copy, dotted divider down the middle.
 */
export function ChalkTalk({
  breakdown,
  compact = false,
}: {
  breakdown: MatchBreakdown;
  compact?: boolean;
}) {
  const { headline, outcome, didWell, couldImprove, keyMoments, takeaway } =
    breakdown;

  const outcomeTone =
    outcome === "W"
      ? "text-[var(--color-felt-bright)]"
      : outcome === "L"
        ? "text-[var(--color-pop-bright)]"
        : "text-[var(--color-tie-bright)]";

  return (
    <section className="chalkboard relative overflow-hidden rounded-[var(--radius-card)] border border-dashed border-[var(--color-brass)]/45 bg-gradient-to-br from-[#0c1c14] via-[#0a1810] to-[#0d1f15] p-5 shadow-[inset_0_0_60px_rgba(0,0,0,0.5)] sm:p-7">
      {/* faint chalk dust */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 0.7px, transparent 0.7px)",
          backgroundSize: "6px 6px",
        }}
      />

      {/* header */}
      <header className="relative mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[var(--color-brass)]">
          ◈ Chalk Talk
        </span>
        <span className={`font-[family-name:var(--font-display)] text-2xl tracking-wide ${outcomeTone}`}>
          {headline}
        </span>
        <span className="text-[10px] uppercase tracking-[0.28em] text-[var(--fg-dim)]">
          Coach&apos;s corner · post-match
        </span>
      </header>

      {/* two columns */}
      <div className="relative grid gap-6 lg:grid-cols-2">
        <div className="relative">
          <ColumnHeading
            tone="felt"
            label="What we did well"
            count={didWell.length}
          />
          <ul className="mt-3 space-y-3">
            {didWell.map((ins, i) => (
              <InsightRow key={`w-${i}`} ins={ins} tone="felt" />
            ))}
          </ul>
        </div>

        {/* dotted divider on lg+ */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 hidden -translate-x-1/2 border-l border-dashed border-[var(--border)] lg:block"
        />

        <div className="relative">
          <ColumnHeading
            tone="pop"
            label="What to clean up"
            count={couldImprove.length}
          />
          <ul className="mt-3 space-y-3">
            {couldImprove.map((ins, i) => (
              <InsightRow key={`i-${i}`} ins={ins} tone="pop" />
            ))}
          </ul>
        </div>
      </div>

      {/* key moments + takeaway */}
      {!compact && keyMoments.length > 0 && (
        <div className="relative mt-7 border-t border-dashed border-[var(--border)] pt-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Key moments
          </p>
          <ol className="space-y-2">
            {keyMoments.map((km, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm leading-relaxed text-[var(--fg)]"
              >
                <KeyMomentChip kind={km.kind} round={km.round} />
                <span>{km.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="relative mt-6 flex items-start gap-3 rounded-md border border-[var(--color-brass)]/30 bg-black/25 p-4">
        <ArrowRight
          size={16}
          className="mt-0.5 shrink-0 text-[var(--color-brass-bright)]"
        />
        <p className="text-sm leading-relaxed text-[var(--fg)]">
          <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
            Next up
          </span>
          {takeaway}
        </p>
      </div>
    </section>
  );
}

function ColumnHeading({
  label,
  tone,
  count,
}: {
  label: string;
  tone: "felt" | "pop";
  count: number;
}) {
  const dotCls =
    tone === "felt"
      ? "bg-[var(--color-felt-bright)] shadow-[0_0_10px_var(--color-felt-bright)]"
      : "bg-[var(--color-pop-bright)] shadow-[0_0_10px_var(--color-pop-bright)]";
  const labelCls =
    tone === "felt"
      ? "text-[var(--color-felt-bright)]"
      : "text-[var(--color-pop-bright)]";
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${dotCls}`} />
      <span className={`text-[11px] font-semibold uppercase tracking-[0.32em] ${labelCls}`}>
        {label}
      </span>
      <span className="text-[10px] tabular-nums text-[var(--fg-dim)]">
        ({count})
      </span>
    </div>
  );
}

function InsightRow({
  ins,
  tone,
}: {
  ins: { emoji: string; title: string; detail: string };
  tone: "felt" | "pop";
}) {
  const titleCls =
    tone === "felt"
      ? "text-[var(--color-felt-bright)]"
      : "text-[var(--color-pop-bright)]";
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-black/30 text-base leading-none"
      >
        {ins.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`font-[family-name:var(--font-display)] text-base tracking-wide ${titleCls}`}
        >
          {ins.title}
        </p>
        <p className="mt-0.5 text-[13px] leading-snug text-[var(--fg)]">
          {ins.detail}
        </p>
      </div>
    </li>
  );
}

function KeyMomentChip({
  kind,
  round,
}: {
  kind: "swing" | "highlight" | "stumble";
  round: number;
}) {
  const tone =
    kind === "highlight"
      ? "border-[var(--color-felt-bright)]/50 text-[var(--color-felt-bright)] bg-[var(--color-felt)]/20"
      : kind === "stumble"
        ? "border-[var(--color-pop-bright)]/50 text-[var(--color-pop-bright)] bg-[var(--color-pop)]/15"
        : "border-[var(--color-brass-bright)]/50 text-[var(--color-brass-bright)] bg-[var(--color-brass)]/15";
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-full border px-2 font-[family-name:var(--font-display)] text-xs tracking-wide ${tone}`}
      title={kind}
    >
      R{round}
    </span>
  );
}
