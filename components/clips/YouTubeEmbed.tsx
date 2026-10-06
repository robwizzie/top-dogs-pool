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
                // i.ytimg.com already serves CDN-optimized JPGs at the
                // sizes we use — running them back through Vercel's
                // image optimizer would just burn function invocations
                // and origin transfer for no quality win.
                unoptimized
              />
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent transition-opacity duration-500 group-hover:opacity-70" />
            <span className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(224,190,107,0.18),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <span className="absolute left-1/2 top-1/2 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[linear-gradient(180deg,#f0d48a,#c9a24a_55%,#b38b36)] text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_0_0_6px_rgba(0,0,0,0.25),0_14px_36px_-8px_rgba(201,162,74,0.75)] transition-transform duration-300 group-hover:scale-110">
              <Play size={22} className="ml-0.5" fill="currentColor" />
            </span>
          </button>
        )}
      </div>
      <div className="border-t border-[var(--color-cream)]/[0.07] p-4 sm:px-5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)]">
          {clip.title}
        </h3>
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-cream)]/45">
          {formatDate(clip.publishedAt)}
        </p>
      </div>
    </article>
  );
}
