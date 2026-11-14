# Plan: forex-smoothness (stiff nav chips + Forex/Stock/Opportunity as smooth as Crypto)

Branch `luxury-upgrade`. Use `corepack pnpm`. Follow `rules.md`: transform/opacity only, shared gsap ticker, no copy changes, never touch `public/assets` or `public/frames/v1` (they are immutable). Commit before each change (one commit per phase below). Do not push. Do not touch the user's dev server on :3000.

Owner request (verbatim): "on the nav bar let the capsules be stiff rather than mvoing with cursor and also the 2nd scroll based that is forex and third scroll based section of stock and contniued ,have some serious scroll lagging ,set the time speed perfectly and also fix the issue ,the first crypto has a smooth effect so yea make it like that"

---

## 1. Findings (measured 2026-10-08, prod build on :3100, commit 26ff1ef)

### 1.1 Source cadence (the main visible "lag")
`docs/plans/forex-smoothness/cadence.mjs` (read-only, sharp, 320x180 greyscale mean abs diff) shows that **every source sequence repeats every 5th frame**. For a 0-based local index `i`, when `i % 5 === 2`, frame `i` is a copy of frame `i - 1`. This is 24->30 fps pulldown from the ezgif export. Each sequence has 48 such frames, and every near-duplicate matches the pattern:

| seq | duplicates (i%5==2) | max diff on pattern frames | min diff on other frames | mean motion/frame |
|---|---|---|---|---|
| crypto | 46 detected, all on the pattern | 0.246 | 0.218 (static intro) | 2.23 |
| forex | 48, all on the pattern | 0.075 | 0.256 | 2.87 (9-10 at frames 215-233) |
| stock_market | 47, all on the pattern | 0.098 | 0.603 | **4.84** |
| opportunity | 46, all on the pattern | 0.162 | 0.753 | **4.46** (14-22 at frames 195-209) |

At a steady scroll, one step in five shows no motion. That causes a 12-15 Hz judder. Stock and Opportunity move about 2x more per frame than Crypto, so the judder is about 2x more visible there. Crypto hides it because its motion is slow.

### 1.2 Harness numbers (down pass; "hold" = share of rAF samples where scroll moved but the picture did not change)
Harness: `docs/plans/forex-smoothness/{run.mjs,inject.js,seg.mjs}`. This is a headful (real GPU) variant of `final-prod-perf`.

| run | segment | lag p90 | rAF p95 | hold (dup-caused) |
|---|---|---|---|---|
| desktop warm, 1440x900 DPR1.5, STEP=60 | crypto | 1 | 17 | 20% (11%) |
| | forex | 1 | 17 | 30% (8%). Frames 40-160 hold 35%, frames 160+ hold 0% |
| | stock | 0 | 17 | 15% (15%) |
| | opp | 0 | 17 | 13% (13%) |
| desktop cold, NET=20 Mbps, WAIT=4000 | crypto | 0 | 17 | 19% (13%) |
| | forex | 1 | 17 | 30% (10%) |
| | stock | 2 | 17 | **62%** (1%) |
| | opp | 2 | 17 | **68%** (0%) |
| mobile 390x844 DPR3, 4x CPU (headless) | crypto | 19 | 116 | n/a (5 frames/step) |
| | forex | 25 | 67 | |
| | stock | 8 | 50 | |
| | opp | 7 | 50 | |
| | tail (video hand-off) | 0 | 83 (p50 50) | |

The main thread is not the cause. Long tasks during scroll are 0 on desktop, draw time is at most 0.2 ms, and rAF p95 is 17 ms in every segment. The measured problems are content judder, decode-budget starvation and fetch starvation.

