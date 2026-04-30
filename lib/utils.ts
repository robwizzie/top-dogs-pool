import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(input: string | Date, opts: Intl.DateTimeFormatOptions = {}) {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...opts,
  }).format(d);
}

export function formatTime(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return n === 1 ? `${n} ${one}` : `${n} ${many}`;
}

export function pct(numer: number, denom: number) {
  if (!denom) return 0;
  return Math.round((numer / denom) * 1000) / 10;
}
