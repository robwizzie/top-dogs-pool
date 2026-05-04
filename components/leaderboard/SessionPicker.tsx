import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SessionRecord } from "@/lib/apa/schemas";
import { serializeSessionScope, toggleSessionInScope } from "@/lib/session-scope";

/**
 * Multi-select session picker. Each pill toggles its session in/out of the
 * active selection — so you can combine 2-3 sessions into one analysis,
 * not just current/all.
 *
 * URL contract (param defaults to "session"):
 *   missing → default (current)
 *   "all"   → every session
 *   "138"   → one
 *   "138,137,136" → many
 */
export function SessionPicker({
  basePath,
  sessions,
  selectedIds,
  paramName = "session",
  showAllTime = true,
  singleSelect = false,
  preserveQuery,
}: {
  basePath: string;
  sessions: SessionRecord[];
  selectedIds: Set<number>;
  paramName?: string;
  /** Show the "All" toggle. */
  showAllTime?: boolean;
  /** Force single-select mode (radio-style). Click replaces selection. */
  singleSelect?: boolean;
  /** Extra query params to keep on every link (e.g. preserving ?tab=). */
  preserveQuery?: Record<string, string | undefined>;
}) {
  const allIds = sessions.map((s) => s.id);
  const isAllSelected =
    !singleSelect &&
    allIds.length > 0 &&
    allIds.every((id) => selectedIds.has(id));

  function buildQuery(extra: Record<string, string | undefined>): string {
    const params: string[] = [];
    for (const [k, v] of Object.entries({ ...preserveQuery, ...extra })) {
      if (v === undefined || v === "") continue;
      params.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    return params.length ? `?${params.join("&")}` : "";
  }

  function hrefFor(nextSelection: Set<number>): string {
    const v = serializeSessionScope(nextSelection, allIds);
    return `${basePath}${buildQuery({ [paramName]: v ?? undefined })}`;
  }

  function singleHref(id: number): string {
    return `${basePath}${buildQuery({ [paramName]: String(id) })}`;
  }

  const allHref = isAllSelected
    ? `${basePath}${buildQuery({ [paramName]: undefined })}`
    : hrefFor(new Set(allIds));
  const clearHref = `${basePath}${buildQuery({ [paramName]: undefined })}`;
  const hasMulti = !singleSelect && selectedIds.size > 1;

  return (
    <div className="surface flex flex-wrap items-center gap-2 p-3">
      <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        {singleSelect ? "Session" : "Sessions"}
      </span>
      {sessions.map((s) => {
        const active = selectedIds.has(s.id);
        const href = singleSelect
          ? singleHref(s.id)
          : hrefFor(toggleSessionInScope(selectedIds, s.id));
        return (
          <Link
            key={s.id}
            href={href}
            scroll={false}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-colors",
              active
                ? "bg-[var(--color-brass)] text-[var(--color-ink)]"
                : "border border-[var(--border)] text-[var(--fg-dim)] hover:border-[var(--color-brass)] hover:text-[var(--fg)]",
            )}
            aria-pressed={active}
          >
            {s.name}
          </Link>
        );
      })}
      {showAllTime && !singleSelect && (
        <Link
          href={allHref}
          scroll={false}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors",
            isAllSelected
              ? "bg-[var(--color-pop)] text-white"
              : "border border-[var(--color-pop)]/50 text-[var(--color-pop-bright)] hover:bg-[var(--color-pop)]/15",
          )}
        >
          {isAllSelected ? "All ✓" : "All"}
        </Link>
      )}
      {hasMulti && (
        <Link
          href={clearHref}
          scroll={false}
          className="ml-auto rounded-full px-2.5 py-1 text-[11px] tracking-wide text-[var(--fg-dim)] hover:text-[var(--color-brass)]"
        >
          Reset
        </Link>
      )}
    </div>
  );
}
