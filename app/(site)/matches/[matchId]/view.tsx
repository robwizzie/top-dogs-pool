import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, MapPin, Star } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { StatCounter } from "@/components/ui/StatCounter";
import { YouTubeEmbed } from "@/components/clips/YouTubeEmbed";
import { getMatch, getOpponentTeams } from "@/lib/apa";
import { loadSnapshot } from "@/lib/apa/client";
import { getClipsForMatch } from "@/lib/youtube/client";
import { matchBreakdown, matchMvp, matchRecap } from "@/lib/recap";
import { ChalkTalk } from "@/components/cards/ChalkTalk";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { PointerSheen } from "@/components/home/PointerSheen";
import { Countdown } from "@/components/home/Countdown";
import {
  Chip,
  ChipRow,
  DISPLAY,
  EYEBROW,
  OutcomePill,
  SectionHead,
} from "@/components/research/ScoutUI";
import type { MatchResult } from "@/lib/apa/schemas";



type Props = {
  params: Promise<{ matchId: string }>;
  query: { team?: string };
};

export async function generateMetadata({ params }: Pick<Props, "params">) {
  const { matchId } = await params;
  const match = await getMatch(matchId);
  return { title: match ? `vs ${match.opponent}` : "Match" };
}

export async function MatchView({ params, query }: Props) {
  const { matchId } = await params;
  const { team: teamPerspective } = query;
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
  let subjectName = "Top Dawgs";
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
  const breakdown =
    match.status === "completed" ? matchBreakdown(match, subjectName) : null;

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

  const resultTone: "win" | "loss" | "tie" | undefined = isWin
    ? "win"
    : isLoss
      ? "loss"
      : isTie
        ? "tie"
        : undefined;
  const hasScore =
    match.teamScore !== undefined && match.opponentScore !== undefined;

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
            <span className="text-[var(--color-cream)]">{subjectName}</span>{" "}
            <span className="pm-serif mx-1 align-[0.12em] text-[0.55em] text-[var(--color-cream)]/45">
              vs
            </span>{" "}
            {oppLink ? (
              <Link
                href={`/opponents/${oppLink.id}`}
                className="text-[var(--color-brass-bright)] decoration-[var(--color-brass)]/50 decoration-2 underline-offset-[0.12em] transition-colors hover:text-[var(--color-brass)] hover:underline"
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
      >
        <ChipRow>
          {resultTone && (
            <Chip tone={resultTone} className="font-semibold uppercase tracking-[0.2em]">
              {isWin ? "Win" : isLoss ? "Loss" : "Tie"}
              {hasScore && (
                <span className="tabular-nums">
                  {" "}
                  · {match.teamScore}–{match.opponentScore}
                </span>
              )}
            </Chip>
          )}
          <Chip>
            <Calendar size={13} className="text-[var(--color-brass)]" />
            {formatDate(match.date)} · {formatTime(match.date)}
          </Chip>
          {match.location && (
            <Chip>
              <MapPin size={13} className="text-[var(--color-brass)]" />
              <span className="truncate">{match.location}</span>
            </Chip>
          )}
          {match.week !== undefined && <Chip>Week {match.week}</Chip>}
          <Link
            href="/schedule"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-[var(--color-cream)]/55 transition-colors hover:text-[var(--color-brass-bright)]"
          >
            <ArrowLeft size={13} /> Schedule
          </Link>
        </ChipRow>
      </PageHeader>
      <PointerSheen />

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        {/* Upcoming — when the match hasn't been played yet */}
        {match.status === "upcoming" && (
          <section className="pm-rail fade-in-up mb-12 mt-2 px-5 pb-6 pt-8 sm:px-10 sm:pb-9 sm:pt-11">
            {[25, 50, 75].map((x) => (
              <span
                key={x}
                aria-hidden
                className="pm-diamond hidden sm:block"
                style={{ left: `${x}%`, top: 14 }}
              />
            ))}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className={EYEBROW}>Upcoming match</p>
                <p className={`${DISPLAY} mt-2 text-4xl leading-[0.95] text-[var(--color-cream)] sm:text-5xl`}>
                  {subjectName}{" "}
                  <span className="pm-serif text-[0.6em] text-[var(--color-cream)]/45">vs</span>{" "}
                  <span className="text-[var(--color-brass-bright)]">
                    {match.opponent}
                  </span>
                </p>
                <p className="mt-2 text-sm text-[var(--color-cream)]/55">
                  {formatDate(match.date)} · {formatTime(match.date)}
                  {match.location && ` · ${match.location}`}
                </p>
                {oppLink && (
                  <Link
                    href={`/opponents/${oppLink.id}`}
                    className="pm-btn group mt-6"
                  >
                    Scout {oppLink.name}
                    <ArrowRight
                      size={16}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                )}
              </div>
              <div className="shrink-0">
                <Countdown target={match.date} />
              </div>
            </div>
          </section>
        )}

        {/* Scoreboard — the final, on a walnut rail */}
        {match.teamScore !== undefined && match.opponentScore !== undefined && (
          <section
            className="pm-rail fade-in-up mb-6 mt-2"
            aria-label={`Final score: ${subjectName} ${match.teamScore}, ${match.opponent} ${match.opponentScore}`}
          >
            {[12.5, 37.5, 62.5, 87.5].map((x) => (
              <span
                key={x}
                aria-hidden
                className="pm-diamond"
                style={{ left: `${x}%`, top: 14 }}
              />
            ))}
            {(isWin || isLoss) && (
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-0 h-full w-1/2 bg-[radial-gradient(60%_70%_at_50%_45%,rgba(224,190,107,0.16),transparent_70%)]",
                  isWin ? "left-0" : "right-0",
                )}
              />
            )}
            <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 pb-6 pt-9 sm:gap-6 sm:px-10 sm:pb-8 sm:pt-12">
              <ScoreBlock
                label={subjectName}
                score={match.teamScore}
                winner={isWin}
                tie={isTie}
                delay={150}
              />
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="text-[9px] font-semibold uppercase tracking-[0.34em] text-[var(--color-cream)]/45 sm:text-[10px]">
                  Final
                </span>
                <span
                  className={cn(
                    DISPLAY,
                    "rounded-full px-3 pb-0.5 pt-1 text-lg leading-none ring-1 ring-inset sm:px-5 sm:text-3xl",
                    isWin &&
                      "bg-[var(--color-felt-bright)]/15 text-[var(--color-felt-text)] ring-[var(--color-felt-bright)]/45 shadow-[0_0_30px_-6px_rgba(46,139,87,0.7)]",
                    isLoss &&
                      "bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)] ring-[var(--color-pop-bright)]/40 shadow-[0_0_30px_-6px_rgba(200,54,47,0.6)]",
                    isTie &&
                      "bg-[var(--color-tie)]/15 text-[var(--color-tie-bright)] ring-[var(--color-tie)]/45",
                  )}
                >
                  {isWin ? "Win" : isLoss ? "Loss" : "Tie"}
                </span>
                {match.sweep && (
                  <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--color-brass-bright)] sm:text-[10px]">
                    Team sweep
                  </span>
                )}
              </div>
              <ScoreBlock
                label={match.opponent}
                score={match.opponentScore}
                winner={isLoss}
                tie={isTie}
                delay={300}
                align="right"
              />
            </div>
            {arc.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-[var(--color-cream)]/[0.08] px-4 py-3.5 sm:gap-x-6">
                <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/40">
                  Rounds
                </span>
                <ol className="flex items-center gap-2 sm:gap-3">
                  {arc.map((a, i) => {
                    const prevUs = i === 0 ? 0 : arc[i - 1].us;
                    const ours = a.us > prevUs;
                    return (
                      <li
                        key={a.position}
                        className="flex items-center gap-1.5"
                        title={`R${a.position}: ${ours ? subjectName : match.opponent}`}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "h-3 w-3 rounded-full shadow-[inset_-2px_-2px_3px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.5)]",
                            ours
                              ? "bg-[radial-gradient(circle_at_32%_28%,#9be3b6,#2e8b57_45%,#134d2f)]"
                              : "bg-[radial-gradient(circle_at_32%_28%,#ffb1aa,#e85248_45%,#8f1f1a)]",
                          )}
                        />
                        <span className="text-[10px] font-semibold tabular-nums text-[var(--color-cream)]/55">
                          R{a.position}
                          <span className="sr-only">
                            {ours ? " won" : " lost"}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </section>
        )}

        {/* Recap + MVP */}
        {(recapText || mvp) && (
          <div
            className={cn(
              "mb-14 grid gap-4",
              recapText && mvp && "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]",
            )}
          >
            {recapText && (
              <section className="pm-glass fade-in-up relative overflow-hidden p-6 sm:p-8" style={{ animationDelay: "120ms" }}>
                <span
                  aria-hidden
                  className="pm-serif pointer-events-none absolute right-5 top-1 select-none text-[8rem] leading-[0.8] text-[var(--color-brass)]/[0.14] sm:right-8 sm:text-[11rem]"
                >
                  &rdquo;
                </span>
                <p className={`${EYEBROW} relative`}>The recap</p>
                <p className="relative mt-3 text-lg leading-relaxed text-[var(--color-cream)]/90 sm:text-xl">
                  {recapText}
                </p>
              </section>
            )}
            {mvp && (
              <aside className="pm-glass pm-lift fade-in-up relative overflow-hidden p-6 sm:p-8" style={{ animationDelay: "200ms" }}>
                <span className="pm-sheen" />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(224,190,107,0.22),transparent_70%)]"
                />
                <div className="relative flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-brass-bright)]">
                  <Star size={12} fill="currentColor" /> MVP
                  <span className="pm-serif ml-1 text-sm normal-case tracking-normal text-[var(--color-cream)]/55">
                    player of the night
                  </span>
                </div>
                <p className={`${DISPLAY} relative mt-3 text-4xl leading-[0.95] text-[var(--color-cream)]`}>
                  {mvp.playerName}
                </p>
                {mvp.score && (
                  <p className={`${DISPLAY} relative mt-1 text-2xl tabular-nums text-[var(--color-brass-bright)]`}>
                    {mvp.score}
                  </p>
                )}
                <div className="relative mt-4 flex flex-wrap gap-1.5">
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
        )}

        {/* Fun stats — sweep/mini count, B&Rs, 8oBs, closest match,
            biggest blowout. Renders for any completed match with results. */}
        {match.status === "completed" && named.length > 0 && (
          <section className="mb-14">
            <SectionHead index="01" eyebrow="By the numbers" title="The night in four stats" />
            <div className="surface pm-reveal grid grid-cols-2 overflow-hidden lg:grid-cols-4">
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
                    ? "text-[var(--color-felt-text)]"
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

        {/* Chalk Talk — coach's-corner breakdown of what worked + what
            to clean up. Only renders for completed matches that have a
            scoresheet to mine. */}
        {breakdown && (
          <section
            id="chalk-talk"
            className="pm-reveal relative mb-14 scroll-mt-24 rounded-[calc(var(--radius-card)+6px)] p-1.5 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)] ring-1 ring-[var(--color-brass)]/15"
          >
            <ChalkTalk breakdown={breakdown} />
          </section>
        )}

        {/* Score arc — per-round running tally of individual wins */}
        {arc.length >= 2 && (
          <section className="mb-14">
            <SectionHead index="02" eyebrow="The arc" title="How the night swung" />
            <div className="surface pm-reveal px-3 pb-3 pt-5 sm:px-6 sm:pt-6">
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
          <section className="mb-14">
            <SectionHead index="03" eyebrow="The scoresheet" title="Round by round" />
            <ol className="surface overflow-hidden">
              {rounds.map((round, idx) => {
                const beforeUs = idx === 0 ? 0 : arc[idx - 1].us;
                const beforeThem = idx === 0 ? 0 : arc[idx - 1].them;
                const afterUs = arc[idx]?.us ?? 0;
                const afterThem = arc[idx]?.them ?? 0;
                const ourWonRound = afterUs > beforeUs;
                const tally = (
                  <span className={`${DISPLAY} text-xl leading-none tabular-nums sm:text-2xl`}>
                    <span
                      className={
                        ourWonRound
                          ? "text-[var(--color-felt-text)]"
                          : "text-[var(--color-cream)]/45"
                      }
                    >
                      {afterUs}
                    </span>
                    <span className="mx-0.5 text-[var(--color-cream)]/25">–</span>
                    <span
                      className={
                        !ourWonRound
                          ? "text-[var(--color-pop-bright)]"
                          : "text-[var(--color-cream)]/45"
                      }
                    >
                      {afterThem}
                    </span>
                  </span>
                );
                return (
                  <li
                    key={round.position}
                    className="fade-in-up group relative grid grid-cols-[3.75rem_minmax(0,1fr)] border-b border-[var(--color-cream)]/[0.07] transition-colors last:border-0 hover:bg-white/[0.02] sm:grid-cols-[6.5rem_minmax(0,1fr)_7.5rem]"
                    style={{ animationDelay: `${idx * 90}ms` }}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 w-[3px]",
                        ourWonRound
                          ? "bg-gradient-to-b from-[var(--color-felt-bright)] to-[var(--color-felt-bright)]/30"
                          : "bg-gradient-to-b from-[var(--color-pop-bright)] to-[var(--color-pop)]/30",
                      )}
                    />
                    <div className="flex flex-col items-center justify-center gap-1 border-r border-[var(--color-cream)]/[0.07] py-4">
                      <span className={`${DISPLAY} text-3xl leading-none text-[var(--color-brass-bright)] sm:text-4xl`}>
                        R{round.position}
                      </span>
                      <span className="hidden text-[9px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/45 sm:block">
                        {labelForPosition(round.position)}
                      </span>
                      <span className="sm:hidden" aria-label={`Running tally ${afterUs} to ${afterThem}`}>
                        {tally}
                      </span>
                    </div>
                    <ul className="divide-y divide-[var(--color-cream)]/[0.06]">
                      {round.rows.map((r) => (
                        <ResultRow
                          key={`${r.playerId}-${r.opponentName}`}
                          r={r}
                          oppPlayerByName={oppPlayerByName}
                        />
                      ))}
                    </ul>
                    <div className="hidden flex-col items-end justify-center gap-1 border-l border-[var(--color-cream)]/[0.07] px-5 sm:flex">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/40">
                        Running
                      </span>
                      {tally}
                      <span className="text-[10px] tabular-nums text-[var(--color-cream)]/35">
                        from {beforeUs}–{beforeThem}
                      </span>
                    </div>
                  </li>
                );
              })}
              {otherRows.length > 0 && (
                <li className="grid grid-cols-[3.75rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_minmax(0,1fr)_7.5rem]">
                  <div className="flex items-center justify-center border-r border-[var(--color-cream)]/[0.07] py-4 text-[9px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/45">
                    Other
                  </div>
                  <ul className="divide-y divide-[var(--color-cream)]/[0.06]">
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
            <SectionHead index="04" eyebrow="On tape" title="Match clips" />
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
      className={cn(
        "fade-in-up relative min-w-0 border-[var(--color-cream)]/[0.07] p-5 transition-colors hover:bg-white/[0.02] sm:p-6",
        index % 2 === 1 && "border-l",
        index >= 2 && "border-t lg:border-t-0",
        index === 2 && "lg:border-l",
      )}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[var(--color-cream)]/50">
        {label}
      </p>
      <p
        className={cn(
          DISPLAY,
          "mt-2 text-4xl leading-none tabular-nums sm:text-5xl",
          tone ?? "text-[var(--color-cream)]",
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-2 text-[11px] leading-snug text-[var(--color-cream)]/45">
          {sub}
        </p>
      )}
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
    <li className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6">
      <OutcomePill outcome={r.outcome} className="h-8 w-8 text-lg" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            {isAnon ? (
              <span className="text-[15px] font-medium italic text-[var(--color-cream)]/55">
                {r.playerName}
              </span>
            ) : (
              <Link
                href={`/roster/${r.playerId}`}
                className="text-[15px] font-semibold text-[var(--color-cream)] transition-colors hover:text-[var(--color-brass-bright)]"
              >
                {r.playerName}
              </Link>
            )}
            {r.skillLevel !== undefined && <SLBadge level={r.skillLevel} />}
          </span>
          <span className="pm-serif text-base text-[var(--color-cream)]/45">vs</span>
          <span className="inline-flex items-center gap-1.5">
            {oppPlayerId ? (
              <Link
                href={`/players/${oppPlayerId}`}
                className="text-[15px] text-[var(--color-cream)]/70 transition-colors hover:text-[var(--color-brass-bright)]"
              >
                {r.opponentName}
              </Link>
            ) : (
              <span className="text-[15px] text-[var(--color-cream)]/70">
                {r.opponentName}
              </span>
            )}
            {r.opponentSkillLevel !== undefined && (
              <SLBadge level={r.opponentSkillLevel} dim />
            )}
          </span>
        </div>
        {(r.sweep ||
          r.miniSweep ||
          r.breakAndRun ||
          r.eightOnBreak ||
          r.forfeited) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.sweep && <Badge tone="pop" glow>SWEEP · 1pt</Badge>}
            {!r.sweep && r.miniSweep && <Badge tone="brass">MINI · 0.5pt</Badge>}
            {r.breakAndRun && <Badge tone="felt" glow>BREAK &amp; RUN · 1pt</Badge>}
            {r.eightOnBreak && <Badge tone="cream">8 ON BREAK · 1pt</Badge>}
            {r.forfeited && <Badge tone="pop">FORFEIT</Badge>}
          </div>
        )}
      </div>

      {r.score && (
        <div
          className={cn(
            DISPLAY,
            "ml-auto shrink-0 text-right text-2xl leading-none tabular-nums sm:text-3xl",
            r.outcome === "W"
              ? "text-[var(--color-cream)]"
              : "text-[var(--color-cream)]/55",
          )}
        >
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
  subject = "Top Dawgs",
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
  const yOf = (v: number) => H - padY - (v / Math.max(maxY, 1)) * (H - padY * 2);
  const path = (key: "us" | "them") =>
    points
      .map((p, i) => {
        const x = padX + i * stepX;
        const y = yOf(p[key]);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  const area = (key: "us" | "them") =>
    `${path(key)} L${(padX + arc.length * stepX).toFixed(1)},${(H - padY).toFixed(1)} L${padX},${(H - padY).toFixed(1)} Z`;
  const lastUs = arc[arc.length - 1].us;
  const lastThem = arc[arc.length - 1].them;
  return (
    <div>
      {/* Legend — HTML so it wraps cleanly on phones */}
      <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 px-2 text-xs text-[var(--color-cream)]/75">
        <span className="inline-flex items-center gap-2">
          <span className="h-[3px] w-4 rounded-full bg-[var(--color-brass-bright)]" />
          {subject}
          <span className={`${DISPLAY} text-base leading-none tabular-nums text-[var(--color-brass-bright)]`}>
            {lastUs}
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-[3px] w-4 rounded-full bg-[var(--color-pop-bright)]" />
          {opponent}
          <span className={`${DISPLAY} text-base leading-none tabular-nums text-[var(--color-pop-bright)]`}>
            {lastThem}
          </span>
        </span>
      </div>
      <div className="relative pb-6">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Round-by-round individual wins: ${subject} ${lastUs}, ${opponent} ${lastThem}`}
          className="h-40 w-full overflow-visible sm:h-56"
        >
          <defs>
            <linearGradient id="arc-us-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#e0be6b" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#e0be6b" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Y gridlines */}
          {Array.from({ length: maxY + 1 }, (_, i) => i).map((y) => (
            <line
              key={y}
              x1={padX}
              x2={W - padX}
              y1={yOf(y)}
              y2={yOf(y)}
              stroke="rgba(236,225,196,0.09)"
              strokeDasharray={y === 0 ? undefined : "2 5"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area("us")} fill="url(#arc-us-fill)" />
          {/* Lines — animate drawing in on first paint */}
          <path
            d={path("them")}
            fill="none"
            stroke="var(--color-pop-bright)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path("us")}
            fill="none"
            stroke="var(--color-brass-bright)"
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: "drop-shadow(0 0 6px rgba(224,190,107,0.45))" }}
          />
        </svg>
        {/* Endpoint dots + round labels in HTML so they stay round / legible
            however the chart is stretched. */}
        {[
          { v: lastUs, cls: "h-3 w-3 bg-[var(--color-brass-bright)]" },
          { v: lastThem, cls: "h-2.5 w-2.5 bg-[var(--color-pop-bright)]" },
        ].map((d, i) => (
          <span
            key={i}
            aria-hidden
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--bg-card)] ${d.cls}`}
            style={{
              left: `${((padX + arc.length * stepX) / W) * 100}%`,
              top: `calc((100% - 1.5rem) * ${yOf(d.v) / H})`,
            }}
          />
        ))}
        {arc.map((a, i) => (
          <span
            key={`lbl-${a.position}`}
            aria-hidden
            className="absolute bottom-0 -translate-x-1/2 text-[10px] font-semibold tracking-[0.2em] text-[var(--color-cream)]/45"
            style={{ left: `${((padX + (i + 1) * stepX) / W) * 100}%` }}
          >
            R{a.position}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScoreBlock({
  label,
  score,
  winner,
  tie,
  delay = 0,
  align = "left",
}: {
  label: string;
  score: number;
  winner?: boolean;
  tie?: boolean;
  delay?: number;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        align === "right" ? "items-end text-right" : "items-start text-left",
        "sm:items-center sm:text-center",
      )}
    >
      <p
        className={cn(
          "line-clamp-2 max-w-full text-[10px] font-semibold uppercase leading-snug tracking-[0.22em] sm:text-[11px] sm:tracking-[0.3em]",
          winner
            ? "text-[var(--color-brass-bright)]"
            : tie
              ? "text-[var(--color-tie-bright)]"
              : "text-[var(--color-cream)]/50",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          DISPLAY,
          "mt-1 text-[5.5rem] leading-[0.8] tabular-nums drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)] sm:text-[9rem] lg:text-[10.5rem]",
          winner
            ? "pm-foil"
            : tie
              ? "text-[var(--color-tie-bright)]"
              : "text-[var(--color-cream)]/40",
        )}
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
          ? "inline-flex items-center rounded-full border border-white/10 px-1.5 py-px text-[10px] font-semibold tabular-nums tracking-wider text-[var(--color-cream)]/45"
          : "inline-flex items-center rounded-full border border-[var(--color-brass)]/40 bg-[var(--color-brass)]/10 px-1.5 py-px text-[10px] font-semibold tabular-nums tracking-wider text-[var(--color-brass-bright)]"
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
      ? "bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)] ring-[var(--color-pop-bright)]/25"
      : tone === "brass"
        ? "bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)] ring-[var(--color-brass)]/30"
        : tone === "felt"
          ? "bg-[var(--color-felt)]/30 text-[var(--color-felt-text)] ring-[var(--color-felt-bright)]/30"
          : "bg-[var(--color-cream)]/10 text-[var(--color-cream)] ring-white/10";
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
      className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] ring-1 ring-inset ${cls} ${glowCls}`}
    >
      {children}
    </span>
  );
}
