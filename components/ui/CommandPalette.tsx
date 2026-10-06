"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export type SearchItem = {
  id: string;
  label: string;
  sublabel?: string;
  kind: "Player" | "Team" | "Match" | "Navigate" | "Session";
  href: string;
  keywords?: string;
  thumb?: string;
};

const KIND_TONE: Record<SearchItem["kind"], string> = {
  Player: "var(--color-brass-bright)",
  Team: "var(--color-felt-bright)",
  Match: "var(--color-cream)",
  Navigate: "var(--color-cream-dim)",
  Session: "var(--color-pop-bright)",
};

export function CommandPalette({ items }: { items: SearchItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Hotkey: ⌘K / Ctrl+K to open, "/" outside any input to open, Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (!open && e.key === "/" && !inField) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (open && e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("topdogs:open-cmdk", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("topdogs:open-cmdk", onOpen);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Focus next tick so the dialog is mounted.
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Default view: nav links first, then a sampling of players.
      const nav = items.filter((i) => i.kind === "Navigate");
      const players = items.filter((i) => i.kind === "Player").slice(0, 5);
      return [...nav, ...players];
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    const scored: Array<{ item: SearchItem; score: number }> = [];
    for (const item of items) {
      const hay = `${item.label} ${item.sublabel ?? ""} ${item.keywords ?? ""}`.toLowerCase();
      let score = 0;
      let matchedAll = true;
      for (const tok of tokens) {
        const idx = hay.indexOf(tok);
        if (idx === -1) {
          matchedAll = false;
          break;
        }
        // Boost for early match + label match.
        score += 100 - Math.min(idx, 100);
        if (item.label.toLowerCase().startsWith(tok)) score += 50;
      }
      if (matchedAll) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 30).map((s) => s.item);
  }, [query, items]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const navigate = useCallback(
    (item: SearchItem) => {
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[active];
      if (item) navigate(item);
    }
  }

  // Scroll active item into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-active="true"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  return (
    <>
      {/* Floating launcher button — desktop only, bottom-right */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="group fixed bottom-6 right-6 z-30 hidden items-center gap-2.5 rounded-full border border-[var(--color-brass)]/25 bg-[color-mix(in_oklab,#0b0d0b_72%,transparent)] py-2 pl-3.5 pr-2 text-xs font-semibold tracking-wide text-[var(--color-cream)]/75 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150 transition hover:-translate-y-0.5 hover:border-[var(--color-brass)]/50 hover:text-[var(--color-cream)] hover:shadow-[0_24px_50px_-18px_rgba(0,0,0,0.9),0_0_30px_-10px_rgba(201,162,74,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] md:inline-flex"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-brass-bright)]">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        Search
        <kbd className="inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded-md border border-white/10 bg-white/[0.05] px-1.5 font-sans text-[10px] font-semibold tracking-normal text-[var(--color-cream)]/70 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex animate-[fade-in_0.18s_ease-out_forwards] items-start justify-center bg-[radial-gradient(70%_60%_at_50%_0%,rgba(46,139,87,0.18),transparent_70%),rgba(4,5,4,0.78)] px-3 pt-[calc(env(safe-area-inset-top)+10vh)] backdrop-blur-md sm:px-4 sm:pt-[12vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <div className="relative w-full max-w-2xl origin-top animate-[cmdk-pop_0.22s_cubic-bezier(0.2,0.7,0.3,1)_forwards] overflow-hidden rounded-[1.6rem] border border-[var(--color-brass)]/25 bg-[color-mix(in_oklab,#0b0d0b_90%,transparent)] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95),0_0_80px_-40px_rgba(201,162,74,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150">
            {/* brass hairline catching the lamp */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-brass-bright)]/70 to-transparent" aria-hidden />
            <div className="flex items-center gap-3 border-b border-[var(--color-cream)]/[0.07] px-4 py-3.5 sm:px-5 sm:py-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-brass)]">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search players, opponents, matches…"
                className="w-full bg-transparent text-base text-[var(--color-cream)] placeholder:text-[var(--color-cream)]/35 focus:outline-none sm:text-lg"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded-md border border-white/10 bg-white/[0.05] px-1.5 font-sans text-[10px] font-semibold tracking-normal text-[var(--color-cream)]/70 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)] hidden md:inline-flex">Esc</kbd>
            </div>

            <div ref={listRef} className="max-h-[55vh] overflow-y-auto overscroll-contain p-2">
              {results.length === 0 ? (
                <p className="px-4 py-12 text-center font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-cream)]/40">
                  No matches.
                </p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {results.map((r, i) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        data-active={i === active || undefined}
                        onClick={() => navigate(r)}
                        onMouseEnter={() => setActive(i)}
                        className="group/item relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors data-[active=true]:bg-[var(--color-brass)]/[0.09] data-[active=true]:shadow-[inset_0_0_0_1px_rgba(201,162,74,0.22)]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04] transition-colors group-data-[active=true]/item:border-[var(--color-brass)]/40">
                          {r.thumb ? (
                            <Image
                              src={r.thumb}
                              alt=""
                              width={36}
                              height={36}
                              className="h-9 w-9 object-cover object-top"
                            />
                          ) : (
                            <KindGlyph kind={r.kind} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--color-cream)]">
                            {r.label}
                          </span>
                          {r.sublabel && (
                            <span className="block truncate text-[11px] text-[var(--color-cream)]/45">
                              {r.sublabel}
                            </span>
                          )}
                        </span>
                        <span
                          className="shrink-0 rounded-full border border-current/20 bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] opacity-80"
                          style={{ color: KIND_TONE[r.kind] }}
                        >
                          {r.kind}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-cream)]/[0.07] bg-black/25 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-[var(--color-cream)]/45 sm:px-5">
              <span className="flex gap-3">
                <span className="inline-flex items-center gap-1">
                  <kbd className="inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded-md border border-white/10 bg-white/[0.05] px-1.5 font-sans text-[10px] font-semibold tracking-normal text-[var(--color-cream)]/70 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]">↑</kbd>
                  <kbd className="inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded-md border border-white/10 bg-white/[0.05] px-1.5 font-sans text-[10px] font-semibold tracking-normal text-[var(--color-cream)]/70 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]">↓</kbd> Navigate
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="inline-flex h-5 min-w-[1.35rem] items-center justify-center rounded-md border border-white/10 bg-white/[0.05] px-1.5 font-sans text-[10px] font-semibold tracking-normal text-[var(--color-cream)]/70 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]">↵</kbd> Open
                </span>
              </span>
              <span className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-[var(--color-brass)]/80">Top Dawgs</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function KindGlyph({ kind }: { kind: SearchItem["kind"] }) {
  const tone = KIND_TONE[kind];
  if (kind === "Match") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
      </svg>
    );
  }
  if (kind === "Team") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
      </svg>
    );
  }
  if (kind === "Navigate") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="m13 5 7 7-7 7" />
      </svg>
    );
  }
  if (kind === "Session") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3 3-5 7-5s7 2 7 5" />
    </svg>
  );
}
