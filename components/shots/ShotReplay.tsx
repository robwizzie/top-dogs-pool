"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { findColorMatch } from "@/lib/cv/tracking";
import { cn } from "@/lib/utils";

type Frame = { dataUrl: string; t: number };

type TracedPoint = { x: number; y: number; t: number };

/**
 * Slow-motion playback of the shot, with the object ball's inferred
 * trajectory drawn over the frames. The frames came in as small JPEGs
 * from the ShotTracker buffer; we decode each one back into ImageData,
 * search for the OB's reference colour, and chain the centroids into a
 * polyline. Then we render the frames at half speed in a loop.
 */
export function ShotReplay({
  frames,
  obReference,
  onClose,
}: {
  frames: Frame[];
  obReference: [number, number, number];
  onClose: () => void;
}) {
  const [imageElements, setImageElements] = useState<HTMLImageElement[]>([]);
  const [trace, setTrace] = useState<TracedPoint[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [computing, setComputing] = useState(true);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Decode frames + trace OB position on mount. Heavy work but it's a
  // one-time cost; the player just hit "replay" so they expect a beat.
  useEffect(() => {
    let cancelled = false;
    async function process() {
      const imgs: HTMLImageElement[] = [];
      const traced: TracedPoint[] = [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      for (let i = 0; i < frames.length; i++) {
        if (cancelled) return;
        const img = new Image();
        img.src = frames[i].dataUrl;
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
        });
        if (cancelled) return;
        imgs.push(img);
        if (!ctx) continue;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        try {
          const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const match = findColorMatch(id, obReference, 8, 6, 100);
          if (match) {
            traced.push({
              x: match.center.x / canvas.width,
              y: match.center.y / canvas.height,
              t: frames[i].t,
            });
          }
        } catch {
          // Tainted canvas (cross-origin) — skip this frame's trace.
        }
        if (i === 0) setSize({ w: canvas.width, h: canvas.height });
      }
      if (cancelled) return;
      setImageElements(imgs);
      setTrace(traced);
      setComputing(false);
    }
    process();
    return () => {
      cancelled = true;
    };
  }, [frames, obReference]);

  // Playback loop — half-speed of the captured rate (so a real 80ms
  // capture step becomes 160ms playback).
  useEffect(() => {
    if (!playing || imageElements.length === 0) return;
    function tick(t: number) {
      if (!lastTickRef.current) lastTickRef.current = t;
      const elapsed = t - lastTickRef.current;
      if (elapsed >= 160) {
        lastTickRef.current = t;
        setIdx((i) => {
          if (i + 1 >= imageElements.length) {
            setPlaying(false);
            return i; // stay on last frame
          }
          return i + 1;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = 0;
    };
  }, [playing, imageElements.length]);

  function togglePlay() {
    if (idx + 1 >= imageElements.length && !playing) {
      setIdx(0);
    }
    setPlaying((p) => !p);
  }

  function scrub(i: number) {
    setPlaying(false);
    setIdx(Math.max(0, Math.min(imageElements.length - 1, i)));
  }

  // Visible portion of the trace at the current playback index — the
  // trail "draws itself" as playback progresses rather than appearing
  // all at once at frame 0.
  const visibleTrace = useMemo(() => {
    if (idx === 0 || trace.length === 0) return trace;
    const slice = (idx / Math.max(1, imageElements.length)) * trace.length;
    return trace.slice(0, Math.max(1, Math.ceil(slice)));
  }, [idx, trace, imageElements.length]);

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur">
      <div className="flex w-full max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass-bright)]">
            Slow-mo replay
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close replay"
          >
            <X size={14} />
          </button>
        </div>

        <div
          className="relative w-full overflow-hidden rounded-2xl border border-white/15 bg-black"
          style={{ aspectRatio: `${size.w} / ${size.h}` }}
        >
          {computing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-white/80 text-sm">
              Building replay…
            </div>
          )}
          {imageElements[idx] && (
            // Use the decoded HTMLImageElement as an SVG <image> so the
            // trace polyline can sit on top in the same coord space.
            <svg
              viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
              xmlns="http://www.w3.org/2000/svg"
              className="block h-auto w-full"
            >
              <image
                href={imageElements[idx].src}
                x={0}
                y={0}
                width={size.w}
                height={size.h}
              />
              {/* Fading trail */}
              {visibleTrace.length > 1 && (
                <path
                  d={visibleTrace
                    .map(
                      (p, i) =>
                        `${i === 0 ? "M" : "L"} ${(p.x * size.w).toFixed(1)} ${(p.y * size.h).toFixed(1)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="rgba(232,82,72,0.95)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="2 5"
                />
              )}
              {/* Current OB position dot */}
              {visibleTrace.length > 0 &&
                (() => {
                  const p = visibleTrace[visibleTrace.length - 1];
                  return (
                    <circle
                      cx={p.x * size.w}
                      cy={p.y * size.h}
                      r={Math.max(4, size.w / 100)}
                      fill="rgba(232,82,72,0.95)"
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  );
                })()}
            </svg>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/70 px-4 py-2.5 backdrop-blur-md">
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white transition-colors hover:bg-white/25"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, imageElements.length - 1)}
            value={idx}
            onChange={(e) => scrub(Number(e.target.value))}
            className="flex-1 accent-[var(--color-brass-bright)]"
            aria-label="Replay scrubber"
          />
          <span className="font-mono text-[11px] text-white/70">
            {imageElements.length > 0 ? `${idx + 1}/${imageElements.length}` : "—"}
          </span>
        </div>

        {!computing && trace.length === 0 && (
          <p
            className={cn(
              "rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs leading-snug text-white/70",
            )}
          >
            Couldn&apos;t trace the object ball — likely motion blur or
            lighting. The frames still play back; the make/miss verdict
            was based on the before/after table read.
          </p>
        )}
      </div>
    </div>
  );
}
