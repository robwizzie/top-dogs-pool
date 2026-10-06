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
          "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-hidden border-l border-[var(--color-brass)]/20 bg-[color-mix(in_oklab,#0b0d0b_94%,transparent)] shadow-[-40px_0_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.3,1)]",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* lamp light falling on the top of the drawer */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(80%_100%_at_50%_0%,rgba(46,139,87,0.28),transparent_70%)]"
          aria-hidden
        />
        <header className="flex items-center justify-between border-b border-[var(--color-cream)]/[0.07] px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-brass)]/35 bg-[var(--color-brass)]/10 text-[var(--color-brass-bright)]">
              <ShoppingBag size={17} />
            </span>
            <h2 className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide text-[var(--color-cream)]">
              Your Cart
            </h2>
            {cart && cart.totalQuantity > 0 && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-cream)]/70">
                {cart.totalQuantity}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[var(--color-cream)]/70 transition-colors hover:border-[var(--color-brass)]/40 hover:text-[var(--color-brass-bright)]"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!cart || cart.lines.length === 0 ? (
            <EmptyState onClose={close} />
          ) : (
            <ul className="flex flex-col gap-3">
              {cart.lines.map((line) => {
                const img = line.merchandise.image;
                const opts = line.merchandise.selectedOptions
                  .filter((o) => o.value !== "Default Title")
                  .map((o) => `${o.name}: ${o.value}`)
                  .join(" · ");
                return (
                  <li
                    key={line.id}
                    className="surface flex gap-3 p-2.5"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[radial-gradient(90%_70%_at_50%_0%,rgba(46,139,87,0.35),#0b1a13_70%)]">
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
                    <div className="flex min-w-0 flex-1 flex-col py-0.5 pr-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/store/${line.merchandise.product.handle}`}
                          onClick={close}
                          className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-cream)] transition-colors hover:text-[var(--color-brass-bright)]"
                        >
                          {line.merchandise.product.title}
                        </Link>
                        <button
                          type="button"
                          onClick={() => void removeLine(line.id)}
                          aria-label="Remove item"
                          className="-mr-0.5 -mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--color-cream)]/40 transition-colors hover:bg-[var(--color-pop)]/15 hover:text-[var(--color-pop-bright)]"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {opts && (
                        <p className="mt-1 text-xs text-[var(--color-cream)]/50">{opts}</p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <QuantityStepper
                          quantity={line.quantity}
                          disabled={isLoading}
                          onChange={(q) => void updateLine(line.id, q)}
                        />
                        <span className="font-[family-name:var(--font-display)] text-xl leading-none tracking-wide tabular-nums text-[var(--color-brass-bright)]">
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
          <footer className="border-t border-[var(--color-brass)]/20 bg-black/40 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5">
            <dl className="mb-2 flex items-end justify-between">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/55">Subtotal</dt>
              <dd className="pm-foil font-[family-name:var(--font-display)] text-4xl leading-none tracking-wide tabular-nums">
                {formatMoney(cart.cost.subtotalAmount)}
              </dd>
            </dl>
            <p className="mb-4 text-xs text-[var(--color-cream)]/45">
              Shipping and taxes calculated at checkout.
            </p>
            <Link
              href="/store/checkout"
              onClick={close}
              className="pm-btn w-full justify-center"
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
      <span className="relative mb-2 inline-flex h-20 w-20 items-center justify-center rounded-full border border-[var(--color-brass)]/30 bg-[radial-gradient(circle_at_35%_30%,rgba(224,190,107,0.2),rgba(0,0,0,0.3)_70%)] text-[var(--color-brass-bright)] shadow-[0_0_40px_-8px_rgba(201,162,74,0.5)]">
        <ShoppingBag size={30} strokeWidth={1.6} />
      </span>
      <p className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--color-cream)]">Your cart is empty.</p>
      <Link
        href="/store"
        onClick={onClose}
        className="mt-2 rounded-full border border-[var(--color-brass)]/40 bg-black/30 px-5 py-2.5 text-sm font-semibold text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10"
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
    <div className="inline-flex items-center rounded-full border border-white/10 bg-black/30">
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled}
        onClick={() => onChange(Math.max(0, quantity - 1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-l-full text-[var(--color-cream)]/55 transition-colors hover:text-[var(--color-brass-bright)] disabled:opacity-50"
      >
        <Minus size={12} />
      </button>
      <span className="min-w-[1.5rem] text-center text-xs font-semibold tabular-nums text-[var(--color-cream)]">{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled}
        onClick={() => onChange(quantity + 1)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-r-full text-[var(--color-cream)]/55 transition-colors hover:text-[var(--color-brass-bright)] disabled:opacity-50"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
