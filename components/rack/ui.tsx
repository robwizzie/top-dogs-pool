"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/**
 * Section-local UI primitives.
 *
 * The Lovable app shipped ~50 shadcn components to render what is really a
 * scoreboard, a form and a bracket. Rather than port that surface into a site
 * that doesn't use it, these are the handful of pieces the section actually
 * needs, styled with the site's felt-and-brass tokens so Rack Up doesn't look
 * like a different product bolted on.
 *
 * Tap targets are sized for a phone held over a pool table: minimum 44px, and
 * the scoring buttons are much larger than that.
 */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl font-semibold tracking-wide transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brass)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" && "min-h-9 px-3 text-xs",
        size === "md" && "px-4 text-sm",
        size === "lg" && "min-h-14 px-6 text-base",
        variant === "primary" &&
          "bg-[var(--color-brass)] text-[var(--color-ink)] hover:bg-[var(--color-brass-bright)] active:scale-[0.98]",
        variant === "secondary" &&
          "border border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--fg)] hover:border-[var(--color-brass)] hover:bg-[color-mix(in_oklab,var(--color-brass)_12%,var(--bg-card))] active:scale-[0.98]",
        variant === "ghost" &&
          "text-[var(--fg-dim)] hover:bg-white/5 hover:text-[var(--fg)]",
        variant === "danger" &&
          "border border-[var(--color-pop)]/50 bg-[var(--color-pop)]/10 text-[var(--color-pop-bright)] hover:bg-[var(--color-pop)]/20",
        className,
      )}
    />
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

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
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brass)]">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-[var(--fg-dim)]">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "min-h-11 w-full rounded-xl border border-[var(--border)] bg-black/30 px-3 text-[var(--fg)]",
        "placeholder:text-[var(--fg-dim)]",
        "focus:border-[var(--color-brass)] focus:outline-none",
        className,
      )}
    />
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brass" | "hot" | "win";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        tone === "neutral" && "bg-white/5 text-[var(--fg-dim)]",
        tone === "brass" && "bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)]",
        tone === "hot" && "bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]",
        tone === "win" && "bg-[var(--color-felt-bright)]/20 text-[var(--color-felt-bright)]",
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
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
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
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--color-felt)] font-semibold text-[var(--color-cream)]",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {url ? (
        // Avatars come from Supabase storage at arbitrary sizes; next/image
        // would need the host allow-listed for no benefit at this size.
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
      className="rounded-lg border border-[var(--color-pop)]/40 bg-[var(--color-pop)]/10 px-3 py-2 text-sm text-[var(--color-pop-bright)]"
    >
      {children}
    </p>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-[var(--fg-dim)]">
      <span
        aria-hidden
        className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-brass)] border-t-transparent"
      />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card className="text-center">
      <p className="font-[family-name:var(--font-display)] text-xl tracking-wide">{title}</p>
      {children && <div className="mt-2 text-sm text-[var(--fg-dim)]">{children}</div>}
    </Card>
  );
}
