"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Undo2,
} from "lucide-react";
import type { DiamondCoord, EnglishHit, KinisterShot } from "@/lib/kinister/shots";
import { POCKETS } from "@/lib/kinister/shots";
import {
  BALL_R,
  POCKET_R,
  SVG_H,
  SVG_W,
  UNIT,
  toSvg,
} from "@/lib/kinister/geometry";
import {
  DEFAULT_POWER,
  outcomeOf,
  positionAt,
  powerLabel,
  powerToSpeed,
  setupFromShot,
  simulateShot,
  trackPolyline,
  type ShotSettings,
  type SimResult,
  type Vec2,
} from "@/lib/kinister/physics";
import { cn } from "@/lib/utils";
import { TableSurface, englishLabel } from "./tableArt";

type Props = {
  shot: KinisterShot;
  className?: string;
};

const PLAYBACK_SPEEDS = [1, 0.5, 0.25] as const;

function bertSettings(shot: KinisterShot): ShotSettings {
  return {
    power: shot.power ?? DEFAULT_POWER,
    english: shot.english ?? { x: 0, y: 0 },
  };
}

function sameSettings(a: ShotSettings, b: ShotSettings): boolean {
  return (
    Math.abs(a.power - b.power) < 0.005 &&
    Math.abs(a.english.x - b.english.x) < 0.02 &&
    Math.abs(a.english.y - b.english.y) < 0.02
  );
}

/**
 * Interactive, physics-driven shot diagram. Balls move in real time with
 * real deceleration, spin takes effect after contact, and cushions react to
 * english. The player can change stroke power and where the tip strikes
 * the cue ball and immediately see where both balls end up; "Bert's setup"
 * restores the way the shot is meant to be played.
 */
