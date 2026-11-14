# Stock/Opportunity stops and the seamless video hand-off

Branch `luxury-upgrade`, base `b82f180` (local, not pushed). Planner: Opus. Coder: implement exactly this; do not explore beyond the
files named. User rules: **no new tests** (the user tests manually); the coder runs only `npx tsc --noEmit`, `npm run lint`,
`npm run build` (plus the one-off asset script in 3.1). **Never delete assets. Commit locally, never push.**

Already shipped and not re-planned: C1-C3 + C4 hand-off, F1-F3, S1, sticky frame set, HUD labels, dev-only HUD
(`docs/plans/forex-stock-step-scroll.md`). Note on the old F3 item "PROGRAMME 02 appears below": fixed earlier by moving Programme 02
after the Equities rows; in this plan **S2 owns Programme 02**, and F3 stays clean ("FOREX / Interbank flow", nothing revealing).

## 1. Facts verified (do not re-derive)

- New stop indices (`stopListIndex(raw, UNIQUE_LOCAL)`, chain = folder x 192 + list):
  stock raw 189 = list 150 = **chain 342**; opportunity raw 97 = list 77 = **chain 461**; opportunity raw 216 = list 172 =
  **chain 556**; opportunity raw 240 = list 191 = **chain 575** (the last frame). Matches the user's HUD picks (342.09, 461.01, 556.03).
- Folder cuts: stock->opportunity between chain 383 and 384, so it lies inside the S2->O1 glide at s = 5 + 41.5/119 = **5.349**.
- Chapter titles (`CURRICULUM_CHAPTERS`): 02 Market structure, 03 Order flow and liquidity, 04 Entries and execution,
  05 Trade management, 06 Review and compounding. The rail renders them in Cinzel caps.
- Current hand-off (`ForexMarketScroll.tsx`): frames end at `FRAME_SCROLL_PORTION` = at(0); tail 420vh: HUD gone at(42),
  canvas dissolve `XFADE_START` at(42) -> `XFADE_END` at(154), video settle (lock rect -> native layout, transform only) to
  `SETTLE_END` at(266), closing lines (`CLOSING_LINES`, "Three markets. One discipline.") reveal at `REVEAL_ON` at(266), hide at
  `REVEAL_OFF` at(210). Today the video starts playing only at XFADE_END and is armed at chain 480.
- `IntelligenceHero` lists the CloudFront mp4 first and `/intelligence-layer.mp4` second. **They are the same file**: local md5
  `919933bd44c9323b44945d57e6503d91` = CloudFront ETag, same 5,361,462 bytes.
- DepthStage tilt eases to exact identity at at(0) (`TILT_EASE`, `f === 0` branch); on non-full tiers DepthStage is off.
  The portrait tier p1080 is an exact centre crop (`extract left 528, 864x1080`), so `frameLockRect` (cover-fit 1920x1080) is
  valid on every tier.

## 2. Video vs last frame: measured result

Decoded in headless Chrome 1xx (the same decoder that plays it on the page; ffmpeg/ffprobe are **not installed**, checked):

- `intelligence-layer.mp4`: **1664x1248, 10.042 s**. Frame t = 0 shows the same doorway and walking figure as opportunity 240.
- Placed with the runtime lock geometry (`videoPlacement()`: k 1.2241, dx 0.7, dy -76.4; video rect -57.7, -300.2, 2036.9 x 1527.7
  in 1920x1080 space, so it fully covers the frame), compared with `ezgif-frame-240.jpg` at 480x270:
  - mean abs diff **8.1 / 255** overall; door region 4.3; bottom band (fog, floor) **15.0**; centre band 11.2.
  - Frame 240 has brighter, warmer fog and floor glow and a small "Veo" watermark bottom right; the video frame is darker and has no
    watermark. The figure and door line up (within a few px).
  - A free grid search over scale/offset only reaches 8.0, so the gap is **content (exposure, fog, watermark), not geometry**.
  - Tiers agree with each other (JPEG vs lite WebP of frame 240: diff 1.0), so this is not a tier issue.
