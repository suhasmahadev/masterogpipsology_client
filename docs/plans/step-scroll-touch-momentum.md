# Step scroll: every input moves, momentum runs through stops, tap to stop, reverse (touch, wheel, trackpad, keys)

Planner: Opus. Coder: implement exactly this. Do not explore beyond the files named here. No Next.js API is touched.
`hx` is not installed in this repo, so the decisions are recorded in section 10 of this file.
The owner's answers (2026-10-26) are in section 11 and are reflected in the whole plan:
- Glide straight through middle stops.
- Stop at the edges.
- Keep the starting values.
- Use branch `step-scroll-touch`.

## 0. Goal

The owner reports that small or quick touch swipes sometimes do not move the page, which feels like a glitch. The fix and the
upgrade:

1. Any input moves the page. The slightest swipe, wheel tick or trackpad nudge starts a glide. Input is never silently dropped.
   Input during a landing hold is queued and runs when the hold ends, and the hold shortens when input is waiting.
2. Continued scrolling in one direction carries on smoothly to the end. Each extra swipe during a glide **extends the run**:
   - Velocity is continuous through the middle stops. There is no slowdown to zero there.
   - The glide only brakes into the final target.
   - Only that final stop holds.
3. Streak counter: same-direction gestures less than 600 ms apart raise a level from 0 to 3.
   - Speed is 1x, 1.4x, 1.8x or 2.2x by level.
   - The final hold gets shorter at each level.
   - A pause lets the level fall back, and the speed eases back to 1x.
4. Tap to stop: a touch without a real swipe while gliding cuts the run short. The page eases into the nearest stop it can
   reach with a smooth brake. It never freezes instantly.
5. A gesture in the other direction while gliding brakes the page and glides it back to the nearest stop behind. The same rules
   apply (min push, streak speed-up).
6. Natural feel:
   - Speed changes are interpolated.
   - The glide runs on the shared ticker with delta time.
   - An inertial burst is one gesture.
   - The wheel is classified as mouse or trackpad, and each input type has its own tunables.
   - Native scrolling does not fight the glide.
   - Frames are covered at the top speed.
7. Hook text stays in sync:
   - Hooks of passed stops may flash past, but they never overlap or glitch.
   - The final hook finishes exactly at landing.
8. All tunables live in one config object, `STEP_TUNING`. `AUTO_ADVANCE_MS` (Forex O3 -> video) stays separate and behaves
   exactly as before.
9. `prefers-reduced-motion` is respected: no Lenis, instant jumps, same queue rules.

## 1. Root causes found (useStepScroll.ts as of this plan)

| # | Where | What goes wrong |
|---|---|---|
| R1 | `onTouch` touchstart, line 383: `t.committed = this.busy()` | A touch that starts during a glide or the 700 ms hold can **never** step, even if the hold ends mid-swipe. It is still `engaged`, so every `touchmove` is `preventDefault`ed and the page does not move at all. **This is the main glitch.** After a landing, any swipe within 0.7 s is dead. |
| R2 | line 411: `Math.abs(up) >= SWIPE_MIN_PX` (24 px) | Swipes under 24 px are cancelled but never commit a step. |
| R3 | lines 395-399: the axis is decided on the **first** `touchmove` | 1 px sideways and 0 px vertical counts as "horizontal". The touch is released and native scroll moves the page freely inside the zone. A settle glide follows 220 ms later, which reads as a jerk. |
| R4 | No `touchend` commit | A quick flick whose few `touchmove`s stayed under the threshold never steps. |
| R5 | `decideStep` `busy -> swallow` plus `apply()` marking the gesture `consume` | A wheel or trackpad gesture that starts during the hold is swallowed for its whole length, inertia tail included. |
| R6 | `glideTo` uses one `lenis.scrollTo(duration, easing)` | Speed cannot change mid-glide, the target cannot be extended, and there is no braking or reversing. A per-frame driver is needed. |
| R7 | Sticky stages have no `touch-action` | The browser may treat a diagonal start as a pan. Double-tap zoom heuristics stay active. |

`GESTURE_GAP_MS` (180 ms) only splits **wheel** gestures, so it is not a touch cause. It stays: a wheel spin of a few notches
inside 180 ms is one burst, which is required.

## 2. Facts verified in code (do not re-derive)

- `node_modules` is **not installed** in this checkout. Run `corepack pnpm install` first (section 8).
- Node is v24.21.0. `node --test "tests/**/*.test.mjs"` imports `lib/*.ts` through type stripping.
  - In `lib/step-scroll.ts`, use only erasable TS: types, `as const` and interfaces. No enums, namespaces or parameter
    properties.
  - The file stays import-free.
- `lib/frame-loop.ts` exports `onEveryFrame(cb: (timestampMs, deltaMs) => void, step: 'update' | 'render'): () => void`.
  - `master()` iterates `Array.from(set)`, so a callback added during a frame first runs on the next frame.
  - Lenis runs in `'update'` and is registered first by `LenisProvider`.
  - Frame sequences run in `'render'` and read `lenis.scroll`.
  - So a driver in `'update'` writes the scroll in the same frame that the frames read it.
- `LenisProvider` sets `scrollStore.velocity = l.velocity` on every Lenis `scroll` event.
  - `DepthStage` (tilt) and `GoldDust` read it.
  - `lenis.scrollTo(y, { immediate: true, force: true })` zeroes Lenis velocity and emits `scroll` synchronously.
  - So the driver writes `scrollStore.velocity` **after** each `scrollTo` call.
- Frame stops have path frames equal to their list index: `posAt(ys[k]) === stops[k]`. Tail stops add frames:
  - Crypto (ForexFade end): `posAt(tailY)`, about 142 to 191 depending on layout.
  - Forex V: `575 + HANDOFF_TAIL_FRAMES` (72) = 647.
  - Forex `autoAdvance` = `FOREX_CHAIN_STOPS.length - 1` (O3, ys index 8). V is ys index 9.
  - Crypto's last ys (tail) is the same scroll offset as Forex ys[0] (Y0), within `STOP_TOL_PX`.
- Hook boxes (`lib/hook-box.ts`) are a pure function of `s = step.coord(u.scroll)`, applied in the frame tick by `useSlabScrub`.
  - Windows never overlap: Crypto `outTo(k) <= inFrom(k+1)`. Market m3 out ends at 3.25 and m4 in starts at 3.6. m5 out ends at
    5.25 and m6 in starts at 5.35. `inTo` of hook k = k.
  - `useSlabScrub.apply` skips a hook only if its zone (`slabZone` in `lib/crypto-slabs.ts`: 0 before, 1 in, 2 hold, 3 out,
    4 after) is unchanged **and** even. So a frame that jumps over a whole window (0 to 4) still writes the final hidden state.
  - When passing a stop at speed:
    - Hook k completes at s = k, then leaves over k..k+0.25.
    - Hook k+1 starts at k+0.25.
    - They flash in sequence, never together.
  - A landing writes exactly `ys[k]`, so s = k exactly and the final hook is complete. **No hook-box code change is needed.**
    Tests 21 and 22 lock this down.
- Frame decode is velocity-aware (`lookahead`, `decodeStride` in `lib/frame-sequence/math.ts`, 0.5 s horizon, stride ≤ 4).
  - Landing frames are `pinned`.
  - `engine.paint` falls back to the nearest decoded frame and never shows a blank.
  - At 2.2x (105.6 frames/s), decode windows of 16 or more cover 0.5 s ahead (test 23).
  - No engine change is needed.
- Reduced motion: no Lenis instance, so `useStepScroll` gets `lenis === null`, uses its own non-passive listeners and jumps.

## 3. Behaviour spec

**Motion model.** A glide moves a path position `x` (list frames) toward a target path frame. Scroll is `y = pathY(x)`, piecewise
linear through the stop knots `(ys[k], fs[k])`.

Each ticker frame runs `stepGlide(g, dt)`. The velocity is the smaller of two caps:
- Ease-in: smoothstep ramp from 0 to V over tIn.
- Brake: `V·((r + extra)/Dout)^(p/(p+1))`, where `r` is the distance to the target and `extra` is the frames that the run still
  continues past the target into the next controller. This brake curve is the current `glideProfile` decel, written as feedback.

Further rules:
- V = 48·`mult`. `mult` eases (tau 0.25 s) toward the streak/device multiplier.
- Without interventions, a 1x glide matches today's (test 10).
- **Run extension** moves the target one stop further. The brake cap rises again, and an acceleration clamp turns this into a
  smooth speed-up, so velocity is continuous through the passed stop.

**Gestures.** These count as one gesture:
- Wheel and trackpad: one `feedWheel` id, committed once the accumulated |delta| reaches the device `minPx`.
- Touch: |vertical travel| ≥ 8 px, on `touchmove` or, failing that, on `touchend`.
- Keys: a non-repeat keydown. A held key (repeat) means "continue": it keeps exactly one stop beyond the next stop ahead and does
  not raise the streak. So holding a key runs through the stops at constant speed.

**Routing a committed gesture (dir, device):**

