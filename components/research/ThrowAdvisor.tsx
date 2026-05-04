"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  recommendThrow,
  type ThrowAdvisorOpponentInfo,
  type ThrowAdvisorResult,
  type ThrowCandidate,
  type ThrowComponentScore,
  type ThrowMatchLog,
} from "@/lib/research";
import type { Match, Player } from "@/lib/apa/schemas";
import { cn } from "@/lib/utils";

type Props = {
  /** Active roster (visible only). */
  roster: Player[];
  /** Completed matches in scope (server-filtered). */
  matches: Match[];
  /** Pre-built opponent → known players autocomplete data. */
  opponents: ThrowAdvisorOpponentInfo[];
  /** Default opponent name for the active match (next-up game). */
  defaultOpponent?: string;
  /** Default location for the active match. */
  defaultLocation?: string;
  /** Distinct venues seen across our matches (for the bar dropdown). */
  knownLocations: string[];
};

/**
 * Live-night throw advisor.
 *
 * Inputs (auto-filled where possible):
 *   - Opponent team & venue   ← default to the next-up scheduled match
 *   - Match number (1..5)
 *   - Opponent putup (name + SL) — autocompleted from prior history
 *   - Available players       (toggle anyone not at the bar tonight)
 *   - Throws-so-far log       (running record of who we've already used)
 *
 * Output: ranked candidates with full reasoning, plus a strategic narrative
 * (urgency, 23-rule budget, save-for-later guidance).
 */
