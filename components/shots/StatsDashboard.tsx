"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Dog, Flame, Lock, Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/Section";
import { PoolBall } from "@/components/brand/PoolBall";
import { HeaderBackLink, PanelLabel, SECONDARY_PILL } from "./TrainingUI";
import type { KinisterShot } from "@/lib/kinister/shots";
import { useAllShotStats } from "@/lib/kinister/useShotStats";
import { useDrilled } from "@/lib/kinister/useDrilled";
import {
  computeAchievements,
  currentDailyStreak,
} from "@/lib/kinister/achievements";
import { DataIO } from "./DataIO";
import { useSessions } from "@/lib/kinister/useSession";
import { cn } from "@/lib/utils";

export function StatsDashboard({ shots }: { shots: KinisterShot[] }) {
  const stats = useAllShotStats();
  const { ids: drilledIds } = useDrilled();
  const sessions = useSessions();

  const summary = useMemo(() => {
    let totalAttempts = 0;
    let totalMakes = 0;
    let triedCount = 0;
    const dates = new Set<string>();
    const dailyCounts: Record<string, number> = {};
    for (const s of Object.values(stats)) {
      totalAttempts += s.totalAttempts;
      totalMakes += s.totalMakes;
      if (s.totalAttempts > 0) triedCount += 1;
      for (const ses of s.sessions) {
        dates.add(ses.date);
        dailyCounts[ses.date] = (dailyCounts[ses.date] ?? 0) + ses.attempts;
      }
    }
    const makePct =
      totalAttempts > 0 ? Math.round((totalMakes / totalAttempts) * 100) : 0;
    const streak = currentDailyStreak(dates);
    return {
      totalAttempts,
      totalMakes,
      triedCount,
      makePct,
      streak,
      dailyCounts,
    };
  }, [stats]);

  const rankedShots = useMemo(() => {
    return shots
      .map((shot) => {
        const s = stats[shot.id];
        if (!s || s.totalAttempts === 0) return null;
        return {
          shot,
          attempts: s.totalAttempts,
          makes: s.totalMakes,
          pct: (s.totalMakes / s.totalAttempts) * 100,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [shots, stats]);

  const top = useMemo(
    () => [...rankedShots].sort((a, b) => b.pct - a.pct).slice(0, 5),
    [rankedShots],
  );
  const bottom = useMemo(
    () =>
      [...rankedShots]
        .filter((x) => x.attempts >= 3)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 5),
    [rankedShots],
  );

  const achievements = useMemo(
    () => computeAchievements({ shots, stats, drilled: drilledIds }),
    [shots, stats, drilledIds],
  );
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  // Sparkline of attempts over the last 14 days.
  const last14 = useMemo(() => {
    const days: { date: string; attempts: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0",
      )}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({ date: key, attempts: summary.dailyCounts[key] ?? 0 });
    }
    return days;
  }, [summary.dailyCounts]);

  const noData = summary.totalAttempts === 0;

  return (
    <>
      <PageHeader
        eyebrow="Training · Practice log"
        title="Practice Stats"
        subtitle="Aggregated from every Made/Missed you've logged. Everything is stored on your device — clearing your browser data resets it."
      >
        <div className="flex flex-wrap items-center gap-2">
          <HeaderBackLink href="/shots">All shots</HeaderBackLink>
          <Link href="/dawg-drill" className={SECONDARY_PILL}>
            <Dog size={13} />
            Start a Dawg Drill
          </Link>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-8 px-4 pb-12 pt-4 sm:px-6 sm:pb-16 lg:px-8">
        {noData ? (
          <div className="pm-grain relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-[1.75rem] border border-[var(--color-brass)]/25 px-6 py-16 text-center shadow-[0_40px_120px_-40px_rgba(46,139,87,0.6)] sm:py-20">
            <div className="pm-felt absolute inset-0 -z-10" aria-hidden />
            <div className="pm-lamp pm-lamp-flicker absolute inset-0 -z-10" aria-hidden />
            <div className="relative z-[2] flex flex-col items-center gap-3">
              <PoolBall number={8} size={72} className="drop-shadow-[0_18px_24px_rgba(0,0,0,0.6)]" />
              <p className="pm-serif mt-3 text-2xl text-[var(--color-cream)]/75">
                The table&apos;s still cold.
              </p>
              <p className="font-[family-name:var(--font-display)] text-5xl leading-[0.9] tracking-wide text-[var(--color-cream)] sm:text-6xl">
                No reps logged yet.
              </p>
              <p className="max-w-md text-sm leading-relaxed text-[var(--color-cream)]/70">
                Open any shot and tap <span className="font-semibold text-[var(--color-cream)]">Made</span>{" "}
                or <span className="font-semibold text-[var(--color-cream)]">Missed</span> on the tracker
                card. Your stats will start filling in.
              </p>
              <Link href="/shots" className="pm-btn mt-4">
                Open shot catalog
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Headline numbers */}
            <section className="pm-rail mt-2 grid grid-cols-2 lg:grid-cols-4">
              {/* brass diamond sights between the scoreboard cells */}
              <span className="pm-diamond left-1/2 top-1/2 lg:hidden" aria-hidden />
              <span className="pm-diamond left-1/4 top-1/2 hidden lg:block" aria-hidden />
              <span className="pm-diamond left-1/2 top-1/2 hidden lg:block" aria-hidden />
              <span className="pm-diamond left-3/4 top-1/2 hidden lg:block" aria-hidden />
              <StatTile
                label="Total reps"
                value={summary.totalAttempts.toLocaleString()}
                sub={`${summary.triedCount} different shots`}
                foil
              />
              <StatTile
                label="Makes"
                value={summary.totalMakes.toLocaleString()}
                sub={`${summary.makePct}% overall make rate`}
                accent="felt"
              />
              <StatTile
                label="Daily streak"
                value={`${summary.streak}d`}
                icon={<Flame size={13} />}
                accent="brass"
                sub={
                  summary.streak === 0
                    ? "Practice today to start one"
                    : "Consecutive practice days"
                }
              />
              <StatTile
                label="Achievements"
                value={`${unlockedCount}/${achievements.length}`}
                icon={<Trophy size={13} />}
                accent="brass"
                sub="Unlocked"
              />
            </section>

            {/* Daily attempts sparkline */}
            <section className="pm-glass relative isolate overflow-hidden p-5 sm:p-7">
              <div
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_50%_100%,rgba(224,190,107,0.1),transparent_70%)]"
                aria-hidden
              />
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                    Last 14 days
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide text-[var(--color-cream)]">
                    Attempts per day
                  </p>
                </div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-cream)]/45">
                  <span className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--color-brass-bright)]">
                    {last14.reduce((n, d) => n + d.attempts, 0)}
                  </span>{" "}
                  reps
                </p>
              </div>
              <Sparkline days={last14} />
            </section>

            {/* Top and bottom shots */}
            <section className="grid gap-4 lg:grid-cols-2">
              <RankList
                title="Strongest shots"
                accent="felt"
                entries={top}
                emptyText="Log a few more reps to see your strengths."
              />
              <RankList
                title="Needs work"
                accent="pop"
                entries={bottom}
                emptyText="Need 3+ attempts on a shot to rank here."
              />
            </section>

            {/* Recent Dawg Drill sessions */}
            {sessions.length > 0 && (
              <section className="pm-glass p-5 sm:p-6">
                <PanelLabel icon={<Dog size={14} className="text-[var(--color-brass-bright)]" />}>
                  Recent Dawg Drill sessions
                </PanelLabel>
                <ul className="mt-3 divide-y divide-[var(--color-cream)]/[0.07]">
                  {sessions.slice(0, 6).map((s) => {
                    const att = s.shots.reduce(
                      (sum, e) => sum + e.attempts,
                      0,
                    );
                    const made = s.shots.reduce(
                      (sum, e) => sum + e.makes,
                      0,
                    );
                    const pct =
                      att > 0 ? Math.round((made / att) * 100) : null;
                    const shotsTried = s.shots.filter(
                      (e) => e.attempts > 0,
                    ).length;
                    const date = s.endedAt ?? s.startedAt;
                    return (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-baseline justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--fg)]">
                            {new Date(date).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                            {!s.endedAt && (
                              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brass-bright)]">
                                · In progress
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-[var(--fg-dim)]">
                            {shotsTried || s.shots.length} shots ·{" "}
                            {new Date(s.startedAt).toLocaleTimeString(
                              undefined,
                              { hour: "numeric", minute: "2-digit" },
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-[family-name:var(--font-display)] text-xl tracking-wide tabular-nums text-[var(--color-cream)]">
                            {made}/{att}
                          </span>
                          {pct !== null && (
                            <span
                              className={cn(
                                "font-semibold",
                                pct >= 70
                                  ? "text-[var(--color-felt-bright)]"
                                  : pct >= 40
                                    ? "text-[var(--color-brass-bright)]"
                                    : "text-[var(--color-pop-bright)]",
                              )}
                            >
                              {pct}%
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {sessions.length > 6 && (
                  <p className="mt-3 text-[11px] text-[var(--fg-dim)]">
                    Showing the 6 most recent of {sessions.length} sessions.
                  </p>
                )}
              </section>
            )}

            {/* Achievements grid */}
            <section className="pm-glass p-5 sm:p-7">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <PanelLabel icon={<Trophy size={14} className="text-[var(--color-brass-bright)]" />}>
                    Achievements
                  </PanelLabel>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide text-[var(--color-cream)]">
                    The trophy case
                  </p>
                </div>
                <p className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide tabular-nums">
                  <span className="pm-foil">{unlockedCount}</span>
                  <span className="text-[var(--color-cream)]/30">/{achievements.length}</span>
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {achievements.map((a) => (
                  <AchievementCard key={a.id} achievement={a} />
                ))}
              </div>
            </section>
          </>
        )}

        {/* Backup / restore is always available, even with no reps yet,
            so the user can carry data forward from another browser. */}
        <DataIO />
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon,
  accent,
  foil = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: "brass" | "felt" | "pop";
  foil?: boolean;
}) {
  const accentClass = foil
    ? "pm-foil"
    : accent === "brass"
      ? "text-[var(--color-brass-bright)]"
      : accent === "felt"
        ? "text-[#5fc48a]"
        : accent === "pop"
          ? "text-[var(--color-pop-bright)]"
          : "text-[var(--color-cream)]";
  return (
    <div className="px-4 py-5 text-center sm:px-6 sm:py-6">
      <div className="flex items-center justify-center gap-1.5 text-[var(--color-cream)]/50">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em]">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-2 font-[family-name:var(--font-display)] text-5xl leading-[0.85] tracking-wide tabular-nums sm:text-6xl",
          accentClass,
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-2 text-[11px] text-[var(--color-cream)]/50">{sub}</p>}
    </div>
  );
}

function Sparkline({
  days,
}: {
  days: { date: string; attempts: number }[];
}) {
  const max = Math.max(1, ...days.map((d) => d.attempts));
  return (
    <div className="mt-6">
      <div className="relative flex h-32 items-end gap-1.5 sm:h-40 sm:gap-2.5">
        {/* faint guide lines */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-px bg-[var(--color-cream)]/[0.05]" />
          ))}
        </div>
        {days.map((d, i) => {
          const h = (d.attempts / max) * 100;
          const isToday = i === days.length - 1;
          return (
            <div
              key={d.date}
              className="relative flex h-full flex-1 flex-col-reverse"
              title={`${d.date}: ${d.attempts} attempt${d.attempts === 1 ? "" : "s"}`}
            >
              <div
                style={{ height: d.attempts === 0 ? "3px" : `${h}%` }}
                className={cn(
                  "rounded-t-md transition-colors",
                  d.attempts === 0
                    ? "rounded-md bg-[var(--color-cream)]/10"
                    : isToday
                      ? "bg-gradient-to-t from-[#b38b36] via-[#e0be6b] to-[#fff1c9] shadow-[0_0_18px_rgba(224,190,107,0.55)]"
                      : "bg-gradient-to-t from-[#8b6f2c]/70 to-[#e0be6b]/85",
                )}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 sm:gap-2.5">
        {days.map((d, i) => (
          <span
            key={d.date}
            className={cn(
              "flex-1 text-center text-[9px] tabular-nums text-[var(--color-cream)]/35",
              i === days.length - 1 && "font-semibold text-[var(--color-brass-bright)]",
            )}
          >
            {Number(d.date.slice(8))}
          </span>
        ))}
      </div>
    </div>
  );
}

function RankList({
  title,
  accent,
  entries,
  emptyText,
}: {
  title: string;
  accent: "felt" | "pop";
  entries: {
    shot: KinisterShot;
    attempts: number;
    makes: number;
    pct: number;
  }[];
  emptyText: string;
}) {
  const accentText =
    accent === "felt" ? "text-[#5fc48a]" : "text-[var(--color-pop-bright)]";
  const bar =
    accent === "felt"
      ? "bg-gradient-to-r from-[var(--color-felt-bright)] to-[#5fc48a]"
      : "bg-gradient-to-r from-[var(--color-pop)] to-[var(--color-pop-bright)]";
  return (
    <div className="pm-glass relative isolate overflow-hidden p-5 sm:p-6">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 -z-10 h-40",
          accent === "felt"
            ? "bg-[radial-gradient(80%_100%_at_0%_0%,rgba(46,139,87,0.2),transparent_70%)]"
            : "bg-[radial-gradient(80%_100%_at_0%_0%,rgba(232,82,72,0.16),transparent_70%)]",
        )}
        aria-hidden
      />
      <p className={cn("text-[10px] font-semibold uppercase tracking-[0.32em]", accentText)}>
        {accent === "felt" ? "Money shots" : "On the clock"}
      </p>
      <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide text-[var(--color-cream)]">
        {title}
      </h2>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-cream)]/55">{emptyText}</p>
      ) : (
        <ol className="mt-4 space-y-1">
          {entries.map((e, i) => (
            <li key={e.shot.id}>
              <Link
                href={`/shots/${e.shot.id}`}
                className="group block rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-5 shrink-0 font-[family-name:var(--font-display)] text-xl leading-none text-[var(--color-cream)]/30 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)]">
                    <span className="text-[var(--color-cream)]/40">
                      {String(e.shot.number).padStart(2, "0")} ·{" "}
                    </span>
                    {e.shot.name}
                  </span>
                  <span className={cn("shrink-0 font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide tabular-nums", accentText)}>
                    {Math.round(e.pct)}%
                  </span>
                  <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-[var(--color-cream)]/40">
                    {e.makes}/{e.attempts}
                  </span>
                </div>
                <div className="ml-8 mt-1.5 h-1 overflow-hidden rounded-full bg-black/50">
                  <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.round(e.pct)}%` }} />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AchievementCard({
  achievement,
}: {
  achievement: ReturnType<typeof computeAchievements>[number];
}) {
  const { title, description, unlocked, progress } = achievement;
  const pct =
    progress && progress.goal > 0
      ? Math.min(100, Math.round((progress.current / progress.goal) * 100))
      : unlocked
        ? 100
        : 0;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-4 transition-colors",
        unlocked
          ? "bg-[radial-gradient(120%_120%_at_0%_0%,rgba(224,190,107,0.2),rgba(224,190,107,0.04)_60%)] shadow-[inset_0_0_0_1px_rgba(224,190,107,0.45),0_14px_30px_-18px_rgba(201,162,74,0.7)]"
          : "bg-black/30 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {unlocked ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-b from-[#f0d48a] to-[#b38b36] text-[var(--color-ink)] shadow-[0_0_14px_rgba(224,190,107,0.5)]">
              <Trophy size={13} />
            </span>
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-cream)]/10 text-[var(--color-cream)]/35">
              <Lock size={12} />
            </span>
          )}
          <p
            className={cn(
              "text-sm font-semibold tracking-wide",
              unlocked ? "text-[var(--color-cream)]" : "text-[var(--color-cream)]/55",
            )}
          >
            {title}
          </p>
        </div>
        {progress && (
          <span className="text-[10px] tabular-nums text-[var(--color-cream)]/45">
            {progress.current}/{progress.goal}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--color-cream)]/55">
        {description}
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/50">
        <div
          className={cn(
            "h-full transition-all",
            unlocked
              ? "bg-gradient-to-r from-[#b38b36] to-[#f0d48a]"
              : "bg-[var(--color-brass)]/45",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
