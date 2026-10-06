"use client";

import { useEffect } from "react";

/**
 * Feeds the cursor position into whichever `.pm-lift` card is under it, as
 * `--mx` / `--my`, so its `.pm-sheen` layer can follow the pointer. One
 * document listener instead of a client wrapper around every card keeps the
 * cards themselves server components.
 */
export function PointerSheen() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    function onMove(e: PointerEvent) {
      const card = (e.target as Element | null)?.closest<HTMLElement>(".pm-lift");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);
  return null;
}
