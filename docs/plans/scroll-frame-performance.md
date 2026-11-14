# Plan: scroll-frame-performance

Goal: make the scroll-driven frame sequences (Crypto 240 frames, Forex+Stock+Opportunity 720 frames) smooth and premium-feeling without changing the frame assets, the visual design or unrelated layout. Also remove fake/unsupported metrics from the rendered page.

Status: AUDIT done, PLAN ready for coder. `hx` is not installed in this environment, so design decisions are recorded in section 6 (Decisions) of this file rather than via `hx decision add`.

Prerequisite: `node_modules` is NOT installed. Run `pnpm install` first. AGENTS.md warns that this Next.js (16.3.5) differs from training data. This plan uses no new Next APIs except optional step C4. Before C4, read `node_modules/next/dist/docs/` for `headers`.

---

## 1. Audit: root causes (ranked by impact, with evidence)

Facts measured:
- Every frame is a **1920x1080 baseline JPEG** (read from SOF headers: crypto/001, crypto/120, forex/001, stock_market/100, opportunity/240). The median file is about 35 KB (crypto max 149 KB). Total on disk is about 34 MB for 960 frames. Transfer weight is fine. The problem is **decoded** weight: 1920*1080*4 = 8.3 MB per frame, which is **about 8 GB for 960 frames**.
- The "MOP • 1920×1080 3D SEQUENCE" label is therefore accurate.
- `app/globals.css:109` sets `scroll-behavior: auto`, so there is no CSS smooth-scroll conflict. Frames are already drawn to a single canvas, with no `img.src` swapping. Neither of these is a cause.

| # | Root cause | Evidence |
|---|---|---|
| R1 | **Main-thread JPEG decode mid-scroll.** Every frame is kept as an `HTMLImageElement` after `img.decode()`. 960 decoded frames (about 8 GB) cannot stay resident, so Chrome's decode cache evicts them. When `drawImage(img)` later hits an evicted image, it re-decodes the 1080p JPEG synchronously inside the rAF callback. That causes 10-30 ms hitches, which is the "choppy" feel. Eager `decode()` of all frames at load also wastes CPU and memory. | Crypto `CryptoMarketScroll.tsx:28, 210-221, 94`; Forex `ForexMarketScroll.tsx:62-64, 342-353, 144` |
| R2 | **Double smoothing (laggy, rubber-band feel).** Lenis already eases the scroll (`duration 1.2`, expo-out). Each sequence then applies a second exponential damping (`SMOOTHING = 10`, about 230 ms settle) to the already-eased value, so frames trail the scroll noticeably. | `LenisProvider.tsx:33-39`; Crypto `:10, :149`; Forex `:13, :284-286` |
| R3 | **Lenis context is always `null`, and there are several unordered rAF loops.** `LenisProvider` passes `lenisRef.current` into context during render and never re-renders after the effect creates Lenis, so `useLenis()` returns `null` forever. Both sequences therefore fall back to native `scroll` listeners, which deliver scroll from the previous frame. Lenis, Crypto, Forex and framer-motion each run their own rAF, with undefined order relative to Lenis's `scrollTo`. This adds 1 frame of latency and jitter. | `LenisProvider.tsx:27, 41, 43-48, 58`; Crypto `:130-177, 279-287`; Forex `:272-317, 444-451` |
| R4 | **Document-wide style invalidation every frame.** `useThemeScroll` writes 4 CSS custom properties on `<html>` on every spring tick across the first 35% of the page, which is exactly the two sequences. `--navbar-progress` and `--ground-shadow-opacity` are not consumed anywhere: they appear only as definitions in `globals.css:99-100,166-167`. `--accent` is consumed in about 70 places. Writing inherited custom properties on the root forces a style recalc of the whole tree. | `lib/theme.ts:30-47, 57-58, 72-75` |
| R5 | **Oversized canvas backing store.** DPR is capped at 2, so a 1440x900 viewport gets a 2880x1800 (5.2 MP) canvas for a 1080p source. Every draw upscales with `imageSmoothingQuality='high'`. That is about 2.8x more fill and texture work than the source can show. | Crypto `:16, 101-105, 84-85, 88-94`; Forex `:16, 151-153, 139-144` |
| R6 | **Preload ignores scroll position, and the network is congested at load.** Both components start at mount: 2 x 30 parallel requests, plus the hidden CloudFront hero video with `preload="auto"`, all compete with the hero LCP image. Forex loads strictly in order (forex, then stock, then opportunity). A user who scrolls ahead hits unloaded frames. The fallback then draws a far-away frame, which shows as visible jumps. `Promise.all` batches wait on their slowest image. The fallback search is a linear scan that prefers far-backward frames. | Crypto `:206-254, 62-75`; Forex `:361-421, 111-134`; `IntelligenceHero.tsx:57-65` |
| R7 | **Redundant DOM writes per frame.** Forex runs `updateHUD` on every tick, whether or not anything changed: 3x `textContent`, `style.width`, 4x `opacity`. `processDoorwayTransition` writes `pointerEvents` every tick. Crypto writes the progress-bar `width` (a layout property) on every scroll event. | Forex `:305, 172-224, 237, 245, 264-268`; Crypto `:198-200` |
| R8 | **Stale layout cache leads to wrong progress.** `sectionTop` is re-measured only when the section itself resizes. Content above it can change height without the section resizing: `TypingHeading` re-wraps the Hero h1 while it types, and fonts use `display: swap`. Progress also uses `window.innerHeight` while the sticky viewport is `100dvh`, so progress is off on mobile when the URL bar collapses. | Crypto `:119-127, 257-262, 189, 304`; Forex `:162-169, 427-432, 329, 472` |
| R9 | **Hidden video decodes during the whole Forex sequence.** The IntelligenceHero video autoplays and loops underneath an opaque canvas from page load onwards. The hero layer has `will-change: opacity`, but its opacity never changes. | `IntelligenceHero.tsx:16-20, 57-65`; Forex `:478-484` |
| R10 | **Backdrop filters over a constantly changing canvas.** The HUD pills use `backdrop-blur-md` over the canvas, so every frame change re-filters their backdrop. The pills are already 80-85% opaque, so the blur is barely visible. There is a useless `will-change: transform` on the Crypto overlay. The header's two stacked `backdrop-filter` layers (20px and 36px, plus saturate) also re-filter over the canvas. | Crypto `:319, 323, 331`; Forex `:508, 514`; `GlassHeader.tsx:68, 86` |
| R11 | **Black flash.** The canvas uses `alpha:false`, so it is black until frame 0 decodes. The Crypto section is beige `#EFE7DC`. | Crypto `:59, 298-310`; Forex `:104` |
| R12 | Minor: `prefersReducedMotion` is read during render and never updates (Crypto `:50-52`, Forex `:96-98`). `getContext` is called on every draw. | as cited |