- The last frames are almost still: frame 239 vs 240 diff 1.6, 232 vs 240 3.9, 226 vs 240 5.6, so a pre-baked dissolve over the last
  12 list frames shows no visible double figure (checked on a crop strip of raws 200-240 vs the placed video frame).

**Verdict: no match.** A plain swap or crossfade would show a visible brightness and fog change and the watermark vanishing. Fix (D1):
bake the video's first frame, placed with the runtime lock geometry, into the **last canvas frame**, and dissolve into it over the
last 12 list frames, in a **new versioned folder** `public/frames/handoff-v1/`. Nothing in `v1` or `/assets` is overwritten. At the
real crossfade the canvas then shows the video's own first frame at the exact rect where the video sits: a pixel-identical swap.

## 3. Changes

### 3.1 Assets (one-off, local; inputs committed for reproducibility)

1. **Video first frame source.** Already extracted by the planner (Chrome decode, t = 0, PNG, 1664x1248):
   `C:\Users\Suhas\AppData\Local\Temp\claude\C--Users-Suhas-Desktop-MOP-lux\d08134a5-e38c-481f-a4e4-c9adf870e002\scratchpad\probe\v0.png`.
   Copy it to `scripts/handoff/intelligence-t0.png` (commit it; it is a source, not served).
   If that file is gone: create `scripts/handoff/extract-t0.html` (a page that loads `../../public/intelligence-layer.mp4` muted,
   waits for `loadeddata`, sets `currentTime = 0`, awaits `seeked`, draws it to a 1664x1248 canvas and writes `toDataURL('image/png')`
   into `<textarea id="png">`), then run:
   ```
   "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --allow-file-access-from-files \
     --user-data-dir="$TEMP/mop-chrome" --virtual-time-budget=60000 --dump-dom \
     "file:///C:/Users/Suhas/Desktop/MOP_lux/masterogpipsology_client/scripts/handoff/extract-t0.html" > /tmp/t0.html
   sed -n 's/.*<textarea id="png">data:image\/png;base64,\([^<]*\)<.*/\1/p' /tmp/t0.html | base64 -d > scripts/handoff/intelligence-t0.png
   ```
2. New `scripts/make-handoff-frames.mjs` (node 24 strips types, so it may import the `.ts` modules directly):
   ```js
   import sharp from 'sharp';
   import { videoPlacement } from '../lib/frame-sequence/handoff.ts';      // runtime lock geometry = single source of truth
   import { UNIQUE_LOCAL } from '../lib/frame-sequence/sources.ts';
   ```
   - `p = videoPlacement()`; `vw = Math.round(1664 * p.k)`, `vh = Math.round(1248 * p.k)`;
     `left = Math.round(vw / 2 - 960 - p.dx)`, `top = Math.round(vh / 2 - 540 - p.dy)`;
     `locked = sharp(t0).resize(vw, vh, { kernel: 'lanczos3' }).extract({ left, top, width: 1920, height: 1080 }).removeAlpha().raw()`.
   - Ramp: `RAMP = UNIQUE_LOCAL.slice(180)` (0-based locals; raws 226, 227, 229, 230, 231, 232, 234, 235, 236, 237, 239, 240),
     weight `w_j = smoothstep((j + 1) / 12)` for j = 0..11 (raw 240 gets exactly 1).
   - For each: `orig = sharp('public/assets/opportunity/ezgif-frame-NNN.jpg').removeAlpha().raw()`;
     `out[i] = Math.round(orig[i] * (1 - w) + locked[i] * w)` on the raw RGB buffers.
   - Write (fail if any target already exists: cache rule):
     - `public/frames/handoff-v1/opportunity/1920/NNN.jpg`: `jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' })`
     - `public/frames/handoff-v1/opportunity/1280/NNN.webp`: `resize({ width: 1280, kernel: 'lanczos3' })`, then
       `webp({ quality: 78, effort: 5, smartSubsample: true })` (same as `scripts/make-frames.mjs`)
     - `public/frames/handoff-v1/opportunity/p1080/NNN.webp`: `extract({ left: 528, top: 0, width: 864, height: 1080 })`, same webp
     - Poster `public/frames/handoff-v1/intelligence-t0.jpg`: the t0 PNG at 1664x1248, `jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' })`
   - Self-check at the end: decode the written `1920/240.jpg`, compare with `locked` at 480x270, print the mean abs diff
     (expect < 2) and the total bytes written (expect about 3 to 5 MB).
   - Add `"handoff": "node scripts/make-handoff-frames.mjs"` to `package.json` scripts. Run `npm run handoff` once.
