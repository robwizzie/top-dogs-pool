import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, MapPin, Star } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { StatCounter } from "@/components/ui/StatCounter";
import { YouTubeEmbed } from "@/components/clips/YouTubeEmbed";
import { getMatch, getOpponentTeams } from "@/lib/apa";
import { loadSnapshot } from "@/lib/apa/client";
import { getClipsForMatch } from "@/lib/youtube/client";
import { matchMvp, matchRecap } from "@/lib/recap";
import { formatDate, formatTime } from "@/lib/utils";
import type { MatchResult } from "@/lib/apa/schemas";

export const revalidate = 3600;

type Props = {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ team?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { matchId } = await params;
  const match = await getMatch(matchId);
  return { title: match ? `vs ${match.opponent}` : "Match" };
}

export default async function MatchPage({ params, searchParams }: Props) {
  const { matchId } = await params;
  const { team: teamPerspective } = await searchParams;
  const [match, clips, oppTeams, snapshot] = await Promise.all([
    getMatch(matchId),
    getClipsForMatch(matchId),
    getOpponentTeams(),
    loadSnapshot(),
  ]);
  if (!match) notFound();

  // Determine the SUBJECT team for this view. With no ?team= param, we
  // assume our team's perspective (existing behavior). When ?team=X is set
  // and X has an opp profile, we render the page from THEIR perspective
  // — useful when arriving here from /opponents/X (their schedule, their
  // score on the left, their players on the left side of each round).
  let subjectName = "Top Dogs";
  let oppLink: { id: number; name: string } | null = null;
  if (teamPerspective) {
    const subj = oppTeams.find((t) => String(t.id) === teamPerspective);
    if (subj) {
      subjectName = subj.name;
    }
    // Resolve the opposing side of THIS match (the team that isn't subj).
    const oppKey = match.opponent.trim().toLowerCase();
    const opp = oppTeams.find(
      (t) => t.name.trim().toLowerCase() === oppKey,
    );
    if (opp) oppLink = { id: opp.id, name: opp.name };
  } else {
    // Default (our perspective): the "opponent" is the other team.
    const oppKey = match.opponent.trim().toLowerCase();
    const opp = oppTeams.find(
      (t) => t.name.trim().toLowerCase() === oppKey,
    );
    if (opp) oppLink = { id: opp.id, name: opp.name };
  }
  // Resolve opp player ids by name match — used to deep-link each opponent
  // in the round results to their /players/[id] profile when we've scraped
  // them. Built once per page render so per-row lookups are O(1).
  const oppPlayerByName = new Map<string, string>();
  for (const p of Object.values(snapshot.opponentPlayers ?? {})) {
    if (p.name) oppPlayerByName.set(p.name.trim().toLowerCase(), p.id);
  }

  const isWin =
    match.teamScore !== undefined &&
    match.opponentScore !== undefined &&
    match.teamScore > match.opponentScore;
  const isLoss =
    match.teamScore !== undefined &&
    match.opponentScore !== undefined &&
    match.teamScore < match.opponentScore;
  const isTie =
    match.teamScore !== undefined &&
    match.opponentScore !== undefined &&
    match.teamScore === match.opponentScore;
  const eyebrow =
    match.status === "completed"
      ? isTie
        ? "TIE"
        : isWin
          ? "WIN"
          : "LOSS"
      : match.status === "bye"
        ? "BYE"
        : "UPCOMING";

  // Group results by matchPosition (round 1..5). Position is APA's slot order;
  // missing positions cluster into "Other" (rare — typically forfeits).
  const rounds: Array<{ position: number; rows: MatchResult[] }> = [];
  const otherRows: MatchResult[] = [];
  if (match.results.length > 0) {
    const byPos = new Map<number, MatchResult[]>();
    for (const r of match.results) {
      if (typeof r.matchPosition === "number") {
        const list = byPos.get(r.matchPosition) ?? [];
        list.push(r);
        byPos.set(r.matchPosition, list);
      } else {
        otherRows.push(r);
      }
    }
    for (const [position, rows] of [...byPos.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      rounds.push({ position, rows });
    }
  }

  // Per-round running tally of individual matches won (us vs them). Each round
  // contributes 1 win to the team that took the deciding row in that slot.
  // Skips anonymized rows (hidden:* / ebp:*) when figuring round outcome.
  const arc: Array<{ position: number; us: number; them: number }> = [];
  let usWins = 0;
  let themWins = 0;
  for (const round of rounds) {
    const decider = round.rows.find(
      (r) =>
        !r.playerId.startsWith("hidden:") && !r.playerId.startsWith("ebp:"),
    ) ?? round.rows[0];
    if (decider) {
      if (decider.outcome === "W") usWins += 1;
      else themWins += 1;
    }
    arc.push({ position: round.position, us: usWins, them: themWins });
  }

  const recapText =
    match.status === "completed" ? matchRecap(match, subjectName) : null;
  const mvp = match.status === "completed" ? matchMvp(match) : null;

  // ----- Fun stats — work on any match with results -----------------------
  // Counts that drive the highlight strip: sweeps, mini-sweeps, B&Rs, 8oBs,
  // total games played, biggest individual margin, fastest match (lowest
  // total games), etc.
  const named = match.results.filter(
    (r) => !r.playerId.startsWith("hidden:") && !r.playerId.startsWith("ebp:"),
  );
  const ourWinsCount = named.filter((r) => r.outcome === "W").length;
  const ourSweeps = named.filter((r) => r.outcome === "W" && r.sweep).length;
  const ourMinis = named.filter(
    (r) => r.outcome === "W" && !r.sweep && r.miniSweep,
  ).length;
  const oppSweeps = named.filter((r) => r.outcome === "L" && r.sweep).length;
  const oppMinis = named.filter(
    (r) => r.outcome === "L" && !r.sweep && r.miniSweep,
  ).length;
  const breakAndRunCount = named.filter((r) => r.breakAndRun).length;
  const eightOnBreakCount = named.filter((r) => r.eightOnBreak).length;
  // Closest match: smallest |a - b| with both > 0 (skip forfeits / 5-0s
  // when we're hunting for "drama" — we want a hill-hill or near-hill).
  const closestRow = (() => {
    let best: { row: MatchResult; diff: number } | null = null;
    for (const r of named) {
      if (!r.score) continue;
      const m = r.score.match(/(\d+)-(\d+)/);
      if (!m) continue;
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (a === 0 || b === 0) continue;
      const diff = Math.abs(a - b);
      if (!best || diff < best.diff) best = { row: r, diff };
    }
    return best?.row ?? null;
  })();
  // Biggest individual blowout — largest game differential when one side
  // wins decisively.
  const blowoutRow = (() => {
    let best: { row: MatchResult; diff: number } | null = null;
    for (const r of named) {
      if (!r.score) continue;
      const m = r.score.match(/(\d+)-(\d+)/);
      if (!m) continue;
      const diff = Math.abs(parseInt(m[1], 10) - parseInt(m[2], 10));
      if (!best || diff > best.diff) best = { row: r, diff };
    }
    return best?.row ?? null;
  })();

  return (
    <>
      <PageHeader
        eyebrow={
          eyebrow +
          (match.sweep ? " · TEAM SWEEP" : "") +
          (match.sessionName ? ` · ${match.sessionName.toUpperCase()}` : "")
        }
        title={
          <span>
            <span className="mr-1 text-[var(--fg)]">{subjectName}</span>
            <span className="mx-1 text-[var(--fg-dim)]">vs</span>{" "}
            {oppLink ? (
              <Link
                href={`/opponents/${oppLink.id}`}
                className="text-[var(--color-brass-bright)] hover:underline"
              >
                {match.opponent}
              </Link>
            ) : (
              <span className="text-[var(--color-brass-bright)]">
                {match.opponent}
              </span>
            )}
          </span>
        }
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--fg-dim)]">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} />
              {formatDate(match.date)} · {formatTime(match.date)}
            </span>
            {match.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} />
                {match.location}
              </span>
            )}
            {match.week !== undefined && <span>Week {match.week}</span>}
          </span>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/schedule"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--fg-dim)] hover:text-[var(--color-brass)]"
        >
          <ArrowLeft size={14} /> Back to schedule
        </Link>

        {/* Upcoming card — when the match hasn't been played yet */}
        {match.status === "upcoming" && (
          <section className="surface mb-8 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              Upcoming match
            </p>
            <p className="mt-2 text-2xl">
              {subjectName} vs{" "}
              <span className="text-[var(--color-brass-bright)]">
                {match.opponent}
              </span>
            </p>
            <p className="mt-1 text-sm text-[var(--fg-dim)]">
              {formatDate(match.date)} · {formatTime(match.date)}
              {match.location && ` · ${match.location}`}
            </p>
            {oppLink && (
              <p className="mt-3 text-xs">
                <Link
                  href={`/opponents/${oppLink.id}`}
                  className="font-semibold text-[var(--color-brass)] hover:underline"
                >
                  Scout {oppLink.name} →
                </Link>
              </p>
            )}
          </section>
        )}

        {/* Score + recap + MVP combined hero card */}
        {match.teamScore !== undefined && match.opponentScore !== undefined && (
          <section className="surface mb-8 overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[auto_1fr]">
              <div className="flex items-center justify-around gap-6 border-b border-[var(--border)] p-8 lg:border-b-0 lg:border-r">
                <ScoreBlock label={subjectName} score={match.teamScore} winner={isWin} tie={isTie} delay={150} />
                <span className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--fg-dim)]">
                  vs
                </span>
                <ScoreBlock
                  label={match.opponent}
                  score={match.opponentScore}
                  winner={isLoss}
                  tie={isTie}
                  delay={300}
                />
              </div>
              <div className="grid gap-0 sm:grid-cols-[1fr_auto]">
                {recapText && (
                  <div className="p-6 lg:p-7">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                      Recap
                    </p>
                    <p className="text-base leading-relaxed">{recapText}</p>
                  </div>
                )}
                {mvp && (
                  <aside className="border-t border-[var(--border)] bg-[var(--bg-soft)] p-6 sm:border-l sm:border-t-0 sm:p-7">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass-bright)]">
                      <Star size={12} fill="currentColor" /> MVP
                    </div>
                    <p className="mt-2 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-cream)]">
                      {mvp.playerName}
                    </p>
                    {mvp.score && (
                      <p className="mt-1 text-sm tabular-nums text-[var(--fg-dim)]">
                        {mvp.score}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {mvp.sweep && <Badge tone="pop" glow>SWEEP</Badge>}
                      {!mvp.sweep && mvp.miniSweep && (
                        <Badge tone="brass" glow>MINI</Badge>
                      )}
                      {mvp.breakAndRun && <Badge tone="felt" glow>B&amp;R</Badge>}
                      {mvp.eightOnBreak && <Badge tone="cream">8oB</Badge>}
                    </div>
                  </aside>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Fun stats — sweep/mini count, B&Rs, 8oBs, closest match,
            biggest blowout. Renders for any completed match with results. */}
        {match.status === "completed" && named.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              By the numbers
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FunStat
                index={0}
                label="Individual matches"
                value={`${ourWinsCount}–${named.length - ourWinsCount}`}
                sub={`${named.length} total · ${subjectName}'s side`}
              />
              <FunStat
                index={1}
                label="Sweeps"
                value={`${ourSweeps} 🧹 / ${oppSweeps}`}
                sub={
                  ourMinis + oppMinis > 0
                    ? `Mini-sweeps: ${ourMinis} ✨ / ${oppMinis}`
                    : "no mini-sweeps"
                }
                tone={
                  ourSweeps > oppSweeps
                    ? "text-[var(--color-felt-bright)]"
                    : ourSweeps < oppSweeps
                      ? "text-[var(--color-pop-bright)]"
                      : undefined
                }
              />
              <FunStat
                index={2}
                label="Special shots"
                value={`${breakAndRunCount + eightOnBreakCount}`}
                sub={
                  breakAndRunCount + eightOnBreakCount === 0
                    ? "no B&Rs / 8-on-break"
                    : `${breakAndRunCount} B&R · ${eightOnBreakCount} 8oB`
                }
                tone={
                  breakAndRunCount + eightOnBreakCount > 0
                    ? "text-[var(--color-brass-bright)]"
                    : undefined
                }
              />
              {closestRow ? (
                <FunStat
                  index={3}
                  label="Closest match"
                  value={closestRow.score ?? "—"}
                  sub={`${closestRow.playerName} vs ${closestRow.opponentName}`}
                />
              ) : blowoutRow ? (
                <FunStat
                  index={3}
                  label="Biggest blowout"
                  value={blowoutRow.score ?? "—"}
                  sub={`${blowoutRow.playerName} vs ${blowoutRow.opponentName}`}
                />
              ) : (
                <FunStat index={3} label="Drama" value="—" sub="all forfeits / no scores" />
              )}
            </div>
          </section>
        )}

        {/* Score arc — per-round running tally of individual wins */}
        {arc.length >= 2 && (
          <section className="mb-10">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              The Arc
            </h2>
            <div className="surface p-5">
              <ScoreArc
                arc={arc}
                opponent={match.opponent}
                subject={subjectName}
              />
            </div>
          </section>
        )}

        {/* Results grouped by round */}
        {rounds.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide">
              Round-by-Round
            </h2>
            <ol className="space-y-4">
              {rounds.map((round, idx) => {
                const beforeUs = idx === 0 ? 0 : arc[idx - 1].us;
                const beforeThem = idx === 0 ? 0 : arc[idx - 1].them;
                const afterUs = arc[idx]?.us ?? 0;
                const afterThem = arc[idx]?.them ?? 0;
                const ourWonRound = afterUs > beforeUs;
                return (
                  <li
                    key={round.position}
                    className="surface fade-in-up overflow-hidden"
                    style={{ animationDelay: `${idx * 90}ms` }}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-soft)] px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-brass-bright)]">
                          R{round.position}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
                          {labelForPosition(round.position)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={
                            ourWonRound
                              ? "font-bold text-[var(--color-felt-bright)]"
                              : "text-[var(--fg-dim)]"
                          }
                        >
                          {beforeUs} → {afterUs}
                        </span>
                        <span className="text-[var(--fg-dim)]">·</span>
                        <span
                          className={
                            !ourWonRound
                              ? "font-bold text-[var(--color-pop-bright)]"
                              : "text-[var(--fg-dim)]"
                          }
                        >
                          {beforeThem} → {afterThem}
                        </span>
                      </div>
                    </div>
                    <ul className="divide-y divide-[var(--border)]">
                      {round.rows.map((r) => (
                        <ResultRow
                          key={`${r.playerId}-${r.opponentName}`}
                          r={r}
                          oppPlayerByName={oppPlayerByName}
                        />
                      ))}
                    </ul>
                  </li>
                );
              })}
              {otherRows.length > 0 && (
                <li className="surface overflow-hidden">
                  <div className="border-b border-[var(--border)] bg-[var(--bg-soft)] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
                    Other
                  </div>
                  <ul className="divide-y divide-[var(--border)]">
                    {otherRows.map((r) => (
                      <ResultRow
                        key={`${r.playerId}-${r.opponentName}`}
                        r={r}
                        oppPlayerByName={oppPlayerByName}
                      />
                    ))}
                  </ul>
                </li>
              )}
            </ol>
          </section>
        )}

        {clips.length > 0 && (
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl tracking-wide">
              Match Clips
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clips.map((c, i) => (
                <YouTubeEmbed key={c.id} clip={c} priority={i === 0} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function FunStat({
  label,
  value,
  sub,
  tone,
  index = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  index?: number;
}) {
  return (
    <div
      className="surface fade-in-up p-4"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        {label}
      </p>
      <p
        className={
          tone
            ? `mt-1 font-[family-name:var(--font-display)] text-2xl tracking-wide tabular-nums ${tone}`
            : "mt-1 font-[family-name:var(--font-display)] text-2xl tracking-wide tabular-nums text-[var(--color-cream)]"
        }
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-[var(--fg-dim)]">{sub}</p>}
    </div>
  );
}

function labelForPosition(position: number): string {
  switch (position) {
    case 1:
      return "Lead";
    case 2:
      return "Second";
    case 3:
      return "Middle";
    case 4:
      return "Fourth";
    case 5:
      return "Anchor";
    default:
      return `Slot ${position}`;
  }
}

function ResultRow({
  r,
  oppPlayerByName,
}: {
  r: MatchResult;
  oppPlayerByName: Map<string, string>;
}) {
  const isAnon =
    r.playerId.startsWith("hidden:") || r.playerId.startsWith("ebp:");
  // Map opp player name → /players/[id] when we've scraped them.
  const oppPlayerId = oppPlayerByName.get(r.opponentName.trim().toLowerCase());
  return (
    <li className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
      <span
        className={
          r.outcome === "W"
            ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-felt-bright)]/20 text-sm font-bold text-[var(--color-felt-bright)]"
            : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-pop)]/20 text-sm font-bold text-[var(--color-pop-bright)]"
        }
      >
        {r.outcome}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {isAnon ? (
            <span className="text-sm font-medium italic text-[var(--fg-dim)]">
              {r.playerName}
            </span>
          ) : (
            <Link
              href={`/roster/${r.playerId}`}
              className="text-sm font-medium hover:text-[var(--color-brass)]"
            >
              {r.playerName}
            </Link>
          )}
          {r.skillLevel !== undefined && <SLBadge level={r.skillLevel} />}
          <span className="text-xs text-[var(--fg-dim)]">vs</span>
          {oppPlayerId ? (
            <Link
              href={`/players/${oppPlayerId}`}
              className="text-sm text-[var(--fg)] hover:text-[var(--color-brass)]"
            >
              {r.opponentName}
            </Link>
          ) : (
            <span className="text-sm text-[var(--fg)]">{r.opponentName}</span>
          )}
          {r.opponentSkillLevel !== undefined && (
            <SLBadge level={r.opponentSkillLevel} dim />
          )}
        </div>
        {(r.sweep ||
          r.miniSweep ||
          r.breakAndRun ||
          r.eightOnBreak ||
          r.forfeited) && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {r.sweep && <Badge tone="pop" glow>SWEEP · 1pt</Badge>}
            {!r.sweep && r.miniSweep && <Badge tone="brass">MINI · 0.5pt</Badge>}
            {r.breakAndRun && <Badge tone="felt" glow>BREAK &amp; RUN · 1pt</Badge>}
            {r.eightOnBreak && <Badge tone="cream">8 ON BREAK · 1pt</Badge>}
            {r.forfeited && <Badge tone="pop">FORFEIT</Badge>}
          </div>
        )}
      </div>

      {r.score && (
        <div className="ml-auto text-right text-sm font-semibold tabular-nums">
          {r.score}
        </div>
      )}
    </li>
  );
}

