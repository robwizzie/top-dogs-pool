"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  predictLineup,
  type OpponentScoutingReport,
  type PredictedLineup,
} from "@/lib/research";
import type { Match, OpponentTeamProfile, Player } from "@/lib/apa/schemas";
import { cn, formatDate } from "@/lib/utils";

/** Inputs to recompute the lineup when the user overrides slots. */
export type LineupInputs = {
  matches: Match[];
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
 * In-depth scouting report for the opponent we're about to play. Pulled
 * from our own scoresheets — we don't have their matches against other
 * teams, so this is "what we know about them from the times they've
 * played us".
 */
export function ScoutingReport({
  report,
  teamId,
  oppTeamProfile,
  predictedWeFirst,
  predictedTheyFirst,
  lineupInputs,
}: {
  report: OpponentScoutingReport;
  /** When provided, the team header links to /opponents/[teamId]. */
  teamId?: number | null;
  /** Full scraped opp team profile — when present we surface their own
   *  record (separate from "vs us") and other team-level data. */
  oppTeamProfile?: OpponentTeamProfile | null;
  /** Predicted lineup if WE throw first in match 1 (initial server-side). */
  predictedWeFirst?: PredictedLineup | null;
  /** Predicted lineup if THEY throw first in match 1 (initial server-side). */
  predictedTheyFirst?: PredictedLineup | null;
  /** Inputs for re-running predictLineup on the client when the user
   *  overrides slot picks. When null, the cards stay non-interactive. */
  lineupInputs?: LineupInputs | null;
}) {
  if (report.players.length === 0 && report.vsUs.wins + report.vsUs.losses === 0) {
    return (
      <p className="surface p-6 text-sm text-[var(--fg-dim)]">
        No prior history against {report.team} — this is uncharted territory.
      </p>
    );
  }
  const teamRecord = formatRecord(
    report.vsUs.wins,
    report.vsUs.losses,
    report.vsUs.ties,
  );
  const teamPlayed =
    report.vsUs.wins + report.vsUs.losses + report.vsUs.ties;
  const teamRecordTone =
    report.vsUs.winPct >= 60
      ? "text-[var(--color-felt-bright)]"
      : report.vsUs.winPct <= 40
        ? "text-[var(--color-pop-bright)]"
        : "text-[var(--color-brass-bright)]";

  // If our all-time vs-them and this-session vs-them are identical (i.e. we've
  // only ever played them this session), don't render the duplicate "this
  // session" card.
  const sessionMatchesAllTime =
    !!report.vsUsThisSession &&
    report.vsUsThisSession.wins === report.vsUs.wins &&
    report.vsUsThisSession.losses === report.vsUs.losses &&
    report.vsUsThisSession.ties === report.vsUs.ties;

  // Whether we have rich opp team data (full schedule = scraped team page).
  const hasFullTeamData =
    !!oppTeamProfile && oppTeamProfile.schedule.length > 0;

  // Hot/cold splits for the top-level summary. Trend now factors in career
  // win % and per-session form (when scraped), so a player with only 1-2
  // matches vs us can still light up if their league-wide form warrants it.
  const hotPlayers = report.players
    .filter((p) => p.trend === "hot")
    .sort((a, b) => (b.latestSL ?? 0) - (a.latestSL ?? 0));
  const coldPlayers = report.players
    .filter((p) => p.trend === "cold")
    .sort((a, b) => (b.latestSL ?? 0) - (a.latestSL ?? 0));

  return (
    <div className="space-y-5">
      {/* Top-level team record */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {oppTeamProfile ? (
          <Stat
            label={`${oppTeamProfile.name} this session`}
            value={formatRecord(
              oppTeamProfile.record.wins,
              oppTeamProfile.record.losses,
              oppTeamProfile.record.ties ?? 0,
            )}
            sub={
              hasFullTeamData
                ? oppTeamProfile.record.rank
                  ? `#${oppTeamProfile.record.rank} in division${oppTeamProfile.record.points ? ` · ${oppTeamProfile.record.points} pts` : ""}`
                  : `${oppTeamProfile.record.points ?? "—"} pts this session`
                : "from matches vs us — run sync for full record"
            }
            tone={
              hasFullTeamData
                ? oppTeamProfile.record.wins > oppTeamProfile.record.losses
                  ? "text-[var(--color-pop-bright)]"
                  : oppTeamProfile.record.wins < oppTeamProfile.record.losses
                    ? "text-[var(--color-felt-bright)]"
                    : "text-[var(--color-brass-bright)]"
                : undefined
            }
          />
        ) : (
          <Stat
            label={`${report.team} this session`}
            value="—"
            sub="run sync to scrape their full team page"
          />
        )}
        <Stat
          label={
            sessionMatchesAllTime
              ? "Our record vs them — this session"
              : "Our record vs them — all time"
          }
          value={teamRecord}
          sub={
            teamPlayed > 0
              ? `${report.vsUs.winPct}% across ${teamPlayed} match${teamPlayed === 1 ? "" : "es"}${report.vsUs.ties > 0 ? ` (incl. ${report.vsUs.ties} tie${report.vsUs.ties === 1 ? "" : "s"})` : ""}`
              : "no completed matches yet"
          }
          tone={teamRecordTone}
        />
        {report.vsUsThisSession && !sessionMatchesAllTime && (
          <Stat
            label="Our vs them — this session"
            value={formatRecord(
              report.vsUsThisSession.wins,
              report.vsUsThisSession.losses,
              report.vsUsThisSession.ties,
            )}
            sub={`${report.vsUsThisSession.winPct}% so far${report.vsUsThisSession.ties > 0 ? ` (${report.vsUsThisSession.ties} tie${report.vsUsThisSession.ties === 1 ? "" : "s"})` : ""}`}
          />
        )}
        <Stat
          label="Individual matches vs them"
          value={`${report.individualWinPctVsUs}%`}
          sub="our players' win % against theirs"
        />
      </div>

      {/* Hot / cold roster summary — quick read on form before diving into
          per-player cards. */}
      {(hotPlayers.length > 0 || coldPlayers.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          <HotColdBlock
            kind="hot"
            players={hotPlayers}
            label="Avoid — they're rolling"
          />
          <HotColdBlock
            kind="cold"
            players={coldPlayers}
            label="Target — recent slump"
          />
        </div>
      )}

      {/* Player scouting */}
      {report.players.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Player scouting · {report.players.length} known players
            {report.topSL ? ` · top SL${report.topSL}` : ""}
          </h3>
          <ul className="space-y-2">
            {report.players.map((p) => (
              <PlayerScoutingCard key={p.name} p={p} />
            ))}
          </ul>
        </div>
      )}

      {/* Predicted lineups — both throw orders. Tap any slot's opp pick
          to lock in a "what if they put up X here?" scenario; the engine
          re-runs and updates our counter + remaining-slot distributions. */}
      {(predictedWeFirst || predictedTheyFirst) && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Predicted lineups · {report.team}
          </h3>
          <p className="mb-3 text-xs text-[var(--fg-dim)]">
            Two scenarios depending on who puts up first in match 1. Tap any
            opp player to lock them into that slot — our counter and the
            remaining slots&apos; distributions update live.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {predictedWeFirst && (
              <InteractivePredictedLineup
                initial={predictedWeFirst}
                scenario="we-first"
                oppName={report.team}
                lineupInputs={lineupInputs ?? null}
              />
            )}
            {predictedTheyFirst && (
              <InteractivePredictedLineup
                initial={predictedTheyFirst}
                scenario="they-first"
                oppName={report.team}
                lineupInputs={lineupInputs ?? null}
              />
            )}
          </div>
        </div>
      )}

      {teamId && (
        <p className="text-xs">
          <Link
            href={`/opponents/${teamId}`}
            className="font-semibold text-[var(--color-brass)] hover:underline"
          >
            View {report.team}&apos;s full team page →
          </Link>
        </p>
      )}

      <p className="text-xs text-[var(--fg-dim)]">
        Per-player career stats (when shown) come from the league API and
        cover their full record across all teams. Per-match details (sweeps,
        B&amp;Rs) require parsing every scoresheet — currently only available
        for matches against us. Run{" "}
        <code className="rounded bg-[var(--bg-soft)] px-1 py-0.5 text-[var(--fg)]">
          npm run sync
        </code>{" "}
        to refresh opponent data.
      </p>
    </div>
  );
}

