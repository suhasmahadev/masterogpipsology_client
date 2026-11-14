// Pure math for stepped frame scrolling (components/hooks/useStepScroll.ts). Import-free: node --test loads it.

/** Crypto stops picked by the owner with the HUD (unique mode): raw file numbers (ezgif-frame-NNN / NNN.webp), 1-based. */
export const CRYPTO_STOPS_RAW: readonly number[] = [1, 112, 139, 179];

/** Forex and Stock stops picked with the HUD (unique mode): raw 1-based file numbers. */
export const FOREX_STOPS_RAW: readonly number[] = [1, 64, 111, 194];
export const STOCK_STOPS_RAW: readonly number[] = [32, 189];
export const OPPORTUNITY_STOPS_RAW: readonly number[] = [97, 216, 240];

export type InputDevice = 'touch' | 'wheel' | 'trackpad' | 'key';

/** Every feel tunable of stepped scrolling. AUTO_ADVANCE_MS (video hand-off) is deliberately NOT in here. */
export const STEP_TUNING = {
  glide: { fps: 48, easeInS: 0.4, decelS: 1.0, decelPow: 2, minS: 0.8, landEps: 1e-3, maxDtS: 0.05 },
  speed: { steps: [1, 1.4, 1.8, 2.2], tauS: 0.25, easeInExp: 1, decelExp: 0.5 }, // level 0..3; cap = steps.length - 1
  streak: { windowMs: 600 },
  hold: { ms: [700, 500, 350, 250], pendingMs: [250, 180, 120, 80] },             // final-stop hold by streak level
  queue: { max: 3 },     // run extension: stops beyond the first stop ahead; also the hold-queue cap
  reverse: { brakeS: 0.3 },
  touch: { axisPx: 4, tapMaxPx: 8, tapMaxMs: 300 },
  devices: {
    touch:    { minPx: 8, speed: 1, holdScale: 1 },
    wheel:    { minPx: 1, speed: 1, holdScale: 1 },
    trackpad: { minPx: 3, speed: 1, holdScale: 1 },
    key:      { minPx: 0, speed: 1, holdScale: 1 },
  },
  wheel: { gapMs: 180, levelTauMs: 240, rise: 1.8, riseMin: 12, notchMinPx: 50 },
} as const;
export type StepTuning = typeof STEP_TUNING;
export const STREAK_CAP = STEP_TUNING.speed.steps.length - 1; // 3

export const STEP_FPS: number = STEP_TUNING.glide.fps;
export const STEP_EASE_IN_S: number = STEP_TUNING.glide.easeInS;
export const STEP_DECEL_S: number = STEP_TUNING.glide.decelS;
export const STEP_DECEL_POW: number = STEP_TUNING.glide.decelPow;
export const STEP_MIN_S: number = STEP_TUNING.glide.minS;
export const HOLD_MIN_MS: number = STEP_TUNING.hold.ms[0];   // base landing hold (700); shrinks with streak / queued input
export const AUTO_ADVANCE_MS = 450;      // SEPARATE from STEP_TUNING: autoAdvance stop (Forex O3) -> next stop (video hand-off timing)
export const STOP_TOL_PX = 2;            // "at a stop": Lenis rests on window.scrollY (device-pixel rounded)
export const REST_SNAP_FRAMES = 0.5;     // at rest, a frame position this close to the stop index shows the stop frame exactly
export const GESTURE_GAP_MS: number = STEP_TUNING.wheel.gapMs;
export const GESTURE_LEVEL_TAU_MS: number = STEP_TUNING.wheel.levelTauMs;
export const GESTURE_RISE: number = STEP_TUNING.wheel.rise;
export const GESTURE_RISE_MIN: number = STEP_TUNING.wheel.riseMin;
export const SETTLE_IDLE_MS = 220;       // after native movement (scrollbar, find) stops inside the zone, glide to the nearest stop
export const MOMENTUM_WINDOW_MS = 2500;  // native scroll this soon after a touch counts as touch momentum (entry catch applies)
export const OVERFLOW_UNLOCK_MS = 120;   // root overflow lock (touch catch) is released this long after the finger is up
export const KEY_ARROW_PX = 80;          // assumed native distance of an arrow key (catch test)
export const KEY_PAGE_SHARE = 0.9;       // PageDown / Space distance as a share of the viewport

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Raw 1-based file number -> list index: the largest i with locals[i] <= raw - 1 (a pulldown repeat maps to its twin). */
export function stopListIndex(raw1: number, locals: ArrayLike<number>): number {
  const want = Math.round(raw1) - 1;
  let k = 0;
  for (let j = 0; j < locals.length; j++) {
    if (locals[j] <= want) k = j;
    else break;
  }
  return k;
}

