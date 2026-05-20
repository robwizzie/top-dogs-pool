import { ArrowRight } from "lucide-react";
import type { MatchBreakdown } from "@/lib/recap";

/**
 * "Chalk Talk" — the post-match coach's-corner card. Renders the structured
 * breakdown from `matchBreakdown()` as a chalkboard-themed surface.
 *
 * Layout:
 *  - Big headline row at the top (outcome-tinted) with a small CHALK TALK
 *    chip and a "coach's corner" sublabel for context.
 *  - Two side-by-side stacks below ("did well" / "clean up"). Each item is
 *    its own surface card so the columns don't visually starve when one
 *    side has more entries than the other.
 *  - Key Moments rendered as a horizontal timeline with R# pills.
 *  - Takeaway box across the bottom.
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
  const outcomeAccent =
    outcome === "W"
      ? "var(--color-felt-bright)"
      : outcome === "L"
        ? "var(--color-pop-bright)"
        : "var(--color-tie-bright)";

  return (
    <section
      className="chalkboard relative overflow-hidden rounded-[var(--radius-card)] border border-dashed border-[var(--color-brass)]/45 bg-gradient-to-br from-[#0c1c14] via-[#0a1810] to-[#0d1f15] p-5 sm:p-7"
      style={{
        boxShadow: `inset 0 0 80px rgba(0,0,0,0.55), 0 0 0 1px ${outcomeAccent}10`,
      }}
    >
      {/* faint chalk-dust texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 0.7px, transparent 0.7px)",
          backgroundSize: "6px 6px",
        }}
      />

      {/* Header band */}
      <header className="relative mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-dashed border-[var(--border)] pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.36em] text-[var(--color-brass)]">
            <span aria-hidden>◈</span>
            <span>Chalk Talk</span>
            <span className="text-[var(--fg-dim)]">·</span>
            <span className="text-[var(--fg-dim)]">Coach&apos;s Corner</span>
          </div>
          <h2
            className={`mt-1 font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide sm:text-5xl ${outcomeTone}`}
          >
            {headline}
          </h2>
        </div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--fg-dim)]">
          Post-match breakdown
        </p>
      </header>

      {/* Two stacks: did well / clean up. Each insight is its own card so an
          imbalanced count doesn't leave a dead column. */}
      <div className="relative grid gap-5 md:grid-cols-2">
        <Column
          tone="felt"
          label="What we did well"
          insights={didWell}
        />
        <Column
          tone="pop"
          label="What to clean up"
          insights={couldImprove}
        />
      </div>

      {/* Key moments — horizontal timeline. */}
      {!compact && keyMoments.length > 0 && (
        <div className="relative mt-7">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Key moments
          </p>
          <ol className="relative space-y-2 border-l border-dashed border-[var(--border)] pl-5">
            {keyMoments.map((km, i) => (
              <li
                key={i}
                className="relative flex items-start gap-3 text-sm leading-relaxed text-[var(--fg)]"
              >
                <span
                  aria-hidden
                  className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      km.kind === "highlight"
                        ? "var(--color-felt-bright)"
                        : km.kind === "stumble"
                          ? "var(--color-pop-bright)"
                          : "var(--color-brass-bright)",
                    boxShadow: `0 0 8px ${
                      km.kind === "highlight"
                        ? "var(--color-felt-bright)"
                        : km.kind === "stumble"
                          ? "var(--color-pop-bright)"
                          : "var(--color-brass-bright)"
                    }`,
                  }}
                />
                <KeyMomentChip kind={km.kind} round={km.round} />
                <span className="flex-1">{km.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Takeaway */}
      <div
        className="relative mt-6 flex items-start gap-3 rounded-md border p-4"
        style={{
          borderColor: `${outcomeAccent}55`,
          background: `linear-gradient(135deg, ${outcomeAccent}0c, rgba(0,0,0,0.35))`,
        }}
      >
        <ArrowRight
          size={16}
          className={`mt-0.5 shrink-0 ${outcomeTone}`}
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

function Column({
  label,
  tone,
  insights,
}: {
  label: string;
  tone: "felt" | "pop";
  insights: { emoji: string; title: string; detail: string }[];
}) {
  const dotCls =
    tone === "felt"
      ? "bg-[var(--color-felt-bright)] shadow-[0_0_10px_var(--color-felt-bright)]"
      : "bg-[var(--color-pop-bright)] shadow-[0_0_10px_var(--color-pop-bright)]";
  const labelCls =
    tone === "felt"
      ? "text-[var(--color-felt-bright)]"
      : "text-[var(--color-pop-bright)]";
  const cardBorderCls =
    tone === "felt"
      ? "border-[var(--color-felt-bright)]/25 hover:border-[var(--color-felt-bright)]/50"
      : "border-[var(--color-pop-bright)]/25 hover:border-[var(--color-pop-bright)]/50";
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dotCls}`} />
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.32em] ${labelCls}`}
        >
          {label}
        </span>
      </div>
      <ul className="space-y-2.5">
        {insights.map((ins, i) => (
          <li
            key={i}
            className={`flex items-start gap-3 rounded-md border bg-black/25 p-3 transition-colors ${cardBorderCls}`}
          >
            <span
              aria-hidden
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-black/40 text-base leading-none"
            >
              {ins.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`font-[family-name:var(--font-display)] text-base leading-tight tracking-wide ${labelCls}`}
              >
                {ins.title}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-[var(--fg)]">
                {ins.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
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
      ? "border-[var(--color-felt-bright)]/50 text-[var(--color-felt-bright)] bg-[var(--color-felt)]/25"
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
