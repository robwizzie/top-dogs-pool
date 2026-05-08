"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up from 0 to `value` over `duration` ms with eased-out cubic timing.
 * Honors `prefers-reduced-motion`. Renders a single string (number-only) so
 * callers can wrap it in their own span/p with brand typography.
 */
export function StatCounter({
  value,
  decimals = 0,
  duration = 1200,
  suffix = "",
  prefix = "",
  delay = 0,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  delay?: number;
}) {
  const [n, setN] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setN(value);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const begin = () => {
      function step(t: number) {
        if (cancelled) return;
        if (startedAt.current === null) startedAt.current = t;
        const p = Math.min((t - startedAt.current) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(value * eased);
        if (p < 1) raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
    };
    const timer = window.setTimeout(begin, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, duration, delay]);

  const display = decimals
    ? n.toFixed(decimals)
    : Math.round(n).toLocaleString();
  return (
    <>
      {prefix}
      {display}
      {suffix}
    </>
  );
}