/** Progress where the hand-off fade starts: (seq - overlap) / seq. Crypto: (350 - 100) / 350 = 5/7. */
export function knotProgress(seqScrollVh: number, overlapVh: number): number {
  return seqScrollVh > 0 ? clamp((seqScrollVh - overlapVh) / seqScrollVh, 0, 1) : 1;
}

/** Same as lib/frame-sequence/math.ts sectionProgress (duplicated: this file is import-free). */
export function sectionProgressOf(scroll: number, top: number, height: number, viewportH: number): number {
  const range = height - viewportH;
  if (!(range > 0)) return 0;
  return clamp((scroll - top) / range, 0, 1);
}

/** Piecewise-linear frame position: list 0..knotIdx over p in [0, knotP], knotIdx..total-1 over [knotP, 1]. */
export function framePos(p: number, total: number, knotIdx: number, knotP: number): number {
  const last = total - 1;
  if (!(last > 0)) return 0;
  const x = clamp(Number.isNaN(p) ? 0 : p, 0, 1);
  const kp = clamp(knotP, 0, 1);
  const ki = clamp(knotIdx, 0, last);
  if (x <= kp) return kp > 0 ? (x / kp) * ki : ki;
  return kp < 1 ? ki + ((x - kp) / (1 - kp)) * (last - ki) : ki;
}

/** Inverse of framePos: progress at which a frame position is shown. */
export function progressAt(pos: number, total: number, knotIdx: number, knotP: number): number {
  const last = total - 1;
  if (!(last > 0)) return 0;
  const q = clamp(Number.isNaN(pos) ? 0 : pos, 0, last);
  const kp = clamp(knotP, 0, 1);
  const ki = clamp(knotIdx, 0, last);
  if (q <= ki) return ki > 0 ? (q / ki) * kp : 0;
  return last > ki ? kp + ((q - ki) / (last - ki)) * (1 - kp) : kp;
}

/** Scroll progress <-> fractional list position for one sequence. */
export interface FrameMap { pos: (p: number) => number; progress: (pos: number) => number }

export function knotFrameMap(total: number, knotIdx: number, knotP: number): FrameMap {
  return {
    pos: (p) => framePos(p, total, knotIdx, knotP),
    progress: (q) => progressAt(q, total, knotIdx, knotP),
  };
}

/** Frames spread linearly over the first `portion` of the progress range, then held at the last frame. */
export function linearFrameMap(total: number, portion: number): FrameMap {
  const last = total - 1;
  if (!(last > 0)) return { pos: () => 0, progress: () => 0 };
  return {
    pos: (p) => (Number.isNaN(p) ? 0 : p < portion ? clamp((p / portion) * last, 0, last) : last),
    progress: (q) => (clamp(Number.isNaN(q) ? 0 : q, 0, last) / last) * portion,
  };
}

/** Chain stop indices: folder f, raw r -> f * locals.length + stopListIndex(r, locals). Folders in chain order. */
export function chainStopIndices(folders: readonly (readonly number[])[], locals: ArrayLike<number>): number[] {
  const out: number[] = [];
  folders.forEach((raws, f) => {
    for (const r of raws) out.push(f * locals.length + stopListIndex(r, locals));
  });
  return out;
}

/** Scroll offset (px) of a stop. range = section height - viewport height (the frame hook's measured layout). */
export function stopScrollY(idx: number, total: number, knotIdx: number, knotP: number, top: number, range: number): number {
  return top + progressAt(idx, total, knotIdx, knotP) * range;
}

