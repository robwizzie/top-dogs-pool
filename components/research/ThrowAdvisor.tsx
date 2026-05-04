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
import { winsRequired } from "@/lib/apa/race";
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
  const knownPutups = useMemo(
    () => opponentRecord?.knownPlayers ?? [],
    [opponentRecord],
  );
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
        // Adversarial opener: when we throw first, the opponent counter-picks.
        // Pass the opponent's roster so the engine can find each candidate's
        // worst-case counter and rank by minimax.
        opponentRoster: knownPutups.map((p) => ({
          name: p.name,
          latestSL: p.latestSL,
        })),
      },
      matches,
      visibleRoster,
    );
  }, [phase, step, opponentTeam, location, live.position, available, log, matches, visibleRoster, knownPutups]);

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
        // Pass the opponent's known roster so the engine can see what
        // tougher matchups are still on their bench (drives "save your SL7
        // for their SL7" save-for-later logic).
        opponentRoster: knownPutups.map((p) => ({
          name: p.name,
          latestSL: p.latestSL,
        })),
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
    knownPutups,
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
        activeResult={counterResult ?? openerResult ?? null}
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
            onSubmit={(outcome, ourGames, theirGames) => {
              advance({
                position: live.position,
                ourPlayerId: live.ourPlayerId!,
                ourSkillLevel: live.ourSkillLevel ?? null,
                oppName: live.oppName!,
                oppSkillLevel: live.oppSL!,
                outcome,
                ourGames,
                theirGames,
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
  activeResult,
}: {
  position: number;
  weThrowFirst: boolean;
  log: ThrowMatchLog[];
  onBack: () => void;
  onRewind: (position: number) => void;
  onSwapOrder: () => void;
  opponentTeam: string;
  /** Latest recommendation result, when one is computed. Drives night win prob + bench display. */
  activeResult: ThrowAdvisorResult | null;
}) {
  const ourScore = log.filter((t) => t.outcome === "W").length;
  const theirScore = log.filter((t) => t.outcome === "L").length;
  const usedSL = log.reduce((s, t) => s + (t.ourSkillLevel ?? 0), 0);
  const remainingSL = 23 - usedSL;
  const remainingSlots = 5 - log.length;
  // First-to-3 individual matches clinches the night.
  const usToClinch = Math.max(0, 3 - ourScore);
  const themToClinch = Math.max(0, 3 - theirScore);
  const ourGamesTotal = log.reduce((s, t) => s + (t.ourGames ?? 0), 0);
  const theirGamesTotal = log.reduce((s, t) => s + (t.theirGames ?? 0), 0);
  const haveGameScores = log.some((t) => typeof t.ourGames === "number");
  // Status callout — what we need.
  let statusText = "";
  if (ourScore >= 3) statusText = "🐕 Clinched!";
  else if (theirScore >= 3) statusText = "Match lost";
  else if (usToClinch === 1 && themToClinch === 1)
    statusText = "Win-or-go-home — both 1 win away";
  else if (usToClinch <= themToClinch)
    statusText = `${usToClinch} more to clinch`;
  else statusText = `${themToClinch} away · we need ${usToClinch}`;
  const statusTone =
    ourScore >= 3
      ? "text-[var(--color-felt-bright)]"
      : theirScore >= 3
        ? "text-[var(--color-pop-bright)]"
        : usToClinch <= themToClinch
          ? "text-[var(--color-felt-bright)]"
          : "text-[var(--color-pop-bright)]";

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
            Match score
          </span>
          <span className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-wide">
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
          <span className={cn("mt-0.5 text-[10px] font-semibold uppercase tracking-[0.24em]", statusTone)}>
            {statusText}
          </span>
          {haveGameScores && (
            <span className="text-[10px] text-[var(--fg-dim)] tabular-nums">
              Games: {ourGamesTotal}–{theirGamesTotal}
            </span>
          )}
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

      {/* Clinch progress — race-to-3 visualization */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ClinchPips count={ourScore} accent="felt" />
        <ClinchPips count={theirScore} accent="pop" alignRight />
      </div>

      {/* Night win probability + opponent's bench */}
      {activeResult && (
        <NightProbStrip
          nightProb={activeResult.context.nightWinProbability}
          ci={activeResult.context.nightWinProbabilityCI}
          pendingSLs={activeResult.context.pendingOpponentSLs}
        />
      )}

      {/* Match progress dots */}
      <div className="mt-3 flex justify-between gap-1">
        {[1, 2, 3, 4, 5].map((p) => {
          const entry = log.find((l) => l.position === p);
          const won = entry?.outcome === "W";
          const lost = entry?.outcome === "L";
          const current = p === position && !entry;
          const upcoming = !entry && !current;
          const hasScore =
            entry && typeof entry.ourGames === "number" && typeof entry.theirGames === "number";
          const scoreText = hasScore ? `${entry!.ourGames}-${entry!.theirGames}` : null;
          const isSweep =
            entry && typeof entry.ourGames === "number" && typeof entry.theirGames === "number" &&
            ((entry.outcome === "W" && entry.theirGames === 0) ||
              (entry.outcome === "L" && entry.ourGames === 0));
          const dotLabel = `Match ${p}${entry ? ` (${entry.outcome === "W" ? "won" : "lost"}${scoreText ? ` ${scoreText}` : ""})` : current ? " (current)" : ""}`;
          return (
            <button
              key={p}
              type="button"
              onClick={() => entry && onRewind(p)}
              aria-label={dotLabel}
              title={dotLabel}
              disabled={!entry}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[42px] rounded-md border-2 text-xs font-semibold transition-colors px-1",
                won && "border-[var(--color-felt-bright)] bg-[var(--color-felt)]/15 text-[var(--color-felt-bright)]",
                lost && "border-[var(--color-pop-bright)] bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]",
                current && "border-[var(--color-brass)] bg-[var(--color-brass)]/10 text-[var(--color-brass-bright)]",
                upcoming && "border-[var(--border)] text-[var(--fg-dim)]",
              )}
            >
              <span className="leading-none">
                {entry ? (entry.outcome === "W" ? "✓" : "✗") : current ? "●" : p}
              </span>
              {scoreText && (
                <span className="text-[9px] tabular-nums leading-none opacity-90">
                  {isSweep ? "🧹" : ""}
                  {scoreText}
                </span>
              )}
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
          recommendedNightProb={result.context.nightWinProbability}
        />
      )}
      {top?.saveForLater && (
        <SaveForLaterCallout
          name={top.playerName}
          ideal={top.idealUpcomingMatchup}
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
                      {p.preferredPosition && (
                        <span className="ml-1.5 opacity-80">
                          · usually M{p.preferredPosition}
                        </span>
                      )}
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
        ctaLabel="Lock in"
        opponentName={live.oppName}
        opponentSL={live.oppSL}
      />
      <CandidateList
        heading="Or choose someone else"
        rows={result.candidates}
        topPickId={top?.playerId}
        onPick={onPick}
        opponentName={live.oppName}
        opponentSL={live.oppSL}
        recommendedNightProb={result.context.nightWinProbability}
      />
      {top?.saveForLater && (
        <SaveForLaterCallout
          name={top.playerName}
          ideal={top.idealUpcomingMatchup}
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
  onSubmit: (outcome: "W" | "L", ourGames: number, theirGames: number) => void;
  onBack: () => void;
}) {
  const ourSL = typeof live.ourSkillLevel === "number" ? live.ourSkillLevel : null;
  const theirSL = typeof live.oppSL === "number" ? live.oppSL : null;
  const ourTarget = ourSL != null && theirSL != null ? winsRequired(ourSL, theirSL) : 3;
  const theirTarget = ourSL != null && theirSL != null ? winsRequired(theirSL, ourSL) : 3;
  const ourHill = Math.max(0, ourTarget - 1);
  const theirHill = Math.max(0, theirTarget - 1);

  // Stage 1: outcome unset → pick W/L. Stage 2: outcome set → enter race score.
  const [outcome, setOutcome] = useState<"W" | "L" | null>(null);
  const [ourGames, setOurGames] = useState<number>(0);
  const [theirGames, setTheirGames] = useState<number>(0);

  function pickOutcome(o: "W" | "L") {
    haptic(o === "W" ? [20, 30, 40] : 60);
    setOutcome(o);
    if (o === "W") {
      setOurGames(ourTarget);
      setTheirGames(0);
    } else {
      setTheirGames(theirTarget);
      setOurGames(0);
    }
  }

  function applyPreset(presetOurs: number, presetTheirs: number) {
    haptic(10);
    setOurGames(presetOurs);
    setTheirGames(presetTheirs);
  }

  function confirm() {
    if (outcome === null) return;
    haptic(20);
    onSubmit(outcome, ourGames, theirGames);
  }

  // Sweep / mini-sweep / hill-hill labels for the entered score.
  let scoreLabel: string | null = null;
  if (outcome === "W") {
    if (theirGames === 0) scoreLabel = "🧹 Sweep!";
    else if (theirGames < ourHill) scoreLabel = "✨ Mini-sweep";
    else if (ourGames === ourTarget && theirGames === theirHill) scoreLabel = "Hill-hill win";
    else scoreLabel = `Won ${ourGames}–${theirGames}`;
  } else if (outcome === "L") {
    if (ourGames === 0) scoreLabel = "🧹 Got swept";
    else if (ourGames < theirHill) scoreLabel = "Mini-sweep against us";
    else if (theirGames === theirTarget && ourGames === ourHill) scoreLabel = "Hill-hill loss";
    else scoreLabel = `Lost ${ourGames}–${theirGames}`;
  }

  return (
    <div className="space-y-4">
      <PhaseLabel
        phase="step"
        text={outcome === null ? "Step 3 of 3 · Enter the result" : "Step 3 of 3 · Enter the race score"}
      />
      <div className="surface p-5">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
          Match {live.position}
        </p>
        {/* Matchup card */}
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl tracking-wide">
              {ourName}
            </p>
            <p className="text-xs text-[var(--fg-dim)]">
              {ourSL != null ? `SL${ourSL}` : ""} · race to{" "}
              <span className="font-semibold text-[var(--color-felt-bright)]">{ourTarget}</span>
            </p>
          </div>
          <span className="text-[var(--fg-dim)]">vs</span>
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl tracking-wide">
              {live.oppName}
            </p>
            <p className="text-xs text-[var(--fg-dim)]">
              {theirSL != null ? `SL${theirSL}` : ""} · race to{" "}
              <span className="font-semibold text-[var(--color-pop-bright)]">{theirTarget}</span>
            </p>
          </div>
        </div>

        {outcome === null ? (
          <>
            <p className="mt-5 text-center text-sm text-[var(--fg-dim)]">
              Who won?
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => pickOutcome("W")}
                className="min-h-[64px] rounded-2xl border-2 border-[var(--color-felt-bright)] bg-[var(--color-felt)]/15 px-4 py-3 text-lg font-semibold text-[var(--color-felt-bright)] active:scale-95 hover:bg-[var(--color-felt)]/25 transition-transform"
              >
                ✓ We won
              </button>
              <button
                type="button"
                onClick={() => pickOutcome("L")}
                className="min-h-[64px] rounded-2xl border-2 border-[var(--color-pop-bright)] bg-[var(--color-pop)]/15 px-4 py-3 text-lg font-semibold text-[var(--color-pop-bright)] active:scale-95 hover:bg-[var(--color-pop)]/25 transition-transform"
              >
                ✗ We lost
              </button>
            </div>
            <p className="mt-3 text-center text-[10px] text-[var(--fg-dim)]">
              You&apos;ll enter the race score (e.g. 3–1) after picking.
            </p>
          </>
        ) : (
          <>
            {/* Live race score visualization */}
            <div className="mt-5">
              <RaceScoreBar
                ourGames={ourGames}
                ourTarget={ourTarget}
                theirGames={theirGames}
                theirTarget={theirTarget}
                outcome={outcome}
              />
            </div>

            {/* Steppers */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <GameCounter
                label={ourName.split(" ")[0] + "'s games"}
                value={ourGames}
                onChange={setOurGames}
                target={ourTarget}
                accent="felt"
              />
              <GameCounter
                label={live.oppName + "'s games"}
                value={theirGames}
                onChange={setTheirGames}
                target={theirTarget}
                accent="pop"
              />
            </div>

            {/* Quick presets — race-aware */}
            <div className="mt-3 flex flex-wrap gap-2">
              {outcome === "W" && (
                <>
                  <PresetChip onClick={() => applyPreset(ourTarget, 0)} label={`Sweep ${ourTarget}–0`} />
                  {ourHill >= 1 && (
                    <PresetChip onClick={() => applyPreset(ourTarget, 1)} label={`${ourTarget}–1`} />
                  )}
                  {ourHill >= 2 && (
                    <PresetChip onClick={() => applyPreset(ourTarget, ourHill - 1)} label={`Mini ${ourTarget}–${ourHill - 1}`} />
                  )}
                  {theirHill >= 1 && (
                    <PresetChip onClick={() => applyPreset(ourTarget, theirHill)} label={`Hill–hill ${ourTarget}–${theirHill}`} />
                  )}
                </>
              )}
              {outcome === "L" && (
                <>
                  <PresetChip onClick={() => applyPreset(0, theirTarget)} label={`Got swept 0–${theirTarget}`} />
                  {theirHill >= 1 && (
                    <PresetChip onClick={() => applyPreset(1, theirTarget)} label={`1–${theirTarget}`} />
                  )}
                  {theirHill >= 2 && (
                    <PresetChip onClick={() => applyPreset(theirHill - 1, theirTarget)} label={`Lost mini ${theirHill - 1}–${theirTarget}`} />
                  )}
                  {ourHill >= 1 && (
                    <PresetChip onClick={() => applyPreset(ourHill, theirTarget)} label={`Hill–hill ${ourHill}–${theirTarget}`} />
                  )}
                </>
              )}
            </div>

            {/* Score readout */}
            {scoreLabel && (
              <p className={cn(
                "mt-3 text-center text-sm font-semibold",
                outcome === "W"
                  ? "text-[var(--color-felt-bright)]"
                  : "text-[var(--color-pop-bright)]",
              )}>
                {scoreLabel}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setOutcome(null)}
                className="min-h-[52px] flex-1 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--fg-dim)] hover:text-[var(--fg)]"
              >
                ← Change outcome
              </button>
              <button
                type="button"
                onClick={confirm}
                className="min-h-[52px] flex-[2] rounded-full bg-[var(--color-brass)] px-6 py-3 text-base font-semibold text-[var(--color-ink)] shadow-lg hover:bg-[var(--color-brass-bright)]"
              >
                Confirm {ourGames}–{theirGames} →
              </button>
            </div>
          </>
        )}
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

/* ============================================================ Race score helpers */

function GameCounter({
  label,
  value,
  onChange,
  target,
  accent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  target: number;
  accent: "felt" | "pop";
}) {
  const accentCls =
    accent === "felt"
      ? "text-[var(--color-felt-bright)]"
      : "text-[var(--color-pop-bright)]";
  return (
    <div>
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--fg-dim)]">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            haptic(8);
            onChange(Math.max(0, value - 1));
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] text-xl font-semibold hover:border-[var(--color-brass)]"
          aria-label="Decrease games"
        >
          −
        </button>
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2">
          <span
            className={cn(
              "font-[family-name:var(--font-display)] text-3xl tracking-wide tabular-nums",
              accentCls,
            )}
          >
            {value}
          </span>
          <span className="ml-2 text-xs text-[var(--fg-dim)]">/ {target}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            haptic(8);
            onChange(Math.min(target, value + 1));
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] text-xl font-semibold hover:border-[var(--color-brass)]"
          aria-label="Increase games"
        >
          +
        </button>
      </div>
    </div>
  );
}

function PresetChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[36px] rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-1.5 text-xs font-medium text-[var(--fg-dim)] hover:border-[var(--color-brass)] hover:text-[var(--fg)]"
    >
      {label}
    </button>
  );
}

/**
 * Live race score visualization. Two opposing horizontal bars filling toward
 * each side's race target, meeting in the middle. The "hill" (target − 1) is
 * marked as a dashed line so you can see the sweep / mini-sweep / hill-hill
 * thresholds at a glance.
 */
function RaceScoreBar({
  ourGames,
  ourTarget,
  theirGames,
  theirTarget,
  outcome,
}: {
  ourGames: number;
  ourTarget: number;
  theirGames: number;
  theirTarget: number;
  outcome: "W" | "L";
}) {
  const ourPct = (ourGames / ourTarget) * 100;
  const theirPct = (theirGames / theirTarget) * 100;
  return (
    <div>
      {/* Our side */}
      <div className="flex items-center gap-2">
        <span className="w-7 text-right font-[family-name:var(--font-display)] text-xl tabular-nums text-[var(--color-felt-bright)]">
          {ourGames}
        </span>
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-[var(--bg-soft)]">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              outcome === "W" ? "bg-[var(--color-felt-bright)]" : "bg-[var(--color-felt)]/40",
            )}
            style={{ width: `${ourPct}%` }}
          />
          {/* Hill marker at (target-1)/target */}
          {ourTarget >= 2 && (
            <div
              className="absolute top-0 h-full border-l border-dashed border-[var(--fg-dim)]/60"
              style={{ left: `${((ourTarget - 1) / ourTarget) * 100}%` }}
              aria-label="hill"
            />
          )}
        </div>
        <span className="w-7 text-xs text-[var(--fg-dim)] tabular-nums">/{ourTarget}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="w-7 text-right font-[family-name:var(--font-display)] text-xl tabular-nums text-[var(--color-pop-bright)]">
          {theirGames}
        </span>
        <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-[var(--bg-soft)]">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              outcome === "L" ? "bg-[var(--color-pop-bright)]" : "bg-[var(--color-pop)]/40",
            )}
            style={{ width: `${theirPct}%` }}
          />
          {theirTarget >= 2 && (
            <div
              className="absolute top-0 h-full border-l border-dashed border-[var(--fg-dim)]/60"
              style={{ left: `${((theirTarget - 1) / theirTarget) * 100}%` }}
            />
          )}
        </div>
        <span className="w-7 text-xs text-[var(--fg-dim)] tabular-nums">/{theirTarget}</span>
      </div>
      <div className="mt-1 text-center text-[10px] text-[var(--fg-dim)]">
        Dashed line = the hill
      </div>
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
  opponentName,
  opponentSL,
}: {
  title: string;
  subtitle: string;
  result: ThrowAdvisorResult;
  onLockIn: (c: ThrowCandidate) => void;
  ctaLabel: string;
  /** When known, lets us render H2H history + race-chart visual. */
  opponentName?: string;
  opponentSL?: number | null;
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

      {/* Top: name + win-prob gauge */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass-bright)]">
            Recommendation
          </p>
          <Link
            href={`/roster/${top.playerId}`}
            className="mt-1 block font-[family-name:var(--font-display)] text-3xl leading-tight tracking-wide hover:text-[var(--color-brass)]"
          >
            {top.playerName}
            {top.skillLevel != null && (
              <span className="ml-2 text-base text-[var(--fg-dim)]">
                SL{top.skillLevel}
              </span>
            )}
          </Link>
          {opponentName && (
            <p className="mt-1 text-sm text-[var(--fg-dim)]">
              vs {opponentName}
              {opponentSL != null && ` · SL${opponentSL}`}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <WinProbGauge pct={top.matchupScore} size={132} />
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)] tabular-nums">
            ±{Math.round((top.matchupScoreCI[1] - top.matchupScoreCI[0]) / 2)}%
            <span className="ml-1 normal-case opacity-70">
              ({top.matchupScoreCI[0]}–{top.matchupScoreCI[1]})
            </span>
          </span>
        </div>
      </div>

      {/* Race-chart visual when SLs are known */}
      {typeof top.skillLevel === "number" && typeof opponentSL === "number" && (
        <div className="mt-4">
          <RaceVisual ourSL={top.skillLevel} theirSL={opponentSL} />
        </div>
      )}

      {/* H2H history strip when applicable */}
      {top.h2hHistory.length > 0 && opponentName && (
        <div className="mt-4">
          <H2HHistory history={top.h2hHistory} opponentName={opponentName} />
        </div>
      )}

      {/* Radar + reasoning two-column on desktop, stacked on mobile */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col items-center">
          <MatchupRadar components={top.components} />
          <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-[var(--fg-dim)]">
            Component profile
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-[var(--fg-dim)]">
            {result.context.narrative}
          </p>
          <ul className="space-y-1 text-sm">
            {top.reasoning.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 text-[var(--color-brass-bright)]">▸</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          {top.flags.length > 0 && (
            <ul className="space-y-1 text-xs text-[var(--fg-dim)]">
              {top.flags.map((f, i) => (
                <li key={i}>⚠ {f}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <LookaheadStrip
        teamValue={top.components.lookahead}
        delta={top.components.lookaheadDelta}
        race={top.components.raceEquity}
      />

      {/* Per-component breakdown — collapsed by default to keep card scannable */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] hover:text-[var(--color-brass)]">
          ↳ Per-component scores
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ComponentBar label="H2H" c={top.components.h2h} />
          <ComponentBar label="vs SL" c={top.components.vsSL} />
          <ComponentBar label="Form" c={top.components.form} />
          <ComponentBar label="vs Team" c={top.components.vsTeam} />
          <ComponentBar label="Slot fit" c={top.components.position} />
          <ComponentBar label="Clutch" c={top.components.clutch} />
          <VenueBar c={top.components.venue} />
        </div>
      </details>

      <button
        type="button"
        onClick={() => {
          haptic(15);
          onLockIn(top);
        }}
        className="sticky bottom-4 z-10 mt-5 flex w-full min-h-[52px] items-center justify-center gap-2 rounded-full bg-[var(--color-brass)] px-6 py-3 text-base font-semibold text-[var(--color-ink)] shadow-lg hover:bg-[var(--color-brass-bright)]"
      >
        {ctaLabel} → {top.playerName.split(" ")[0]} ({Math.round(top.matchupScore)}%)
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
  opponentName,
  opponentSL,
  recommendedNightProb,
}: {
  heading: string;
  rows: ThrowCandidate[];
  topPickId?: string;
  onPick: (c: ThrowCandidate) => void;
  opponentName?: string;
  opponentSL?: number | null;
  /** Recommended pick's night-win-prob — passed to rows for what-if delta. */
  recommendedNightProb?: number;
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
            opponentName={opponentName}
            opponentSL={opponentSL}
            recommendedNightProb={recommendedNightProb}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * What-if delta strip — shown in expanded non-top candidate rows.
 * Displays "If you throw X here: night prob 70% (−4 vs the recommended pick)".
 * Helps the captain make an informed override decision.
 */
function WhatIfStrip({
  ifPicked,
  recommended,
  candidateName,
}: {
  ifPicked: number;
  recommended: number;
  candidateName: string;
}) {
  const delta = Math.round((ifPicked - recommended) * 10) / 10;
  const tone =
    delta >= -1
      ? "text-[var(--color-felt-bright)]"
      : delta >= -5
        ? "text-[var(--color-brass-bright)]"
        : "text-[var(--color-pop-bright)]";
  const sign = delta > 0 ? "+" : "";
  return (
    <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg-soft)]/40 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
        What if you throw {candidateName.split(" ")[0]}?
      </div>
      <div className="mt-1 flex items-baseline gap-2 text-sm">
        <span className="font-[family-name:var(--font-display)] text-2xl tabular-nums">
          {ifPicked.toFixed(1)}%
        </span>
        <span className={cn("text-xs font-semibold tabular-nums", tone)}>
          {sign}
          {delta.toFixed(1)} vs rec
        </span>
        <span className="text-[10px] text-[var(--fg-dim)]">night prob</span>
      </div>
    </div>
  );
}

function CandidateRow({
  candidate,
  isTop,
  onPick,
  opponentName,
  opponentSL,
  recommendedNightProb,
}: {
  candidate: ThrowCandidate;
  isTop: boolean;
  onPick: () => void;
  opponentName?: string;
  opponentSL?: number | null;
  /** Recommended pick's night-win-prob, for the "what-if" delta. */
  recommendedNightProb?: number;
}) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(candidate.matchupScore);
  const winColor =
    pct >= 60
      ? "text-[var(--color-felt-bright)]"
      : pct >= 45
        ? "text-[var(--color-brass-bright)]"
        : "text-[var(--color-pop-bright)]";
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
        className="flex w-full min-h-[64px] items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-soft)]/40"
      >
        <div className="flex flex-col items-center justify-center w-14 shrink-0">
          <span
            className={cn(
              "font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide tabular-nums",
              winColor,
            )}
          >
            {pct}%
          </span>
          <MiniProbBar pct={pct} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium">{candidate.playerName}</span>
            {candidate.skillLevel != null && (
              <span className="text-xs text-[var(--fg-dim)]">SL{candidate.skillLevel}</span>
            )}
            <VerdictBadge verdict={candidate.verdict} />
            {candidate.specialShotsRate >= 0.20 && (
              <span
                title={`Averages ${candidate.specialShotsRate.toFixed(2)} bonus leaderboard points per match (sweeps + mini-sweeps + B&R + 8-on-break)`}
                className="rounded-full bg-[var(--color-brass)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-brass-bright)]"
              >
                🧹 +{candidate.specialShotsRate.toFixed(1)} pts
              </span>
            )}
            {candidate.lastPlayedDaysAgo !== null && candidate.lastPlayedDaysAgo > 42 && (
              <span
                title={`Hasn't played in ${candidate.lastPlayedDaysAgo} days`}
                className="rounded-full bg-[var(--color-pop)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-pop-bright)]"
              >
                💤 Rusty
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            {!candidate.components.h2h.noData && (
              <span>
                H2H {candidate.components.h2h.wins}-{candidate.components.h2h.losses}
              </span>
            )}
            {!candidate.components.form.noData && (
              <>
                {!candidate.components.h2h.noData && <span>·</span>}
                <span>Form {candidate.components.form.rate}%</span>
              </>
            )}
            {!candidate.components.clutch.noData && candidate.components.clutch.matches >= 3 && (
              <>
                <span>·</span>
                <span>
                  Clutch {candidate.components.clutch.wins}-{candidate.components.clutch.losses}
                </span>
              </>
            )}
            <span className="opacity-70">
              ±{Math.round((candidate.matchupScoreCI[1] - candidate.matchupScoreCI[0]) / 2)}%
            </span>
          </div>
        </div>
        <span className="text-xs text-[var(--fg-dim)] shrink-0">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-soft)]/30 px-4 py-3 text-sm">
          {/* H2H + Race visuals if relevant */}
          {candidate.h2hHistory.length > 0 && opponentName && (
            <div className="mb-3">
              <H2HHistory
                history={candidate.h2hHistory}
                opponentName={opponentName}
              />
            </div>
          )}
          {typeof candidate.skillLevel === "number" &&
            typeof opponentSL === "number" && (
              <div className="mb-3">
                <RaceVisual
                  ourSL={candidate.skillLevel}
                  theirSL={opponentSL}
                />
              </div>
            )}

          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
            <div className="flex flex-col items-center">
              <MatchupRadar components={candidate.components} size={170} />
            </div>
            <div className="flex flex-col gap-2">
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
                <ul className="space-y-1 text-xs text-[var(--fg-dim)]">
                  {candidate.flags.map((f, i) => (
                    <li key={i}>⚠ {f}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* What-if: how does picking THIS candidate change night-win-prob? */}
          {!isTop && recommendedNightProb !== undefined && (
            <WhatIfStrip
              ifPicked={candidate.nightWinProbIfPicked}
              recommended={recommendedNightProb}
              candidateName={candidate.playerName}
            />
          )}

          {candidate.currentStreak && candidate.currentStreak.length >= 3 && (
            <p className="mt-2 text-xs text-[var(--fg-dim)]">
              {candidate.currentStreak.type === "W" ? "🔥" : "❄️"}{" "}
              <span
                className={cn(
                  "font-semibold",
                  candidate.currentStreak.type === "W"
                    ? "text-[var(--color-felt-bright)]"
                    : "text-[var(--color-pop-bright)]",
                )}
              >
                {candidate.currentStreak.length}{" "}
                {candidate.currentStreak.type === "W" ? "W" : "L"} streak
              </span>{" "}
              — recent run of consecutive {candidate.currentStreak.type === "W" ? "wins" : "losses"}.
            </p>
          )}

          <LookaheadStrip
            teamValue={candidate.components.lookahead}
            delta={candidate.components.lookaheadDelta}
            race={candidate.components.raceEquity}
            compact
          />

          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fg-dim)] hover:text-[var(--color-brass)]">
              ↳ Per-component scores
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <ComponentBar label="H2H" c={candidate.components.h2h} />
              <ComponentBar label="vs SL" c={candidate.components.vsSL} />
              <ComponentBar label="Form" c={candidate.components.form} />
              <ComponentBar label="vs Team" c={candidate.components.vsTeam} />
              <ComponentBar label="Slot fit" c={candidate.components.position} />
              <ComponentBar label="Clutch" c={candidate.components.clutch} />
              <VenueBar c={candidate.components.venue} />
            </div>
          </details>

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
              Pick {candidate.playerName.split(" ")[0]} ({pct}%) →
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
    const ourGamesTotal = log.reduce((s, t) => s + (t.ourGames ?? 0), 0);
    const theirGamesTotal = log.reduce((s, t) => s + (t.theirGames ?? 0), 0);
    const haveGameScores = log.some((t) => typeof t.ourGames === "number");
    const lines: string[] = [
      `🎱 Top Dogs ${ourScore}–${theirScore} ${opponentTeam}${won ? " ✅" : theirScore > ourScore ? " ❌" : ""}`,
      ...(haveGameScores ? [`Games: ${ourGamesTotal}–${theirGamesTotal}`] : []),
      "",
      ...log.map((t) => {
        const player = roster.find((p) => p.id === t.ourPlayerId);
        const us = `${player?.name ?? t.ourPlayerId}${t.ourSkillLevel != null ? ` (SL${t.ourSkillLevel})` : ""}`;
        const them = `${t.oppName}${t.oppSkillLevel != null ? ` (SL${t.oppSkillLevel})` : ""}`;
        const outcome = t.outcome === "W" ? "W" : t.outcome === "L" ? "L" : "·";
        const score =
          typeof t.ourGames === "number" && typeof t.theirGames === "number"
            ? ` ${t.ourGames}–${t.theirGames}`
            : "";
        // Sweep tag for the chat recap.
        let tag = "";
        if (typeof t.ourGames === "number" && typeof t.theirGames === "number") {
          if (t.outcome === "W" && t.theirGames === 0) tag = " 🧹";
          else if (t.outcome === "L" && t.ourGames === 0) tag = " 🧹❌";
        }
        return `M${t.position}: ${us} vs ${them} — ${outcome}${score}${tag}`;
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
        <p className="mt-1 text-[11px] uppercase tracking-[0.32em] text-[var(--fg-dim)]">
          Individual matches
        </p>
        {(() => {
          const ogt = log.reduce((s, t) => s + (t.ourGames ?? 0), 0);
          const tgt = log.reduce((s, t) => s + (t.theirGames ?? 0), 0);
          const has = log.some((t) => typeof t.ourGames === "number");
          if (!has) return null;
          return (
            <p className="mt-3 font-[family-name:var(--font-display)] text-2xl tracking-wide tabular-nums text-[var(--fg-dim)]">
              {ogt}<span className="mx-1.5">–</span>{tgt}
              <span className="ml-2 text-[11px] uppercase tracking-[0.32em]">total games</span>
            </p>
          );
        })()}
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
          const hasScore = typeof t.ourGames === "number" && typeof t.theirGames === "number";
          const ourTarget =
            t.ourSkillLevel != null && t.oppSkillLevel != null
              ? winsRequired(t.ourSkillLevel, t.oppSkillLevel)
              : null;
          const theirTarget =
            t.ourSkillLevel != null && t.oppSkillLevel != null
              ? winsRequired(t.oppSkillLevel, t.ourSkillLevel)
              : null;
          // Determine sweep/mini-sweep label.
          let scoreTag: { label: string; tone: "felt" | "pop" | "fg" } | null = null;
          if (hasScore) {
            if (t.outcome === "W") {
              if (t.theirGames === 0) scoreTag = { label: "🧹 Sweep", tone: "felt" };
              else if (theirTarget != null && t.theirGames! < theirTarget - 1)
                scoreTag = { label: "Mini-sweep", tone: "felt" };
            } else if (t.outcome === "L") {
              if (t.ourGames === 0) scoreTag = { label: "🧹 Got swept", tone: "pop" };
              else if (ourTarget != null && t.ourGames! < ourTarget - 1)
                scoreTag = { label: "Lost mini", tone: "pop" };
            }
          }
          return (
            <li
              key={t.position}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
                <span className="font-[family-name:var(--font-display)] text-lg tracking-wide text-[var(--color-brass-bright)]">
                  M{t.position}
                </span>
                <span className="min-w-0 flex-1 truncate">
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
                {hasScore && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums tracking-[0.1em]",
                      t.outcome === "W"
                        ? "bg-[var(--color-felt)]/20 text-[var(--color-felt-bright)]"
                        : "bg-[var(--color-pop)]/20 text-[var(--color-pop-bright)]",
                    )}
                  >
                    {t.ourGames}–{t.theirGames}
                  </span>
                )}
                {scoreTag && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                      scoreTag.tone === "felt"
                        ? "bg-[var(--color-felt)]/15 text-[var(--color-felt-bright)]"
                        : "bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]",
                    )}
                  >
                    {scoreTag.label}
                  </span>
                )}
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
  ideal,
  onUseAnyway,
}: {
  name: string;
  /** Better matchup still on the bench, if any. */
  ideal?: {
    opponentName: string;
    opponentSL: number;
    raceEquityHere: number;
    raceEquityThere: number;
  } | null;
  onUseAnyway: () => void;
}) {
  return (
    <div className="surface space-y-2 border-[var(--color-brass)]/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--fg-dim)]">
          💡 Hold{" "}
          <strong className="text-[var(--color-brass-bright)]">{name}</strong>{" "}
          for a tougher matchup.
        </p>
        <button
          type="button"
          onClick={onUseAnyway}
          className="text-xs font-semibold text-[var(--color-brass)] hover:underline"
        >
          Use them anyway →
        </button>
      </div>
      {ideal && (
        <p className="text-xs text-[var(--fg-dim)]">
          Their{" "}
          <strong className="text-[var(--fg)]">
            SL{ideal.opponentSL} ({ideal.opponentName})
          </strong>{" "}
          is still on the bench. Race equity{" "}
          <span className="font-semibold text-[var(--color-pop-bright)]">
            {Math.round(ideal.raceEquityHere)}%
          </span>{" "}
          here →{" "}
          <span className="font-semibold text-[var(--color-felt-bright)]">
            {Math.round(ideal.raceEquityThere)}%
          </span>{" "}
          there.
        </p>
      )}
    </div>
  );
}

