# Plan: final-prod (Ring logo fix, frame-sequence lag fix, production hardening)

Branch `luxury-upgrade`. Next 16.3.5 (Turbopack), run everything with `corepack pnpm`. `hx` is not installed here, so design decisions are recorded in section 9 instead of `hx decision add`.

Hard rules for the coder:
- No copy changes.
- Never delete, move or overwrite anything in `public/assets/*`, `hero.png`, `public/main_logo.png` or `public/team/*`. New files go into NEW folders only.
- Transform and opacity only. All per-frame work stays on the shared gsap ticker (`lib/frame-loop.ts`).
- One commit per phase. Do not push or deploy.
- Never kill the user's dev server on :3000 (PID owns `0.0.0.0:3000`). Use port 3100 for `next start`, and stop only that PID afterwards.
- `corepack pnpm test` and `corepack pnpm build` must pass after every phase.

---

## 1. Rings of Precision: exact causes

Files: `components/art/MagicRingShowcase.tsx`, `components/MagicRings.jsx`.

The logo is `public/main_logo.png`: 1254x1254, RGB with **no alpha**, and an opaque near-white background (corner pixels 253-255). I measured the artwork: it reaches 1.047x the inscribed-circle radius at the bottom gold rules, and 2452 dark pixels lie beyond 94% of the radius.

| # | Cause | Where |
|---|---|---|
| L1 | The disc has `p-2`, and the img has `object-contain p-2.5`. The opaque white square is therefore inset 18 px (md) inside the circle and clipped by the round wrapper. The result is a white rounded square, not a circle: it touches the border only at the diagonals and leaves black gaps at N/E/S/W. `drop-shadow` adds a dark halo around the square. | `MagicRingShowcase.tsx:174` (`p-2`), `:179` (wrapper), `:184` (`object-contain p-2.5 drop-shadow-[...]`) |
| L2 | The disc is not concentric with the WebGL rings. The rings are centred on the card (canvas `absolute inset-0`, shader centre `0.5*uResolution`, `MagicRings.jsx:47`). The disc sits in a flex column together with the typography below it (`:191-202`), so its centre is about 46 px (md) above the card centre. | `MagicRingShowcase.tsx:153-158, 171, 191` |
| L3 | Drift during the scrub. The medallion gets its own scrubbed `y` (25 to -20 px) while the rings stay still. | `MagicRingShowcase.tsx:65` |
| L4 | Drift at idle. An infinite framer levitation (`y` ±6, `rotateZ`) moves the disc against the rings. It also writes `style` every frame forever, even far off-screen: I measured 60 style mutations/s while the user is inside Crypto/Forex. | `MagicRingShowcase.tsx:161-170` |
| L5 | The rings follow the mouse, so they leave the logo. `followMouse` with influence 0.25 shifts all rings by up to 0.125·min(w,h). The shader parallax `p - fi*uParallax*uMouse` (`MagicRings.jsx:59`) uses `uMouse`, which is always set (`:233`), so the outer ring moves up to about 90 px even when `followMouse` is false. | `MagicRingShowcase.tsx:125-126`; `MagicRings.jsx:59, 233-234, 96` |
| L6 | The canvas size is integer-rounded (`renderer.setSize(w,h)` writes px style from `clientWidth`), so the centre is off by up to 0.5 px on fractional card widths. | `MagicRings.jsx:168-175` |
| L7 | Performance side effect: `priority` on a `fill` image with no `sizes` preloads `main_logo` at 100vw (640-3840w srcset) in `<head>` on page load. This competes with the hero LCP and the first frames. I verified this in the prod HTML. | `MagicRingShowcase.tsx:180-186` |

---

## 2. Lag audit: measurements (prod build on :3100, headless Chrome 64-bit via raw CDP)

Harness: `docs/plans/final-prod-perf/run.mjs`, `inject.js` and `analyze.mjs` (added by this plan, see Phase 5). The test fast-scrolls down through Crypto and Forex, then back up.
- Desktop: 1440x900 DPR1, wheel events of 150 px every 16 ms, through Lenis.
- Mobile: 390x844 DPR3, touch + mobile UA, 4x CPU throttle, native scroll of 55 px per rAF.

"Lag" means |expected frame for the scroll position − frame actually on the canvas|, sampled every rAF. It includes up to one rAF of scroll since the last draw.

| Metric | Desktop down | Desktop up | Mobile 4x down | Mobile 4x up |
|---|---|---|---|---|
| rAF interval p50 / p95 / max (ms) | 16.6 / 16.8 / 82.9 | 16.6 / 16.7 / 17.9 | **33.2 / 83 / 132.7** | **33.2 / 82.9 / 116** |
| Frames >33 ms | 5 / 497 | 0 | **233 / 350** | **205 / 338** |
| Frame lag p50 / p90 / max (frames) | 4 / 14 / 36 | 6 / 15 / 49 | 5 / 16 / 31 | **21 / 31 / 33** |
| Blank canvas samples | 0 | 0 | 0 | 0 |

Other measurements:
- **createImageBitmap latency:** desktop p50 43 ms, p95 105 ms; mobile p50 130 ms, p95 197 ms.
- **Re-decodes:** 9 blobs were decoded more than twice (desktop).
- **Load phase, mobile:** long tasks of 588, 347, 258, 225, 173 and 151 ms. 130 frames were decoded before any scroll, holding 128 live bitmaps = **263 MB**.
- **Load phase, network:** 246 frame fetches (10 MB) before any scroll, on both platforms.
- **Live bitmaps, desktop:** up to 72 (about 374 MB).
- **Draw cost:** `drawImage` max 0.2 ms (desktop) and 1.9 ms (mobile). It is **not** a cause, and there are no per-frame canvas resizes (3 width sets total).
- **Load-phase LoAF, mobile:** LoAF entries of 80-126 ms with `blockingDuration` 0 and almost no attributed script. This is the signature of work Chrome does on the renderer main thread outside JS (see the decode microbenchmark below).

Decode microbenchmark (30 crypto frames, parallel, `docs/plans/final-prod-perf/decode-bench.mjs`):

| Variant | 1x throughput | 4x throughput | Main-thread cost at 4x |
|---|---|---|---|
| JPEG 1920, `createImageBitmap(blob)` (no options) | 668/s | 396/s | rAF gap 17 ms, LoAF 0 |
| JPEG 1920, crop + `resizeWidth/Height` high/medium/low (current engine) | 118-126/s | 16-24/s | **rAF gap 149-166 ms, LoAF 1.24-1.6 s** |
| WebP 1920 q80, no options | 369/s | 219/s | 0 |
| WebP 1280 q78, no options | 771/s | 497/s | 0 |
| WebP 864x1080 / 960 q75, no options | 1316/s | 733/s | 0 |
| `drawImage` of an un-resized bitmap, cover-scaled to 1440x900 or 1170x2532 | p50 0.2 ms | | |

