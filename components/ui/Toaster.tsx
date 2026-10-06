"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TOAST_EVENT = "topdogs:toast";
const TOAST_DURATION_MS = 3500;

type ToastKind = "success" | "info" | "error";

type ToastPayload = {
  message: string;
  kind?: ToastKind;
  detail?: string;
};

type ToastItem = ToastPayload & { id: number; expiresAt: number };

/**
 * Fire a toast notification. Safe to call from any client component —
 * the toast is delivered to the global <Toaster /> mounted in the root
 * layout via a custom window event, so there's no Provider plumbing.
 */
export function showToast(payload: ToastPayload | string): void {
  if (typeof window === "undefined") return;
  const detail: ToastPayload =
    typeof payload === "string" ? { message: payload } : payload;
  window.dispatchEvent(
    new CustomEvent<ToastPayload>(TOAST_EVENT, { detail }),
  );
}

/**
 * Global toast surface. Mount once in the root layout.
 */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastPayload>).detail;
      if (!detail) return;
      const id = Date.now() + Math.random();
      const expiresAt = Date.now() + TOAST_DURATION_MS;
      setToasts((prev) => [...prev, { ...detail, id, expiresAt }]);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  // Garbage-collect expired toasts every second.
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => t.expiresAt > now));
    }, 500);
    return () => clearInterval(t);
  }, [toasts.length]);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex flex-col items-center gap-2 px-3 sm:right-6 sm:left-auto sm:items-end md:bottom-20"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const Icon =
    toast.kind === "success"
      ? CheckCircle2
      : toast.kind === "error"
        ? XCircle
        : Info;
  const tone =
    toast.kind === "success"
      ? { chip: "border-[var(--color-felt-bright)]/45 bg-[var(--color-felt)]/50 text-[var(--color-felt-bright)]", bar: "from-[var(--color-felt-bright)]" }
      : toast.kind === "error"
        ? { chip: "border-[var(--color-pop)]/45 bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]", bar: "from-[var(--color-pop-bright)]" }
        : { chip: "border-[var(--color-brass)]/40 bg-[var(--color-brass)]/10 text-[var(--color-brass-bright)]", bar: "from-[var(--color-brass-bright)]" };
  return (
    <div
      role="status"
      className="pointer-events-auto relative flex w-full max-w-sm animate-[cmdk-pop_0.25s_cubic-bezier(0.2,0.7,0.3,1)_forwards] items-start gap-3 overflow-hidden rounded-2xl border border-[var(--color-brass)]/20 bg-[color-mix(in_oklab,#0b0d0b_86%,transparent)] py-3 pl-3 pr-3.5 text-[var(--color-cream)] shadow-[0_24px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150"
    >
      <span
        className={cn("pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent", tone.bar)}
        aria-hidden
      />
      <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", tone.chip)}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold leading-tight">{toast.message}</p>
        {toast.detail && (
          <p className="mt-1 text-xs leading-snug text-[var(--color-cream)]/60">
            {toast.detail}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--color-cream)]/45 transition-colors hover:bg-white/[0.06] hover:text-[var(--color-cream)]"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
