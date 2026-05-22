"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import type { LeaderboardRow } from "@/lib/apa/schemas";

type Props = {
  rows: LeaderboardRow[];
  scopeLabel: string;
  previousRanks?: Record<string, number>;
};

const RANK_PREFIX = ["🥇", "🥈", "🥉"];

function formatPoints(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

function deltaTag(rank: number, prev?: number): string {
  if (prev === undefined) return " 🆕";
  if (prev === rank) return " ➖";
  if (prev > rank) return ` ⬆️ +${prev - rank}`;
  return ` ⬇️ ${rank - prev}`;
}

function buildShareText(
  rows: LeaderboardRow[],
  scopeLabel: string,
  previousRanks: Record<string, number> | undefined,
): string {
  const showDeltas =
    previousRanks !== undefined && Object.keys(previousRanks).length > 0;
  const lines: string[] = [];
  lines.push("🎱 Top Dawgs Patch Watch");
  lines.push(scopeLabel);
  lines.push("━━━━━━━━━━━━━━━━━━━");

  rows.forEach((row, i) => {
    const rank = i + 1;
    const head = RANK_PREFIX[i] ?? `${rank}.`;
    const sl = row.skillLevel ? ` (SL${row.skillLevel})` : "";
    const delta = showDeltas ? deltaTag(rank, previousRanks?.[row.playerId]) : "";
    const pts = formatPoints(row.points);
    const ptLabel = row.points === 1 ? "pt" : "pts";
    lines.push(`${head} ${row.playerName}${sl} — ${pts} ${ptLabel}${delta}`);

    const patches: string[] = [];
    if (row.sweeps) patches.push(`🏆 Sweep×${row.sweeps}`);
    if (row.miniSweeps) patches.push(`⭐ Mini×${row.miniSweeps}`);
    if (row.breakAndRuns) patches.push(`💥 B&R×${row.breakAndRuns}`);
    if (row.eightOnBreaks) patches.push(`8️⃣ 8oB×${row.eightOnBreaks}`);
    if (row.levelUps) patches.push(`📈 Level Up×${row.levelUps}`);
    if (row.firstWin) patches.push(`🎉 First Win`);
    if (row.mvp) patches.push(`👑 MVP×${row.mvp}`);
    if (patches.length) lines.push(`   ${patches.join(" · ")}`);
  });

  lines.push("━━━━━━━━━━━━━━━━━━━");
  if (showDeltas) {
    lines.push("⬆️ moved up · ⬇️ moved down · 🆕 new this week");
  }
  lines.push("🐺 topdawgspool.com/leaderboard");
  return lines.join("\n");
}

export function ShareLeaderboardButton({
  rows,
  scopeLabel,
  previousRanks,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const text = useMemo(
    () => buildShareText(rows, scopeLabel, previousRanks),
    [rows, scopeLabel, previousRanks],
  );

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable on insecure origins — fall back to the
      // native textarea selection so the user can still copy manually.
    }
  }

  async function shareNative() {
    if (typeof navigator === "undefined" || !navigator.share) {
      copyText();
      return;
    }
    try {
      await navigator.share({
        title: "Top Dawgs Patch Watch",
        text,
      });
    } catch {
      // User cancelled.
    }
  }

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (rows.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
        aria-label="Open shareable leaderboard text"
      >
        <Share2 size={13} />
        Share
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Share leaderboard"
          onClick={() => setOpen(false)}
        >
          <div
            className="surface relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--fg)]">
                  Share leaderboard
                </h2>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-[var(--fg-dim)]">
                  Copy &amp; paste into your group chat
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-[var(--fg-dim)] hover:bg-[var(--bg-elev)] hover:text-[var(--fg)]"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap break-words rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-3 font-mono text-[12px] leading-relaxed text-[var(--fg)]">
                {text}
              </pre>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] p-4">
              {canNativeShare && (
                <button
                  type="button"
                  onClick={shareNative}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
                >
                  <Share2 size={13} />
                  Share…
                </button>
              )}
              <button
                type="button"
                onClick={copyText}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)]/15 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/25"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy text"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
