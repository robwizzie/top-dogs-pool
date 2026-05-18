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
        "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold tracking-wide transition-colors",
        drilled
          ? "border-[var(--color-felt-bright)]/50 bg-[var(--color-felt-deep)]/60 text-[var(--color-felt-bright)]"
          : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-dim)] hover:text-[var(--fg)]",
      )}
    >
      {drilled ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      {drilled ? "Drilled" : "Mark as drilled"}
    </button>
  );
}
