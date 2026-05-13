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
      <div className="surface flex aspect-square items-center justify-center text-[var(--fg-dim)]">
        No image
      </div>
    );
  }
  const current = images[active] ?? images[0];
  return (
    <div className="flex flex-col gap-3">
      <div className="surface relative aspect-square overflow-hidden">
        <Image
          src={current.url}
          alt={current.altText ?? title}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority
          className="object-cover"
        />
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
                "relative aspect-square overflow-hidden rounded-lg border bg-[var(--bg)] transition-all",
                i === active
                  ? "border-[var(--color-brass)] ring-2 ring-[var(--color-brass)]/40"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]",
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
