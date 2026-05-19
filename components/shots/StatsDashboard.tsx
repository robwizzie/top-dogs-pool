"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowLeft,
  Flame,
  LineChart,
  Lock,
  Target,
  Trophy,
} from "lucide-react";
import type { KinisterShot } from "@/lib/kinister/shots";
import { useAllShotStats } from "@/lib/kinister/useShotStats";
import { useDrilled } from "@/lib/kinister/useDrilled";
import {
  computeAchievements,
  currentDailyStreak,
} from "@/lib/kinister/achievements";
import { DataIO } from "./DataIO";
import { cn } from "@/lib/utils";

export function StatsDashboard({ shots }: { shots: KinisterShot[] }) {
  const stats = useAllShotStats();
  const { ids: drilledIds } = useDrilled();

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
      <header className="border-b border-[var(--border)] bg-[var(--bg-soft)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Link
            href="/shots"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
          >
            <ArrowLeft size={14} />
            All Shots
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <LineChart
              size={28}
              className="text-[var(--color-brass-bright)]"
            />
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-5xl">
              Practice Stats
            </h1>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fg-dim)]">
            Aggregated from every Made/Missed you&apos;ve logged. Everything is
            stored on your device — clearing your browser data resets it.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        {noData ? (
          <div className="surface flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Target size={36} className="text-[var(--fg-dim)]" />
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
              No reps logged yet.
            </p>
            <p className="max-w-md text-sm text-[var(--fg-dim)]">
              Open any shot and tap <span className="font-semibold">Made</span>{" "}
              or <span className="font-semibold">Missed</span> on the tracker
              card. Your stats will start filling in.
            </p>
            <Link
              href="/shots"
              className="mt-2 inline-flex h-10 items-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)] px-4 text-sm font-semibold tracking-wide text-[var(--color-ink)] hover:bg-[var(--color-brass-bright)]"
            >
              Open shot catalog
            </Link>
          </div>
        ) : (
          <>
            {/* Headline numbers */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Total reps"
                value={summary.totalAttempts.toLocaleString()}
                sub={`${summary.triedCount} different shots`}
              />
              <StatTile
                label="Makes"
                value={summary.totalMakes.toLocaleString()}
                sub={`${summary.makePct}% overall make rate`}
              />
              <StatTile
                label="Daily streak"
                value={`${summary.streak}d`}
                icon={<Flame size={16} />}
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
                icon={<Trophy size={16} />}
                accent="brass"
                sub="Unlocked"
              />
            </section>

            {/* Daily attempts sparkline */}
            <section className="surface p-5">
              <div className="flex items-baseline justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                  Last 14 days
                </p>
                <p className="text-[11px] text-[var(--fg-dim)]">
                  Attempts per day
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

            {/* Achievements grid */}
            <section className="surface p-5">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-[var(--color-brass-bright)]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
                  Achievements
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
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: "brass" | "felt" | "pop";
}) {
  const accentClass =
    accent === "brass"
      ? "text-[var(--color-brass-bright)]"
      : accent === "felt"
        ? "text-[var(--color-felt-bright)]"
        : accent === "pop"
          ? "text-[var(--color-pop-bright)]"
          : "text-[var(--fg)]";
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2 text-[var(--fg-dim)]">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em]">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-2 font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide",
          accentClass,
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-2 text-[11px] text-[var(--fg-dim)]">{sub}</p>}
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
    <div className="mt-3 flex h-24 items-end gap-1.5">
      {days.map((d) => {
        const h = (d.attempts / max) * 100;
        return (
          <div
            key={d.date}
            className="flex flex-1 flex-col-reverse"
            title={`${d.date}: ${d.attempts} attempt${d.attempts === 1 ? "" : "s"}`}
          >
            <div
              style={{ height: `${h}%` }}
              className={cn(
                "rounded-t-sm transition-colors",
                d.attempts === 0
                  ? "bg-[var(--border)]/60"
                  : "bg-[var(--color-brass-bright)]/70",
              )}
            />
          </div>
        );
      })}
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
    accent === "felt"
      ? "text-[var(--color-felt-bright)]"
      : "text-[var(--color-pop-bright)]";
  return (
    <div className="surface p-5">
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.32em]",
          accentText,
        )}
      >
        {title}
      </p>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--fg-dim)]">{emptyText}</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {entries.map((e) => (
            <li key={e.shot.id}>
              <Link
                href={`/shots/${e.shot.id}`}
                className="flex items-center justify-between gap-3 py-2 text-sm transition-colors hover:text-[var(--color-brass-bright)]"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-[var(--fg-dim)]">
                    {String(e.shot.number).padStart(2, "0")} ·{" "}
                  </span>
                  {e.shot.name}
                </span>
                <span className="shrink-0 font-mono font-semibold">
                  {Math.round(e.pct)}%
                </span>
                <span className="shrink-0 text-xs text-[var(--fg-dim)]">
                  {e.makes}/{e.attempts}
                </span>
              </Link>
            </li>
          ))}
        </ul>
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
        "rounded-xl border p-3 transition-colors",
        unlocked
          ? "border-[var(--color-brass)]/55 bg-[var(--color-brass)]/10"
          : "border-[var(--border)] bg-[var(--bg-card)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {unlocked ? (
            <Trophy
              size={16}
              className="text-[var(--color-brass-bright)]"
            />
          ) : (
            <Lock size={14} className="text-[var(--fg-dim)]" />
          )}
          <p
            className={cn(
              "text-sm font-semibold tracking-wide",
              unlocked ? "text-[var(--fg)]" : "text-[var(--fg-dim)]",
            )}
          >
            {title}
          </p>
        </div>
        {progress && (
          <span className="text-[10px] font-mono text-[var(--fg-dim)]">
            {progress.current}/{progress.goal}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--fg-dim)]">
        {description}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border)]/60">
        <div
          className={cn(
            "h-full transition-all",
            unlocked
              ? "bg-[var(--color-brass-bright)]"
              : "bg-[var(--color-brass)]/40",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
