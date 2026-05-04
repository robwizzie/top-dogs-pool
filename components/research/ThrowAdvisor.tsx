"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  recommendOpener,
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
  /** Completed matches in scope. */
  matches: Match[];
  /** Pre-built opponent → known-players autocomplete data. */
  opponents: ThrowAdvisorOpponentInfo[];
  /** Default opponent name for the active match (next-up game). */
  defaultOpponent?: string;
  /** Default location for the active match. */
  defaultLocation?: string;
  /** Distinct venues seen across our matches. */
  knownLocations: string[];
};

type Phase = "setup" | "matchup" | "done";

type LiveMatchState = {
  position: number;
  weThrowFirst: boolean;
  /** Their putup name, if entered yet. */
  oppName?: string;
  oppSL?: number;
  /** Our locked-in player, if picked. */
  ourPlayerId?: string;
  ourSkillLevel?: number | null;
};

type Step =
  | "pick-ours" //  we throw first → choose our player blind
  | "enter-theirs" //  we threw first, now logging their counter
  | "enter-theirs-first" //  they throw first → enter their putup
  | "pick-counter" //  they put up → recommend our counter
  | "result"; //  both locked in → enter W/L

/**
 * Live night-long Throw Advisor.
 *
 * Three phases: setup → matchup → done. Inside matchup, a per-match step
 * machine walks the user through:
 *
 *   We throw first              They throw first
 *   --------------------------  ----------------------------
 *   1. Pick our opener          1. Enter their putup
 *   2. Enter their counter      2. Pick our counter
 *   3. Enter result             3. Enter result
 *
 * After each result, the next match's "weThrowFirst" toggle alternates per
 * APA's standard 8-ball putup order. The full log carries forward so the
 * advisor knows who's been used, the running score, and the 23-rule budget
 * left.
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

  // ---------------- Setup state ----------------
  const [phase, setPhase] = useState<Phase>("setup");
  const [opponentTeam, setOpponentTeam] = useState<string>(
    defaultOpponent ?? opponents[0]?.team ?? "",
  );
  const [location, setLocation] = useState<string>(defaultLocation ?? "");
  const [available, setAvailable] = useState<Set<string>>(
    () => new Set(visibleRoster.map((p) => p.id)),
  );
  const [firstPutup, setFirstPutup] = useState<"us" | "them">("us");

  // Re-init available roster if it changes (rare).
  useEffect(() => {
    setAvailable((prev) => {
      const next = new Set(prev);
      for (const id of prev) if (!visibleRoster.find((p) => p.id === id)) next.delete(id);
      for (const p of visibleRoster) if (!prev.has(p.id)) next.add(p.id);
      return next;
    });
  }, [visibleRoster]);

  // ---------------- Matchup state ----------------
  /** Already-completed matches earlier in the night. */
  const [log, setLog] = useState<ThrowMatchLog[]>([]);
  /** The slot we're currently working on. */
  const [live, setLive] = useState<LiveMatchState>({
    position: 1,
    weThrowFirst: true,
  });
  const [step, setStep] = useState<Step>("pick-ours");

  // ---------------- Persist to localStorage --------------------------
  // Resume mid-night refreshes. Stale state (>14h old, or roster mismatch)
  // is auto-cleared so a stale session doesn't haunt next week.
  const STORAGE_KEY = "topDogs.throwAdvisor.v2";
  const STORAGE_TTL_MS = 14 * 60 * 60 * 1000;

  // Load on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        savedAt: number;
        phase: Phase;
        opponentTeam: string;
        location: string;
        availableIds: string[];
        firstPutup: "us" | "them";
        log: ThrowMatchLog[];
        live: LiveMatchState;
        step: Step;
      };
      if (Date.now() - parsed.savedAt > STORAGE_TTL_MS) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      // Sanity-check the available IDs against current roster.
      const validIds = parsed.availableIds.filter((id) =>
        visibleRoster.some((p) => p.id === id),
      );
      if (validIds.length === 0) return;
      setPhase(parsed.phase);
      setOpponentTeam(parsed.opponentTeam);
      setLocation(parsed.location);
      setAvailable(new Set(validIds));
      setFirstPutup(parsed.firstPutup);
      setLog(parsed.log);
      setLive(parsed.live);
      setStep(parsed.step);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    // Only run once on mount; we don't want to auto-overwrite the saved state
    // before the user actually starts editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on every state change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Don't persist a fresh-out-of-the-box setup state with no log.
    if (phase === "setup" && log.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          phase,
          opponentTeam,
          location,
          availableIds: [...available],
          firstPutup,
          log,
          live,
          step,
        }),
      );
    } catch {
      // localStorage full or disabled — silently skip.
    }
  }, [phase, opponentTeam, location, available, firstPutup, log, live, step]);

  // ---------------- Step-change side effects -------------------------
  // Auto-scroll the new step card to the top of the viewport (smooth).
  // Haptic feedback (where supported) on transitions.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (phase === "setup") return;
    // Scroll to top of the throw advisor section (look for our section anchor).
    const target = document.getElementById("throw");
    if (target) {
      const rect = target.getBoundingClientRect();
      const top = window.scrollY + rect.top - 16;
      window.scrollTo({ top, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Light tap-tap haptic if supported.
    if ("vibrate" in window.navigator) {
      try {
        window.navigator.vibrate?.(8);
      } catch {
        /* ignore */
      }
    }
  }, [phase, step, live.position]);

  function startNight() {
    setLog([]);
    setLive({ position: 1, weThrowFirst: firstPutup === "us" });
    setStep(firstPutup === "us" ? "pick-ours" : "enter-theirs-first");
    setPhase("matchup");
  }

  function backToSetup() {
    if (
      log.length > 0 &&
      !window.confirm("Reset the night and go back to setup?")
    )
      return;
    setLog([]);
    setLive({ position: 1, weThrowFirst: firstPutup === "us" });
    setPhase("setup");
  }

  // Advance to the next slot (or "done").
  function advance(completedThrow: ThrowMatchLog) {
    const newLog = [...log.filter((t) => t.position !== completedThrow.position), completedThrow]
      .sort((a, b) => a.position - b.position);
    setLog(newLog);
    if (live.position >= 5) {
      setPhase("done");
      return;
    }
    const nextPos = live.position + 1;
    const nextWeThrowFirst = !live.weThrowFirst; // alternates
    setLive({ position: nextPos, weThrowFirst: nextWeThrowFirst });
    setStep(nextWeThrowFirst ? "pick-ours" : "enter-theirs-first");
  }

  function rewindToMatch(position: number) {
    if (
      !window.confirm(
        `Rewind to Match ${position}? Throws after that will be cleared.`,
      )
    )
      return;
    const newLog = log.filter((t) => t.position < position);
    setLog(newLog);
    // Re-derive whose turn it is. Standard APA: alternates each match.
    const weStart = firstPutup === "us";
    // Match 1: weStart. Match 2: !weStart. etc.
    const weThrowFirst = position % 2 === 1 ? weStart : !weStart;
    setLive({ position, weThrowFirst });
    setStep(weThrowFirst ? "pick-ours" : "enter-theirs-first");
    setPhase("matchup");
  }

  /**
   * Override who throws first for the current match. Used when APA's standard
   * alternation is bent (substitutions, etc.). Resets any in-flight selections
   * for the current slot.
   */
  function swapThrowOrderForCurrent() {
    setLive({ position: live.position, weThrowFirst: !live.weThrowFirst });
    setStep(!live.weThrowFirst ? "pick-ours" : "enter-theirs-first");
  }

  // ---------------- Recommendations ----------------
  const opponentRecord = useMemo(
    () => opponents.find((o) => o.team === opponentTeam),
    [opponents, opponentTeam],
  );
  const knownPutups = opponentRecord?.knownPlayers ?? [];
  /** Names of opponent players already used earlier this night. */
  const oppAlreadyUsed = useMemo(
    () => new Set(log.map((t) => t.oppName)),
    [log],
  );

  /** Opener (blind) recommendation — for when we throw first. */
  const openerResult = useMemo<ThrowAdvisorResult | null>(() => {
    if (phase !== "matchup" || !opponentTeam) return null;
    if (step !== "pick-ours") return null;
    return recommendOpener(
      {
        opponentTeam,
        location: location || undefined,
        currentPosition: live.position,
        availablePlayerIds: available,
        log,
      },
      matches,
      visibleRoster,
    );
  }, [phase, step, opponentTeam, location, live.position, available, log, matches, visibleRoster]);

  /** Counter (informed) recommendation — for when they put up first. */
  const counterResult = useMemo<ThrowAdvisorResult | null>(() => {
    if (phase !== "matchup" || !opponentTeam) return null;
    if (step !== "pick-counter") return null;
    if (!live.oppName || typeof live.oppSL !== "number") return null;
    return recommendThrow(
      {
        opponentTeam,
        location: location || undefined,
        currentPosition: live.position,
        opponentName: live.oppName,
        opponentSkillLevel: live.oppSL,
        availablePlayerIds: available,
        log,
      },
      matches,
      visibleRoster,
    );
  }, [
    phase,
    step,
    opponentTeam,
    location,
    live.position,
    live.oppName,
    live.oppSL,
    available,
    log,
    matches,
    visibleRoster,
  ]);

  // ---------------- Render ----------------
  if (phase === "setup") {
    return (
      <SetupScreen
        opponents={opponents}
        opponentTeam={opponentTeam}
        setOpponentTeam={setOpponentTeam}
        location={location}
        setLocation={setLocation}
        knownLocations={knownLocations}
        roster={visibleRoster}
        available={available}
        setAvailable={setAvailable}
        firstPutup={firstPutup}
        setFirstPutup={setFirstPutup}
        onStart={startNight}
      />
    );
  }

  if (phase === "done") {
    return (
      <DoneScreen
        log={log}
        roster={visibleRoster}
        opponentTeam={opponentTeam}
        onRewind={rewindToMatch}
        onReset={() => setPhase("setup")}
      />
    );
  }

  // Matchup phase
  return (
    <div className="flex flex-col gap-4">
      <NightHeader
        position={live.position}
        weThrowFirst={live.weThrowFirst}
        log={log}
        onBack={backToSetup}
        onRewind={rewindToMatch}
        onSwapOrder={swapThrowOrderForCurrent}
        opponentTeam={opponentTeam}
      />

      {step === "pick-ours" && openerResult && (
        <PickOursStep
          live={live}
          result={openerResult}
          onPick={(c) => {
            setLive((s) => ({
              ...s,
              ourPlayerId: c.playerId,
              ourSkillLevel: c.skillLevel ?? undefined,
            }));
            setStep("enter-theirs");
          }}
        />
      )}

      {step === "enter-theirs" && live.ourPlayerId && (
        <EnterTheirsStep
          ourName={
            visibleRoster.find((p) => p.id === live.ourPlayerId)?.name ?? "?"
          }
          opponentTeam={opponentTeam}
          knownPutups={knownPutups}
          alreadyUsed={oppAlreadyUsed}
          onConfirm={(name, sl) => {
            setLive((s) => ({ ...s, oppName: name, oppSL: sl }));
            setStep("result");
          }}
          onBack={() => {
            setLive((s) => ({ ...s, ourPlayerId: undefined, ourSkillLevel: undefined }));
            setStep("pick-ours");
          }}
        />
      )}

      {step === "enter-theirs-first" && (
        <EnterTheirsStep
          ourName={null}
          opponentTeam={opponentTeam}
          knownPutups={knownPutups}
          alreadyUsed={oppAlreadyUsed}
          onConfirm={(name, sl) => {
            setLive((s) => ({ ...s, oppName: name, oppSL: sl }));
            setStep("pick-counter");
          }}
          onBack={null}
        />
      )}

      {step === "pick-counter" && counterResult && live.oppName && live.oppSL && (
        <PickCounterStep
          live={live}
          result={counterResult}
          onPick={(c) => {
            setLive((s) => ({
              ...s,
              ourPlayerId: c.playerId,
              ourSkillLevel: c.skillLevel ?? undefined,
            }));
            setStep("result");
          }}
          onBack={() => {
            setLive((s) => ({ ...s, oppName: undefined, oppSL: undefined }));
            setStep("enter-theirs-first");
          }}
        />
      )}

      {step === "result" &&
        live.ourPlayerId &&
        live.oppName &&
        typeof live.oppSL === "number" && (
          <ResultStep
            live={live}
            ourName={
              visibleRoster.find((p) => p.id === live.ourPlayerId)?.name ?? "?"
            }
            onSubmit={(outcome) => {
              advance({
                position: live.position,
                ourPlayerId: live.ourPlayerId!,
                ourSkillLevel: live.ourSkillLevel ?? null,
                oppName: live.oppName!,
                oppSkillLevel: live.oppSL!,
                outcome,
              });
            }}
            onBack={() => {
              if (live.weThrowFirst) {
                setLive((s) => ({ ...s, oppName: undefined, oppSL: undefined }));
                setStep("enter-theirs");
              } else {
                setLive((s) => ({ ...s, ourPlayerId: undefined, ourSkillLevel: undefined }));
                setStep("pick-counter");
              }
            }}
          />
        )}

      {log.length > 0 && <ThrowsSoFar log={log} roster={visibleRoster} />}
    </div>
  );
}