### 1.3 Root causes
| # | Cause | Where |
|---|---|---|
| R1 | Pulldown duplicates get fetched, decoded and shown as real frames, so one step in five shows no motion. | `lib/frame-sequence/sources.ts:35-45` (`buildFrameSet` emits all 240/seq) |
| R2 | The pace does not match Crypto. Crypto uses 350vh / 240 = 1.458 vh per frame. Forex uses `1500vh` with `0.70` of a 1400vh range for 720 frames: 980vh / 720 = 1.361 vh per frame, which is 7% faster per pixel. Stock/Opp content is also 2x faster. | `components/sections/ForexMarketScroll.tsx:23-24, 59-62` |
| R3 | Two engines are decoding at the same time. Crypto's `decodeIO` (default margin `100% 0px 100% 0px`) and the -100vh overlap keep Crypto decode-enabled for the first ~200vh of Forex (forex frames ~0-147). Forex is decode-enabled for Crypto's last ~200vh. `effectiveBudget()` splits evenly (46 -> 23 bitmaps each on desktop). This matches the measured 35% hold on forex frames 40-160 and 0% after. | `lib/frame-sequence/engine.ts:309-311`, `components/hooks/useFrameSequence.ts:165-172` |
| R4 | Fetch starvation on a real network. The Forex engine fetches 720 frames in coarse-to-fine stride order across all three folders (`fetchScore`), so stride-1 frames of Stock and Opportunity arrive last. Forex has no `warm` list. Its full fetch starts at page load (`prefetchMargin 400%`) and competes with Crypto. | `lib/frame-sequence/math.ts:82-127`, `ForexMarketScroll.tsx:244-252` |
| R5 | The 5.4 MB hand-off video (CloudFront first, then `/intelligence-layer.mp4`) is armed with `video.load()` + `play()` at progress 0.45, which is mid-Stock (raw frame ~463). It competes with Stock/Opp frame fetches. | `ForexMarketScroll.tsx:223-231` |
| R6 | Overlap compositing. During Crypto's last 100vh, the Forex sticky (opacity < 1, translateY) blends over the Crypto canvas. That is intended (rules: "Forex fades in and overlaps Crypto"). After that, the Crypto sticky stays composited under the opaque Forex sticky for another 100vh, which is wasted GPU work. | `components/fx/ForexFade.tsx:12-30` |
| N1 | Nav "capsules move with cursor": a gsap `quickTo` magnetic effect on `[data-magnetic]`. It also reads `getBoundingClientRect` per pointermove. A dead `setOrigin` writes `--fx/--fy`, but `app/globals.css` never uses those properties. | `components/nav/GlassHeader.tsx:109-117, 133-164, 232`; `components/nav/JoinMenu.tsx:68` |

Not causes (checked): Lenis `lerp 0.1` and `damp` are identical for both sections (rate 0 with Lenis). `onUpdate` DOM writes are guarded by `put()`. The HUD refs are not attached to any element. There is one canvas per section. Backing size is capped by the source. The sequence boundaries are one continuous engine, so there is no engine switch at 240/480.

---

## 2. Design decisions
`hx` is not installed in this repo (`hx: command not found`), so the decisions are recorded here.

- **D1 Drop pulldown duplicates in code, not in assets.** The URL lists include only local frames with `i % 5 !== 2`, which is 192 per sequence. The assets stay untouched, and no `FRAME_SET_VERSION` bump is needed. Result: 20% fewer fetches and decodes, and no frozen steps. This applies to Crypto too, so both sections share the same pipeline. Frames 0 and 239 (the doorway hand-off frame) are kept.
- **D2 One pace for every sequence.** `SEQ_SCROLL_VH = 350`: one source sequence (192 unique frames) plays over 350vh, which is Crypto's current distance. Forex frames take 3 x 350 = 1050vh. The hand-off tail keeps its current 420vh. Forex height = 1050 + 420 + 100 = 1570vh. The mapping stays linear; motion-weighted pacing was rejected because it makes the speed uneven.
- **D3 One engine decodes at full budget.** An engine whose section target progress is strictly between 0 and 1 is "active". It gets `budget - 12 x (other enabled engines)`. Standby engines keep 12 bitmaps plus their pinned frames. Total memory stays the same as today.
- **D4 Fetch the next folder before the boundary.** A `fetchHorizon` (frames) adds a 10,000,000 score penalty to frames further than the horizon from the current frame. For Forex, the horizon is 192 (one folder). Coarse-to-fine still applies inside the horizon. Forex gets a `warm` list for its first folder.
- **D5 Frames before video.** The video arms once all Forex frames are fetched and the user is past the Forex folder, or at mid-Opportunity (unique frame 480) at the latest.
- **D6 Hide the covered Crypto sticky** (`visibility`, set at the threshold only, never animated) once ForexFade completes. Restore it on enter-back.
- **D7 Nav chips are stiff.** Remove the magnetic quickTo and the dead pointer-origin code. Keep the CSS border-trace and fill exactly as they are.

---

## 3. Changes

