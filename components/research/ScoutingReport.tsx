"use client";

import Link from "next/link";
import type { OpponentScoutingReport, PredictedLineup } from "@/lib/research";
import type { OpponentTeamProfile } from "@/lib/apa/schemas";
import { cn, formatDate } from "@/lib/utils";

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
}: {
  report: OpponentScoutingReport;
  /** When provided, the team header links to /opponents/[teamId]. */
  teamId?: number | null;
  /** Full scraped opp team profile — when present we surface their own
   *  record (separate from "vs us") and other team-level data. */
  oppTeamProfile?: OpponentTeamProfile | null;
  /** Predicted lineup if WE throw first in match 1. */
  predictedWeFirst?: PredictedLineup | null;
  /** Predicted lineup if THEY throw first in match 1. */
  predictedTheyFirst?: PredictedLineup | null;
}) {
  if (report.players.length === 0 && report.vsUs.wins + report.vsUs.losses === 0) {
    return (
      <p className="surface p-6 text-sm text-[var(--fg-dim)]">
        No prior history against {report.team} — this is uncharted territory.
      </p>
    );
  }
  const teamRecord = `${report.vsUs.wins}–${report.vsUs.losses}`;
  const teamRecordTone =
    report.vsUs.winPct >= 60
      ? "text-[var(--color-felt-bright)]"
      : report.vsUs.winPct <= 40
        ? "text-[var(--color-pop-bright)]"
        : "text-[var(--color-brass-bright)]";

  return (
    <div className="space-y-5">
      {/* Top-level team record */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {oppTeamProfile && (
          <Stat
            label={`${oppTeamProfile.name} this session`}
            value={`${oppTeamProfile.record.wins}–${oppTeamProfile.record.losses}`}
            sub={
              oppTeamProfile.record.rank
                ? `#${oppTeamProfile.record.rank} in division`
                : "their team record"
            }
          />
        )}
        <Stat
          label="Our record vs them"
          value={teamRecord}
          sub={`${report.vsUs.winPct}% across all sessions`}
          tone={teamRecordTone}
        />
        {report.vsUsThisSession && (
          <Stat
            label="Our vs them — this session"
            value={`${report.vsUsThisSession.wins}–${report.vsUsThisSession.losses}`}
            sub={`${report.vsUsThisSession.winPct}% so far`}
          />
        )}
        <Stat
          label="Individual matches vs them"
          value={`${report.individualWinPctVsUs}%`}
          sub="our players' win % against theirs"
        />
      </div>

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

      {/* Predicted lineups — both throw orders */}
      {(predictedWeFirst || predictedTheyFirst) && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Predicted lineups · {report.team}
          </h3>
          <p className="mb-3 text-xs text-[var(--fg-dim)]">
            Two scenarios depending on who puts up first in match 1. Each
            row predicts the matchup our engine would build slot-by-slot
            assuming optimal play. Predicted points use the same league-
            average sweep/mini/hill distribution as the night-win-prob.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {predictedWeFirst && (
              <PredictedLineupCard lineup={predictedWeFirst} oppName={report.team} />
            )}
            {predictedTheyFirst && (
              <PredictedLineupCard lineup={predictedTheyFirst} oppName={report.team} />
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
 * Single predicted lineup card. Shows 5 slots in order with the matchup
 * (us vs them), who put up first that slot, and the predicted win prob.
 * The header summarizes total predicted points + night win prob.
 */
function PredictedLineupCard({
  lineup,
}: {
  lineup: PredictedLineup;
  oppName: string;
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
      <ol className="mt-3 space-y-2">
        {lineup.slots.map((s) => (
          <PredictedSlotRow key={s.position} slot={s} />
        ))}
      </ol>
    </div>
  );
}

/**
 * One slot in a predicted lineup. Shows the opp likelihood distribution
 * (top 3-4 opp players with their probabilities), our recommended pick,
 * and the expected vs top-likely win probabilities.
 */
function PredictedSlotRow({
  slot,
}: {
  slot: PredictedLineup["slots"][number];
}) {
  const our = slot.ourPick;
  const tone = our
    ? our.expectedWinProb >= 60
      ? "text-[var(--color-felt-bright)]"
      : our.expectedWinProb >= 40
        ? "text-[var(--color-brass-bright)]"
        : "text-[var(--color-pop-bright)]"
    : "text-[var(--fg-dim)]";
  return (
    <li className="rounded-md border border-[var(--border)] bg-[var(--bg-soft)]/30 p-3 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--color-brass-bright)]">
            M{slot.position}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            {slot.weThrowFirst ? "we put up" : "they put up"}
          </span>
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

      {/* Opponent likelihood distribution */}
      {slot.opponentLikelihoods.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            {slot.weThrowFirst
              ? "Their likely counter (top 3)"
              : "Their likely putup (top 3)"}
          </div>
          <ul className="mt-1 space-y-1">
            {slot.opponentLikelihoods.slice(0, 3).map((l) => (
              <li key={l.name} className="flex items-baseline gap-2">
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
              </li>
            ))}
          </ul>
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
