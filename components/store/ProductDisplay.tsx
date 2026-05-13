"use client";

import { useMemo, useState } from "react";
import { AddToCart } from "@/components/store/AddToCart";
import { ProductGallery } from "@/components/store/ProductGallery";
import type { Product } from "@/lib/shopify";

export function ProductDisplay({ product }: { product: Product }) {
  const initial = useMemo<Record<string, string>>(() => {
    const firstAvailable =
      product.variants.find((v) => v.availableForSale) ?? product.variants[0];
    const map: Record<string, string> = {};
    firstAvailable?.selectedOptions.forEach((o) => {
      map[o.name] = o.value;
    });
    return map;
  }, [product.variants]);

  const [selected, setSelected] = useState<Record<string, string>>(initial);

  const activeVariant = useMemo(
    () =>
      product.variants.find((v) =>
        v.selectedOptions.every((o) => selected[o.name] === o.value),
      ),
    [product.variants, selected],
  );

  const activeImageUrl = activeVariant?.image?.url ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <ProductGallery
        images={product.images}
        title={product.title}
        activeImageUrl={activeImageUrl}
      />
      <div className="flex min-w-0 flex-col gap-6">
        <header>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Top Dawgs Pro Shop
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-5xl">
            {product.title}
          </h1>
        </header>

        <AddToCart
          product={product}
          selected={selected}
          onSelectedChange={setSelected}
          activeVariant={activeVariant}
        />

        {product.descriptionHtml && (
          <div
            className="prose prose-invert max-w-none overflow-x-auto text-sm leading-relaxed text-[var(--fg-dim)] [&_a]:text-[var(--color-brass-bright)] [&_img]:max-w-full [&_strong]:text-[var(--fg)] [&_table]:my-3 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:whitespace-nowrap"
            dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
          />
        )}

        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-xs text-[var(--fg-dim)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