export function ThrowAdvisor({
  roster,
  matches,
  opponents,
  defaultOpponent,
  defaultLocation,
  knownLocations,
}: Props) {
  const visibleRoster = useMemo(
    () => roster.filter((p) => p.visible !== false),
    [roster],
  );

  // --- Form state ------------------------------------------------------------
  const [opponentTeam, setOpponentTeam] = useState<string>(
    defaultOpponent ?? opponents[0]?.team ?? "",
  );
  const [location, setLocation] = useState<string>(defaultLocation ?? "");
  const [matchPosition, setMatchPosition] = useState<number>(1);
  const [opponentName, setOpponentName] = useState<string>("");
  const [opponentSL, setOpponentSL] = useState<number>(4);

  // Available roster — defaults to "everyone here".
  const [available, setAvailable] = useState<Set<string>>(
    () => new Set(visibleRoster.map((p) => p.id)),
  );

  // Throws so far tonight.
  const [log, setLog] = useState<ThrowMatchLog[]>([]);

  // Re-init available set if the roster reference changes (rare).
  useEffect(() => {
    setAvailable((prev) => {
      const next = new Set(prev);
      // Drop anyone no longer in roster.
      for (const id of prev) if (!visibleRoster.find((p) => p.id === id)) next.delete(id);
      // Add new visible roster members.
      for (const p of visibleRoster) if (!prev.has(p.id)) next.add(p.id);
      return next;
    });
  }, [visibleRoster]);

  // The opponent picker drives what putup names we autocomplete.
  const opponentRecord = useMemo(
    () => opponents.find((o) => o.team === opponentTeam),
    [opponents, opponentTeam],
  );
  const knownPutups = opponentRecord?.knownPlayers ?? [];

  // When user picks a known opponent player, prefill the SL.
  function pickOpponentPlayer(name: string) {
    setOpponentName(name);
    const match = knownPutups.find((p) => p.name === name);
    if (match?.latestSL) setOpponentSL(match.latestSL);
    if (match?.preferredPosition) setMatchPosition(match.preferredPosition);
  }

  // --- Compute recommendation -----------------------------------------------
  const result = useMemo<ThrowAdvisorResult | null>(() => {
    if (!opponentTeam || !opponentName.trim()) return null;
    return recommendThrow(
      {
        opponentTeam,
        location: location || undefined,
        currentPosition: matchPosition,
        opponentName: opponentName.trim(),
        opponentSkillLevel: opponentSL,
        availablePlayerIds: available,
        log,
      },
      matches,
      visibleRoster,
    );
  }, [
    opponentTeam,
    location,
    matchPosition,
    opponentName,
    opponentSL,
    available,
    log,
    matches,
    visibleRoster,
  ]);

  // --- Throw log handlers ---------------------------------------------------
  function lockInThrow(candidate: ThrowCandidate, outcome: "W" | "L" | "pending") {
    setLog((prev) => {
      const filtered = prev.filter((t) => t.position !== matchPosition);
      return [
        ...filtered,
        {
          position: matchPosition,
          ourPlayerId: candidate.playerId,
          ourSkillLevel: candidate.skillLevel,
          oppName: opponentName.trim(),
          oppSkillLevel: opponentSL,
          outcome,
        },
      ].sort((a, b) => a.position - b.position);
    });
    // Advance to the next un-played slot if any.
    const usedPositions = new Set([
      ...log.map((t) => t.position),
      matchPosition,
    ]);
    const next = [1, 2, 3, 4, 5].find((p) => !usedPositions.has(p));
    if (next) {
      setMatchPosition(next);
      setOpponentName("");
    }
  }

  function removeFromLog(position: number) {
    setLog((prev) => prev.filter((t) => t.position !== position));
  }

  function resetNight() {
    setLog([]);
    setMatchPosition(1);
    setOpponentName("");
  }

  function toggleAvailable(id: string) {
    setAvailable((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const positionsLockedIn = new Set(log.map((t) => t.position));
  const isRedoingSlot = positionsLockedIn.has(matchPosition);

  // --- Render ---------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* Setup card */}
      <div className="surface space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opponent team">
            <select
              value={opponentTeam}
              onChange={(e) => {
                setOpponentTeam(e.target.value);
                setOpponentName("");
              }}
              className={inputClass}
            >
              <option value="">Pick a team…</option>
              {opponents.map((o) => (
                <option key={o.team} value={o.team}>
                  {o.team}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bar / venue">
            <input
              list="throw-advisor-venues"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="(optional)"
              className={inputClass}
            />
            <datalist id="throw-advisor-venues">
              {knownLocations.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </Field>
        </div>

        <div>
          <label className={labelClass}>Match of the night</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((p) => {
              const lockedIn = positionsLockedIn.has(p);
              const active = p === matchPosition;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMatchPosition(p)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                    active
                      ? "border-[var(--color-brass)] bg-[var(--color-brass)] text-[var(--color-ink)]"
                      : lockedIn
                        ? "border-[var(--color-felt-bright)]/40 bg-[var(--color-felt)]/10 text-[var(--color-felt-bright)]"
                        : "border-[var(--border)] text-[var(--fg-dim)] hover:border-[var(--color-brass)]",
                  )}
                >
                  Match {p}
                  {lockedIn && <span className="ml-1.5 text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Opponent putup">
            <input
              list={`throw-advisor-players-${opponentTeam.replace(/\s+/g, "-")}`}
              value={opponentName}
              onChange={(e) => pickOpponentPlayer(e.target.value)}
              placeholder={
                knownPutups.length > 0
                  ? "Type or pick a known name…"
                  : "Type their name…"
              }
              className={inputClass}
              disabled={!opponentTeam}
            />
            {knownPutups.length > 0 && (
              <datalist
                id={`throw-advisor-players-${opponentTeam.replace(/\s+/g, "-")}`}
              >
                {knownPutups.map((p) => (
                  <option
                    key={p.name}
                    value={p.name}
                    label={p.latestSL ? `SL${p.latestSL}` : ""}
                  />
                ))}
              </datalist>
            )}
          </Field>
          <Field label="Their SL">
            <select
              value={opponentSL}
              onChange={(e) => setOpponentSL(parseInt(e.target.value, 10))}
              className={inputClass}
            >
              {[2, 3, 4, 5, 6, 7].map((sl) => (
                <option key={sl} value={sl}>
                  SL{sl}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Available roster */}
        <div>
          <div className="flex items-baseline justify-between">
            <label className={labelClass}>Who&apos;s at the bar tonight?</label>
            <div className="flex gap-3 text-[11px]">
              <button
                type="button"
                onClick={() => setAvailable(new Set(visibleRoster.map((p) => p.id)))}
                className="text-[var(--color-brass)] hover:underline"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setAvailable(new Set())}
                className="text-[var(--fg-dim)] hover:underline"
              >
                None
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleRoster.map((p) => {
              const on = available.has(p.id);
              const used = log.some((t) => t.ourPlayerId === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleAvailable(p.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    used
                      ? "border-[var(--border)] bg-[var(--bg-soft)] text-[var(--fg-dim)] line-through"
                      : on
                        ? "border-[var(--color-felt-bright)] bg-[var(--color-felt)]/15 text-[var(--color-felt-bright)]"
                        : "border-[var(--border)] text-[var(--fg-dim)] hover:border-[var(--color-brass)]",
                  )}
                  disabled={used}
                  title={used ? "Already thrown tonight" : on ? "Available" : "Tap to mark available"}
                >
                  {p.name}
                  {p.skillLevel != null && (
                    <span className="ml-1 text-[10px] opacity-70">
                      SL{p.skillLevel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live state strip */}
      {result && (
        <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <UrgencyChip urgency={result.context.urgency} />
            <span className="text-[var(--fg-dim)]">
              Score:{" "}
              <span className="font-semibold tabular-nums text-[var(--fg)]">
                {result.context.ourScore}–{result.context.theirScore}
              </span>
            </span>
            <span className="text-[var(--fg-dim)]">
              23-rule:{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  result.context.remainingSLBudget < 10
                    ? "text-[var(--color-pop-bright)]"
                    : "text-[var(--fg)]",
                )}
              >
                {result.context.remainingSLBudget} SL left
              </span>
              <span className="text-[var(--fg-dim)]">
                {" "}
                / {result.context.remainingPositionsAfter + 1} slot
                {result.context.remainingPositionsAfter === 0 ? "" : "s"}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={resetNight}
            className="text-xs text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)]"
          >
            Reset night
          </button>
        </div>
      )}

      {/* Top-pick callout + candidate list */}
      {result && result.candidates.length > 0 && (
        <>
          {result.topPick && (
            <TopPickCallout
              candidate={result.topPick}
              narrative={result.context.narrative}
              onLockIn={(outcome) => lockInThrow(result.topPick!, outcome)}
              isRedoingSlot={isRedoingSlot}
              currentPosition={matchPosition}
            />
          )}

          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              Full ranking
            </h3>
            <ul className="space-y-2">
              {result.candidates.map((c) => (
                <CandidateRow
                  key={c.playerId}
                  candidate={c}
                  isTop={c.playerId === result.topPick?.playerId}
                  onLockIn={(outcome) => lockInThrow(c, outcome)}
                />
              ))}
            </ul>
          </div>
        </>
      )}

      {!result && opponentTeam && !opponentName.trim() && (
        <p className="surface p-6 text-sm text-[var(--fg-dim)]">
          Enter the opponent&apos;s putup name and skill level to get a recommendation.
        </p>
      )}
      {!opponentTeam && (
        <p className="surface p-6 text-sm text-[var(--fg-dim)]">
          Pick the opponent team you&apos;re playing tonight to begin.
        </p>
      )}

      {/* Throws so far */}
      {log.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Throws so far tonight
          </h3>
          <ul className="surface divide-y divide-[var(--border)]">
            {log.map((t) => {
              const player = visibleRoster.find((p) => p.id === t.ourPlayerId);
              return (
                <li
                  key={t.position}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-[family-name:var(--font-display)] text-lg tracking-wide text-[var(--color-brass-bright)]">
                      M{t.position}
                    </span>
                    <span>
                      <strong>{player?.name ?? t.ourPlayerId}</strong>
                      {t.ourSkillLevel != null && (
                        <span className="ml-1 text-xs text-[var(--fg-dim)]">
                          SL{t.ourSkillLevel}
                        </span>
                      )}
                      <span className="text-[var(--fg-dim)]"> vs </span>
                      <span>{t.oppName}</span>
                      {t.oppSkillLevel != null && (
                        <span className="ml-1 text-xs text-[var(--fg-dim)]">
                          SL{t.oppSkillLevel}
                        </span>
                      )}
                    </span>
                    <OutcomePill outcome={t.outcome} />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromLog(t.position)}
                    className="text-xs text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)]"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2 text-sm placeholder:text-[var(--fg-dim)] focus:border-[var(--color-brass)] focus:outline-none disabled:opacity-50";
const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function UrgencyChip({ urgency }: { urgency: ThrowAdvisorResult["context"]["urgency"] }) {
  const map = {
    "must-win": {
      label: "Must-win mode",
      cls: "bg-[var(--color-pop)]/20 text-[var(--color-pop-bright)] border-[var(--color-pop-bright)]/40",
    },
    leverage: {
      label: "Leverage",
      cls: "bg-[var(--color-felt)]/15 text-[var(--color-felt-bright)] border-[var(--color-felt-bright)]/40",
    },
    comfortable: {
      label: "Cushion",
      cls: "bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)] border-[var(--color-brass)]/40",
    },
    even: {
      label: "Tied",
      cls: "border-[var(--border)] text-[var(--fg-dim)]",
    },
  } as const;
  const v = map[urgency];
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]",
        v.cls,
      )}
    >
      {v.label}
    </span>
  );
}

function OutcomePill({ outcome }: { outcome: ThrowMatchLog["outcome"] }) {
  if (outcome === "W")
    return (
      <span className="rounded-full bg-[var(--color-felt)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-felt-bright)]">
        Win
      </span>
    );
  if (outcome === "L")
    return (
      <span className="rounded-full bg-[var(--color-pop)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-pop-bright)]">
        Loss
      </span>
    );
  return (
    <span className="rounded-full bg-[var(--bg-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
      Pending
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: ThrowCandidate["verdict"] }) {
  const map = {
    "top-pick": { label: "Top pick", cls: "bg-[var(--color-brass)] text-[var(--color-ink)]" },
    strong: { label: "Strong", cls: "bg-[var(--color-felt)]/25 text-[var(--color-felt-bright)]" },
    viable: { label: "Viable", cls: "bg-[var(--bg-soft)] text-[var(--fg)]" },
    save: { label: "Save for later", cls: "bg-[var(--color-brass)]/15 text-[var(--color-brass-bright)] border border-[var(--color-brass)]/40" },
    stretch: { label: "Stretch", cls: "bg-[var(--bg-soft)] text-[var(--fg-dim)]" },
    infeasible: { label: "Locks budget", cls: "bg-[var(--color-pop)]/20 text-[var(--color-pop-bright)]" },
  } as const;
  const v = map[verdict];
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]",
        v.cls,
      )}
    >
      {v.label}
    </span>
  );
}

function TopPickCallout({
  candidate,
  narrative,
  onLockIn,
  isRedoingSlot,
  currentPosition,
}: {
  candidate: ThrowCandidate;
  narrative: string;
  onLockIn: (outcome: "W" | "L" | "pending") => void;
  isRedoingSlot: boolean;
  currentPosition: number;
}) {
  return (
    <div className="surface relative overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(201,162,74,0.18),transparent_60%)]"
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Recommendation · Match {currentPosition}
          </p>
          <Link
            href={`/roster/${candidate.playerId}`}
            className="mt-1 block font-[family-name:var(--font-display)] text-3xl tracking-wide hover:text-[var(--color-brass)]"
          >
            {candidate.playerName}
            {candidate.skillLevel != null && (
              <span className="ml-2 text-base text-[var(--fg-dim)]">
                SL{candidate.skillLevel}
              </span>
            )}
          </Link>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--fg-dim)]">
            {narrative}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-[var(--color-brass-bright)]">
            {candidate.overall}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
            Match score
          </span>
        </div>
      </div>

      {/* Reasoning */}
      <ul className="mt-4 space-y-1 text-sm">
        {candidate.reasoning.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 text-[var(--color-brass-bright)]">▸</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      {candidate.flags.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-[var(--fg-dim)]">
          {candidate.flags.map((f, i) => (
            <li key={i}>⚠ {f}</li>
          ))}
        </ul>
      )}

      {/* Component grid */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <ComponentBar label="H2H" c={candidate.components.h2h} />
        <ComponentBar label="vs SL" c={candidate.components.vsSL} />
        <ComponentBar label="Form" c={candidate.components.form} />
        <ComponentBar label="vs Team" c={candidate.components.vsTeam} />
        <ComponentBar label="Slot fit" c={candidate.components.position} />
        <ComponentBar label="Venue" c={candidate.components.venue} />
      </div>

      {/* Lock-in buttons */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onLockIn("pending")}
          className="rounded-full bg-[var(--color-brass)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-brass-bright)]"
        >
          {isRedoingSlot ? "Update slot" : "Lock in"} →
        </button>
        <button
          type="button"
          onClick={() => onLockIn("W")}
          className="rounded-full border border-[var(--color-felt-bright)]/40 px-4 py-2 text-sm font-semibold text-[var(--color-felt-bright)] hover:bg-[var(--color-felt)]/15"
        >
          Lock + Won
        </button>
        <button
          type="button"
          onClick={() => onLockIn("L")}
          className="rounded-full border border-[var(--color-pop-bright)]/40 px-4 py-2 text-sm font-semibold text-[var(--color-pop-bright)] hover:bg-[var(--color-pop)]/15"
        >
          Lock + Lost
        </button>
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  isTop,
  onLockIn,
}: {
  candidate: ThrowCandidate;
  isTop: boolean;
  onLockIn: (outcome: "pending") => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li
      className={cn(
        "surface overflow-hidden",
        isTop && "border-[var(--color-brass)]/60",
        !candidate.feasible && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--bg-soft)]/40"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-3">
          <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--color-brass-bright)] tabular-nums">
            {candidate.overall}
          </span>
          <span className="font-medium">{candidate.playerName}</span>
          {candidate.skillLevel != null && (
            <span className="text-xs text-[var(--fg-dim)]">SL{candidate.skillLevel}</span>
          )}
          <VerdictBadge verdict={candidate.verdict} />
        </div>
        <span className="text-xs text-[var(--fg-dim)]">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-soft)]/30 px-4 py-3 text-sm">
          {candidate.reasoning.length > 0 && (
            <ul className="space-y-1">
              {candidate.reasoning.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 text-[var(--color-brass-bright)]">▸</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {candidate.flags.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-[var(--fg-dim)]">
              {candidate.flags.map((f, i) => (
                <li key={i}>⚠ {f}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <ComponentBar label="H2H" c={candidate.components.h2h} />
            <ComponentBar label="vs SL" c={candidate.components.vsSL} />
            <ComponentBar label="Form" c={candidate.components.form} />
            <ComponentBar label="vs Team" c={candidate.components.vsTeam} />
            <ComponentBar label="Slot fit" c={candidate.components.position} />
            <ComponentBar label="Venue" c={candidate.components.venue} />
          </div>
          <div className="mt-3 flex justify-between text-[11px] text-[var(--fg-dim)]">
            <span>
              Race-chart equity:{" "}
              <span className="font-semibold text-[var(--fg)]">
                {candidate.components.raceEquity}%
              </span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLockIn("pending");
              }}
              disabled={!candidate.feasible}
              className="text-[var(--color-brass)] hover:underline disabled:opacity-40"
            >
              Lock in this player →
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function ComponentBar({ label, c }: { label: string; c: ThrowComponentScore }) {
  const pct = c.noData ? 0 : Math.round(c.smoothed);
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          {label}
        </span>
        <span className="tabular-nums text-[var(--fg-dim)]">
          {c.noData ? "—" : `${c.wins}-${c.losses}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-[var(--bg-soft)]">
        <div
          className={cn(
            "h-full rounded-full",
            pct >= 60
              ? "bg-[var(--color-felt-bright)]"
              : pct >= 45
                ? "bg-[var(--color-brass)]"
                : "bg-[var(--color-pop)]",
          )}
          style={{ width: `${c.noData ? 0 : pct}%` }}
        />
      </div>
    </div>
  );
}