### Phase 1: Nav (commit "Nav: stiff chips, remove magnetic hover")
`components/nav/GlassHeader.tsx`
- Delete lines 109-117: the `setOrigin` function, the `links.forEach(... addEventListener('pointerenter'|'pointerleave', setOrigin))` line and its cleanup push. `--fx/--fy` are not referenced in any CSS (`grep -n "\-\-fx" app/globals.css` returns nothing).
- Change the comment on line 101 to `// Gold chips: active state.`
- Delete lines 133-164: the whole `// Magnetic hover` block, including the `pointermove` listener.
- Line 232: remove the `data-magnetic` attribute from the nav `<a>`.
- Keep `const reduced` (the sheen still uses it) and the `gsap` import (context and sheen).

`components/nav/JoinMenu.tsx`
- Line 68: remove `data-magnetic`.

Do not touch `components/fx/Magnetic.tsx` or `FinalCta.tsx`. They are outside the nav, and the request is nav only.

### Phase 2: Pure helpers + tests (commit "Frames: unique-frame sets, fetch horizon, active budget split")

`lib/frame-sequence/sources.ts`: add after `FRAMES_PER_SEQ`:
```ts
/** Every source sequence was exported 24->30 fps: 0-based local frame i with i % 5 === 2 repeats i - 1
 *  (verified by docs/plans/forex-smoothness/cadence.mjs). Those frames are never fetched or shown. */
export const PULLDOWN_PERIOD = 5;
export const PULLDOWN_PHASE = 2;
export function uniqueLocalFrames(perSeq: number = FRAMES_PER_SEQ): number[] {
  const out: number[] = [];
  for (let i = 0; i < perSeq; i++) if (i % PULLDOWN_PERIOD !== PULLDOWN_PHASE) out.push(i);
  return out;
}
export const UNIQUE_LOCAL: readonly number[] = uniqueLocalFrames(); // 192 entries, [0,1,3,4,5,6,8,...,239]
export const UNIQUE_PER_SEQ = UNIQUE_LOCAL.length; // 192
/** Scroll distance (vh) that plays one source sequence. Crypto: 450vh section - 100vh sticky. */
export const SEQ_SCROLL_VH = 350;
```
Change `buildFrameSet` to `buildFrameSet(seqs, tier, perSeq = FRAMES_PER_SEQ, locals: readonly number[] | null = null)`. When `locals` is set, iterate `for (const i of locals)` for each seq instead of `0..perSeq-1`. `urls` and `jpegs` use the same local index, so fallbacks stay aligned. Existing callers and tests keep the old behaviour.

`lib/frame-sequence/math.ts`
- `export const FETCH_HORIZON_PENALTY = 10_000_000;`
- `fetchScore(i, current, dir, nearWindow, horizon: number = Infinity)`. Leave the nearWindow branch unchanged. Final return becomes `(dist > horizon ? FETCH_HORIZON_PENALTY : 0) + (level + 1) * 1_000_000 + dist`. Here `dist` is the existing value, doubled when the frame is behind.
- `pickNextFetch(..., notBefore?, now = 0, horizon: number = Infinity)` passes `horizon` to `fetchScore`.
- Add:
```ts
export const STANDBY_BITMAPS = 12;
/** Decode budget for one engine. Exactly one active enabled engine gets the rest; others keep a standby window. */
export function splitBudget(budget: number, enabled: number, activeEnabled: number, isActive: boolean, pinned: number, standby: number = STANDBY_BITMAPS): number {
  if (enabled <= 1) return budget;
  if (activeEnabled === 1) return isActive ? Math.max(16, budget - (enabled - 1) * standby) : standby + pinned;
  return Math.max(16, Math.floor(budget / enabled));
}
```

Tests: add to `tests/frame-sources.test.mjs`. Import `uniqueLocalFrames, UNIQUE_LOCAL, UNIQUE_PER_SEQ, SEQ_SCROLL_VH`.
- `uniqueLocalFrames(240).length === 192`; `UNIQUE_PER_SEQ === 192`; `UNIQUE_LOCAL.slice(0, 7)` deepEquals `[0,1,3,4,5,6,8]`; includes 239; excludes 2, 7, 237; strictly increasing.
- `buildFrameSet(['forex','stock_market','opportunity'],'portrait',240,UNIQUE_LOCAL)`: `urls.length === 576`; `urls[2] === '/frames/v1/forex/p1080/004.webp'`; `urls[192] === '/frames/v1/stock_market/p1080/001.webp'`; `urls[575] === '/frames/v1/opportunity/p1080/240.webp'`; `fallback[575] === '/assets/opportunity/ezgif-frame-240.jpg'`.
- `buildFrameSet(['crypto'],'full',240,UNIQUE_LOCAL).urls.length === 192`, and `fallback === null`.
- The existing `buildFrameSet` test is unchanged (720 / 240).

