# Forex and Stock step scroll (plus HUD bugs B1 to B3)

Branch `luxury-upgrade`, base `5a37ccb`. Planner: Opus. Coder: implement exactly this. Do not explore beyond the files named here.
Read `node_modules/next/dist/docs/` only if a Next API is touched (none is planned).

## 0. Goal in one paragraph

Extend the shipped Crypto step scroll (`lib/step-scroll.ts`, `components/hooks/useStepScroll.ts`) to the Forex/Stock/Opportunity
chain (`components/sections/ForexMarketScroll.tsx`). It uses the same speed rule: 48 list fps cruise, a 0.4 s smoothstep ease-in,
a 1.0 s power-2 brake (about 16 frames), an exact whole-frame landing, and a 0.45 s hold. The new stops are forex 64, 111 and 194,
then stock_market 32. Normal scroll resumes after stock_market 32. Re-time the Forex caption rail so each stop holds its caption
fully in place. Make the frame set (lite WebP vs full JPEG) sticky for the whole session (B1). Make the HUD name the folder (B2) and
show folder % and chain pos instead of the chain-wide scroll % (B3).

## 1. Facts verified in code (do not re-derive)

- List indices (unique-192 mode, `stopListIndex(raw, UNIQUE_LOCAL)`): forex raw 1/64/111/194 = list 0/50/88/154. stock_market raw 32
  = list 25, so chain pos = 192 + 25 = **217**. Forex raw 240 = list 191 (the folder cut sits between chain 191 and 192).
- Forex chain: `TOTAL_FRAMES` 576 (last = 575). Frames map linearly over `FRAME_SCROLL_PORTION` = 1050/1470 = 5/7 of the section
  range, and pos stays at 575 after that. `FOLDER_CUTS` = [191, 383] are never blended (engine `planBlend`).
- Crypto's tail stop (slab 4) = `handoffEndY` = Forex section top = Forex progress 0 = Forex list 0. **Crypto's last stop and Forex's
  first stop are the same scroll offset Y0.**
- `addScrollGate` (LenisProvider): **every gate sees every event; any `false` consumes it.** Each controller also adds its own
  `keydown` listener, and `onKey` returns early on `e.defaultPrevented`.
- Overlays at S1: stock raw 32 → `globalIdx` 271 → `stockOp` = 1 and `forexOp` = 0 (`resolveSeq` returns `stock`). The section
  state is already correct. Only the HUD label is wrong (B2).
- The current Forex rail at F3 (frame fraction 154/575 = 0.268) sits inside the transition 3→4 with advance ≈ 0.1. That is why
  "PROGRAMME 02 / Market structure" starts to reveal under "Interbank flow". At F1 the rail is still finishing a transition
  (advance ≈ 0.98).
- All 4 x 240 WebPs exist in both `public/frames/v1/*/1280` and `*/p1080`, so the per-frame 404 fallback never fires.

## 2. B1 root cause (mixed frame sets)

The claim "picked once per page load" holds per engine but not per session:

1. `detectFrameTier()` runs on **every engine creation** (`useFrameSequence` effect), separately for Crypto and Forex, and again in
   `warmFirstFrame` and `DepthStage`. It reads the live `innerWidth x min(dpr, 2)` against `LITE_MAX_BACKING_W` = 1408.
   A window about 1366 to 1440 CSS px wide at DPR 1, or a wider window with DevTools docked at the side, sits right on that line.
2. An engine is re-created on every page reload, on every **Fast Refresh in `next dev`** (effects re-run whenever a file is saved;
   files were being edited during the HUD session), and on every `(max-aspect-ratio: 4/5)` flip (`tierEpoch`). Each re-creation
   re-reads the window size and can land on the other side of 1408.
3. The HUD prints one `frames:` header from `(f ?? c).tier`, not per block. Crypto stops C1 and C3 showing lite while C2 showed
   full is impossible inside one Crypto engine, so the engine was re-created between those picks.

**Verdict:** a change in window width (window resize or DevTools docking), combined with reloads or dev Fast Refresh, caused the
mixed sets. There is no mid-session switch inside one engine except two rare paths. (a) If the very first WebP decode fails, the
whole engine falls back to JPEG while the HUD still says "lite". (b) A single WebP that fails to decode gets a per-frame JPEG
fallback. The fix makes the class (full vs lite) sticky per tab session for every engine and every caller.

## 3. Design

### 3.1 Sticky frame class (B1): `lib/frame-sequence/sources.ts` (stays import-free)

Add the following and keep `chooseFrameTier` and `detectFrameTier` behaviour unchanged, because existing tests cover them.

```ts
export type FrameClass = 'full' | 'lite';
export const FRAME_CLASS_KEY = 'mop.frameClass.v1';          // sessionStorage key
export function isPortraitViewport(cssW: number, cssH: number): boolean;   // cssH > 0 && cssW / cssH <= PORTRAIT_MAX_ASPECT
export function chooseFrameClass(i: TierInput): FrameClass;  // chooseFrameTier minus the portrait branch
export function tierFor(cls: FrameClass, portrait: boolean): FrameTier;   // portrait ? 'portrait' : cls
// chooseFrameTier(i) becomes: tierFor(chooseFrameClass(i), isPortraitViewport(i.cssW, i.cssH))  (same results)
export function parseFrameClass(v: string | null | undefined): FrameClass | null; // 'full' | 'lite' else null
/** Pure: decides the session class. override = ?frames= query value, stored = sessionStorage value. */
export function resolveSessionClass(override: string | null, stored: string | null, detect: () => FrameClass):
  { cls: FrameClass; store: boolean };   // override valid -> {override, store:true}; else stored valid -> {stored, store:false};
                                         // else {detect(), store:true}
let sessionClass: FrameClass | null = null;
export function sessionFrameClass(): FrameClass;  // SSR -> 'full'. Memoised in sessionClass. Reads ?frames=full|lite and
                                                  // sessionStorage (both in try/catch), detects via the same navigator reads as
                                                  // detectFrameTier (factor a private readTierInput(): TierInput), stores on store:true.
export function pinFrameClass(c: FrameClass): void; // sets sessionClass + sessionStorage (try/catch)
export function sessionFrameTier(): FrameTier;      // SSR -> 'full'; tierFor(sessionFrameClass(), isPortraitViewport(innerWidth, innerHeight))
```

