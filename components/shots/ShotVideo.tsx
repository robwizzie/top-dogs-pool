"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, Play } from "lucide-react";
import type { ShotVideo } from "@/lib/kinister/shots";
import { watchUrl } from "@/lib/kinister/shots";
import { cn } from "@/lib/utils";

/**
 * Source video block — "Watch on YouTube" link plus an inline collapsible
 * embed for shots whose source has a public YouTube ID. For shots without
 * a public video (Tight Pocket, Jump, etc.) it falls back to a single
 * external link to Bert's streaming library.
 */
export function ShotVideoBlock({ video }: { video: ShotVideo }) {
  const [open, setOpen] = useState(false);
  const url = watchUrl(video);
  const hasEmbed = Boolean(video.videoId);

  if (!hasEmbed) {
    return (
      <div className="surface flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Source
          </p>
          <p className="mt-1 truncate text-sm text-[var(--fg)]">{video.label}</p>
          <p className="mt-1 text-xs text-[var(--fg-dim)]">
            Not on public YouTube — watch on Bert&apos;s streaming library.
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)] px-4 text-sm font-semibold tracking-wide text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)] hover:text-[var(--color-ink)]"
        >
          <ExternalLink size={14} />
          Watch
        </a>
      </div>
    );
  }

  const startParam = video.startSeconds
    ? `?start=${Math.floor(video.startSeconds)}&autoplay=1`
    : "?autoplay=1";

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Source video
          </p>
          <p className="mt-1 truncate text-sm text-[var(--fg)]">{video.label}</p>
          {video.startSeconds === undefined && (
            <p className="mt-1 text-xs text-[var(--fg-dim)]">
              Timestamp for this shot not catalogued yet — opens the full video.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-semibold tracking-wide text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]"
          >
            <Play size={12} />
            {open ? "Hide player" : "Inline player"}
            <ChevronDown
              size={12}
              className={cn(
                "transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)] px-4 text-sm font-semibold tracking-wide text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)] hover:text-[var(--color-ink)]"
          >
            YouTube
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
      {open && (
        <div className="border-t border-[var(--border)]">
          <div className="relative aspect-video w-full">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${video.videoId}${startParam}`}
              title={video.label}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}