Tests: add to `tests/frame-sequence-math.test.mjs`. Import `splitBudget, FETCH_HORIZON_PENALTY`.
- `fetchScore(300, 0, 1, 24, 192) >= FETCH_HORIZON_PENALTY`; `fetchScore(160, 0, 1, 24, 192) < FETCH_HORIZON_PENALTY`; `fetchScore(10, 0, 1, 24, 5) === 10` (nearWindow wins); `fetchScore(300,0,1,24) === fetchScore(300,0,1,24,Infinity)`.
- pickNextFetch horizon: `state = new Uint8Array(400)`. Set `state[i] = 2` for `i <= 24`, for every `i % 16 === 0`, and for every `i % 8 === 0 && i <= 100`. Expect `pickNextFetch(state, [], 0, 1, 24, true) === 104` and `pickNextFetch(state, [], 0, 1, 24, true, [], undefined, 0, 100) === 28`.
- `splitBudget(46,1,0,false,2) === 46`; `(46,2,1,true,2) === 34`; `(46,2,1,false,2) === 14`; `(46,2,0,false,2) === 23`; `(46,2,2,true,2) === 23`; `(20,3,1,true,2) === 16`.

### Phase 3: Engine + hook (same commit as Phase 2)

`lib/frame-sequence/engine.ts`
- Import `splitBudget, STANDBY_BITMAPS` (STANDBY only if used) from `./math`.
- Options: add `fetchHorizon?: number` (default `Infinity`) and `onAllFetched?: () => void` (fired once after the full fetch finishes with nothing idle or in flight).
- Fields: `private readonly fetchHorizon: number; private readonly onAllFetched?: () => void; private active = false; private allFetchedFired = false;`, set in the constructor.
- New public method:
```ts
/** Active = its section is mid-scroll. Exactly one active engine gets the full decode budget. */
setActive(on: boolean): void {
  if (this.destroyed || on === this.active) return;
  this.active = on;
  enabledEngines.forEach((e) => e.markDirty());
  this.markDirty();
}
```
- Replace `effectiveBudget()` (lines 309-311) with:
```ts
private effectiveBudget(): number {
  let activeEnabled = 0;
  enabledEngines.forEach((e) => { if (e.active) activeEnabled++; });
  return splitBudget(this.budget, enabledEngines.size, activeEnabled, this.active, this.pinned.length);
}
```
  `e.active` is private but readable inside the class.
- In `pump()`, pass `this.fetchHorizon` as the 10th argument of `pickNextFetch` (after `now`).
- In `pump()`, after the fetch `while` loop (still inside `if (this.started && !this.paused)`), add: `if (this.fullFetch && !this.allFetchedFired && this.inflightFetches === 0 && !this.fetchState.includes(FETCH_IDLE)) { this.allFetchedFired = true; const cb = this.onAllFetched; if (cb) queueMicrotask(cb); }`. In `switchToFallback()`, reset `this.allFetchedFired = false`.

`components/hooks/useFrameSequence.ts`
- `UseFrameSequenceOptions`: add `nearWindow?: number; fetchHorizon?: number; onAllFetched?: () => void;` with doc comments.
- Engine construction (lines 96-104): pass `nearWindow: optsRef.current.nearWindow`, `fetchHorizon: optsRef.current.fetchHorizon`, `onAllFetched: () => optsRef.current.onAllFetched?.()`.
- `tick` (lines 135-144): after `const target = targetProgress();`, add `engine.setActive(target > 0 && target < 1);`. It is a no-op unless the value changes.

### Phase 4: Sections (commit "Forex: Crypto pace, unique frames, folder prefetch, frames-before-video")

`components/sections/CryptoMarketScroll.tsx`
- Import `UNIQUE_LOCAL, UNIQUE_PER_SEQ, FRAMES_PER_SEQ, SEQ_SCROLL_VH`.
- `const TOTAL_FRAMES = UNIQUE_PER_SEQ; // 192 unique of 240`
- `urlsFor = (tier) => buildFrameSet(['crypto'], tier, FRAMES_PER_SEQ, UNIQUE_LOCAL)`
- `PINNED = [0, TOTAL_FRAMES - 1]`, `CRYPTO_WARM = warmIndices(TOTAL_FRAMES)`. `frameForProgress` is unchanged.
- In `onUpdate`, the HUD text uses `String(UNIQUE_LOCAL[frame] + 1)`. The refs are unattached today; keep them cheap.
- Section style: `height: \`${SEQ_SCROLL_VH + 100}vh\`` (= 450vh, unchanged).

