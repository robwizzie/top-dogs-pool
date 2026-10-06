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
  const hasEmbed = Boolean(video.videoId);
  // Player is open by default when we have a YouTube ID; users can collapse it.
  const [open, setOpen] = useState(hasEmbed);
  const url = watchUrl(video);

  if (!hasEmbed) {
    return (
      <div className="pm-glass flex items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-brass)]/40 bg-[radial-gradient(circle_at_35%_30%,rgba(224,190,107,0.3),rgba(0,0,0,0.4))] text-[var(--color-brass-bright)] sm:flex">
            <Play size={16} className="translate-x-px" fill="currentColor" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              Source
            </p>
            <p className="mt-1 truncate font-[family-name:var(--font-display)] text-xl leading-none tracking-wide text-[var(--color-cream)]">
              {video.label}
            </p>
            <p className="mt-1.5 text-xs text-[var(--color-cream)]/50">
              Not on public YouTube — watch on Bert&apos;s streaming library.
            </p>
          </div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--color-brass)]/40 bg-black/30 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10"
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
    <div className="pm-glass overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Source video
          </p>
          <p className="mt-1 truncate font-[family-name:var(--font-display)] text-xl leading-none tracking-wide text-[var(--color-cream)]">
            {video.label}
          </p>
          {video.startSeconds === undefined && (
            <p className="mt-1.5 text-xs text-[var(--color-cream)]/50">
              Timestamp for this shot not catalogued yet — opens the full video.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--color-cream)]/10 bg-black/40 px-3.5 text-xs font-semibold tracking-wide text-[var(--color-cream)]/65 transition-colors hover:text-[var(--color-brass-bright)]"
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
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--color-brass)]/40 bg-black/30 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10"
          >
            YouTube
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
      {open && (
        <div className="border-t border-[var(--color-cream)]/[0.07] bg-black">
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