/**
 * Scroll offset where ForexFade completes = the Forex section top (Forex marginTop -overlap vh; Crypto height (seq + 100) vh).
 * Desktop (L = D) this equals Crypto progress 1; on mobile it is (L - D) px earlier. Forex shows list 0 at opacity 1 here.
 */
export function handoffEndY(top: number, height: number, seqScrollVh: number, overlapVh: number): number {
  const total = seqScrollVh + 100;
  return total > 0 ? top + (height * (total - overlapVh)) / total : top;
}

export interface GlideProfile { frames: number; v: number; tIn: number; tCruise: number; tOut: number; duration: number }

/** Reference profile; `stepGlide` reproduces it at 1x. Smoothstep in, cruise at fps, power-law decel. */
export function glideProfile(frames: number, fps: number = STEP_FPS, tIn: number = STEP_EASE_IN_S, tOut: number = STEP_DECEL_S,
  pow: number = STEP_DECEL_POW, min: number = STEP_MIN_S): GlideProfile {
  const D = Math.abs(Number.isFinite(frames) ? frames : 0);
  let v = fps > 0 ? fps : STEP_FPS;
  let ti = tIn;
  let to = tOut;
  let tc = 0;
  const dMin = v * (ti / 2 + to / (pow + 1));
  if (D >= dMin) tc = (D - dMin) / v;
  else { const k = dMin > 0 ? D / dMin : 0; ti *= k; to *= k; }
  let d = ti + tc + to;
  if (d < min) {
    if (d > 0) { const m = min / d; ti *= m; tc *= m; to *= m; v /= m; }
    else { ti = 0; tc = 0; to = min; v = 0; } // zero-length glide: hold still for `min`
    d = min;
  }
  return { frames: D, v, tIn: ti, tCruise: tc, tOut: to, duration: d };
}

/** Reference profile; `stepGlide` reproduces it at 1x. Position 0..1 at time t 0..1 of a glide with profile p. Exact 0 and 1 at the ends. */
export function glideEase(t: number, p: GlideProfile, pow: number = STEP_DECEL_POW): number {
  if (!(p.frames > 0)) return t >= 1 ? 1 : 0;
  const x = Number.isNaN(t) ? 0 : t < 0 ? 0 : t > 1 ? 1 : t;
  if (x >= 1) return 1;
  let tau = x * p.duration;
  const S = (u: number): number => u * u * u - (u * u * u * u) / 2; // integral of smoothstep, S(1) = 1/2
  let pos: number;
  if (tau < p.tIn) pos = p.v * p.tIn * S(tau / p.tIn);
  else {
    pos = (p.v * p.tIn) / 2;
    tau -= p.tIn;
    if (tau < p.tCruise) pos += p.v * tau;
    else {
      pos += p.v * p.tCruise;
      tau -= p.tCruise;
      const u = p.tOut > 0 ? Math.min(1, tau / p.tOut) : 1;
      pos += (p.v * p.tOut * (1 - Math.pow(1 - u, pow + 1))) / (pow + 1);
    }
  }
  const e = pos / p.frames;
  return e < 0 ? 0 : e > 1 ? 1 : e;
}

export interface WheelGesture { id: number; lastT: number; sign: number; level: number }
export function createWheelGesture(): WheelGesture {
  return { id: 0, lastT: -1e12, sign: 0, level: 0 };
}
/** Feeds one wheel delta (px, Lenis-normalised) at time t (ms). Returns true if it starts a new gesture (g.id is then incremented). */
export function feedWheel(g: WheelGesture, t: number, delta: number): boolean {
  const a = Math.abs(delta);
  const sign = delta > 0 ? 1 : delta < 0 ? -1 : 0;
  const gap = t - g.lastT;
  const decayed = g.level * Math.exp(-Math.max(0, gap) / GESTURE_LEVEL_TAU_MS);
  const fresh = gap > GESTURE_GAP_MS || sign !== g.sign || (a >= GESTURE_RISE_MIN && a > decayed * GESTURE_RISE);
  if (fresh) g.id += 1;
  g.lastT = t;
  g.sign = sign;
  g.level = fresh ? a : Math.max(a, decayed);
  return fresh;
}

