"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { LiveDot } from "@/components/live/LiveCTA";
import { CartButton } from "@/components/store/CartButton";
import { useIsPoolNightLive } from "@/lib/hooks/useIsPoolNightLive";
import {
  NAV_GROUPS,
  NAV_LINKS,
  TIKTOK_LIVE_URL,
  isNavGroup,
  type NavGroup as NavGroupT,
  type NavItem,
} from "@/lib/config";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const live = useIsPoolNightLive();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_85%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="cursor-cue" aria-label="Top Dawgs home">
          <LogoMark priority />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_GROUPS.map((entry) =>
            isNavGroup(entry) ? (
              <NavGroupMenu
                key={entry.label}
                group={entry}
                pathname={pathname}
              />
            ) : (
              <NavLeafLink
                key={entry.href}
                item={entry}
                pathname={pathname}
              />
            ),
          )}
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
          <CartButton />
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new Event("topdogs:open-cmdk"))
            }
            aria-label="Search"
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)]"
          >
            <Search size={16} />
          </button>
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

function NavLeafLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const active = isActive(pathname, item.href);
  const isLive = item.href === "/live";
  return (
    <Link
      href={item.href}
      className={cn(
        "relative rounded-full px-4 py-2 text-sm font-medium tracking-wide transition-colors",
        active
          ? "text-[var(--color-brass-bright)]"
          : "text-[var(--fg-dim)] hover:text-[var(--fg)]",
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        {item.label}
        {isLive && <LiveDot />}
      </span>
      {active && (
        <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-[var(--color-brass)] to-transparent" />
      )}
    </Link>
  );
}

function NavGroupMenu({
  group,
  pathname,
}: {
  group: NavGroupT;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const childActive = group.items.some((item) => isActive(pathname, item.href));

  // Close on route change.
  useEffect(() => setOpen(false), [pathname]);

  // Close on outside click + escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openNow() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  }
  function scheduleClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "relative inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium tracking-wide transition-colors",
          childActive
            ? "text-[var(--color-brass-bright)]"
            : "text-[var(--fg-dim)] hover:text-[var(--fg)]",
        )}
      >
        {group.label}
        <ChevronDown
          size={14}
          className={cn(
            "transition-transform duration-150",
            open && "rotate-180",
          )}
        />
        {childActive && (
          <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-[var(--color-brass)] to-transparent" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2"
        >
          <div className="min-w-[11rem] rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] p-1 shadow-[var(--shadow-felt)]">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm font-medium tracking-wide transition-colors",
                    active
                      ? "bg-[color-mix(in_oklab,var(--color-felt)_45%,transparent)] text-[var(--color-brass-bright)]"
                      : "text-[var(--fg)] hover:bg-[var(--bg-soft)] hover:text-[var(--color-brass-bright)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
