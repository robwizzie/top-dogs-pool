"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

/**
 * Rack Up's own UI kit.
 *
 * Deliberately not the site's felt-and-brass components: Rack Up is a separate
 * app that lives inside Poolmaxxing, and it keeps the identity the original
 * had — chalk blue, coral, gold, warm surfaces, chunky display type.
 *
 * It is also not the original's ~50 shadcn components. This is the dozen
 * pieces a scoreboard, a form and a bracket actually need, which is what
 * makes it possible to keep them consistent.
 *
 * Everything reads `--rack-*` tokens from app/rack/rack.css, so light and
 * dark both work without a single conditional in component code.
 */

/* ------------------------------------------------------------------ Brand */

export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <span
      className={cn(
        "rack-wordmark select-none",
        size === "sm" && "text-xl",
        size === "md" && "text-3xl",
        size === "lg" && "text-5xl",
        size === "xl" && "text-6xl sm:text-7xl",
        className,
      )}
    >
      <span className="rack-wordmark-rack">Rack</span>
      <span className="rack-wordmark-up">Up</span>
    </span>
  );
}

/** The retro badge — 8-ball in a rack, crossed cues. */
export function RackLogo({
  size = 40,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/rack/logo-256.png"
      alt=""
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/* ---------------------------------------------------------------- Buttons */

export type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "ghost"
  | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 font-semibold transition",
        "font-[family-name:var(--rack-font-heading)]",
        "active:translate-y-px disabled:pointer-events-none disabled:opacity-40",
        "rounded-[var(--rack-radius)]",
        size === "sm" && "min-h-9 px-3 text-xs",
        size === "md" && "min-h-11 px-4 text-sm",
        size === "lg" && "min-h-14 px-6 text-base",
        variant === "primary" &&
          "bg-[hsl(var(--rack-primary))] text-[hsl(var(--rack-primary-fg))] shadow-[var(--rack-shadow-sm)] hover:bg-[hsl(var(--rack-primary-hover))] hover:shadow-[var(--rack-shadow-md)]",
        variant === "accent" &&
          "bg-[hsl(var(--rack-accent))] text-[hsl(var(--rack-accent-fg))] shadow-[var(--rack-shadow-sm)] hover:brightness-110 hover:shadow-[var(--rack-shadow-md)]",
        variant === "secondary" &&
          "border border-[hsl(var(--rack-border-strong))] bg-[hsl(var(--rack-surface))] text-[hsl(var(--rack-fg))] hover:border-[hsl(var(--rack-primary))] hover:bg-[hsl(var(--rack-surface-raised))]",
        variant === "ghost" &&
          "text-[hsl(var(--rack-fg-muted))] hover:bg-[hsl(var(--rack-fg)/0.06)] hover:text-[hsl(var(--rack-fg))]",
        variant === "danger" &&
          "border border-[hsl(var(--rack-danger)/0.5)] bg-[hsl(var(--rack-danger)/0.12)] text-[hsl(var(--rack-danger))] hover:bg-[hsl(var(--rack-danger)/0.2)]",
        className,
      )}
    />
  );
}

/* ---------------------------------------------------------------- Surfaces */

export function Card({
  children,
  className,
  raised = false,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--rack-radius-lg)] border border-[hsl(var(--rack-border))] p-4 sm:p-6",
        raised
          ? "bg-[hsl(var(--rack-surface-raised))] shadow-[var(--rack-shadow-lg)]"
          : "bg-[hsl(var(--rack-surface))] shadow-[var(--rack-shadow-md)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-center justify-between gap-2", className)}>
      <h2 className="font-[family-name:var(--rack-font-heading)] text-xl font-bold tracking-tight">
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Forms */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-[family-name:var(--rack-font-heading)] text-xs font-bold uppercase tracking-wider text-[hsl(var(--rack-fg-muted))]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs text-[hsl(var(--rack-fg-muted))]">{hint}</span>
      )}
    </label>
  );
}

const controlClass =
  "min-h-11 w-full rounded-[var(--rack-radius)] border border-[hsl(var(--rack-border-strong))] bg-[hsl(var(--rack-bg))] px-3 text-[hsl(var(--rack-fg))] placeholder:text-[hsl(var(--rack-fg-muted))] focus:border-[hsl(var(--rack-primary))] focus:outline-none";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, className)} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(controlClass, className)}>
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ Bits */

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "accent" | "hot" | "win";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        "font-[family-name:var(--rack-font-heading)]",
        tone === "neutral" &&
          "bg-[hsl(var(--rack-fg)/0.07)] text-[hsl(var(--rack-fg-muted))]",
        tone === "primary" &&
          "bg-[hsl(var(--rack-primary)/0.15)] text-[hsl(var(--rack-primary))]",
        tone === "accent" &&
          "bg-[hsl(var(--rack-accent)/0.18)] text-[hsl(var(--rack-accent))]",
        tone === "hot" &&
          "bg-[hsl(var(--rack-secondary)/0.18)] text-[hsl(var(--rack-secondary))]",
        tone === "win" &&
          "bg-[hsl(var(--rack-success)/0.18)] text-[hsl(var(--rack-success))]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  url,
  size = 40,
  className,
  ring = false,
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-[hsl(var(--rack-primary))] font-[family-name:var(--rack-font-heading)] font-bold text-[hsl(var(--rack-primary-fg))]",
        ring && "ring-2 ring-[hsl(var(--rack-accent))] ring-offset-2 ring-offset-[hsl(var(--rack-surface))]",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {url ? (
        // Avatars come from Supabase storage and APA at arbitrary sizes;
        // next/image would need every host allow-listed for no gain here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-[var(--rack-radius)] border border-[hsl(var(--rack-danger)/0.4)] bg-[hsl(var(--rack-danger)/0.1)] px-3 py-2 text-sm text-[hsl(var(--rack-danger))]"
    >
      {children}
    </p>
  );
}

