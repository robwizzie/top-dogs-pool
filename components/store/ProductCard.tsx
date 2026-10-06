import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatMoney, type ProductSummary } from "@/lib/shopify";

export function ProductCard({ product }: { product: ProductSummary }) {
  const img = product.featuredImage;
  const min = product.priceRange.min;
  const max = product.priceRange.max;
  const priceLabel =
    min.amount === max.amount
      ? formatMoney(min)
      : `${formatMoney(min)} – ${formatMoney(max)}`;
  const onSale =
    product.compareAtPriceRange &&
    Number(product.compareAtPriceRange.min.amount) > Number(min.amount);

  return (
    <Link
      href={`/store/${product.handle}`}
      className="pm-glass pm-lift group relative flex flex-col overflow-hidden p-1.5 sm:p-2"
    >
      <span className="pm-sheen" />
      {/* Product under the lamp: felt-lit backdrop, image floats on top. */}
      <div className="relative aspect-square overflow-hidden rounded-[0.95rem] bg-[radial-gradient(90%_70%_at_50%_0%,rgba(46,139,87,0.35),#0b1a13_70%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
        {img ? (
          <Image
            src={img.url}
            alt={img.altText ?? product.title}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={`object-cover transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.3,1)] group-hover:scale-[1.06] ${
              product.availableForSale ? "" : "opacity-60 grayscale-[0.6]"
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/35">
            No image
          </div>
        )}
        {/* lamp glare + floor vignette */}
        <span
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_0%,rgba(255,236,190,0.12),transparent_70%),linear-gradient(to_top,rgba(0,0,0,0.45),transparent_40%)]"
          aria-hidden
        />
        {!product.availableForSale && (
          <span className="absolute left-2.5 top-2.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--color-cream)]/70 backdrop-blur-sm sm:left-3 sm:top-3 sm:text-[10px]">
            Sold out
          </span>
        )}
        {onSale && product.availableForSale && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[linear-gradient(180deg,#f0685e,var(--color-pop)_60%,#a82a24)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.24em] text-white shadow-[0_6px_16px_-4px_rgba(232,82,72,0.7)] sm:left-3 sm:top-3 sm:text-[10px]">
            Sale
          </span>
        )}
        <span
          className="absolute bottom-2.5 right-2.5 hidden h-9 w-9 translate-y-1 items-center justify-center rounded-full bg-[linear-gradient(180deg,#f0d48a,#c9a24a_55%,#b38b36)] text-[var(--color-ink)] opacity-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_20px_-6px_rgba(201,162,74,0.8)] transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:inline-flex"
          aria-hidden
        >
          <ArrowUpRight size={16} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2.5 pb-2.5 pt-3 sm:px-3 sm:pb-3 sm:pt-4">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug tracking-wide text-[var(--color-cream)] transition-colors group-hover:text-[var(--color-brass-bright)] sm:text-sm">
          {product.title}
        </h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
          <span className="font-[family-name:var(--font-display)] text-xl leading-none tracking-wide tabular-nums text-[var(--color-brass-bright)] sm:text-2xl">
            {priceLabel}
          </span>
          {onSale && product.compareAtPriceRange && (
            <span className="text-xs tabular-nums text-[var(--color-cream)]/40 line-through">
              {formatMoney(product.compareAtPriceRange.min)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