Replace every runtime call of `detectFrameTier()` with `sessionFrameTier()`:
- `warmFirstFrame` in `sources.ts`. It runs first, at client chunk evaluation, so it pins the class before any engine exists.
- `components/hooks/useFrameSequence.ts` line 111 (`const tier = sessionFrameTier();`) and its import.
- `components/sections/DepthStage.tsx` line 41 (`if (sessionFrameTier() !== 'full') return;`) and its import.

Keep the portrait crop switching (`tierEpoch` on the 4/5 flip). It now yields `portrait` or the sticky class, and both engines flip
together (see open question 2).

Whole-set fallback becomes sticky: `lib/frame-sequence/engine.ts`
- Add the option `onWholeSetFallback?: () => void` and store it. Call it at the end of `switchToFallback()`.
- Add `isUsingFallback(): boolean { return this.usingFallback; }` (HUD).
- `useFrameSequence` passes `onWholeSetFallback: () => pinFrameClass('full')`.

### 3.2 Step-scroll generalisation: `lib/step-scroll.ts` (stays import-free)

```ts
/** Scroll progress <-> fractional list position for one sequence. */
export interface FrameMap { pos: (p: number) => number; progress: (pos: number) => number }
export function knotFrameMap(total: number, knotIdx: number, knotP: number): FrameMap;
  // { pos: p => framePos(p, total, knotIdx, knotP), progress: q => progressAt(q, total, knotIdx, knotP) }
export function linearFrameMap(total: number, portion: number): FrameMap;
  // last = total - 1 (<= 0 -> both return 0). pos(p): NaN -> 0; p < portion ? clamp(p / portion * last, 0, last) : last
  // (identical to the current ForexMarketScroll frameForProgress). progress(q): clamp(q, 0, last) / last * portion
export const FOREX_STOPS_RAW: readonly number[] = [1, 64, 111, 194]; // forex folder, picked with the HUD (unique mode)
export const STOCK_STOPS_RAW: readonly number[] = [32];              // stock_market folder
/** Chain stop indices: folder f, raw r -> f * locals.length + stopListIndex(r, locals). Folders in chain order. */
export function chainStopIndices(folders: readonly (readonly number[])[], locals: ArrayLike<number>): number[];
```

`StepInput` gains `foreign?: boolean`, documented as "y lies inside another controller's stop zone".
In `decideStep`, the two edge branches only catch when `!i.foreign`:
```ts
if (i.y < first - tol) return i.dir > 0 && !i.foreign && i.target >= first - tol ? { kind: 'catch', stop: 0 } : PASS;
if (i.y > last + tol)  return i.dir < 0 && !i.foreign && i.target <= last + tol ? { kind: 'catch', stop: n - 1 } : PASS;
```
Nothing else in `decideStep` changes. At the shared Y0 the existing rules already arbitrate correctly. Going down: Crypto (last stop,
fresh) returns pass and Forex (first stop) glides. Going up: Forex passes and Crypto glides. An inertia tail at Y0 after either glide
is swallowed by the controller that consumed the gesture.

### 3.3 Controller changes: `components/hooks/useStepScroll.ts`

- `StepScrollOptions`: replace `knotP: number` with `map: FrameMap`. The class drops `knotIdx` and `knotP` and stores `map`.
  - `onLayout`: `base = this.stops.map((i) => l.top + this.map.progress(i) * range)`.
  - `posAt(y)`: `this.map.pos(sectionProgressOf(y, top, height, viewportH))`.
- Module-level coordination (both controllers live on one page):
  ```ts
  const registry = new Set<StepScrollController>();
  let sharedHoldUntil = 0;   // one landing hold for all controllers (Y0 is a stop of both)
  ```
  - `attach`: `registry.add(this)`. The returned cleanup calls `registry.delete(this)`.
  - `busy()`: `this.gliding || performance.now() < sharedHoldUntil`.
  - `refreshRest()`: on landing (`k >= 0 && this.restStop < 0`) set
    `sharedHoldUntil = Math.max(sharedHoldUntil, performance.now() + HOLD_MIN_MS)`. Delete the instance field `holdUntil`.
  - `private foreign(y: number): boolean`: true if any other registered controller `c` has `c.ready && c.inZone(y)`. TS `private` is
    class-scoped, so `c.ready` and `c.inZone` compile.
  - Pass `foreign: this.foreign(y)` in all four `decideStep` calls (wheel in `onInput`, both calls in `onTouch`, `onKey`).
  - `onScroll` touch catches: only if `!this.foreign(this.prevY)` (wrap both `touchCatch` lines).
  - `glideTo` `onComplete`: after the existing jump check, `for (const c of registry) c.refreshRest();` instead of only
    `this.refreshRest()`. This makes Forex snap `restIdx` 0 and see the hold when Crypto's slab 4 lands on Y0.
- Update the header comment of `stops` and `map` (Crypto example `[0, 89, 110, 142]`; Forex `[0, 50, 88, 154, 217]`).

### 3.4 Crypto call site: `components/sections/CryptoMarketScroll.tsx`

`CRYPTO_STEP`: replace `knotP: CRYPTO_KNOT_P` with `map: knotFrameMap(TOTAL_FRAMES, CRYPTO_KNOT_IDX, CRYPTO_KNOT_P)` and add the
import. Behaviour is identical: same ys, same posAt.

### 3.5 Forex rail timing: new `lib/forex-rail.ts` (import-free)

Stop coordinate `s` from the Forex controller: -1 at crypto 179 (one viewport above Y0), 0 = Y0 (forex 1, the Crypto slab 4
landing), 1 = F1, 2 = F2, 3 = F3, 4 = S1. After S1 the rail follows the frame fraction `f = min(1, progress / FRAME_SCROLL_PORTION)`.

