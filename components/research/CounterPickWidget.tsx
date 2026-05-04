"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CounterPickRow } from "@/lib/research";
import { cn } from "@/lib/utils";

export function CounterPickWidget({
  opponents,
  pickFor,
}: {
  /** All opponent names known in scope, sorted. */
  opponents: string[];
  /** Pre-computed per-opponent ranking — keyed by lowercased name. */
  pickFor: Record<string, CounterPickRow[]>;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return opponents.slice(0, 8);
    return opponents.filter((o) => o.toLowerCase().includes(q)).slice(0, 12);
  }, [query, opponents]);
  const [picked, setPicked] = useState<string | null>(null);
  const rows = picked ? pickFor[picked.toLowerCase()] ?? [] : [];

  return (
    <div className="surface p-5">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
        Pick an opponent
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPicked(null);
        }}
        placeholder="Type a name…"
        className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2 text-sm placeholder:text-[var(--fg-dim)] focus:border-[var(--color-brass)] focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {filtered.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setPicked(o)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              picked === o
                ? "border-[var(--color-brass)] bg-[var(--color-brass)] text-[var(--color-ink)]"
                : "border-[var(--border)] text-[var(--fg-dim)] hover:border-[var(--color-brass)] hover:text-[var(--fg)]",
            )}
          >
            {o}
          </button>
        ))}
        {filtered.length === 0 && (
          <span className="text-xs text-[var(--fg-dim)]">
            No opponents match.
          </span>
        )}
      </div>

      {picked && (
        <div className="mt-5">
          <p className="mb-2 text-xs text-[var(--fg-dim)]">
            Best Top Dogs to throw vs <strong>{picked}</strong> (Bayesian-smoothed
            so a 1-0 doesn&apos;t outrank a 5-1):
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--fg-dim)]">
              No head-to-head data with anyone on the current roster.
            </p>
          ) : (
            <ol className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
              {rows.map((r, i) => (
                <li
                  key={r.playerId}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "w-6 font-[family-name:var(--font-display)] text-xl tracking-wide",
                      i === 0
                        ? "text-[var(--color-brass-bright)]"
                        : "text-[var(--fg-dim)]",
                    )}
                  >
                    {i + 1}
                  </span>
                  <Link
                    href={`/roster/${r.playerId}`}
                    className="flex-1 truncate font-medium hover:text-[var(--color-brass)]"
                  >
                    {r.playerName}
                  </Link>
                  <span className="text-xs text-[var(--fg-dim)] tabular-nums">
                    {r.wins}-{r.losses}
                  </span>
                  <span className="w-12 text-right text-sm font-semibold tabular-nums text-[var(--color-brass-bright)]">
                    {r.score}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