/* ============================================================ Setup screen */

function SetupScreen({
  opponents,
  opponentTeam,
  setOpponentTeam,
  location,
  setLocation,
  knownLocations,
  roster,
  available,
  setAvailable,
  firstPutup,
  setFirstPutup,
  onStart,
}: {
  opponents: ThrowAdvisorOpponentInfo[];
  opponentTeam: string;
  setOpponentTeam: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  knownLocations: string[];
  roster: Player[];
  available: Set<string>;
  setAvailable: (v: Set<string>) => void;
  firstPutup: "us" | "them";
  setFirstPutup: (v: "us" | "them") => void;
  onStart: () => void;
}) {
  const ready = !!opponentTeam && available.size >= 5;
  return (
    <div className="space-y-4">
      <StepCard step={1} title="Who are we playing tonight?">
        <select
          value={opponentTeam}
          onChange={(e) => setOpponentTeam(e.target.value)}
          className={inputClass}
        >
          <option value="">Pick a team…</option>
          {opponents.map((o) => (
            <option key={o.team} value={o.team}>
              {o.team}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-[var(--fg-dim)]">
          Defaults to the next scheduled match. The team you pick drives putup
          autocomplete and the vs-team component of every recommendation.
        </p>
      </StepCard>

      <StepCard step={2} title="Where?">
        <input
          list="throw-advisor-venues"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="(optional — venue name)"
          className={inputClass}
        />
        <datalist id="throw-advisor-venues">
          {knownLocations.map((loc) => (
            <option key={loc} value={loc} />
          ))}
        </datalist>
      </StepCard>

      <StepCard
        step={3}
        title="Who's at the bar tonight?"
        action={
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={() => setAvailable(new Set(roster.map((p) => p.id)))}
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
        }
      >
        <div className="flex flex-wrap gap-2">
          {roster.map((p) => {
            const on = available.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const next = new Set(available);
                  if (on) next.delete(p.id);
                  else next.add(p.id);
                  setAvailable(next);
                }}
                className={cn(
                  "min-h-[44px] rounded-full border px-3.5 py-2 text-sm transition-colors",
                  on
                    ? "border-[var(--color-felt-bright)] bg-[var(--color-felt)]/15 text-[var(--color-felt-bright)]"
                    : "border-[var(--border)] text-[var(--fg-dim)]",
                )}
              >
                {on ? "✓ " : ""}
                {p.name}
                {p.skillLevel != null && (
                  <span className="ml-1.5 text-[10px] opacity-70">
                    SL{p.skillLevel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--fg-dim)]">
          {available.size} player{available.size === 1 ? "" : "s"} available
          {available.size < 5 && " — need at least 5 to fill the lineup"}.
        </p>
      </StepCard>

      <StepCard step={4} title="Who puts up first in Match 1?">
        <div className="grid grid-cols-2 gap-2">
          <BigToggle
            on={firstPutup === "us"}
            onClick={() => setFirstPutup("us")}
            label="We do"
            sub="We pick our player blind"
          />
          <BigToggle
            on={firstPutup === "them"}
            onClick={() => setFirstPutup("them")}
            label="They do"
            sub="We see their putup, then counter"
          />
        </div>
        <p className="mt-2 text-xs text-[var(--fg-dim)]">
          Putup order alternates each match per APA 8-ball rules.
        </p>
      </StepCard>

      <button
        type="button"
        disabled={!ready}
        onClick={onStart}
        className="sticky bottom-4 z-10 mt-2 flex w-full min-h-[52px] items-center justify-center gap-2 rounded-full bg-[var(--color-brass)] px-6 py-3 text-base font-semibold text-[var(--color-ink)] shadow-lg transition-colors hover:bg-[var(--color-brass-bright)] disabled:opacity-40"
      >
        Start the night →
      </button>
    </div>
  );
}

/* ============================================================ Night header */

function NightHeader({
  position,
  weThrowFirst,
  log,
  onBack,
  onRewind,
  onSwapOrder,
  opponentTeam,
}: {
  position: number;
  weThrowFirst: boolean;
  log: ThrowMatchLog[];
  onBack: () => void;
  onRewind: (position: number) => void;
  onSwapOrder: () => void;
  opponentTeam: string;
}) {
  const ourScore = log.filter((t) => t.outcome === "W").length;
  const theirScore = log.filter((t) => t.outcome === "L").length;
  const usedSL = log.reduce((s, t) => s + (t.ourSkillLevel ?? 0), 0);
  const remainingSL = 23 - usedSL;
  const remainingSlots = 5 - log.length;

  return (
    <div className="surface sticky top-2 z-20 -mx-1 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg-card)]/85 sm:mx-0">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
        >
          ← Setup
        </button>
        <div className="text-[10px] uppercase tracking-[0.32em] text-[var(--fg-dim)] truncate">
          vs {opponentTeam}
        </div>
        <div className="text-xs tabular-nums text-[var(--fg-dim)]">
          SL <span className={cn("font-semibold", remainingSL < 8 ? "text-[var(--color-pop-bright)]" : "text-[var(--fg)]")}>
            {remainingSL}
          </span>
          /23
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Score
          </span>
          <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
            <span
              className={cn(
                "tabular-nums",
                ourScore > theirScore && "text-[var(--color-felt-bright)]",
                ourScore < theirScore && "text-[var(--color-pop-bright)]",
              )}
            >
              {ourScore}
            </span>
            <span className="mx-1.5 text-[var(--fg-dim)]">–</span>
            <span className="tabular-nums">{theirScore}</span>
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
            Match {position}/5
          </span>
          <button
            type="button"
            onClick={onSwapOrder}
            className="group flex items-center gap-1 text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
            title="Swap who puts up first this match"
          >
            <span>
              {weThrowFirst ? "We put up first" : "They put up first"}
            </span>
            <span className="text-[10px] text-[var(--color-brass)] opacity-70 group-hover:opacity-100">
              ⇄
            </span>
          </button>
          <span className="text-[10px] text-[var(--fg-dim)]">
            {remainingSlots} slot{remainingSlots === 1 ? "" : "s"} left
          </span>
        </div>
      </div>

      {/* Match progress dots */}
      <div className="mt-3 flex justify-between gap-1">
        {[1, 2, 3, 4, 5].map((p) => {
          const entry = log.find((l) => l.position === p);
          const won = entry?.outcome === "W";
          const lost = entry?.outcome === "L";
          const current = p === position && !entry;
          const upcoming = !entry && !current;
          const dotLabel = `Match ${p}${entry ? ` (${entry.outcome === "W" ? "won" : "lost"})` : current ? " (current)" : ""}`;
          return (
            <button
              key={p}
              type="button"
              onClick={() => entry && onRewind(p)}
              aria-label={dotLabel}
              title={dotLabel}
              disabled={!entry}
              className={cn(
                "flex flex-1 items-center justify-center min-h-[36px] rounded-md border-2 text-xs font-semibold transition-colors",
                won && "border-[var(--color-felt-bright)] bg-[var(--color-felt)]/15 text-[var(--color-felt-bright)]",
                lost && "border-[var(--color-pop-bright)] bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]",
                current && "border-[var(--color-brass)] bg-[var(--color-brass)]/10 text-[var(--color-brass-bright)]",
                upcoming && "border-[var(--border)] text-[var(--fg-dim)]",
              )}
            >
              {entry ? (entry.outcome === "W" ? "✓" : "✗") : current ? "●" : p}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ Step: pick ours (blind) */

function PickOursStep({
  live,
  result,
  onPick,
}: {
  live: LiveMatchState;
  result: ThrowAdvisorResult;
  onPick: (c: ThrowCandidate) => void;
}) {
  const top = result.topPick;
  const otherCandidates = result.candidates.filter(
    (c) => c.feasible && c.playerId !== top?.playerId,
  );
  return (
    <div className="space-y-4">
      <PhaseLabel phase="step" text="Step 1 of 3 · Pick our opener" />
      <RecommendationCard
        title={`Match ${live.position} — we put up first`}
        subtitle="Blind throw — they haven't picked yet."
        result={result}
        onLockIn={onPick}
        ctaLabel="Lock in this player"
      />
      {otherCandidates.length > 0 && (
        <CandidateList
          heading="Or choose someone else"
          rows={result.candidates}
          topPickId={top?.playerId}
          onPick={onPick}
        />
      )}
      {top?.saveForLater && (
        <SaveForLaterCallout
          name={top.playerName}
          onUseAnyway={() => onPick(top)}
        />
      )}
    </div>
  );
}

/* ============================================================ Step: enter theirs */

function EnterTheirsStep({
  ourName,
  knownPutups,
  alreadyUsed,
  opponentTeam,
  onConfirm,
  onBack,
}: {
  /** Set when we already locked our pick (we threw first). */
  ourName: string | null;
  knownPutups: ThrowAdvisorOpponentInfo["knownPlayers"];
  /** Names of opponent players already thrown earlier this night. */
  alreadyUsed: Set<string>;
  opponentTeam: string;
  onConfirm: (name: string, sl: number) => void;
  onBack: (() => void) | null;
}) {
  // Selection state — picking a roster card auto-fills SL.
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [sl, setSL] = useState(4);
  // Custom-entry escape hatch for an opponent we don't have history on.
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");

  function pickKnown(name: string, latestSL: number | null) {
    setSelectedName(name);
    setCustomMode(false);
    setCustomName("");
    if (latestSL) setSL(latestSL);
  }

  function startCustom() {
    setCustomMode(true);
    setSelectedName(null);
  }

  const submittedName = customMode ? customName.trim() : selectedName ?? "";
  const valid = submittedName.length > 0;

  // Sort: not-yet-used first, alphabetical inside each group.
  const sorted = useMemo(() => {
    return [...knownPutups].sort((a, b) => {
      const aUsed = alreadyUsed.has(a.name) ? 1 : 0;
      const bUsed = alreadyUsed.has(b.name) ? 1 : 0;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return a.name.localeCompare(b.name);
    });
  }, [knownPutups, alreadyUsed]);

  return (
    <div className="space-y-4">
      <PhaseLabel
        phase="step"
        text={ourName ? "Step 2 of 3 · Enter their counter" : "Step 1 of 3 · Enter their putup"}
      />
      <div className="surface space-y-4 p-5">
        {ourName && (
          <p className="text-sm text-[var(--fg-dim)]">
            We threw{" "}
            <strong className="text-[var(--fg)]">{ourName}</strong>. Who did
            they counter with?
          </p>
        )}

        <div>
          <label className={labelClass}>
            {opponentTeam}&apos;s players
          </label>
          {sorted.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--fg-dim)]">
              No prior history against {opponentTeam}. Use the custom entry
              below.
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {sorted.map((p) => {
                const used = alreadyUsed.has(p.name);
                const active = !customMode && selectedName === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => pickKnown(p.name, p.latestSL)}
                    disabled={used}
                    className={cn(
                      "min-h-[64px] rounded-2xl border-2 px-3 py-2 text-left transition-colors",
                      active
                        ? "border-[var(--color-brass)] bg-[var(--color-brass)]/15"
                        : used
                          ? "border-[var(--border)] bg-[var(--bg-soft)]/40 text-[var(--fg-dim)] line-through"
                          : "border-[var(--border)] hover:border-[var(--color-brass)]/50",
                    )}
                  >
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="text-xs text-[var(--fg-dim)]">
                      {p.latestSL ? `SL${p.latestSL}` : "SL unknown"}
                      {used && " · already thrown"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={startCustom}
            className={cn(
              "mt-2 text-xs font-semibold",
              customMode
                ? "text-[var(--color-brass-bright)]"
                : "text-[var(--color-brass)] hover:underline",
            )}
          >
            {customMode ? "✓ Adding new player" : "+ Other player (not on this list)"}
          </button>
          {customMode && (
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Type their name…"
              className={cn(inputClass, "min-h-[48px] text-base")}
              autoFocus
            />
          )}
        </div>

        <div>
          <label className={labelClass}>Their skill level</label>
          <SLStepper value={sl} onChange={setSL} />
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="min-h-[52px] flex-1 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-base font-semibold text-[var(--fg-dim)] hover:text-[var(--fg)]"
          >
            ← Back
          </button>
        )}
        <button
          type="button"
          disabled={!valid}
          onClick={() => onConfirm(submittedName, sl)}
          className="min-h-[52px] flex-[2] rounded-full bg-[var(--color-brass)] px-6 py-3 text-base font-semibold text-[var(--color-ink)] shadow-lg hover:bg-[var(--color-brass-bright)] disabled:opacity-40"
        >
          {ourName ? "Continue →" : "Find our counter →"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================ Step: pick counter */

function PickCounterStep({
  live,
  result,
  onPick,
  onBack,
}: {
  live: LiveMatchState;
  result: ThrowAdvisorResult;
  onPick: (c: ThrowCandidate) => void;
  onBack: () => void;
}) {
  const top = result.topPick;
  return (
    <div className="space-y-4">
      <PhaseLabel phase="step" text="Step 2 of 3 · Pick our counter" />
      <RecommendationCard
        title={`Match ${live.position} — counter to ${live.oppName} (SL${live.oppSL})`}
        subtitle="They put up — let's match the right player to them."
        result={result}
        onLockIn={onPick}
        ctaLabel="Lock in this counter"
      />
      <CandidateList
        heading="Or choose someone else"
        rows={result.candidates}
        topPickId={top?.playerId}
        onPick={onPick}
      />
      {top?.saveForLater && (
        <SaveForLaterCallout
          name={top.playerName}
          onUseAnyway={() => onPick(top)}
        />
      )}
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
      >
        ← Edit their putup
      </button>
    </div>
  );
}

/* ============================================================ Step: result */

function ResultStep({
  live,
  ourName,
  onSubmit,
  onBack,
}: {
  live: LiveMatchState;
  ourName: string;
  onSubmit: (outcome: "W" | "L") => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <PhaseLabel phase="step" text="Step 3 of 3 · Enter the result" />
      <div className="surface p-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          Match {live.position}
        </p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-2xl tracking-wide">
          {ourName}
          {live.ourSkillLevel != null && (
            <span className="ml-2 text-base text-[var(--fg-dim)]">
              SL{live.ourSkillLevel}
            </span>
          )}
        </p>
        <p className="text-[var(--fg-dim)]">vs</p>
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
          {live.oppName}
          {live.oppSL != null && (
            <span className="ml-2 text-base text-[var(--fg-dim)]">
              SL{live.oppSL}
            </span>
          )}
        </p>
        <p className="mt-4 text-sm text-[var(--fg-dim)]">
          Who won?
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              haptic([20, 30, 40]);
              onSubmit("W");
            }}
            className="min-h-[64px] rounded-2xl border-2 border-[var(--color-felt-bright)] bg-[var(--color-felt)]/15 px-4 py-3 text-lg font-semibold text-[var(--color-felt-bright)] active:scale-95 hover:bg-[var(--color-felt)]/25 transition-transform"
          >
            ✓ We won
          </button>
          <button
            type="button"
            onClick={() => {
              haptic(60);
              onSubmit("L");
            }}
            className="min-h-[64px] rounded-2xl border-2 border-[var(--color-pop-bright)] bg-[var(--color-pop)]/15 px-4 py-3 text-lg font-semibold text-[var(--color-pop-bright)] active:scale-95 hover:bg-[var(--color-pop)]/25 transition-transform"
          >
            ✗ We lost
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-[var(--fg-dim)] hover:text-[var(--fg)]"
      >
        ← Wrong player or putup? Edit
      </button>
    </div>
  );
}

/* ============================================================ Recommendation card */

function RecommendationCard({
  title,
  subtitle,
  result,
  onLockIn,
  ctaLabel,
}: {
  title: string;
  subtitle: string;
  result: ThrowAdvisorResult;
  onLockIn: (c: ThrowCandidate) => void;
  ctaLabel: string;
}) {
  const top = result.topPick;
  if (!top) {
    return (
      <div className="surface p-5">
        <p className="text-sm text-[var(--fg-dim)]">
          No feasible candidates remaining — check the lineup or 23-rule budget.
        </p>
      </div>
    );
  }
  return (
    <div className="surface relative overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(201,162,74,0.18),transparent_60%)]"
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
        {title}
      </p>
      <p className="mt-1 text-xs text-[var(--fg-dim)]">{subtitle}</p>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
            Recommendation
          </p>
          <Link
            href={`/roster/${top.playerId}`}
            className="mt-1 block font-[family-name:var(--font-display)] text-3xl tracking-wide hover:text-[var(--color-brass)]"
          >
            {top.playerName}
            {top.skillLevel != null && (
              <span className="ml-2 text-base text-[var(--fg-dim)]">
                SL{top.skillLevel}
              </span>
            )}
          </Link>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-[var(--color-brass-bright)]">
            {top.overall}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)]">
            Match score
          </span>
        </div>
      </div>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--fg-dim)]">
        {result.context.narrative}
      </p>

      <ul className="mt-3 space-y-1 text-sm">
        {top.reasoning.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 text-[var(--color-brass-bright)]">▸</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      {top.flags.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-[var(--fg-dim)]">
          {top.flags.map((f, i) => (
            <li key={i}>⚠ {f}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <ComponentBar label="H2H" c={top.components.h2h} />
        <ComponentBar label="vs SL" c={top.components.vsSL} />
        <ComponentBar label="Form" c={top.components.form} />
        <ComponentBar label="vs Team" c={top.components.vsTeam} />
        <ComponentBar label="Slot fit" c={top.components.position} />
        <VenueBar c={top.components.venue} />
      </div>

      <LookaheadStrip
        teamValue={top.components.lookahead}
        delta={top.components.lookaheadDelta}
        race={top.components.raceEquity}
      />

      <button
        type="button"
        onClick={() => {
          haptic(15);
          onLockIn(top);
        }}
        className="sticky bottom-4 z-10 mt-5 flex w-full min-h-[52px] items-center justify-center gap-2 rounded-full bg-[var(--color-brass)] px-6 py-3 text-base font-semibold text-[var(--color-ink)] shadow-lg hover:bg-[var(--color-brass-bright)]"
      >
        {ctaLabel} → {top.playerName.split(" ")[0]}
      </button>
    </div>
  );
}

/* ============================================================ Candidate list */

function CandidateList({
  heading,
  rows,
  topPickId,
  onPick,
}: {
  heading: string;
  rows: ThrowCandidate[];
  topPickId?: string;
  onPick: (c: ThrowCandidate) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
        {heading}
      </h3>
      <ul className="space-y-2">
        {rows.map((c) => (
          <CandidateRow
            key={c.playerId}
            candidate={c}
            isTop={c.playerId === topPickId}
            onPick={() => onPick(c)}
          />
        ))}
      </ul>
    </div>
  );
}

function CandidateRow({
  candidate,
  isTop,
  onPick,
}: {
  candidate: ThrowCandidate;
  isTop: boolean;
  onPick: () => void;
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
        className="flex w-full min-h-[56px] flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--bg-soft)]/40"
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
            <VenueBar c={candidate.components.venue} />
          </div>
          <LookaheadStrip
            teamValue={candidate.components.lookahead}
            delta={candidate.components.lookaheadDelta}
            race={candidate.components.raceEquity}
            compact
          />
          <div className="mt-3 flex justify-end text-[11px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                haptic(15);
                onPick();
              }}
              disabled={!candidate.feasible}
              className="font-semibold text-[var(--color-brass)] hover:underline disabled:opacity-40"
            >
              Pick {candidate.playerName.split(" ")[0]} →
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/* ============================================================ Done summary */

function DoneScreen({
  log,
  roster,
  opponentTeam,
  onRewind,
  onReset,
}: {
  log: ThrowMatchLog[];
  roster: Player[];
  opponentTeam: string;
  onRewind: (position: number) => void;
  onReset: () => void;
}) {
  const ourScore = log.filter((t) => t.outcome === "W").length;
  const theirScore = log.filter((t) => t.outcome === "L").length;
  const won = ourScore > theirScore;
  const [copied, setCopied] = useState(false);

  // Confetti on a team win — fire once on mount.
  useEffect(() => {
    if (!won) return;
    haptic([20, 40, 20, 40, 60]);
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("canvas-confetti");
        if (cancelled) return;
        const fire = mod.default;
        fire({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.3 },
          colors: ["#c9a24a", "#f0d27a", "#1f9d55", "#e64a4a"],
        });
        setTimeout(() => fire({ particleCount: 60, spread: 100, origin: { y: 0.5 } }), 350);
      } catch {
        /* canvas-confetti optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [won]);

  function copySummary() {
    const lines: string[] = [
      `🎱 Top Dogs ${ourScore}–${theirScore} ${opponentTeam}${won ? " ✅" : theirScore > ourScore ? " ❌" : ""}`,
      "",
      ...log.map((t) => {
        const player = roster.find((p) => p.id === t.ourPlayerId);
        const us = `${player?.name ?? t.ourPlayerId}${t.ourSkillLevel != null ? ` (SL${t.ourSkillLevel})` : ""}`;
        const them = `${t.oppName}${t.oppSkillLevel != null ? ` (SL${t.oppSkillLevel})` : ""}`;
        const outcome = t.outcome === "W" ? "W" : t.outcome === "L" ? "L" : "·";
        return `M${t.position}: ${us} vs ${them} — ${outcome}`;
      }),
    ];
    const text = lines.join("\n");
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        haptic(20);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        /* ignore */
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface p-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          Night complete · vs {opponentTeam}
        </p>
        <p
          className={cn(
            "mt-2 font-[family-name:var(--font-display)] text-5xl tracking-wide",
            won ? "text-[var(--color-felt-bright)]" : theirScore > ourScore ? "text-[var(--color-pop-bright)]" : "text-[var(--fg)]",
          )}
        >
          {ourScore}–{theirScore}
        </p>
        <p className="mt-2 text-sm text-[var(--fg-dim)]">
          {won ? "Top Dogs win 🐕" : theirScore > ourScore ? "We dropped this one." : "Drawn."}
        </p>
      </div>
      <ThrowsSoFar log={log} roster={roster} onRewind={onRewind} />
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={copySummary}
          className="min-h-[52px] rounded-full border border-[var(--color-brass)]/40 bg-[var(--color-brass)]/10 px-6 py-3 text-base font-semibold text-[var(--color-brass-bright)] hover:bg-[var(--color-brass)]/20"
        >
          {copied ? "✓ Copied to clipboard" : "📋 Copy night summary"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="min-h-[52px] rounded-full border border-[var(--border)] px-6 py-3 text-base font-semibold text-[var(--fg-dim)] hover:text-[var(--fg)]"
        >
          Start a new night
        </button>
      </div>
    </div>
  );
}

/* ============================================================ Throws so far */

function ThrowsSoFar({
  log,
  roster,
  onRewind,
}: {
  log: ThrowMatchLog[];
  roster: Player[];
  onRewind?: (position: number) => void;
}) {
  return (
    <details className="surface group" open={log.length <= 3}>
      <summary className="cursor-pointer list-none px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          Throws so far ({log.length}/5)
        </span>
        <span className="ml-2 text-xs text-[var(--fg-dim)] group-open:hidden">— tap to view</span>
      </summary>
      <ul className="divide-y divide-[var(--border)]">
        {log.map((t) => {
          const player = roster.find((p) => p.id === t.ourPlayerId);
          return (
            <li
              key={t.position}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                <span className="font-[family-name:var(--font-display)] text-lg tracking-wide text-[var(--color-brass-bright)]">
                  M{t.position}
                </span>
                <span className="truncate">
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
              {onRewind && (
                <button
                  type="button"
                  onClick={() => onRewind(t.position)}
                  className="text-xs text-[var(--fg-dim)] hover:text-[var(--color-pop-bright)]"
                >
                  Rewind
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/* ============================================================ Save-for-later callout */

function SaveForLaterCallout({
  name,
  onUseAnyway,
}: {
  name: string;
  onUseAnyway: () => void;
}) {
  return (
    <div className="surface flex flex-wrap items-center justify-between gap-3 border-[var(--color-brass)]/40 p-4">
      <p className="text-sm text-[var(--fg-dim)]">
        💡 The system flagged{" "}
        <strong className="text-[var(--color-brass-bright)]">{name}</strong> as
        a &ldquo;save-for-later&rdquo; pick.
      </p>
      <button
        type="button"
        onClick={onUseAnyway}
        className="text-xs font-semibold text-[var(--color-brass)] hover:underline"
      >
        Use them anyway →
      </button>
    </div>
  );
}

/* ============================================================ tiny atoms */

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2.5 text-sm placeholder:text-[var(--fg-dim)] focus:border-[var(--color-brass)] focus:outline-none";
const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]";

function StepCard({
  step,
  title,
  action,
  children,
}: {
  step: number;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--color-brass-bright)]">
            {step}
          </span>
          <h3 className="font-[family-name:var(--font-display)] text-lg tracking-wide">
            {title}
          </h3>
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PhaseLabel({ phase, text }: { phase: "step"; text: string }) {
  void phase;
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
      {text}
    </p>
  );
}

function BigToggle({
  on,
  onClick,
  label,
  sub,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[72px] rounded-2xl border-2 px-4 py-3 text-left transition-colors",
        on
          ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10"
          : "border-[var(--border)] hover:border-[var(--color-brass)]/50",
      )}
    >
      <div className="font-semibold">{label}</div>
      <div className="text-xs text-[var(--fg-dim)]">{sub}</div>
    </button>
  );
}

function SLStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(2, value - 1))}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] text-xl font-semibold hover:border-[var(--color-brass)]"
        aria-label="Decrease SL"
      >
        −
      </button>
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-3">
        <span className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--color-brass-bright)]">
          SL{value}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(7, value + 1))}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] text-xl font-semibold hover:border-[var(--color-brass)]"
        aria-label="Increase SL"
      >
        +
      </button>
    </div>
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
  return null;
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

/** Same shape as ComponentBar but rendered in a muted "info only" treatment. */
function VenueBar({ c }: { c: ThrowComponentScore }) {
  const pct = c.noData ? 0 : Math.round(c.smoothed);
  return (
    <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 opacity-80">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          Venue <span className="ml-1 normal-case tracking-normal opacity-60">(info)</span>
        </span>
        <span className="tabular-nums text-[var(--fg-dim)]">
          {c.noData ? "—" : `${c.wins}-${c.losses}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-[var(--bg-soft)]">
        <div
          className="h-full rounded-full bg-[var(--fg-dim)]/40"
          style={{ width: `${c.noData ? 0 : pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Lookahead + race-chart strip — small horizontal info row that prints two
 * lineup-wide signals next to each other:
 *   - Team value (lookahead): how good is the rest of the night if we lock
 *     this player here? Higher is better. Delta vs the team-optimal pick is
 *     shown as a coloured ± nudge.
 *   - Race-chart equity: APA's asymmetric race chart, > 50 = race favors us.
 */
function LookaheadStrip({
  teamValue,
  delta,
  race,
  compact = false,
}: {
  teamValue: number;
  delta: number;
  race: number;
  compact?: boolean;
}) {
  const isOptimal = delta >= -0.5;
  const deltaCls = isOptimal
    ? "text-[var(--color-felt-bright)]"
    : delta >= -5
      ? "text-[var(--color-brass-bright)]"
      : "text-[var(--color-pop-bright)]";
  return (
    <div
      className={cn(
        "mt-3 grid grid-cols-2 gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-soft)]/50 px-3 py-2 text-[11px]",
        compact && "mt-2",
      )}
    >
      <div>
        <div className="font-semibold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          Lineup look-ahead
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="font-semibold tabular-nums text-[var(--fg)]">
            {teamValue}
          </span>
          <span className={cn("tabular-nums", deltaCls)}>
            {isOptimal ? "team-optimal" : `${delta.toFixed(1)} vs best`}
          </span>
        </div>
      </div>
      <div>
        <div className="font-semibold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          Race equity
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span
            className={cn(
              "font-semibold tabular-nums",
              race >= 55
                ? "text-[var(--color-felt-bright)]"
                : race <= 45
                  ? "text-[var(--color-pop-bright)]"
                  : "text-[var(--fg)]",
            )}
          >
            {race}%
          </span>
          <span className="text-[var(--fg-dim)]">
            {race >= 55 ? "favors us" : race <= 45 ? "favors them" : "even"}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Lightweight haptic helper — runs only when the browser supports it. */
function haptic(pattern: number | number[]) {
  if (typeof window === "undefined") return;
  if (!("vibrate" in window.navigator)) return;
  try {
    window.navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