/* ============================================================ charts */

/**
 * Donut-style win probability gauge. The percentage shown is the candidate's
 * matchupScore — a pure win likelihood, before lookahead penalties.
 */
function WinProbGauge({
  pct,
  size = 132,
}: {
  pct: number;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = size * 0.4;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const dash = (clamped / 100) * C;
  const colorVar =
    clamped >= 60
      ? "var(--color-felt-bright)"
      : clamped >= 45
        ? "var(--color-brass-bright)"
        : "var(--color-pop-bright)";
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="block"
      role="img"
      aria-label={`${Math.round(clamped)}% win probability`}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={size * 0.08} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={colorVar}
        strokeWidth={size * 0.08}
        strokeDasharray={`${dash} ${C - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 400ms ease-out" }}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-[var(--fg)] font-[family-name:var(--font-display)]"
        style={{ fontSize: size * 0.32 }}
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

/**
 * Six-axis radar chart over the candidate's component scores. Each axis is
 * 0..100 (smoothed). The polygon visualizes strengths and weaknesses at a
 * glance; combined with the win-prob gauge it replaces the prior 6 flat bars.
 */
function MatchupRadar({
  components,
  size = 200,
}: {
  components: ThrowCandidate["components"];
  size?: number;
}) {
  const labels = ["H2H", "vs SL", "Form", "vs Team", "Slot", "Race"] as const;
  const values = [
    components.h2h.smoothed,
    components.vsSL.smoothed,
    components.form.smoothed,
    components.vsTeam.smoothed,
    components.position.smoothed,
    components.raceEquity,
  ];
  const noData = [
    components.h2h.noData,
    components.vsSL.noData,
    components.form.noData,
    components.vsTeam.noData,
    components.position.noData,
    false, // raceEquity always present
  ];
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const angleAt = (i: number) => (Math.PI * 2 * i) / labels.length - Math.PI / 2;
  const point = (i: number, v: number) => {
    const rr = (Math.max(0, Math.min(100, v)) / 100) * r;
    return [cx + Math.cos(angleAt(i)) * rr, cy + Math.sin(angleAt(i)) * rr];
  };
  const polygonPoints = values.map((v, i) => point(i, v).join(",")).join(" ");
  const rings = [25, 50, 75, 100].map((pct) =>
    labels.map((_, i) => point(i, pct).join(",")).join(" "),
  );
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="block w-full">
      {rings.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="var(--border)"
          strokeWidth={i === rings.length - 1 ? 1 : 0.5}
        />
      ))}
      {/* Axes */}
      {labels.map((_, i) => {
        const [x, y] = point(i, 100);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--border)"
            strokeWidth={0.5}
          />
        );
      })}
      <polygon
        points={polygonPoints}
        fill="var(--color-brass)"
        fillOpacity={0.28}
        stroke="var(--color-brass-bright)"
        strokeWidth={1.5}
        style={{ transition: "all 350ms ease-out" }}
      />
      {/* Vertex dots */}
      {values.map((v, i) => {
        const [x, y] = point(i, v);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2.5}
            fill={noData[i] ? "var(--fg-dim)" : "var(--color-brass-bright)"}
          />
        );
      })}
      {/* Labels */}
      {labels.map((lbl, i) => {
        const [lx, ly] = point(i, 130);
        return (
          <text
            key={lbl}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className={cn(
              "fill-[var(--fg)] text-[10px] font-semibold uppercase",
              noData[i] && "fill-[var(--fg-dim)]",
            )}
            style={{ letterSpacing: "0.16em" }}
          >
            {lbl}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * Horizontal split bar showing the APA race chart distribution. The visual
 * makes the SL asymmetry obvious at a glance — a low SL has a much shorter
 * bar than a high SL across the divide.
 */
function RaceVisual({
  ourSL,
  theirSL,
}: {
  ourSL: number | null;
  theirSL: number | null;
}) {
  if (ourSL == null || theirSL == null) return null;
  const ourReq = winsRequired(ourSL, theirSL);
  const theirReq = winsRequired(theirSL, ourSL);
  const total = ourReq + theirReq;
  if (!total) return null;
  // We want the side with fewer required wins to occupy MORE space (the
  // visual proxy for "we're closer to victory"). So ourPct = theirReq / total.
  const ourPct = (theirReq / total) * 100;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-[var(--color-felt-bright)] transition-all duration-300"
          style={{ width: `${ourPct}%` }}
        />
        <div
          className="bg-[var(--color-pop-bright)] transition-all duration-300"
          style={{ width: `${100 - ourPct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--fg-dim)]">
        <span>
          <span className="font-semibold text-[var(--color-felt-bright)]">
            SL{ourSL}
          </span>
          <span className="ml-1">→ {ourReq} games</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.28em] text-[var(--color-brass)]">
          Race
        </span>
        <span>
          <span className="ml-1">{theirReq} games ←</span>
          <span className="ml-1 font-semibold text-[var(--color-pop-bright)]">
            SL{theirSL}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * H2H history strip. Renders one square per recorded match, oldest on the
 * left, newest on the right. Greens are wins, reds are losses. Useful for
 * spotting "haven't lost to this person in 4 matches" / "0-3 lifetime".
 */
function H2HHistory({
  history,
  opponentName,
}: {
  history: ThrowCandidate["h2hHistory"];
  opponentName: string;
}) {
  if (history.length === 0) return null;
  // history is newest-first; reverse for chronological display
  const chrono = [...history].reverse();
  const wins = chrono.filter((h) => h.outcome === "W").length;
  const losses = chrono.filter((h) => h.outcome === "L").length;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          H2H vs {opponentName}
        </span>
        <span className="tabular-nums">
          <span className="font-semibold text-[var(--color-felt-bright)]">
            {wins}W
          </span>
          <span className="mx-1 text-[var(--fg-dim)]">·</span>
          <span className="font-semibold text-[var(--color-pop-bright)]">
            {losses}L
          </span>
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {chrono.map((h, i) => (
          <span
            key={`${h.matchId}-${i}`}
            title={`${new Date(h.date).toLocaleDateString()} · ${h.outcome === "W" ? "Win" : "Loss"}`}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-bold",
              h.outcome === "W"
                ? "bg-[var(--color-felt)]/30 text-[var(--color-felt-bright)]"
                : "bg-[var(--color-pop)]/30 text-[var(--color-pop-bright)]",
            )}
          >
            {h.outcome}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Race-to-3 clinch pips. Three squares per side; filled ones = individual
 * matches won. Visualizes "how close are we to clinching?" at a glance.
 */
function ClinchPips({
  count,
  accent,
  alignRight = false,
}: {
  count: number;
  accent: "felt" | "pop";
  alignRight?: boolean;
}) {
  const filledCls =
    accent === "felt"
      ? "bg-[var(--color-felt-bright)] border-[var(--color-felt-bright)]"
      : "bg-[var(--color-pop-bright)] border-[var(--color-pop-bright)]";
  return (
    <div className={cn("flex items-center gap-1", alignRight && "justify-end")}>
      <span
        className={cn(
          "text-[9px] font-semibold uppercase tracking-[0.2em]",
          accent === "felt" ? "text-[var(--color-felt-bright)]" : "text-[var(--color-pop-bright)]",
        )}
      >
        {accent === "felt" ? "Us" : "Them"}
      </span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-5 rounded-sm border transition-colors",
            i < count ? filledCls : "border-[var(--border)] bg-[var(--bg-soft)]",
          )}
        />
      ))}
    </div>
  );
}