1. **A glide is running.** Only the owner acts. Other controllers mark the gesture consumed and pass it on.
   - Same direction (counts the streak): extend the run by one stop (`extendRun`).
     - Cap: at most `queue.max` = 3 stops beyond the first stop ahead of `x`. For a held key the cap is 1.
     - Extension never passes the Forex `autoAdvance` stop going down, and never passes an exit edge.
     - At a controller edge that has a neighbour (Crypto tail = Forex Y0), it extends into the neighbour through `extra`.
     - Anything beyond a cap is absorbed. The streak still counts.
   - Opposite direction: reverse (`reversePlan`).
     - Brake in `reverse.brakeS` (0.3 s), or harder only if the controller edge is closer.
     - Return to the nearest stop strictly behind the point where the brake ends.
     - The run extension is cleared. The streak restarts at level 0 in the new direction.
2. **Holding** (`now < holdUntil`) **or steps are pending:**
   - If `decideStep` says `pass` (exit at an edge), let it pass natively at once.
   - Otherwise queue it (`pushPending`, cap 3) and shorten the hold: `holdUntil = min(holdUntil, max(now, landedAt + pendingMs[level]))`.
   - When the hold ends, all pending steps start as **one run** (`tryPending(dir, count)`).
3. **Idle:** use today's `decideStep`. A glide starts to the adjacent stop and later gestures extend it.

**Landing** at the final stop k:
- Write exactly `ys[k]`.
- Set `holdUntil = now + hold.ms[level]·holdScale` (700/500/350/250 ms by level). Use `pendingMs` if something is queued.
- Middle stops of a run are passed without landing, hold or rest snap.

**Edges (owner Q2: stop at the edge).**
- A run is clipped at Crypto stop 0 going up, at Forex V going down, and at O3 going down (auto-advance).
- Steps beyond that are cleared.
- Leaving the sequence needs a fresh gesture, which passes natively.

**Streak:**
- `nextStreak`: same direction and ≤ 600 ms since the last counted gesture gives level+1 (cap 3). Otherwise level 0.
- `streakLevelAt(t)`: drops one level per full 600 ms of silence.
- The driver re-reads it every frame, so a long run eases back toward 1x once the swipes stop.

**Tap to stop:**
- Conditions: touch travel < 8 px, ≤ 300 ms, while gliding or with steps pending. Touchstart and touchend are never cancelled.
- Effect:
  - Clear pending and reset the streak.
  - Retarget the glide to the first stop ahead whose distance is at least the current braking distance (`tapTarget`). The brake
    curve then holds without any velocity jump, and the page eases into that stop.
  - If no such stop is left inside the owner's zone during a cross-controller run, keep exactly one step into the neighbour.

**Auto-advance (Forex O3 -> V), unchanged:**
- When a downward run lands at O3 (runs are clipped there): `armAuto` fires after `AUTO_ADVANCE_MS` (450), and the hold is
  `HOLD_MIN_MS` (700).
- Down input while armed is absorbed.
- The O3 -> V glide always runs at 1x (`lockSpeed`) and is never extended (2.37 s for 72 virtual frames).
- Up input reverses or queues as normal.

**Reduced motion:** there is no driver.
- A run jumps straight to its final stop. A cross-controller run jumps to the neighbour's stop.
- Then `land()` runs, so the hold, queue and dispatch rules are identical.

## 4. Files and exact changes

### 4.1 `lib/step-scroll.ts` (stays pure and import-free)

**4.1.1 Tuning object.** Add it after the `*_STOPS_RAW` exports and before every other constant:

```ts
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
```

What the fields mean:
- At multiplier m:
  - V = fps·m (m already includes `devices[d].speed`)
  - tIn = easeInS / m^easeInExp
  - tOut = decelS / m^decelExp
- `devices.*.minPx` is the min push. For wheel and trackpad it is the |delta| accumulated in the gesture. For touch it is the
  vertical px.
- `wheel.notchMinPx`: a `deltaMode 0` delta that is ≥ this and an integer is a mouse notch.

**4.1.2 Legacy names.** Replace the existing constant lines 11-23 with:

```ts
export const STEP_FPS: number = STEP_TUNING.glide.fps;
export const STEP_EASE_IN_S: number = STEP_TUNING.glide.easeInS;
export const STEP_DECEL_S: number = STEP_TUNING.glide.decelS;
export const STEP_DECEL_POW: number = STEP_TUNING.glide.decelPow;
export const STEP_MIN_S: number = STEP_TUNING.glide.minS;
export const HOLD_MIN_MS: number = STEP_TUNING.hold.ms[0];   // base landing hold (700); shrinks with streak / queued input
export const AUTO_ADVANCE_MS = 450;      // SEPARATE from STEP_TUNING: autoAdvance stop (Forex O3) -> next stop (video hand-off timing)
export const GESTURE_GAP_MS: number = STEP_TUNING.wheel.gapMs;
export const GESTURE_LEVEL_TAU_MS: number = STEP_TUNING.wheel.levelTauMs;
export const GESTURE_RISE: number = STEP_TUNING.wheel.rise;
export const GESTURE_RISE_MIN: number = STEP_TUNING.wheel.riseMin;
```

- **Delete** `SWIPE_MIN_PX` and `GLIDE_WATCHDOG_MS`. No other file imports them.
- Keep these unchanged: `STOP_TOL_PX`, `REST_SNAP_FRAMES`, `SETTLE_IDLE_MS`, `MOMENTUM_WINDOW_MS`, `OVERFLOW_UNLOCK_MS`,
  `KEY_ARROW_PX` and `KEY_PAGE_SHARE`.
- Keep `glideProfile` and `glideEase` unchanged. Change their doc comment to "reference profile; `stepGlide` reproduces it at 1x".
- Keep `decideStep`, `feedWheel`, `stopAt`, `nearestStop` and `stopCoord` unchanged. Change only the `StepInput.busy` comment to
  "legacy; the controller now always passes false and handles holds itself".

**4.1.3 New pure functions.** Append them at the end of the file. The signatures are exact. `//` lines give the body.

