/**
 * Helpers for the multi-session selector. The URL `?session=` param can be:
 *   - missing            → default scope (current session)
 *   - `all`              → every session in the snapshot
 *   - `138`              → just session 138
 *   - `138,137,136`      → multiple sessions, combined
 *
 * `parseSessionScope` normalizes any of those into a `Set<number> | null`,
 * where `null` means "no explicit selection — use the default the page wants".
 *
 * `serializeSessionScope` is the inverse — given a desired selection, returns
 * the URL form (used by SessionPicker to build toggle links).
 */

export type SessionScope =
  | { kind: "default" }
  | { kind: "all" }
  | { kind: "subset"; ids: Set<number> };

export function parseSessionScope(
  param: string | undefined,
  allSessionIds: number[],
): SessionScope {
  if (!param) return { kind: "default" };
  if (param === "all") return { kind: "all" };
  const ids = param
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && allSessionIds.includes(n));
  if (ids.length === 0) return { kind: "default" };
  if (ids.length === allSessionIds.length) return { kind: "all" };
  return { kind: "subset", ids: new Set(ids) };
}

/** Resolve a scope to the actual id set used to filter data. `default` becomes
 *  `[currentId]` if currentId is provided, else all. */
export function resolveScope(
  scope: SessionScope,
  allSessionIds: number[],
  currentId: number | null | undefined,
): Set<number> {
  if (scope.kind === "all") return new Set(allSessionIds);
  if (scope.kind === "subset") return scope.ids;
  // default
  if (currentId !== null && currentId !== undefined) return new Set([currentId]);
  return new Set(allSessionIds);
}

/** Build a URL query value for a given session selection. */
export function serializeSessionScope(
  selectedIds: Set<number>,
  allSessionIds: number[],
): string | null {
  if (selectedIds.size === 0) return null;
  if (allSessionIds.every((id) => selectedIds.has(id))) return "all";
  return [...selectedIds].sort((a, b) => b - a).join(",");
}

/** Toggle one session id in/out of a selection. */
export function toggleSessionInScope(
  selectedIds: Set<number>,
  id: number,
): Set<number> {
  const next = new Set(selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Pretty label for the active scope, used in subtitles. */
export function scopeLabel(
  selectedIds: Set<number>,
  allSessions: Array<{ id: number; name: string }>,
): string {
  if (selectedIds.size === 0) return "—";
  if (selectedIds.size === allSessions.length) return "All Time";
  if (selectedIds.size === 1) {
    const only = [...selectedIds][0];
    return allSessions.find((s) => s.id === only)?.name ?? "Session";
  }
  return `${selectedIds.size} sessions`;
}
