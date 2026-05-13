"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/store/CartProvider";
import { formatMoney } from "@/lib/shopify";
import { cn } from "@/lib/utils";

export function CartDrawer() {
  const { cart, isOpen, close, updateLine, removeLine, isLoading } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  return (
    <>
      <div
        aria-hidden={!isOpen}
        onClick={close}
        className={cn(
          "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg-soft)] shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-[var(--color-brass)]" />
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
              Your Cart
            </h2>
            {cart && cart.totalQuantity > 0 && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-xs text-[var(--fg-dim)]">
                {cart.totalQuantity}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!cart || cart.lines.length === 0 ? (
            <EmptyState onClose={close} />
          ) : (
            <ul className="flex flex-col gap-4">
              {cart.lines.map((line) => {
                const img = line.merchandise.image;
                const opts = line.merchandise.selectedOptions
                  .filter((o) => o.value !== "Default Title")
                  .map((o) => `${o.name}: ${o.value}`)
                  .join(" · ");
                return (
                  <li
                    key={line.id}
                    className="surface flex gap-3 p-3"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--bg)]">
                      {img && (
                        <Image
                          src={img.url}
                          alt={img.altText ?? line.merchandise.product.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/store/${line.merchandise.product.handle}`}
                          onClick={close}
                          className="line-clamp-2 text-sm font-medium hover:text-[var(--color-brass-bright)]"
                        >
                          {line.merchandise.product.title}
                        </Link>
                        <button
                          type="button"
                          onClick={() => void removeLine(line.id)}
                          aria-label="Remove item"
                          className="text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)]"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {opts && (
                        <p className="mt-1 text-xs text-[var(--fg-dim)]">{opts}</p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <QuantityStepper
                          quantity={line.quantity}
                          disabled={isLoading}
                          onChange={(q) => void updateLine(line.id, q)}
                        />
                        <span className="text-sm font-semibold">
                          {formatMoney(line.cost.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {cart && cart.lines.length > 0 && (
          <footer className="border-t border-[var(--border)] bg-[var(--bg)] px-5 py-4">
            <dl className="mb-3 flex justify-between text-sm">
              <dt className="text-[var(--fg-dim)]">Subtotal</dt>
              <dd className="font-semibold">
                {formatMoney(cart.cost.subtotalAmount)}
              </dd>
            </dl>
            <p className="mb-3 text-xs text-[var(--fg-dim)]">
              Shipping and taxes calculated at checkout.
            </p>
            <Link
              href="/store/checkout"
              onClick={close}
              className="inline-flex w-full items-center justify-center rounded-full bg-[var(--color-brass)] px-6 py-3 text-sm font-semibold tracking-wide text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)]"
            >
              Review &amp; Checkout
            </Link>
          </footer>
        )}
      </aside>
    </>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <ShoppingBag size={40} className="text-[var(--color-brass-dim)]" />
      <p className="text-[var(--fg-dim)]">Your cart is empty.</p>
      <Link
        href="/store"
        onClick={onClose}
        className="mt-2 rounded-full border border-[var(--border-strong)] px-5 py-2 text-sm font-medium text-[var(--color-brass-bright)] hover:bg-[var(--bg-card)]"
      >
        Browse the shop
      </Link>
    </div>
  );
}

function QuantityStepper({
  quantity,
  disabled,
  onChange,
}: {
  quantity: number;
  disabled: boolean;
  onChange: (q: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-card)]">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled}
        onClick={() => onChange(Math.max(0, quantity - 1))}
        className="inline-flex h-7 w-7 items-center justify-center rounded-l-full text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-50"
      >
        <Minus size={12} />
      </button>
      <span className="min-w-[1.5rem] text-center text-xs font-semibold">{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled}
        onClick={() => onChange(quantity + 1)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-r-full text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-50"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