`components/sections/ForexMarketScroll.tsx`: replace lines 18-62 (constants, SEQUENCES, resolveSeq, urlsFor, PINNED, frameForProgress) with:
```ts
const PER          = UNIQUE_PER_SEQ;              // 192 unique frames per source folder
const TOTAL_FRAMES = PER * 3;                     // 576
// Same pace as Crypto: one folder per SEQ_SCROLL_VH (350vh). Tail length unchanged (was 0.30 x 1400vh).
const FRAME_VH  = 3 * SEQ_SCROLL_VH;              // 1050
const TAIL_VH   = 420;
const RANGE_VH  = FRAME_VH + TAIL_VH;             // 1470
const SCROLL_HEIGHT_VH     = RANGE_VH + 100;      // 1570 (sticky = 100vh)
const FRAME_SCROLL_PORTION = FRAME_VH / RANGE_VH; // 5/7
const at = (vhAfterFrames: number): number => (FRAME_VH + vhAfterFrames) / RANGE_VH;
// Same vh offsets as before (old p x 1400 - 980).
const HUD_FADE_START = at(-28);
const HUD_FADE_LEN   = 70 / RANGE_VH;
const XFADE_START = at(42);
const XFADE_END   = at(154);
const SETTLE_END  = at(266);
const REVEAL_ON   = at(266);
const REVEAL_OFF  = at(210);
const VIDEO_ARM_FRAME = 2 * PER + PER / 2;        // 480 = mid Opportunity, latest arm point
```
- `SeqInfo` gains `rawStart: number`. Entries: forex `{start: 0, frames: PER, rawStart: 0}`, stock `{start: PER, frames: PER, rawStart: 240}`, opportunity `{start: 2 * PER, frames: PER, rawStart: 480}`. Labels are unchanged. `resolveSeq` is unchanged and works on unique indices.
- `urlsFor = (tier) => buildFrameSet(['forex','stock_market','opportunity'], tier, FRAMES_PER_SEQ, UNIQUE_LOCAL)`; `PINNED = [0, TOTAL_FRAMES - 1] as const`; `const FOREX_WARM = warmIndices(PER);`
- `frameForProgress = (p, total) => p < FRAME_SCROLL_PORTION ? Math.min(total - 1, Math.max(0, Math.round((p / FRAME_SCROLL_PORTION) * (total - 1)))) : total - 1;` This is the same rounding as Crypto.
- `onUpdate` changes:
  - `const { seq, localIdx } = resolveSeq(frame); const rawLocal = UNIQUE_LOCAL[localIdx]; const globalIdx = seq.rawStart + rawLocal;`. Every overlay threshold (215/240/265/455/480/505/660 and the divisors) stays exactly as written, because it is in raw global frames.
  - HUD puts: `hudFrame` uses `rawLocal + 1`, `hudTotal` uses `FRAMES_PER_SEQ`, and `hp = rawLocal / (FRAMES_PER_SEQ - 1)`.
  - `if (progress > HUD_FADE_START) hudMasterOp = Math.max(0, 1 - (progress - HUD_FADE_START) / HUD_FADE_LEN);`
  - `'vis'`: `progress >= FRAME_SCROLL_PORTION ? 'visible' : 'hidden'`.
  - Video arm: replace `progress >= 0.45 && !armedRef.current` with `!armedRef.current && (frame >= VIDEO_ARM_FRAME || (framesFetchedRef.current && frame >= PER))`. Add `const framesFetchedRef = useRef(false);`.
- `useFrameSequence({...})`: add `warm: FOREX_WARM, fetchHorizon: PER, onAllFetched: () => { framesFetchedRef.current = true; }`. Keep `prefetchMargin: '400% 0px 400% 0px'`. With the horizon, that early fetch now fills the Forex folder first.
- The section style height already uses `SCROLL_HEIGHT_VH`. Keep `marginTop: '-100vh'`. Leave all JSX and copy untouched.

