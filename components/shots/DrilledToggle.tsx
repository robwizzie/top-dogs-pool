"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useDrilled } from "@/lib/kinister/useDrilled";
import { cn } from "@/lib/utils";

export function DrilledToggle({ shotId }: { shotId: string }) {
  const { has, toggle } = useDrilled();
  const drilled = has(shotId);
  return (
    <button
      type="button"
      onClick={() => toggle(shotId)}
      aria-pressed={drilled}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.2em] backdrop-blur-sm transition-colors",
        drilled
          ? "border-[var(--color-felt-bright)]/60 bg-[var(--color-felt-bright)]/20 text-[#7ad6a0] shadow-[0_0_20px_-6px_rgba(46,139,87,0.9)]"
          : "border-white/10 bg-black/30 text-[var(--color-cream)]/70 hover:border-[var(--color-cream)]/25 hover:text-[var(--color-cream)]",
      )}
    >
      {drilled ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      {drilled ? "Drilled" : "Mark as drilled"}
    </button>
  );
}
