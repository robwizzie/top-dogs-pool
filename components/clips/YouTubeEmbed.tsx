"use client";

import Image from "next/image";
import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Clip } from "@/lib/youtube/client";
import { formatDate } from "@/lib/utils";

export function YouTubeEmbed({
  clip,
  priority = false,
  className,
}: {
  clip: Clip;
  priority?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState(false);
  return (
    <article
      className={cn(
        "surface surface-hover group relative overflow-hidden",
        className,
      )}
    >
      <div className="relative aspect-video w-full">
        {active ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${clip.id}?autoplay=1&rel=0`}
            title={clip.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setActive(true)}
            className="absolute inset-0 cursor-cue"
            aria-label={`Play ${clip.title}`}
          >
            {clip.thumbnail && (
              <Image
                src={clip.thumbnail}
                alt={clip.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                priority={priority}
                style={{ objectFit: "cover" }}
              />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <span className="absolute left-1/2 top-1/2 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-brass)] text-[var(--color-ink)] shadow-lg transition-transform group-hover:scale-110">
              <Play size={22} className="ml-0.5" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-[var(--fg)]">
          {clip.title}
        </h3>
        <p className="mt-1 text-xs text-[var(--fg-dim)]">
          {formatDate(clip.publishedAt)}
        </p>
      </div>
    </article>
  );
}
