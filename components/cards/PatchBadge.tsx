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
  | "first-win"
  | "mvp";

const PATCHES: Record<
  PatchKind,
  {
    src: string;
    label: string;
    tint: string;
    tintRgb: string;
    /** Leaderboard point value per patch earned. */
    pointEach: number;
  }
> = {
  sweep: {
    src: "/patches/sweep.png",
    label: "Sweep",
    tint: "var(--color-pop-bright)",
    tintRgb: "232, 82, 72",
    pointEach: 1,
  },
  "mini-sweep": {
    src: "/patches/mini-sweep.png",
    label: "Mini Sweep",
    tint: "var(--color-brass-bright)",
    tintRgb: "224, 190, 107",
    pointEach: 0.5,
  },
  "break-and-run": {
    src: "/patches/break-and-run.png",
    label: "Break & Run",
    tint: "var(--color-felt-bright)",
    tintRgb: "46, 139, 87",
    pointEach: 1,
  },
  "8-on-break": {
    src: "/patches/8-on-break.png",
    label: "8 on the Break",
    tint: "var(--color-cream)",
    tintRgb: "236, 225, 196",
    pointEach: 1,
  },
  "level-up": {
    src: "/patches/level-up.png",
    label: "Level Up",
    tint: "var(--color-tie-bright)",
    tintRgb: "244, 196, 83",
    pointEach: 1,
  },
  "first-win": {
    src: "/patches/first-win.png",
    label: "First Win",
    tint: "var(--color-six-ball)",
    tintRgb: "31, 110, 61",
    pointEach: 1,
  },
  mvp: {
    src: "/patches/mvp.svg",
    label: "Session MVP",
    tint: "#4ca0d8",
    tintRgb: "76, 160, 216",
    pointEach: 1,
  },
};

/** Formats `points` as "1 pt" / "0.5 pt" / "3 pts" without trailing zeros. */
function formatPoints(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  const display = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
  return `${display} ${rounded === 1 ? "pt" : "pts"}`;
}

export function patchLabel(kind: PatchKind): string {
  return PATCHES[kind].label;
}

export function patchPointEach(kind: PatchKind): number {
  return PATCHES[kind].pointEach;
}

const SIZES = {
  xs: { box: 36, image: 34 },
  sm: { box: 44, image: 40 },
  md: { box: 56, image: 52 },
  lg: { box: 76, image: 72 },
} as const;

type Size = keyof typeof SIZES;

/**
 * Wraps children in a clickable region that opens the patch lightbox.
 * Handles keyboard + escape + body-scroll-lock + portal mount. Reused by
 * both the standalone badge and the showcase tile so the entire tile is
 * clickable on the profile page (not just the patch image inside it).
 */
type TriggerElementType = "span" | "div";

