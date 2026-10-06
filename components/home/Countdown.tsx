"use client";

import { useEffect, useState } from "react";

/** How long a match night runs once it starts (7:30–11:30pm ET). */
const MATCH_WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * Split-flap countdown to the break. Renders placeholders on the server and
 * the first client paint (so markup matches), then ticks every second.
 * Inside the match window it flips to a live badge; after it, nothing.
 */
export function Countdown({ target }: { target: string }) {
  const start = new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now !== null && now >= start + MATCH_WINDOW_MS) return null;

  if (now !== null && now >= start) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-pop)]/60 bg-[var(--color-pop)]/15 px-4 py-2 font-[family-name:var(--font-display)] text-xl tracking-[0.2em] text-[var(--color-pop-bright)]">
        <span className="h-2.5 w-2.5 animate-pulse-pop rounded-full bg-[var(--color-pop-bright)]" />
        Racking now
      </div>
    );
  }

  const left = now === null ? null : Math.max(0, start - now);
  const parts: [string, number | null][] = [
    ["hrs", left === null ? null : Math.floor(left / 3_600_000)],
    ["min", left === null ? null : Math.floor((left % 3_600_000) / 60_000)],
    ["sec", left === null ? null : Math.floor((left % 60_000) / 1000)],
  ];

  return (
    <div className="flex items-end gap-2 sm:gap-3" role="timer" aria-label="Time until the break">
      {parts.map(([label, v], i) => (
        <div key={label} className="flex items-end gap-2 sm:gap-3">
          {i > 0 && (
            <span className="pb-6 font-[family-name:var(--font-display)] text-2xl text-[var(--color-cream)]/30 sm:text-3xl">
              :
            </span>
          )}
          <div className="flex flex-col items-center gap-1.5">
            <span className="pm-flap font-[family-name:var(--font-display)] text-3xl leading-none tabular-nums text-[var(--color-cream)] sm:text-5xl">
              {v === null ? "--" : String(v).padStart(2, "0")}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/45">
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