```ts
export const FOREX_CHAIN_STOPS: readonly number[] = [0, 50, 88, 154, 217]; // = chainStopIndices([FOREX_STOPS_RAW, STOCK_STOPS_RAW], UNIQUE_LOCAL) (test-locked)
export const FOREX_CHAIN_LAST = 575;
export const FOREX_S1_F = 217 / 575;          // frame fraction at S1
export const FOREX_RAIL_SPLIT = 0.4;          // rail u at S1: share of the axis for the stepped part
export const FOREX_S_MIN = -1;
export const FOREX_S_MAX = 4;
export const FOREX_RAIL_HOLD_HALF = 0.1;      // same as CRYPTO_RAIL_HOLD_HALF
export const FOREX_RAIL_FROM_S = -0.5;        // rail enters in the 2nd half of the hand-off fade (Crypto rail is gone at its s 3.4)
export const STOCK_END_F = 2 / 3;
export const FOREX_FLOW_TO_F = 0.91;          // unchanged: gone before the HUD fade
const SHARE = 0.4;                            // = caption-flow FLOW_TRANSITION_SHARE (duplicated: import-free, test-locked)
function spreadEven(count: number, from: number, to: number): { start: number; end: number }[]; // same maths as spreadWindows
export function forexRailStopU(s: number): number;          // SPLIT * (clamp(s, S_MIN, S_MAX) - S_MIN) / (S_MAX - S_MIN)
export function forexRailFrameU(f: number, fS1: number = FOREX_S1_F): number; // SPLIT + (1 - SPLIT) * clamp01((f - fS1) / (1 - fS1))
export function forexRailU(s: number, f: number): number;  // NaN s -> 0; s <= S_MAX ? forexRailStopU(s) : forexRailFrameU(f)
export function forexRailSpec(): { from: number; to: number; steps: { start: number; end: number }[] };
```

`forexRailSpec()` returns 15 windows (`U = forexRailStopU`, `P = forexRailFrameU`, `a = spreadEven(6, FOREX_S1_F, STOCK_END_F)`,
`b = spreadEven(5, STOCK_END_F, FOREX_FLOW_TO_F)`):

| # | caption (label / text) | window | where it is fully in place |
|---|---|---|---|
| 0 | FOREX / The global reserve market | U(-0.1)..U(0.1) = 0.072..0.088 | Y0 = forex 1 (Crypto slab 4 landing) |
| 1 | FOREX / Major pairs | U(0.9)..U(1.1) = 0.152..0.168 | F1 forex 64 |
| 2 | FOREX / London & NY sessions | 0.232..0.248 | F2 forex 111 |
| 3 | FOREX / Interbank flow | 0.312..0.328 | F3 forex 194 |
| 4 | EQUITIES / Individual stocks and indices | U(3.9)..P(a0.end) = 0.392..0.43717 | S1 stock 32, held to chain ~239 |
| 5-9 | EQUITIES / US indices, Sector rotation, Earnings plays; PROGRAMME 02 / Market structure; PROGRAMME 03 / (ch.3 title) | P(a1..a5) | native scroll, chain ~250-378 |
| 10-14 | PROGRAMME 04, 05, 06; brand tagline; brand final CTA | P(b0..b4), unchanged in f | native scroll, chain ~389-518 |

`from = U(-0.5) = 0.04`, `to = P(0.91) ≈ 0.91327`. Every transition between two stops runs over s ∈ (k+0.1, k+0.9), so each
caption changes only between stops and is still at the stop (draw 0, advance 0, enter 1).

### 3.6 `lib/scroll-captions.ts`

- Import `forexRailSpec` from `@/lib/forex-rail`. Build
  `const FOREX_LINES: Array<[string, string]>` in the order of the table in 3.5:
  `[forex.heading, forex.kicker]`, `[forex.heading, forex.tags[0..2]]`, `[equities.heading, equities.kicker]`,
  `[equities.heading, equities.tags[0..2]]`, `[chapterLabel(2), chapter(2).title]`, `[chapterLabel(3), chapter(3).title]`,
  `[chapterLabel(4..6), ...]`, `[BRAND_NAME, BRAND_TAGLINE]`, `[BRAND_NAME, FINAL_CTA_HEADLINE]`.
- `export const FOREX_FLOW: CaptionFlow = { from: rail.from, to: rail.to, steps: FOREX_LINES.map(([label, text], i) => ({ label, text, ...rail.steps[i] })) };`
- Delete the now-unused `spread` helper, the `T` constant and the `spreadWindows` import (lint). Update the Forex comment.

### 3.7 `components/sections/ForexMarketScroll.tsx`

- Imports: `useCallback`; `useStepScroll, type StepScrollOptions` from `@/components/hooks/useStepScroll`; `linearFrameMap` from
  `@/lib/step-scroll`; `FOREX_CHAIN_STOPS, forexRailU` from `@/lib/forex-rail`.
- Module constants (replace the module-level `frameForProgress` and `PINNED`):
  ```ts
  const FOREX_MAP = linearFrameMap(TOTAL_FRAMES, FRAME_SCROLL_PORTION);
  // Stops: forex 1, 64, 111, 194, then stock_market 32 (chain 217). Stop 0 = Y0, shared with Crypto's slab 4 landing.
  const FOREX_STEP: StepScrollOptions = { stops: FOREX_CHAIN_STOPS, total: TOTAL_FRAMES, map: FOREX_MAP };
  const PINNED: readonly number[] = [...FOREX_CHAIN_STOPS, TOTAL_FRAMES - 1]; // landing frames fetched first, never evicted
  ```
- In the component:
  ```ts
  const step = useStepScroll(FOREX_STEP);
  const frameForProgress = useCallback((p: number): number => step.frameFor(FOREX_MAP.pos(p)), [step]);
  ```
- `onUpdate`: destructure `scroll` too. Replace the caption line with
  `captionRef.current?.(forexRailU(step.coord(scroll), Math.min(1, progress / FRAME_SCROLL_PORTION)));`.
- `useFrameSequence({... frameForProgress, onLayout: step.onLayout, ...})`. Leave everything else unchanged in phase A: overlays, video,
  cuts, fetch horizon. `ScrollCaptions` stays `variant` default in phase A. Phase B (section 10) adds the market text motion.

### 3.8 HUD (B2, B3, B1 visibility): dev-only files

`components/debug/FrameDebugHud.tsx`:
- `HudSample` gains `fallback: string` ('' | 'whole set JPEG fallback' | 'per-frame JPEG fallback').
- `const FOLDER_NAME: Record<string, string> = { crypto: 'Crypto', forex: 'Forex', stock_market: 'Stock', opportunity: 'Opportunity' };`
- `block(s, hint)`:
  - Line 1: `${FOLDER_NAME[s.folder] ?? s.seq}  ${hint}` (B2: S1 now reads "Stock [on screen]").
  - Line 2: `frames: ${s.tier}${s.fallback ? ' / ' + s.fallback : ''}`, printed **per block** (B1).
  - Line 3: folder + raw, as now.
  - Line 4: `list ${listIdx} / ${listTotal}  pos ${pos.toFixed(2)} (chain ${total - 1})`.
  - Line 5: `folder ${Math.round(listIdx / (listTotal - 1) * 100)}%  section ${Math.round(progress * 100)}%  ${file}` (B3: the chain
    % is renamed "section" and the folder % is added; stops stay keyed to pos).