function PatchLightboxTrigger({
  kind,
  count,
  instances,
  className,
  ariaLabel,
  children,
  style,
  as = "span",
  dataAttrs,
}: {
  kind: PatchKind;
  count: number;
  instances?: PatchInstance[];
  className?: string;
  ariaLabel: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  as?: TriggerElementType;
  dataAttrs?: Record<string, string>;
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

  const trigger = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const Element = as as "span";
  return (
    <>
      <Element
        className={className}
        role="button"
        tabIndex={0}
        title={`${ariaLabel} · tap to enlarge`}
        aria-label={`${ariaLabel}. Tap to enlarge.`}
        onClick={trigger}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") trigger(e);
        }}
        style={style}
        {...(dataAttrs ?? {})}
      >
        {children}
      </Element>
      {mounted &&
        open &&
        createPortal(
          <PatchLightbox
            kind={kind}
            count={count}
            instances={instances}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

/**
 * Embroidered patch trophy. Renders the patch art with a brass-rimmed
 * quantity bubble in the corner whenever the player has earned more than
 * one. By default the badge itself is the click target; pass
 * `interactive={false}` when an ancestor handles the click (e.g. inside
 * PatchShowcase, where the entire tile is clickable).
 */
export function PatchBadge({
  kind,
  count,
  size = "sm",
  instances,
  interactive = true,
  className,
}: {
  kind: PatchKind;
  count: number;
  size?: Size;
  /** Optional list of where this patch was earned. Renders in the lightbox. */
  instances?: PatchInstance[];
  /** When false, the badge is visual-only and an ancestor must provide the click. */
  interactive?: boolean;
  className?: string;
}) {
  if (count <= 0) return null;
  const patch = PATCHES[kind];
  const dims = SIZES[size];
  const totalPoints = count * patch.pointEach;
  const aria = `${count} ${patch.label} patch${count === 1 ? "" : "es"} earned · ${formatPoints(totalPoints)}`;

  const visual = (
    <>
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
    </>
  );

  const style = {
    width: dims.box,
    height: dims.box,
    "--patch-tint": patch.tint,
    "--patch-tint-rgb": patch.tintRgb,
  } as React.CSSProperties;

  if (!interactive) {
    return (
      <span
        className={cn("patch-badge patch-badge-static", className)}
        data-kind={kind}
        data-size={size}
        aria-label={aria}
        style={style}
      >
        {visual}
      </span>
    );
  }

  return (
    <PatchLightboxTrigger
      kind={kind}
      count={count}
      instances={instances}
      className={cn("patch-badge", className)}
      ariaLabel={aria}
      style={style}
      dataAttrs={{ "data-kind": kind, "data-size": size }}
    >
      {visual}
    </PatchLightboxTrigger>
  );
}

function PatchLightbox({
  kind,
  count,
  instances,
  onClose,
}: {
  kind: PatchKind;
  count: number;
  instances?: PatchInstance[];
  onClose: () => void;
}) {
  const patch = PATCHES[kind];
  const totalPoints = count * patch.pointEach;
  const eachLabel = formatPoints(patch.pointEach);
  const totalLabel = formatPoints(totalPoints);
  return (
    <div
      className="patch-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${patch.label} patch · earned ${count} · ${totalLabel}`}
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
          <span className="patch-lightbox-label-worth">{eachLabel} each</span>
          <span className="patch-lightbox-label-count">
            Earned {count} time{count === 1 ? "" : "s"} ·{" "}
            <span className="patch-lightbox-label-total">{totalLabel} total</span>
          </span>
        </p>
        {instances && instances.length > 0 && (
          <div className="patch-lightbox-instances">
            <p className="patch-lightbox-instances-heading">Earned in</p>
            <ul>
              {instances.map((inst, i) => {
                const body = (
                  <>
                    <span className="patch-lightbox-instance-label">
                      {inst.label}
                    </span>
                    {inst.score && (
                      <span className="patch-lightbox-instance-score">
                        {inst.score}
                      </span>
                    )}
                    {inst.sublabel && (
                      <span className="patch-lightbox-instance-sublabel">
                        {inst.sublabel}
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={`${inst.matchId ?? "i"}-${i}`}>
                    {inst.matchId ? (
                      <a
                        href={`/matches/${inst.matchId}`}
                        className="patch-lightbox-instance-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {body}
                      </a>
                    ) : (
                      <span className="patch-lightbox-instance-link">{body}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export type PatchInstance = {
  /** Match this instance was earned in. For MVP, this is the session-end
   *  attribution and `matchId` may be null. */
  matchId?: string;
  /** ISO date for sorting / display. */
  date?: string;
  /** Display label — "vs Foo" for matches, "Spring 2025" for MVP. */
  label: string;
  /** Optional score (e.g. "3-0") shown next to the match label. */
  score?: string;
  /** Optional sub-label like "Eight Men Out · SL3 → SL4" for level-ups. */
  sublabel?: string;
};

/**
 * A trophy-wall showcase for the player profile page. Each earned patch
 * sits in its own tile with the patch art, its full label, and the point
 * total the player has banked from it. Renders nothing when the player has
 * earned no patches at all in the current scope.
 */
export function PatchShowcase({
  sweeps,
  miniSweeps,
  breakAndRuns,
  eightOnBreaks,
  levelUps,
  firstWin,
  mvp,
  instances,
  className,
}: {
  sweeps: number;
  miniSweeps: number;
  breakAndRuns: number;
  eightOnBreaks: number;
  levelUps: number;
  firstWin: number;
  mvp: number;
  instances?: Partial<Record<PatchKind, PatchInstance[]>>;
  className?: string;
}) {
  const items: { kind: PatchKind; count: number }[] = (
    [
      { kind: "sweep", count: sweeps },
      { kind: "mini-sweep", count: miniSweeps },
      { kind: "break-and-run", count: breakAndRuns },
      { kind: "8-on-break", count: eightOnBreaks },
      { kind: "level-up", count: levelUps },
      { kind: "first-win", count: firstWin },
      { kind: "mvp", count: mvp },
    ] as const
  )
    .map((i) => ({ kind: i.kind as PatchKind, count: i.count }))
    .filter((i) => i.count > 0);

  if (items.length === 0) return null;

  return (
    <div className={cn("patch-showcase", className)}>
      {items.map((item) => {
        const patch = PATCHES[item.kind];
        const total = item.count * patch.pointEach;
        const ariaLabel = `${item.count} ${patch.label} patch${item.count === 1 ? "" : "es"} · ${formatPoints(total)}`;
        return (
          <PatchLightboxTrigger
            key={item.kind}
            kind={item.kind}
            count={item.count}
            instances={instances?.[item.kind]}
            className="patch-showcase-tile"
            ariaLabel={ariaLabel}
            as="div"
            dataAttrs={{ "data-kind": item.kind }}
          >
            <PatchBadge
              kind={item.kind}
              count={item.count}
              size="md"
              interactive={false}
            />
            <div className="patch-showcase-meta">
              <span className="patch-showcase-label">{patch.label}</span>
              <span className="patch-showcase-worth">
                {formatPoints(patch.pointEach)} each
              </span>
              <span className="patch-showcase-total">{formatPoints(total)}</span>
            </div>
          </PatchLightboxTrigger>
        );
      })}
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
  mvp,
  instances,
  size = "sm",
  className,
}: {
  sweeps: number;
  miniSweeps: number;
  breakAndRuns?: number;
  eightOnBreaks?: number;
  levelUps?: number;
  firstWin?: number;
  mvp?: number;
  instances?: Partial<Record<PatchKind, PatchInstance[]>>;
  size?: Size;
  className?: string;
}) {
  const br = breakAndRuns ?? 0;
  const ob = eightOnBreaks ?? 0;
  const lu = levelUps ?? 0;
  const fw = firstWin ?? 0;
  const mv = mvp ?? 0;
  if (
    sweeps <= 0 &&
    miniSweeps <= 0 &&
    br <= 0 &&
    ob <= 0 &&
    lu <= 0 &&
    fw <= 0 &&
    mv <= 0
  )
    return null;
  return (
    <div className={cn("patch-strip", className)} data-size={size}>
      <PatchBadge kind="sweep" count={sweeps} size={size} instances={instances?.sweep} />
      <PatchBadge kind="mini-sweep" count={miniSweeps} size={size} instances={instances?.["mini-sweep"]} />
      <PatchBadge kind="break-and-run" count={br} size={size} instances={instances?.["break-and-run"]} />
      <PatchBadge kind="8-on-break" count={ob} size={size} instances={instances?.["8-on-break"]} />
      <PatchBadge kind="level-up" count={lu} size={size} instances={instances?.["level-up"]} />
      <PatchBadge kind="first-win" count={fw} size={size} instances={instances?.["first-win"]} />
      <PatchBadge kind="mvp" count={mv} size={size} instances={instances?.mvp} />
    </div>
  );
}
