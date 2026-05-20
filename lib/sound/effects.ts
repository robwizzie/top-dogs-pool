"use client";

/**
 * Synthesized make / miss sound effects via the Web Audio API. No audio
 * files to ship — we generate the waveforms on the fly so the bundle stays
 * small and the sounds are tweakable in code.
 *
 * The AudioContext is created lazily on first call and reused — most
 * browsers won't let you instantiate it until after a user gesture, and
 * suspended contexts will be resumed automatically.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }
  type W = typeof window & { webkitAudioContext?: typeof AudioContext };
  const w = window as W;
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/**
 * Pre-warm the audio context. Call this from a user-gesture handler
 * (button click) so the first real sound plays without a hiccup.
 */
export function primeAudio(): void {
  getCtx();
}

/**
 * Pocket "ka-thunk" — a deep low-frequency thump (ball dropping) followed
 * by a brighter click (ball settling in the pocket).
 */
export function playMake(volume = 0.6): void {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;

  // Low thunk — sine wave with quick envelope.
  const thunk = c.createOscillator();
  thunk.type = "sine";
  thunk.frequency.setValueAtTime(110, now);
  thunk.frequency.exponentialRampToValueAtTime(45, now + 0.3);
  const thunkGain = c.createGain();
  thunkGain.gain.setValueAtTime(volume * 0.85, now);
  thunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  thunk.connect(thunkGain).connect(c.destination);
  thunk.start(now);
  thunk.stop(now + 0.4);

  // Bright click — square wave with fast decay, just after the thunk.
  const click = c.createOscillator();
  click.type = "triangle";
  click.frequency.setValueAtTime(900, now + 0.06);
  click.frequency.exponentialRampToValueAtTime(450, now + 0.22);
  const clickGain = c.createGain();
  clickGain.gain.setValueAtTime(volume * 0.35, now + 0.06);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  click.connect(clickGain).connect(c.destination);
  click.start(now + 0.06);
  click.stop(now + 0.22);

  // Subtle "shimmer" — a brief high-frequency sparkle for that "yes!" feel.
  const shimmer = c.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.setValueAtTime(1800, now + 0.12);
  const shimmerGain = c.createGain();
  shimmerGain.gain.setValueAtTime(volume * 0.18, now + 0.12);
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  shimmer.connect(shimmerGain).connect(c.destination);
  shimmer.start(now + 0.12);
  shimmer.stop(now + 0.28);
}

/**
 * Miss "thud" — softer, dampened. Not punishing; just unambiguous.
 */
export function playMiss(volume = 0.45): void {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;

  const thud = c.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(160, now);
  thud.frequency.exponentialRampToValueAtTime(80, now + 0.25);
  const thudGain = c.createGain();
  thudGain.gain.setValueAtTime(volume * 0.55, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  thud.connect(thudGain).connect(c.destination);
  thud.start(now);
  thud.stop(now + 0.3);

  // Wood-like attack — short noise burst.
  const noise = c.createBufferSource();
  const buffer = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  noise.buffer = buffer;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.22, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  noise.connect(noiseGain).connect(c.destination);
  noise.start(now);
}

/** Soft "blip" — used when the system detected something but isn't sure. */
export function playUncertain(volume = 0.35): void {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(400, now);
  o.frequency.exponentialRampToValueAtTime(560, now + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(volume * 0.4, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  o.connect(g).connect(c.destination);
  o.start(now);
  o.stop(now + 0.2);
}

/** Tiny "tick" — fires when the system has armed itself to watch for a shot. */
export function playReady(volume = 0.3): void {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(880, now);
  const g = c.createGain();
  g.gain.setValueAtTime(volume * 0.4, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  o.connect(g).connect(c.destination);
  o.start(now);
  o.stop(now + 0.08);
}
