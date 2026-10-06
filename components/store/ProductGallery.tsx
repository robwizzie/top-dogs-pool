"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ProductImage } from "@/lib/shopify";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  title,
  activeImageUrl,
}: {
  images: ProductImage[];
  title: string;
  /** When provided, the gallery jumps to this image. */
  activeImageUrl?: string | null;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!activeImageUrl) return;
    const idx = images.findIndex((img) => img.url === activeImageUrl);
    if (idx >= 0 && idx !== active) setActive(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImageUrl, images]);

  if (images.length === 0) {
    return (
      <div className="pm-glass flex aspect-square items-center justify-center text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/35">
        No image
      </div>
    );
  }
  const current = images[active] ?? images[0];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="pm-glass relative aspect-square overflow-hidden p-2">
        <div className="relative h-full w-full overflow-hidden rounded-[0.9rem] bg-[radial-gradient(90%_70%_at_50%_0%,rgba(46,139,87,0.35),#0b1a13_70%)]">
          <Image
            key={current.url}
            src={current.url}
            alt={current.altText ?? title}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            priority
            className="fade-in-up object-cover"
          />
          <span
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_40%_at_50%_0%,rgba(255,236,190,0.1),transparent_70%)]"
            aria-hidden
          />
        </div>
        {images.length > 1 && (
          <span className="absolute bottom-4 right-4 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-semibold tabular-nums tracking-[0.2em] text-[var(--color-cream)]/75 backdrop-blur-sm">
            {active + 1} / {images.length}
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              aria-label={`View image ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border bg-[#0b1a13] transition-all duration-300",
                i === active
                  ? "border-[var(--color-brass-bright)]/80 shadow-[0_0_0_3px_rgba(201,162,74,0.25),0_10px_24px_-10px_rgba(201,162,74,0.6)]"
                  : "border-white/10 opacity-60 hover:border-[var(--color-brass)]/40 hover:opacity-100",
              )}
            >
              <Image
                src={img.url}
                alt={img.altText ?? `${title} ${i + 1}`}
                fill
                sizes="100px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
