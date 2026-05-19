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
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-3 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
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
      ? "border-[var(--color-felt-bright)]/55 bg-[var(--color-felt-deep)]/85 text-[var(--color-felt-bright)]"
      : toast.kind === "error"
        ? "border-[var(--color-pop)]/55 bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]"
        : "border-[var(--color-brass)]/55 bg-[var(--bg-card)] text-[var(--fg)]";
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur",
        tone,
      )}
    >
      <Icon size={16} className="mt-[2px] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{toast.message}</p>
        {toast.detail && (
          <p className="mt-0.5 text-xs leading-snug opacity-80">
            {toast.detail}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-current opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