```ts
const clampI = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function speedMult(level: number, device: InputDevice, T: StepTuning = STEP_TUNING): number
//   T.speed.steps[clampI(Math.round(level) || 0, 0, T.speed.steps.length - 1)] * T.devices[device].speed

export function holdMs(level: number, pending: boolean, device: InputDevice, T: StepTuning = STEP_TUNING): number
//   const l = clampI(Math.round(level) || 0, 0, T.hold.ms.length - 1);
//   (pending ? T.hold.pendingMs[l] : T.hold.ms[l]) * T.devices[device].holdScale

/** Hold end when input is queued during a hold: never later than the current end, never before now. */
export function queuedHoldUntil(holdUntil: number, landedAt: number, now: number, level: number, device: InputDevice, T: StepTuning = STEP_TUNING): number
//   Math.min(holdUntil, Math.max(now, landedAt + holdMs(level, true, device, T)))

export interface StreakState { level: number; dir: 1 | -1 | 0; lastT: number }
export function createStreak(): StreakState            // { level: 0, dir: 0, lastT: -1e12 }
export function nextStreak(s: StreakState, t: number, dir: 1 | -1, T: StepTuning = STEP_TUNING): StreakState
//   const inRow = dir === s.dir && t - s.lastT <= T.streak.windowMs;
//   return { level: inRow ? Math.min(T.speed.steps.length - 1, s.level + 1) : 0, dir, lastT: t };
export function streakLevelAt(s: StreakState, t: number, T: StepTuning = STEP_TUNING): number
//   Math.max(0, s.level - Math.floor(Math.max(0, t - s.lastT) / T.streak.windowMs))

export interface Pending { dir: 1 | -1; count: number }
export function pushPending(p: Pending, dir: 1 | -1, repeat: boolean, T: StepTuning = STEP_TUNING): Pending
//   if (p.dir !== dir || p.count <= 0) return { dir, count: 1 };
//   return { dir, count: repeat ? Math.max(1, p.count) : Math.min(T.queue.max, p.count + 1) };

export function classifyWheel(deltaMode: number, rawDeltaY: number, T: StepTuning = STEP_TUNING): 'wheel' | 'trackpad'
//   if (deltaMode !== 0) return 'wheel';
//   const a = Math.abs(rawDeltaY);
//   return a >= T.wheel.notchMinPx && Math.abs(a - Math.round(a)) < 0.01 ? 'wheel' : 'trackpad';

export function touchAxis(dx: number, up: number, T: StepTuning = STEP_TUNING): 'h' | 'v' | null
//   const ax = Math.abs(dx), ay = Math.abs(up);
//   if (ax > 2 * ay && ax >= T.touch.axisPx) return 'h';
//   if (ay >= 1) return 'v';
//   return Math.max(ax, ay) >= T.touch.axisPx ? 'v' : null;

export function classifyTouchEnd(travel: number, up: number, ms: number, moving: boolean, T: StepTuning = STEP_TUNING): 'swipe' | 'tap' | 'none'
//   if (Math.abs(up) >= T.devices.touch.minPx) return 'swipe';
//   if (moving && travel < T.touch.tapMaxPx && ms <= T.touch.tapMaxMs) return 'tap';
//   return 'none';

/** Scroll -> path frames, piecewise linear through (ys[k], fs[k]), clamped. ys, fs strictly ascending. */
export function pathFrames(y: number, ys: ArrayLike<number>, fs: ArrayLike<number>): number
/** Inverse of pathFrames, clamped to [ys[0], ys[n-1]]. */
export function pathY(x: number, ys: ArrayLike<number>, fs: ArrayLike<number>): number
//   Both: n === 0 -> 0; n === 1 -> the single knot; NaN -> first knot; linear scan for the segment; zero-length -> left knot.

/** First stop strictly beyond x in dir: dir -1 = largest j with fs[j] < x - 1e-6; dir +1 = smallest j with fs[j] > x + 1e-6;
 *  -1 if none. (Used for "stop ahead" and "stop behind".) */
export function reverseStop(fs: ArrayLike<number>, x: number, dir: 1 | -1): number

/** Walk `count` stops from index `from` in dir over n stops. Going down (dir 1) a run never passes autoStop (pass -1 for none)
 *  when from < autoStop. rest = steps that did not fit before the end of the list (0 when clipped by autoStop). */
export function runTarget(n: number, from: number, dir: 1 | -1, count: number, autoStop: number): { stop: number; rest: number }
//   const want = from + dir * Math.max(0, Math.floor(count));
//   if (dir > 0 && autoStop >= 0 && from < autoStop && want >= autoStop) return { stop: autoStop, rest: 0 };
//   const stop = clampI(want, 0, n - 1);
//   return { stop, rest: Math.abs(want - stop) };

/** How many stops the run already goes beyond the first stop ahead of x (target index `stop`, plus extraSteps into a neighbour). */
export function runUsed(fs: ArrayLike<number>, x: number, dir: 1 | -1, stop: number, extraSteps: number): number
//   const ahead = reverseStop(fs, x, dir);
//   return (ahead < 0 ? 0 : Math.max(0, dir * (stop - ahead))) + extraSteps;

/** Frames needed to brake from speed |v| on the brake curve at multiplier m: Dout·(|v|/V)^((p+1)/p). */
export function stoppingFrames(v: number, m: number, T: StepTuning = STEP_TUNING): number
//   const V = T.glide.fps * m, p = T.glide.decelPow;
//   const Dout = (V * T.glide.decelS / Math.pow(m, T.speed.decelExp)) / (p + 1);
//   return V > 0 ? Dout * Math.pow(Math.min(1, Math.abs(v) / V), (p + 1) / p) : 0;

/** Tap to stop: the first stop ahead (in the direction of v) at least stoppingFrames away; -1 if none in this list. v === 0 -> -1. */
export function tapTarget(fs: ArrayLike<number>, x: number, v: number, m: number, T: StepTuning = STEP_TUNING): number
//   const d = Math.sign(v); if (d === 0) return -1;
//   const need = stoppingFrames(v, m, T) - 1e-6;
//   scan j in direction d from reverseStop(fs, x, d); return the first j with d * (fs[j] - x) >= need; else -1.

/** Reversal at x moving with v, new direction dir. Brake time reverse.brakeS (or less room to the list edge = limit); the run
 *  returns to the nearest stop strictly behind the brake end point. */
export function reversePlan(fs: ArrayLike<number>, x: number, v: number, dir: 1 | -1, T: StepTuning = STEP_TUNING): { stop: number; limit: number }
//   const n = fs.length, sv = Math.sign(v);
//   if (sv === 0 || sv === dir) { const j = reverseStop(fs, x, dir); return { stop: j >= 0 ? j : (dir > 0 ? n - 1 : 0), limit: NaN }; }
//   const limit = sv > 0 ? fs[n - 1] : fs[0];
//   const xs = x + sv * Math.min(Math.abs(v) * T.reverse.brakeS / 2, Math.abs(limit - x));
//   const j = reverseStop(fs, xs, dir);
//   return { stop: j >= 0 ? j : (dir > 0 ? n - 1 : 0), limit };

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
export function createGlide(x: number, target: number, mult: number): GlideState
//   { x, v: 0, target, extra: 0, limit: NaN, ramp: 0, mult, multTarget: mult, brake: 0 }

export type GlideStep = 'move' | 'land' | 'edge';
/** Advances g by dt seconds. 'land': x === target, v === 0. 'edge': passed target with extra > 0 (x may be past target by the
 *  overshoot; v kept) - the caller hands the run to the next controller. */
export function stepGlide(g: GlideState, dtS: number, T: StepTuning = STEP_TUNING): GlideStep
```

`stepGlide` algorithm. Implement it exactly, in this order:

1. `dt = Number.isFinite(dtS) ? clampI(dtS, 0, T.glide.maxDtS) : 0`.
2. `g.mult += (g.multTarget - g.mult) * (1 - Math.exp(-dt / T.speed.tauS))`. Set `m = g.mult`.
3. Set:
   - `V = T.glide.fps * m`
   - `tIn = T.glide.easeInS / Math.pow(m, T.speed.easeInExp)`
   - `tOut = T.glide.decelS / Math.pow(m, T.speed.decelExp)`
   - `p = T.glide.decelPow`
4. `r = g.target - g.x`, `dir = Math.sign(r)`.
5. **Reversal brake.** If `g.v !== 0 && Math.sign(g.v) !== dir`:
   - If `g.brake <= 0`:
     - `room = Number.isFinite(g.limit) ? Math.abs(g.limit - g.x) : Infinity`
     - `g.brake = room > 1e-6 ? Math.max(Math.abs(g.v) / T.reverse.brakeS, (g.v * g.v) / (2 * room)) : Infinity`
   - `s = Math.sign(g.v)`, `nv = g.v - s * g.brake * dt`. If `g.brake === Infinity || Math.sign(nv) !== s`, set `nv = 0`.
   - `g.x += 0.5 * (g.v + nv) * dt`. If `Number.isFinite(g.limit) && s * (g.x - g.limit) > 0`, set `g.x = g.limit`.
   - `g.v = nv`. If `nv === 0`, set `g.brake = 0; g.ramp = 0; g.limit = NaN`.
   - `return 'move'`.
6. `g.brake = 0; g.limit = NaN`.
7. If `dir === 0`:
   - If `g.extra > 0`, `return 'edge'`.
   - Otherwise `g.v = 0; g.ramp = 0; return 'land'`.
8. Set:
   - `ad = Math.abs(r)`
   - `g.ramp = Math.min(1, g.ramp + (tIn > 0 ? dt / tIn : 1))`
   - `sm = g.ramp * g.ramp * (3 - 2 * g.ramp)`
9. Set:
   - `Dout = (V * tOut) / (p + 1)`
   - `rem = ad + Math.max(0, g.extra)`
   - `vBrake = Dout > 0 ? V * Math.pow(rem / Dout, p / (p + 1)) : V`
   - `vc = Math.min(V * sm, vBrake)`
10. Acceleration clamp:
    - `aUp = (1.5 * V) / Math.max(tIn, 1e-3)`
    - `cur = Math.abs(g.v)`
    - If `vc > cur + aUp * dt`, set `vc = cur + aUp * dt`.

    This clamp makes run extensions mid-brake re-accelerate smoothly.
11. If `g.extra <= 0 && (vc * dt >= ad || ad < T.glide.landEps)`: set `g.x = g.target; g.v = 0; g.ramp = 0` and
    `return 'land'`.
12. Advance:
    - `nv = dir * vc`
    - `g.x += 0.5 * (g.v + nv) * dt`
    - `g.v = nv`
13. If `dir * (g.target - g.x) <= 0`:
    - If `g.extra > 0`, `return 'edge'`. Keep the overshoot in `x`.
    - Otherwise set `g.x = g.target; g.v = 0; g.ramp = 0` and `return 'land'`.
14. `return 'move'`.

### 4.2 `components/hooks/useStepScroll.ts`

**Header comment (lines 3-5).** Replace it with:

```
// ─── Stepped frame scrolling ──────────────────────────────────────────────────
// Every wheel/trackpad/touch/key gesture moves at least one stop. Extra same-direction gestures extend the glide straight
// through stops (continuous velocity, brake only into the final stop); input during a hold is queued, never dropped. Fast
// streaks speed the glide up, a tap eases into the nearest reachable stop, an opposite gesture brakes and returns.
// Glides are driven per frame on the shared ticker (stepGlide, delta time). Policy and tunables: lib/step-scroll.ts.
```

**Imports.**
- Add `onEveryFrame` from `@/lib/frame-loop` and `scrollStore` from `@/lib/scroll-store`.
- From `@/lib/step-scroll`:
  - Remove `GLIDE_WATCHDOG_MS`, `SWIPE_MIN_PX`, `glideEase` and `glideProfile`.
  - Add `STEP_TUNING`, `classifyWheel`, `classifyTouchEnd`, `createGlide`, `createStreak`, `holdMs`, `nextStreak`, `pathFrames`,
    `pathY`, `pushPending`, `queuedHoldUntil`, `reversePlan`, `reverseStop`, `runTarget`, `runUsed`, `speedMult`, `stepGlide`,
    `streakLevelAt`, `tapTarget` and `touchAxis`.
  - Add the types `GlideState`, `InputDevice`, `Pending` and `StreakState`.