/** Index of the stop within tol of y (nearest), else -1. */
export function stopAt(ys: ArrayLike<number>, y: number, tol: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let k = 0; k < ys.length; k++) {
    const d = Math.abs(y - ys[k]);
    if (d <= tol && d < bestD) { best = k; bestD = d; }
  }
  return best;
}

/** Index of the nearest stop (-1 if none). */
export function nearestStop(ys: ArrayLike<number>, y: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let k = 0; k < ys.length; k++) {
    const d = Math.abs(y - ys[k]);
    if (d < bestD) { best = k; bestD = d; }
  }
  return best;
}

export type StepAction =
  | { kind: 'pass' }                  // let Lenis / the browser scroll normally
  | { kind: 'swallow' }               // preventDefault, nothing else
  | { kind: 'glide'; stop: number }   // preventDefault, glide to the stop at STEP_FPS
  | { kind: 'catch'; stop: number };  // preventDefault, ease into an edge stop (entry)

export interface StepInput {
  y: number;                          // current scroll (Lenis animatedScroll or scrollY)
  target: number;                     // where the scroll heads if this input passes (Lenis targetScroll + delta; y + key distance)
  dir: 1 | -1;
  fresh: boolean;                     // first event of a new gesture
  acted: 'consume' | 'pass' | null;   // what was already done for this gesture, if anything
  foreign?: boolean;                  // y lies inside another controller's stop zone
  busy: boolean;                      // legacy; the controller now always passes false and handles holds itself
}

const PASS: StepAction = { kind: 'pass' };
const SWALLOW: StepAction = { kind: 'swallow' };

/** The whole step policy for one input. ys = stop scroll offsets, ascending. */
export function decideStep(ys: ArrayLike<number>, tol: number, i: StepInput): StepAction {
  const n = ys.length;
  if (n === 0) return PASS;
  if (i.busy || i.acted === 'consume') return SWALLOW;
  const first = ys[0];
  const last = ys[n - 1];
  if (i.y < first - tol) return i.dir > 0 && !i.foreign && i.target >= first - tol ? { kind: 'catch', stop: 0 } : PASS;
  if (i.y > last + tol) return i.dir < 0 && !i.foreign && i.target <= last + tol ? { kind: 'catch', stop: n - 1 } : PASS;
  if (i.acted === 'pass') return PASS; // an exit gesture still within tol of the edge stop
  const k = stopAt(ys, i.y, tol);
  if (k >= 0) {
    const next = k + i.dir;
    if (next < 0 || next >= n) return i.fresh ? PASS : SWALLOW; // exits need a new gesture
    return i.fresh ? { kind: 'glide', stop: next } : SWALLOW;
  }
  // Between stops (after a scrollbar drag or an interrupted glide): continue to the next stop in the input direction.
  if (i.dir > 0) { for (let j = 0; j < n; j++) if (ys[j] > i.y) return { kind: 'glide', stop: j }; return { kind: 'glide', stop: n - 1 }; }
  for (let j = n - 1; j >= 0; j--) if (ys[j] < i.y) return { kind: 'glide', stop: j };
  return { kind: 'glide', stop: 0 };
}

/**
 * Continuous stop coordinate: k at stop k, linear in scroll between stops; before stop 0 it is (scroll - ys[0]) / approach
 * (>= -1), after the last stop it is n - 1 + (scroll - ys[n-1]) / exit (<= n).
 */
export function stopCoord(scroll: number, ys: ArrayLike<number>, approach: number, exit: number): number {
  const n = ys.length;
  if (n === 0 || Number.isNaN(scroll)) return 0;
  if (scroll <= ys[0]) return approach > 0 ? Math.max(-1, (scroll - ys[0]) / approach) : 0;
  if (scroll >= ys[n - 1]) return exit > 0 ? Math.min(n, n - 1 + (scroll - ys[n - 1]) / exit) : n - 1;
  let k = 0;
  while (k < n - 2 && scroll >= ys[k + 1]) k++;
  const span = ys[k + 1] - ys[k];
  return span > 0 ? k + (scroll - ys[k]) / span : k;
}

// ─── Momentum: streaks, queue, device classes, run planning and the per-frame glide integrator ──────────────────────────