- Remove the single `frames:` header in `render()`. Hints are keyed on `seq` as now (Crypto/Forex engines). Marks become
  `${folder}:${raw} [pos ${pos.toFixed(2)}]`.

`components/hooks/useFrameSequence.ts` `hudSample`: add
`fallback: engine.isUsingFallback() ? 'whole set JPEG fallback' : (tier !== 'full' && /\.jpg$/.test(file) ? 'per-frame JPEG fallback' : '')`.
Keep every `// TEMP debug HUD` tag.

Production stays hidden. It is already guarded three ways: `page.tsx` renders `<FrameDebugHud/>` only when
`NODE_ENV === 'development'`, `hudOn` in `useFrameSequence`, and the effect guard in `FrameDebugHud`. Verify only (section 6).

## 4. Per-slab durations (`glideProfile`, unchanged constants: 48 fps, ease-in 0.4 s, brake 1.0 s pow 2; min run 25.6 frames)

duration = 0.4 + (D - 25.6) / 48 + 1.0 for D ≥ 25.6 list frames.

| Slab | List frames D | Duration | Cruise | Notes |
|---|---|---|---|---|
| C1 1→112 | 89 | 2.721 s | 1.321 s | shipped |
| C2 112→139 | 21 | 1.148 s | 0 (scaled profile) | shipped |
| C3 139→179 | 32 | 1.533 s | 0.133 s | shipped |
| C4 179→Forex 1 | 49 (crypto list 142→191) | 1.887 s | 0.904 s | shipped (Crypto tail) |
| F1 forex 1→64 | 50 | 1.908 s | 0.508 s | |
| F2 64→111 | 38 | 1.658 s | 0.258 s | |
| F3 111→194 | 66 | 2.242 s | 0.842 s | |
| S1 forex 194→stock 32 | 63 (37 forex + 1 cut step 191→192 + 25 stock) | 2.179 s | 0.779 s | |

**S1 across the folder cut:** frames are linear in scroll across the cut, so the cut is one list frame inside the cruise. It passes at
the full 48 fps in about 21 ms, one display frame, as a hard switch (never blended, `FOLDER_CUTS`). The brake covers only the last
16 list frames, chain 201→217 = stock_market raw 12→32, all after the cut. The forex overlay fades out over chain 173→191 and the
stock overlay rises over stock raw 1→25, both inside the cruise. At the landing `stockOp` is 1. Frame pace matches Crypto: Forex 0.548
list frames per vh vs Crypto 0.568, so the scroll speed is about the same.

**After S1:** S1 is the last stop. A fresh gesture down at S1 passes, so normal Lenis scroll resumes through stock 33→240,
Opportunity and the video hand-off. Scrolling back up into the zone is caught at S1 (the existing entry catch from below), then each
gesture steps F3→F2→F1→Y0→Crypto.

## 5. Tests (node --test; files import `../lib/*.ts` directly)

`tests/step-scroll.test.mjs` (add):
1. `linearFrameMap(576, 5/7)`: pos(0)=0, pos(5/7)=575, pos(1)=575, pos(5/14)=287.5, pos(NaN)=0; `progress(pos(p))≈p` for 50 p in
   [0, 5/7]; progress(217) = 217/575*5/7.
2. `knotFrameMap(192, 142, 5/7)` equals `framePos` / `progressAt` at 20 sample points.
3. `chainStopIndices([FOREX_STOPS_RAW, STOCK_STOPS_RAW], U)` deep-equals `[0, 50, 88, 154, 217]`.
4. Durations: `glideProfile(50|38|66|63).duration` ≈ 1.908/1.658/2.242/2.179 (eps 1e-3); for each `v` = 48, `tIn` = 0.4,
   `tOut` = 1.0; `glideEase(1, p) === 1`, `glideEase(0, p) === 0`, and glideEase is monotonic over 200 steps.
5. `decideStep` foreign guard: ys=[1000, 2000]. With y 900, dir +1, target 1001: catch when foreign false, pass when true.
   Mirror with y 2100, dir -1, target 1999.
6. Shared boundary: C=[0, 500, 800, 1200], F=[1200, 2100, 2800, 4000, 5200]. At y=1200, fresh, acted null, busy false:
   dir +1 gives C pass and F glide 1; dir -1 gives C glide 2 and F pass. Non-fresh with C acted 'consume' gives C swallow.
   With F acted 'pass' F returns pass (combined: consumed).

`tests/forex-rail.test.mjs` (new):
1. `FOREX_CHAIN_STOPS` equals `chainStopIndices(...)` from `../lib/step-scroll.ts` with `uniqueLocalFrames()`. The raw numbers are
   `UNIQUE_LOCAL[50,88,154]+1 = 64,111,194` and `UNIQUE_LOCAL[25]+1 = 32`; `FOREX_S1_F === 217/575`.
2. `forexRailSpec()`: 15 windows, each start < end < next start, all in [0,1], from = 0.04, to ≈ 0.91327 (1e-4).
3. Stops fully in place: for k = 0..4, `flowState(forexRailU(k, k === 4 ? FOREX_S1_F : 0), spec)` gives index k, draw 0,
   advance 0, enter 1, exit 0 (use `flowState` from `../lib/caption-flow.ts`).
4. Changes only between stops: for k = 0..3, index is k for every s in [k, k+0.9) at 0.01 steps and k+1 at s = k+0.95.
   At s = k+0.5, draw > 0.
5. Entry: s = -1 and s = -0.5 give enter 0; s = -0.3 gives 0 < enter < 1.
6. Continuity at S1: `forexRailU(4, FOREX_S1_F) === 0.4`, `|forexRailU(4.0001, FOREX_S1_F + 1e-6) - 0.4| < 1e-5`; step 4 still
   holds at f = FOREX_S1_F + 10/575 (index 4, advance 0).
