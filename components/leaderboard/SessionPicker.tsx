import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SessionRecord } from "@/lib/apa/schemas";
import { serializeSessionScope, toggleSessionInScope } from "@/lib/session-scope";
import { ResetSessionScope } from "@/components/leaderboard/ResetSessionScope";

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

  const pill =
    "relative shrink-0 snap-start whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide transition-all duration-200";
  const pillIdle =
    "text-[var(--color-cream)]/60 hover:bg-white/[0.05] hover:text-[var(--color-cream)]";
  const pillActive =
    "bg-[linear-gradient(180deg,#f0d48a,#c9a24a_55%,#b38b36)] font-semibold text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_6px_18px_-8px_rgba(201,162,74,0.8)]";

  return (
    <div className="pm-glass flex items-center gap-1 overflow-hidden p-1.5 sm:items-start sm:gap-2 sm:p-2">
      <span className="hidden shrink-0 items-center gap-2 py-1.5 pl-2.5 pr-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-brass)] sm:inline-flex">
        <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-[var(--color-brass-bright)] shadow-[0_0_8px_rgba(224,190,107,0.7)]" aria-hidden />
        {singleSelect ? "Session" : "Sessions"}
      </span>
      {/* One scrolling rail on phones (edges fade out), wrapping from sm. */}
      <div className="-my-1 flex min-w-0 flex-1 snap-x items-center gap-1 overflow-x-auto py-1 pl-1 pr-8 [mask-image:linear-gradient(90deg,#000_88%,transparent)] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden">
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
            className={cn(pill, active ? pillActive : pillIdle)}
            aria-pressed={active}
          >
            {s.name}
          </Link>
        );
      })}
      {showAllTime && !singleSelect && (
        // When "All" is currently active, clicking it deselects → same
        // URL as Reset → use ResetSessionScope so the persisted scope
        // clears too, otherwise SessionScopeMemory restores "all" instantly.
        isAllSelected ? (
          <ResetSessionScope
            href={allHref}
            className={cn(
              pill,
              "cursor-pointer font-semibold uppercase tracking-[0.14em]",
              "bg-[linear-gradient(180deg,#f2665c,#c8362f_60%,#a12a24)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_18px_-8px_rgba(232,82,72,0.8)]",
            )}
          >
            All ✓
          </ResetSessionScope>
        ) : (
          <Link
            href={allHref}
            scroll={false}
            className={cn(
              pill,
              "font-semibold uppercase tracking-[0.14em]",
              "border border-[var(--color-pop)]/40 text-[var(--color-pop-bright)] hover:bg-[var(--color-pop)]/15",
            )}
          >
            All
          </Link>
        )
      )}
      {hasMulti && (
        <ResetSessionScope
          href={clearHref}
          className={cn(
            pill,
            "cursor-pointer text-[11px] text-[var(--color-cream)]/50 underline-offset-4 hover:text-[var(--color-brass-bright)] hover:underline sm:ml-auto",
          )}
        >
          Reset
        </ResetSessionScope>
      )}
      </div>
    </div>
  );
}