const clampI = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function speedMult(level: number, device: InputDevice, T: StepTuning = STEP_TUNING): number {
  return T.speed.steps[clampI(Math.round(level) || 0, 0, T.speed.steps.length - 1)] * T.devices[device].speed;
}

export function holdMs(level: number, pending: boolean, device: InputDevice, T: StepTuning = STEP_TUNING): number {
  const l = clampI(Math.round(level) || 0, 0, T.hold.ms.length - 1);
  return (pending ? T.hold.pendingMs[l] : T.hold.ms[l]) * T.devices[device].holdScale;
}

/** Hold end when input is queued during a hold: never later than the current end, never before now. */
export function queuedHoldUntil(holdUntil: number, landedAt: number, now: number, level: number, device: InputDevice, T: StepTuning = STEP_TUNING): number {
  return Math.min(holdUntil, Math.max(now, landedAt + holdMs(level, true, device, T)));
}

export interface StreakState { level: number; dir: 1 | -1 | 0; lastT: number }
export function createStreak(): StreakState {
  return { level: 0, dir: 0, lastT: -1e12 };
}
export function nextStreak(s: StreakState, t: number, dir: 1 | -1, T: StepTuning = STEP_TUNING): StreakState {
  const inRow = dir === s.dir && t - s.lastT <= T.streak.windowMs;
  return { level: inRow ? Math.min(T.speed.steps.length - 1, s.level + 1) : 0, dir, lastT: t };
}
export function streakLevelAt(s: StreakState, t: number, T: StepTuning = STEP_TUNING): number {
  return Math.max(0, s.level - Math.floor(Math.max(0, t - s.lastT) / T.streak.windowMs));
}

export interface Pending { dir: 1 | -1; count: number }
export function pushPending(p: Pending, dir: 1 | -1, repeat: boolean, T: StepTuning = STEP_TUNING): Pending {
  if (p.dir !== dir || p.count <= 0) return { dir, count: 1 };
  return { dir, count: repeat ? Math.max(1, p.count) : Math.min(T.queue.max, p.count + 1) };
}

export function classifyWheel(deltaMode: number, rawDeltaY: number, T: StepTuning = STEP_TUNING): 'wheel' | 'trackpad' {
  if (deltaMode !== 0) return 'wheel';
  const a = Math.abs(rawDeltaY);
  return a >= T.wheel.notchMinPx && Math.abs(a - Math.round(a)) < 0.01 ? 'wheel' : 'trackpad';
}

export function touchAxis(dx: number, up: number, T: StepTuning = STEP_TUNING): 'h' | 'v' | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(up);
  if (ax > 2 * ay && ax >= T.touch.axisPx) return 'h';
  if (ay >= 1) return 'v';
  return Math.max(ax, ay) >= T.touch.axisPx ? 'v' : null;
}

export function classifyTouchEnd(travel: number, up: number, ms: number, moving: boolean, T: StepTuning = STEP_TUNING): 'swipe' | 'tap' | 'none' {
  if (Math.abs(up) >= T.devices.touch.minPx) return 'swipe';
  if (moving && travel < T.touch.tapMaxPx && ms <= T.touch.tapMaxMs) return 'tap';
  return 'none';
}

/** Scroll -> path frames, piecewise linear through (ys[k], fs[k]), clamped. ys, fs strictly ascending. */
export function pathFrames(y: number, ys: ArrayLike<number>, fs: ArrayLike<number>): number {
  const n = Math.min(ys.length, fs.length);
  if (n === 0) return 0;
  if (n === 1 || Number.isNaN(y) || y <= ys[0]) return fs[0];
  if (y >= ys[n - 1]) return fs[n - 1];
  let k = 0;
  while (k < n - 2 && y >= ys[k + 1]) k++;
  const span = ys[k + 1] - ys[k];
  return span > 0 ? fs[k] + ((y - ys[k]) / span) * (fs[k + 1] - fs[k]) : fs[k];
}

/** Inverse of pathFrames, clamped to [ys[0], ys[n-1]]. */
export function pathY(x: number, ys: ArrayLike<number>, fs: ArrayLike<number>): number {
  const n = Math.min(ys.length, fs.length);
  if (n === 0) return 0;
  if (n === 1 || Number.isNaN(x) || x <= fs[0]) return ys[0];
  if (x >= fs[n - 1]) return ys[n - 1];
  let k = 0;
  while (k < n - 2 && x >= fs[k + 1]) k++;
  const span = fs[k + 1] - fs[k];
  return span > 0 ? ys[k] + ((x - fs[k]) / span) * (ys[k + 1] - ys[k]) : ys[k];
}