Not root causes (checked): there are no `getBoundingClientRect` calls in the scroll path (only in the RO callback), and there are no multiple draws per frame (at most 1 per tick).

Secondary, out of scope (follow-up only, do not change in this plan): `Hero.tsx:98-120` animates `top`/`left` (layout properties) on `blur(55px)` orbs through a spring that keeps settling for about 1 s after the hero leaves. This costs layout on the first second of the Crypto section.

---

## 2. Fake / unsupported metrics

Rule used: any hardcoded number or stat presented as real performance, market data or social proof that is not backed by a data source is removed or replaced with non-numeric copy that already exists. Decorative visuals stay, but captions that claim they are data are neutralised. `lib/content.ts:2-3` itself says "Swap numbers and quotes for real client data before launch". No `Math.random` and no FPS readouts exist in rendered code.

### Rendered on `/` (fix in Part B)

| # | Location | Fake value | Action / replacement |
|---|---|---|---|
| F1 | `components/sections/CryptoMarketScroll.tsx:361-369` | BTC $64,280 +3.4%, ETH $3,450 +2.8%, SOL $148 +5.1% (static "prices") | Keep the 3 chips, remove the price and `<strong>`. Text becomes `BTC • BITCOIN`, `ETH • ETHEREUM`, `SOL • SOLANA`. Same classes, same layout. |
| F2 | `components/sections/ForexMarketScroll.tsx:550-552` | EUR/USD 1.0842 +0.12%, GBP/JPY 191.65 -0.34%, XAU/USD $2,384 +0.87% | `EUR/USD • MAJOR`, `GBP/JPY • CROSS`, `XAU/USD • GOLD` |
| F3 | `components/sections/ForexMarketScroll.tsx:578-580` | S&P 500 5,204 +0.54%, NASDAQ 16,340 +0.78%, GOLD $2,384 +0.87% | `S&amp;P 500 • INDEX`, `NASDAQ • INDEX`, `GOLD • COMMODITY` |
| F4 | `lib/content.ts:93-97` HERO_STATS, rendered at `components/sections/Hero.tsx:320-330` (+ imports `:20`, `:25`, `:32`) | 1,400+ graduates, 78% retention, 4.9/5 | Delete the "Stats" `motion.div` (Hero 320-330) and the imports `StatRow`, `HERO_STATS`, `SPRING_RESPONSIVE` (used only at :327). Delete `HERO_STATS` from content.ts. It is the last child of a flex column, so nothing reflows except a slightly shorter column. Nothing replaces it. |
| F5 | `lib/content.ts:82` COHORT_BADGE, rendered at `Hero.tsx:264` | "Cohort 14 · Starts 6 January 2025" (fabricated, in the past) | Render the existing `BRAND_TAGLINE` ("Trading education. No shortcuts.", content.ts:267) instead. Remove `COHORT_BADGE` from content.ts and the Hero import. Same pill and dot. |
| F6 | `lib/content.ts:153-158` ACHIEVEMENT_STATS, rendered at `components/sections/Gallery.tsx:57-63` | 1,400+, 78%, 14 cohorts, 97% | Delete the "Four-up stat bar" div (Gallery 57-63) and the `StatRow` / `ACHIEVEMENT_STATS` imports (`:16-17`). Change the grid on `:47` from `... mb-12 md:mb-16` to no bottom margin, so the section padding (`py-20 md:py-28`) still ends it cleanly. Delete `ACHIEVEMENT_STATS` from content.ts. Keep `components/ui/StatRow.tsx` (unused file, harmless). |
| F7 | `lib/content.ts:160-165` RESULTS_WALL_RECORDS, rendered at `components/art/ResultsWall.tsx:54-94` | +4.2% monthly return, 68% prop pass rate, 312 funded, −2.1% drawdown | Replace with non-metric programme pillars from existing curriculum copy: in content.ts add `export const PROGRAMME_PILLARS = CURRICULUM_CHAPTERS.slice(0, 4).map(c => ({ value: c.number, label: c.title }));`. The constant must be declared after `CURRICULUM_CHAPTERS` (move it below line 213). Delete `RESULTS_WALL_RECORDS`. ResultsWall maps `PROGRAMME_PILLARS` with identical tile markup (sparklines stay as decoration). The `aria-label` becomes `` `${p.value} ${p.label}` ``. |
| F8 | `ResultsWall.tsx:48`, `:110`, `:115`; `Gallery.tsx:48` | "Verified results", "Cohort 12 — composite equity curve", aria "Equity curve showing steady account growth…", frame label "Verified cohort records" | `:48` becomes "Programme framework". `:110` becomes "Illustrative equity curve". `:115` aria becomes "Illustrative equity curve (decorative, not performance data)". Gallery `:48` label becomes "Programme framework". |
| F9 | `lib/content.ts:169` AUDIT_BODY, rendered at `components/art/CertificateDisplay.tsx:189` | "Verified by TradeAudit™" (fabricated verification) | Value becomes `'Issued by Master of Pipsology'`. |
| F10 | `lib/content.ts:278-279, 291-292, 304-305, 317-318, 330-331` (`experience`, `metric`), rendered at `components/sections/LuxuryTeamGallery.tsx:319-320, 413-418, 437-439` | "16+ Years", "$480M+ Flow Executed", "99.8% Variance Control", "18,000+ Hours Live Tape", "1,200+ Student Audits", … | Remove the `experience` and `metric` fields from `TeamMember` (content.ts:52-53) and from all 5 members. LuxuryTeamGallery: delete the "Experience Pin" block (413-418, absolutely positioned, no reflow). Card footer `:438` changes `{member.metric}` to `{member.tags[0]}`, so `justify-between` keeps "Dossier" on the right. Modal `:319-320` becomes `<span>Focus: <strong className="text-[#FAF1DE]">{selectedMember.tags[0]}</strong></span>` and `<span>Discipline: <strong className="text-[#E8CA65]">{selectedMember.tags[1]}</strong></span>`. All members have 3 tags. |
| F11 | `lib/content.ts:227-229` FINAL_CTA_HEADLINE/SUBLINE, rendered at `components/sections/FinalCta.tsx:41, 48` | "Cohort 14 starts 6 January." / "Seats are capped at 40. Applications close 20 December." | Headline becomes `'The next cohort is forming.'`. Subline becomes `'Seats are limited. Applications are reviewed individually.'` (user sign-off on copy recommended). |
| F12 | `app/layout.tsx:37, 56, 71` metadata | "Cohort 14 starts 6 January 2025", "Join 1,400+ graduates…", "1,400+ graduates. Cohort 14…" | `:36-37` description becomes `'A 12-week live trading programme covering risk architecture, market structure, order flow and execution psychology. Forex, equities and crypto.'`. `:56` OG description becomes `'Trade with institutional precision. A 12-week live trading programme.'`. `:71` twitter becomes `'A 12-week live trading programme covering risk, structure, order flow and execution.'` |
| F13 | `lib/content.ts:99-108` TICKER_SYMBOLS | Static "live" ticker changes | Not imported anywhere. Delete the export. |

