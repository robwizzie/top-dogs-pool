import Image from "next/image";
import Link from "next/link";
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
      className="group surface surface-hover relative flex flex-col overflow-hidden transition-all hover:-translate-y-0.5"
    >
      <div className="relative aspect-square overflow-hidden bg-[var(--bg)]">
        {img ? (
          <Image
            src={img.url}
            alt={img.altText ?? product.title}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--fg-dim)]">
            No image
          </div>
        )}
        {!product.availableForSale && (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--color-ink)]/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            Sold out
          </span>
        )}
        {onSale && product.availableForSale && (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--color-pop)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
            Sale
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold tracking-wide group-hover:text-[var(--color-brass-bright)]">
          {product.title}
        </h3>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="font-[family-name:var(--font-display)] text-lg tracking-wide text-[var(--color-brass-bright)]">
            {priceLabel}
          </span>
          {onSale && product.compareAtPriceRange && (
            <span className="text-xs text-[var(--fg-dim)] line-through">
              {formatMoney(product.compareAtPriceRange.min)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