/** First stop strictly beyond x in dir: dir -1 = largest j with fs[j] < x - 1e-6; dir +1 = smallest j with fs[j] > x + 1e-6;
 *  -1 if none. (Used for "stop ahead" and "stop behind".) */
export function reverseStop(fs: ArrayLike<number>, x: number, dir: 1 | -1): number {
  if (dir < 0) {
    for (let j = fs.length - 1; j >= 0; j--) if (fs[j] < x - 1e-6) return j;
    return -1;
  }
  for (let j = 0; j < fs.length; j++) if (fs[j] > x + 1e-6) return j;
  return -1;
}

/** Walk `count` stops from index `from` in dir over n stops. Going down (dir 1) a run never passes autoStop (pass -1 for none)
 *  when from < autoStop. rest = steps that did not fit before the end of the list (0 when clipped by autoStop). */
export function runTarget(n: number, from: number, dir: 1 | -1, count: number, autoStop: number): { stop: number; rest: number } {
  const want = from + dir * Math.max(0, Math.floor(count));
  if (dir > 0 && autoStop >= 0 && from < autoStop && want >= autoStop) return { stop: autoStop, rest: 0 };
  const stop = clampI(want, 0, n - 1);
  return { stop, rest: Math.abs(want - stop) };
}

/** How many stops the run already goes beyond the first stop ahead of x (target index `stop`, plus extraSteps into a neighbour). */
export function runUsed(fs: ArrayLike<number>, x: number, dir: 1 | -1, stop: number, extraSteps: number): number {
  const ahead = reverseStop(fs, x, dir);
  return (ahead < 0 ? 0 : Math.max(0, dir * (stop - ahead))) + extraSteps;
}

/** Frames needed to brake from speed |v| on the brake curve at multiplier m: Dout*(|v|/V)^((p+1)/p). */
export function stoppingFrames(v: number, m: number, T: StepTuning = STEP_TUNING): number {
  const V = T.glide.fps * m;
  const p = T.glide.decelPow;
  const Dout = (V * T.glide.decelS / Math.pow(m, T.speed.decelExp)) / (p + 1);
  return V > 0 ? Dout * Math.pow(Math.min(1, Math.abs(v) / V), (p + 1) / p) : 0;
}

/** Tap to stop: the first stop ahead (in the direction of v) at least stoppingFrames away; -1 if none in this list. v === 0 -> -1. */
export function tapTarget(fs: ArrayLike<number>, x: number, v: number, m: number, T: StepTuning = STEP_TUNING): number {
  const d = Math.sign(v);
  if (d === 0 || Number.isNaN(d)) return -1;
  const dir: 1 | -1 = d > 0 ? 1 : -1;
  const need = stoppingFrames(v, m, T) - 1e-6;
  const first = reverseStop(fs, x, dir);
  if (first < 0) return -1;
  for (let j = first; j >= 0 && j < fs.length; j += dir) if (dir * (fs[j] - x) >= need) return j;
  return -1;
}

/** Reversal at x moving with v, new direction dir. Brake time reverse.brakeS (or less room to the list edge = limit); the run
 *  returns to the nearest stop strictly behind the brake end point. */
export function reversePlan(fs: ArrayLike<number>, x: number, v: number, dir: 1 | -1, T: StepTuning = STEP_TUNING): { stop: number; limit: number } {
  const n = fs.length;
  const sv = Math.sign(v);
  if (sv === 0 || sv === dir) {
    const j = reverseStop(fs, x, dir);
    return { stop: j >= 0 ? j : dir > 0 ? n - 1 : 0, limit: NaN };
  }
  const limit = sv > 0 ? fs[n - 1] : fs[0];
  const xs = x + sv * Math.min((Math.abs(v) * T.reverse.brakeS) / 2, Math.abs(limit - x));
  const j = reverseStop(fs, xs, dir);
  return { stop: j >= 0 ? j : dir > 0 ? n - 1 : 0, limit };
}