### Checked and kept (backed by real state or fact)
- HUD "FRAME 001 / 240" and the progress bar (Crypto `:330-340`, Forex `:514-521`): driven by the real frame index. Keep.
- "MOP • 1920×1080 3D SEQUENCE" (Crypto `:375`, Forex `:616`): verified true. Keep.
- "RING OF PRECISION · LIVE WEBGL" (`MagicRingShowcase.tsx:75`): it is a live WebGL render. Keep.
- "$7.5 trillion a day" (Forex `:547`, content.ts `:132`): this is the public BIS 2022 Triennial figure, not fabricated. The BIS 2025 survey reported a higher figure, so the copy is flagged for the user to verify or update. No change in this plan.
- "12-week", "six modules": product facts. Keep.

### Flag to user, no code change
- `TESTIMONIAL` (content.ts:217-223, "Marcus Adeyemi, Cohort 11") is a placeholder testimonial per the content.ts header.
- Team `pedigree` claims ("Ex-Barclays", "Ex-Citadel", "CBOT Veteran") are unverified credentials.
- The Gallery h2 "Real results from real traders." (`Gallery.tsx:43`) is a claim with no numbers left to support it.
- CertificateDisplay seal year "2025" (`:157`).

### Not rendered anywhere (dead components, leave untouched, recommend separate cleanup)
`components/sections/BurjKhalifaReveal.tsx:228-237, 273-281` (static XAU/EUR/NAS/BTC prices), `components/sections/Markets.tsx` (MARKETS), `components/art/PriceChart.tsx`, `components/sections/ArchitecturalScene.tsx`, `components/art/BurjKhalifahLayer.tsx`, `components/sections/Marquee.tsx`, `components/nav/MobileNavPill.tsx`. None are imported by `app/page.tsx` or by anything it renders.

---

## 3. Target architecture (Part A)

```
framer-motion frameloop (ONE rAF for the whole app)
  step "update": Lenis.raf(timestamp)           <- LenisProvider (sole scroll smoother)
  step "render": sequence ticks (per visible section)
       scroll = lenis.scroll (or cached native scrollY when Lenis is off)
       progress = cached-layout math (no DOM reads)
       frame = frameForProgress(progress)
       engine.update(frame) -> draws at most once, only if the bitmap identity changed
       onUpdate -> HUD/overlay writes, each guarded by "value changed"
FrameSequenceEngine (per section, plain TS)
  fetch(): Blob cache for all frames (about 34 MB total), priority = distance to current frame + coarse-to-fine stride
  decode(): createImageBitmap(blob, crop, {resizeWidth/Height = canvas backing}) off-main-thread
            decoded window around current frame, direction-biased, memory-budgeted; evict + close() outside it
  draw(): nearest decoded frame, 1:1 blit when sized for the current canvas
```

### New files
1. `lib/frame-sequence/math.ts`: pure, dependency-free functions (unit tested). No `@/` imports and only erasable TS syntax (no `enum`, `namespace` or parameter properties), so that `node --test` can load it.
2. `lib/frame-sequence/engine.ts`: `FrameSequenceEngine` class (fetch/decode/cache/draw, no React).
3. `lib/frame-loop.ts`: single-driver wrapper around framer-motion's frameloop.
4. `components/hooks/useFrameSequence.ts`: React wiring (refs, Lenis, IO/RO, reduced motion, tick subscription).
5. `tests/frame-sequence-math.test.mjs`: Node test runner tests for math.ts.

### Modified files
`components/providers/LenisProvider.tsx`, `components/sections/CryptoMarketScroll.tsx`, `components/sections/ForexMarketScroll.tsx`, `components/sections/IntelligenceHero.tsx` (2 optional props, default behaviour unchanged for `/intelligence`), `lib/theme.ts`. Fake-metric files are in Part B.

---

## 4. Part A: step-by-step implementation

### A0. Verify library APIs (do not guess)
After `pnpm install`, run:
```
grep -n "autoRaf\|get scroll()\|raf(time" node_modules/lenis/dist/lenis.d.ts
grep -rn "export.*cancelFrame\|export.*\bframe\b" node_modules/framer-motion/dist/types/index.d.ts
grep -rn "preRender\|\"render\"\|render:" node_modules/motion-dom/dist/index.d.ts | head
```
Expected: Lenis has `autoRaf?: boolean`, `raf(time: number)` and a `scroll` getter, and framer-motion exports `frame` and `cancelFrame`, whose `frame` has `update` and `render` steps taking `(process: (data: FrameData) => void, keepAlive?: boolean)`, with `FrameData = { delta: number; timestamp: number; isProcessing: boolean }`.
- **Fallback if `frame`/`cancelFrame` are not exported:** implement `lib/frame-loop.ts` as its own singleton rAF loop with two ordered buckets (`update` runs before `render`), same exported signature. Everything else stays the same.
- If `autoRaf` is absent, omit that option. Lenis does not auto-raf by default in that case.

### A1. `lib/frame-loop.ts`
```ts
'use client';
import { frame, cancelFrame } from 'framer-motion';
export type FrameStep = 'update' | 'render';
export type FrameCallback = (timestampMs: number, deltaMs: number) => void;
/** Runs cb every frame on framer-motion's single rAF. Returns unsubscribe. */
export function onEveryFrame(cb: FrameCallback, step: FrameStep): () => void {
  const process = (d: { timestamp: number; delta: number }) => cb(d.timestamp, d.delta);
  frame[step](process, true);
  return () => cancelFrame(process);
}
```

