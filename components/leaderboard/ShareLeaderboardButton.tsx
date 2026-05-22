"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Share2, X } from "lucide-react";
import { PoolBall } from "@/components/brand/PoolBall";
import type { LeaderboardRow } from "@/lib/apa/schemas";

type Props = {
  rows: LeaderboardRow[];
  scopeLabel: string;
  /** Raw `?session=` value from the URL — passed through to the image route
   *  so the rendered card matches the leaderboard the user is currently
   *  viewing (single session, multi-select, or "all"). */
  sessionParam?: string;
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

function imageUrlFor(sessionParam: string | undefined): string {
  const base = "/leaderboard/share-image";
  return sessionParam ? `${base}?session=${encodeURIComponent(sessionParam)}` : base;
}

export function ShareLeaderboardButton({
  rows,
  scopeLabel,
  sessionParam,
  previousRanks,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"image" | "text">("image");
  const [copied, setCopied] = useState<"image" | "text" | null>(null);
  const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const blobCache = useRef<Blob | null>(null);

  const text = useMemo(
    () => buildShareText(rows, scopeLabel, previousRanks),
    [rows, scopeLabel, previousRanks],
  );
  const imageUrl = useMemo(() => imageUrlFor(sessionParam), [sessionParam]);

  // Reset image status when scope changes so the loader shows again.
  useEffect(() => {
    if (!open) return;
    setImageStatus("loading");
    blobCache.current = null;
  }, [open, imageUrl]);

  async function fetchBlob(): Promise<Blob | null> {
    if (blobCache.current) return blobCache.current;
    try {
      const res = await fetch(imageUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const b = await res.blob();
      blobCache.current = b;
      return b;
    } catch {
      return null;
    }
  }

  async function copyImage() {
    const blob = await fetchBlob();
    if (!blob) return;
    try {
      // Some browsers (Safari) require ClipboardItem to be constructed with a
      // synchronous Promise resolving to the blob.
      const item =
        typeof ClipboardItem !== "undefined"
          ? new ClipboardItem({ "image/png": blob })
          : null;
      if (!item) throw new Error("ClipboardItem unsupported");
      await navigator.clipboard.write([item]);
      setCopied("image");
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Fallback: download so the user can attach manually.
      downloadImage(blob);
    }
  }

  function downloadImage(blob?: Blob | null) {
    const b = blob ?? blobCache.current;
    if (!b) return;
    const href = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = href;
    a.download = `top-dawgs-patch-watch.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  async function shareNative() {
    if (typeof navigator === "undefined") return;
    if (mode === "image") {
      const blob = await fetchBlob();
      if (blob && navigator.canShare) {
        const file = new File([blob], "top-dawgs-patch-watch.png", {
          type: "image/png",
        });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "Top Dawgs Patch Watch",
            });
            return;
          } catch {
            // user cancelled or share failed — fall through to text share
          }
        }
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: "Top Dawgs Patch Watch", text });
      } catch {
        // cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("text");
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // ignore
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
        aria-label="Open shareable leaderboard card"
      >
        <Share2 size={13} />
        Share
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Share leaderboard"
          onClick={() => setOpen(false)}
        >
          <div
            className="surface relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--fg)]">
                  Share Patch Watch
                </h2>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-[var(--fg-dim)]">
                  Drop the card into your group chat
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

            {/* Mode toggle */}
            <div className="flex gap-1 border-b border-[var(--border)] px-4 pb-3 pt-3">
              <button
                type="button"
                onClick={() => setMode("image")}
                className={
                  "h-8 flex-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors " +
                  (mode === "image"
                    ? "bg-[var(--color-brass)]/20 text-[var(--color-brass-bright)]"
                    : "text-[var(--fg-dim)] hover:text-[var(--fg)]")
                }
              >
                Image
              </button>
              <button
                type="button"
                onClick={() => setMode("text")}
                className={
                  "h-8 flex-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors " +
                  (mode === "text"
                    ? "bg-[var(--color-brass)]/20 text-[var(--color-brass-bright)]"
                    : "text-[var(--fg-dim)] hover:text-[var(--fg)]")
                }
              >
                Text
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {mode === "image" ? (
                <div className="flex justify-center">
                  <div
                    className="relative w-full max-w-[420px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-elev)]"
                    style={{
                      minHeight: imageStatus === "ready" ? undefined : 460,
                    }}
                  >
                    {imageStatus === "loading" && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[var(--bg-elev)] text-[var(--fg-dim)]">
                        <PoolBall number={8} size={72} spin />
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-brass-bright)]">
                            Racking the patches…
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
                            Building your share card
                          </span>
                        </div>
                      </div>
                    )}
                    {imageStatus === "error" ? (
                      <div className="p-8 text-center text-sm text-[var(--fg-dim)]">
                        Couldn&apos;t render the card. Try the Text view.
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt="Top Dawgs Patch Watch leaderboard card"
                        className="block w-full"
                        onLoad={() => setImageStatus("ready")}
                        onError={() => setImageStatus("error")}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-3 font-mono text-[12px] leading-relaxed text-[var(--fg)]">
                  {text}
                </pre>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] p-4">
              {mode === "image" ? (
                <>
                  <button
                    type="button"
                    onClick={() => downloadImage()}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
                    disabled={imageStatus !== "ready"}
                    aria-label="Download the card as a PNG"
                  >
                    <Download size={13} />
                    Save
                  </button>
                  {canNativeShare && (
                    <button
                      type="button"
                      onClick={shareNative}
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
                      disabled={imageStatus !== "ready"}
                    >
                      <Share2 size={13} />
                      Share…
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={copyImage}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--color-brass)] bg-[var(--color-brass)]/15 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/25 disabled:opacity-50"
                    disabled={imageStatus !== "ready"}
                  >
                    {copied === "image" ? <Check size={13} /> : <Copy size={13} />}
                    {copied === "image" ? "Copied" : "Copy image"}
                  </button>
                </>
              ) : (
                <>
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
                    {copied === "text" ? <Check size={13} /> : <Copy size={13} />}
                    {copied === "text" ? "Copied" : "Copy text"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
