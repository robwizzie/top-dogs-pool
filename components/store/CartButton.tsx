"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/store/CartProvider";
import { cn } from "@/lib/utils";

export function CartButton({ className }: { className?: string }) {
  const { cart, open } = useCart();
  const count = cart?.totalQuantity ?? 0;
  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Open cart (${count} item${count === 1 ? "" : "s"})`}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[var(--color-cream)] transition-colors hover:border-[var(--color-brass)]/40 hover:bg-[var(--color-brass)]/10 hover:text-[var(--color-brass-bright)]",
        className,
      )}
    >
      <ShoppingBag size={16} />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[linear-gradient(180deg,#f0d48a,#c9a24a_60%,#b38b36)] px-1 text-[10px] font-bold tabular-nums text-[var(--color-ink)] shadow-[0_0_0_2px_#0b0d0b,0_4px_12px_-2px_rgba(201,162,74,0.7)]">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