### A2. `components/providers/LenisProvider.tsx` (fixes R2, R3)
- Hold the instance in state: `const [lenis, setLenis] = useState<Lenis | null>(null);` and delete `lenisRef`.
- In the effect (keep `if (prefersReduced) return;`): create `new Lenis({ ...same options as :33-39..., autoRaf: false })` and `const stop = onEveryFrame((t) => instance.raf(t), 'update');`, then `setLenis(instance)`. Cleanup: `stop(); instance.destroy(); setLenis(null);`. Delete the manual `requestAnimationFrame` loop (`:43-48`).
- Context value: `const value = useMemo(() => ({ lenis }), [lenis]);`.
- If eslint flags `react-hooks/set-state-in-effect`, this is a legitimate sync with an external system. Add `// eslint-disable-next-line react-hooks/set-state-in-effect -- publishing external Lenis instance` on the `setLenis(instance)` line only.
- Keep `useLenis()` signature: `(): Lenis | null`.

### A3. `lib/frame-sequence/math.ts`: exact exports
```ts
export interface Size { w: number; h: number }
export interface Rect { x: number; y: number; w: number; h: number }

export function clamp(v: number, lo: number, hi: number): number;
export function clamp01(v: number): number;

/** 0..1 progress of a sticky section. range = sectionH - viewportH; returns 0 if range <= 0. */
export function sectionProgress(scroll: number, top: number, sectionH: number, viewportH: number): number;

/** Frame-rate independent exponential damping. rate <= 0 returns target. Snaps to target when |target-next| < 1e-5. */
export function damp(current: number, target: number, rate: number, dtSec: number): number;

/** Canvas backing size: DPR-aware but never more pixels than the cover-fitted source can supply.
 *  cover = max(css.w/src.w, css.h/src.h); useful = 1/cover;
 *  scale = max(1, min(min(dpr||1, dprCap), useful)); returns rounded css*scale (min 1). */
export function computeBackingSize(css: Size, src: Size, dpr: number, dprCap?: number /* 2 */): Size;

/** Integer, centred source crop that a cover-fit to `dest` shows. x+w <= src.w, y+h <= src.h, w,h >= 1. */
export function coverCrop(src: Size, dest: Size): Rect;

/** Integer dest rect to draw an image of size `img` so it covers `dest` (centred). */
export function coverDest(img: Size, dest: Size): Rect;

/** Nearest index i with flags[i] truthy, searching idx, idx-1, idx+1, idx-2, idx+2… (backward wins ties). -1 if none. */
export function nearestAvailable(flags: ArrayLike<number>, idx: number): number;

export const FETCH_STRIDES: readonly number[]; // [16, 8, 4, 2, 1]

/** Lower = sooner. Frames within nearWindow of current: score = dist. Otherwise
 *  (strideLevel+1)*1_000_000 + dist, where strideLevel = first k with i % FETCH_STRIDES[k] === 0.
 *  dist = |i-current|, doubled when the frame is behind the scroll direction (dir: 1 | -1). */
export function fetchScore(i: number, current: number, dir: number, nearWindow: number): number;

/** state: 0 idle, 1 in flight, 2 ready, 3 failed. Pinned idle frames first (in given order);
 *  if !full only pinned are eligible; else min fetchScore among idle. -1 if none. */
export function pickNextFetch(state: ArrayLike<number>, pinned: readonly number[], current: number, dir: number, nearWindow: number, full: boolean): number;

/** Inclusive [lo, hi] decode window, `ahead` frames in scroll direction and `behind` the other way, clamped to [0,total-1]. */
export function decodeWindow(current: number, dir: number, total: number, ahead: number, behind: number): [number, number];

/** needs[i] truthy = blob ready, not in flight, bitmap missing or stale. Pinned needing decode first;
 *  else nearest to current within [lo,hi], ahead-of-direction wins ties. -1 if none. */
export function pickNextDecode(needs: ArrayLike<number>, pinned: readonly number[], current: number, dir: number, lo: number, hi: number): number;

/** Max decoded frames for this canvas: bytes = w*h*4; budget = 384 MB if deviceMemory>=8, 256 MB if >=4, else 128 MB
 *  (undefined counts as 4); result = clamp(floor(budget/bytes), 16, min(total, 240)). */
export function bitmapBudget(backing: Size, deviceMemoryGB: number | undefined, total: number): number;
```

### A4. `lib/frame-sequence/engine.ts`: `FrameSequenceEngine`
```ts
export interface FrameSequenceEngineOptions {
  urls: readonly string[];           // global index -> URL
  pinned: readonly number[];         // fetched first, never evicted
  background: string;                // canvas clear colour (fixes R11)
  maxConcurrentFetches?: number;     // default 6
  maxConcurrentDecodes?: number;     // default clamp(floor(hardwareConcurrency/2) - 1, 1, 3)
  nearWindow?: number;               // default 12
}
export class FrameSequenceEngine {
  readonly total: number;
  constructor(opts: FrameSequenceEngineOptions);
  attachCanvas(canvas: HTMLCanvasElement): void; // ctx = getContext('2d', { alpha: false }) cached once; fill background
  start(): void;                     // begin fetching pinned frames (called from idle callback)
  setFullFetch(on: boolean): void;   // once true stays true; pump()
  setDecodeEnabled(on: boolean): void; // false: close() all non-pinned bitmaps; true: pump()
  resize(cssW: number, cssH: number, dpr: number): void;
  update(frame: number): number;     // returns index actually shown, -1 if none
  destroy(): void;                   // abort fetches, close all bitmaps, drop blobs, destroyed = true
}
```
Internal state: `fetchState: Uint8Array`, `retries: Uint8Array`, `blobs: (Blob|null)[]`, `bitmaps: (ImageBitmap|null)[]`, `bitmapGen: Int32Array` (fill -1), `hasBitmap: Uint8Array`, `decoding: Uint8Array`, `inflightFetches`, `inflightDecodes`, `current = 0`, `dir = 1`, `generation = 0`, `src: Size | null` (from probe), `backing: Size`, `crop: Rect`, `budget`, `fullFetch`, `decodeEnabled`, `dirty`, `lastDrawn: ImageBitmap | null`, `abort = new AbortController()`, `pumpQueued`.

