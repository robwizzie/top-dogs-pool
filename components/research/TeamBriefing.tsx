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
    <div className="space-y-6">
      {/* ---- Hero ---- */}
      <section className="surface relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--color-felt)] via-[var(--color-brass)] to-[var(--color-pop)]" />
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              Next match · {countdown}
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-wide sm:text-4xl">
              vs{" "}
              {oppTeam ? (
                <Link
                  href={`/opponents/${oppTeam.id}`}
                  className="text-[var(--color-brass-bright)] hover:underline"
                >
                  {briefing.opponentName}
                </Link>
              ) : (
                <span className="text-[var(--color-brass-bright)]">
                  {briefing.opponentName}
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-[var(--fg-dim)]">
              {formatDate(briefing.match.date)} ·{" "}
              {formatTime(briefing.match.date)}
              {briefing.match.location && ` · ${briefing.match.location}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/matches/${briefing.match.id}`}
              className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-brass)]"
            >
              Match details →
            </Link>
            {editable && (
              <button
                type="button"
                onClick={copyShareLink}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  shareCopied
                    ? "bg-[var(--color-felt-bright)] text-[var(--color-ink)]"
                    : "bg-[var(--color-brass)] text-[var(--color-ink)] hover:bg-[var(--color-brass-bright)]",
                )}
              >
                {shareCopied ? "✓ Link copied!" : "Share with team"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ---- Roster check ---- */}
      <RosterCheck
        roster={inputs.roster}
        available={availableIds}
        onChange={editable ? setAvailableIds : null}
      />

      {/* ---- TL;DR ---- */}
      {insights.tldr.length > 0 && (
        <section className="surface p-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Tonight&apos;s Read · TL;DR
          </h3>
          <ul className="space-y-2">
            {insights.tldr.map((t, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="text-lg leading-snug">{t.emoji}</span>
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Lineup section ---- */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Suggested lineup · {availableRoster.length} player
            {availableRoster.length === 1 ? "" : "s"} available
          </h3>
          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setScenario("we-first")}
              className={cn(
                "rounded-full px-3 py-1 font-semibold uppercase tracking-[0.2em]",
                scenario === "we-first"
                  ? "bg-[var(--color-brass)] text-[var(--color-ink)]"
                  : "text-[var(--fg-dim)] hover:text-[var(--fg)]",
              )}
            >
              We put up M1
            </button>
            <button
              type="button"
              onClick={() => setScenario("they-first")}
              className={cn(
                "rounded-full px-3 py-1 font-semibold uppercase tracking-[0.2em]",
                scenario === "they-first"
                  ? "bg-[var(--color-brass)] text-[var(--color-ink)]"
                  : "text-[var(--fg-dim)] hover:text-[var(--fg)]",
              )}
            >
              They put up M1
            </button>
          </div>
        </div>
        {lineup ? (
          <LineupCard lineup={lineup} oppName={briefing.opponentName} />
        ) : availableRoster.length < 5 ? (
          <p className="surface p-6 text-sm text-[var(--fg-dim)]">
            Need at least 5 players available to suggest a lineup. Toggle
            chips above to mark who&apos;s in.
          </p>
        ) : (
          <p className="surface p-6 text-sm text-[var(--fg-dim)]">
            Not enough opponent roster data yet — run a fresh sync.
          </p>
        )}
      </section>

      {/* ---- Top threats ---- */}
      {insights.topThreats.length > 0 && (
        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Top threats
          </h3>
          <ul className="grid gap-3 sm:grid-cols-3">
            {insights.topThreats.map((t) => (
              <li key={t.name} className="surface p-4">
                <div className="flex items-baseline justify-between gap-2">
                  {t.playerId ? (
                    <Link
                      href={`/players/${t.playerId}`}
                      className="font-[family-name:var(--font-display)] text-lg tracking-wide hover:text-[var(--color-brass)]"
                    >
                      {t.name}
                    </Link>
                  ) : (
                    <span className="font-[family-name:var(--font-display)] text-lg tracking-wide">
                      {t.name}
                    </span>
                  )}
                  {t.sl != null && (
                    <span className="text-xs text-[var(--fg-dim)]">
                      SL{t.sl}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {t.trend === "hot" && (
                    <span className="rounded-full bg-[var(--color-pop)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-pop-bright)]">
                      🔥 Hot
                    </span>
                  )}
                  {t.trend === "cold" && (
                    <span className="rounded-full bg-[var(--color-felt)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-felt-bright)]">
                      ❄️ Cold
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--fg-dim)]">
                    {t.summary}
                  </span>
                </div>
                {t.counter && (
                  <p className="mt-2 text-xs text-[var(--fg-dim)]">
                    🎯 Best counter:{" "}
                    <Link
                      href={`/roster/${t.counter.id}`}
                      className="font-semibold text-[var(--color-felt-bright)] hover:underline"
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
      <section className="grid gap-3 sm:grid-cols-3">
        {scouting && (
          <Stat
            label="Our record vs them"
            value={`${scouting.vsUs.wins}–${scouting.vsUs.losses}${scouting.vsUs.ties ? `–${scouting.vsUs.ties}` : ""}`}
            sub={`${scouting.vsUs.winPct}% across all sessions`}
            tone={
              scouting.vsUs.winPct >= 60
                ? "text-[var(--color-felt-bright)]"
                : scouting.vsUs.winPct <= 40
                  ? "text-[var(--color-pop-bright)]"
                  : undefined
            }
          />
        )}
        {scouting && (
          <Stat
            label="Individual matches vs them"
            value={`${scouting.individualWinPctVsUs}%`}
            sub="our players' win % against theirs"
          />
        )}
        {oppTeam && (
          <Stat
            label={`${oppTeam.name} this session`}
            value={`${oppTeam.record.wins}–${oppTeam.record.losses}${oppTeam.record.ties ? `–${oppTeam.record.ties}` : ""}`}
            sub={
              oppTeam.record.rank
                ? `#${oppTeam.record.rank} in division${oppTeam.record.points ? ` · ${oppTeam.record.points} pts` : ""}`
                : "their record"
            }
          />
        )}
      </section>
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
    <section className="surface p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          {editable ? "Who's playing tonight?" : "Lineup tonight"}
        </h3>
        {editable && (
          <div className="flex gap-3 text-[10px] uppercase tracking-[0.2em]">
            <button
              type="button"
              onClick={() => onChange!(new Set(roster.map((p) => p.id)))}
              className="text-[var(--color-brass)] hover:underline"
            >
              All in
            </button>
            <button
              type="button"
              onClick={() => onChange!(new Set())}
              className="text-[var(--fg-dim)] hover:text-[var(--fg)]"
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
                "inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors",
                on
                  ? "border-[var(--color-brass)] bg-[var(--color-brass)]/15 text-[var(--fg)]"
                  : "border-[var(--border)] bg-[var(--bg-soft)]/30 text-[var(--fg-dim)] hover:border-[var(--border)] hover:text-[var(--fg)]",
              )}
            >
              <span>{p.name}</span>
              {p.skillLevel != null && (
                <span className="text-[10px] text-[var(--fg-dim)]">
                  SL{p.skillLevel}
                </span>
              )}
            </Tag>
          );
        })}
      </div>
      {editable && (
        <p className="mt-3 text-[10px] text-[var(--fg-dim)]">
          Tap to toggle. The suggested lineup recomputes from these picks.
        </p>
      )}
    </section>
  );
}

function LineupCard({
  lineup,
  oppName,
}: {
  lineup: PredictedLineup;
  oppName: string;
}) {
  const wonProb = lineup.nightWinProbability;
  const tone =
    wonProb >= 60
      ? "text-[var(--color-felt-bright)]"
      : wonProb >= 40
        ? "text-[var(--color-brass-bright)]"
        : "text-[var(--color-pop-bright)]";
  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] bg-[var(--bg-soft)]/60 px-5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
            Predicted score
          </p>
          <p className="text-base tabular-nums">
            <span className="font-bold text-[var(--color-felt-bright)]">
              {lineup.ourPoints}
            </span>
            <span className="mx-1 text-[var(--fg-dim)]">–</span>
            <span className="font-bold text-[var(--color-pop-bright)]">
              {lineup.theirPoints}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
            Win probability
          </p>
          <p
            className={cn(
              "font-[family-name:var(--font-display)] text-3xl tabular-nums",
              tone,
            )}
          >
            {wonProb}%
          </p>
        </div>
      </div>
      <ol className="divide-y divide-[var(--border)]">
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
  const tone = our
    ? our.expectedWinProb >= 60
      ? "text-[var(--color-felt-bright)]"
      : our.expectedWinProb >= 40
        ? "text-[var(--color-brass-bright)]"
        : "text-[var(--color-pop-bright)]"
    : "text-[var(--fg-dim)]";
  const topOpp = slot.opponentLikelihoods[0];
  return (
    <li className="grid gap-3 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <div className="flex items-baseline gap-2 sm:flex-col sm:items-start sm:gap-0">
        <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-brass-bright)]">
          M{slot.position}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          {slot.weThrowFirst ? "we put up" : "they put up"}
        </span>
      </div>
      <div className="min-w-0">
        {our ? (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <Link
                href={`/roster/${our.playerId}`}
                className="font-[family-name:var(--font-display)] text-lg tracking-wide hover:text-[var(--color-brass)]"
              >
                {our.playerName}
              </Link>
              {our.skillLevel != null && (
                <span className="text-[10px] text-[var(--fg-dim)]">
                  SL{our.skillLevel}
                </span>
              )}
              <span className="text-[10px] text-[var(--fg-dim)]">vs</span>
              {topOpp ? (
                <span className="text-sm text-[var(--fg)]">
                  {topOpp.name}
                  {topOpp.sl != null && (
                    <span className="ml-1 text-[10px] text-[var(--fg-dim)]">
                      SL{topOpp.sl}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-sm text-[var(--fg-dim)]">{oppName}</span>
              )}
            </div>
            {slot.opponentLikelihoods.length > 1 && (
              <p className="mt-1 text-[10px] text-[var(--fg-dim)]">
                Other likely:{" "}
                {slot.opponentLikelihoods
                  .slice(1, 3)
                  .map((l) => `${l.name} (${(l.probability * 100).toFixed(0)}%)`)
                  .join(" · ")}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--fg-dim)]">
            {slot.blocked
              ? "No feasible pick — 23-rule budget locked."
              : "—"}
          </p>
        )}
      </div>
      <div className={cn("text-right text-2xl font-bold tabular-nums", tone)}>
        {our ? `${our.expectedWinProb}%` : "—"}
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide tabular-nums",
          tone ?? "text-[var(--color-cream)]",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-[var(--fg-dim)]">{sub}</p>}
    </div>
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