/**
 * Mini horizontal probability bar — used in the candidate list rows for a
 * quick visual scan without expanding.
 */
/**
 * Night win-probability strip — shown in the sticky header. Displays the
 * "probability we win the team match given optimal play from here on" plus
 * the opponent's still-pending SLs as a small chip row, so the captain can
 * always see "how good is our position right now" + "what's left on their
 * bench" at a glance.
 */
function NightProbStrip({
  nightProb,
  ci,
  pendingSLs,
}: {
  nightProb: number;
  ci: [number, number];
  pendingSLs: number[];
}) {
  const tone =
    nightProb >= 70
      ? "text-[var(--color-felt-bright)]"
      : nightProb >= 40
        ? "text-[var(--color-brass-bright)]"
        : "text-[var(--color-pop-bright)]";
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-soft)]/40 px-3 py-2 text-[11px]">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold uppercase tracking-[0.2em] text-[var(--fg-dim)]">
          Tonight
        </span>
        <span className={cn("font-[family-name:var(--font-display)] text-xl tabular-nums", tone)}>
          {nightProb}%
        </span>
        <span className="text-[10px] text-[var(--fg-dim)]">
          ±{Math.round((ci[1] - ci[0]) / 2)}%
        </span>
      </div>
      {pendingSLs.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
            Their bench
          </span>
          {pendingSLs.map((sl, i) => (
            <span
              key={`${sl}-${i}`}
              className={cn(
                "inline-flex h-5 min-w-[26px] items-center justify-center rounded-md border px-1 text-[10px] font-bold tabular-nums",
                sl >= 6
                  ? "border-[var(--color-pop-bright)]/50 bg-[var(--color-pop)]/15 text-[var(--color-pop-bright)]"
                  : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--fg-dim)]",
              )}
            >
              {sl}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniProbBar({ pct }: { pct: number }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1 w-16 rounded-full bg-[var(--bg-soft)]">
      <div
        className={cn(
          "h-full rounded-full",
          v >= 60
            ? "bg-[var(--color-felt-bright)]"
            : v >= 45
              ? "bg-[var(--color-brass-bright)]"
              : "bg-[var(--color-pop-bright)]",
        )}
        style={{ width: `${v}%`, transition: "width 300ms" }}
      />
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
