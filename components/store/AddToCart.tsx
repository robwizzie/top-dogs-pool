"use client";

import { useState } from "react";
import { Check, Loader2, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/store/CartProvider";
import {
  formatMoney,
  isSizeOption,
  sortSizeValues,
  type Product,
  type ProductVariant,
} from "@/lib/shopify";
import { cn } from "@/lib/utils";

export function AddToCart({
  product,
  selected,
  onSelectedChange,
  activeVariant,
}: {
  product: Product;
  selected: Record<string, string>;
  onSelectedChange: (next: Record<string, string>) => void;
  activeVariant: ProductVariant | undefined;
}) {
  const variants = product.variants;
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const { addItem, isLoading } = useCart();

  const canBuy = Boolean(activeVariant?.availableForSale);
  const showOptions = product.options.some(
    (o) => o.values.length > 1 || o.values[0] !== "Default Title",
  );

  async function onAdd() {
    if (!activeVariant) return;
    await addItem(activeVariant.id, quantity);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1600);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline gap-3">
        <span className="pm-foil font-[family-name:var(--font-display)] text-5xl leading-none tracking-wide tabular-nums">
          {formatMoney(activeVariant?.price ?? product.priceRange.min)}
        </span>
        {activeVariant?.compareAtPrice && (
          <span className="text-base tabular-nums text-[var(--color-cream)]/40 line-through">
            {formatMoney(activeVariant.compareAtPrice)}
          </span>
        )}
      </div>

      {showOptions &&
        product.options.map((option) => {
          if (option.values.length === 1 && option.values[0] === "Default Title") return null;
          const orderedValues = isSizeOption(option.name)
            ? sortSizeValues(option.values)
            : option.values;
          return (
            <div key={option.name} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-brass)]">
                  {option.name}
                </span>
                <span className="text-xs font-medium text-[var(--color-cream)]/60">
                  {selected[option.name]}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {orderedValues.map((value) => {
                  const isActive = selected[option.name] === value;
                  // Determine availability by checking if any variant with this combo is in stock
                  const hypothetical = { ...selected, [option.name]: value };
                  const matching = variants.find((v) =>
                    v.selectedOptions.every((o) => hypothetical[o.name] === o.value),
                  );
                  const available = matching?.availableForSale ?? false;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onSelectedChange(hypothetical)}
                      className={cn(
                        "min-w-[3rem] rounded-full border px-4 py-2.5 text-sm font-semibold tracking-wide transition-all duration-200",
                        isActive
                          ? "border-transparent bg-[linear-gradient(180deg,#f0d48a,#c9a24a_55%,#b38b36)] text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_22px_-8px_rgba(201,162,74,0.75)]"
                          : available
                            ? "border-white/10 bg-white/[0.04] text-[var(--color-cream)] hover:border-[var(--color-brass)]/50 hover:bg-[var(--color-brass)]/10"
                            : "border-white/[0.06] bg-transparent text-[var(--color-cream)]/35 line-through",
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex items-center self-start rounded-full border border-white/10 bg-black/30 shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)] sm:self-auto">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="inline-flex h-12 w-12 items-center justify-center rounded-l-full text-lg text-[var(--color-cream)]/60 transition-colors hover:text-[var(--color-brass-bright)] disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[2.5rem] text-center font-[family-name:var(--font-display)] text-2xl leading-none tabular-nums text-[var(--color-cream)]">{quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => q + 1)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-r-full text-lg text-[var(--color-cream)]/60 transition-colors hover:text-[var(--color-brass-bright)]"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canBuy || isLoading}
          className={cn(
            "flex-1 justify-center",
            canBuy
              ? "pm-btn min-h-12 disabled:opacity-80"
              : "inline-flex min-h-12 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold tracking-wide text-[var(--color-cream)]/45",
          )}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Adding…
            </>
          ) : justAdded ? (
            <>
              <Check size={16} /> Added
            </>
          ) : !canBuy ? (
            "Sold out"
          ) : (
            <>
              <ShoppingBag size={16} /> Add to cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
