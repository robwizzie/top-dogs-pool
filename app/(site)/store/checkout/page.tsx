"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Loader2, Lock, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/store/CartProvider";
import { formatMoney } from "@/lib/shopify";

export default function CheckoutPage() {
  const {
    cart,
    isLoading,
    updateLine,
    removeLine,
    applyDiscount,
    clearDiscounts,
  } = useCart();

  const [code, setCode] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [continueLoading, setContinueLoading] = useState(false);

  async function onApply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setDiscountError(null);
    try {
      await applyDiscount(code.trim());
      setCode("");
    } catch (err) {
      setDiscountError(err instanceof Error ? err.message : "Couldn't apply that code.");
    }
  }

  function onContinue() {
    if (!cart?.checkoutUrl) return;
    setContinueLoading(true);
    window.location.href = cart.checkoutUrl;
  }

  const isEmpty = !cart || cart.lines.length === 0;
  const appliedDiscounts = cart?.discountCodes.filter((d) => d.applicable) ?? [];
  const rejectedDiscounts = cart?.discountCodes.filter((d) => !d.applicable) ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Link
        href="/store"
        className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--fg-dim)] hover:text-[var(--color-brass-bright)]"
      >
        <ChevronLeft size={14} /> Keep shopping
      </Link>

      <header className="mb-8">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          Step 1 of 2 — Review
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-5xl">
          Review your order
        </h1>
        <p className="mt-2 text-sm text-[var(--fg-dim)]">
          Looks good? Continue to enter shipping and payment on our secure checkout.
        </p>
      </header>

      {isEmpty ? (
        <EmptyCheckout />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="flex flex-col gap-3">
            {cart.lines.map((line) => {
              const img = line.merchandise.image;
              const opts = line.merchandise.selectedOptions
                .filter((o) => o.value !== "Default Title")
                .map((o) => `${o.name}: ${o.value}`)
                .join(" · ");
              return (
                <article key={line.id} className="surface flex gap-4 p-4">
                  <Link
                    href={`/store/${line.merchandise.product.handle}`}
                    className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--bg)]"
                  >
                    {img && (
                      <Image
                        src={img.url}
                        alt={img.altText ?? line.merchandise.product.title}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/store/${line.merchandise.product.handle}`}
                          className="line-clamp-2 font-medium hover:text-[var(--color-brass-bright)]"
                        >
                          {line.merchandise.product.title}
                        </Link>
                        {opts && (
                          <p className="mt-1 text-xs text-[var(--fg-dim)]">{opts}</p>
                        )}
                        <p className="mt-1 text-xs text-[var(--fg-dim)]">
                          {formatMoney(line.merchandise.price)} each
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeLine(line.id)}
                        disabled={isLoading}
                        aria-label="Remove item"
                        className="text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)] disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-card)]">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          disabled={isLoading}
                          onClick={() => void updateLine(line.id, Math.max(0, line.quantity - 1))}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-l-full text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-50"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-[2rem] text-center text-sm font-semibold">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          disabled={isLoading}
                          onClick={() => void updateLine(line.id, line.quantity + 1)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-r-full text-[var(--fg-dim)] hover:text-[var(--fg)] disabled:opacity-50"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="font-semibold">
                        {formatMoney(line.cost.totalAmount)}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-24">
            <div className="surface p-5">
              <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
                Order summary
              </h2>

              <form onSubmit={onApply} className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Discount code"
                  className="flex-1 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 py-2 text-sm placeholder:text-[var(--fg-dim)] focus:border-[var(--border-strong)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isLoading || !code.trim()}
                  className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--bg-card)] disabled:opacity-50"
                >
                  Apply
                </button>
              </form>
              {discountError && (
                <p className="mt-2 text-xs text-[var(--color-pop-bright)]">{discountError}</p>
              )}
              {appliedDiscounts.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {appliedDiscounts.map((d) => (
                    <span
                      key={d.code}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--color-felt)] px-3 py-1 text-xs font-semibold text-[var(--color-cream)]"
                    >
                      {d.code}
                      <button
                        type="button"
                        onClick={() => void clearDiscounts()}
                        aria-label="Remove discount"
                        className="opacity-70 hover:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {rejectedDiscounts.length > 0 && (
                <p className="mt-2 text-xs text-[var(--color-pop-bright)]">
                  Couldn&rsquo;t apply: {rejectedDiscounts.map((d) => d.code).join(", ")}
                </p>
              )}

              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-dim)]">Subtotal</dt>
                  <dd>{formatMoney(cart.cost.subtotalAmount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-dim)]">Shipping</dt>
                  <dd className="text-[var(--fg-dim)]">Calculated at next step</dd>
                </div>
                {cart.cost.totalTaxAmount && (
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-dim)]">Tax (est.)</dt>
                    <dd>{formatMoney(cart.cost.totalTaxAmount)}</dd>
                  </div>
                )}
                <div className="border-t border-[var(--border)] pt-3" />
                <div className="flex justify-between text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--color-brass-bright)]">
                    {formatMoney(cart.cost.totalAmount)}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={onContinue}
                disabled={continueLoading || !cart.checkoutUrl}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brass)] px-6 py-3 text-sm font-semibold tracking-wide text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brass-bright)] disabled:opacity-60"
              >
                {continueLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Opening checkout…
                  </>
                ) : (
                  <>
                    <Lock size={14} /> Continue to payment
                  </>
                )}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[var(--fg-dim)]">
                <Lock size={11} /> Secured by Shopify
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function EmptyCheckout() {
  return (
    <div className="surface flex flex-col items-center gap-3 p-12 text-center">
      <ShoppingBag size={40} className="text-[var(--color-brass-dim)]" />
      <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
        Your cart is empty
      </h2>
      <p className="text-sm text-[var(--fg-dim)]">
        Add some gear before heading to checkout.
      </p>
      <Link
        href="/store"
        className="mt-2 rounded-full bg-[var(--color-brass)] px-6 py-2.5 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-brass-bright)]"
      >
        Shop the rack
      </Link>
    </div>
  );
}