export interface GlideState {
  x: number;          // path position (list frames)
  v: number;          // signed velocity (frames/s)
  target: number;     // path frames of the target stop
  extra: number;      // >= 0: frames the run continues PAST target (into the next controller); 0 = target is final
  limit: number;      // NaN, or path frames a reversal brake must not pass
  ramp: number;       // 0..1 ease-in phase
  mult: number;       // smoothed speed multiplier
  multTarget: number;
  brake: number;      // 0, or the frozen reversal deceleration (frames/s^2)
}
export function createGlide(x: number, target: number, mult: number): GlideState {
  return { x, v: 0, target, extra: 0, limit: NaN, ramp: 0, mult, multTarget: mult, brake: 0 };
}

export type GlideStep = 'move' | 'land' | 'edge';
/** Advances g by dt seconds. 'land': x === target, v === 0. 'edge': passed target with extra > 0 (x may be past target by the
 *  overshoot; v kept) - the caller hands the run to the next controller. */
export function stepGlide(g: GlideState, dtS: number, T: StepTuning = STEP_TUNING): GlideStep {
  const dt = Number.isFinite(dtS) ? clampI(dtS, 0, T.glide.maxDtS) : 0;
  g.mult += (g.multTarget - g.mult) * (1 - Math.exp(-dt / T.speed.tauS));
  const m = g.mult;
  const V = T.glide.fps * m;
  const tIn = T.glide.easeInS / Math.pow(m, T.speed.easeInExp);
  const tOut = T.glide.decelS / Math.pow(m, T.speed.decelExp);
  const p = T.glide.decelPow;
  const r = g.target - g.x;
  const dir = Math.sign(r);

  // Reversal brake: moving away from the target.
  if (g.v !== 0 && Math.sign(g.v) !== dir) {
    if (g.brake <= 0) {
      const room = Number.isFinite(g.limit) ? Math.abs(g.limit - g.x) : Infinity;
      g.brake = room > 1e-6 ? Math.max(Math.abs(g.v) / T.reverse.brakeS, (g.v * g.v) / (2 * room)) : Infinity;
    }
    const s = Math.sign(g.v);
    let nv = g.v - s * g.brake * dt;
    if (g.brake === Infinity || Math.sign(nv) !== s) nv = 0;
    g.x += 0.5 * (g.v + nv) * dt;
    if (Number.isFinite(g.limit) && s * (g.x - g.limit) > 0) g.x = g.limit;
    g.v = nv;
    if (nv === 0) { g.brake = 0; g.ramp = 0; g.limit = NaN; }
    return 'move';
  }
  g.brake = 0;
  g.limit = NaN;

  if (dir === 0) {
    if (g.extra > 0) return 'edge';
    g.v = 0;
    g.ramp = 0;
    return 'land';
  }

  const ad = Math.abs(r);
  g.ramp = Math.min(1, g.ramp + (tIn > 0 ? dt / tIn : 1));
  const sm = g.ramp * g.ramp * (3 - 2 * g.ramp);

  const Dout = (V * tOut) / (p + 1);
  const rem = ad + Math.max(0, g.extra);
  const vBrake = Dout > 0 ? V * Math.pow(rem / Dout, p / (p + 1)) : V;
  let vc = Math.min(V * sm, vBrake);

  // Acceleration clamp: a run extended mid-brake re-accelerates smoothly.
  const aUp = (1.5 * V) / Math.max(tIn, 1e-3);
  const cur = Math.abs(g.v);
  if (vc > cur + aUp * dt) vc = cur + aUp * dt;

  if (g.extra <= 0 && (vc * dt >= ad || ad < T.glide.landEps)) {
    g.x = g.target;
    g.v = 0;
    g.ramp = 0;
    return 'land';
  }

  const nv = dir * vc;
  g.x += 0.5 * (g.v + nv) * dt;
  g.v = nv;

  if (dir * (g.target - g.x) <= 0) {
    if (g.extra > 0) return 'edge';
    g.x = g.target;
    g.v = 0;
    g.ramp = 0;
    return 'land';
  }
  return 'move';
}
