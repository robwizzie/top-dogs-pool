"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  predictLineup,
  type NextMatchBriefing,
  type OpponentScoutingReport,
  type PredictedLineup,
} from "@/lib/research";
import type { Match, OpponentTeamProfile, Player } from "@/lib/apa/schemas";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { PoolBall } from "@/components/brand/PoolBall";
import { DISPLAY, EYEBROW, StatRail } from "@/components/research/ScoutUI";

/**
 * Inputs needed to recompute the predicted lineup on the client when the
 * captain toggles which players are available tonight.
 */
export type BriefingInputs = {
  matches: Match[];
  /** Full visible roster — we filter by `availableIds` for the lineup. */
  roster: Player[];
  opponentTeam: string;
  opponentRoster: Array<{
    name: string;
    latestSL: number | null;
    preferredPosition?: number | null;
  }>;
  location?: string;
};

/**
 * Read-only/interactive shared briefing surface used both on /research
 * (gated, captain edits availability) and /briefing (public read-only,
 * shareable to the rest of the team).
 *
 * Sections (designed to be glanceable on a phone at the bar):
 *   1. Hero — opponent, date, location, countdown.
 *   2. Tonight's lineup — chips for who's playing (interactive on the
 *      captain's view; read-only on the public share).
 *   3. TL;DR — 3 key takeaways tailored to the available roster.
 *   4. Their probable starting 5 (slot-by-slot).
 *   5. Our recommended 5 (best response given availability).
 *   6. Top threats — 3 opp players to watch with hot/cold flag and counter.
 *   7. Vs-them stats card.
 *   8. Share button (captain view only).
 */