export function Note({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-[var(--rack-radius)] border border-[hsl(var(--rack-primary)/0.35)] bg-[hsl(var(--rack-primary)/0.08)] px-3 py-2 text-sm text-[hsl(var(--rack-primary))]">
      {children}
    </p>
  );
}

/**
 * The bouncing 8-ball from the original. Kept because it has more character
 * than a spinner and it is the one bit of loading state anyone remembered.
 */
export function PoolBallLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="rack-bounce relative h-16 w-16" aria-hidden>
        <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-[hsl(0_0%_100%/0.08)] bg-[radial-gradient(circle_at_32%_28%,#4a4a4a,#111_55%,#000)] shadow-[var(--rack-shadow-lg)]">
          <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#f4ecd8] font-[family-name:var(--rack-font-display)] text-lg text-black">
            8
          </span>
          <span className="absolute left-3 top-2 h-5 w-5 rounded-full bg-white/35 blur-[3px]" />
        </div>
      </div>
      <p className="text-sm text-[hsl(var(--rack-fg-muted))]">{label}…</p>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  icon,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="text-center">
      {icon && (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--rack-primary)/0.12)] text-[hsl(var(--rack-primary))]">
          {icon}
        </div>
      )}
      <p className="font-[family-name:var(--rack-font-heading)] text-lg font-bold">{title}</p>
      {children && (
        <div className="mt-1.5 text-sm text-[hsl(var(--rack-fg-muted))]">{children}</div>
      )}
    </Card>
  );
}

/** Big tabular number, for scores. */
export function Score({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--rack-font-display)] tabular-nums leading-none",
        className,
      )}
    >
      {value}
    </span>
  );
}

/** Section hero, in Rack Up's voice rather than the team site's. */
export function RackHero({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-[hsl(var(--rack-border))] bg-[hsl(var(--rack-bg-soft))]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-[family-name:var(--rack-font-heading)] text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-[hsl(var(--rack-fg-muted))]">{subtitle}</p>
        )}
        {children}
      </div>
    </header>
  );
}

/* --------------------------------------------------------------- Dangerous */

/**
 * A destructive action that asks first, in place.
 *
 * Not `window.confirm`: it reads as a browser error on a phone, can't say what
 * is actually about to happen, and drops you out of the app's own voice at the
 * one moment precision matters. This expands into the layout so the question
 * and its answer sit where the button was.
 */
export function ConfirmAction({
  label,
  icon,
  question,
  confirmLabel,
  onConfirm,
  busy = false,
  variant = "ghost",
  size = "sm",
  className,
}: {
  label: ReactNode;
  icon?: ReactNode;
  /** What will happen, in one sentence. Say what is kept as well as what goes. */
  question: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        {icon}
        {label}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[var(--rack-radius)] border border-[hsl(var(--rack-danger)/0.4)]",
        "bg-[hsl(var(--rack-danger)/0.08)] p-3",
        className,
      )}
    >
      <p className="text-sm text-[hsl(var(--rack-fg))]">{question}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="danger" size="sm" disabled={busy} onClick={() => void onConfirm()}>
          {busy ? "Working…" : confirmLabel}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Table codes */

/**
 * The table code, big enough to read across a room and one tap to share.
 *
 * The code is how everyone else gets in, so it is the most useful thing on the
 * screen and was previously a run of small text. Copying beats reading it out
 * when the other person is on the far side of the hall.
 */
export function RoomCode({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/rack/room/${code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard is blocked outside a secure context and in some in-app
      // browsers. The code is on screen either way, so say nothing and let
      // them read it out.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title="Copy the join link"
      className={cn(
        "group inline-flex items-center gap-3 rounded-[var(--rack-radius)] border",
        "border-[hsl(var(--rack-border-strong))] bg-[hsl(var(--rack-bg-soft))] px-3 py-2",
        "transition hover:border-[hsl(var(--rack-accent))]",
        className,
      )}
    >
      <span className="text-left">
        <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-[hsl(var(--rack-fg-muted))]">
          Table code
        </span>
        <span className="block font-[family-name:var(--rack-font-display)] text-2xl leading-none tracking-[0.3em] text-[hsl(var(--rack-accent))]">
          {code}
        </span>
      </span>
      <span
        className={cn(
          "text-[11px] font-semibold",
          copied
            ? "text-[hsl(var(--rack-success))]"
            : "text-[hsl(var(--rack-fg-muted))] group-hover:text-[hsl(var(--rack-accent))]",
        )}
      >
        {copied ? "Copied" : "Copy link"}
      </span>
    </button>
  );
}
