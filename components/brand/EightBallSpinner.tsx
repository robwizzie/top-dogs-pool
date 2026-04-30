import { PoolBall } from "./PoolBall";
import { cn } from "@/lib/utils";

export function EightBallSpinner({
  size = 32,
  className,
  label = "Loading",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 text-[var(--fg-dim)]", className)}
    >
      <PoolBall number={8} size={size} spin />
      <span className="text-sm">{label}…</span>
    </span>
  );
}