Root causes, ranked:

| # | Root cause | Evidence | File:line |
|---|---|---|---|
| R1 | **Crop and resize in `createImageBitmap` run on the renderer main thread in Chrome.** This makes decoding 5-20x slower and blocks rAF. It is the mobile jank (30 fps, 83 ms p95) and the main reason decodes cannot keep up, so frames trail the scroll. | Microbenchmark above; mobile LoAF with no attributed script | `lib/frame-sequence/engine.ts:407-422` |
| R2 | **Every resize or body-size change re-decodes the whole window.** `resize()` always arms a 150 ms timer that does `generation++`, so every bitmap becomes stale (`bitmapGen !== generation`) and is re-decoded. `measure()` observes `document.body`, which changes size whenever anything below loads or reflows. | redecode count 9 | `engine.ts:157-165, 321`; `components/hooks/useFrameSequence.ts:141-145` |
| R3 | **Fixed decode window, not velocity-aware.** The window is a fixed 65/35 ahead/behind split with at most 3 decodes in flight. During a fast scrub the window is exhausted and frames are shown 14-49 frames late, then "catch up". That is the rubber-band lag. | lag p90 14-31 | `engine.ts:100, 307-317` |
| R4 | **Memory budget is too high on phones and per engine.** Unknown `deviceMemory` (iOS Safari, Firefox) is treated as 4 GB, giving 256 MB. Crypto and Forex budgets add up during the overlap. Crypto decodes its full window during hydration (decode IO margin 100%, and Crypto sits one screen below the hero). | 263 MB live at load on mobile | `math.ts:161-167`; `engine.ts:250-251`; `useFrameSequence.ts:163` |
| R5 | **Off-screen infinite animation.** The framer levitation in the ring showcase forces a style write and recalc every frame site-wide. | 120 mutations / 2 s; 3.5k style recalcs per run | `MagicRingShowcase.tsx:161-170` |
| R6 | **Retries without backoff.** Failed fetches are retried immediately, up to 2 times, then the frame is lost. There is no pause while the tab is hidden. | | `engine.ts:354-362` |
| R7 | **Production caching.** Public files are served `Cache-Control: public, max-age=0` (measured on `next start`; Vercel's default for `public/` is `max-age=0, must-revalidate`). Every repeat visit revalidates 960 frames. | `curl -I /assets/crypto/ezgif-frame-001.jpg` | `next.config.ts` (no `headers()`) |
| R8 | **Too many full-size pinned frames.** Forex pins 6 frames, which are decoded at load and never evicted (50 MB at 1920). | | `components/sections/ForexMarketScroll.tsx:64` |

Checked and not causes: draw cost (0.2 ms), canvas resize per frame (none), Lenis wiring (single ticker, correct order), long tasks during scroll on desktop (0), ForexFade, SectionSeam and PaletteBackdrop scrubs (style recalc average 0.19 ms), and network latency (frame p95 9-17 ms locally).

---

## 3. Frame asset sizes (measured by encoding every 8th frame of all 4 sequences, 120 samples, sharp 0.35)

| Set | Average per frame | Estimate for 960 frames | Decision |
|---|---|---|---|
| Current JPEG 1920x1080 (`public/assets`) | 33.8 KB | 31.7 MB (34 MB on disk) | keep as the `full` tier and as the fallback |
| WebP 1920 q80 | 36.5 KB | 34.2 MB | **not shipped.** It is larger than the JPEGs (they are already heavily compressed) and decodes 2x slower. |
| WebP 1280x720 q78 (`lite`) | 21.8 KB | 20.4 MB | ship |
| WebP 864x1080 q78, centre crop (`portrait`) | 18.2 KB | 17.0 MB | ship |
| WebP 960 q75 | 12.9 KB | 12.1 MB | not shipped. In portrait it only has 540 px of height, half the current vertical detail. |
| AVIF 1920 q55 | 24.6 KB | 23.0 MB | not shipped. Encoding takes about 1 s per frame, and the gain is small vs `lite`. |

The new sets total about 37.4 MB in the repo. Per-visitor transfer: portrait phones get 17.0 MB (-46%), small or constrained landscape screens get 20.4 MB (-36%), and desktop >1408 backing px stays at 31.7 MB. After the first visit, everything is served from cache (immutable).

**Portrait set framing math:** the `portrait` set is `extract({left:528, top:0, width:864, height:1080})` of each 1920x1080 frame. For any viewport with aspect ≤ 0.8, the cover-fit is height-limited, so the visible region and scale are identical to cover-fitting the 1920 frame. The Forex-to-video hand-off geometry (`lib/frame-sequence/handoff.ts`, which assumes a 1920x1080 centred cover) therefore stays valid. The `lite` set has the same 16:9 aspect, so its framing is also identical.

---

## Phase 1: Ring of Precision (commit: "Ring of Precision: concentric logo medallion, locked rings, WebGL fallback")

### 1a. `components/art/MagicRingShowcase.tsx`

**Imports:**
- Remove `motion` from `framer-motion`.
- Add `useDeviceTier` from `@/lib/device-tier`.
- Add `RingsErrorBoundary` from `./RingsErrorBoundary`.
- Add `StaticRings` from `./StaticRings`.

**Refs, state and timeline:**
- Delete `medallionRef` (`:30`).
- In `useGSAP`: delete the `med` variable and its guard, and delete `keyframes(tl, med, 'y', ...)` (`:65`). Keep all card and aura keyframes unchanged.
- Add state: `const tier = useDeviceTier(); const [ringsFailed, setRingsFailed] = useState(false); const staticRings = tier === 'static' || ringsFailed;`

**Ring layer (`:113-130`).** Replace with:
```tsx
<div className="absolute inset-0 z-0">
  {staticRings ? <StaticRings /> : nearViewport && (
    <RingsErrorBoundary fallback={<StaticRings />}>
      <MagicRings color="#D4AF37" colorTwo="#FAF1DE" ringCount={7} speed={0.8} lineThickness={2.3}
        baseRadius={0.3} radiusStep={0.088} scaleRate={0.08} attenuation={10.5} ringGap={1.42}
        followMouse={false} parallax={0} hoverScale={1.14} clickBurst={true}
        maxDpr={tier === 'low' ? 1.5 : 2} onUnavailable={() => setRingsFailed(true)} />
    </RingsErrorBoundary>
  )}
</div>
```
`followMouse={false}` and `parallax={0}` lock the rings concentric. Hover scale and click burst scale about the centre, so they stay concentric.

**Medallion block (`:152-204`).** Replace with the structure below. The disc is the only in-flow child of an `inset-0` flex box, so it sits exactly at the card centre, which is also the canvas centre. The typography is absolutely positioned under it. Keep the text spans and their classes exactly as they are now.
```tsx
<div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none">
  {/* Medallion disc: exact card centre = ring centre */}
  <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-full shadow-[0_0_60px_rgba(212,175,55,0.5)] transition-transform duration-500 group-hover:scale-105">
    {/* White face fills the circle; edge sits under the rim */}
    <div className="absolute inset-[1px] rounded-full overflow-hidden [clip-path:circle(50%)] bg-[#FEFEFE]">
      <div className="absolute inset-[5%]">
        <Image src="/main_logo.png" alt="Master of Pipsology Official Insignia" fill
          sizes="(min-width: 768px) 176px, (min-width: 640px) 144px, 112px" quality={90}
          className="object-contain" />
      </div>
    </div>
    {/* Gold rim on top: crisp, concentric. #AA8C2C = #D4AF37 @80% over the old black disc */}
    <div aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-[#AA8C2C] shadow-[inset_0_0_12px_rgba(212,175,55,0.45)] pointer-events-none" />
    {/* Inner bezel hairline (was :176) */}
    <div aria-hidden="true" className="absolute inset-1.5 rounded-full border border-[#D4AF37]/30 pointer-events-none" />
  </div>
  {/* Typography below the disc: 50% + disc radius + 1.5rem */}
  <div className="absolute inset-x-0 top-[calc(50%_+_5rem)] sm:top-[calc(50%_+_6rem)] md:top-[calc(50%_+_7rem)] px-4 text-center">
    {/* the existing two <span>s and the two-rule <div>, unchanged (from :192-201) */}
  </div>
</div>
```
Notes on this structure:
- The `inset-[5%]` box scales the art to 90% of the disc. The art's maximum extent of 1.047 R then becomes 0.94 R, so nothing is clipped. The logo's own white background blends into `#FEFEFE`.
- No `priority` and no `drop-shadow`. Delete the `<motion.div>` levitation entirely.
- Vertical fit, checked: 440 px card gives 220+56+24 = 300 → text ends about 400 px. 620 px card gives 310+88+24 = 422 → text ends about 532 px.

### 1b. `components/MagicRings.jsx`
- New props: `maxDpr = 2` and `onUnavailable` (optional). Store `onUnavailable` in a ref (`unavailableRef.current = onUnavailable` on every render), so the effect deps stay `[]`.
- Call `unavailableRef.current?.()`:
  - in the `catch` of `new THREE.WebGLRenderer` (`:122`);
  - in the `!isWebGL2` branch (`:126`);
  - from a `webglcontextlost` listener on `renderer.domElement`. That listener calls `tryStop()` and then `onUnavailable`. Remove the listener in cleanup.
- `resize()` (`:168-175`):
  ```js
  const dpr = Math.min(window.devicePixelRatio || 1, propsRef.current.maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  uniforms.uResolution.value.set(Math.round(w * dpr), Math.round(h * dpr));
  ```
  Use `const w = mount.clientWidth || 1; const h = mount.clientHeight || 1;`. Add `maxDpr` to `propsRef.current`.
- `components/MagicRings.css`: append `.magic-rings-container canvas { display: block; width: 100%; height: 100%; }`. The canvas then fills the box exactly and its centre is the card centre (fixes L6).

### 1c. New `components/art/RingsErrorBoundary.tsx`
```tsx
'use client';
import React from 'react';
interface Props { fallback: React.ReactNode; children: React.ReactNode }
export class RingsErrorBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  componentDidCatch(): void { /* WebGL or chunk-load failure: static rings are shown */ }
  render(): React.ReactNode { return this.state.failed ? this.props.fallback : this.props.children; }
}
```

### 1d. New `components/art/StaticRings.tsx` (server-safe, no 'use client' needed)
Draw an SVG with the same geometry as the shader. The radius is in units of min(w,h): `viewBox="-50 -50 100 100"` with `preserveAspectRatio="xMidYMid meet"`, so 1 unit = min(w,h)/100.
```tsx
export function StaticRings(): React.ReactElement {
  const rings = Array.from({ length: 7 }, (_, i) => i);
  return (
    <svg aria-hidden="true" className="absolute inset-0 w-full h-full overflow-visible" viewBox="-50 -50 100 100" preserveAspectRatio="xMidYMid meet">
      {rings.map((i) => (
        <circle key={i} cx={0} cy={0} r={30 + i * 8.8} fill="none"
          stroke={i < 3 ? '#D4AF37' : '#E8D7A8'} strokeWidth={0.35} strokeOpacity={0.6 - i * 0.07} />
      ))}
    </svg>
  );
}
```

### Phase 1 acceptance
- The logo face is a full circle, edge to edge under the gold rim, with no black gaps and no square corners. Check at widths 375, 640, 768, 1024, 1440 and 1920.
- In DevTools, the medallion `getBoundingClientRect()` centre equals the ring canvas centre to within 0.5 px, at scroll progress 0, 0.5 and 1 of the section, and while the cursor moves over the card.
- No `<link rel="preload">` for `main_logo` with `imageSizes="100vw"` in the prod HTML: `curl -s localhost:3100/ | grep -c 'main_logo.png&amp;w=3840'` → 0.
- With `prefers-reduced-motion` emulated, the static SVG rings render. When the WebGL context is lost (`WEBGL_lose_context` in the console), the static rings replace the canvas.
- In the probe from section 2 (MutationObserver over 2 s while parked mid-Crypto), the `div.flex.flex-col [style]` entry is gone.

---

## Phase 2: Frame engine decode path (commit: "Frame engine: off-main-thread decode, velocity-aware window, shared memory budget, backoff")

### 2a. `lib/frame-sequence/math.ts`
Keep all existing exports and behaviour (the existing tests must still pass unchanged). Add or extend the following:
```ts
/** EMA of frame velocity (frames/s). dtSec <= 0 returns prev. Snaps to 0 below 0.5 f/s. */
export function frameVelocity(prev: number, deltaFrames: number, dtSec: number): number {
  if (!(dtSec > 0)) return prev;
  const inst = deltaFrames / Math.max(dtSec, 1 / 240);
  const a = 1 - Math.exp(-dtSec / 0.1);
  const v = prev + (inst - prev) * a;
  return Math.abs(v) < 0.5 ? 0 : v;
}

/** Split a decode window of `windowSize` bitmaps into ahead/behind (in scroll direction), velocity-aware. */
export function lookahead(speed: number, windowSize: number, horizonSec = 0.5, minAhead = 6): { ahead: number; behind: number } {
  const w = Math.max(2, Math.floor(windowSize));
  const want = Math.max(Math.ceil(w * 0.55), Math.round(Math.abs(speed) * horizonSec), minAhead);
  const ahead = Math.min(w - 2, want);
  return { ahead, behind: w - ahead };
}

/** Decode every Nth frame ahead when the window cannot cover `horizonSec` of travel. 1..4. */
export function decodeStride(speed: number, ahead: number, horizonSec = 0.5): number {
  return clamp(Math.ceil((Math.abs(speed) * horizonSec) / Math.max(1, ahead)), 1, 4);
}

/** Fetch retry backoff: 500, 1000, 2000, 4000, then 8000 ms max. attempt >= 1. */
export function retryDelayMs(attempt: number): number {
  return Math.min(8000, 500 * 2 ** Math.max(0, attempt - 1));
}
```
Signature changes. All new parameters have defaults, so the old calls behave as before:
- `pickNextFetch(state, pinned, current, dir, nearWindow, full, warm: readonly number[] = [], notBefore?: ArrayLike<number>, now = 0)`. Skip any `i` where `notBefore && notBefore[i] > now`, both in the pinned loop and in the main loop. Order: pinned idle, then `warm` idle (in the given order), then `if (!full) return -1`, then the existing min-score scan.
- `pickNextDecode(needs, pinned, current, dir, lo, hi, stride = 1)`. Pinned first, as now. If `stride > 1`, first run the same distance loop but accept only `idx % stride === 0`. Then run the existing loop unchanged.
- `bitmapBudget(bitmap: Size, deviceMemoryGB: number | undefined, total: number, coarsePointer = false)`:
  ```ts
  let mb = deviceMemoryGB === undefined ? (coarsePointer ? 160 : 256) : deviceMemoryGB >= 8 ? 384 : deviceMemoryGB >= 4 ? 256 : 128;
  if (coarsePointer) mb = Math.min(mb, 192);
  ```
  The rest is unchanged: min 16, max min(total, 240).

### 2b. `lib/frame-sequence/engine.ts`
**Remove:** `coverCrop` usage, `crop`, `generation`, `bitmapGen`, `probing`, `probe()`, `resizeSupported`, `resizeTimer`, `RESIZE_DEBOUNCE_MS` and `refreshTargets()`.

**New options:**
```ts
export interface FrameSequenceEngineOptions {
  urls: readonly string[];
  /** Same length as urls (e.g. original JPEGs). Used per frame on 404, or for the whole set if the very first decode fails (format unsupported). */
  fallbackUrls?: readonly string[] | null;
  pinned: readonly number[];
  /** Fetched right after pinned on start(), before the IO-triggered full fetch. */
  warm?: readonly number[];
  background: string;
  /** Bitmap size expected before the first decode (initial canvas backing and memory budget). Default 1920x1080. */
  expectedSize?: Size;
  maxConcurrentFetches?: number;   // default 6
  maxConcurrentDecodes?: number;   // default clamp(Math.floor(hc / 2), 2, 4)
  nearWindow?: number;             // default 24
  onFrameReady?: (index: number) => void;
}
```

**Module scope:**
- `const MAX_RETRIES = 4;`
- `class HttpError extends Error { constructor(readonly status: number) { super(`HTTP ${status}`); } }`. Use a normal field assignment, not a parameter property, if the TS config complains. A parameter property is fine here because `engine.ts` is not loaded by `node --test`.
- `const enabledEngines = new Set<FrameSequenceEngine>();`

**New private fields:**
- `urls: readonly string[]` (mutable reference), `fallbackUrls`, `perFrameFallback: Uint8Array`, `usingFallback = false`, `decodedAny = false`, `epoch = 0`.
- `warm`, `retryAt: Float64Array`, `retryTimer`, `paused = false`.
- `velocity = 0`, `lastUpdateMs = -1`, `liveCount = 0`, `expected: Size`.
- `coarse = matchMedia('(pointer: coarse)').matches` (guard `typeof window`), `mem = navigator.deviceMemory`.

**Behaviour:**
1. **`resize(cssW, cssH, dpr)`:** store css and dpr, call `applyCanvasSize()`. No timer and no re-decode. `applyCanvasSize` uses `this.src ?? this.expected`.
2. **`update(frame)`:**
   - `const now = performance.now(); if (this.lastUpdateMs >= 0) this.velocity = frameVelocity(this.velocity, f - this.current, (now - this.lastUpdateMs) / 1000); this.lastUpdateMs = now;`
   - Mark `dirty` when `f !== current`, or when `Math.abs(this.velocity) > 1` (so the window rebalances as speed decays).
   - The draw logic is unchanged.
3. **`setDecodeEnabled(on)`:** add this engine to `enabledEngines` (on) or remove it (off). Then call `markDirty()` on every engine in `enabledEngines`, so the budgets re-split. Add public `markDirty(): void { this.dirty = true; this.schedulePump(); }`.
4. **`setPaused(p: boolean)`:** set `this.paused = p`; if `!p`, call `schedulePump()`. A paused engine starts no new fetches or decodes.
5. **`effectiveBudget()`:** `Math.max(16, Math.floor(this.budget / Math.max(1, enabledEngines.size)))`, where `this.budget = bitmapBudget(this.src ?? this.expected, this.mem, this.total, this.coarse)`. Recompute it on the first decode, when the size becomes known.
6. **`pump()`:**
   ```ts
   const now = performance.now();
   if (this.started && !this.paused) while (this.inflightFetches < this.maxFetches) {
     const i = pickNextFetch(this.fetchState, this.pinned, this.current, this.dir, this.nearWindow, this.fullFetch, this.warm, this.retryAt, now);
     if (i < 0) break; this.startFetch(i);
   }
   if (this.paused) return;
   let lo = 1, hi = 0, stride = 1, w = 0;
   if (this.decodeEnabled) {
     w = Math.max(8, this.effectiveBudget() - this.pinned.length);
     const speed = Math.abs(this.velocity);
     const { ahead, behind } = lookahead(speed, w);
     stride = decodeStride(speed, ahead);
     [lo, hi] = decodeWindow(this.current, this.dir, this.total, ahead * stride, behind);
     let live = 0;
     for (let i = 0; i < this.total; i++) {
       if (!this.hasBitmap[i] || this.isPinned[i]) continue;
       if (i < lo || i > hi) this.releaseBitmap(i); else live++;
     }
     this.liveCount = live;
   }
   for (let i = 0; i < this.total; i++)
     this.needs[i] = this.fetchState[i] === FETCH_READY && !this.decoding[i] && !this.hasBitmap[i] ? 1 : 0;
   while (this.inflightDecodes < this.maxDecodes) {
     const i = pickNextDecode(this.needs, this.pinned, this.current, this.dir, lo, hi, stride);
     if (i < 0) break;
     if (!this.isPinned[i] && this.liveCount + this.inflightDecodes >= w && !this.evictFarther(i)) break;
     this.needs[i] = 0; this.startDecode(i);
   }
   ```
   `evictFarther(i)` uses `score(j) = |j - current|`, doubled when `j` is behind the direction. Over decoded, non-pinned `j`, find the max score. If it is greater than `score(i)`, call `releaseBitmap(j)`, decrement `liveCount` and return true. Otherwise return false.
7. **`startDecode(i)`:** always call `createImageBitmap(blob)` with **no options and no crop**. Add a comment citing R1. Capture `const epoch = this.epoch`.
   - On success: if destroyed, the epoch is stale, or (`!decodeEnabled && !pinned`), close the bitmap and return. Otherwise set `decodedAny = true`. If `!this.src`, set `this.src = {w: bmp.width, h: bmp.height}`, call `applyCanvasSize()` and recompute the budget. Then store the bitmap, set `hasBitmap`, `liveCount++` if not pinned, close any old bitmap (clear `lastDrawn` if it was the old one), and call `onFrameReady(i)`.
   - On failure: if `!decodedAny && !usingFallback && fallbackUrls`, call `switchToFallback()`. Else if `fallbackUrls && !perFrameFallback[i]`, set `perFrameFallback[i] = 1`, `blobs[i] = null`, `fetchState[i] = FETCH_IDLE`. Else set `fetchState[i] = FETCH_FAILED`.
   - `finally`: `decoding[i] = 0; inflightDecodes--; dirty = true; schedulePump()`. Always run this, even when the epoch is stale.
8. **`startFetch(i)`:**
   - `const url = this.perFrameFallback[i] && this.fallbackUrls ? this.fallbackUrls[i] : this.urls[i];` and capture the epoch.
   - `fetch(url, { signal, cache: 'force-cache', priority } as RequestInit)`. When the response is not ok, `throw new HttpError(res.status)`.
   - On success with a current epoch: store the blob and set `READY`.
   - `catch`: return on abort, destroyed or a stale epoch. Otherwise `const s = err instanceof HttpError ? err.status : 0`.
     - If `s === 404 && this.fallbackUrls && !this.perFrameFallback[i]`: set `perFrameFallback[i] = 1` and `fetchState[i] = FETCH_IDLE`. This is the immediate per-frame fallback.
     - Else if `(s === 0 || s === 408 || s === 429 || s >= 500) && retries[i] < MAX_RETRIES`: `retries[i]++`, `retryAt[i] = performance.now() + retryDelayMs(retries[i])`, `fetchState[i] = FETCH_IDLE`, `scheduleRetry(retryAt[i])`.
     - Else set `FAILED`.
   - `finally`: `inflightFetches--; dirty = true; schedulePump()`.
9. **`scheduleRetry(at)`:** keep a single `setTimeout` for the earliest `at`. When it fires, clear the timer and call `markDirty()`. Clear the timer in `destroy()`.
10. **`switchToFallback()`:** `usingFallback = true; epoch++; urls = fallbackUrls!`. Fill `fetchState`, `retries`, `retryAt` and `perFrameFallback` with 0, and `blobs` with null. Release every bitmap, including pinned ones. Set `src = null`, `liveCount = 0`, then `markDirty()`.
11. **`destroy()`:** also `enabledEngines.delete(this)` and clear `retryTimer`.

### 2c. `components/hooks/useFrameSequence.ts` (Phase 2 part; Phase 3 changes the URL API)
- Pass `expectedSize: { w: 1920, h: 1080 }` and `warm` (new option `warm?: readonly number[]`, passed through) to the engine.
- Visibility: `const onVis = (): void => engine.setPaused(document.hidden); onVis(); document.addEventListener('visibilitychange', onVis);` Remove it in cleanup.
- `measure()` is unchanged: keep the `document.body` RO. It is cheap now that resize does not re-decode.

### 2d. Sections
- `CryptoMarketScroll.tsx`: `warm: CRYPTO_WARM` with `const CRYPTO_WARM = warmIndices(240)`. Until Phase 3 adds `warmIndices`, inline `Array.from({length:24},(_,i)=>i).concat(Array.from({length:27},(_,k)=>24+k*8))`.
- `ForexMarketScroll.tsx:64`: `const PINNED = [0, 719] as const;` (R8). Add `prefetchMargin: '400% 0px 400% 0px'` so the Forex fill starts while the user is in Crypto.

### 2e. Tests: append to `tests/frame-sequence-math.test.mjs` (import the new functions)
- `frameVelocity`: 30 iterations of `(v, 4, 1/60)` from 0 gives a value within 5% of 240. `frameVelocity(240, 0, 1)` → 0. `frameVelocity(7, 3, 0)` → 7.
- `lookahead(0, 16)` → `{ahead: 9, behind: 7}`. `lookahead(300, 16)` → `{ahead: 14, behind: 2}`. `lookahead(0, 40)` → `{ahead: 22, behind: 18}`. For w in [8, 16, 53], `ahead + behind === w`.
- `decodeStride(0, 14)` → 1, `(300, 14)` → 4, `(40, 20)` → 1, `(100, 20)` → 3.
- `retryDelayMs`: 1→500, 2→1000, 3→2000, 5→8000, 10→8000.
- `pickNextFetch` with backoff: state `Uint8Array(10)`, `notBefore` with index 0 at 1000, now 500, pinned [0], full false, warm [] → -1. With warm [5] → 5. With now 1500 → 0.
- `pickNextDecode` with stride: needs 1 for 10..30 (length 40), `(needs, [], 10, 1, 10, 30, 4)` → 12. When needs on multiples of 4 are 0 → 10.
- `bitmapBudget({w:864,h:1080}, undefined, 240, true)` → 44. `({w:864,h:1080}, 8, 240, true)` → 53. `({w:1920,h:1080}, 8, 240)` → 48. `({w:1920,h:1080}, 4, 240)` → 32. The existing asserts stay unchanged.

### Phase 2 acceptance
- `corepack pnpm test` passes.
- The section 2 harness on the prod build (still JPEG) shows:
  - desktop rAF p95 ≤ 17 ms, frame lag p50 ≤ 2, p90 ≤ 6, max ≤ 20, 0 blank;
  - mobile 4x rAF p50 ≤ 17.5 ms, p95 ≤ 34 ms, lag p50 ≤ 6, p90 ≤ 12, 0 blank;
  - no LoAF > 50 ms during the scroll phases on either profile;
  - mobile live bitmap MB ≤ 220 at any time.

---

## Phase 3: Production frame sets and sources (commit: "Frames: WebP lite/portrait sets, tiered sources, early first frame")

### 3a. New `scripts/make-frames.mjs` (+ `package.json` script `"frames": "node scripts/make-frames.mjs"`)
- **Inputs:** `public/assets/{crypto,forex,stock_market,opportunity}/ezgif-frame-001..240.jpg`. Assert there are exactly 240 per folder and that each is 1920x1080 (sharp `metadata()` on the first and last), else exit 1.
- **Outputs**, versioned and new only. Never write inside `public/assets`.
  - `public/frames/v1/<seq>/1280/NNN.webp`: `sharp(src).resize({ width: 1280, kernel: 'lanczos3' }).webp({ quality: 78, effort: 5, smartSubsample: true })`.
  - `public/frames/v1/<seq>/p1080/NNN.webp`: `sharp(src).extract({ left: 528, top: 0, width: 864, height: 1080 }).webp({ quality: 78, effort: 5, smartSubsample: true })`.
  - `NNN` is a 3-digit, 1-based number (`001`..`240`).
- Skip existing files unless `--force`. Use a worker pool of `os.availableParallelism()` concurrent sharp jobs.
- At the end, write `public/frames/v1/manifest.json` as `{ version: 'v1', generated: ISO, sets: { '1280': { w:1280, h:720, count:960, bytes }, 'p1080': { w:864, h:1080, count:960, bytes } } }`. Print totals.
- **Verify:** count 960 per set, and spot-check the dimensions of the first and last outputs. Exit 1 on mismatch.
- Expected result: about 20.4 MB (1280) and about 17.0 MB (p1080), roughly 60-120 s on 8 cores.
- Run `corepack pnpm frames` and commit `public/frames/v1/**`. These are static deploy assets, deliberately committed (decision D6).

### 3b. New `lib/frame-sequence/sources.ts`
Pure, with **no imports** and only erasable TS (it is loaded by `node --test`). Window access happens only inside functions.
```ts
export type FrameTier = 'full' | 'lite' | 'portrait';
export type SeqName = 'crypto' | 'forex' | 'stock_market' | 'opportunity';
export const FRAME_SET_VERSION = 'v1';          // bump + new folder when frames change (cache busting)
export const FRAMES_PER_SEQ = 240;
export const PORTRAIT_MAX_ASPECT = 0.8;          // 864/1080
export const LITE_MAX_BACKING_W = 1408;
export const TIER_SIZE: Record<FrameTier, { w: number; h: number }> = {
  full: { w: 1920, h: 1080 }, lite: { w: 1280, h: 720 }, portrait: { w: 864, h: 1080 },
};
const pad3 = (i: number): string => String(i + 1).padStart(3, '0');
export function jpegFrameUrl(seq: SeqName, i: number): string { return `/assets/${seq}/ezgif-frame-${pad3(i)}.jpg`; }
export function frameUrl(seq: SeqName, i: number, tier: FrameTier): string {
  if (tier === 'full') return jpegFrameUrl(seq, i);
  return `/frames/${FRAME_SET_VERSION}/${seq}/${tier === 'portrait' ? 'p1080' : '1280'}/${pad3(i)}.webp`;
}
export interface FrameSet { urls: string[]; fallback: string[] | null; expected: { w: number; h: number } }
export function buildFrameSet(seqs: readonly SeqName[], tier: FrameTier, perSeq: number = FRAMES_PER_SEQ): FrameSet { /* concat in order; fallback = jpeg urls when tier !== 'full', else null */ }
export interface TierInput { cssW: number; cssH: number; dpr: number; coarsePointer?: boolean; saveData?: boolean; effectiveType?: string; deviceMemoryGB?: number }
export function chooseFrameTier(i: TierInput): FrameTier {
  if (i.cssH > 0 && i.cssW / i.cssH <= PORTRAIT_MAX_ASPECT) return 'portrait';
  if (i.saveData || i.coarsePointer || (i.deviceMemoryGB !== undefined && i.deviceMemoryGB < 4)
      || i.effectiveType === 'slow-2g' || i.effectiveType === '2g' || i.effectiveType === '3g') return 'lite';
  return i.cssW * Math.min(i.dpr || 1, 2) <= LITE_MAX_BACKING_W ? 'lite' : 'full';
}
export function detectFrameTier(): FrameTier { /* typeof window guard → 'full'; read innerWidth/innerHeight, devicePixelRatio, matchMedia('(pointer: coarse)'), navigator.connection?.saveData/effectiveType, navigator.deviceMemory */ }
/** 0..head-1 then every `stride`th frame after, sorted, unique. */
export function warmIndices(total: number, head = 24, stride = 8): number[] { /* ... */ }
/** Starts the first frame download as early as the client chunk evaluates. Same URL the engine will request. */
export function warmFirstFrame(seq: SeqName): void {
  if (typeof window === 'undefined') return;
  fetch(frameUrl(seq, 0, detectFrameTier()), { cache: 'force-cache', priority: 'high' } as RequestInit).catch(() => {});
}
```
Notes:
- No WebP feature detection is needed. The engine switches the whole set to the JPEG `fallback` if the very first decode fails, and falls back per frame on a 404.
- `warmFirstFrame` may duplicate one request only if WebP is unsupported. That costs about 20 KB, and only on very old Safari.

### 3c. `components/hooks/useFrameSequence.ts`
- **Replace** the option `sources: readonly FrameSource[]` with `urlsFor: (tier: FrameTier) => FrameSet`, and delete the `FrameSource` interface.
- **Engine creation:** inside the effect, call `const tier = detectFrameTier(); const set = optsRef.current.urlsFor(tier);`, then create the engine with `urls: set.urls`, `fallbackUrls: set.fallback`, `expectedSize: set.expected`, `warm: optsRef.current.warm ?? []` and `pinned`.
- **Re-create on orientation or tier flip:**
  ```ts
  const [tierEpoch, setTierEpoch] = useState(0);
  useEffect(() => { const mq = window.matchMedia('(max-aspect-ratio: 4/5)'); const on = (): void => setTierEpoch((e) => e + 1); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }, []);
  ```
  The main effect's deps become `[tierEpoch]` (eslint: add `tierEpoch` to the deps). Cleanup already destroys the engine. The HTTP cache makes the re-fetch near-free.

### 3d. Sections
- **`CryptoMarketScroll.tsx`:**
  - Delete `getFrameSrc` and `SOURCES`.
  - Add `const urlsFor = (tier: FrameTier): FrameSet => buildFrameSet(['crypto'], tier);`, `const PINNED = [0, 239] as const;` and `const CRYPTO_WARM = warmIndices(240);`.
  - In the existing `typeof window` block, also call `warmFirstFrame('crypto')`.
  - Pass `urlsFor` and `warm: CRYPTO_WARM` to the hook.
- **`ForexMarketScroll.tsx`:**
  - Delete `getForexSrc`, `getStockSrc`, `getOpportunitySrc`, the `getSrc` field of `SeqInfo` and the `SEQUENCES` entries, and `SOURCES`.
  - Add `const urlsFor = (tier: FrameTier): FrameSet => buildFrameSet(['forex', 'stock_market', 'opportunity'], tier);` and pass it to the hook.
  - Keep `resolveSeq`, the labels and every overlay unchanged.

### 3e. Tests: new `tests/frame-sources.test.mjs` (imports `../lib/frame-sequence/sources.ts`)
- `frameUrl('crypto', 0, 'full')` === `/assets/crypto/ezgif-frame-001.jpg`
- `frameUrl('stock_market', 239, 'lite')` === `/frames/v1/stock_market/1280/240.webp`
- `frameUrl('forex', 9, 'portrait')` === `/frames/v1/forex/p1080/010.webp`
- `buildFrameSet(['forex','stock_market','opportunity'], 'portrait')`:
  - `urls.length` is 720;
  - `urls[240]` === `/frames/v1/stock_market/p1080/001.webp`;
  - `fallback[240]` === `/assets/stock_market/ezgif-frame-001.jpg`;
  - `expected` deepEquals `{w:864,h:1080}`.
- `buildFrameSet(['crypto'], 'full').fallback === null`, and `urls.length === 240`.
- `chooseFrameTier`:

  | Input | Result | Note |
  |---|---|---|
  | {390,844,3} | portrait | |
  | {768,1024,2} | portrait | |
  | {1440,900,1} | full | |
  | {1366,768,1} | lite | |
  | {1280,800,2} | full | |
  | {1440,900,2, saveData:true} | lite | |
  | {1920,1080,1, effectiveType:'3g'} | lite | |
  | {1920,1080,1, deviceMemoryGB:2} | lite | |
  | {844,390,3, coarsePointer:true} | lite | landscape phone |
  | {1024,1280,2} | portrait | exactly 0.8 |

- `warmIndices(240)`: length 51, first 0, includes 23, 24, 32 and 232, excludes 25, strictly increasing.

### Phase 3 acceptance
- `corepack pnpm frames` prints 960 + 960 files. `find public/frames/v1 -name '*.webp' | wc -l` → 1920. `git status` shows no change under `public/assets`.
- Tests and build pass.
- In the mobile harness, Network shows only `/frames/v1/*/p1080/*.webp` frame requests. In the desktop 1440x900 DPR1 harness, it shows only `/assets/*.jpg`. A desktop run at 1366x768 shows `/frames/v1/*/1280/*.webp`.
- Rename one `.webp` temporarily on the 3100 server copy (or block the URL via DevTools request blocking). The JPEG for that frame loads, and nothing goes blank.
- The mobile harness meets the Phase 2 targets and additionally: lag p90 ≤ 10, live bitmap MB ≤ 200, frame transfer ≤ 18 MB.

---

## Phase 4: Production hardening (commit: "Prod: immutable caching, security headers, image config, icons, sitemap, fallbacks")

### 4a. `next.config.ts`
Read `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` first. Headers apply to `/public` files, and Next ignores custom Cache-Control on `/_next/static` (already immutable).
```ts
const IMMUTABLE = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];
const SECURITY = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    qualities: [75, 85, 90],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    formats: ['image/webp'],            // D9: no AVIF first-request encode latency on the LCP hero
    minimumCacheTTL: 604800,
    localPatterns: [
      { pathname: '/_next/static/media/**', search: '' },
      { pathname: '/main_logo.png', search: '' },
      { pathname: '/team/**', search: '' },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY },
      { source: '/assets/:path*', headers: IMMUTABLE },      // original frames: never edit in place
      { source: '/frames/:path*', headers: IMMUTABLE },      // versioned (v1, v2...)
      { source: '/textures/:path*', headers: IMMUTABLE },
      { source: '/hero/:path*', headers: IMMUTABLE },
      { source: '/intelligence-layer.mp4', headers: IMMUTABLE },
      { source: '/brand/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }] },
      { source: '/team/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
    ];
  },
};
```
Do not set Cache-Control for HTML. Next and Vercel handle prerendered pages, and each deploy invalidates them.

Cache-busting rule: put a comment at the top of `headers()` and in `docs/FRAME_QUALITY.md`: "Files under /assets, /frames, /textures and /hero are immutable for one year. Never replace a file in place: write a new folder (e.g. /frames/v2) and bump FRAME_SET_VERSION."

### 4b. `scripts/make-derivatives.mjs`: add outputs (same `shouldWrite` skip logic)
- `public/brand/icon-192.png`, `public/brand/icon-512.png` and `public/brand/apple-icon-180.png`: `sharp('public/main_logo.png').resize(N, N, { kernel: 'lanczos3' }).png({ compressionLevel: 9 })`.
- `public/hero/hero-master-3840.jpg`: `sharp('hero.png', { limitInputPixels: false }).resize({ width: 3840, kernel: 'lanczos3', withoutEnlargement: true }).jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' })`.

Run `corepack pnpm derivatives` and commit the 4 new files.

### 4c. `components/sections/Hero.tsx:11`
Change `import heroImg from '@/hero.png';` to `import heroImg from '@/public/hero/hero-master-3840.jpg';`. The rendering is identical: the optimizer never outputs more than 3840 px (the largest deviceSize), and the aspect ratio and objectPosition are unchanged. The 20 MB PNG is then no longer bundled into `.next/static/media`, and no longer decoded on a cold image-optimizer cache. Keep `hero.png` on disk.

### 4d. `app/layout.tsx`
- `:26-29` icons become `{ icon: [{ url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' }], apple: '/brand/apple-icon-180.png' }`. The current icon is the 1.7 MB `main_logo.png`.
- `:66`: `images: ['/og-image.jpg']`. `/og-image.png` does not exist, so the Twitter card is currently broken.

### 4e. New `app/sitemap.ts`
`public/robots.txt` references `/sitemap.xml`, which currently returns 404. Follow `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md`:
```ts
import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://masterofpipsology.com';
  return [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/intelligence`, changeFrequency: 'monthly', priority: 0.6 },
  ];
}
```

### 4f. `app/page.tsx`
- `:124` becomes `{process.env.NODE_ENV !== 'production' && <LongTaskProbe />}`. The dev probe is then compiled out of prod.

### 4g. `components/sections/IntelligenceHero.tsx:79-82`
Add a second source after the CloudFront one:
```tsx
<source src="/intelligence-layer.mp4" type="video/mp4" />
```
I verified this local file is byte-identical to the CloudFront video (same MD5/ETag `919933bd44c9323b44945d57e6503d91`, 5,361,462 bytes). If the third-party CDN fails, the browser falls back to it.

### 4h. `app/globals.css:670-674`
Change `.fx-grain` from `inset: -50%` to `inset: -12%`. The keyframes translate at most 9%, and 9% of 124% is 11.2%, less than 12%. This cuts the full-screen grain layer from 4x to 1.54x the viewport area (GPU memory on high-tier desktops). There is no visual change.

### 4i. `eslint.config.mjs`
Add `"docs/**"` to `globalIgnores` (the perf harness lives there).

### Phase 4 acceptance (on `corepack pnpm build && corepack pnpm exec next start -p 3100`)

**Build:**
- The `corepack pnpm build` route table lists `/`, `/intelligence` and `/sitemap.xml` as static (○), with no warnings about `images` or `headers`.

**Headers:**
- `curl -sI localhost:3100/assets/crypto/ezgif-frame-001.jpg` → `Cache-Control: public, max-age=31536000, immutable` and `X-Content-Type-Options: nosniff`.
- `curl -sI localhost:3100/frames/v1/crypto/p1080/001.webp` → immutable, `Content-Type: image/webp`.
- `curl -sI localhost:3100/` → security headers present, and no `X-Powered-By`.

**Routes and images:**
- `curl -s localhost:3100/sitemap.xml` returns XML with 2 URLs.
- `curl -s -o /dev/null -w '%{http_code}' 'localhost:3100/_next/image?url=%2Fbackground_image.png&w=640&q=75'` → 400 (blocked by localPatterns).
- The hero, team photos, Moments images, header logo and preloader logo all still render (manual check at 1440 and 390).

**HTML:**
- `curl -s localhost:3100/ | grep -c 'main_logo.png" '` shows no icon link to `main_logo.png`.

---

## Phase 5: Verification and harness (commit: "Perf harness and final verification")

1. Commit `docs/plans/final-prod-perf/{run.mjs,inject.js,analyze.mjs,decode-bench.mjs}`. They already exist from planning. `decode-bench.mjs` needs `./enc/<variant>/` samples and is evidence only, so it is optional to run.
2. `corepack pnpm test` and `corepack pnpm build`.
3. Start `corepack pnpm exec next start -p 3100` in the background, then run:
   ```
   node docs/plans/final-prod-perf/run.mjs desktop d.json && node docs/plans/final-prod-perf/analyze.mjs d.json
   node docs/plans/final-prod-perf/run.mjs mobile m.json && node docs/plans/final-prod-perf/analyze.mjs m.json
   ```
   Write the JSON outputs outside the repo, or delete them afterwards. They use installed Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe` with a temp profile, and download nothing.