Behaviour:
- **Fetch** `startFetch(i)`: `fetchState[i]=1`; `fetch(url, { signal, cache: 'force-cache', priority: pinned-or-within-nearWindow ? 'high' : 'low' } as RequestInit)`, then `res.ok ? res.blob() : throw`. On success `blobs[i]=blob; fetchState[i]=2`. On error (not abort) `retries[i] < 2 ? (retries[i]++, fetchState[i]=0) : fetchState[i]=3`. Finally `inflightFetches--; dirty=true; schedulePump()`.
- **Probe**: when the first blob arrives and `src` is null, run `createImageBitmap(blob)` (full size, no crop) and set `src = {w: bmp.width, h: bmp.height}`. Store it as that frame's bitmap with `bitmapGen = -2` (stale, so it is redrawn by cover and re-decoded later). Recompute crop and budget, then pump. No other decode starts before `src` is known. This makes the engine resolution-agnostic if assets are re-encoded later (section 7).
- **Decode** `startDecode(i)`: capture `gen = generation`, then `createImageBitmap(blobs[i], crop.x, crop.y, crop.w, crop.h, { resizeWidth: backing.w, resizeHeight: backing.h, resizeQuality: 'high' })`. If that throws a `TypeError` (older Safari without resize options), set `resizeSupported=false` and retry with the crop only. All later decodes use crop-only. Draw still works because it uses `coverDest`. On resolve: if `destroyed` or (`!decodeEnabled` and not pinned), `bmp.close()` and return. Otherwise `old = bitmaps[i]`, then `bitmaps[i]=bmp; bitmapGen[i]=gen; hasBitmap[i]=1; old?.close()`. On reject: `fetchState[i]=3`. Finally `decoding[i]=0; inflightDecodes--; dirty=true; schedulePump()`.
- **pump()** (also run via `schedulePump` = `queueMicrotask` guard):
  1. While `inflightFetches < max`: `i = pickNextFetch(fetchState, pinned, current, dir, nearWindow, fullFetch)`, then `startFetch(i)` (break on -1). Do not fetch before `start()`.
  2. If `decodeEnabled && src`: `W = budget - pinned.length` (min 8), `ahead = ceil(W*0.65)`, `behind = W - ahead`, `[lo,hi] = decodeWindow(...)`. Evict every non-pinned `i` with `hasBitmap[i]` outside `[lo,hi]` by calling `close()` then nulling, and clear `hasBitmap`. Do not close `lastDrawn` if it is still shown. Closing is safe anyway because the canvas already holds the pixels; set `lastDrawn=null` if closed. Then build `needs` (Uint8Array, reused) = `fetchState==2 && !decoding && bitmapGen != generation`. While `inflightDecodes < max`: `pickNextDecode(...)`, then `startDecode`.
- **update(frame)**: clamp. If `frame !== current`: `dir = sign(frame-current)`, `current = frame`, `dirty = true`. If `dirty`: `dirty=false; pump()`. `shown = nearestAvailable(hasBitmap, frame)`. If `shown >= 0 && bitmaps[shown] !== lastDrawn`, call `draw(bitmaps[shown])` and set `lastDrawn = bitmaps[shown]`. Return `shown`. Idle cost: O(1). The pump scan only runs when something changed.
- **draw(bmp)**: `d = coverDest({w:bmp.width,h:bmp.height}, backing)`. If `d` equals the full canvas, `ctx.drawImage(bmp, 0, 0)` (1:1 blit). Otherwise `ctx.drawImage(bmp, d.x, d.y, d.w, d.h)`. Exactly one draw per changed bitmap.
- **resize(cssW, cssH, dpr)**: `next = computeBackingSize({w:cssW,h:cssH}, src ?? {w:1920,h:1080}, dpr)`. If unchanged, return. Set `canvas.width/height`, re-apply `imageSmoothingEnabled=true; imageSmoothingQuality='high'`, `fillRect` with background, and redraw `lastDrawn` immediately via cover (no flash). Then **debounce 150 ms**: `generation++`, recompute `crop = coverCrop(src, backing)` and `budget = bitmapBudget(backing, navigator.deviceMemory, total)`, then `dirty = true; schedulePump()`. Stale bitmaps keep serving as cover-drawn fallbacks until they are replaced.
- **destroy()**: `abort.abort()`, close all bitmaps, `blobs.fill(null)`, clear the debounce timer.
- `navigator.deviceMemory` typing: `(navigator as Navigator & { deviceMemory?: number }).deviceMemory`.

### A5. `components/hooks/useFrameSequence.ts`
```ts
'use client';
export interface FrameSource { count: number; src: (localIndex: number) => string }
export interface FrameSequenceUpdate { progress: number; frame: number; shownFrame: number }
export interface UseFrameSequenceOptions {
  sources: readonly FrameSource[];                          // concatenated into one global index space; module-level constant
  frameForProgress: (progress: number, total: number) => number; // integer 0..total-1
  pinned?: readonly number[];                               // global indices
  background: string;
  smoothing?: number;            // damping rate, used ONLY when Lenis is inactive and motion allowed; default 12
  onUpdate?: (u: FrameSequenceUpdate) => void;              // every rendered tick while visible; must guard DOM writes
  onActiveChange?: (visible: boolean) => void;
  prefetchMargin?: string;       // default '200% 0px 200% 0px'
  decodeMargin?: string;         // default '100% 0px 100% 0px'
}
export interface FrameSequenceRefs {
  sectionRef: React.RefObject<HTMLElement | null>;
  stickyRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}
export function useFrameSequence(options: UseFrameSequenceOptions): FrameSequenceRefs;
```
Implementation:
- `optsRef` synced in `useEffect(() => { optsRef.current = options; })` (no deps). Do not write refs during render (React 19 lint).
- `lenisRef` synced from `useLenis()` in an effect with `[lenis]`. The same effect: if `lenis` is null, set `nativeScrollRef.current = window.scrollY` and add `window.addEventListener('scroll', onScroll, { passive: true })` where `onScroll` only stores `window.scrollY`. Remove it in cleanup.
- Mount effect (`[]` deps):
  1. Build `urls` from `optsRef.current.sources`, create the engine, `attachCanvas(canvasRef.current)`.
  2. Reduced motion: `mq = matchMedia('(prefers-reduced-motion: reduce)')`; `reducedRef.current = mq.matches`; `mq.addEventListener('change', …)`.
  3. `measure()`: `rect = section.getBoundingClientRect()`; `layout.top = rect.top + window.scrollY`; `layout.height = rect.height`; `layout.viewportH = sticky.clientHeight` (fixes R8, matches `100dvh`). Then `engine.resize(sticky.clientWidth, sticky.clientHeight, devicePixelRatio)`. This is the **only** layout read in the hook.
  4. One `ResizeObserver` observing `section`, `sticky` **and `document.body`**, whose callback is `measure()` (so content above shifting the section is caught). Call `measure()` once immediately.
  5. Three IntersectionObservers on `section`: (a) `rootMargin: prefetchMargin`: on first intersect call `engine.setFullFetch(true)` and disconnect; (b) `decodeMargin`: `engine.setDecodeEnabled(isIntersecting)`; (c) `rootMargin '0px'`: on enter, subscribe `unsub = onEveryFrame(tick, 'render')`, run `tick` once, then `onActiveChange?.(true)`. On exit, run one final `tick` (so the end state of 0 or 1 is applied), `unsub()`, then `onActiveChange?.(false)`.
  6. Start: `requestIdleCallback(() => engine.start(), { timeout: 500 })`, falling back to `setTimeout(…, 200)` when rIC is missing (Safari). This keeps frame requests behind the hero LCP.
  7. Cleanup: unsub, disconnect all observers, remove the mq listener, cancel idle, `engine.destroy()`.
