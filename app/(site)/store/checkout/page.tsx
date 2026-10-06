"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronLeft, Loader2, Lock, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/store/CartProvider";
import { PageHeader } from "@/components/ui/Section";
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
    <>
      <PageHeader
        eyebrow="Step 1 of 2 — Review"
        title="Review your order"
        subtitle="Looks good? Continue to enter shipping and payment on our secure checkout."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/store"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 py-1.5 pl-2.5 pr-3.5 text-xs font-semibold tracking-wide text-[var(--color-cream)]/75 backdrop-blur-sm transition-colors hover:border-[var(--color-brass)]/50 hover:text-[var(--color-brass-bright)]"
          >
            <ChevronLeft size={14} /> Keep shopping
          </Link>
          {/* step tracker */}
          <ol className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em]" aria-label="Checkout steps">
            <li className="inline-flex items-center gap-2 text-[var(--color-brass-bright)]" aria-current="step">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(180deg,#f0d48a,#c9a24a_55%,#b38b36)] text-[11px] text-[var(--color-ink)] shadow-[0_0_14px_-2px_rgba(201,162,74,0.7)]">1</span>
              Review
            </li>
            <li className="h-px w-6 bg-gradient-to-r from-[var(--color-brass)]/60 to-white/10" aria-hidden />
            <li className="inline-flex items-center gap-2 text-[var(--color-cream)]/45">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-[11px]">2</span>
              Payment
            </li>
          </ol>
        </div>
      </PageHeader>

    <div className="mx-auto max-w-6xl px-4 pb-14 pt-2 sm:px-6 sm:pb-20 lg:px-8">

      {isEmpty ? (
        <EmptyCheckout />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
          <section className="flex flex-col gap-3">
            {cart.lines.map((line) => {
              const img = line.merchandise.image;
              const opts = line.merchandise.selectedOptions
                .filter((o) => o.value !== "Default Title")
                .map((o) => `${o.name}: ${o.value}`)
                .join(" · ");
              return (
                <article key={line.id} className="surface flex gap-4 p-3 sm:p-4">
                  <Link
                    href={`/store/${line.merchandise.product.handle}`}
                    className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[radial-gradient(90%_70%_at_50%_0%,rgba(46,139,87,0.35),#0b1a13_70%)] sm:h-28 sm:w-28"
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
                          className="line-clamp-2 font-semibold leading-snug text-[var(--color-cream)] transition-colors hover:text-[var(--color-brass-bright)]"
                        >
                          {line.merchandise.product.title}
                        </Link>
                        {opts && (
                          <p className="mt-1 text-xs text-[var(--color-cream)]/55">{opts}</p>
                        )}
                        <p className="mt-1 text-xs tabular-nums text-[var(--color-cream)]/40">
                          {formatMoney(line.merchandise.price)} each
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeLine(line.id)}
                        disabled={isLoading}
                        aria-label="Remove item"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-cream)]/40 transition-colors hover:bg-[var(--color-pop)]/15 hover:text-[var(--color-pop-bright)] disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="inline-flex items-center rounded-full border border-white/10 bg-black/30">
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
                      <span className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide tabular-nums text-[var(--color-brass-bright)]">
                        {formatMoney(line.cost.totalAmount)}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-24">
            <div className="pm-glass relative overflow-hidden p-5 sm:p-6">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(80%_100%_at_50%_0%,rgba(46,139,87,0.25),transparent_70%)]"
                aria-hidden
              />
              <h2 className="relative font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide text-[var(--color-cream)]">
                Order summary
              </h2>

              <form onSubmit={onApply} className="relative mt-5 flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Discount code"
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/35 px-4 py-2.5 text-sm text-[var(--color-cream)] shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)] transition-[border-color,box-shadow] placeholder:text-[var(--color-cream)]/35 focus:border-[var(--color-brass)]/60 focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.4),0_0_0_3px_rgba(201,162,74,0.15)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isLoading || !code.trim()}
                  className="rounded-full border border-[var(--color-brass)]/40 bg-black/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/10 disabled:opacity-50"
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
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-felt-bright)]/40 bg-[var(--color-felt)]/60 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-cream)]"
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

              <dl className="relative mt-6 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-cream)]/55">Subtotal</dt>
                  <dd className="tabular-nums text-[var(--color-cream)]">{formatMoney(cart.cost.subtotalAmount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-cream)]/55">Shipping</dt>
                  <dd className="text-[var(--color-cream)]/45">Calculated at next step</dd>
                </div>
                {cart.cost.totalTaxAmount && (
                  <div className="flex justify-between">
                    <dt className="text-[var(--color-cream)]/55">Tax (est.)</dt>
                    <dd className="tabular-nums text-[var(--color-cream)]">{formatMoney(cart.cost.totalTaxAmount)}</dd>
                  </div>
                )}
                <div className="pm-rule !mt-4" aria-hidden />
                <div className="flex items-end justify-between pt-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-cream)]/60">Total</dt>
                  <dd className="pm-foil font-[family-name:var(--font-display)] text-5xl leading-none tracking-wide tabular-nums">
                    {formatMoney(cart.cost.totalAmount)}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={onContinue}
                disabled={continueLoading || !cart.checkoutUrl}
                className="pm-btn relative mt-6 w-full justify-center disabled:opacity-60"
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
              <p className="relative mt-3 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-cream)]/40">
                <Lock size={11} /> Secured by Shopify
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
    </>
  );
}

function EmptyCheckout() {
  return (
    <div className="pm-glass pm-grain relative mx-auto flex max-w-3xl flex-col items-center gap-3 overflow-hidden px-6 py-14 text-center sm:py-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(60%_80%_at_50%_0%,rgba(46,139,87,0.28),transparent_70%)]"
        aria-hidden
      />
      <span className="relative z-[2] mb-3 inline-flex h-20 w-20 items-center justify-center rounded-full border border-[var(--color-brass)]/30 bg-[radial-gradient(circle_at_35%_30%,rgba(224,190,107,0.22),rgba(0,0,0,0.3)_70%)] text-[var(--color-brass-bright)] shadow-[0_0_40px_-8px_rgba(201,162,74,0.55)]">
        <ShoppingBag size={30} strokeWidth={1.6} />
      </span>
      <h2 className="relative z-[2] font-[family-name:var(--font-display)] text-4xl tracking-wide text-[var(--color-cream)] sm:text-5xl">
        Your cart is empty
      </h2>
      <p className="relative z-[2] text-sm text-[var(--color-cream)]/60 sm:text-base">
        Add some gear before heading to checkout.
      </p>
      <Link href="/store" className="pm-btn group relative z-[2] mt-4">
        Shop the rack
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
