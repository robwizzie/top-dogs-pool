"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Sparkles, X } from "lucide-react";
import type { ShotReport } from "@/lib/cv/shotAnalysis";
import { cn } from "@/lib/utils";

export type CoachState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; verdict: string; summary: string }
  | { kind: "error"; message: string };

export function ResultPanel({
  report,
  inchesPerDiamond,
  loggedAs,
  onOverride,
  coach,
  canCoach,
  onCoach,
  onDismiss,
}: {
  report: ShotReport;
  inchesPerDiamond: number;
  /** What was written to the stats (null = not logged yet). */
  loggedAs: "make" | "miss" | null;
  onOverride: (v: "make" | "miss") => void;
  coach: CoachState;
  canCoach: boolean;
  onCoach: () => void;
  onDismiss: () => void;
}) {
  // Phones in landscape have little height to spare — start compact so
  // the table (and the drawn paths) stay visible.
  const [expanded, setExpanded] = useState(
    () => typeof window === "undefined" || window.innerHeight >= 560,
  );
  const v = loggedAs ?? report.verdict;
  const chips: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral" }[] = [];
  if (report.aim && report.targetPocket) {
    const e = report.aim.errorDeg;
    const straight = report.aim.idealCutDeg < 1.5;
    chips.push({
      label: "Aim",
      value:
        Math.abs(e) < 0.8
          ? "on line"
          : straight
            ? `${Math.abs(e).toFixed(1)}° ${e > 0 ? "left" : "right"}`
            : `${Math.abs(e).toFixed(1)}° ${e > 0 ? "over" : "under"}`,
      tone: Math.abs(e) < 0.8 ? "good" : Math.abs(e) < 2 ? "warn" : "bad",
    });
    chips.push({
      label: "Line at pocket",
      value: `${report.aim.offsetIn.toFixed(1)}″ off`,
      tone: report.aim.offsetIn < 1 ? "good" : report.aim.offsetIn < 2 ? "warn" : "bad",
    });
  }
  if (report.position) {
    const e = report.position.error;
    chips.push({
      label: "Shape",
      value: `${e.toFixed(2)}◆ · ${Math.round(e * inchesPerDiamond)}″`,
      tone: e < 0.3 ? "good" : e < 0.75 ? "warn" : "bad",
    });
  }
  if (report.rails) {
    chips.push({
      label: "Rails",
      value: `${report.rails.actual} / ${report.rails.intended}`,
      tone: report.rails.actual === report.rails.intended ? "good" : "warn",
    });
  }
  if (report.speedLabel) {
    chips.push({ label: "Speed", value: report.speedLabel, tone: "neutral" });
  }

  return (
    <div className="pointer-events-auto w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-black/85 p-3.5 text-white backdrop-blur-md sm:p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-center",
            v === "make"
              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
              : v === "miss"
                ? "border-[var(--color-pop-bright)]/60 bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]"
                : "border-white/25 bg-white/5 text-white/70",
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">
            {v === "make" ? "Make" : v === "miss" ? "Miss" : "?"}
          </span>
          <span className="font-[family-name:var(--font-display)] text-xl leading-none">
            {report.score}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{report.headline}</p>
          {report.lowConfidence && (
            <p className="mt-0.5 text-[11px] text-white/55">
              Lost sight of a ball for part of the shot — numbers may be off.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.label}
                className={cn(
                  "inline-flex items-baseline gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                  c.tone === "good" && "border-emerald-400/40 text-emerald-200",
                  c.tone === "warn" && "border-amber-300/40 text-amber-200",
                  c.tone === "bad" && "border-[var(--color-pop-bright)]/50 text-[var(--color-pop-bright)]",
                  c.tone === "neutral" && "border-white/20 text-white/80",
                )}
              >
                <span className="text-white/50">{c.label}</span>
                <span className="font-semibold">{c.value}</span>
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Hide result"
          className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {!expanded && report.tips.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 flex w-full items-center gap-2 text-left text-[12px] leading-snug text-white/80"
        >
          <span className="min-w-0 flex-1 truncate">{report.tips[0]}</span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-[var(--color-brass-bright)]">
            Details <ChevronDown size={12} />
          </span>
        </button>
      )}

      {expanded && report.tips.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-white/85">
          {report.tips.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[var(--color-brass-bright)]">•</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}

      {expanded && coach.kind === "done" && (
        <div className="mt-3 rounded-xl border border-[var(--color-brass)]/40 bg-[var(--color-brass)]/10 p-3 text-[13px] leading-snug">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-brass-bright)]">
            AI coach · {coach.verdict}
          </p>
          {coach.summary}
        </div>
      )}
      {coach.kind === "error" && (
        <p className="mt-3 text-[12px] text-[var(--color-pop-bright)]">{coach.message}</p>
      )}

      <div className={cn("flex flex-wrap items-center gap-2", expanded ? "mt-3" : "mt-2")}>
        <span className="text-[11px] text-white/50">Wrong call?</span>
        <button
          type="button"
          onClick={() => onOverride("make")}
          className={cn(
            "h-8 rounded-full border px-3 text-xs font-semibold",
            loggedAs === "make"
              ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
              : "border-white/20 text-white/80 hover:bg-white/10",
          )}
        >
          Made it
        </button>
        <button
          type="button"
          onClick={() => onOverride("miss")}
          className={cn(
            "h-8 rounded-full border px-3 text-xs font-semibold",
            loggedAs === "miss"
              ? "border-[var(--color-pop-bright)]/70 bg-[var(--color-pop)]/20 text-[var(--color-pop-bright)]"
              : "border-white/20 text-white/80 hover:bg-white/10",
          )}
        >
          Missed it
        </button>
        {canCoach && (
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
              onCoach();
            }}
            disabled={coach.kind === "loading"}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-brass)]/60 bg-[var(--color-brass)]/15 px-3 text-xs font-semibold text-[var(--color-brass-bright)] hover:bg-[var(--color-brass)]/25 disabled:opacity-60"
          >
            {coach.kind === "loading" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {coach.kind === "loading" ? "Reviewing…" : "AI coach"}
          </button>
        )}
      </div>
    </div>
  );
}