- `tick(_ts, deltaMs)`:
  ```
  const l = lenisRef.current; const L = layoutRef.current;
  const scroll = l ? l.scroll : nativeScrollRef.current;          // no layout read
  const target = sectionProgress(scroll, L.top, L.height, L.viewportH);
  const rate = (reducedRef.current || l) ? 0 : (optsRef.current.smoothing ?? 12); // single smoothing stage
  const p = damp(progressRef.current, target, rate, Math.min(deltaMs / 1000, 0.05));
  progressRef.current = p;
  const frame = optsRef.current.frameForProgress(p, engine.total);
  const shown = engine.update(frame);
  optsRef.current.onUpdate?.({ progress: p, frame, shownFrame: shown });
  ```

### A6. `components/sections/CryptoMarketScroll.tsx`
- Delete lines 27-290 (all old engine refs, callbacks and effects) and the `useCallback`/`useLenis` imports. Keep `TOTAL_FRAMES` and `getFrameSrc`. Delete `SMOOTHING`, `INITIAL_BATCH`, `BATCH_SIZE` and `DPR_CAP`.
- Add module constants:
  ```ts
  const SOURCES = [{ count: TOTAL_FRAMES, src: getFrameSrc }] as const;
  const PINNED = [0, TOTAL_FRAMES - 1] as const;
  const frameForProgress = (p: number, total: number) => Math.min(total - 1, Math.max(0, Math.round(p * (total - 1))));
  ```
- In the component: `hudFrameRef`, `hudProgressRef`, and `lastHud = useRef({ frame: -1, pct: -1 })`. Then `const { sectionRef, stickyRef, canvasRef } = useFrameSequence({ sources: SOURCES, pinned: PINNED, frameForProgress, background: '#EFE7DC', onUpdate })`, where `onUpdate` writes `hudFrameRef.textContent` only when `frame` changed, and `hudProgressRef.style.width = pct + '%'` only when `pct = Math.round(progress*100)` changed (fixes R7).
- JSX: `ref={sectionRef}` on `<section>` (type `RefObject<HTMLElement>`, cast if TS complains). Put `ref={stickyRef}` on the sticky div (`:301`). Put `ref={canvasRef}` on the canvas. Remove `willChange: 'transform'` (`:319`). In the two HUD pills (`:323`, `:331`), remove `backdrop-blur-md` and raise the backgrounds to `bg-[#FAF6ED]/92`. Change `animate-pulse` to `motion-safe:animate-pulse` and `animate-bounce` to `motion-safe:animate-bounce`. Apply the F1 chip text change (Part B can be done at the same time).

### A7. `components/sections/ForexMarketScroll.tsx`
- Delete lines 53-56 refs for container/sticky/canvas (they now come from the hook), 61-70, 83-453 (old engine) and the `useCallback`/`useLenis` imports. Keep `FOREX_FRAMES`, `STOCK_FRAMES`, `OPPORTUNITY_FRAMES`, `TOTAL_FRAMES`, `SCROLL_HEIGHT_VH`, `FRAME_SCROLL_PORTION`, `pad`, the `get*Src` helpers, `SEQUENCES` and `resolveSeq`.
- Module constants:
  ```ts
  const SOURCES = SEQUENCES.map(s => ({ count: s.frames, src: s.getSrc }));
  const PINNED = [0, 239, 240, 479, 480, 719] as const;
  const frameForProgress = (p: number, total: number) =>
    p < FRAME_SCROLL_PORTION ? Math.min(total - 1, Math.max(0, Math.floor((p / FRAME_SCROLL_PORTION) * total))) : total - 1;
  ```
- `onUpdate({ progress, frame })` keeps the **exact** existing formulas from `updateHUD` (:172-224) and `processDoorwayTransition` (:227-269), but each write goes through a guard. Use `const last = useRef<Record<string, string>>({})` and `function put(key: string, value: string, apply: (v: string) => void) { if (last.current[key] !== value) { last.current[key] = value; apply(value); } }`.
  - HUD: frame text `String(localIdx+1).padStart(3,'0')`, total `String(seq.frames)`, label `seq.label`, width `${Math.round(p*100)}%`.
  - Overlays: `forexOp/stockOp/oppOp/hudMasterOp` computed exactly as now, written as `(x*hudMasterOp).toFixed(3)`.
  - Doorway: the same three branches. `canvas.style.filter`, `canvas.style.opacity` and `heroContent.style.pointerEvents` all go through `put`.
  - Hero layer: `put('vis', progress >= 0.70 ? 'visible' : 'hidden', v => heroContent.style.visibility = v)`. The canvas is opaque before 0.73, so there is no visual change (fixes R9).
  - Video (fixes R9, R6): `const video = heroContentRef.current?.querySelector('video')`. If `progress >= 0.45 && !armedRef.current`: `video.preload = 'auto'; video.load(); armedRef.current = true`. If `progress >= 0.62 && video.paused`: `video.play().catch(() => {})`. If `progress < 0.55 && !video.paused`: `video.pause()`.
  - `onActiveChange(false)` pauses the video.
- JSX: section gets `ref={sectionRef}`, the sticky div gets `ref={stickyRef}` (replaces `stickyViewportRef`), the canvas gets `ref={canvasRef}`. Keep the canvas `willChange: 'filter, opacity'`, because it does animate those. **Remove** `willChange: 'opacity'` from heroContent (`:481`) and set the initial `visibility: 'hidden'`. Render `<IntelligenceHero autoPlayVideo={false} videoPreload="none" />`. In the HUD pills (`:508`, `:514`) remove `backdrop-blur-md` and use `/92` backgrounds. Add `motion-safe:` to `animate-pulse`/`animate-bounce`. Keep `willChange: 'opacity'` on the hudContainer and the 3 overlays, because they animate opacity. Apply the F2/F3 chip changes.
- `background: '#050505'`.

### A8. `components/sections/IntelligenceHero.tsx` (backward compatible)
- Signature: `export function IntelligenceHero({ autoPlayVideo = true, videoPreload = 'auto' }: { autoPlayVideo?: boolean; videoPreload?: 'auto' | 'metadata' | 'none' } = {}): React.ReactElement`.
- The `:16-20` effect plays only if `autoPlayVideo` (add it to deps). `<video autoPlay={autoPlayVideo} preload={videoPreload} …>`. `/intelligence` is unchanged.

