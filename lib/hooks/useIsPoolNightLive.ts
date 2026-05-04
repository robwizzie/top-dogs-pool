"use client";

import { useEffect, useState } from "react";
import { isPoolNightLive } from "@/lib/utils";

/**
 * Reactive variant of isPoolNightLive — re-evaluates every minute so the UI
 * flips to "live" the moment Tuesday 7:30pm rolls around without needing a
 * page refresh.
 */
export function useIsPoolNightLive(): boolean {
  const [live, setLive] = useState<boolean>(() => isPoolNightLive());
  useEffect(() => {
    setLive(isPoolNightLive());
    const id = setInterval(() => setLive(isPoolNightLive()), 60_000);
    return () => clearInterval(id);
  }, []);
  return live;
}
