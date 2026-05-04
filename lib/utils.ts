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

/* ---------------------------------------------------------------------------
 * Pool-night live window
 * ------------------------------------------------------------------------- */

const POOL_NIGHT = {
  /** Tuesday */
  weekday: 2,
  startHour: 19,
  startMinute: 30,
  endHour: 23,
  endMinute: 30,
  zone: "America/New_York",
} as const;

/** Decompose a Date into year/month/day/weekday/hour/minute in the given IANA zone. */
function partsInZone(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    f.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.weekday,
  );
  return {
    weekday,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
  };
}

/** True if `date` falls inside Tuesday 7:30pm-11:30pm Eastern. */
export function isPoolNightLive(date: Date = new Date()): boolean {
  const { weekday, hour, minute } = partsInZone(date, POOL_NIGHT.zone);
  if (weekday !== POOL_NIGHT.weekday) return false;
  const minutes = hour * 60 + minute;
  const start = POOL_NIGHT.startHour * 60 + POOL_NIGHT.startMinute;
  const end = POOL_NIGHT.endHour * 60 + POOL_NIGHT.endMinute;
  return minutes >= start && minutes < end;
}

/**
 * The next pool-night start instant from `from`. Used to render
 * "Next stream Tue 7:30pm" copy when not currently live.
 */
export function nextPoolNightStart(from: Date = new Date()): Date {
  // Walk forward day-by-day until we land on Tue, then set start time in ET.
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(from.getTime() + offset * 86_400_000);
    const { weekday } = partsInZone(candidate, POOL_NIGHT.zone);
    if (weekday !== POOL_NIGHT.weekday) continue;
    const startEt = etDateAt(
      candidate,
      POOL_NIGHT.startHour,
      POOL_NIGHT.startMinute,
    );
    if (startEt.getTime() > from.getTime()) return startEt;
  }
  // Fallback: next week
  return etDateAt(
    new Date(from.getTime() + 7 * 86_400_000),
    POOL_NIGHT.startHour,
    POOL_NIGHT.startMinute,
  );
}

/** Build a Date for Y-M-D (in ET) at the given ET hour/minute. */
function etDateAt(refDate: Date, hour: number, minute: number): Date {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: POOL_NIGHT.zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    f.formatToParts(refDate).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  // ET is UTC-5 (EST) or UTC-4 (EDT). Find the offset by formatting the candidate
  // date in ET and computing how it differs from UTC.
  const isoLocal = `${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  const asUtc = new Date(isoLocal + "Z");
  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone: POOL_NIGHT.zone,
    timeZoneName: "shortOffset",
    hour: "numeric",
  }).formatToParts(asUtc);
  const offsetStr =
    offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const m = offsetStr.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = m?.[1] === "-" ? -1 : 1;
  const oh = m ? parseInt(m[2], 10) : 5;
  const om = m && m[3] ? parseInt(m[3], 10) : 0;
  return new Date(asUtc.getTime() - sign * (oh * 60 + om) * 60_000);
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (sec < 30) return "just now";
  if (min < 1) return `${sec}s ago`;
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  return `${day}d ago`;
}
