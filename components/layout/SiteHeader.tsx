"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { LiveDot } from "@/components/live/LiveCTA";
import { useIsPoolNightLive } from "@/lib/hooks/useIsPoolNightLive";
import { NAV_LINKS, TIKTOK_LIVE_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const live = useIsPoolNightLive();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_85%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="cursor-cue" aria-label="Top Dogs home">
          <LogoMark priority />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            const isLive = link.href === "/live";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-full px-4 py-2 text-sm font-medium tracking-wide transition-colors",
                  active
                    ? "text-[var(--color-brass-bright)]"
                    : "text-[var(--fg-dim)] hover:text-[var(--fg)]",
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  {link.label}
                  {isLive && <LiveDot />}
                </span>
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-[var(--color-brass)] to-transparent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {live && (
            <a
              href={TIKTOK_LIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-full border border-[var(--color-pop)] px-3 py-1.5 text-xs font-semibold tracking-wider text-[var(--color-pop-bright)] transition-colors hover:bg-[var(--color-pop)] hover:text-white sm:inline-flex"
            >
              <span className="inline-flex h-2 w-2 animate-pulse-pop rounded-full bg-[var(--color-pop-bright)]" />
              LIVE
            </a>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Open menu"
            aria-expanded={open}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)]"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden">
          <nav className="mx-4 mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-xl px-3 py-3 text-sm font-medium",
                    active
                      ? "bg-[var(--color-felt)] text-[var(--color-cream)]"
                      : "text-[var(--fg-dim)] hover:bg-[var(--bg-soft)]",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