7. `spreadEven` equals caption-flow `spreadWindows` for (6, 217/575, 2/3) and (5, 2/3, 0.91). Windows 10..14 equal the old
   Opportunity windows mapped by P (regression).
8. NaN s gives 0.

`tests/frame-sources.test.mjs` (add):
1. `chooseFrameClass`: {1920,1080,1} full; {1366,768,1} lite; {1440,900,1} full (1440 > 1408); {1920,1080,1,coarse} lite;
   {2560,1440,1,saveData} lite.
2. `tierFor('lite', true)` portrait; `tierFor('full', false)` full.
3. Existing `chooseFrameTier` cases unchanged (the test already exists and must pass untouched).
4. `resolveSessionClass('lite', 'full', d)` gives {lite, store:true}. `(null, 'full', d)` gives {full, store:false} and does not call
   d. `(null, 'junk', () => 'lite')` gives {lite, store:true}. `('bogus', null, () => 'full')` gives {full, store:true}.
5. `sessionFrameTier()` in node (no window) returns 'full'.

`tests/caption-flow.test.mjs` uses a local FOREX fixture and stays untouched.

## 6. Verify (run from `C:\Users\Suhas\Desktop\MOP_lux\masterogpipsology_client`)

```
npm test
npx tsc --noEmit
npm run lint
npm run build
grep -rl "copy marks" .next/static || echo "HUD strings absent from client bundle"
```
If `grep` finds the HUD in a chunk, it is still never rendered (three guards). Report it and do not fail the task.

Manual checks for the user, who tests visually. No automated browser QA (user preference). Run `npm run dev` and use the HUD:
1. Every stop: crypto 112/139/179, forex 64/111/194 and stock_market 32 rest with `pos` exactly 89.00/110.00/142.00,
   50.00/88.00/154.00 and 217.00 after a single wheel notch, with no drift during the hold.
2. Captions at each stop: Y0 shows "FOREX / The global reserve market", then "Major pairs", "London & NY sessions" and
   "Interbank flow" with nothing revealing below it. S1 shows "EQUITIES / Individual stocks and indices".
3. Crypto 179 → Forex 1 → F1: one gesture per slab, no double step and no stall at Y0. Up from F1 lands at Y0, the next gesture
   goes to 179.
4. F3 → S1 crosses the cut at full speed and brakes on stock frames. The HUD block reads "Stock [on screen]", and stock 32 shows
   "folder 13%" and pos 217.00.
5. Below S1, scrolling down is native. From Opportunity, scrolling up is caught at S1.
6. Every HUD block shows the same `frames:` class for the whole tab, across reloads and DevTools open or close. `?frames=full` or
   `?frames=lite` switches the class once (sticky after that).
7. `npm run build && npm start`: no HUD.

## 7. Commits (local only, never push; docs-writer writes the messages)

1. `Frames: one sticky frame class per session` covers `lib/frame-sequence/sources.ts`, `lib/frame-sequence/engine.ts`,
   `components/hooks/useFrameSequence.ts` (tier call + fallback hook only), `components/sections/DepthStage.tsx` and
   `tests/frame-sources.test.mjs`.
2. `Step scroll: frame maps, shared hold, zone arbitration` covers `lib/step-scroll.ts`, `components/hooks/useStepScroll.ts`,
   `components/sections/CryptoMarketScroll.tsx` and `tests/step-scroll.test.mjs`. Crypto behaviour is unchanged.
3. `Forex and Stock step scroll: stops 64/111/194 and stock 32, rail re-timed` covers `lib/forex-rail.ts`, `lib/scroll-captions.ts`,
   `components/sections/ForexMarketScroll.tsx` and `tests/forex-rail.test.mjs`.
4. `Debug HUD: folder labels, per-block frame class, folder % and chain pos` covers `components/debug/FrameDebugHud.tsx` and the
   HUD lines in `components/hooks/useFrameSequence.ts`.
5. `Plan: forex-stock step scroll` covers this file.
6. to 8. Phase B commits, listed in section 10.8.
Run `npm test && npx tsc --noEmit` before each commit. Leave the untracked state of `docs/plans/*/*.json` as it is.

## 8. Decisions

- D1. Stops are keyed to chain list pos (`[0, 50, 88, 154, 217]`), never to scroll %. Literal in `lib/forex-rail.ts` and locked by
  a test against `chainStopIndices`.
- D2. One controller per sequence. Y0 is a stop of both. Arbitration uses the existing "exit needs a fresh gesture, pass" rule,
  plus a `foreign` guard on entry catches, a module-level shared landing hold, and a broadcast `refreshRest` on glide completion.
  This was chosen over merging Crypto and Forex into one controller (bigger refactor, two layouts).
- D3. `FrameMap` replaces `knotP`. Crypto uses the knot map and Forex the existing linear map, so frame pacing outside the stops is
  unchanged.
- D4. Same speed rule and constants for every slab. The folder cut counts as one list frame inside the cruise and gets no special
  brake.
- D5. Normal scroll resumes after S1. The user gave no later stops, and the rest of the rail (equities tags, Programme 02 to 06,
  brand) plays on native scroll as before.
- D6. "PROGRAMME 02 / Market structure" moves from before Equities to after the Equities tags. Programme 02 to 06 now run in
  order on native scroll. No copy is lost and nothing reveals under "Interbank flow".
- D7. New stop-0 caption: "FOREX / The global reserve market" is fully in at Y0, the Crypto slab 4 landing. Before, the Forex rail
  was still hidden there.
- D8. The sticky unit is the resolution class (full JPEG vs lite WebP). It is chosen once per tab session and lives in a module
  variable plus sessionStorage. `?frames=` overrides it. A whole-set WebP failure pins `full`.
- D9. (Superseded by the user, see section 10.) Forex and Stock get their own text motion and font, distinct from Crypto.
- D10. The HUD stays dev-only and is only relabelled. It is not removed yet because it is still the tool for picking stops.

## 9. Open questions (resolved)

1. Forex/Stock text motion: **yes**, with a different font and a different motion from Crypto. See section 10.
2. Phone rotation: **do not freeze the portrait set** (planner recommendation, accepted by default). Only full vs lite is sticky.

## 10. Phase B: Forex and Stock text motion, font and copy