export function TeamBriefing({
  briefing,
  scouting,
  oppTeam,
  inputs,
  initialAvailableIds,
  /** Captain mode: user can toggle availability + see the share button.
   *  Public/shared view: read-only, no toggles. */
  editable,
  /** Callback fired when availability changes — used by parents that want
   *  to keep the URL in sync (so a reload preserves selection). */
  onAvailabilityChange,
}: {
  briefing: NextMatchBriefing;
  scouting: OpponentScoutingReport | null;
  oppTeam: OpponentTeamProfile | null;
  inputs: BriefingInputs;
  initialAvailableIds: string[];
  editable: boolean;
  onAvailabilityChange?: (ids: string[]) => void;
}) {
  const [availableIds, setAvailableIds] = useState<Set<string>>(
    () => new Set(initialAvailableIds),
  );

  useEffect(() => {
    onAvailabilityChange?.([...availableIds].sort());
  }, [availableIds, onAvailabilityChange]);

  // Available roster — drives the lineup picker.
  const availableRoster = useMemo(
    () => inputs.roster.filter((p) => availableIds.has(p.id)),
    [inputs.roster, availableIds],
  );

  // Predicted lineup recomputes when availability changes. We always show
  // the "they throw first" scenario by default for the briefing — most
  // captains want to know "if they put up X, who do we counter with?"
  // Captain can flip it via a toggle.
  const [scenario, setScenario] = useState<"we-first" | "they-first">(
    "they-first",
  );
  const lineup = useMemo<PredictedLineup | null>(() => {
    if (availableRoster.length < 5) return null;
    if (inputs.opponentRoster.length < 5) return null;
    return predictLineup(
      scenario,
      inputs.matches,
      availableRoster,
      inputs.opponentTeam,
      inputs.opponentRoster,
      inputs.location,
    );
  }, [scenario, availableRoster, inputs]);

  // ---- Computed insights for the TL;DR / threats section ----
  const insights = useMemo(
    () => buildInsights(briefing, scouting, lineup, availableRoster),
    [briefing, scouting, lineup, availableRoster],
  );

  // Countdown to match start.
  const matchTime = +new Date(briefing.match.date);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const countdown = formatCountdown(matchTime - now);

  // Share link — captain mode only. Encodes the active availability list
  // into a query param, so the team's view shows the same suggested 5.
  const [shareCopied, setShareCopied] = useState(false);
  function copyShareLink() {
    const url = new URL("/briefing", window.location.origin);
    if (availableIds.size > 0 && availableIds.size < inputs.roster.length) {
      url.searchParams.set(
        "available",
        [...availableIds].sort().join(","),
      );
    }
    navigator.clipboard?.writeText(url.toString()).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ---- Hero — on the rail ---- */}
      <section className="pm-rail fade-in-up mt-2">
        {[12.5, 37.5, 62.5, 87.5].map((x) => (
          <span
            key={x}
            aria-hidden
            className="pm-diamond hidden sm:block"
            style={{ left: `${x}%`, top: 14 }}
          />
        ))}
        <div className="flex flex-col gap-6 px-5 pb-6 pt-8 sm:px-9 sm:pb-8 sm:pt-11 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-brass)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-felt-bright)] shadow-[0_0_10px_2px_rgba(46,139,87,0.8)]" />
              Next match · {countdown}
            </p>
            <p className={`${DISPLAY} mt-3 text-5xl leading-[0.9] text-[var(--color-cream)] sm:text-7xl`}>
              <span className="pm-serif mr-2 text-[0.55em] text-[var(--color-cream)]/50">
                vs
              </span>
              {oppTeam ? (
                <Link
                  href={`/opponents/${oppTeam.id}`}
                  className="text-[var(--color-brass-bright)] transition-colors hover:text-[var(--color-brass)]"
                >
                  {briefing.opponentName}
                </Link>
              ) : (
                <span className="text-[var(--color-brass-bright)]">
                  {briefing.opponentName}
                </span>
              )}
            </p>
            <p className="mt-3 text-sm text-[var(--color-cream)]/60">
              {formatDate(briefing.match.date)} ·{" "}
              {formatTime(briefing.match.date)}
              {briefing.match.location && ` · ${briefing.match.location}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/matches/${briefing.match.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brass)]/40 bg-black/30 px-5 py-3 text-sm font-semibold text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10"
            >
              Match details →
            </Link>
            {editable && (
              <button
                type="button"
                onClick={copyShareLink}
                className={cn(
                  "pm-btn",
                  shareCopied &&
                    "![background:linear-gradient(180deg,#5fc28a,#2e8b57)]",
                )}
              >
                {shareCopied ? "✓ Link copied!" : "Share with team"}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Right rail on desktop (first on phones): who's in + TL;DR */}
        <div className="space-y-6 lg:order-2">
          {/* ---- Roster check ---- */}
          <RosterCheck
            roster={inputs.roster}
            available={availableIds}
            onChange={editable ? setAvailableIds : null}
          />

          {/* ---- TL;DR ---- */}
          {insights.tldr.length > 0 && (
            <section className="pm-glass relative overflow-hidden p-5 sm:p-6">
              <span
                aria-hidden
                className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(224,190,107,0.16),transparent_70%)]"
              />
              <h3 className={cn(EYEBROW, "relative mb-1")}>
                Tonight&apos;s Read · TL;DR
              </h3>
              <ul className="relative divide-y divide-[var(--color-cream)]/[0.07]">
                {insights.tldr.map((t, i) => (
                  <li
                    key={i}
                    className="flex gap-3.5 py-3.5 text-[15px] leading-relaxed text-[var(--color-cream)]/85 last:pb-0"
                  >
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/35 text-base ring-1 ring-inset ring-[var(--color-brass)]/25"
                    >
                      {t.emoji}
                    </span>
                    <span>{t.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ---- Lineup section ---- */}
        <section className="min-w-0 lg:order-1">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={cn(EYEBROW, "mb-1.5")}>
                {availableRoster.length} player
                {availableRoster.length === 1 ? "" : "s"} available
              </p>
              <h3 className={`${DISPLAY} text-3xl leading-none text-[var(--color-cream)] sm:text-4xl`}>
                Suggested lineup
              </h3>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 p-1 text-[10px] backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setScenario("we-first")}
                className={cn(
                  "rounded-full px-3 py-1.5 font-semibold uppercase tracking-[0.2em] transition-colors",
                  scenario === "we-first"
                    ? "bg-gradient-to-b from-[#f0d48a] to-[#c9a24a] text-[var(--color-ink)] shadow-[0_4px_14px_-4px_rgba(201,162,74,0.7)]"
                    : "text-[var(--color-cream)]/55 hover:text-[var(--color-cream)]",
                )}
              >
                We put up M1
              </button>
              <button
                type="button"
                onClick={() => setScenario("they-first")}
                className={cn(
                  "rounded-full px-3 py-1.5 font-semibold uppercase tracking-[0.2em] transition-colors",
                  scenario === "they-first"
                    ? "bg-gradient-to-b from-[#f0d48a] to-[#c9a24a] text-[var(--color-ink)] shadow-[0_4px_14px_-4px_rgba(201,162,74,0.7)]"
                    : "text-[var(--color-cream)]/55 hover:text-[var(--color-cream)]",
                )}
              >
                They put up M1
              </button>
            </div>
          </div>
          {lineup ? (
            <LineupCard lineup={lineup} oppName={briefing.opponentName} />
          ) : availableRoster.length < 5 ? (
            <p className="surface p-6 text-sm text-[var(--color-cream)]/60">
              Need at least 5 players available to suggest a lineup. Toggle
              chips above to mark who&apos;s in.
            </p>
          ) : (
            <p className="surface p-6 text-sm text-[var(--color-cream)]/60">
              Not enough opponent roster data yet — run a fresh sync.
            </p>
          )}
        </section>
      </div>

      {/* ---- Top threats ---- */}
      {insights.topThreats.length > 0 && (
        <section>
          <div className="mb-4 flex items-end gap-4">
            <div>
              <p className={cn(EYEBROW, "mb-1.5")}>Who to watch</p>
              <h3 className={`${DISPLAY} text-3xl leading-none text-[var(--color-cream)] sm:text-4xl`}>
                Top threats
              </h3>
            </div>
            <div className="pm-rule mb-2 hidden flex-1 sm:block" aria-hidden />
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {insights.topThreats.map((t, i) => (
              <li
                key={t.name}
                className="surface surface-hover fade-in-up relative overflow-hidden p-5"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {t.trend === "hot" && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -left-10 -top-14 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(232,82,72,0.16),transparent_70%)]"
                  />
                )}
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold tabular-nums tracking-[0.2em] text-[var(--color-cream)]/35">
                      #{i + 1}
                    </span>
                    {t.playerId ? (
                      <Link
                        href={`/players/${t.playerId}`}
                        className={`${DISPLAY} block truncate text-2xl leading-tight text-[var(--color-cream)] transition-colors hover:text-[var(--color-brass-bright)]`}
                      >
                        {t.name}
                      </Link>
                    ) : (
                      <span className={`${DISPLAY} block truncate text-2xl leading-tight text-[var(--color-cream)]`}>
                        {t.name}
                      </span>
                    )}
                  </div>
                  {t.sl != null && (
                    <span className="flex shrink-0 flex-col items-center gap-0.5">
                      <PoolBall
                        number={t.sl}
                        size={32}
                        className="drop-shadow-[0_6px_8px_rgba(0,0,0,0.55)]"
                      />
                      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/45">
                        SL{t.sl}
                      </span>
                    </span>
                  )}
                </div>
                <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
                  {t.trend === "hot" && (
                    <span className="rounded-full bg-[var(--color-pop)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-pop-bright)] ring-1 ring-inset ring-[var(--color-pop-bright)]/25">
                      🔥 Hot
                    </span>
                  )}
                  {t.trend === "cold" && (
                    <span className="rounded-full bg-[var(--color-felt)]/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-felt-text)] ring-1 ring-inset ring-[var(--color-felt-bright)]/30">
                      ❄️ Cold
                    </span>
                  )}
                  <span className="text-[11px] text-[var(--color-cream)]/55">
                    {t.summary}
                  </span>
                </div>
                {t.counter && (
                  <p className="relative mt-3 border-t border-[var(--color-cream)]/[0.07] pt-3 text-xs text-[var(--color-cream)]/55">
                    🎯 Best counter:{" "}
                    <Link
                      href={`/roster/${t.counter.id}`}
                      className="font-semibold text-[var(--color-felt-text)] hover:underline"
                    >
                      {t.counter.name}
                    </Link>{" "}
                    {t.counter.recordVsThreat &&
                      `(${t.counter.recordVsThreat})`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Stats footer ---- */}
      {(scouting || oppTeam) && (
        <StatRail
          size="md"
          stats={[
            ...(scouting
              ? [
                  {
                    label: "Our record vs them",
                    value: `${scouting.vsUs.wins}–${scouting.vsUs.losses}${scouting.vsUs.ties ? `–${scouting.vsUs.ties}` : ""}`,
                    sub: `${scouting.vsUs.winPct}% across all sessions`,
                    tone:
                      scouting.vsUs.winPct >= 60
                        ? ("win" as const)
                        : scouting.vsUs.winPct <= 40
                          ? ("loss" as const)
                          : undefined,
                  },
                  {
                    label: "Individual matches vs them",
                    value: `${scouting.individualWinPctVsUs}%`,
                    sub: "our players' win % against theirs",
                  },
                ]
              : []),
            ...(oppTeam
              ? [
                  {
                    label: `${oppTeam.name} this session`,
                    value: `${oppTeam.record.wins}–${oppTeam.record.losses}${oppTeam.record.ties ? `–${oppTeam.record.ties}` : ""}`,
                    sub: oppTeam.record.rank
                      ? `#${oppTeam.record.rank} in division${oppTeam.record.points ? ` · ${oppTeam.record.points} pts` : ""}`
                      : "their record",
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}

/* ============================================================ helpers */

function RosterCheck({
  roster,
  available,
  onChange,
}: {
  roster: Player[];
  available: Set<string>;
  onChange: ((next: Set<string>) => void) | null;
}) {
  const editable = !!onChange;
  return (
    <section className="pm-glass p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={EYEBROW}>
          {editable ? "Who's playing tonight?" : "Lineup tonight"}
        </h3>
        {editable && (
          <div className="flex gap-3 text-[10px] font-semibold uppercase tracking-[0.2em]">
            <button
              type="button"
              onClick={() => onChange!(new Set(roster.map((p) => p.id)))}
              className="text-[var(--color-brass)] hover:text-[var(--color-brass-bright)]"
            >
              All in
            </button>
            <button
              type="button"
              onClick={() => onChange!(new Set())}
              className="text-[var(--color-cream)]/50 hover:text-[var(--color-cream)]"
            >
              Clear
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {roster.map((p) => {
          const on = available.has(p.id);
          if (!editable && !on) return null;
          const Tag = editable ? "button" : "span";
          return (
            <Tag
              key={p.id}
              type={editable ? "button" : undefined}
              onClick={
                editable
                  ? () => {
                      const next = new Set(available);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      onChange!(next);
                    }
                  : undefined
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-all",
                on
                  ? "bg-[var(--color-brass)]/[0.14] text-[var(--color-cream)] ring-[var(--color-brass)]/70 shadow-[0_0_18px_-6px_rgba(201,162,74,0.6)]"
                  : "bg-black/25 text-[var(--color-cream)]/45 ring-white/10 hover:text-[var(--color-cream)] hover:ring-white/20",
              )}
            >
              {on && (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-[var(--color-brass-bright)]"
                />
              )}
              <span>{p.name}</span>
              {p.skillLevel != null && (
                <span className="text-[10px] font-semibold tabular-nums text-[var(--color-brass)]/80">
                  SL{p.skillLevel}
                </span>
              )}
            </Tag>
          );
        })}
      </div>
      {editable && (
        <p className="mt-3 text-[11px] text-[var(--color-cream)]/45">
          Tap to toggle. The suggested lineup recomputes from these picks.
        </p>
      )}
    </section>
  );
}

function probTone(p: number): string {
  return p >= 60
    ? "text-[var(--color-felt-text)]"
    : p >= 40
      ? "text-[var(--color-brass-bright)]"
      : "text-[var(--color-pop-bright)]";
}
function probBar(p: number): string {
  return p >= 60
    ? "bg-gradient-to-r from-[var(--color-felt)] to-[var(--color-felt-bright)]"
    : p >= 40
      ? "bg-gradient-to-r from-[var(--color-brass-dim)] to-[var(--color-brass-bright)]"
      : "bg-gradient-to-r from-[var(--color-pop)] to-[var(--color-pop-bright)]";
}

function LineupCard({
  lineup,
  oppName,
}: {
  lineup: PredictedLineup;
  oppName: string;
}) {
  const wonProb = lineup.nightWinProbability;
  return (
    <div className="surface overflow-hidden">
      <div className="relative flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-cream)]/[0.08] bg-black/25 px-5 py-5 sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/50">
            Predicted score
          </p>
          <p className={`${DISPLAY} mt-1 text-4xl leading-none tabular-nums sm:text-5xl`}>
            <span className="text-[var(--color-felt-text)]">{lineup.ourPoints}</span>
            <span className="mx-1.5 text-[var(--color-cream)]/25">–</span>
            <span className="text-[var(--color-pop-bright)]">
              {lineup.theirPoints}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/50">
            Win probability
          </p>
          <p
            className={cn(
              DISPLAY,
              "mt-1 text-5xl leading-none tabular-nums sm:text-6xl",
              wonProb >= 60 ? "pm-foil" : probTone(wonProb),
            )}
          >
            {wonProb}%
          </p>
        </div>
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.04]"
        >
          <span
            className={cn("block h-full", probBar(wonProb))}
            style={{ width: `${Math.max(0, Math.min(100, wonProb))}%` }}
          />
        </span>
      </div>
      <ol className="divide-y divide-[var(--color-cream)]/[0.06]">
        {lineup.slots.map((s) => (
          <SlotRow key={s.position} slot={s} oppName={oppName} />
        ))}
      </ol>
    </div>
  );
}

function SlotRow({
  slot,
  oppName,
}: {
  slot: PredictedLineup["slots"][number];
  oppName: string;
}) {
  const our = slot.ourPick;
  const tone = our ? probTone(our.expectedWinProb) : "text-[var(--color-cream)]/40";
  const topOpp = slot.opponentLikelihoods[0];
  return (
    <li className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition-colors hover:bg-white/[0.02] sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-6">
      <div className="flex flex-col items-start">
        <span className={`${DISPLAY} text-3xl leading-none text-[var(--color-brass-bright)]`}>
          M{slot.position}
        </span>
        <span className="mt-1 text-[8px] font-semibold uppercase leading-tight tracking-[0.18em] text-[var(--color-cream)]/40 sm:text-[9px]">
          {slot.weThrowFirst ? "we put up" : "they put up"}
        </span>
      </div>
      <div className="min-w-0">
        {our ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link
                href={`/roster/${our.playerId}`}
                className={`${DISPLAY} text-xl leading-tight text-[var(--color-cream)] transition-colors hover:text-[var(--color-brass-bright)]`}
              >
                {our.playerName}
              </Link>
              {our.skillLevel != null && (
                <span className="text-[10px] font-semibold text-[var(--color-brass)]/80">
                  SL{our.skillLevel}
                </span>
              )}
              <span className="pm-serif text-sm text-[var(--color-cream)]/40">vs</span>
              {topOpp ? (
                <span className="text-sm text-[var(--color-cream)]/75">
                  {topOpp.name}
                  {topOpp.sl != null && (
                    <span className="ml-1 text-[10px] text-[var(--color-cream)]/45">
                      SL{topOpp.sl}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-sm text-[var(--color-cream)]/50">{oppName}</span>
              )}
            </div>
            {slot.opponentLikelihoods.length > 1 && (
              <p className="mt-1 text-[11px] leading-snug text-[var(--color-cream)]/40">
                Other likely:{" "}
                {slot.opponentLikelihoods
                  .slice(1, 3)
                  .map((l) => `${l.name} (${(l.probability * 100).toFixed(0)}%)`)
                  .join(" · ")}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--color-cream)]/50">
            {slot.blocked
              ? "No feasible pick — 23-rule budget locked."
              : "—"}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className={cn(DISPLAY, "text-3xl leading-none tabular-nums", tone)}>
          {our ? `${our.expectedWinProb}%` : "—"}
        </span>
        {our && (
          <span aria-hidden className="h-1 w-14 overflow-hidden rounded-full bg-white/[0.06]">
            <span
              className={cn("block h-full rounded-full", probBar(our.expectedWinProb))}
              style={{ width: `${Math.max(0, Math.min(100, our.expectedWinProb))}%` }}
            />
          </span>
        )}
      </div>
    </li>
  );
}

/* ============================================================ insights */

function buildInsights(
  briefing: NextMatchBriefing,
  scouting: OpponentScoutingReport | null,
  lineup: PredictedLineup | null,
  availableRoster: Player[],
): {
  tldr: Array<{ emoji: string; text: string }>;
  topThreats: Array<{
    name: string;
    playerId: string | null;
    sl: number | null;
    trend: "hot" | "cold" | "steady";
    summary: string;
    counter: { id: string; name: string; recordVsThreat: string | null } | null;
  }>;
} {
  const tldr: Array<{ emoji: string; text: string }> = [];

  // 1. Headline pick or warning based on lineup win prob.
  if (lineup) {
    const wp = lineup.nightWinProbability;
    if (wp >= 65) {
      tldr.push({
        emoji: "🐕",
        text: `We're projected to win ${wp}% with this lineup. Don't get cute — execute the suggested 5 below.`,
      });
    } else if (wp >= 50) {
      tldr.push({
        emoji: "⚖️",
        text: `Coin-flip night — ${wp}% projected. Every individual match matters; play smart with the 23-rule budget.`,
      });
    } else {
      tldr.push({
        emoji: "🔥",
        text: `Tough night ahead — ${wp}% projected with this 5. Look for counter-picks anytime they put up first.`,
      });
    }
  } else if (availableRoster.length < 5) {
    tldr.push({
      emoji: "⚠️",
      text: `Only ${availableRoster.length} player${availableRoster.length === 1 ? "" : "s"} marked available — we need 5 to field a team. Toggle chips to add more.`,
    });
  }

  // 2. Hot threats.
  const hot = (scouting?.players ?? []).filter((p) => p.trend === "hot");
  if (hot.length > 0) {
    const names = hot.slice(0, 3).map((p) => p.name).join(", ");
    tldr.push({
      emoji: "🔥",
      text: `Hot players to watch: ${names}. Save your stronger picks for these matchups.`,
    });
  }

  // 3. Suspected real-SL alarms (someone playing above their stated SL).
  const underrated = (scouting?.players ?? []).filter(
    (p) =>
      p.suspectedRealSL != null &&
      p.latestSL != null &&
      p.suspectedRealSL > p.latestSL,
  );
  if (underrated.length > 0) {
    const names = underrated
      .slice(0, 2)
      .map((p) => `${p.name} (plays SL${p.suspectedRealSL!}+)`)
      .join(" and ");
    tldr.push({
      emoji: "⚠",
      text: `Watch out for ${names} — game scores suggest they play above their listed SL.`,
    });
  }

  // 4. Their team form (record + streak).
  if (scouting) {
    const sw = scouting.vsUs.wins;
    const sl = scouting.vsUs.losses;
    const total = sw + sl + scouting.vsUs.ties;
    if (total >= 3) {
      if (sw >= sl + 2) {
        tldr.push({
          emoji: "🐾",
          text: `We're ${sw}–${sl} vs ${briefing.opponentName} historically — they own this matchup. Need a smart lineup tonight.`,
        });
      } else if (sl >= sw + 2) {
        tldr.push({
          emoji: "🦴",
          text: `We've owned ${briefing.opponentName} ${sw}–${sl} historically. Stay focused — don't let off the gas.`,
        });
      }
    }
  }

  // 5. Suggested counters that aren't available — flag those.
  const availIds = new Set(availableRoster.map((p) => p.id));
  const missingCounters = briefing.suggestedCounters.filter(
    (c) => !availIds.has(c.counterPlayerId),
  );
  if (missingCounters.length > 0 && availableRoster.length >= 5) {
    const slots = missingCounters.map((c) => `M${c.position}`).join(", ");
    tldr.push({
      emoji: "🚨",
      text: `Our usual best counters at ${slots} aren't on the bar tonight. The lineup below picks the next-best feasible option.`,
    });
  }

  // ---- Top 3 threats ----
  // Combined ranking: hot players first, then by appearances vs us / SL.
  const threatPool = [...(scouting?.players ?? [])];
  threatPool.sort((a, b) => {
    const at = a.trend === "hot" ? 2 : a.trend === "steady" ? 1 : 0;
    const bt = b.trend === "hot" ? 2 : b.trend === "steady" ? 1 : 0;
    if (at !== bt) return bt - at;
    return (b.latestSL ?? 0) - (a.latestSL ?? 0);
  });
  const topThreats = threatPool.slice(0, 3).map((p) => {
    const counter = p.topCounter
      ? availableRoster.find((r) => r.id === p.topCounter!.playerId)
        ? {
            id: p.topCounter.playerId,
            name: p.topCounter.playerName,
            recordVsThreat: `${p.topCounter.wins}–${p.topCounter.losses}`,
          }
        : null
      : null;
    const careerStr = p.career
      ? `${p.career.winPct}% career`
      : `${p.vsUs.wins}–${p.vsUs.losses} vs us`;
    const summary =
      p.preferredPosition != null
        ? `${careerStr} · usually M${p.preferredPosition}`
        : careerStr;
    return {
      name: p.name,
      playerId: p.playerId,
      sl: p.latestSL,
      trend: p.trend,
      summary,
      counter,
    };
  });

  return { tldr, topThreats };
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "match in progress / past";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 2) return `${days} days away`;
  if (days >= 1) return `${days} day, ${hours}h away`;
  if (hours >= 1) return `${hours}h away`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${mins} min away`;
}