3. `lib/frame-sequence/sources.ts`:
   ```ts
   /** Pre-baked dissolve of the last 12 opportunity frames into the video's first frame (scripts/make-handoff-frames.mjs). */
   export const HANDOFF_SET = 'handoff-v1';
   export const HANDOFF_RAW_FROM = 226;  // 1-based opportunity raws >= this come from /frames/handoff-v1
   export const HANDOFF_POSTER = `/frames/${HANDOFF_SET}/intelligence-t0.jpg`;
   const isHandoff = (seq: SeqName, i: number): boolean => seq === 'opportunity' && i + 1 >= HANDOFF_RAW_FROM;
   ```
   - `jpegFrameUrl(seq, i)`: if `isHandoff` return `/frames/${HANDOFF_SET}/opportunity/1920/${pad3(i)}.jpg`.
   - `frameUrl(seq, i, tier)`: if `isHandoff`: `full` returns `jpegFrameUrl(seq, i)`, otherwise
     `/frames/${HANDOFF_SET}/opportunity/${tier === 'portrait' ? 'p1080' : '1280'}/${pad3(i)}.webp`.
   - Pulldown twins (raw 228, 233, 238) are never requested, so they are not baked. `/frames/:path*` is already immutable
     (`next.config.ts`).

### 3.2 Step scroll: tail frames and auto-advance (`components/hooks/useStepScroll.ts`)

`StepScrollOptions` gains:
```ts
/** Virtual list frames for the tail segment (last frame stop -> tail), so a glide there follows the speed rule even though no
 *  frame moves (Forex: the video hand-off). */
tailFrames?: number;
/** ys index whose landing from a downward glide auto-glides on to the next stop after the hold (Forex: O3 -> video). */
autoAdvance?: number;
```
- Fields `tailFrames`, `autoAdvance`, `autoTimer: Timer = null`, `glideDir: 1 | -1 = 1`.
- `glideTo(k)`: compute `frames = |posAt(Y) - posAt(y0)|`. If `this.tailFrames` and a tail exists
  (`this.ys.length > this.stops.length`), set `a = ys[n-2]`, `b = ys[n-1]` and add
  `this.tailFrames * |clamp(Y, a, b) - clamp(y0, a, b)| / (b - a)`. Set `this.glideDir = Y >= y0 ? 1 : -1`. Clear `autoTimer` first.
  The rest is unchanged: same `glideProfile(frames, this.fps)`, so the same speed rule.
- `onComplete`: after the existing lines, `if (this.autoAdvance === k && this.glideDir > 0) this.armAuto(k);`.
- `private armAuto(k)`: `this.autoTimer = setTimeout(() => { this.autoTimer = null; if (!this.ready || this.gliding ||
  this.blocked() || this.touch.active || stopAt(this.ys, this.y(), STOP_TOL_PX) !== k) return; this.glideTo(k + 1); }, HOLD_MIN_MS);`
  Input during the hold is already swallowed (shared hold), so the chain cannot be double-triggered.
- Clear `autoTimer` in the `attach` cleanup.
- Crypto passes neither option, so it is unchanged.

### 3.3 Stops, rail, slabs