function PlayerScoutingCard({
  p,
}: {
  p: OpponentScoutingReport["players"][number];
}) {
  const trendBadge =
    p.trend === "hot" ? (
      <span className="rounded-full bg-[var(--color-pop)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-pop-bright)]">
        🔥 Hot
      </span>
    ) : p.trend === "cold" ? (
      <span className="rounded-full bg-[var(--color-felt)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-felt-bright)]">
        ❄️ Cold
      </span>
    ) : null;
  return (
    <li className="surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          {p.playerId ? (
            <Link
              href={`/players/${p.playerId}`}
              className="font-[family-name:var(--font-display)] text-lg tracking-wide hover:text-[var(--color-brass)]"
            >
              {p.name}
            </Link>
          ) : (
            <span className="font-[family-name:var(--font-display)] text-lg tracking-wide">
              {p.name}
            </span>
          )}
          {p.latestSL != null && (
            <span className="text-xs text-[var(--fg-dim)]">SL{p.latestSL}</span>
          )}
          {trendBadge}
          {p.suspectedRealSL && p.latestSL && p.suspectedRealSL > p.latestSL && (
            <span
              title={`Their average winning margin (${p.avgWinMargin} games) is wider than typical for SL${p.latestSL}.`}
              className="rounded-full bg-[var(--color-brass)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-brass-bright)]"
            >
              ⚠ Plays SL{p.suspectedRealSL}+
            </span>
          )}
        </div>
        <div className="text-xs tabular-nums text-[var(--fg-dim)]">
          <span className="font-semibold text-[var(--color-pop-bright)]">
            {p.vsUs.wins}
          </span>
          <span>–</span>
          <span className="font-semibold text-[var(--color-felt-bright)]">
            {p.vsUs.losses}
          </span>
          <span className="ml-1">({p.vsUs.winPct}% vs us)</span>
        </div>
      </div>

      {/* Career stats — only present when we've scraped opp player profile */}
      {p.career && (
        <p className="mt-2 text-xs text-[var(--fg-dim)]">
          League career:{" "}
          <span className="font-semibold text-[var(--fg)]">
            {p.career.wins}–{p.career.losses} ({p.career.winPct}%)
          </span>{" "}
          across {p.career.matchesPlayed} matches
        </p>
      )}

      {/* SL trajectory across recent sessions — only when scraped */}
      {p.slTrajectory.length > 0 && (
        <div className="mt-2 flex flex-wrap items-baseline gap-2 text-[10px]">
          <span className="uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            SL trajectory
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[...p.slTrajectory].reverse().map((s, i) => (
              <span
                key={i}
                className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[var(--fg-dim)]"
                title={`${s.sessionName}: ${s.matchesPlayed} matches${s.winPct != null ? ` · ${s.winPct}% win rate` : ""}`}
              >
                {s.skillLevel ?? "?"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent form strip */}
      {p.recent.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            Recent vs us
          </span>
          <div className="flex gap-1">
            {p.recent.map((o, i) => (
              <span
                key={i}
                className={cn(
                  "inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-bold",
                  // From their perspective: their W = bad for us = pop tone
                  o === "W"
                    ? "bg-[var(--color-pop)]/30 text-[var(--color-pop-bright)]"
                    : "bg-[var(--color-felt)]/30 text-[var(--color-felt-bright)]",
                )}
              >
                {o}
              </span>
            ))}
          </div>
          {p.preferredPosition && (
            <span className="ml-2 text-[10px] text-[var(--fg-dim)]">
              · usually plays M{p.preferredPosition}
            </span>
          )}
        </div>
      )}

      {/* Top counter */}
      {p.topCounter && (
        <p className="mt-2 text-xs text-[var(--fg-dim)]">
          🎯 Best counter from our roster:{" "}
          <Link
            href={`/roster/${p.topCounter.playerId}`}
            className="font-semibold text-[var(--color-felt-bright)] hover:underline"
          >
            {p.topCounter.playerName}
          </Link>{" "}
          ({p.topCounter.wins}–{p.topCounter.losses})
        </p>
      )}

      {/* Match history dropdown — every individual match between our roster
          and this opp player, newest first. */}
      {p.matchHistory.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] hover:text-[var(--color-brass)]">
            ↳ Match history vs us ({p.matchHistory.length})
          </summary>
          <ul className="mt-2 divide-y divide-[var(--border)] rounded-md border border-[var(--border)] text-xs">
            {p.matchHistory.map((m, i) => (
              <li
                key={`${m.matchId}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
                    {formatDate(m.date)}
                    {m.matchPosition ? ` · M${m.matchPosition}` : ""}
                  </span>
                  <Link
                    href={`/roster/${m.ourPlayerId}`}
                    className="font-medium hover:text-[var(--color-brass)]"
                  >
                    {m.ourPlayerName}
                  </Link>
                  {m.ourSL != null && (
                    <span className="text-[10px] text-[var(--fg-dim)]">
                      SL{m.ourSL}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]",
                      m.outcome === "W"
                        ? "bg-[var(--color-felt)]/20 text-[var(--color-felt-bright)]"
                        : "bg-[var(--color-pop)]/20 text-[var(--color-pop-bright)]",
                    )}
                  >
                    {m.outcome}
                  </span>
                  {m.score && (
                    <Link
                      href={`/matches/${m.matchId}`}
                      className="text-[var(--fg-dim)] hover:text-[var(--color-brass)]"
                    >
                      {m.score}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function formatRecord(wins: number, losses: number, ties: number): string {
  return ties > 0 ? `${wins}–${losses}–${ties}` : `${wins}–${losses}`;
}

function HotColdBlock({
  kind,
  players,
  label,
}: {
  kind: "hot" | "cold";
  players: OpponentScoutingReport["players"];
  label: string;
}) {
  if (players.length === 0) return null;
  const isHot = kind === "hot";
  const accent = isHot
    ? "text-[var(--color-pop-bright)]"
    : "text-[var(--color-felt-bright)]";
  const accentBg = isHot
    ? "bg-[var(--color-pop)]/10 border-[var(--color-pop)]/30"
    : "bg-[var(--color-felt)]/10 border-[var(--color-felt)]/30";
  const heading = isHot ? "🔥 Hot players" : "❄️ Cold players";
  return (
    <div className={cn("surface border-2 p-4", accentBg)}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={cn("text-[11px] font-semibold uppercase tracking-[0.32em]", accent)}>
          {heading}
        </h3>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          {label}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {players.map((p) => {
          // Prefer career stats (much larger sample) when available.
          const summary = p.career
            ? `${p.career.winPct}% career (${p.career.wins}–${p.career.losses})`
            : (() => {
                const wins = p.recent.filter((r) => r === "W").length;
                const losses = p.recent.filter((r) => r === "L").length;
                return `${wins}W / ${losses}L vs us`;
              })();
          return (
            <li
              key={p.name}
              className="flex flex-wrap items-baseline gap-2 text-sm"
            >
              {p.playerId ? (
                <Link
                  href={`/players/${p.playerId}`}
                  className="font-medium hover:text-[var(--color-brass)]"
                >
                  {p.name}
                </Link>
              ) : (
                <span className="font-medium">{p.name}</span>
              )}
              {p.latestSL != null && (
                <span className="text-[10px] text-[var(--fg-dim)]">
                  SL{p.latestSL}
                </span>
              )}
              <span
                className={cn(
                  "ml-auto text-[10px] tabular-nums font-semibold",
                  accent,
                )}
              >
                {summary}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
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
      {sub && (
        <p className="text-[10px] text-[var(--fg-dim)]">{sub}</p>
      )}
    </div>
  );
}

/**
 * Interactive wrapper around PredictedLineupCard. Tracks per-slot opp
 * overrides ("if they put up X at M3"), recomputes the lineup on the
 * client when overrides change, and surfaces a clear-all when any
 * slot is locked. Falls back to the server-rendered initial lineup
 * when lineupInputs aren't passed (e.g., insufficient opp roster).
 */
function InteractivePredictedLineup({
  initial,
  scenario,
  oppName,
  lineupInputs,
}: {
  initial: PredictedLineup;
  scenario: "we-first" | "they-first";
  oppName: string;
  lineupInputs: LineupInputs | null;
}) {
  // position → opp player name
  const [overrides, setOverrides] = useState<Map<number, string>>(new Map());

  const lineup = useMemo<PredictedLineup>(() => {
    if (overrides.size === 0 || !lineupInputs) return initial;
    return predictLineup(
      scenario,
      lineupInputs.matches,
      lineupInputs.roster,
      lineupInputs.opponentTeam,
      lineupInputs.opponentRoster,
      lineupInputs.location,
      new Date(),
      overrides,
    );
  }, [initial, scenario, overrides, lineupInputs]);

  function setOverride(position: number, oppName: string | null) {
    setOverrides((prev) => {
      const next = new Map(prev);
      if (oppName === null) next.delete(position);
      else next.set(position, oppName);
      return next;
    });
  }

  function clearAll() {
    setOverrides(new Map());
  }

  // Roster names available for override picker.
  const rosterNames =
    lineupInputs?.opponentRoster.map((p) => ({
      name: p.name,
      sl: p.latestSL,
    })) ?? [];

  return (
    <PredictedLineupCard
      lineup={lineup}
      oppName={oppName}
      rosterNames={rosterNames}
      overrides={overrides}
      onSetOverride={lineupInputs ? setOverride : null}
      onClearAll={overrides.size > 0 ? clearAll : null}
    />
  );
}

/**
 * Single predicted lineup card. Shows 5 slots in order with the matchup
 * (us vs them), who put up first that slot, and the predicted win prob.
 * The header summarizes total predicted points + night win prob. When
 * onSetOverride is provided each slot's opp pick becomes a dropdown
 * for "what if they put up X here?" scenarios.
 */
function PredictedLineupCard({
  lineup,
  rosterNames,
  overrides,
  onSetOverride,
  onClearAll,
}: {
  lineup: PredictedLineup;
  oppName: string;
  rosterNames: Array<{ name: string; sl: number | null }>;
  overrides: Map<number, string>;
  onSetOverride: ((position: number, name: string | null) => void) | null;
  onClearAll: (() => void) | null;
}) {
  const heading =
    lineup.scenario === "we-first" ? "If WE throw first M1" : "If THEY throw first M1";
  const wonProb = lineup.nightWinProbability;
  const tone =
    wonProb >= 60
      ? "text-[var(--color-felt-bright)]"
      : wonProb >= 40
        ? "text-[var(--color-brass-bright)]"
        : "text-[var(--color-pop-bright)]";
  return (
    <div className="surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
          {heading}
        </h4>
        <span className={cn("font-[family-name:var(--font-display)] text-2xl tabular-nums", tone)}>
          {wonProb}%
        </span>
      </div>
      <p className="text-[10px] text-[var(--fg-dim)]">
        Predicted score:{" "}
        <span className="font-semibold text-[var(--color-felt-bright)] tabular-nums">
          {lineup.ourPoints}
        </span>
        <span> – </span>
        <span className="font-semibold text-[var(--color-pop-bright)] tabular-nums">
          {lineup.theirPoints}
        </span>{" "}
        team match points
      </p>
      {onClearAll && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-[var(--color-brass)]/30 bg-[var(--color-brass)]/10 px-2 py-1">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-brass)]">
            {overrides.size} slot{overrides.size === 1 ? "" : "s"} locked
          </span>
          <button
            type="button"
            onClick={onClearAll}
            className="text-[10px] font-semibold text-[var(--color-brass-bright)] hover:underline"
          >
            ✕ clear all
          </button>
        </div>
      )}
      <ol className="mt-3 space-y-2">
        {lineup.slots.map((s) => (
          <PredictedSlotRow
            key={s.position}
            slot={s}
            rosterNames={rosterNames}
            override={overrides.get(s.position) ?? null}
            onSetOverride={
              onSetOverride
                ? (name) => onSetOverride(s.position, name)
                : null
            }
          />
        ))}
      </ol>
    </div>
  );
}

/**
 * One slot in a predicted lineup. Shows the opp likelihood distribution
 * (top 3-4 opp players with their probabilities), our recommended pick,
 * and the expected vs top-likely win probabilities. When onSetOverride is
 * provided, opp likelihoods become tap-to-lock buttons and a dropdown
 * appears for picking any opp from the full roster.
 */
function PredictedSlotRow({
  slot,
  rosterNames,
  override,
  onSetOverride,
}: {
  slot: PredictedLineup["slots"][number];
  rosterNames: Array<{ name: string; sl: number | null }>;
  override: string | null;
  onSetOverride: ((name: string | null) => void) | null;
}) {
  const our = slot.ourPick;
  const tone = our
    ? our.expectedWinProb >= 60
      ? "text-[var(--color-felt-bright)]"
      : our.expectedWinProb >= 40
        ? "text-[var(--color-brass-bright)]"
        : "text-[var(--color-pop-bright)]"
    : "text-[var(--fg-dim)]";
  const interactive = !!onSetOverride;
  const lockedHere = !!slot.oppLocked;
  return (
    <li
      className={cn(
        "rounded-md border p-3 text-xs",
        lockedHere
          ? "border-[var(--color-brass)]/60 bg-[var(--color-brass)]/10"
          : "border-[var(--border)] bg-[var(--bg-soft)]/30",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--color-brass-bright)]">
            M{slot.position}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            {slot.weThrowFirst ? "we put up" : "they put up"}
          </span>
          {lockedHere && (
            <span className="rounded-full bg-[var(--color-brass)]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-brass-bright)]">
              locked
            </span>
          )}
        </span>
        {our && (
          <span className={cn("font-semibold tabular-nums", tone)}>
            {our.expectedWinProb}%{" "}
            <span className="text-[10px] font-normal text-[var(--fg-dim)]">
              expected
            </span>
          </span>
        )}
      </div>

      {/* Opponent likelihood distribution. In interactive mode, each row is
          a button that locks that opp into this slot. */}
      {(slot.opponentLikelihoods.length > 0 || (interactive && rosterNames.length > 0)) && (
        <div className="mt-2">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
              {lockedHere
                ? "Locked opp at this slot"
                : slot.weThrowFirst
                  ? "Their likely counter (top 3)"
                  : "Their likely putup (top 3)"}
            </div>
            {interactive && lockedHere && (
              <button
                type="button"
                onClick={() => onSetOverride!(null)}
                className="text-[10px] font-semibold text-[var(--color-brass-bright)] hover:underline"
              >
                ✕ unlock
              </button>
            )}
          </div>
          <ul className="mt-1 space-y-1">
            {slot.opponentLikelihoods.slice(0, 3).map((l) => {
              const isLocked = override
                ? l.name.toLowerCase() === override.toLowerCase()
                : false;
              const Row = (
                <>
                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--bg-soft)]">
                    <div
                      className="h-full bg-[var(--color-pop-bright)]"
                      style={{ width: `${Math.round(l.probability * 100)}%` }}
                    />
                  </div>
                  <span className="font-medium">{l.name}</span>
                  {l.sl != null && (
                    <span className="text-[10px] text-[var(--fg-dim)]">
                      SL{l.sl}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] tabular-nums text-[var(--fg-dim)]">
                    {(l.probability * 100).toFixed(0)}%
                    {l.totalAppearances > 0 && (
                      <span className="ml-1 opacity-70">
                        ({l.observedAtThisSlot}/{l.totalAppearances} at M
                        {slot.position})
                      </span>
                    )}
                  </span>
                </>
              );
              return interactive ? (
                <li key={l.name}>
                  <button
                    type="button"
                    onClick={() => onSetOverride!(isLocked ? null : l.name)}
                    className={cn(
                      "flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left transition-colors",
                      isLocked
                        ? "bg-[var(--color-brass)]/15"
                        : "hover:bg-[var(--bg-soft)]/60",
                    )}
                    title={
                      isLocked
                        ? "Tap to unlock"
                        : `Lock ${l.name} at M${slot.position}`
                    }
                  >
                    {Row}
                  </button>
                </li>
              ) : (
                <li key={l.name} className="flex items-baseline gap-2">
                  {Row}
                </li>
              );
            })}
          </ul>
          {/* "Pick any opp" full-roster dropdown when interactive. Lets the
              captain lock players who aren't in the top-3 likelihood list. */}
          {interactive && (
            <div className="mt-2">
              <select
                value={override ?? ""}
                onChange={(e) =>
                  onSetOverride!(e.target.value === "" ? null : e.target.value)
                }
                className="w-full rounded border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-[11px]"
                aria-label={`Override opp at M${slot.position}`}
              >
                <option value="">— Pick any opp at M{slot.position} —</option>
                {rosterNames.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                    {p.sl != null ? ` (SL${p.sl})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Our recommended pick */}
      <div className="mt-2 border-t border-[var(--border)] pt-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          {slot.weThrowFirst ? "Our opener" : "Our counter"}
        </div>
        {our ? (
          <div className="mt-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <Link
                  href={`/roster/${our.playerId}`}
                  className="font-[family-name:var(--font-display)] text-base tracking-wide hover:text-[var(--color-brass)]"
                >
                  {our.playerName}
                </Link>
                {our.skillLevel != null && (
                  <span className="ml-1.5 text-[10px] text-[var(--fg-dim)]">
                    SL{our.skillLevel}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-[var(--fg-dim)]">
                vs top-likely:{" "}
                <span className="font-semibold tabular-nums text-[var(--fg)]">
                  {our.winProbVsTopLikely}%
                </span>
              </span>
            </div>
            <div className="mt-1 text-[10px] text-[var(--fg-dim)]">
              {our.slBudgetUsed}/23 SL used after this slot
            </div>
            {our.reasoning.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {our.reasoning.map((r, i) => (
                  <li key={i} className="flex gap-1.5 text-[10px] leading-snug">
                    <span aria-hidden className="shrink-0 text-[var(--color-brass-bright)]">
                      ▸
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="mt-1 text-[10px] text-[var(--fg-dim)]">
            {slot.blocked
              ? "No feasible pick — 23-rule budget locked or roster exhausted."
              : "—"}
          </p>
        )}
      </div>
    </li>
  );
}