Start after phase A (commits 1 to 4) is in. Same engineering rules as Crypto (`docs/plans/crypto-text-motion.md`):
- Every value is a pure function of the scrubbed coordinate, so the motion is reversible and fully settled at every stop.
- Transform and opacity only, no filter and no blur.
- No React state per tick. Writes go through `writeUnit`, which caches values.
- At most `TM_MAX_UNITS` (60) units per slab, enforced by a test.
- Reduced motion uses a still crossfade per part.
Reuse `lib/text-motion.ts`, `components/motion/SplitWords.tsx` and `components/motion/scrub-units.ts`. Do not fork them.

### 10.1 Animation options (all differ from Crypto's vertical "rise and lift" with a rotateX tilt)

| Option | What it looks like | Cost | Fit |
|---|---|---|---|
| **A. Ticker roll** (`roll`) | Each letter is a one-line odometer. Three decoy glyphs roll down through the letter's mask and it lands on the real letter, staggered left to right like a quote board settling. Exit slides the tape left and fades it. | 1 unit per letter. Decoys are static child spans that move with the unit. | Currency pairs, prices, the FX tape. |
| **B. Track-in** (`track`) | Letters start spread wide around the line centre, as if letter-spaced, then condense into the word while fading in. Exit spreads them out again. No masks, so letters fly freely. | 1 unit per letter. The x offset is proportional to the distance from the line centre. | Engraved, fashion-house reveal. Calm and architectural, like an exchange facade. |
| C. Split-flap | Each letter flips on rotateX around its middle, in two halves. | 2 elements per letter and needs a new two-element unit type in `scrub-units`. Rotation is close to Crypto's tilt. | Departure board. Not recommended: it costs double and looks too much like the Crypto tilt. |

Supporting motion shared by Forex and Stock: **`glide`**, a horizontal tape wipe. Each word or chip slides in from the right edge
of its own overflow mask (x 105% to 0) and leaves to the left (0 to -105%). It is used for line 1 of the title, the body, the label
and the chips. The gold rule keeps the existing `line` kind.

**Recommendation: give each market its own headline verb and let them share the supporting motion and the font.**
- **Forex: A, ticker roll**, on the gold title line and on rail rows 0 to 3.
- **Stock: B, track-in**, on the gold title line and on rail rows 4 to 7.
- Programme and brand rail rows (8 to 14), which are reached after S1 on native scroll, use `glide`.
Each market reads distinctly, and the whole Forex/Stock chain still looks like one family next to Crypto's Bodoni rise.

### 10.2 Font options (all present in `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`, latin subset)

| Font | Data | Character | With Manrope |
|---|---|---|---|
| **Cinzel** | variable wght 400 to 900, normal only | Roman inscriptional capitals. Lowercase renders as small caps. Engraved, banknote and exchange-facade feel. | Strong contrast: classical caps over a geometric sans. |
| Marcellus | 400 only, normal | Flared Trajan-like letters, with lowercase. Soft and calm. | Good, but there is only one weight, so the gold line cannot be set heavier. |
| Fraunces | variable wght, opsz, SOFT, WONK; italic | A soft, slightly wonky old-style. Warm and characterful. | Good, but it is a high-contrast serif with an italic, so it is too close to the Bodoni role. |

**Recommendation: Cinzel**, one face for both Forex and Stock. That keeps the page at four families: Cormorant site-wide, Manrope
body, Bodoni Crypto and Cinzel markets. All-caps glyphs share one cap height, so the roll and track units align perfectly, and
engraved capitals in gold on cream fit the luxury look. Cinzel has no italic, so set `font-style: normal; font-synthesis: none` on
the gold `em` and use colour plus weight 600 instead of slant.

### 10.3 Copy (lib/content.ts; same tone as the Crypto slabs; no profit promises; facts used: live sessions, Mysore, Bengaluru)

```ts
export type SlabCopy = CryptoSlabCopy;
/** Forex slab: in during the Crypto hand-off, held at Forex stops 0-3, out during the S1 glide before the folder cut. */
export const FOREX_SLAB: SlabCopy = {
  label: 'Master of Pipsology · Forex',
  title: ['Chapter two is forex.', 'The world, in pairs.'],
  body: 'Live sessions in Mysore and Bengaluru take you through the majors as London and New York trade. Same rules as crypto: structure first, risk defined, then the trade.',
  tags: ['EUR/USD • MAJOR', 'GBP/JPY • CROSS', 'XAU/USD • GOLD'],
};
/** Stock slab: in after the folder cut during the S1 glide, held at S1 and on native scroll, out before Opportunity. */
export const STOCK_SLAB: SlabCopy = {
  label: 'Master of Pipsology · Equities',
  title: ['Then the equity floor.', 'One stock to the index.'],
  body: 'Single stocks, the indices they build and the news that moves them, taught in the same live classroom. Read the chart, size the risk, plan the exit before the entry.',
  tags: ['S&P 500 • INDEX', 'NASDAQ • INDEX', 'GOLD • COMMODITY'],
};
```
- Unit counts: label 1 + rule 1 + title line 1 words + title line 2 non-space characters + body words + tags.
  Forex = 1+1+4+17+28+3 = **54**. Stock = 1+1+4+19+30+3 = **58**. Both are at most 60, and a test locks this.
- The tags are the existing chips, unchanged. The rail captions are the ones the user picked at the stops, unchanged
  (`MARKETS` forex and equities).
- These two slabs replace the current "And now, the global reserve, pure forex." and "And then, the market floor, pure stocks."
  overlays. Their eyebrows ("The Global Reserve Market", "The Equity Arena") are replaced by the labels above.

### 10.4 Pure math: `lib/text-motion.ts`

- `UnitKind` adds `'roll' | 'track' | 'glide'`.
- Constants:
  `TM_ROLL_GLYPHS = 4` (the real letter plus 3 decoys), `TM_ROLL_PCT = (TM_ROLL_GLYPHS - 1) * 100` (300; the decoys are stacked
  below at 100% steps), `TM_ROLL_OUT_X_PCT = 60`, `TM_TRACK_IN_PCT = 38`, `TM_TRACK_OUT_PCT = 22`, `TM_GLIDE_PCT = 105`.