`lib/step-scroll.ts`: `STOCK_STOPS_RAW = [32, 189]`; add `export const OPPORTUNITY_STOPS_RAW: readonly number[] = [97, 216, 240];`.

`lib/forex-rail.ts`: replace the body with the pure stop-coordinate model below. Every part of the rail is now stepped, so the
frame-fraction half (`FOREX_S1_F`, `FOREX_RAIL_SPLIT`, `forexRailStopU`, `forexRailFrameU`, `spreadEven`, `STOCK_END_F`,
`FOREX_FLOW_TO_F`) is deleted.
```ts
// s: -1 crypto 179, 0 Y0 (forex 1), 1 F1, 2 F2, 3 F3, 4 S1, 5 S2, 6 O1, 7 O2, 8 O3 (last frame), 9 V (video, tail stop).
export const FOREX_CHAIN_STOPS: readonly number[] = [0, 50, 88, 154, 217, 342, 461, 556, 575];
  // = chainStopIndices([FOREX_STOPS_RAW, STOCK_STOPS_RAW, OPPORTUNITY_STOPS_RAW], UNIQUE_LOCAL)
export const FOREX_S_MIN = -1;
export const FOREX_S_MAX = 9;
export const FOREX_RAIL_HOLD_HALF = 0.1;
export const FOREX_RAIL_FROM_S = -0.5;
export const FOREX_RAIL_TO_S = 6.5;      // last caption (Programme 06 at O1) gone well before the O2 hold
const R = 2 / 3;                         // transition : hold = 0.4 : 0.6 (FLOW_TRANSITION_SHARE)
export function forexRailU(s: number): number;   // NaN -> 0; (clamp(s, MIN, MAX) - MIN) / (MAX - MIN)
/** m holds strictly between stop holds a and b: m holds of length h and m + 1 equal transitions t = R h fill (a + .1, b - .1). */
export function railBetween(a: number, b: number, m: number): { start: number; end: number }[];
  // span = (b - a) - 2 * HOLD_HALF; h = span / (m + (m + 1) * R); t = R * h; hold i: start = a + HOLD_HALF + t + i * (h + t), end = start + h
export function forexRailSpec(): { from: number; to: number; steps: { start: number; end: number }[] };
```
`forexRailSpec` returns 13 windows in s, then mapped with `forexRailU`:

| row | caption | window (s) | at stop |
|---|---|---|---|
| 0-3 | FOREX / kicker, Major pairs, London & NY sessions, Interbank flow | k +/- 0.1 | Y0, F1, F2, F3 |
| 4 | EQUITIES / Individual stocks and indices | 3.9-4.1 | S1 |
| 5-7 | EQUITIES / US indices, Sector rotation, Earnings plays | `railBetween(4, 5, 3)`: 4.194-4.335, 4.429-4.571, 4.665-4.806 | passing in the S1->S2 glide |
| 8 | PROGRAMME 02 / Market structure | 4.9-5.1 | **S2** |
| 9-11 | PROGRAMME 03, 04, 05 | `railBetween(5, 6, 3)`: same spacing, evenly | passing in the S2->O1 glide |
| 12 | PROGRAMME 06 / Review and compounding | 5.9-6.1 | **O1** |

`from = forexRailU(-0.5)` and `to = forexRailU(6.5)`. The rail is gone at O2, O3 and the video.

`lib/scroll-captions.ts`: `FOREX_LINES` drops the two brand rows (`[BRAND_NAME, BRAND_TAGLINE]`,
`[BRAND_NAME, FINAL_CTA_HEADLINE]`), leaving 13 rows. Kinds are unchanged (`i < 4` roll, `i < 8` track, else glide). Remove the
imports that become unused (`BRAND_TAGLINE`, `FINAL_CTA_HEADLINE`, and `BRAND_NAME` if it is unused) and fix the comment.

