"use client";

import { useState } from "react";
import { Check, Download, Link2, Share2 } from "lucide-react";
import type { KinisterShot } from "@/lib/kinister/shots";

export function ShareControls({ shot }: { shot: KinisterShot }) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/shots/${shot.id}`
      : `/shots/${shot.id}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be unavailable on insecure origins — silently fail.
    }
  }

  async function shareNative() {
    if (typeof navigator === "undefined" || !navigator.share) {
      copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `${shot.name} — Top Dogs Pool`,
        text: shot.description,
        url,
      });
    } catch {
      // User cancelled, or share failed — no-op.
    }
  }

  function downloadDiagram() {
    if (typeof document === "undefined") return;
    // Find the *first* diagram SVG on the page (the interactive PoolTable
    // sits at the top of the layout).
    const svg = document.querySelector<SVGSVGElement>(
      'svg[aria-label^="Diagram of "]',
    );
    if (!svg) return;
    // Inline the computed XML namespace + dimensions so the downloaded SVG
    // renders standalone outside the page.
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${shot.id}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
        aria-label="Copy link to this shot"
      >
        {copied ? <Check size={13} /> : <Link2 size={13} />}
        {copied ? "Copied" : "Copy link"}
      </button>
      {canNativeShare && (
        <button
          type="button"
          onClick={shareNative}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
          aria-label="Share via system share sheet"
        >
          <Share2 size={13} />
          Share
        </button>
      )}
      <button
        type="button"
        onClick={downloadDiagram}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-dim)] transition-colors hover:text-[var(--fg)]"
        aria-label="Download the diagram as an SVG file"
        title="Save the diagram as .svg"
      >
        <Download size={13} />
        Download diagram
      </button>
    </div>
  );
}