- `unitStyle(kind, vin, vout, out?, k = 0)` (new optional `k` = signed offset from the part centre, used by `track` only). The
  existing kinds are unchanged and the settled state (vin 1, vout 0) is identity for every kind:
  - `roll`: `y = -(1 - vin) * TM_ROLL_PCT`, `x = -vout * TM_ROLL_OUT_X_PCT`, `opacity = vin * (1 - vout)`
  - `track`: `x = k * ((1 - vin) * TM_TRACK_IN_PCT + vout * TM_TRACK_OUT_PCT)`, `opacity = vin * (1 - vout)`
  - `glide`: `x = (1 - vin) * TM_GLIDE_PCT - vout * TM_GLIDE_PCT`, `opacity = vin * (1 - vout)`
- `unitTransform`: `roll` gives `translate3d(${x}%,${y}%,0)`; `track` and `glide` give `translate3d(${x}%,0,0)`. Use toFixed(2)
  as the existing kinds do.
- `export function rollDecoys(ch: string, n = TM_ROLL_GLYPHS - 1): string[]` is deterministic, so hydration is safe:
  - Letters: `A-Z` picks at `(code * 7 + (k + 1) * 11) % 26`, in the same case as `ch`, and never equal to `ch` (step +1 on a clash).
  - Anything else (digits, `&`, `.`, `,`, `/`): digits `(code + 3 * (k + 1)) % 10`.

`components/motion/scrub-units.ts`: `writeUnit` passes `u.kind === 'track' ? u.unit - (u.units - 1) / 2 : 0` as `k`. Nothing else
changes.

`components/motion/SplitWords.tsx`: add prop `mask = true`.
- `kind === 'roll'` (letters only): each letter renders as
  `<span className="tm-mask tm-mask--roll"><span className="tm-u tm-roll" data-u="roll">{c}{rollDecoys(c).map((d, i) => <span key={i} className="tm-roll__d" style={{ top: `${(i + 1) * 100}%` }}>{d}</span>)}</span></span>`
- `mask === false` (used by `track`): the word wrapper is `<span className="tm-word">`, which is inline-block and nowrap with no
  overflow clip.

### 10.5 Generic slab scrub (reuse, do not copy CryptoSlabs)

- New `components/motion/useSlabScrub.ts`:
  `useSlabScrub(rootRef, ids: readonly string[], windows: Readonly<Record<string, SlabWindow>>, driverRef: SlabDriver, name: string): void`.
  Move the body of the `useEffect` in `CryptoSlabs.tsx` into it verbatim, parameterised by `ids`, `windows` and `name` (the
  dev-warning prefix). Move `SlabDriver` with it; `CryptoSlabs` re-exports the type.
- `CryptoSlabs` calls `useSlabScrub(rootRef, IDS, CRYPTO_SLAB_WINDOWS, driverRef, 'CryptoSlabs')`. Its behaviour is unchanged and
  the existing crypto-slabs tests must pass untouched.
- New `lib/market-slabs.ts` (import-free):
  ```ts
  export const MARKET_SLAB_WINDOWS = {
    forex: { inFrom: -0.6, inTo: -0.05, outFrom: 3.15, outTo: 3.5 },  // in during the hand-off fade (Crypto slab 3 is out by -0.72), held at stops 0-3, out in S1 before the cut (s 3.595)
    stock: { inFrom: 3.62, inTo: 3.95, outFrom: 4.85, outTo: 5.0 },   // in after the cut, held at S1 (s 4) and on native scroll, out before the stock->opportunity cut
  } as const;
  export const STOCK_END_POS = 383; // chain index of the last stock frame
  /** Slab coordinate: the Forex stop coordinate up to S1, then 4..5 linear in chain pos 217..383. NaN s -> -1. */
  export function marketSlabX(s: number, pos: number): number; // s <= 4 ? s : 4 + clamp01((pos - 217) / (STOCK_END_POS - 217))
  ```
- New `components/sections/MarketSlabs.tsx`. It renders the two slabs as grid items (`col-start-1 row-start-1`, right-aligned,
  same structure and classes as the current overlays plus `mslab`), with an sr-only copy and an `aria-hidden` animated copy, the
  same pattern as `CryptoSlabs` intro:
  - Label: `data-part` holding a `glide` label unit and a `line` rule.
  - Title (`h2`, `mslab__title`): `data-part` line 1 is `SplitWords kind="glide"`; `<br/>`; `<em data-part>` line 2 is
    `SplitWords kind="roll" letters` for Forex and `kind="track" letters mask={false}` for Stock.
  - Body: `data-part` with `SplitWords kind="glide"`. Chips: `data-part`, each a `tm-mask tm-mask--chip` with a `glide` unit.
  - It calls `useSlabScrub(rootRef, ['forex', 'stock'], MARKET_SLAB_WINDOWS, driverRef, 'MarketSlabs')`.
- `ForexMarketScroll.tsx`:
  - Replace the Forex and Stock overlay divs with `<MarketSlabs driverRef={slabRef} />`, inside the same grid.
  - Delete `forexOverlayRef`, `stockOverlayRef`, the `forexOp`/`stockOp` maths and their `put` calls. Keep the Opportunity overlay,
    `oppOp` and `hudOp` as they are.
  - In `onUpdate`: `slabRef.current?.(marketSlabX(s, pos))`, where `s = step.coord(scroll)` is computed once and shared with
    `forexRailU`.
  - `RevealText` stays only for the Opportunity overlay.

### 10.6 Rail and CSS

- `lib/scroll-captions.ts`: `ScrollCaption` gains `kind?: 'roll' | 'track' | 'glide'`. `FOREX_FLOW` rows 0 to 3 get `roll`, rows 4
  to 7 `track` and rows 8 to 14 `glide`.
- `components/sections/ScrollCaptions.tsx`:
  - `variant?: 'default' | 'crypto' | 'market'`; `motion = variant !== 'default'`; class `wf--${variant}` when motion is on.
  - Label unit kind: `crypto` uses `rise`, `market` uses `glide`.
  - Text: `crypto` uses `<SplitWords kind="tilt" />` as now. `market` uses
    `<SplitWords text={c.text} kind={c.kind ?? 'glide'} letters={c.kind === 'roll' || c.kind === 'track'} mask={c.kind !== 'track'} />`.
  - The existing `stepTextPhase` + `enterAt`/`leaveAt` loop is reused unchanged.
- `ForexMarketScroll` renders `<ScrollCaptions flow={FOREX_FLOW} driverRef={captionRef} variant="market" />`.
- `app/layout.tsx`:
  - `import { ..., Cinzel } from 'next/font/google'`;
    `const mkt = Cinzel({ subsets: ['latin'], variable: '--font-mkt-display', display: 'swap', preload: false });`
    (below the fold, so it must not compete with the hero LCP).
  - Add `mkt.variable` to the `cn(...)` on line 103.