`lib/market-slabs.ts`: the coordinate is now just s.
```ts
export const MARKET_SLAB_WINDOWS = {
  forex:       { inFrom: -0.6, inTo: -0.05, outFrom: 3.15, outTo: 3.5 },   // unchanged
  stock:       { inFrom: 3.62, inTo: 3.95,  outFrom: 5.08, outTo: 5.32 },  // held through S1 AND S2; out in S2->O1 before the cut (5.349)
  opportunity: { inFrom: 5.4,  inTo: 5.92,  outFrom: 6.08, outTo: 6.5 },   // in after the cut, held at O1, fully out long before O2 (s 7)
} as const;
/** Slab coordinate = the Forex stop coordinate. NaN -> -1. */
export function marketSlabX(s: number): number;
```
Delete `STOCK_S1_POS` and `STOCK_END_POS`.

`lib/content.ts`: add the existing Opportunity copy verbatim as a slab (no copy change):
```ts
/** Opportunity slab (in after the stock->opportunity cut, held at O1, out before O2). Copy unchanged from the old overlay. */
export const OPPORTUNITY_SLAB: SlabCopy = {
  label: 'Where it all converges',
  title: ['This is your moment,', 'the opportunity.'],
  body: 'Every market. Every asset class. Every edge. The complete picture of how institutional capital moves — and how you position yourself inside it.',
  tags: ['STRUCTURE • ORDER FLOW', 'RISK • PSYCHOLOGY', 'EXECUTION • CONSISTENCY'],
};
```
Unit count: 1 + 1 + 4 + 15 + 23 + 3 = 47, which is at most 60.

`components/sections/MarketSlabs.tsx`: `IDS = ['forex', 'stock', 'opportunity']`; the `Slab` `id` type adds `'opportunity'`; render
`<Slab id="opportunity" copy={OPPORTUNITY_SLAB} motion="track" />`. The label is upper-cased by the existing class.

### 3.4 `components/sections/ForexMarketScroll.tsx`

- `FOREX_STEP`:
  ```ts
  { stops: FOREX_CHAIN_STOPS, total: TOTAL_FRAMES, map: FOREX_MAP,
    tail: (l) => l.top + REVEAL_ON * (l.height - l.viewportH),   // V: video settled, closing lines in
    tailFrames: HANDOFF_TAIL_FRAMES,                              // 72 -> 2.37 s at the same speed rule
    autoAdvance: FOREX_CHAIN_STOPS.length - 1 }                   // O3 (last frame) -> V after the 0.45 s hold
  ```
  Add `const HANDOFF_TAIL_FRAMES = 72;` next to the hand-off constants. `PINNED` stays `[...FOREX_CHAIN_STOPS, TOTAL_FRAMES - 1]`, so
  the new landing frames are pinned automatically.
- `onUpdate`:
  - `captionRef.current?.(forexRailU(s))`; `slabRef.current?.(marketSlabX(s))`.
  - Delete the `oppOp` block and its `put`, `opportunityOverlayRef`, the Opportunity overlay JSX, and the `RevealText` import.
  - Keep `hudOp`.
- Canvas: keep the opacity dissolve. Add `put('cvis', e >= 1 ? 'hidden' : 'visible', (v) => { canvas.style.visibility = v; })`, so
  the canvas is fully hidden after the crossfade and returns on reverse.
- Video (replace the block after `const video = getVideo()`):
  - Arm at S2: `VIDEO_ARM_FRAME = 342`, with the same arming code (preload auto, `load()`, muted play then pause and
    `currentTime = 0` to decode frame 0 on iOS).
  - Play from the **start** of the crossfade: `if (progress >= XFADE_START && !reducedRef.current) setVideoState('play');`
    `else if (progress < XFADE_START) { setVideoState('pause'); if (video.currentTime !== 0) video.currentTime = 0; }`.
    Below XFADE_START the canvas is opaque, so the reset is invisible.
- `<IntelligenceHero embedded revealed={revealed} autoPlayVideo={false} videoPreload="none" poster={HANDOFF_POSTER} />`
  (import `HANDOFF_POSTER` from sources).
