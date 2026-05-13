import Image from "next/image";
import { cn } from "@/lib/utils";

export type PatchKind = "sweep" | "mini-sweep";

const PATCHES: Record<
  PatchKind,
  { src: string; label: string; tint: string; tintRgb: string }
> = {
  sweep: {
    src: "/patches/sweep.png",
    label: "Sweep",
    tint: "var(--color-pop-bright)",
    tintRgb: "232, 82, 72",
  },
  "mini-sweep": {
    src: "/patches/mini-sweep.png",
    label: "Mini Sweep",
    tint: "var(--color-brass-bright)",
    tintRgb: "224, 190, 107",
  },
};

const SIZES = {
  xs: { box: 36, image: 34 },
  sm: { box: 44, image: 40 },
  md: { box: 56, image: 52 },
  lg: { box: 76, image: 72 },
} as const;

type Size = keyof typeof SIZES;

/**
 * Embroidered patch trophy. Renders the patch art with a brass-rimmed
 * quantity bubble in the corner whenever the player has earned more than
 * one. Falls back silently to nothing when count is 0 so callers can sprinkle
 * these in lists without guards.
 */
export function PatchBadge({
  kind,
  count,
  size = "sm",
  className,
}: {
  kind: PatchKind;
  count: number;
  size?: Size;
  className?: string;
}) {
  if (count <= 0) return null;
  const patch = PATCHES[kind];
  const dims = SIZES[size];
  const aria = `${count} ${patch.label} patch${count === 1 ? "" : "es"} earned`;
  return (
    <span
      className={cn("patch-badge", className)}
      data-kind={kind}
      data-size={size}
      title={aria}
      aria-label={aria}
      style={
        {
          width: dims.box,
          height: dims.box,
          "--patch-tint": patch.tint,
          "--patch-tint-rgb": patch.tintRgb,
        } as React.CSSProperties
      }
    >
      <Image
        src={patch.src}
        alt=""
        width={dims.image}
        height={dims.image}
        className="patch-badge-image"
      />
      {count > 1 && (
        <span className="patch-badge-count" aria-hidden>
          ×{count}
        </span>
      )}
    </span>
  );
}

/**
 * A horizontal display of all patch types a player has earned. Empty if the
 * player has no sweeps or mini-sweeps. Used on the leaderboard row and the
 * player card back.
 */
export function PatchTrophyStrip({
  sweeps,
  miniSweeps,
  size = "sm",
  className,
}: {
  sweeps: number;
  miniSweeps: number;
  size?: Size;
  className?: string;
}) {
  if (sweeps <= 0 && miniSweeps <= 0) return null;
  return (
    <div className={cn("patch-strip", className)} data-size={size}>
      <PatchBadge kind="sweep" count={sweeps} size={size} />
      <PatchBadge kind="mini-sweep" count={miniSweeps} size={size} />
    </div>
  );
}
