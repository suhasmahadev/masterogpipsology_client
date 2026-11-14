// Deterministic "live" candle tick shared by the 3D pane and the DOM chip.
// Pure, no imports. Authored art, not data (decision D9).

export type Candle = readonly [number, number, number, number]; // open, close, high, low (0..1)
export const LIVE_STEP_S = 4.5; // one new candle per step
export const LIVE_SLIDE_S = 0.7; // slide duration at the start of each step
export const LIVE_BREATH_S = 2.4; // forming-candle oscillation period
export const LIVE_AMP = 0.03;

/** Authored base followed by its mirror (reversed, open/close swapped): a continuous up-then-down ring. */
export function liveRing(base: readonly Candle[]): Candle[] {
  const mirror: Candle[] = base
    .slice()
    .reverse()
    .map(([o, c, h, l]) => [c, o, h, l] as Candle);
  return [...base, ...mirror];
}

export interface LiveClock {
  start: number;
  phase: number;
  f: number;
}

/** start = floor(t / LIVE_STEP_S); phase = t - start * LIVE_STEP_S; f = smoothstep(0, LIVE_SLIDE_S, phase). */
export function liveClock(tSeconds: number): LiveClock {
  const start = Math.floor(tSeconds / LIVE_STEP_S);
  const phase = tSeconds - start * LIVE_STEP_S;
  const x = Math.min(1, Math.max(0, phase / LIVE_SLIDE_S));
  return { start, phase, f: x * x * (3 - 2 * x) };
}

/** Newest candle "breathing". The envelope is 0 at phase 0 and LIVE_STEP_S, so steps are continuous. */
export function formingCandle(c: Candle, phase: number): Candle {
  const q = Math.min(1, Math.max(0, phase / LIVE_STEP_S));
  const env = Math.sin(Math.PI * q);
  const w = Math.sin((2 * Math.PI * phase) / LIVE_BREATH_S);
  const close = c[1] + LIVE_AMP * env * w;
  return [c[0], close, Math.max(c[2], close), Math.min(c[3], close)];
}

export function ringRange(ring: readonly Candle[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const c of ring) {
    if (c[3] < min) min = c[3];
    if (c[2] > max) max = c[2];
  }
  return { min, max };
}