- Unchanged: `XFADE_*`, `SETTLE_END`, `REVEAL_*`, `applySettle`, the geometry measure, `TILT_EASE`, `HUD_FADE_*` and the section
  height. The closing lines keep working: they reveal exactly at the V landing (at(266)) and hide on reverse at(210).

### 3.5 `components/sections/IntelligenceHero.tsx`

- Add the prop `poster?: string`; set `poster={poster}` on the `<video>`. The poster is the video's own frame 0 at 1664x1248, so
  `object-fit: cover` in the same box gives the identical crop. Until the video has decoded, the poster (= the last canvas frame)
  shows: no black dip.
- Source order: `/intelligence-layer.mp4` **first** (same origin, immutable cache, the arm preload hits it), CloudFront second (kept,
  not deleted; identical file).

## 4. Timing (same speed rule: 48 fps cruise, 0.4 s ease-in, 1.0 s brake, 0.45 s hold, one gesture per slab)

| Slab | Range (chain) | List frames | Duration | Texts at the stop |
|---|---|---|---|---|
| S2 | 217 -> 342 | 125 | 3.471 s | Stock slab fully in (held since S1); rail PROGRAMME 02 / Market structure; Equities tag rows pass mid-glide |
| O1 | 342 -> 461 (cut at 383) | 119 | 3.346 s | Stock out before the cut; Opportunity slab in after it, fully in at O1; PROGRAMME 03-05 pass evenly; rail PROGRAMME 06 |
| O2 | 461 -> 556 | 95 | 2.846 s | Opportunity text, tags and rail fully out by s 6.5 (about 1.2 s before landing): clean figure-to-door frame |
| O3 | 556 -> 575 | 19 (short profile) | 1.039 s | last frame = the video's first frame (baked ramp 564 -> 575) |
| (auto) hold | at 575 | - | 0.45 s | still last frame |
| V | 575 -> video settled | 72 virtual | 2.367 s | crossfade at(42)->at(154) inside the glide, video plays from crossfade start, settle to native layout, closing lines reveal on landing |

After V, a fresh gesture down passes to native scroll (HallmarkDial follows). From below, scrolling up is caught at V. Going up from
V glides back to O3: the settle and crossfade reverse, the canvas returns over the paused video (the canvas is opaque by
XFADE_START, then the video resets to t = 0 invisibly). Next gesture up goes to O2, and so on.

**Mobile:**
- Everything visual is opacity or transform on composited layers (canvas `will-change: opacity`, video `will-change: transform`).
- On lite and portrait tiers DepthStage is off, so there is no tilt to unwind.
- The video arms about 6 s of glides before O3.
- If iOS refuses to play (Low Power Mode rejects `play()`), the poster stays: still identical to the last frame, just static.
- Portrait crops are exact centre crops, so `frameLockRect` is right on phones too.

## 5. Verify (coder)

```
npm run handoff                      # once: writes public/frames/handoff-v1/** and prints the self-check diff (< 2)
npx tsc --noEmit
npm run lint
npm run build
```
Existing tests that pin old constants become stale: `tests/forex-rail.test.mjs`, `tests/market-slabs.test.mjs`,
`tests/step-scroll.test.mjs` line 290 (`[0, 50, 88, 154, 217]`). Do not add tests. Update only the expected values that changed
(stop array, rail windows, slab windows, `marketSlabX` signature), or leave them for the user. Running them is not required by the
user's rule.

Manual (user, visual), in `npm run dev` with the HUD:
1. Each gesture lands at pos 342.00, 461.00, 556.00, 575.00. After 575 there is a 0.45 s still, then the video hand-off glides on
   by itself.
2. At S2 the Stock slab is fully in and the rail reads PROGRAMME 02. At O1 the Opportunity slab is fully in and the rail reads
   PROGRAMME 06, with 03, 04 and 05 seen in between and no jump from 02 to 06. At O2 there is no text at all.
