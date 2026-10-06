"use client";

import { useMemo, useState } from "react";
import { AddToCart } from "@/components/store/AddToCart";
import { ProductGallery } from "@/components/store/ProductGallery";
import {
  findImageUrlForSelection,
  findLargeValue,
  isSizeOption,
  type Product,
  type ProductVariant,
} from "@/lib/shopify";

export function ProductDisplay({ product }: { product: Product }) {
  const initial = useMemo<Record<string, string>>(() => {
    const sizeOption = product.options.find((o) => isSizeOption(o.name));
    const largeValue = sizeOption ? findLargeValue(sizeOption.values) : undefined;

    let chosen: ProductVariant | undefined;
    if (sizeOption && largeValue) {
      chosen = product.variants.find(
        (v) =>
          v.availableForSale &&
          v.selectedOptions.some(
            (o) => o.name === sizeOption.name && o.value === largeValue,
          ),
      );
    }
    if (!chosen) {
      chosen =
        product.variants.find((v) => v.availableForSale) ?? product.variants[0];
    }

    const map: Record<string, string> = {};
    chosen?.selectedOptions.forEach((o) => {
      map[o.name] = o.value;
    });
    return map;
  }, [product.variants, product.options]);

  const [selected, setSelected] = useState<Record<string, string>>(initial);

  const activeVariant = useMemo(
    () =>
      product.variants.find((v) =>
        v.selectedOptions.every((o) => selected[o.name] === o.value),
      ),
    [product.variants, selected],
  );

  const activeImageUrl = useMemo(
    () => findImageUrlForSelection(product.variants, product.options, selected),
    [product.variants, product.options, selected],
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1.08fr_1fr] lg:gap-14">
      <ProductGallery
        images={product.images}
        title={product.title}
        activeImageUrl={activeImageUrl}
      />
      <div className="flex min-w-0 flex-col gap-7 lg:sticky lg:top-24 lg:self-start lg:pt-4">
        <header>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)] backdrop-blur-sm sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-felt-bright)] shadow-[0_0_10px_2px_rgba(46,139,87,0.8)]" />
            Top Dawgs Pro Shop
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[0.9] tracking-wide text-[var(--color-cream)] drop-shadow-[0_6px_30px_rgba(0,0,0,0.5)] [overflow-wrap:anywhere] sm:text-6xl lg:text-7xl">
            {product.title}
          </h1>
          <div className="pm-rule mt-6" aria-hidden />
        </header>

        <AddToCart
          product={product}
          selected={selected}
          onSelectedChange={setSelected}
          activeVariant={activeVariant}
        />

        {product.descriptionHtml && (
          <div
            className="prose prose-invert max-w-none overflow-x-auto border-t border-[var(--color-cream)]/[0.07] pt-6 text-sm leading-relaxed text-[var(--color-cream)]/70 [&_a]:text-[var(--color-brass-bright)] [&_li]:marker:text-[var(--color-brass)] [&_img]:max-w-full [&_strong]:text-[var(--color-cream)] [&_table]:my-3 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:whitespace-nowrap"
            dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
          />
        )}

        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-cream)]/55"
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