- Drop `StepAction` if it is unused after `apply` is deleted.

**`TouchState`.** Add three fields:
- `t0: number`: the `performance.now()` of the touchstart.
- `travel: number`: the max distance from start in px.
- `moving: boolean`: whether a glide was running or steps were pending at touchstart.

Initialise them to `0`, `0` and `false`.

**Module state.** Replace `let sharedHoldUntil = 0;` with:

```ts
const motion = {
  owner: null as StepScrollController | null, // controller whose glide is running
  gliding: false,
  g: null as GlideState | null,
  stop: -1,              // owner's target stop index (ys index)
  extraSteps: 0,         // run continues this many stops into `next` after the owner's edge stop
  next: null as StepScrollController | null,
  dir: 1 as 1 | -1,
  lockSpeed: false,      // auto-advance glide: always 1x, never extended
  holdUntil: 0,          // one landing hold for all controllers (was sharedHoldUntil)
  landedAt: -1e12,
  device: 'wheel' as InputDevice,
  streak: createStreak() as StreakState,
  pending: { dir: 1, count: 0 } as Pending,     // queued during a hold
  dispatchTimer: null as Timer,
  autoArmed: false,
  lastCounted: null as Event | null,            // event de-dupe: every controller's gate sees the same event object
  lastQueued: null as Event | null,
  lastTap: null as Event | null,
  zoneOn: false,
};
```

**Fields.**
- Delete `gliding`, `glideDeadline` and `glideDir`.
- Add:
  - `private fs: number[] = []`
  - `private wheelAcc = 0`
  - `private wheelDevice: InputDevice = 'wheel'`
  - `private unTick: (() => void) | null = null`
  - `private lastWriteY = 0`
- Wherever the code read `this.gliding`, use `motion.gliding`. Where it means "my glide", use
  `motion.gliding && motion.owner === this`.

**Small helpers (instance, private):**
- `autoStop(dir: 1 | -1): number`: returns `dir > 0 && this.autoAdvance !== undefined ? this.autoAdvance : -1`.
- `edgeIdx(dir: 1 | -1): number`: returns `dir > 0 ? this.ys.length - 1 : 0`.
- `neighbour(dir: 1 | -1): StepScrollController | null`:
  - Returns the first `c` in `registry` that satisfies all of these:
    - `c !== this`
    - `c.ready`
    - `stopAt(c.ys, this.ys[this.edgeIdx(dir)], STOP_TOL_PX) === c.edgeIdx(-dir as 1 | -1)`
  - Otherwise returns `null`.
  - Example: Crypto's down neighbour is Forex, and Forex's up neighbour is Crypto.

**`onLayout`.**
- After `this.ys = base;`, build `fs`:
  - `fs[k] = this.stops[k]` for `k < stops.length`.
  - Tail: `fs[n-1] = this.posAt(ys[n-1]) + (this.tailFrames ?? 0)`.
  - Then enforce strictly ascending: `fs[k] = Math.max(fs[k], fs[k-1] + 1e-3)`.
- `if (!this.gliding)` becomes `if (!motion.gliding)`.
- At the end, if `motion.owner === this && motion.g`:
  - `motion.g.target = this.fs[motion.stop]`.
  - If `motion.extraSteps > 0`, call `this.setExtra(motion.extraSteps)`.
  - If `Number.isFinite(motion.g.limit)`, set `motion.g.limit = motion.g.limit > motion.g.x ? this.fs[this.fs.length - 1] : this.fs[0]`.

**`attach`.**
- When `lenis` exists, also add `window.addEventListener('touchmove', this.onTouchMoveGuard, { passive: false })` and remove it on
  cleanup.
- Cleanup:
  - If `motion.owner === this`, call `this.abortGlide()`.
  - If `this.unTick`, call it.
  - After `registry.delete(this)`, if `registry.size === 0`:
    - Clear `motion.dispatchTimer`.
    - Remove the `step-zone` class from `<html>` and set `motion.zoneOn = false`.
- Remove `this.gliding = false`.

**Helpers.**
- `busy()`: `motion.gliding || performance.now() < motion.holdUntil`.
- `blocked()`: `!!L && (L.isStopped || L.isLocked)`.
- Delete `watchdog()` and every call to it.
- `refreshRest()`:
  - Use `moving = motion.gliding || (L !== null && L.isScrolling !== false)`.
  - On a transition to rest (`k >= 0 && this.restStop < 0`): take `now`. If `now + HOLD_MIN_MS > motion.holdUntil`, set
    `motion.holdUntil = now + HOLD_MIN_MS; motion.landedAt = now`.
  - This is the default hold for catches, settles and jumps. `land()` overwrites it.
  - Because `moving` is true during the whole run, middle stops never trigger it.
- `onTouchMoveGuard = (e: TouchEvent): void`:
  - Condition: `t.active && !t.multi && t.engaged && t.decided && !t.released && !this.blocked() && e.cancelable`.
  - If true, call `e.preventDefault()`.

**Motion methods.** These replace `glideTo`, `apply` and `onComplete`.

- `private glideTo(k: number, o: { auto?: boolean; extraSteps?: number } = {}): void`
  1. `Y = this.ys[k]`. Set `restStop = restIdx = -1`. Clear `autoTimer`. Set `motion.autoArmed = false`.
  2. `y0 = this.y()`, `dir: 1 | -1 = Y >= y0 ? 1 : -1`.
  3. Reduced motion (`!this.lenis`):
     - If `o.extraSteps` and `nb = this.neighbour(dir)` exist:
       - `r = runTarget(nb.ys.length, nb.edgeIdx(-dir), dir, o.extraSteps, nb.autoStop(dir))`
       - `nb.jump(nb.ys[r.stop]); nb.land(r.stop, dir); return;`
     - Otherwise `this.jump(Y); this.land(k, dir); return;`.
  4. `x0 = pathFrames(y0, this.ys, this.fs)`. If `Math.abs(this.fs[k] - x0) < 1e-3 && !o.extraSteps`:
     `this.jump(Y); this.land(k, dir); return;`.
  5. `now = performance.now()`, `m = o.auto ? 1 : speedMult(streakLevelAt(motion.streak, now), motion.device)`.
  6. Set:
     - `motion.owner = this; motion.gliding = true; motion.stop = k; motion.dir = dir`
     - `motion.lockSpeed = !!o.auto; motion.extraSteps = 0; motion.next = null`
     - `motion.g = createGlide(x0, this.fs[k], m)`
  7. If `o.extraSteps`, call `this.setExtra(o.extraSteps)`.
  8. `this.lastWriteY = y0; StepScrollController.syncZone(y0)`. If `!this.unTick`, set
     `this.unTick = onEveryFrame(this.tick, 'update')`.
- `private setExtra(steps: number): boolean` (owner; the run continues `steps` stops into the neighbour)
  1. `g = motion.g`, `dir = motion.dir`.
  2. If `!g || steps <= 0 || motion.stop !== this.edgeIdx(dir)`: set `motion.extraSteps = 0; motion.next = null`; if `g`, set
     `g.extra = 0`. `return false`.
  3. `nb = this.neighbour(dir)`. If none: the same reset, then `return false`.
  4. `e0 = nb.edgeIdx(-dir as 1 | -1)`, `r = runTarget(nb.ys.length, e0, dir, steps, nb.autoStop(dir))`,
     `got = Math.abs(r.stop - e0)`.
  5. Set `motion.extraSteps = got; motion.next = got > 0 ? nb : null; g.extra = got > 0 ? Math.abs(nb.fs[r.stop] - nb.fs[e0]) : 0`.
  6. `return got > 0`.
- `private extendRun(maxUsed: number): void` (owner, same-direction gesture while gliding)
  1. `g = motion.g`. If `!g || motion.lockSpeed`, return (absorbed).
  2. `dir = motion.dir`. If `runUsed(this.fs, g.x, dir, motion.stop, motion.extraSteps) >= maxUsed`, return (cap; absorbed).
  3. If `motion.extraSteps > 0`: `this.setExtra(motion.extraSteps + 1); return`.
  4. `r = runTarget(this.ys.length, motion.stop, dir, 1, this.autoStop(dir))`.
  5. If `r.stop !== motion.stop`: set `motion.stop = r.stop; g.target = this.fs[r.stop]` and return.
  6. If `r.rest > 0`, call `this.setExtra(1)`. Otherwise the run is at O3 or an exit edge: absorbed (owner Q2).
