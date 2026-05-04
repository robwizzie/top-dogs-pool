"use client";

import Link from "next/link";
import type { OpponentScoutingReport } from "@/lib/research";
import { cn } from "@/lib/utils";

/**
 * In-depth scouting report for the opponent we're about to play. Pulled
 * from our own scoresheets — we don't have their matches against other
 * teams, so this is "what we know about them from the times they've
 * played us".
 */
export function ScoutingReport({
  report,
  teamId,
}: {
  report: OpponentScoutingReport;
  /** When provided, the team header links to /opponents/[teamId]. */
  teamId?: number | null;
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
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Team record vs them"
          value={teamRecord}
          sub={`${report.vsUs.winPct}% across all sessions`}
          tone={teamRecordTone}
        />
        {report.vsUsThisSession && (
          <Stat
            label="This session"
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
