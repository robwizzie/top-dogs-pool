"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type PatchKind =
  | "sweep"
  | "mini-sweep"
  | "break-and-run"
  | "8-on-break"
  | "level-up"
  | "first-win";

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
  "break-and-run": {
    src: "/patches/break-and-run.png",
    label: "Break & Run",
    tint: "var(--color-felt-bright)",
    tintRgb: "46, 139, 87",
  },
  "8-on-break": {
    src: "/patches/8-on-break.png",
    label: "8 on the Break",
    tint: "var(--color-cream)",
    tintRgb: "236, 225, 196",
  },
  "level-up": {
    src: "/patches/level-up.png",
    label: "Level Up",
    tint: "var(--color-tie-bright)",
    tintRgb: "244, 196, 83",
  },
  "first-win": {
    src: "/patches/first-win.png",
    label: "First Win",
    tint: "var(--color-six-ball)",
    tintRgb: "31, 110, 61",
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
 * one. Clicking opens a full-screen lightbox so the embroidery detail is
 * easy to read. Falls back silently to nothing when count is 0 so callers
 * can sprinkle these in lists without guards.
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
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (count <= 0) return null;
  const patch = PATCHES[kind];
  const dims = SIZES[size];
  const aria = `${count} ${patch.label} patch${count === 1 ? "" : "es"} earned`;

  const trigger = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <span
        className={cn("patch-badge", className)}
        data-kind={kind}
        data-size={size}
        role="button"
        tabIndex={0}
        title={`${aria} · tap to enlarge`}
        aria-label={`${aria}. Tap to enlarge.`}
        onClick={trigger}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") trigger(e);
        }}
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
      {mounted &&
        open &&
        createPortal(
          <PatchLightbox
            kind={kind}
            count={count}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

function PatchLightbox({
  kind,
  count,
  onClose,
}: {
  kind: PatchKind;
  count: number;
  onClose: () => void;
}) {
  const patch = PATCHES[kind];
  return (
    <div
      className="patch-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${patch.label} patch · earned ${count}`}
      onClick={onClose}
      style={
        {
          "--patch-tint": patch.tint,
          "--patch-tint-rgb": patch.tintRgb,
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        className="patch-lightbox-close"
        onClick={onClose}
        aria-label="Close"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <div
        className="patch-lightbox-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="patch-lightbox-frame" data-kind={kind}>
          <Image
            src={patch.src}
            alt={`${patch.label} patch`}
            width={720}
            height={720}
            className="patch-lightbox-image"
            priority
          />
          {count > 1 && (
            <span className="patch-lightbox-count" aria-hidden>
              ×{count}
            </span>
          )}
        </div>
        <p className="patch-lightbox-label">
          <span className="patch-lightbox-label-kind">{patch.label}</span>
          <span className="patch-lightbox-label-count">
            Earned {count} time{count === 1 ? "" : "s"}
          </span>
        </p>
      </div>
    </div>
  );
}

/**
 * A horizontal display of every patch a player has earned. Empty if they
 * have none. Used on the leaderboard row and the player card back.
 */
export function PatchTrophyStrip({
  sweeps,
  miniSweeps,
  breakAndRuns,
  eightOnBreaks,
  levelUps,
  firstWin,
  size = "sm",
  className,
}: {
  sweeps: number;
  miniSweeps: number;
  breakAndRuns?: number;
  eightOnBreaks?: number;
  levelUps?: number;
  firstWin?: number;
  size?: Size;
  className?: string;
}) {
  const br = breakAndRuns ?? 0;
  const ob = eightOnBreaks ?? 0;
  const lu = levelUps ?? 0;
  const fw = firstWin ?? 0;
  if (
    sweeps <= 0 &&
    miniSweeps <= 0 &&
    br <= 0 &&
    ob <= 0 &&
    lu <= 0 &&
    fw <= 0
  )
    return null;
  return (
    <div className={cn("patch-strip", className)} data-size={size}>
      <PatchBadge kind="sweep" count={sweeps} size={size} />
      <PatchBadge kind="mini-sweep" count={miniSweeps} size={size} />
      <PatchBadge kind="break-and-run" count={br} size={size} />
      <PatchBadge kind="8-on-break" count={ob} size={size} />
      <PatchBadge kind="level-up" count={lu} size={size} />
      <PatchBadge kind="first-win" count={fw} size={size} />
    </div>
  );
}