- `private tick = (_ts: number, deltaMs: number): void`
  1. `g = motion.g`, `L = this.lenis`. If `!g || !L || motion.owner !== this || !motion.gliding`: unsubscribe and return.
  2. If `L.isStopped || L.isLocked || Math.abs(L.targetScroll - this.lastWriteY) > 1`: `this.abortGlide(); return`.
  3. If `!motion.lockSpeed`, set `g.multTarget = speedMult(streakLevelAt(motion.streak, performance.now()), motion.device)`.
  4. `res = stepGlide(g, deltaMs / 1000)`.
  5. If `res === 'edge'`: `this.handover(); return;`.
  6. `y = res === 'land' ? this.ys[motion.stop] : pathY(g.x, this.ys, this.fs)`. Then call
     `this.write(y)`, which does all of the following:
     - `prev = this.y()`
     - `L.scrollTo(y, { immediate: true, force: true })`
     - `this.lastWriteY = y`
     - `scrollStore.velocity = y - prev`
     - `scrollStore.direction = y > prev ? 1 : y < prev ? -1 : 0`
  7. If `res === 'land'`, call `this.land(motion.stop, motion.dir)`.
- `private handover(): void` (owner's glide passed its edge stop with `extra > 0`)
  1. `g = motion.g!`, `nb = motion.next`, `dir = motion.dir`. If `!nb`: set `g.extra = 0`, write `this.ys[motion.stop]`, call
     `this.land(motion.stop, dir)` and return.
  2. Set:
     - `over = Math.abs(g.x - g.target)`
     - `e0 = nb.edgeIdx(-dir as 1 | -1)`
     - `r = runTarget(nb.ys.length, e0, dir, motion.extraSteps, nb.autoStop(dir))`
  3. Set:
     - `g.x = nb.fs[e0] + dir * over`
     - `g.target = nb.fs[r.stop]`
     - `g.extra = 0`
     - `g.limit = NaN`

     `v`, `ramp`, `mult`, `multTarget` and `brake = 0` carry over unchanged. This gives continuous velocity in frames/s.
  4. Set:
     - `motion.owner = nb; motion.stop = r.stop; motion.extraSteps = 0; motion.next = null`
     - Unsubscribe `this.unTick`.
     - `nb.lastWriteY = this.lastWriteY`
     - `nb.unTick = onEveryFrame(nb.tick, 'update')`
  5. Call `nb.write(pathY(g.x, nb.ys, nb.fs))` so this frame still moves. From the next frame, `nb.tick` drives.
- `private land(k: number, dir: 1 | -1): void`
  1. `now = performance.now()`. Set `motion.gliding = false; motion.owner = null; motion.g = null;`
     `motion.extraSteps = 0; motion.next = null`. Unsubscribe the tick.
  2. If `this.lenis && Math.abs(this.y() - this.ys[k]) > 0.5`, call
     `this.lenis.scrollTo(this.ys[k], { immediate: true, force: true })`.
     Then set `scrollStore.velocity = 0; scrollStore.direction = 0`.
  3. `for (const c of registry) c.refreshRest();`
  4. `level = streakLevelAt(motion.streak, now); motion.landedAt = now;`
  5. If `this.autoAdvance === k && dir > 0`:
     - `motion.pending = { dir: 1, count: 0 }; motion.holdUntil = now + HOLD_MIN_MS; motion.autoArmed = true;`
     - `this.armAuto(k)`
     - `StepScrollController.syncZone(this.y()); return;`
  6. `motion.holdUntil = now + holdMs(level, motion.pending.count > 0, motion.device)`. This is an assignment, not a max.
  7. `StepScrollController.scheduleDispatch(); StepScrollController.syncZone(this.y());`
- `private abortGlide(): void`
  - Set `motion.gliding = false; motion.owner = null; motion.g = null; motion.extraSteps = 0; motion.next = null`.
  - Clear pending.
  - Unsubscribe. Set `scrollStore.velocity = 0`.
  - `for (const c of registry) c.refreshRest();`
- `private reverse(dir: 1 | -1): void` (owner)
  1. `g = motion.g`. If none, return.
  2. `plan = reversePlan(this.fs, g.x, g.v, dir)`.
  3. Set:
     - `motion.stop = plan.stop; motion.dir = dir`
     - `g.target = this.fs[plan.stop]; g.limit = plan.limit`
     - `g.extra = 0; motion.extraSteps = 0; motion.next = null`
     - `motion.pending = { dir, count: 0 }; motion.lockSpeed = false`
  4. Clear `autoTimer`. Set `motion.autoArmed = false`.
- `private tapRetarget(): void` (owner)
  1. `g = motion.g`. If none, return.
  2. `j = tapTarget(this.fs, g.x, g.v, g.mult)`.
  3. Decide:
     - If `j >= 0 && motion.dir * (j - motion.stop) <= 0`: set `motion.stop = j; g.target = this.fs[j]; g.extra = 0;`
       `motion.extraSteps = 0; motion.next = null`.
     - Else if `j < 0 && motion.extraSteps > 1`: call `this.setExtra(1)` (cross-controller run: stop at the neighbour's first stop).
     - Otherwise keep the target. It is already the nearest reachable stop.
- `armAuto(k)`: keep `setTimeout(..., AUTO_ADVANCE_MS)`.
  - Guard: `!this.ready || motion.gliding || this.blocked() || this.touch.active || stopAt(...) !== k`.
    - If true: `motion.autoArmed = false; return`.
    - Otherwise: `this.glideTo(k + 1, { auto: true })`.
- `catchTo`, `jump`, `touchCatch`, `unlockSoon`, `armSettle`: unchanged.
  - In `settle`, use `motion.gliding`.

**Static (shared) methods.** Static members can read instances' private members.

- `private static count(e, dir, device, now, repeat): void`
  - If `motion.lastCounted === e`, return.
  - Set `motion.lastCounted = e; motion.device = device`.
  - If `!repeat`, set `motion.streak = nextStreak(motion.streak, now, dir)`.
- `private static enqueue(e, dir, repeat, now): void`
  - If `motion.lastQueued === e`, return. Set `motion.lastQueued = e`.
  - `motion.pending = pushPending(motion.pending, dir, repeat)`.
  - Set `motion.holdUntil = queuedHoldUntil(motion.holdUntil, motion.landedAt, now, streakLevelAt(motion.streak, now), motion.device)`.
  - `scheduleDispatch()`.
- `private static scheduleDispatch(): void`
  - Clear the timer.
  - If `motion.pending.count <= 0 || motion.gliding`, return.
  - `motion.dispatchTimer = setTimeout(StepScrollController.dispatch, Math.max(0, motion.holdUntil - performance.now()))`.
- `private static dispatch = (): void =>`
  1. Set `motion.dispatchTimer = null`. If `motion.gliding || motion.pending.count <= 0`, return.
  2. If `performance.now() < motion.holdUntil - 1`, call `scheduleDispatch()` and return.
  3. `{ dir, count } = motion.pending; motion.pending = { dir, count: 0 };` (cleared **before** gliding, because the
     reduced-motion `land()` is synchronous).
  4. `for (const c of registry) if (c.tryPending(dir, count)) return;` If none glides, nothing happens (exit edge, owner Q2).
- `private static tapStop(e: Event): void`
  - If `motion.lastTap === e`, return. Set `motion.lastTap = e`.
  - Clear pending and the dispatch timer.
  - Set `motion.streak = createStreak()`.
  - If `motion.gliding`, call `motion.owner?.tapRetarget()`.
- `private static syncZone(y: number): void`
  - `on = motion.gliding || [...registry].some((c) => c.ready && c.inZone(y))`.
  - Toggle `html.step-zone` only when `on` changes, and store it in `motion.zoneOn`.
- `private tryPending(dir: 1 | -1, count: number): boolean`
  1. If `!this.ready || this.blocked()`, return false.
  2. `y = this.y()`.
     `a = decideStep(this.ys, STOP_TOL_PX, { y, target: y + dir, dir, fresh: true, acted: null, foreign: this.foreign(y), busy: false })`.
     If `a.kind !== 'glide'`, return false.
  3. `r = runTarget(this.ys.length, a.stop, dir, count - 1, this.autoStop(dir))`.
  4. `this.glideTo(r.stop, { extraSteps: r.rest }); return true;`

     `extraSteps` is ignored by `setExtra` unless `r.stop` is the edge and a neighbour exists.

**Gesture core** (replaces `apply`):

```ts
private gesture(dir: 1 | -1, device: InputDevice, e: Event, target: number,
  o: { id?: number; repeat?: boolean; noPrevent?: boolean } = {}): boolean   // true = let it through
```

1. Set `now = performance.now()`. Define
   `consume = () => { if (o.id !== undefined) this.acted = { id: o.id, kind: 'consume' }; if (!o.noPrevent && e.cancelable) e.preventDefault(); return false; }`.
2. If `motion.gliding`:
   - If `motion.owner !== this`: if `o.id !== undefined`, set `this.acted = { id: o.id, kind: 'consume' }`. `return true`.
   - `StepScrollController.count(e, dir, device, now, !!o.repeat)`.
   - If `dir === motion.dir`, call `this.extendRun(o.repeat ? 1 : STEP_TUNING.queue.max)`. Otherwise call `this.reverse(dir)`.
   - `return consume()`.
3. `y = this.y()`.
   `a = decideStep(this.ys, STOP_TOL_PX, { y, target, dir, fresh: true, acted: null, foreign: this.foreign(y), busy: false })`.
4. If `a.kind === 'pass'`: if `o.id !== undefined`, set `this.acted = { id: o.id, kind: 'pass' }`. `return true`.
5. `catch`: `this.catchTo(a.stop); return consume()`. `swallow`: `return consume()`.
6. `glide`:
   - If `motion.autoArmed && dir > 0`, `return consume()`.
   - `StepScrollController.count(e, dir, device, now, !!o.repeat)`.
   - If `now < motion.holdUntil || motion.pending.count > 0`:
     `StepScrollController.enqueue(e, dir, !!o.repeat, now); return consume()`.
   - Otherwise `this.glideTo(a.stop); return consume()`.

**Wheel** (in `onInput`, replacing the wheel branch):
1. If `we.ctrlKey || data.deltaY === 0`, `return true`.
2. `fresh = feedWheel(this.wheel, we.timeStamp, data.deltaY)`. If `fresh`:
   `this.wheelAcc = 0; this.wheelDevice = classifyWheel(we.deltaMode, we.deltaY)`.
   Then `this.wheelAcc += Math.abs(data.deltaY)`.
3. If `!this.ready || this.blocked()`, `return true`.
4. `id = this.wheel.id`. If `this.acted.id === id`:
   - `pass`: `return true`.
   - Otherwise: preventDefault if cancelable; `return false`.
5. `y = this.y()`, `dir = data.deltaY > 0 ? 1 : -1`.
   If `this.wheelAcc < STEP_TUNING.devices[this.wheelDevice].minPx && (motion.gliding || this.inZone(y))`:
   preventDefault if cancelable; `return false`.
6. `return this.gesture(dir, this.wheelDevice, we, (L ? L.targetScroll : y) + data.deltaY, { id })`.

Remove the `watchdog()` calls. `deltaMode` normalisation stays where it is: Lenis does it, and the reduced-motion adapter mirrors it.

**Touch** (`onTouch`):

- `touchstart` (2+ touches: unchanged):
  - Set `t.active = true; t.multi = false; t.x0/y0; t.t0 = performance.now(); t.travel = 0;`
    `t.decided = t.released = t.committed = false` (**R1 fix**).
  - `t.moving = motion.gliding || motion.pending.count > 0`.
  - `t.engaged = t.moving || performance.now() < motion.holdUntil || this.inZone(this.y())`.
  - `return true`.
- `touchmove`:
  1. Multi checks: unchanged.
  2. `dx`, `up` as now. `t.travel = Math.max(t.travel, Math.hypot(dx, up))`.
  3. If `t.released || !t.engaged`, `return true`.
  4. If `!t.decided`:
     - `ax = touchAxis(dx, up)`. If `ax === null`, `return true` (**R3 fix**).
     - Set `t.decided = true`.
     - If `!motion.gliding`:
       - `ax === 'h'`: `t.released = true; return true`.
       - `y = this.y()`. If
         `decideStep(this.ys, STOP_TOL_PX, { y, target: y + up, dir: up >= 0 ? 1 : -1, fresh: true, acted: null, foreign: this.foreign(y), busy: false }).kind === 'pass'`:
         `t.released = true; return true`.
  5. preventDefault if cancelable.
  6. If `!t.committed && Math.abs(up) >= STEP_TUNING.devices.touch.minPx`: set `t.committed = true` and call
     `this.gesture(up > 0 ? 1 : -1, 'touch', e, this.y() + up)` (**R2 fix**).
  7. `return false`.
- `touchend` (before the existing bookkeeping):
  - Condition: `t.active && !t.multi && t.engaged && !t.released && !t.committed && e.changedTouches.length > 0`.
  - `p = e.changedTouches[0]`, `dx = p.clientX - t.x0`, `up = t.y0 - p.clientY`.
  - `kind = classifyTouchEnd(Math.max(t.travel, Math.hypot(dx, up)), up, performance.now() - t.t0, t.moving || motion.gliding || motion.pending.count > 0)`.
  - `swipe` and `touchAxis(dx, up) !== 'h'`: set `t.committed = true` and call
    `this.gesture(up > 0 ? 1 : -1, 'touch', e, this.y() + up, { noPrevent: true })` (**R4 fix**).
  - `tap`: `StepScrollController.tapStop(e)`.
- `touchCatch`: unchanged.

**Keys** (`onKey`). Keep every guard. Replace the `this.watchdog(); ... this.apply(...)` tail with:
1. If `!e.repeat`, `this.keySeq -= 1`. Then `id = this.keySeq`, `step` (as now), `y = this.y()`.
2. If `e.repeat && this.acted.id === id && this.acted.kind === 'pass'`, return.
3. `this.gesture(dir, 'key', e, y + dir * step, { id, repeat: e.repeat && this.acted.id === id })`.

**`onScroll`.**
- Remove `watchdog()`. `!this.gliding` becomes `!motion.gliding`.
- After `this.prevY = y;`, add `StepScrollController.syncZone(y);`.

### 4.3 `components/sections/CryptoMarketScroll.tsx` and `components/sections/ForexMarketScroll.tsx`

In each sticky `<div ref={stickyRef} ...>` style object, add `touchAction: 'pan-y pinch-zoom',`:
- Crypto: at about line 106.
- Forex: at about line 291.

Nothing else changes (**R7**).

### 4.4 `app/globals.css`

After the `html { ... }` block at about lines 187-192, add:

```css
/* Step-scroll zone (useStepScroll toggles the class): no rubber-band / pull-to-refresh fighting the glides */
html.step-zone,
html.step-zone body {
  overscroll-behavior-y: none;
}
```

### 4.5 Hook box: no code change

`lib/hook-box.ts`, `components/sections/HookBox.tsx` and `components/motion/useSlabScrub.ts` stay as they are. The pass-through
behaviour is safe for three reasons (section 2):
- Hooks are a pure function of `s`.
- Their windows are disjoint.
- `useSlabScrub` writes the final state on any zone change, even when a frame jumps a whole window.

Tests 21 and 22 lock this down. If the owner later wants passing hooks hidden instead of flashing, that would be a separate
change: a "run in progress" mask in `useSlabScrub`. It is not in this plan.

### 4.6 `rules.md`

1. In **§2 Performance Rules**, after the "Viewport & responsiveness" list, add:

```markdown
**Scroll timing (step scroll, `lib/step-scroll.ts` → `STEP_TUNING`):**
- Every tunable lives in `STEP_TUNING`: min push per device (touch 8 px, wheel 1 px, trackpad 3 px), base glide (48 fps,
  0.4 s ease-in, 1.0 s brake), speed steps 1 / 1.4 / 1.8 / 2.2 x (cap level 3), streak window 600 ms, final-stop holds
  700 / 500 / 350 / 250 ms by level (80–250 ms when input is queued), run extension cap 3 stops, reverse brake 0.3 s,
  tap < 8 px and ≤ 300 ms. Change values there only.
- Extra same-direction swipes during a glide extend it straight through the next stops (continuous speed, brake only into the
  final stop; only the final stop holds). Input during a hold is queued, never dropped. Runs stop at sequence edges.
- Glides run on the shared ticker (`onEveryFrame(..., 'update')`, delta time); no own rAF, no Lenis duration tweens.
- Video auto-advance (Forex O3 → video) is `AUTO_ADVANCE_MS` = 450 ms, always 1x, never extended; not part of `STEP_TUNING`.
- Sticky stages use `touch-action: pan-y pinch-zoom`; `html.step-zone` disables overscroll inside the zone.
- Reduced motion: no Lenis, instant jumps, same queue and hold rules.
```

2. **§3 Content Rules**, hook-box sentence: change "settling as the frame lands." to "settling as the frame lands at any glide
   speed; hooks of stops passed mid-run may flash past but never overlap."
3. **Quick Reference**: add the row `| \`lib/step-scroll.ts\` | Step-scroll policy and \`STEP_TUNING\` (all scroll feel tunables) |`.
4. **Last updated**: `2026-10-26`.
5. Do **not** change the §5 branch rule. This feature uses its own branch by owner instruction (section 9).

## 5. Tests: new file `tests/step-scroll-momentum.test.mjs`

Use the style of `tests/step-scroll.test.mjs`: `node:test`, `assert/strict` and `near(a, b, eps)`. Import:
- `../lib/step-scroll.ts`
- `../lib/hook-box.ts`
- `../lib/crypto-slabs.ts` (`slabZone`)
- `../lib/frame-sequence/math.ts` (`lookahead`, `decodeStride`)

Do not edit `tests/step-scroll.test.mjs`. It must pass unchanged.

Helpers:
- `simulate(g, dt, maxS = 10, onTick?)` loops `stepGlide`, calling `onTick(g, t)` before each step. It records `t`, `x`, `v` and
  the result, and stops on `'land'` or `'edge'`. It returns `{ duration, xs, vs, res }`.
- `aUp(m) = 1.5 * 48 * m / (0.4 / m)`.

1. **Tuning shape**:
   - `speed.steps[0] === 1`, strictly increasing, last `=== 2.2`, `STREAK_CAP === 3`.
   - `hold.ms` and `hold.pendingMs` have the same length as `steps`. Both are non-increasing, and `pendingMs[i] <= ms[i]`.
   - `touch.tapMaxPx <= devices.touch.minPx`, `queue.max === 3`.
   - `AUTO_ADVANCE_MS === 450` and `!('autoAdvance' in STEP_TUNING)`.
   - `HOLD_MIN_MS === 700`, `STEP_FPS === 48`, `STEP_EASE_IN_S === 0.4`, `STEP_DECEL_S === 1`, `GESTURE_GAP_MS === 180`.
2. **speedMult / holdMs**:
   - Levels 0..3 give 1, 1.4, 1.8 and 2.2. Level 9 gives 2.2. Level -1 gives 1.
   - `holdMs` gives 700/500/350/250, and 250/180/120/80 with pending.
3. **nextStreak / streakLevelAt**:
   - 5 down gestures 200 ms apart give levels 0, 1, 2, 3, 3.
   - A gap of 600 counts. A gap of 601 gives 0.
   - Flipping direction gives 0.
   - `streakLevelAt({level:3,dir:1,lastT:0}, t)` is 3 at 599, 2 at 600, 1 at 1200, 0 at 1800 and 0 at 99999.
4. **pushPending**:
   - Four down pushes from `{1,0}` give counts 1, 2, 3, 3.
   - An opposite push gives `{-1,1}`.
   - A repeat gives max(1, count).
5. **queuedHoldUntil**: `landedAt 0`, `holdUntil 700`, level 0.
   - now 100 gives 250. now 400 gives 400.
   - With `holdUntil 200`, now 100 gives 200.
6. **classifyWheel**:
   - Wheel: `(1, 3)`, `(2, 1)`, `(0, 100)`, `(0, -120)` and `(0, 150)`.
   - Trackpad: `(0, 4.5)`, `(0, 12)`, `(0, 53.3)` and `(0, 49)`.
7. **touchAxis / classifyTouchEnd**:
   - touchAxis: `(0,0)` is null, `(2,0)` is null, `(5,1)` is 'h', `(1,1)` is 'v', `(3,-2)` is 'v', `(0,4)` is 'v'.
   - classifyTouchEnd:
     - `(6,6,120,true)` is 'tap'.
     - `(6,6,120,false)` is 'none'.
     - `(20,8,90,true)` is 'swipe'.
     - `(20,-9,90,false)` is 'swipe'.
     - `(7,3,400,true)` is 'none'.
8. **pathFrames / pathY**: `ys = [1000, 2567, 2937, 3500, 4500]`, `fs = [0, 89, 110, 142, 170]`.
   - Knots map both ways, and the midpoint gives 44.5.
   - The round trip holds within 1e-9 for 50 points.
   - Clamps: 0 maps to 0, 9999 maps to 170, `pathY(-5)` is 1000 and `pathY(500)` is 4500.
9. **reverseStop**: `fs = [0, 50, 88]`.
   - `(30,-1)` gives 0, `(30,1)` gives 1, `(50,-1)` gives 0, `(50,1)` gives 2, `(100,1)` gives -1, `(-1,-1)` gives -1.
10. **stepGlide matches glideProfile at 1x**: 89 frames, dt 1/60.
    - `|duration - glideProfile(89).duration| <= 0.05`.
    - Every tick has `|x - glideEase(t/D, prof)*89| <= 0.6`.
    - It ends with `x === 89`, `v === 0` and `res === 'land'`.
11. **frame-rate independence**:
    - For dt in 1/30, 1/60, 1/120 and 1/144, the 89-frame durations are within 0.05 s of each other.
    - Each run lands exactly.
    - `max|v| <= 48 + 1e-9`.
    - The last pre-landing `|v| < 1.5`.
12. **no velocity jumps**: at 1/60 and mult 1, every non-landing tick has `|Δv| <= aUp(1)*dt + 1e-6`.
13. **speed-up**:
    - The 89-frame duration at mult 1, 1.4, 1.8 and 2.2 is strictly decreasing.
    - `duration(2.2) < 0.6 * duration(1)`.
    - `max|v| <= 48*2.2 + 1e-9`.
14. **mid-glide mult change**:
    - At t ≥ 0.6, set `multTarget = 2.2`.
    - Every tick has `|Δv| <= aUp(2.2)*dt + 1e-6`.
    - `max v > 48*1.3`.
    - It lands at 89.
15. **runTarget**:
    - `(10, 2, 1, 3, 8)` gives `{5,0}`.
    - `(10, 6, 1, 3, 8)` gives `{8,0}` (auto cap).
    - `(10, 8, 1, 1, 8)` gives `{9,0}` (from O3 the cap no longer applies).
    - `(10, 1, -1, 3, -1)` gives `{0,2}`.
    - `(5, 2, 1, 3, -1)` gives `{4,1}`.
    - `(5, 2, 1, 0, -1)` gives `{2,0}`.
16. **runUsed**: `fs = [0,10,20,30,40]`.
    - `(5, 1, 1, 0)` gives 0. `(5, 1, 3, 0)` gives 2. `(5, 1, 4, 2)` gives 5.
    - `(35, -1, 1, 0)` gives 2. `(45, 1, 4, 0)` gives 0 (no stop ahead).
17. **pass-through extension is continuous**:
    - fs is implicit. Glide `createGlide(0, 89, 1)` at dt 1/60.
    - In `onTick`, the first time `x >= 80` (already braking), set `g.target = 110`.
    - Every tick has `|Δv| <= aUp(1)*dt + 1e-6`.
    - `v > 0` on every tick until landing. In particular, `v > 20` while x is in [85, 95], so there is no stop at 89.
    - It lands at 110.
    - The total duration is less than `simulate(0→89).duration + simulate(89→110 from rest).duration`.
18. **edge hand-over**:
    - `g = createGlide(0, 89, 1); g.extra = 50`. Simulate at 1/60.
    - It returns `'edge'` exactly once.
    - At that tick, `|v| >= 0.9*48`, `x >= 89` and `x - 89 <= 48/60 + 1e-9`.
    - Then hand over with `over = g.x - 89; g.x = over; g.target = 50; g.extra = 0` and keep simulating.
      - `|Δv|` across the hand-over tick is `<= aUp(1)*dt + 1e-6`.
      - It lands at 50.
19. **tapTarget / stoppingFrames**: `fs` = 0, 10, ..., 200 (21 stops).
    - `stoppingFrames(48, 1)` gives 16. `stoppingFrames(0, 1)` gives 0.
    - `tapTarget(fs, 55, 48, 1)` gives 8 (fs 80).
    - `tapTarget(fs, 55, 10, 1)` gives 6 (need about 1.52, so fs 60).
    - `tapTarget(fs, 55, -48, 1)` gives 3 (fs 30).
    - `tapTarget(fs, 195, 48, 1)` gives -1. `tapTarget(fs, 55, 0, 1)` gives -1.
    - Simulation: cruise toward 200 at 1x until x ≥ 55, then set `target = fs[tapTarget(...)]`. Every tick has
      `|Δv| <= aUp(1)*dt + 1e-6`, and it lands at 80.
20. **reversePlan + reversal simulation**: `fs = [0, 50, 89, 140]`.
    - `reversePlan(fs, 60, 48, -1)` gives `{ stop: 1, limit: 140 }` (brake end 67.2).
    - `reversePlan(fs, 138, 5, -1).limit` is 140 and `.stop` is 2.
    - `reversePlan(fs, 60, 0, -1)` gives `{ stop: 1, limit: NaN }`.
    - Simulation from `createGlide(0, 140, 1)`: when `x >= 60`, apply `reversePlan(..., -1)` to `g.target` and `g.limit`.
      - v is ≥ 0 until it reaches 0, then ≤ 0.
      - `max x <= 67.2 + 0.5`.
      - The brake time is ≤ `0.3 + 2*dt`.
      - It lands at 50.
    - Near the edge: start at x = 137 cruising slowly toward 140 (`createGlide(130, 140, 1)` run until x ≥ 138), then reverse.
      x is never > 140, and it lands at 89.
21. **hook windows** (requirement 7), for `CRYPTO_HOOK_IDS` and `MARKET_HOOK_IDS`, with i as the position in the list:
    - `inTo === i`, `outFrom === i` and `inFrom < inTo`.
    - For i > 0, `prev.outTo <= w.inFrom`.
    - Sweep s from -1 to 10 in steps of 0.001: at most one hook has `inFrom < s < outTo` at any s.
22. **frame jumps over a window still settle** (pass-through at speed):
    - For each window w: `slabZone(w.inFrom - 0.01, w)` is 0 and `slabZone(w.outTo + 0.01, w)` is 4. They differ, so
      `useSlabScrub` writes the final hidden state when one frame skips the window.
    - `slabZone(w.inTo, w)` is 3 (complete at the stop, which is the landing state).
23. **decode coverage at top speed**: `speed = 48*2.2`.
    - For w in [16, 24, 32, 48, 64]: `{ ahead } = lookahead(speed, w)`, `stride = decodeStride(speed, ahead)`.
    - Assert `ahead * stride >= speed * 0.5`.
24. **dt guards**:
    - `stepGlide(g, NaN)` and `stepGlide(g, 0)` from rest change neither x nor v.
    - `stepGlide(g, 5)` from rest gives `x <= 48*0.05`.
25. **short glides**: 19 frames and 21 frames both land within (0.6 s, 1.4 s).

## 6. Acceptance checks

- `corepack pnpm test` passes: the old tests unchanged plus the 25 new ones.
- `corepack pnpm exec tsc --noEmit`, `corepack pnpm lint` and `corepack pnpm build` are clean.
- `grep -nE "SWIPE_MIN_PX|GLIDE_WATCHDOG_MS|glideEase|glideProfile|requestAnimationFrame|sharedHoldUntil|watchdog" components/hooks/useStepScroll.ts`
  prints nothing.
- `grep -rn "SWIPE_MIN_PX\|GLIDE_WATCHDOG_MS" components lib tests app` prints nothing.
- `AUTO_ADVANCE_MS = 450` is outside `STEP_TUNING`.
- `git diff --stat main` lists only the files in section 9, on branch `step-scroll-touch`.

## 7. Manual test checklist (owner, real devices; dev HUD with `corepack pnpm dev`)

Run every row in Crypto and in the Forex chain. "Lands" means the HUD `pos` is exactly the stop index and the final hook's last
letter settles at that moment.

| # | Device | Action | Expected |
|---|---|---|---|
| 1 | iOS Safari, Android Chrome | Tiny swipe (about 1 cm) at a stop | Glides one stop. Never nothing. |
| 2 | Phones | Swipe again **immediately** after a landing (inside 0.7 s) | Not dropped: after a short beat (≤ 0.25 s) it glides on. |
| 3 | Phones | 3-4 fast swipes down (under 0.6 s apart) | One continuous run through the stops. **No slowdown or pause at middle stops**, and speed builds up to 2.2x. It brakes only into the final stop and holds briefly there. Middle hooks flash past in order. Nothing overlaps. The final hook completes on landing. |
| 4 | Phones | Keep swiping steadily all the way down | Carries on to the end of Crypto, through Y0 into Forex **without stopping at Y0**, then on to O3. Lands at O3. The video hand-off follows 0.45 s later at normal speed. |
| 5 | Phones | Stop swiping in the middle of a run | The run finishes at its last queued stop (at most 3 ahead). Speed eases back toward normal with no jerk. |
| 6 | Phones | Tap the screen mid-run | Eases into the nearest stop it can reach smoothly. No freeze or snap, and the rest of the run is cancelled. Links/buttons still tap normally at rest. |
| 7 | Phones | Mid-run, swipe the other way | Brakes in about 0.3 s, then glides back to the nearest stop behind and lands there. Further up swipes extend the run upward. |
| 8 | Phones | Diagonal or sideways-starting swipe | Treated as vertical when mostly vertical. Pinch-zoom works. |
| 9 | Phones | Swipe up at Crypto stop 0 / swipe down at video V | Leaves natively with momentum. A run never carries past these edges by itself. |
| 10 | Phones | Address bar shown/hidden, then swipe | Stops stay exact. No jump at landing. |
| 11 | Laptop mouse wheel | One notch | One stop. A fast spin of several notches (one burst) is one stop. |
| 12 | Laptop mouse wheel | Notches about 0.3 s apart, 4 times | Speeds up and runs through stops without pausing. |
| 13 | Trackpad | Smallest nudge | One stop. A long inertial swipe is one stop (the tail does not extend the run). |
| 14 | Trackpad | Several quick flicks | Continuous run that speeds up, like row 3. |
| 15 | Keyboard | ArrowDown / PageDown / Space once | One stop. **Holding** ArrowDown runs through the stops continuously at constant speed and brakes into a stop soon after release. ArrowUp / Shift+Space reverse. Space on a focused button does not scroll. |
| 16 | All | Forex O3 | Runs always stop at O3. The video hand-off starts 0.45 s after landing at normal speed. Swiping down while waiting does not double-step. Swiping up goes back. |
| 17 | All | OS "Reduce motion" on | Every input jumps instantly. Queued input jumps to the run's final stop after the hold. |
| 18 | All | Open the mobile menu mid-run | The glide stops. After closing, the next input glides to a stop. |
| 19 | Phones | Fast run at 2.2x on a cold load | Frames may hold briefly but are never blank. Landing frames are exact. |

## 8. Verify (coder, from `C:\Users\Suhas\Desktop\MOP\masterogpipsology_client`)

```
git status
git switch -c step-scroll-touch main
corepack pnpm install
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm build
```

Then run the greps in section 6. No automated browser QA (owner tests visually).

## 9. Branch and commits (local only, never push; docs-writer writes the messages; test + tsc before each)

Owner instruction: create the branch with `git switch -c step-scroll-touch main` and commit there.
- Check `git status` first. If there are uncommitted changes, stop and ask the orchestrator.
- This replaces, for this feature only, the rules.md §5 "work on `luxury-upgrade`" line. That line is not edited.

1. `Plan: step-scroll touch momentum` covers this file. It is committed first (rules: commit before each change).
2. `Step scroll: STEP_TUNING config and momentum math` covers `lib/step-scroll.ts` and `tests/step-scroll-momentum.test.mjs`.
3. `Step scroll: frame-tick glide driver, runs through stops, queued input, streak speed, tap stop, reverse` covers
   `components/hooks/useStepScroll.ts`.
4. `Step scroll: touch-action and overscroll guard` covers `CryptoMarketScroll.tsx`, `ForexMarketScroll.tsx` and
   `app/globals.css`.
5. `Rules: scroll timing` covers `rules.md`.

## 10. Decisions

- D1 (owner Q1). Extra same-direction input **glides straight through** middle stops:
  - The target moves out one stop per gesture.
  - Velocity is continuous; the acceleration clamp re-accelerates a run that was already braking.
  - Only the final stop brakes, lands and holds (streak-shortened hold).
  - Input during a hold is queued and dispatched as one run.
  - The cap is 3 stops beyond the first stop ahead. A held key runs 1 ahead.
- D2. Runs cross the Crypto -> Forex boundary (Y0) without stopping.
  - The run's `extra` frames make the brake look past the owner's edge.
  - On `'edge'`, the glide state is handed to the neighbour controller with the same frames/s velocity, ramp and multiplier.
- D3. Glides use our own integrator (`stepGlide`) on the shared gsap ticker (`'update'`), writing
  `lenis.scrollTo(y, { immediate: true, force: true })`.
  - It is the existing `glideProfile` shape written as feedback, so a 1x single-stop glide matches today's (test 10).
- D4. The glide position is in list frames, not pixels. A layout change mid-glide (mobile address bar) moves only the mapping.
- D5. Speed-up shortens the ease-in (tIn / m) and the brake (tOut / √m). At 2.2x the brake is 0.67 s.
- D6. The streak drops one level per 600 ms of silence, re-read every frame, so speed eases back smoothly within a long run. A
  tap or a reversal resets it to 0.
- D7 (owner Q2). Runs stop at the edges: Crypto stop 0 going up, Forex V going down, and O3 going down.
  - Steps beyond an edge are dropped.
  - A fresh exit gesture passes natively at once, even during a hold.
- D8. Auto-advance is untouched: 450 ms, always 1x, never extended (`lockSpeed`), 700 ms hold. Down input while it is armed is
  absorbed.
- D9. Tap to stop retargets to the first stop ahead at or beyond the current braking distance (`tapTarget`), so there is never a
  velocity jump. It may therefore stop one stop later than the very next stop when the page is moving fast.
- D10. Reversal brakes in 0.3 s (harder only near the list edge) and returns to the nearest stop behind the brake end point.
- D11. Touch:
  - Min push is 8 px (was 24).
  - The axis is decided after 4 px or 1 px vertical, and moves before that are not cancelled.
  - `touchend` can commit a flick.
  - A tap is < 8 px and ≤ 300 ms, and only counts while moving.
- D12. Wheel device is classified per gesture: `deltaMode` ≠ 0 or an integer |Δ| ≥ 50 is a mouse, everything else is a
  trackpad. It only selects `STEP_TUNING.devices` values. Inertia stays one gesture through `feedWheel`.
- D13. No hook-box or frame-engine code change. The reasons are in sections 2 and 4.5 and are covered by tests 21-23.
- D14. Event de-dupe in a module-level `motion` state. Exactly one controller owns a glide at a time.
- D15 (owner Q3). The starting values are kept, and all are tunable in `STEP_TUNING`.
- D16 (owner Q4). Work and commits are on the new branch `step-scroll-touch`, cut from `main`.

## 11. Owner answers (2026-10-26)

- Q1. Glide straight through middle stops when more swipes are queued. Only the final stop holds. → D1, D2, D13.
- Q2. Stop at the edge. → D7.
- Q3. Keep the starting values, tunable in `STEP_TUNING`. → D15.
- Q4. Feature branch `step-scroll-touch` off `main`. → section 9, D16.

There are no open questions. One optional follow-up: if middle hooks flashing past looks busy on devices, a "run in progress"
mask in `useSlabScrub` could hide them (section 4.5).