### A9. `lib/theme.ts` (fixes R4)
- Delete the writes of `--navbar-progress` and `--ground-shadow-opacity` (`:33-39`) and the init writes (`:56-58`, keep `prefersReduced.current = …`). The CSS defaults in globals.css stay.
- Keep `--accent`/`--accent-bright` but write them only when the string changes: add module-level `let lastAccent = '', lastAccentBright = '';` and compare before `setProperty`. Rename the function to `writeAccentProgress`. Update the header comment (`:8-13`) to list only the accent.

### A10. Optional (default OFF): sub-frame cross-blend
Only if the stepping is still visible on very slow scroll after A1-A9. In the engine, take the float frame position, draw `floor` then `ceil` with `globalAlpha = frac` quantised to 1/4, and redraw only when `(bitmapA, bitmapB, alphaStep)` changes. Put it behind a `blendFrames?: boolean` option. Do not implement unless requested.

---

## 5. Part B: fake-metric removal (separate commit)
Apply F1-F13 exactly as in the section 2 table. Then confirm no dangling imports:
```
grep -rn "HERO_STATS\|ACHIEVEMENT_STATS\|RESULTS_WALL_RECORDS\|TICKER_SYMBOLS\|COHORT_BADGE\|\.metric\b\|\.experience\b" components app lib
```
This must return nothing.

---

## 6. Decisions (would be `hx decision add`; hx not installed)
1. **Single smoothing stage.** Lenis is the only smoother. Sequence damping is applied only when Lenis is inactive and motion is allowed. Reduced motion maps directly. This removes the R2 lag.
2. **One frame driver.** Lenis and all sequence ticks run on framer-motion's `frame` loop (Lenis in `update`, sequences in `render`), so ordering is deterministic and there is no extra rAF. The fallback is an own ordered singleton loop in `lib/frame-loop.ts`.
3. **Blob cache for all frames, windowed ImageBitmap cache.** About 34 MB of compressed blobs is kept. Decoded bitmaps are budgeted (128/256/384 MB by `deviceMemory`) and direction-biased (65% ahead). Holding all 960 decoded frames (about 8 GB) is impossible, so "keep decoded in memory" means "within a window plus pinned frames".
4. **Decode at canvas size, off the main thread.** `createImageBitmap(blob, crop, resize)` makes every draw a 1:1 blit. The canvas backing never exceeds the source pixels that the cover crop can show (`computeBackingSize`).
5. **Fetch order** = pinned frames, then a dense ±12 neighbourhood, then coarse-to-fine strides (16, 8, 4, 2, 1) by direction-weighted distance. The nearest-frame fallback is therefore always close.
6. **No `<link rel=preload>` for frames.** `as=image` preload would not be reused by `fetch()`. The engine starts in an idle callback, so the hero LCP keeps priority.
7. **HUD pills lose `backdrop-blur-md`** (background raised to /92). The pills are already 80-85% opaque, so the visual change is negligible. It removes per-frame backdrop filtering over the canvas. GlassHeader is untouched (follow-up).
8. **Fake metrics are replaced only with copy that already exists or with neutral labels.** Marketing claims without numbers are flagged, not rewritten.

---

## 7. Asset optimisation (recommendations only; do NOT modify or delete `public/assets`)
Current: 4 x 240 frames, 1920x1080 baseline JPEG, about 35 KB median, 34 MB total. Bytes are already low. Decode cost and pixel count matter more than file size for scrubbing. Re-encoding lossy JPEG again compounds artefacts, so **export from the original render masters if available**. Write outputs to a new folder (e.g. `public/assets-v2/<seq>/<size>/`). Only switch `getSrc` after visual QA. The engine's probe step handles any resolution.

Recommended sets:
- `1920` WebP q75 for desktop.
- `1280` WebP q75 for laptops, tablets and DPR 1.
- `portrait` 720x1080 centre crop for phones in portrait. A 390x844 viewport only shows about 499x1080 source pixels, so this saves about 60% of decode work.
- AVIF only if a decode benchmark on a mid-range phone stays under 8 ms per frame. AVIF decodes slower than JPEG/WebP, which hurts scrubbing.

ffmpeg (per sequence; replace `crypto` with `forex`, `stock_market` or `opportunity`):
```
mkdir -p out/crypto/1920 out/crypto/1280 out/crypto/portrait
ffmpeg -start_number 1 -i public/assets/crypto/ezgif-frame-%03d.jpg -c:v libwebp -quality 75 -compression_level 6 -preset picture out/crypto/1920/frame-%03d.webp
ffmpeg -start_number 1 -i public/assets/crypto/ezgif-frame-%03d.jpg -vf "scale=1280:-2:flags=lanczos" -c:v libwebp -quality 75 -compression_level 6 -preset picture out/crypto/1280/frame-%03d.webp
ffmpeg -start_number 1 -i public/assets/crypto/ezgif-frame-%03d.jpg -vf "crop=720:1080:(iw-720)/2:0" -c:v libwebp -quality 75 -compression_level 6 -preset picture out/crypto/portrait/frame-%03d.webp
```
cwebp equivalent (bash):
```
for f in public/assets/crypto/*.jpg; do b=$(basename "${f%.jpg}"); \
  cwebp -q 75 -m 6 -mt -af "$f" -o "out/crypto/1920/$b.webp"; \
  cwebp -q 75 -m 6 -mt -af -resize 1280 0 "$f" -o "out/crypto/1280/$b.webp"; \
  cwebp -q 75 -m 6 -mt -af -crop 600 0 720 1080 "$f" -o "out/crypto/portrait/$b.webp"; done
```
AVIF (libavif; older avifenc uses `--min 20 --max 32` instead of `-q`):
```
for f in public/assets/crypto/*.jpg; do avifenc -q 55 -s 6 -j all "$f" "out/crypto/avif/$(basename "${f%.jpg}").avif"; done
```
Compare sizes with `du -sh out/crypto/*`. Spot-check frames 1, 120 and 240 at 100% zoom for banding in the dark gradients (forex/opportunity).

Caching (optional C4, needs a Next docs check first): Next serves `/public` with `max-age=0`. If assets move to a versioned folder, add `headers()` in `next.config.ts` for `/assets-v2/:path*` with `Cache-Control: public, max-age=31536000, immutable`. First read `node_modules/next/dist/docs/` for the `headers` config shape in 16.3.5.

---

## 8. Tests and verification