3. Hand-off: no black dip, no flash, no size or crop jump. The doorway and figure stay put while the video starts moving. Check full
   (`?frames=full`), lite (`?frames=lite`) and a phone in portrait.
4. Reverse from the closing lines back through the hand-off to O2: clean. The closing lines hide and the canvas returns.
5. `npm run build && npm start`: no HUD.

## 6. Commits (local only, never push; docs-writer writes the messages)

1. `Hand-off frames: bake the video's first frame into the last opportunity frames (handoff-v1)` covers
   `scripts/handoff/intelligence-t0.png`, `scripts/handoff/extract-t0.html` (if created), `scripts/make-handoff-frames.mjs`,
   `package.json`, `public/frames/handoff-v1/**` and `lib/frame-sequence/sources.ts`.
2. `Step scroll: tail frames and auto-advance` covers `components/hooks/useStepScroll.ts`.
3. `Stock and Opportunity stops S2/O1/O2/O3, seamless video hand-off` covers `lib/step-scroll.ts`, `lib/forex-rail.ts`,
   `lib/market-slabs.ts`, `lib/scroll-captions.ts`, `lib/content.ts`, `components/sections/MarketSlabs.tsx`,
   `components/sections/ForexMarketScroll.tsx`, `components/sections/IntelligenceHero.tsx` and any stale test expectations updated.
4. `Plan: opportunity video hand-off` covers this file.

## 7. Decisions

- D1. Frame 240 does not match the video's first frame (diff 8.1/255; fog, exposure, watermark). The video's t = 0 frame, placed
  with the runtime `videoPlacement()` lock geometry, becomes the final canvas frame. The last 12 list frames dissolve into it
  (smoothstep weights). Output goes to the new folder `/frames/handoff-v1` through a URL override; `v1` and `/assets` stay untouched.
- D2. The runtime lock geometry stays as it is (door-measured). The bake uses the same function, so canvas and video agree by
  construction. A best fit would gain almost nothing (8.0 vs 8.1).
- D3. The hand-off is a tail stop V at REVEAL_ON, reached by an automatic glide after the O3 hold. The tail has 72 virtual frames,
  so the same speed rule gives 2.37 s. Crossfade, settle and the closing-line reveal all stay scroll-driven and reversible.
- D4. The video plays from the crossfade start (was: from its end). The canvas becomes `visibility: hidden` once fully faded.
  The poster is the video's own frame 0, so an undecoded video still looks identical.
- D5. The video arms at S2 (chain 342), not chain 480. The local mp4 comes first; CloudFront stays as the second source.
- D6. The Stock slab holds from S1 through S2 and leaves before the stock->opportunity cut. The Opportunity copy (unchanged) becomes
  a scrubbed slab in the shared engine (Cinzel, track-in on the gold line). It is fully in at O1 and fully out at s 6.5 (before O2).
- D7. The rail is stepped end to end. The Equities tag rows pass evenly in S1->S2, as Programmes 03-05 do in S2->O1. S2 owns
  Programme 02, O1 owns Programme 06. The two brand rows are dropped: the closing lines on the video and the HallmarkDial carry the
  ending, and O2 must be text-free.
- D8. F3 stays clean. The old "Programme 02 appears below F3" item is closed by D7.

## 8. Open questions

1. Should O3 -> video be **automatic** after the 0.45 s hold (planned), or need one more gesture? **Recommendation:** automatic,
   which is how the spec reads ("play to the last frame, hold briefly, then crossfade"). To switch, drop `autoAdvance`; V then
   becomes a normal next stop.
2. Should the Opportunity text move into the market style (Cinzel caps, track-in on the gold line), as planned, or keep its old
   Cormorant italic look? The scrub engine is needed either way, so that it is settled at O1 and reversible. **Recommendation:**
   Cinzel and track-in, for one consistent family across Forex, Stock and Opportunity. The copy is unchanged.