- `app/globals.css`, next to the `.cslab` block:
  ```css
  .mslab, .wf--market { --font-mkt: var(--font-mkt-display), 'Cinzel', 'Trajan Pro', Georgia, serif; }
  .mslab { visibility: hidden; }
  .mslab [data-u], .wf--market [data-u] { opacity: 0; will-change: transform, opacity; }
  .mslab__title { margin-top: .75rem; font-family: var(--font-mkt); font-weight: 500; line-height: 1.12; letter-spacing: .04em;
    font-size: calc(var(--fs-h2) * .78); color: #0E0F14; font-synthesis: none; text-shadow: 0 1px 18px rgba(255,255,255,.6); }
  .mslab__title em { font-style: normal; font-weight: 600; color: #B38728; }
  .wf--market .wf__text { font-family: var(--font-mkt); font-weight: 500; font-size: 1rem; letter-spacing: .05em; font-synthesis: none; }
  @media (width >= 48rem) { .wf--market .wf__text { font-size: 1.2rem; } }
  .tm-mask--roll { overflow: visible clip; padding: 0 .02em; margin: 0 -.02em; } /* clip vertically only: decoys may be wider */
  .tm-roll { position: relative; display: inline-block; }
  .tm-roll__d { position: absolute; left: 50%; transform: translateX(-50%); } /* static: only .tm-roll (the unit) moves */
  .tm-word { display: inline-block; white-space: nowrap; }
  .tm-word > .tm-u { display: inline-block; }
  ```
  The label, body and chip styles reuse the existing overlay classes (Manrope, `#524C42`, font-mono chips).

### 10.7 Tests

`tests/text-motion.test.mjs` (add):
1. `unitStyle(kind, 1, 0)` deep-equals the identity for `roll`, `track` (also with k = 5) and `glide`. `opacity` is 0 at vin 0 and
   at vout 1.
2. `roll`: y(0, 0) = -300; x(1, 1) = -60. `track`: x(0, 0, k = 3) = 114; x(0, 0, k = -3) = -114; x(1, 0.5, k = 2) = 22.
   `glide`: x(0, 0) = 105; x(1, 1) = -105.
3. `unitTransform` strings for the three kinds, settled: `'translate3d(0.00%,0.00%,0)'` for roll and `'translate3d(0.00%,0,0)'`
   for track and glide.
4. `rollDecoys`: deterministic (two calls are equal), length 3, never contains the input letter, same case. `rollDecoys('&')` and
   `rollDecoys('7')` are digits.
5. Continuity: for each new kind, a 1e-4 step in vin changes x and y by < 0.1%.

New `tests/market-slabs.test.mjs`:
1. Windows are ordered: Forex out ends (3.5) before the cut (3.595) and before Stock in (3.62); Forex in starts after the Crypto
   slab 3 out ends (-0.72).
2. Fully shown at stops: `slabPart(x, w, j, n)` opacity 1 and y 0 for Forex at s = 0, 1, 2, 3 and for Stock at s = 4 and at
   `marketSlabX(5, 300)`. Units are settled there (`enterAt` = 1, `leaveAt` = 0 for every part and unit).
3. Hidden: Forex at s = -1 and s = 3.6; Stock at s = 3.6 and at x = 5.
4. `marketSlabX`: continuous at s = 4 (`marketSlabX(4, 217)` = 4, `marketSlabX(4.0001, 217.01)` ≈ 4), gives 5 at pos 383 and
   above, and -1 for NaN s.
5. Unit budget: the formula in 10.3 gives ≤ `TM_MAX_UNITS` for `FOREX_SLAB` and `STOCK_SLAB` (import `../lib/content.ts`, as the
   crypto test does). Labels are ≤ 32 characters.
6. Reduced motion: `slabPart(x, w, 0, 1, true)` has y 0 everywhere.

Manual (user, visual): every stop shows settled text with no decoy glyph visible. Reverse scroll replays backwards. With OS
reduced motion, only crossfades play. In DevTools Performance there are no layout or paint storms during glides (only transform and
opacity).

### 10.8 Commits (local only)

6. `Text motion: roll, track and glide units` covers `lib/text-motion.ts`, `components/motion/scrub-units.ts`,
   `components/motion/SplitWords.tsx`, `components/motion/useSlabScrub.ts`, `components/sections/CryptoSlabs.tsx` (refactor only)
   and `tests/text-motion.test.mjs`.
7. `Forex and Stock text: Cinzel, ticker roll and track-in, MOP copy` covers `app/layout.tsx`, `app/globals.css`, `lib/content.ts`,
   `lib/market-slabs.ts`, `lib/scroll-captions.ts`, `components/sections/MarketSlabs.tsx`, `components/sections/ScrollCaptions.tsx`,
   `components/sections/ForexMarketScroll.tsx` and `tests/market-slabs.test.mjs`.
8. `Plan: phase B` covers this file (docs-writer).
Verify with section 6 commands. `npm run build` must stay free of new warnings.

### 10.9 Decisions (phase B)

- D11. Forex gets the ticker roll and Stock gets the track-in. Both share `glide` for supporting parts and the gold `line` rule.
  Split-flap was rejected: it costs two elements per letter and its rotateX reads like the Crypto tilt.
- D12. Cinzel is used for both markets with `preload: false`. There is no faux italic: the gold line uses weight and colour.
- D13. The new slabs replace the Forex and Stock RevealText overlays. Their opacity comes from the slab windows on the Forex stop
  coordinate, not from frame thresholds. The Opportunity overlay is unchanged.
- D14. `CryptoSlabs` logic moves into `useSlabScrub` so both sections share one scrub loop. The Crypto behaviour and tests are
  unchanged.
- D15. The copy follows the Crypto tone: chapter framing, live sessions, Mysore and Bengaluru, process over outcomes. It makes no
  profit or return claims and adds no new numbers.

### 10.10 Open question

1. The Stock chips are S&P 500, NASDAQ and GOLD (the existing ones). Should they be Indian indices (NIFTY 50, SENSEX) if MOP
   teaches them in Mysore and Bengaluru? **Recommendation:** keep the existing chips until the owner confirms which equity markets
   are taught. Changing them is only copy.