### Unit tests: `tests/frame-sequence-math.test.mjs`
Runner (verified working with Node v24.21.0 and type stripping, importing `.ts` from `.mjs`): `node --test "tests/*.test.mjs"`. The test imports `../lib/frame-sequence/math.ts`. The `.mjs` file is outside the tsconfig `include`, so `next build` does not type-check it. Cases:
1. `sectionProgress(0, 100, 1000, 500) === 0`; `(350,100,1000,500) === 0.5`; `(9999,…) === 1`; range <= 0 returns 0.
2. `damp(0, 1, 0, 0.016) === 1`; `damp(0,1,10,0.016)` is in (0,1); frame-rate independence: two steps of dt 0.008 ≈ one step of 0.016 (within 1e-9); snaps to target when within 1e-5.
3. `computeBackingSize({w:1440,h:900},{w:1920,h:1080},2)` gives `{w:1728,h:1080}`; `({w:390,h:844},…,3)` gives `{w:499,h:1080}` (±1); `({w:2560,h:1440},…,2)` gives `{w:2560,h:1440}` (scale floor 1); dpr 1 never exceeds CSS size.
4. `coverCrop({w:1920,h:1080},{w:1728,h:1080})` gives `{x:96,y:0,w:1728,h:1080}`; portrait `{w:499,h:1080}` gives `x ≈ 710, w ≈ 499`; always `x+w <= 1920` and integer.
5. `coverDest({w:1728,h:1080},{w:1728,h:1080})` gives the exact canvas rect; `coverDest({w:1920,h:1080},{w:1000,h:1000})` gives `h=1000`, `w≈1778`, `x≈-389`.
6. `nearestAvailable([0,0,1,0,1], 3)` gives 2 (backward wins tie); `([0,0,0],1)` gives -1; exact hit returns idx.
7. `fetchScore`: inside nearWindow it is `< 1_000_000`; a stride-16 frame far away scores lower than a stride-1 frame far away; a behind-direction frame scores higher than an ahead frame at equal distance.
8. `pickNextFetch`: pinned idle first; `full=false` with all pinned done gives -1; with `full=true` from current 100, dir 1, the first picks are within 100..112.
9. `decodeWindow(5, 1, 240, 20, 10)` gives `[0, 25]`; `(235,1,240,20,10)` gives `[225,239]`; `dir -1` mirrors.
10. `pickNextDecode` respects `[lo,hi]` and the pinned-first rule, and returns -1 when nothing is needed.
11. `bitmapBudget({w:1728,h:1080}, 8, 240) === 53` (floor(384 MiB / 7,464,960 B), MB = 1024*1024); undefined memory counts as 4 GB; the result is clamped to `[16, min(total,240)]`.

### Build and static checks
```
pnpm install
pnpm lint
pnpm build
node --test "tests/*.test.mjs"
grep -rn "requestAnimationFrame" components lib    # expect only components/MagicRings.jsx (IO-gated WebGL)
grep -rn "getBoundingClientRect" components/hooks lib/frame-sequence   # expect only measure() in useFrameSequence
grep -rn "new Image()\|\.decode()" components/sections   # expect nothing
```

### Runtime: long tasks and jank (Chrome, `pnpm build && pnpm start`, http://localhost:3000)
1. DevTools Console before scrolling:
   ```js
   new PerformanceObserver(l => l.getEntries().forEach(e => console.log('longtask', e.duration.toFixed(1)))).observe({ type: 'longtask', buffered: true });
   new PerformanceObserver(l => l.getEntries().forEach(e => e.duration > 50 && console.log('LoAF', e.duration.toFixed(1), e.scripts?.map(s => s.sourceURL + ':' + s.sourceFunctionName)))).observe({ type: 'long-animation-frame', buffered: true });
   ```
2. Performance panel with CPU throttling 4x: record a continuous wheel scroll from the top of Crypto through the end of Forex, then back up fast.
   - **Accept**: no main-thread "Decode Image" during scroll (decodes appear on worker/raster threads); no long task > 50 ms after the initial load settles; no LoAF > 50 ms attributed to `useFrameSequence`/`engine`.
   - Exactly one "Animation Frame Fired" per frame, from framer-motion's loop (plus MagicRings only when it is visible).
   - No "Recalculate Style" covering the whole document on each frame while inside the sequences (R4 gone).
3. Rendering drawer: turn on "Frame Rendering Stats" and confirm a steady 60 (or 120) fps with no red dropped-frame bars during scroll. Turn on "Paint flashing" and confirm only the canvas and the changed HUD text flash.
4. Network panel: frame requests start after the hero image and fonts finish. Frames near the current scroll position load first, and coarse frames (…016, 032, …) appear early. The CloudFront mp4 does not load until about 45% of the Forex section.
5. Memory: Chrome Task Manager, footprint for the tab, after scrolling the whole page twice. **Accept**: < ~700 MB on a desktop with 8 GB+, and no steady growth on repeated passes (bitmaps are closed).

### Manual acceptance
- Crypto: the beige background shows instead of black before frame 0 (R11). Frames track Lenis scroll with no added lag. HUD frame 001..240 and the progress bar are correct.
- Forex: overlay fades happen at the same frame indices as before (forex fades out at 216-239, stock fades in at 240-264 and out at 456-479, opportunity fades in at 480-504 and out at 661-719). The HUD fades out at progress 0.68-0.73. The doorway blur and dimming at 0.73-0.88 look unchanged. Hero links become clickable at t >= 0.9. The video plays only near the doorway and pauses when you scroll back or leave.
- Fast-scroll jump (drag the scrollbar into the middle of Stock): the nearest frame appears immediately and sharpens within about 100-300 ms. There is no long frozen frame.
- Window resize or rotation: no black flash. The image stays cover-fitted and becomes sharp after about 150 ms.
- DevTools > Rendering > emulate `prefers-reduced-motion: reduce`: Lenis is off, frames map directly to scroll, and there is no pulse or bounce.
- `/intelligence`: the video still autoplays as before.
- Part B: the Hero, Gallery, Team cards and modal, FinalCta and metadata show no fabricated numbers, and layout spacing is visually unchanged apart from the removed stat rows.

---

## 9. Out of scope / follow-ups
- `Hero.tsx:98-180`: animate the orbs with `x`/`y` transforms instead of `top`/`left` (layout per frame while the spring settles).
- `GlassHeader.tsx:63-106`: set `visibility: hidden` on whichever glass layer has opacity about 0, to avoid two stacked backdrop filters.
- Delete the dead components listed in section 2.
- Asset re-encode (section 7) and cache headers (C4).
