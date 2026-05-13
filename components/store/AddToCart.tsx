"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/store/CartProvider";
import { formatMoney, type Product, type ProductVariant } from "@/lib/shopify";
import { cn } from "@/lib/utils";

export function AddToCart({ product }: { product: Product }) {
  const variants = product.variants;
  const initial = useMemo<Record<string, string>>(() => {
    const firstAvailable = variants.find((v) => v.availableForSale) ?? variants[0];
    const map: Record<string, string> = {};
    firstAvailable?.selectedOptions.forEach((o) => {
      map[o.name] = o.value;
    });
    return map;
  }, [variants]);

  const [selected, setSelected] = useState<Record<string, string>>(initial);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const { addItem, isLoading } = useCart();

  const activeVariant = useMemo<ProductVariant | undefined>(() => {
    return variants.find((v) =>
      v.selectedOptions.every((o) => selected[o.name] === o.value),
    );
  }, [variants, selected]);

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
        <span className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--color-brass-bright)]">
          {formatMoney(activeVariant?.price ?? product.priceRange.min)}
        </span>
        {activeVariant?.compareAtPrice && (
          <span className="text-sm text-[var(--fg-dim)] line-through">
            {formatMoney(activeVariant.compareAtPrice)}
          </span>
        )}
      </div>

      {showOptions &&
        product.options.map((option) => {
          if (option.values.length === 1 && option.values[0] === "Default Title") return null;
          return (
            <div key={option.name} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brass)]">
                  {option.name}
                </span>
                <span className="text-xs text-[var(--fg-dim)]">
                  {selected[option.name]}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => {
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
                      onClick={() => setSelected(hypothetical)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium tracking-wide transition-colors",
                        isActive
                          ? "border-[var(--color-brass)] bg-[var(--color-brass)] text-[var(--color-ink)]"
                          : available
                            ? "border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg)] hover:border-[var(--border-strong)]"
                            : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-dim)] line-through opacity-60",
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
        <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-card)]">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-l-full text-lg text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[2.5rem] text-center font-semibold">{quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => q + 1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-r-full text-lg text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canBuy || isLoading}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold tracking-wide transition-colors",
            canBuy
              ? "bg-[var(--color-brass)] text-[var(--color-ink)] hover:bg-[var(--color-brass-bright)]"
              : "bg-[var(--bg-card)] text-[var(--fg-dim)]",
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