`components/fx/ForexFade.tsx`
- Inside `useGSAP`, add:
  - `const cryptoSticky = document.getElementById('crypto-sequence')?.firstElementChild as HTMLElement | null;`
  - `const cover = (on: boolean): void => { if (cryptoSticky) cryptoSticky.style.visibility = on ? 'hidden' : ''; };`
- In the `scrollTrigger`, add `onLeave: () => cover(true), onEnterBack: () => cover(false), onLeaveBack: () => cover(false), onRefresh: (self) => cover(self.progress >= 1)`.
- Return `() => cover(false)` from the `useGSAP` callback.
- Update the header comment: "after the fade completes, the covered Crypto sticky is hidden (visibility, threshold only)".

Note: `PaletteBackdrop` triggers on `'60% bottom'` of `#forex-sequence`, so the dark crossfade now starts about 42vh later in absolute scroll. That is acceptable and needs no change.

### Phase 5: Harness (same commit as Phase 4)
- `docs/plans/final-prod-perf/inject.js`: replace it with `docs/plans/forex-smoothness/inject.js`. In `docs/plans/final-prod-perf/run.mjs`, prefix the injected source with `window.__LAYOUT='unique';\n` (the same pattern as `forex-smoothness/run.mjs` line 48). Without this, the old 240/720 mapping reports false lag.

---

## 4. Verification commands
```sh
cd C:/Users/Suhas/Desktop/MOP_lux/masterogpipsology_client
corepack pnpm test && corepack pnpm lint && corepack pnpm build
corepack pnpm start -p 3100          # background; never touch :3000
cd docs/plans/forex-smoothness
LAYOUT=unique DPR=1.5 STEP=60 node run.mjs desktop w.json && node seg.mjs w.json unique
LAYOUT=unique DPR=1.5 STEP=60 NET=20 WAIT=4000 node run.mjs desktop c.json && node seg.mjs c.json unique
LAYOUT=unique node run.mjs mobile m.json && node seg.mjs m.json unique
cd ../final-prod-perf && node run.mjs desktop d.json && node analyze.mjs d.json   # regression: longtasks 0, blank 0
# stop the :3100 server afterwards (kill only the PID listening on 3100: netstat -ano | grep :3100)
```
`run.mjs` in `forex-smoothness` is headful: a Chrome window appears for about 40 s. It uses installed Chrome only.

## 5. Acceptance targets (down and up passes)
1. Warm desktop (`w.json`): every forex/stock/opp row has hold ≤ crypto hold + 3 points and ≤ 12%, with `dup 0%`. Lag p90 ≤ 1, blank 0, rAF p95 ≤ 1.1 x crypto. The baseline was a 30/15/13% hold against 20% for crypto.
2. Cold desktop (`c.json`): forex/stock/opp hold ≤ 1.1 x crypto hold + 3 points, and lag p90 ≤ crypto p90 + 1. The baseline was stock 62% and opp 68% against 19% for crypto.
3. Mobile 4x (`m.json`): forex/stock/opp lag p90 ≤ max(1.1 x crypto p90, crypto p90 + 2), rAF p95 ≤ 1.1 x crypto, blank 0.
4. Pace: from the `geo` line, `(fBottom - fTop - vh) * 5/7 / 576` equals `(cH - vh) / 192` within 1%. At vh=900, both are 16.41 px per frame.
5. Frames: Network shows no `.../003.jpg|webp`, `008`, `013`, ... (local i%5==2) requests. Total frame fetches are 768 (4 x 192).
6. Hand-off: the doorway dissolve, settle and reveal look identical to before. The video is armed after the frames finish, or at mid-Opportunity at the latest. In `c.json`, check that the `intelligence-layer`/CloudFront request starts after most frame requests (`res` start times).
7. Nav: on desktop, hovering any nav chip or "Join the team" and moving the pointer leaves `getComputedStyle(el).transform === 'none'`, with no inline `transform` on the element. The border-trace and fill still play.
8. `corepack pnpm test`, `lint` and `build` are green. Copy is unchanged (`git diff` shows no edits to JSX text or `lib/content.ts`). No changes under `public/`.
9. The owner checks visually on :3000 and on a real iPhone (rules.md pre-deploy). Do not push.

## 6. Out of scope (follow-up, measured)
On mobile 4x, the video tail after the frames runs at rAF p50 50 ms (crypto 33). That is IntelligenceHero video playback plus the reveal, and it is a separate investigation. `Magnetic` in `FinalCta` stays.