4. Final targets (fail the phase if any is missed):

   | Metric | Desktop 1440x900 | Mobile 390x844 DPR3 4x |
   |---|---|---|
   | rAF p95 | ≤ 17 ms | ≤ 34 ms (p50 ≤ 17.5) |
   | LoAF > 50 ms in scroll phases | 0 | 0 |
   | Frame lag p50 / p90 / max | ≤ 2 / ≤ 6 / ≤ 20 | ≤ 6 / ≤ 10 / ≤ 24 |
   | Blank samples | 0 | 0 |
   | Live bitmap MB (max) | ≤ 420 | ≤ 200 |
   | Load-phase long tasks (mobile) | | none ≥ 300 ms that is caused by decode; compare against the 588/347 ms baseline |

5. Stop only the 3100 server. Find the PID with `netstat -ano | grep LISTENING | grep ':3100 '` and run `taskkill //PID <pid> //T //F`. Never touch the PID on :3000.
6. Update `docs/FRAME_QUALITY.md` "Code wiring": sources now live in `lib/frame-sequence/sources.ts`, with sets `/frames/v1/<seq>/{1280,p1080}`. Add the cache-busting rule. Keep the edit short.

---

## 9. Decisions (would be `hx decision add`; hx is not installed)

- D1. Decode with `createImageBitmap(blob)` and no options. Scale on draw (GPU, 0.2 ms). The crop and resize path runs on Chrome's main thread (measured 1.2-1.6 s LoAF per 30 frames at 4x).
- D2. Decoded bitmaps are source-sized and independent of canvas size, so resizes never re-decode. Generation tracking is removed.
- D3. Velocity-aware window (`lookahead`, horizon 0.5 s) plus a decode stride of up to 4 at high speed, so fast scrubs show evenly spaced frames instead of stalling. The draw rule (never replace with a farther frame) is unchanged.
- D4. Memory: one shared budget across engines (split evenly while both are enabled). Coarse pointers are capped at 192 MB, and unknown memory on coarse pointers gets 160 MB (iOS). Pins are reduced to the first and last frame of each engine.
- D5. Tiers: `portrait` (aspect ≤ 0.8) gets a 864x1080 WebP centre crop. `lite` (backing ≤ 1408 px, coarse landscape, Save-Data, 2g/3g, or < 4 GB) gets 1280 WebP. `full` gets the original 1920 JPEGs. WebP 1920 is not produced: it is +8% bytes and decodes 2x slower than the JPEGs. AVIF is not produced: about 1 s/frame to encode and a small gain.
- D6. Generated frames are committed under a versioned folder (`/frames/v1`). They are not generated at build time, so deploys are deterministic on Vercel and on any Node host.
- D7. No `<link rel=preload>` for the first frame, because the media/DPR/connection-dependent tier cannot be expressed exactly, and a mismatch means a wasted download plus a console warning. Instead, `warmFirstFrame()` starts the exact URL when the client chunk evaluates, and the engine's `force-cache` fetch reuses it.
- D8. Rings are locked concentric: no mouse-follow, no parallax, no medallion drift, no levitation. A static SVG fallback is used for reduced motion, missing WebGL2, context loss and render errors.
- D9. Image optimizer uses WebP only (no AVIF), so the first post-deploy hero request is not slowed by AVIF encoding. localPatterns limit the optimizer to the known sources.
- D10. Immutable 1-year caching on `/assets`, `/frames`, `/textures`, `/hero` and the local video. Cache busting is done by new folder names only.

## 10. Risks and notes for the user (no code)
- Deploy size: `public/` already holds about 105 MB, plus 37 MB of new frames. Unused large files are `public/background_image.png` (21 MB) and `public/bhurj_khalifa.png` (1.4 MB). Check this against your Vercel plan's deployment and static file limits. Nothing is deleted by this plan.
- The `/team/*.png` sources are up to 2.5 MB each. They are optimized at request time, so the first visit after a deploy is slower for those cards.
- CSP is not added. The inline theme script and Next's inline scripts would need nonces, which is out of scope.
- These numbers come from headless Chrome. Real iOS Safari is not measured here: check one iPhone by hand after deploy, scrolling through Crypto and Forex quickly.