export function PhysicsPoolTable({ shot, className }: Props) {
  const bert = useMemo(() => bertSettings(shot), [shot]);
  const [settings, setSettings] = useState<ShotSettings>(bert);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const rafRef = useRef<number | null>(null);

  // New shot → back to Bert's setup at the starting position.
  useEffect(() => {
    setSettings(bert);
    setTime(0);
    setPlaying(false);
  }, [bert]);

  const setup = useMemo(() => setupFromShot(shot), [shot]);
  const sim = useMemo(() => simulateShot(setup, settings), [setup, settings]);
  const modified = !sameSettings(settings, bert);
  const bertSim = useMemo(
    () => (modified ? simulateShot(setup, bert) : null),
    [modified, setup, bert],
  );
  const outcome = useMemo(
    () => outcomeOf(sim, shot.targetPocket),
    [sim, shot.targetPocket],
  );

  const duration = Math.max(sim.duration, 0.1);
  const done = time >= duration - 1e-3;

  // Changing the stroke rewinds to the setup so the new prediction shows.
  const updateSettings = useCallback((next: Partial<ShotSettings>) => {
    setPlaying(false);
    setTime(0);
    setSettings((s) => ({ ...s, ...next }));
  }, []);

  const resetToBert = () => {
    setPlaying(false);
    setTime(0);
    setSettings(bert);
  };

  // Real-time playback.
  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    const tick = (now: number) => {
      if (last === null) last = now;
      const dt = ((now - last) / 1000) * speed;
      last = now;
      let finished = false;
      setTime((t) => {
        const next = Math.min(duration, t + dt);
        if (next >= duration) finished = true;
        return next;
      });
      if (finished) {
        setPlaying(false);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, speed, duration]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p && time >= duration - 1e-3) setTime(0);
      return !p;
    });
  }, [time, duration]);

  // Keyframes: contact, each rail, each pocket, rest.
  const keyframes = useMemo(() => keyframesOf(sim), [sim]);
  const stepNext = useCallback(() => {
    setPlaying(false);
    setTime((t) => keyframes.find((k) => k > t + 1e-3) ?? duration);
  }, [keyframes, duration]);
  const stepPrev = useCallback(() => {
    setPlaying(false);
    setTime((t) => {
      let prev = 0;
      for (const k of keyframes) {
        if (k < t - 1e-3) prev = k;
        else break;
      }
      return prev;
    });
  }, [keyframes]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t?.isContentEditable ||
        t?.getAttribute("role") === "slider"
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, stepNext, stepPrev]);

  // Live positions.
  const cuePos = positionAt(sim.tracks.cue, time, sim.frameDt);
  const obPos = positionAt(sim.tracks.object, time, sim.frameDt);
  const others = (shot.otherBalls ?? []).map((_, i) => {
    const tr = sim.tracks[`other-${i}`];
    return tr ? positionAt(tr, time, sim.frameDt) : null;
  });

  const contactEvent = sim.events.find(
    (e) => e.kind === "ball" && e.a === "cue" && e.b === "object",
  );
  const contactTime = contactEvent?.t ?? Infinity;
  const ghost = contactEvent
    ? positionAt(sim.tracks.cue, contactEvent.t, sim.frameDt)
    : null;

  const cuePath = useMemo(() => trackPolyline(sim.tracks.cue), [sim]);
  const obPath = useMemo(() => trackPolyline(sim.tracks.object), [sim]);
  const bertCuePath = useMemo(
    () => (bertSim ? trackPolyline(bertSim.tracks.cue) : null),
    [bertSim],
  );
  const atStart = time <= 0 && !playing;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative w-full overflow-hidden rounded-2xl bg-[var(--bg-card)] shadow-[var(--shadow-felt)]">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          xmlns="http://www.w3.org/2000/svg"
          className="block h-auto w-full"
          role="img"
          aria-label={`Diagram of ${shot.name}`}
        >
          <TableSurface />

          {/* Bert's line — only when the stroke has been changed, so the
              player can compare their result against the intended route. */}
          {bertCuePath && (
            <Polyline
              points={bertCuePath}
              stroke="rgba(232,82,72,0.55)"
              strokeWidth={1.6}
              dash="5 5"
            />
          )}
          {bertSim && !bertSim.tracks.cue.pocket && (
            <RestMarker
              p={bertSim.tracks.cue.rest}
              stroke="rgba(232,82,72,0.7)"
            />
          )}

          {/* Predicted object-ball route */}
          <Polyline
            points={obPath}
            stroke="rgba(224,190,107,0.7)"
            strokeWidth={2}
            dash="6 6"
          />
          {/* Predicted cue-ball route */}
          <Polyline
            points={cuePath}
            stroke="rgba(236,225,196,0.75)"
            strokeWidth={2}
            dash="2 5"
          />

          {/* Ghost ball at the moment of contact */}
          {ghost && time < contactTime && (
            <circle
              cx={toSvg(ghost).x}
              cy={toSvg(ghost).y}
              r={BALL_R}
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={1.2}
              strokeDasharray="2 3"
            />
          )}

          {/* Where each ball will stop */}
          {!sim.tracks.cue.pocket && !done && (
            <RestMarker p={sim.tracks.cue.rest} stroke="rgba(236,225,196,0.7)" />
          )}
          {!sim.tracks.object.pocket && !done && (
            <RestMarker p={sim.tracks.object.rest} stroke="rgba(224,190,107,0.75)" />
          )}

          {/* Cue stick, lined up on the aim, while setting up the shot */}
          {atStart && <CueStick from={shot.cueBall} dir={sim.aim} />}

          {/* Other balls */}
          {others.map((p, i) =>
            p ? <ObjectBall key={`other-${i}`} p={p} opacity={0.8} /> : null,
          )}

          {obPos && <ObjectBall p={obPos} />}
          {cuePos && (
            <circle
              cx={toSvg(cuePos).x}
              cy={toSvg(cuePos).y}
              r={BALL_R}
              fill="url(#cb-grad)"
              stroke="rgba(0,0,0,0.45)"
              strokeWidth={0.8}
            />
          )}

          {/* Target pocket */}
          {shot.targetPocket && (
            <circle
              cx={toSvg(POCKETS[shot.targetPocket]).x}
              cy={toSvg(POCKETS[shot.targetPocket]).y}
              r={POCKET_R + 4}
              fill="none"
              stroke={
                outcome.madeTarget
                  ? "rgba(232,82,72,0.6)"
                  : "rgba(232,82,72,0.95)"
              }
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          )}
        </svg>

        <OutcomeBadge
          made={outcome.madeTarget}
          hasTarget={shot.targetPocket !== null}
          scratched={outcome.scratched !== null}
          rails={outcome.cueRails}
        />
      </div>

      {/* Playback */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-b from-[#f0d48a] via-[#c9a24a] to-[#b38b36] px-5 text-sm font-semibold tracking-wide text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_24px_-10px_rgba(201,162,74,0.8)] transition-[filter,transform] hover:-translate-y-px hover:brightness-110"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? "Pause" : done ? "Replay" : "Shoot"}
        </button>
        <IconButton onClick={stepPrev} disabled={time <= 0} label="Step back to previous contact">
          <ChevronLeft size={14} />
        </IconButton>
        <IconButton onClick={stepNext} disabled={done} label="Step forward to next contact">
          <ChevronRight size={14} />
        </IconButton>
        <IconButton
          onClick={() => {
            setPlaying(false);
            setTime(0);
          }}
          disabled={time <= 0}
          label="Rack the balls back to the start"
        >
          <RotateCcw size={14} />
        </IconButton>
        <div
          className="inline-flex h-10 items-stretch gap-0.5 rounded-full bg-black/45 p-1 text-xs font-semibold shadow-[inset_0_1px_3px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.05)]"
          role="group"
          aria-label="Playback speed"
        >
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={cn(
                "rounded-full px-3 tabular-nums transition-colors",
                speed === s
                  ? "bg-[var(--color-brass)]/90 text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                  : "text-[var(--color-cream)]/55 hover:text-[var(--color-cream)]",
              )}
              aria-pressed={speed === s}
            >
              {s === 1 ? "1×" : s === 0.5 ? "½×" : "¼×"}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round((time / duration) * 1000)}
          onChange={(e) => {
            setPlaying(false);
            setTime((Number(e.target.value) / 1000) * duration);
          }}
          className="ml-1 h-10 min-w-[8rem] flex-1 cursor-pointer accent-[var(--color-brass-bright)]"
          aria-label="Shot timeline"
        />
      </div>

      {/* Stroke controls */}
      <div className="rounded-2xl bg-black/35 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-brass)]">
            Your stroke
          </p>
          {modified ? (
            <button
              type="button"
              onClick={resetToBert}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-brass)]/45 bg-black/40 px-3 text-xs font-semibold text-[var(--color-brass-bright)] transition-colors hover:bg-[var(--color-brass)]/15"
            >
              <Undo2 size={13} />
              Reset to Bert&apos;s setup
            </button>
          ) : (
            <span className="inline-flex h-8 items-center rounded-full bg-[var(--color-brass)]/15 px-3 text-xs font-semibold text-[var(--color-brass-bright)]">
              Bert&apos;s setup
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <TipPicker
            english={settings.english}
            bertEnglish={modified ? bert.english : null}
            onChange={(english) => updateSettings({ english })}
          />
          <div className="min-w-0 flex-1 space-y-4">
            <PowerSlider
              power={settings.power}
              bertPower={bert.power}
              onChange={(power) => updateSettings({ power })}
            />
            {modified && (
              <p className="flex items-center gap-2 text-[11px] leading-snug text-[var(--fg-dim)]">
                <span className="inline-block h-0 w-5 shrink-0 border-t-2 border-dashed border-[rgba(232,82,72,0.7)]" />
                Red line: where the cue ball goes with Bert&apos;s stroke.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function keyframesOf(sim: SimResult): number[] {
  const ts = new Set<number>([0]);
  for (const e of sim.events) {
    if (e.kind === "ball" || e.kind === "rail" || e.kind === "pocket") ts.add(e.t);
  }
  ts.add(sim.duration);
  return Array.from(ts).sort((a, b) => a - b);
}

function Polyline({
  points,
  stroke,
  strokeWidth,
  dash,
}: {
  points: Vec2[];
  stroke: string;
  strokeWidth: number;
  dash?: string;
}) {
  if (points.length < 2) return null;
  const d = points
    .map((p, i) => {
      const s = toSvg(p);
      return `${i === 0 ? "M" : "L"} ${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <path
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={dash}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function RestMarker({ p, stroke }: { p: DiamondCoord; stroke: string }) {
  const s = toSvg(p);
  return (
    <g aria-hidden>
      <circle
        cx={s.x}
        cy={s.y}
        r={BALL_R}
        fill="none"
        stroke={stroke}
        strokeWidth={1.4}
        strokeDasharray="2 3"
      />
      <circle cx={s.x} cy={s.y} r={1.8} fill={stroke} />
    </g>
  );
}

function ObjectBall({ p, opacity = 1 }: { p: DiamondCoord; opacity?: number }) {
  const s = toSvg(p);
  return (
    <g opacity={opacity}>
      <circle
        cx={s.x}
        cy={s.y}
        r={BALL_R}
        fill="url(#ob-grad)"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={0.8}
      />
      <circle cx={s.x} cy={s.y} r={BALL_R * 0.45} fill="#fff" />
    </g>
  );
}

function CueStick({ from, dir }: { from: DiamondCoord; dir: Vec2 }) {
  const tipGap = BALL_R + 6;
  const length = 2.6 * UNIT;
  const s = toSvg(from);
  const tip = { x: s.x - dir.x * tipGap, y: s.y - dir.y * tipGap };
  const butt = { x: tip.x - dir.x * length, y: tip.y - dir.y * length };
  const ferrule = { x: tip.x - dir.x * 7, y: tip.y - dir.y * 7 };
  return (
    <g aria-hidden pointerEvents="none">
      <line
        x1={butt.x}
        y1={butt.y}
        x2={tip.x}
        y2={tip.y}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={9}
        strokeLinecap="round"
        transform="translate(3 4)"
      />
      <line
        x1={butt.x}
        y1={butt.y}
        x2={ferrule.x}
        y2={ferrule.y}
        stroke="#c8a165"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <line
        x1={ferrule.x}
        y1={ferrule.y}
        x2={tip.x}
        y2={tip.y}
        stroke="#f3eee0"
        strokeWidth={5}
      />
      <circle cx={tip.x} cy={tip.y} r={2.6} fill="#3b6fb0" />
    </g>
  );
}

function OutcomeBadge({
  made,
  hasTarget,
  scratched,
  rails,
}: {
  made: boolean;
  hasTarget: boolean;
  scratched: boolean;
  rails: number;
}) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 flex flex-wrap justify-end gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
      {hasTarget && (
        <span
          className={cn(
            "rounded-full px-2.5 py-1 backdrop-blur-sm",
            made
              ? "bg-[#1f6e3d]/80 text-[#d8f5dd]"
              : "bg-[#7a1f1a]/85 text-[#ffd9d4]",
          )}
        >
          {made ? "Pocketed" : "Missed"}
        </span>
      )}
      {scratched && (
        <span className="rounded-full bg-[#7a1f1a]/85 px-2.5 py-1 text-[#ffd9d4] backdrop-blur-sm">
          Scratch
        </span>
      )}
      <span className="rounded-full bg-black/55 px-2.5 py-1 text-[var(--color-cream)]/80 backdrop-blur-sm">
        {rails} {rails === 1 ? "rail" : "rails"}
      </span>
    </div>
  );
}

function IconButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-cream)]/10 bg-black/40 text-[var(--color-cream)]/60 transition-colors hover:border-[var(--color-brass)]/45 hover:text-[var(--color-brass-bright)] disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function PowerSlider({
  power,
  bertPower,
  onChange,
}: {
  power: number;
  bertPower: number;
  onChange: (p: number) => void;
}) {
  const ms = powerToSpeed(power);
  const mph = ms * 2.237;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor="stroke-power"
          className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-cream)]/50"
        >
          Power
        </label>
        <p className="text-sm font-semibold text-[var(--fg)]">
          {powerLabel(power)}
          <span className="ml-2 text-xs font-normal tabular-nums text-[var(--fg-dim)]">
            {mph.toFixed(1)} mph
          </span>
        </p>
      </div>
      <div className="relative mt-1">
        <input
          id="stroke-power"
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(power * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="h-8 w-full cursor-pointer accent-[var(--color-brass-bright)]"
        />
        {/* Bert's mark */}
        <span
          aria-hidden
          title="Bert's power"
          className="pointer-events-none absolute -bottom-1 h-2 w-0.5 -translate-x-1/2 rounded bg-[rgba(232,82,72,0.85)]"
          style={{ left: `calc(${bertPower * 100}% + ${(0.5 - bertPower) * 16}px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-[var(--color-cream)]/35">
        <span>Soft</span>
        <span>Firm</span>
        <span>Power</span>
      </div>
    </div>
  );
}

/**
 * Draggable cue-ball face. The red dot is where the tip strikes; the faint
 * ring is Bert's tip position when it differs.
 */
function TipPicker({
  english,
  bertEnglish,
  onChange,
}: {
  english: EnglishHit;
  bertEnglish: EnglishHit | null;
  onChange: (e: EnglishHit) => void;
}) {
  const SIZE = 112;
  const R = 46;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  // Max tip offset is drawn at 70% of the face so a ring of white shows.
  const REACH = R * 0.7;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);

  const fromPointer = (clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * SIZE;
    const sy = ((clientY - rect.top) / rect.height) * SIZE;
    let x = (sx - cx) / REACH;
    let y = -(sy - cy) / REACH;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    // Snap near center / axes so dead-center is easy to hit.
    if (Math.abs(x) < 0.06) x = 0;
    if (Math.abs(y) < 0.06) y = 0;
    onChange({ x: round2(x), y: round2(y) });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.25 : 0.05;
    let { x, y } = english;
    if (e.key === "ArrowLeft") x -= step;
    else if (e.key === "ArrowRight") x += step;
    else if (e.key === "ArrowUp") y += step;
    else if (e.key === "ArrowDown") y -= step;
    else if (e.key === "Home" || e.key === "0") {
      x = 0;
      y = 0;
    } else return;
    e.preventDefault();
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    onChange({ x: round2(x), y: round2(y) });
  };

  const dot = { x: cx + english.x * REACH, y: cy - english.y * REACH };
  const bertDot = bertEnglish
    ? { x: cx + bertEnglish.x * REACH, y: cy - bertEnglish.y * REACH }
    : null;

  return (
    <div className="flex items-center gap-4">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="shrink-0 cursor-crosshair touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brass-bright)]"
        role="slider"
        tabIndex={0}
        aria-label="Cue tip position on the cue ball"
        aria-valuetext={englishLabel(english)}
        aria-valuenow={Math.round(english.y * 100)}
        aria-valuemin={-100}
        aria-valuemax={100}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          fromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) fromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <defs>
          <radialGradient id="tip-picker-cb" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cfc7b0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill="url(#tip-picker-cb)" stroke="rgba(0,0,0,0.45)" strokeWidth={1.2} />
        {/* Miscue limit */}
        <circle cx={cx} cy={cy} r={REACH} fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth={0.8} strokeDasharray="2 3" />
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="rgba(0,0,0,0.18)" strokeWidth={0.6} strokeDasharray="2 2" />
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="rgba(0,0,0,0.18)" strokeWidth={0.6} strokeDasharray="2 2" />
        {bertDot && (
          <circle cx={bertDot.x} cy={bertDot.y} r={6} fill="none" stroke="rgba(232,82,72,0.7)" strokeWidth={1.4} strokeDasharray="2 2" />
        )}
        <circle cx={dot.x} cy={dot.y} r={6.5} fill="#e85248" stroke="rgba(0,0,0,0.45)" strokeWidth={1} />
      </svg>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-cream)]/50">
          Tip position
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--fg)]">{englishLabel(english)}</p>
        <p className="mt-0.5 max-w-[16rem] text-[11px] leading-tight text-[var(--fg-dim)]">
          Drag the red dot. High = follow, low = draw, left/right = english.
        </p>
      </div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
