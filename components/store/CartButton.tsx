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
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-dim)] transition-colors hover:text-[var(--color-brass-bright)]",
        className,
      )}
    >
      <ShoppingBag size={16} />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-brass)] px-1 text-[10px] font-bold text-[var(--color-ink)]">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