/** Two-line SVG arc showing cumulative individual wins for us vs them by round. */
function ScoreArc({
  arc,
  opponent,
  subject = "Top Dogs",
}: {
  arc: Array<{ position: number; us: number; them: number }>;
  opponent: string;
  subject?: string;
}) {
  const W = 600;
  const H = 160;
  const padX = 36;
  const padY = 22;
  const maxY = Math.max(
    ...arc.map((a) => Math.max(a.us, a.them)),
    arc.length, // round count is a sane minimum so flat lines still look graphed
  );
  const stepX = arc.length === 1 ? 0 : (W - padX * 2) / arc.length;
  // Include a synthetic 0,0 point so both lines start at the origin.
  const points = [{ position: 0, us: 0, them: 0 }, ...arc];
  const path = (key: "us" | "them") =>
    points
      .map((p, i) => {
        const x = padX + i * stepX;
        const y = H - padY - (p[key] / Math.max(maxY, 1)) * (H - padY * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  const lastUs = arc[arc.length - 1].us;
  const lastThem = arc[arc.length - 1].them;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Round-by-round individual wins: ${subject} ${lastUs}, ${opponent} ${lastThem}`}
      className="w-full"
    >
      {/* Y gridlines */}
      {Array.from({ length: maxY + 1 }, (_, i) => i).map((y) => {
        const yy = H - padY - (y / Math.max(maxY, 1)) * (H - padY * 2);
        return (
          <line
            key={y}
            x1={padX}
            x2={W - padX}
            y1={yy}
            y2={yy}
            stroke="var(--border)"
            strokeDasharray="2 4"
            opacity={0.5}
          />
        );
      })}
      {/* Round labels along x-axis */}
      {arc.map((a, i) => (
        <text
          key={`lbl-${a.position}`}
          x={padX + (i + 1) * stepX}
          y={H - 4}
          fontSize={10}
          fill="var(--fg-dim)"
          textAnchor="middle"
        >
          R{a.position}
        </text>
      ))}
      {/* Lines — animate drawing in on first paint */}
      <path
        d={path("them")}
        fill="none"
        stroke="var(--color-pop-bright)"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
        className="draw-in"
        style={{ ["--draw-len" as string]: `${(arc.length + 1) * stepX * 1.2}` }}
      />
      <path
        d={path("us")}
        fill="none"
        stroke="var(--color-brass-bright)"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="draw-in"
        style={{
          ["--draw-len" as string]: `${(arc.length + 1) * stepX * 1.2}`,
          animationDelay: "0.45s",
        }}
      />
      {/* Endpoint dots + labels */}
      <circle
        cx={padX + arc.length * stepX}
        cy={H - padY - (lastUs / Math.max(maxY, 1)) * (H - padY * 2)}
        r={4}
        fill="var(--color-brass-bright)"
      />
      <circle
        cx={padX + arc.length * stepX}
        cy={H - padY - (lastThem / Math.max(maxY, 1)) * (H - padY * 2)}
        r={3.5}
        fill="var(--color-pop-bright)"
      />
      {/* Legend */}
      <g transform={`translate(${padX}, 12)`}>
        <rect width={10} height={3} y={4} fill="var(--color-brass-bright)" />
        <text x={16} y={9} fontSize={11} fill="var(--fg)">
          {subject}
        </text>
        <rect
          width={10}
          height={3}
          x={subject.length * 6 + 30}
          y={4}
          fill="var(--color-pop-bright)"
        />
        <text
          x={subject.length * 6 + 46}
          y={9}
          fontSize={11}
          fill="var(--fg)"
        >
          {opponent}
        </text>
      </g>
    </svg>
  );
}

function ScoreBlock({
  label,
  score,
  winner,
  tie,
  delay = 0,
}: {
  label: string;
  score: number;
  winner?: boolean;
  tie?: boolean;
  delay?: number;
}) {
  return (
    <div className="text-center">
      <p
        className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${
          winner
            ? "text-[var(--color-brass)]"
            : tie
              ? "text-[var(--color-tie-bright)]"
              : "text-[var(--fg-dim)]"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 font-[family-name:var(--font-display)] text-6xl leading-none tracking-wide tabular-nums ${
          winner
            ? "text-[var(--color-brass-bright)]"
            : tie
              ? "text-[var(--color-tie-bright)]"
              : "text-[var(--fg)]"
        }`}
      >
        <StatCounter value={score} duration={1400} delay={delay} />
      </p>
    </div>
  );
}

function SLBadge({ level, dim = false }: { level: number; dim?: boolean }) {
  return (
    <span
      className={
        dim
          ? "inline-flex items-center rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--fg-dim)]"
          : "inline-flex items-center rounded-full border border-[var(--color-brass)]/40 bg-[var(--bg-soft)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--color-brass-bright)]"
      }
    >
      SL{level}
    </span>
  );
}

function Badge({
  children,
  tone,
  glow = false,
}: {
  children: React.ReactNode;
  tone: "pop" | "brass" | "felt" | "cream";
  glow?: boolean;
}) {
  const cls =
    tone === "pop"
      ? "bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]"
      : tone === "brass"
        ? "bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)]"
        : tone === "felt"
          ? "bg-[var(--color-felt)]/30 text-[var(--color-felt-bright)]"
          : "bg-[var(--color-cream)]/15 text-[var(--color-cream)]";
  const glowCls = glow
    ? tone === "pop"
      ? "glow-pop"
      : tone === "felt"
        ? "glow-felt"
        : tone === "brass"
          ? "glow-brass"
          : ""
    : "";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${cls} ${glowCls}`}
    >
      {children}
    </span>
  );
}
