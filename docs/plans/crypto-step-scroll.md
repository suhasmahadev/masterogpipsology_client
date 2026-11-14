# Plan: crypto-step-scroll (stepped Crypto slabs with holds, slab texts, clean hand-off to Forex)

Status: planned 2026-10-14 on `luxury-upgrade`. This revision follows the owner's superseding correction:
- unique frames stay the default;
- the stops are raw 1 → 112 → 139 → 179;
- 179 is the hand-off;
- the HUD becomes dev-only;
- commits are local only, per phase.

`hx` is not installed (`hx: command not found`), so the decisions are recorded in section 2, as in workflow-captions.md.

**Already committed:** Start journey to Crypto, the closing line, `journey-math` and rules.md are in `887ff37`. **Still uncommitted, and handled in Phase 1:** the debug HUD (`components/debug/FrameDebugHud.tsx` plus the `// TEMP debug HUD` lines in `useFrameSequence.ts` and `app/page.tsx`) and the `?allframes` A/B lines.

The `?allframes` A/B switch (lines tagged `// TEMP allframes A/B`) is removed. The reverted pit-stop design is not used anywhere here.

No Next.js APIs are touched (client hooks, components, CSS and pure modules only). If anything Next-specific does come up, read `node_modules/next/dist/docs/` first (AGENTS.md).

**Never `git push`.** Every phase ends with a local commit of exactly the files it lists.

---

## 1. Findings

### 1.1 Geometry (from code)
- Crypto `<section>` is 450vh (`SEQ_SCROLL_VH + 100`) and the sticky is 100dvh, so the scroll range is 350vh. Today `frameForProgress = p × 191` (192 unique frames, list 0..191).
- Forex has `marginTop: -100vh`. `components/fx/ForexFade.tsx` scrubs the Forex sticky (opacity 0→1, y 72→0) from Crypto top + 250vh to + 350vh, which is Crypto progress **5/7 = 0.714 → 1**.
- **The new hand-off stop (raw 179 = list 142) sits inside that fade today.**
  - It is at p = 142/191 = 0.7435, about 10vh into the fade.
  - The owner's HUD showed "Forex fading in, Forex frame 1, list 0, pos 0". Forex opacity is about 0.10 there, so Crypto is not shown cleanly.
- HUD pos at the owner's picks: 88.99, 110.04 and 142.03. These are scroll-% positions, so they will differ by screen size. The stops have to be defined as list indices, with an exact snap.

### 1.2 Stops (owner, plain `localhost:3000`, unique mode)

| stop | raw (file) | list index (`UNIQUE_LOCAL`) | rail caption fully shown |
|---|---|---|---|
| 0 (entry) | 1 | 0 | (entry; see Q2) |
| 1 | 112 | 89 | CRYPTO / Bitcoin & Ethereum |
| 2 | 139 | 110 | CRYPTO / On-chain data |
| 3 (hand-off) | 179 | 142 | PROGRAMME 01 / Liquidity Analysis |

Slabs: 1 = list 0→89 (89 frames), 2 = 89→110 (21 frames), 3 = 110→142 (32 frames).

### 1.3 Why stop 2 showed `ezgif-frame-139.jpg`
- The HUD's `file` is `set.urls[shown]` (`useFrameSequence.ts`, `hudSample`). That is the URL list of the **tier chosen when the engine was created**, not the bytes actually fetched.
- A `.jpg` name means the engine was on the **`full`** tier: 1920x1080 JPEG originals, chosen when the backing width `cssW × min(dpr, 2)` is over 1408 px with a fine pointer and a fast network.
- `NNN.webp` means **`lite`** (1280x720 WebP) or **`portrait`** (864x1080 WebP, a centre crop).
- `detectFrameTier()` runs at mount, and again whenever the window crosses aspect 4:5 (`tierEpoch` in useFrameSequence). Docking DevTools to the side or reloading at a different window width flips the tier.
- So stop 2 was picked in a different page state from stops 1 and 3. Within one page load every frame, every stop included, comes from one set.
- The only per-frame exception is the engine's JPEG fallback after a WebP 404 or a decode error (`perFrameFallback`, engine.ts ~521-545). It cannot fire today: every WebP folder has 240/240 files (checked: crypto, forex, stock_market and opportunity, in both 1280 and p1080).
- Action (D12):
  - the HUD shows the tier and the URL actually fetched (fallback-aware);
  - the stop frames are pinned, so they are fetched first from the active set;
  - the tier policy itself is unchanged, because it is a performance feature.

### 1.4 Frame content (measured with sharp from `public/assets/crypto`; scratch script, not committed)
- **Frame 179:** the BTC coin is falling flat across the frame (x 620-1124, top row 692 of 1080). The SOL coin is at the far left (x 0-325, rows 544-870).
- **BTC top row by raw frame:**
  - during slab 3: 139: 388, 147: 404, 155: 464, 159: 496, 163: 532, 171: 616, 179: 692;
  - in the hand-off: 182: 712, 188: 616, 191: 556, 195: 504, 198: 480, 200: 460, 205: 428, 215: 384.
  - The coin top is **≥ 480 for raw 157-198**.
- **Slab 2 frames 112-139** (120x90 px occupancy cells):
  - free on the left: x < 600 for rows < 450, and x < 720 for rows < 270;
  - lower-left occupied (the ETH/SOL coins on the rocks: rows ≥ 450-540, x 0-1080);
  - the BTC flight covers x 600-1200, rows 180-900;
  - phones see source cols ≈ 710-1209, so only the top ≈ 23% is free there.
- **Slab 1 frames 1-112:** the right half is free, so the existing top-right intro fits.

### 1.5 Caption rail today
`CRYPTO_FLOW` has 6 lines spread evenly over progress 0.04-0.94:
1. 24/7
2. kicker
3. Bitcoin & Ethereum
4. On-chain data
5. Programme 01 · Liquidity Analysis
6. Futures basis

The owner's three stop captions are lines 3-5. Under stepping the rail has to be re-timed onto the stops (D9).

### 1.6 Lenis 1.3.26 (read in `node_modules/lenis/dist/lenis.mjs` and `lenis.d.ts`)
- **`virtualScroll` option** (`(data: VirtualScrollData) => boolean`).
  - It is called first, for every wheel, touchstart, touchmove and touchend event.
  - `false` makes Lenis ignore the event entirely, including its `preventDefault`, so the gate must call `preventDefault` itself.
  - The listeners are on `window` with `passive: false`.
- **`scrollTo(target, { duration, easing, lock, force, onComplete, immediate, programmatic, lerp })`**
  - `lock` sets `isLocked` synchronously (`Animate.fromTo` calls `onStart` at once).
  - `force` runs the scroll even when Lenis is stopped or locked.
  - If `target === targetScroll`, `onStart` and `onComplete` fire immediately and nothing animates.
- **Completion:** Lenis calls `reset()` (`animatedScroll = actualScroll`, device-pixel rounded). That leaves up to ~0.5 px of error, which is a visible 1-4/64 blend, so stops need an explicit frame snap (D7).
- **`programmatic: false` + `lerp`** gives the normal wheel feel. The entry catch uses it.
- **Project setup:**
  - `syncTouch: false` means touch scroll is native, but touch events still reach the gate.
  - `lenis.css` is not imported.
  - `MobileMenuSheet` and `LuxuryTeamGallery` call `lenis.stop()`/`start()`, which can kill a glide without `onComplete` (hence the watchdog).

---

## 2. Design decisions (would be `hx decision add`; hx is not installed)

**D1 Mechanism: frames stay scroll-driven, and the page glides between stop scroll positions.**
- A Lenis input gate (the `virtualScroll` option behind a registry in `LenisProvider`) and a window `keydown` listener turn each new gesture into one `lenis.scrollTo(stopY, { duration, easing: cruiseEase, lock: true, force: true })`.
- Frames, captions, DepthStage and ForexFade keep reading scroll exactly as today: one clock, no new smoothing stage, so no new lag.
- The gate registry accepts several zones, ready for Forex later.

**D2 Constant speed = fixed cruise rate.**
- `STEP_FPS = 48` unique frames/s (2x the 24 fps source motion), with `STEP_RAMP_S = 0.4` s of soft ease-in and ease-out. `duration = frames/48 + 0.4`, with a floor of 0.8 s.
- Step durations:

  | slab | frames | duration |
  |---|---|---|
  | 1 (1→112) | 89 | 2.25 s |
  | 2 (112→139) | 21 | 0.84 s |
  | 3 (139→179) | 32 | 1.07 s |

- The cruise speed is exactly 48 frames/s in every slab, in both directions, whatever the flick force.
- Rejected: a fixed duration per slab (a 1.2 s fixed duration runs slab 1 at 74 frames/s and slab 2 at 18 frames/s).
- `cruiseEase` is a smooth trapezoid: velocity rises with smoothstep, holds at cruise, then falls. The peak speed equals the cruise speed (`easeInOutCubic` would peak at 3x the average).
- Knob: `STEP_FPS`.

**D3 One gesture = one slab, plus a landing hold.**
- Wheel gestures are split by a pure tracker: a 180 ms silence, a sign flip, or a rise ≥ 12 px above 1.8x the decaying level (a fresh push inside an inertia tail).
- One touch = one slab (it commits at 24 px). One key press = one slab.
- Input during a glide is swallowed, and the gesture it belongs to is marked consumed (its tail included).
- Every landing then **holds at least 450 ms** (`HOLD_MIN_MS`). Even a brand-new gesture inside the hold is swallowed. This is the "soft snap / brief hold": the eased landing plus a guaranteed dwell on the exact frame with the caption fully shown.
- To continue, the user makes a new gesture after the hold. Whether a continuous scroll should auto-continue instead is Q1.

**D4 Entry catch, regardless of force.**
- **Wheel and keys:** when the scroll is outside the zone and the next Lenis target would cross an edge stop, the target is clamped to that stop with Lenis's own lerp. The page decelerates into frame 1 (from above) or frame 179 (from below, out of Forex), and the rest of the gesture is swallowed.
- **Native touch drag or momentum** (touch-driven only): on the first scroll event that crosses the edge, set `overflow: hidden` on `<html>` (this kills the fling or drag), jump to the stop, and unlock 120 ms after the finger is up.

**D5 Exits.**
- A **new** gesture at stop 0 going up, or at stop 3 going down, passes to Lenis or the browser untouched. Normal scrolling resumes: into the hero, or into the hand-off.
- Touch decides on its first touchmove, so an exit is never cancelled.

**D6 The hand-off at 179: re-time Crypto so the fade starts exactly at the 179 stop.**
- Crypto's frame mapping becomes piecewise-linear with a knot at the last stop:
  - list **0→142 over progress 0 → 5/7** (the first 250vh);
  - list **142→191 (raw 179→240) over 5/7 → 1** (the 100vh ForexFade).
- At the 179 stop the Forex sticky is at opacity 0: a clean, whole Crypto frame.
- After release, the same scroll keeps the coin moving under the dissolve while Forex rises in. At the fade end Forex is at frame 1 (list 0). That is the hand-off the owner already knows, minus the 10vh by which Forex used to overlap the stop. No jump.
- On mobile (large vh `L` ≥ dvh `D`) the stop is `(2/7)(L − D)` px **before** the fade start, never inside it (unit-tested).
- Pace: frames 0-142 get 250vh instead of 260vh (+4% frames per px), and 142-191 get 100vh instead of 90vh. When stepping, speed is set by D2 anyway.
- Rejected:
  - Starting ForexFade ≈ 10vh later: that is a magic offset tied to frame timing, it shortens the fade, and it shifts with vh/dvh.
  - Freezing Crypto on 179 under the fade: it drops the motion under the dissolve and reads as a stop followed by a cut.
- ForexFade, the Forex layout and Start journey stay untouched.

**D7 Exact frames at stops, on every screen.**
- Stops are list indices. Their scroll offsets come from the frame hook's own measured layout: `Y_k = top + progressAt(idx_k) × (height − viewportH)`.
- While resting (no glide running, Lenis idle, within 2 px of `Y_k`), `frameForProgress` returns the exact index if the computed position is within 0.5 frames. The engine then draws a single whole frame and the HUD reads `pos 89.00 / 110.00 / 142.00`.
- After a glide, if a resize moved the stop, the page re-jumps to it.
- The stop frames plus the last frame are pinned (`[0, 89, 110, 142, 191]`), so every landing frame is decoded first and never evicted.

**D8 Unique frames stay the default (owner).**
- Restore the committed `UNIQUE_LOCAL` wiring in sources.ts, CryptoMarketScroll and ForexMarketScroll.
- Remove `?allframes`. No replacement flag.
- Stop mapping: raw file N → the index of the largest unique local frame ≤ N − 1. A pulldown repeat maps to its twin.

**D9 Rail captions sit on the stops and change only between them.**
- The Crypto rail is driven by the stop coordinate `s` (see D10), mapped to `u = (s + 1)/5`.
- Hold windows are `s ± 0.1` around:
  - s = 0 (24/7, the entry),
  - s = 0.5 (kicker, mid-glide of slab 1),
  - s = 1 (Bitcoin & Ethereum),
  - s = 2 (On-chain data),
  - s = 3 (Programme 01 · Liquidity Analysis).
- The rail enters during the approach (s −0.5 → −0.1) and exits by s = 3.4, which is 40% into the hand-off fade.
- Every transition lies strictly between stops.
- "Futures basis" is dropped from the Crypto rail because there is no stop left for it before the hand-off (Q2). The Forex rail is unchanged.

**D10 Slab texts are scrubbed by a stop coordinate `s`, not timed.**
- `s` is:
  - `k` at stop k, linear in scroll between stops;
  - in `[−1, 0)` during the approach (the sticky rising over one viewport);
  - in `(3, 4]` during the hand-off fade.
- Each text part has opacity plus translateY (rise in 18 px, lift out 12 px), staggered, written from the Crypto frame tick. Reversing plays backwards.
- No React state, no CSS transitions. Reduced motion uses discrete 0/1 states.
- Windows (each text is fully shown at its stop and changes only between stops):

  | text | in | fully shown | out |
  |---|---|---|---|
  | slab 1 intro, right | −0.6 → −0.05 | stops 0 and 1 | 1.0 → 1.3 (as slab 2 starts) |
  | slab 2, MOP basics to trading | 1.35 → 1.85 | stop 2 | 2.0 → 2.3 (as slab 3 starts) |
  | slab 3, above the coin | 2.5 → 2.92 | stop 3 | 3.0 → 3.28 (first 28% of the hand-off) |

- Slab 3's text is visible only on raw ≈ 159-196, where the coin top is ≥ 480 (tested).

**D11 Placement.**
- **Slab 2: top-left on landscape ≥ md; the top band on phones and portrait.**
  - The brief's lower-left is taken by the ETH/SOL coins on the rocks in every frame from 112 to 139, and by the caption rail.
  - The top-left (anchored to the viewport: `left: max(1.5rem, 4.5vw)`, `top: 6.5rem`, `width: min(22rem, 28vw)`) is empty sky in 112-139. It mirrors slab 1's top-right, sits clear of the BTC flight (x ≥ 35%), the rail (bottom-left) and the nav pill (bottom ≈ 66 px).
  - Phones keep the label, the title and the path row; the body is hidden.
- **Slab 3: centred, above the coin.**
  - CSS `--coin-top: min(39dvh, 50dvh − 6.1vw)` on landscape and `40dvh` on portrait. It is derived from coin row 440 (40 rows of margin under the 480 minimum) under a cover fit, with DepthStage's worst-case push-in ×1.16.
  - The text bottom sits `clamp(.75rem, 2.5dvh, 1.5rem)` above it. Unit-tested over every viewport from 320 to 3840 x 320 to 1600.
  - At 1440x900 the text spans y 260-329, with the coin at 577.

**D12 One frame set per page load, and the HUD shows which one.**
- Keep the tier policy.
- The HUD (dev-only) prints the tier and the URL actually fetched, so a stop's source is never ambiguous. Stop frames are pinned, so they come first from the active set.
- To get identical files at every window size you would have to force one tier, which is not recommended: 2.5x the bytes on small windows, and no visible gain once the canvas is backing-capped.

**D13 Reduced motion.**
- Lenis is not created, so the controller attaches its own non-passive wheel and touch listeners.
- Glides and catches become instant jumps, and the 450 ms hold still applies (a spin cannot skip all the stops).
- The frames already draw whole frames; texts and rail switch discretely.

**D14 Start journey.**
- It lands on `#crypto-sequence` top, which is stop 0 exactly.
- Add `force: true` to its `scrollTo` calls so it wins over a running glide. The watchdog clears the interrupted glide.

**D15 Debug HUD is dev-only.**
- `FrameDebugHud` renders only when `process.env.NODE_ENV === 'development'`.
- The `?frames` production trigger is removed in all three places. Production builds drop it via dead-code elimination.

---

## 3. Changes and commits

Run `git status --short` before every phase and stage **only the files listed**. Leave the untracked `docs/plans/*/*.json` traces alone. **Never push.**

### Phase 0: plan only (commit "Plan: Crypto step scroll")
The earlier work is already committed (`887ff37`), so only the plan file is committed here. No code edits in this phase.
```bash
git add docs/plans/crypto-step-scroll.md
git commit -m "Plan: Crypto step scroll"
```

### Phase 1: remove `?allframes`, HUD dev-only, HUD shows tier and real file (commit "Frames: drop allframes switch; debug HUD dev-only with tier")
1. **Restore the committed unique wiring.**
   - First confirm these three diffs contain nothing but A/B lines:
     ```bash
     git diff HEAD -- lib/frame-sequence/sources.ts components/sections/CryptoMarketScroll.tsx components/sections/ForexMarketScroll.tsx | grep "^[-+]" | grep -v "TEMP allframes"
     ```
     Expect only the removed `UNIQUE_*` lines, the cfg blocks, `resolveSeq(seqs, …)`, and `cfg.` / `activeLocals` uses, all verified while planning.
   - Then run `git checkout HEAD -- lib/frame-sequence/sources.ts components/sections/CryptoMarketScroll.tsx components/sections/ForexMarketScroll.tsx`.
2. **`lib/frame-sequence/sources.ts`:** after `SEQ_SCROLL_VH` add
   ```ts
   /** Forex is pulled up by this much (marginTop) so it fades in over Crypto's last screen (components/fx/ForexFade.tsx). */
   export const FOREX_OVERLAP_VH = 100;
   ```
   In `ForexMarketScroll.tsx`, import it and set `marginTop: \`-${FOREX_OVERLAP_VH}vh\``. That is the only Forex edit.
3. **`lib/frame-sequence/engine.ts`:** add a public debug helper below `startFetch`'s section header:
   ```ts
   /** URL actually used for frame i (per-frame JPEG fallback aware). Debug HUD only. */
   urlOf(i: number): string {
     return (this.perFrameFallback[i] && this.fallbackUrls ? this.fallbackUrls[i] : this.urls[i]) ?? '';
   }
   ```
4. **`components/hooks/useFrameSequence.ts`** (keep every `// TEMP debug HUD` tag):
   - Import line: `import { UNIQUE_LOCAL, detectFrameTier, type FrameSet, type FrameTier } from '@/lib/frame-sequence/sources'; // UNIQUE_LOCAL: TEMP debug HUD`
   - `const hudOn = process.env.NODE_ENV === 'development'; // TEMP debug HUD`. The `?frames` trigger is gone.
   - In `hudSample`:
     - `const locals = UNIQUE_LOCAL;`
     - replace `mode: …` with `tier: HUD_TIER[tier], // TEMP debug HUD`
     - `file: engine.urlOf(shown).split('/').pop() ?? '', // TEMP debug HUD`
   - Module scope:
     ```ts
     const HUD_TIER: Record<FrameTier, string> = { full: 'full (JPEG 1920x1080)', lite: 'lite (WebP 1280x720)', portrait: 'portrait (WebP 864x1080 centre crop)' }; // TEMP debug HUD
     ```
5. **`components/debug/FrameDebugHud.tsx`:**
   - In `HudSample`, replace `mode: string; // TEMP allframes A/B…` with `tier: string; // frame set chosen at engine creation`.
   - `const head = parts.length ? \`frames: ${(f ?? c)?.tier}\n\` : '';`
   - `const on = process.env.NODE_ENV === 'development';`
   - Header comment: "Dev-only (never rendered in production builds)."
6. **`app/page.tsx`:** `{process.env.NODE_ENV === 'development' && <FrameDebugHud />} {/* TEMP debug HUD, dev-only */}`. This uses the same pattern as `LongTaskProbe`.
7. **`tests/frame-sources.test.mjs`:** add `FOREX_OVERLAP_VH` to the import, and `assert.equal(FOREX_OVERLAP_VH, 100)` inside 'uniqueLocalFrames drops pulldown duplicates'.
8. Verify, then commit:
   ```bash
   corepack pnpm test && corepack pnpm lint && corepack pnpm build
   git add lib/frame-sequence/sources.ts lib/frame-sequence/engine.ts components/sections/CryptoMarketScroll.tsx components/sections/ForexMarketScroll.tsx components/hooks/useFrameSequence.ts components/debug/FrameDebugHud.tsx app/page.tsx tests/frame-sources.test.mjs
   git commit -m "Frames: drop allframes switch; debug HUD dev-only with tier and fetched file"
   ```

### Phase 2: pure modules and tests (commit "Step scroll: pure stop, gesture, slab and rail math with tests")
Both files are import-free and use only erasable TypeScript, because `node --test` loads them directly. No `@/` imports and no sibling `.ts` imports.

**New `lib/step-scroll.ts`**
```ts
// Pure math for stepped frame scrolling (components/hooks/useStepScroll.ts). Import-free: node --test loads it.

/** Crypto stops picked by the owner with the HUD (unique mode): raw file numbers (ezgif-frame-NNN / NNN.webp), 1-based. */
export const CRYPTO_STOPS_RAW: readonly number[] = [1, 112, 139, 179];

export const STEP_FPS = 48;              // cruise speed, list (unique) frames per second: 2x the 24 fps source motion
export const STEP_RAMP_S = 0.4;          // ease-in and ease-out time at each end of a step
export const STEP_MIN_S = 0.8;           // floor for very short steps (21-frame slab 2 = 0.84 s stays unclamped)
export const HOLD_MIN_MS = 450;          // every landing holds at least this long; input inside it is swallowed
export const STOP_TOL_PX = 2;            // "at a stop": Lenis rests on window.scrollY (device-pixel rounded)
export const REST_SNAP_FRAMES = 0.5;     // at rest, a frame position this close to the stop index shows the stop frame exactly
export const GESTURE_GAP_MS = 180;       // wheel silence that ends a gesture
export const GESTURE_LEVEL_TAU_MS = 240; // decay of the wheel level between events
export const GESTURE_RISE = 1.8;         // |delta| above level x this ...
export const GESTURE_RISE_MIN = 12;      // ... and at least this many px = a fresh push inside an inertia tail
export const SWIPE_MIN_PX = 24;          // touch travel that commits one step
export const SETTLE_IDLE_MS = 220;       // after native movement (scrollbar, find) stops inside the zone, glide to the nearest stop
export const MOMENTUM_WINDOW_MS = 2500;  // native scroll this soon after a touch counts as touch momentum (entry catch applies)
export const OVERFLOW_UNLOCK_MS = 120;   // root overflow lock (touch catch) is released this long after the finger is up
export const KEY_ARROW_PX = 80;          // assumed native distance of an arrow key (catch test)
export const KEY_PAGE_SHARE = 0.9;       // PageDown / Space distance as a share of the viewport
export const GLIDE_WATCHDOG_MS = 400;    // a glide not completed by duration + this is dead (lenis.stop(), overrides)

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

/** Scroll offset (px) of a stop. range = section height - viewport height (the frame hook's measured layout). */
export function stopScrollY(idx: number, total: number, knotIdx: number, knotP: number, top: number, range: number): number {
  return top + progressAt(idx, total, knotIdx, knotP) * range;
}

/** Step duration (s): frames at fps plus one ramp (two half-speed ramps of `ramp`), floored at `min`. */
export function stepDuration(frames: number, fps: number = STEP_FPS, ramp: number = STEP_RAMP_S, min: number = STEP_MIN_S): number {
  return Math.max(min, Math.abs(frames) / (fps > 0 ? fps : STEP_FPS) + ramp);
}

/** Ramp share of a step for cruiseEase. */
export function rampShare(duration: number, ramp: number = STEP_RAMP_S): number {
  return duration > 0 ? clamp(ramp / duration, 0, 0.5) : 0.5;
}

/**
 * Position 0..1 at time t 0..1 for a smooth trapezoid velocity profile: velocity rises with smoothstep over [0, a],
 * holds 1 / (1 - a), and falls over [1 - a, 1]. a is clamped to [0, 0.5]. Symmetric: e(t) + e(1 - t) = 1.
 */
export function cruiseEase(t: number, a: number): number {
  const x = clamp(Number.isNaN(t) ? 0 : t, 0, 1);
  const r = clamp(Number.isNaN(a) ? 0 : a, 0, 0.5);
  if (r === 0) return x;
  const v = 1 / (1 - r);
  const S = (u: number): number => u * u * u - (u * u * u * u) / 2; // integral of smoothstep, S(1) = 1/2
  if (x < r) return v * r * S(x / r);
  if (x > 1 - r) return 1 - v * r * S((1 - x) / r);
  return v * (r / 2 + (x - r));
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
  busy: boolean;                      // a glide is running or the landing hold (HOLD_MIN_MS) is active
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
  if (i.y < first - tol) return i.dir > 0 && i.target >= first - tol ? { kind: 'catch', stop: 0 } : PASS;
  if (i.y > last + tol) return i.dir < 0 && i.target <= last + tol ? { kind: 'catch', stop: n - 1 } : PASS;
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
```

**New `lib/crypto-slabs.ts`**
```ts
// Pure timing and geometry for the Crypto slab texts (components/sections/CryptoSlabs.tsx) and the Crypto caption
// rail timing (lib/scroll-captions.ts CRYPTO_FLOW). Import-free.

/** In over [inFrom, inTo], fully shown until outFrom, out over [outFrom, outTo]. Units: stop coordinate s (lib/step-scroll stopCoord). */
export interface SlabWindow { inFrom: number; inTo: number; outFrom: number; outTo: number }
export type SlabId = 'intro' | 'teach' | 'close';

// s: -1..0 approach, 0..3 the three slabs (stops raw 1, 112, 139, 179), 3..4 the hand-off fade into Forex.
export const CRYPTO_SLAB_WINDOWS: Readonly<Record<SlabId, SlabWindow>> = {
  intro: { inFrom: -0.6, inTo: -0.05, outFrom: 1.0, outTo: 1.3 },  // slab 1: in on entry, out as slab 2 starts
  teach: { inFrom: 1.35, inTo: 1.85, outFrom: 2.0, outTo: 2.3 },   // slab 2: in during 112->139, out as slab 3 starts
  close: { inFrom: 2.5, inTo: 2.92, outFrom: 3.0, outTo: 3.28 },   // slab 3: in late in 139->179, out in the first 28% of the hand-off
};

export const SLAB_STAGGER = 0.07; // s between consecutive parts entering
export const SLAB_RISE_PX = 18;   // parts rise this much while entering
export const SLAB_LIFT_PX = 12;   // and lift this much while leaving

export interface PartStyle { opacity: number; y: number }

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number): number => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const ramp = (x: number, a: number, b: number): number => (b > a ? clamp01((x - a) / (b - a)) : x >= b ? 1 : 0);

/** Style of part j of n at stop coordinate s. Continuous in s; reduced = discrete 0/1 at the window midpoints, no movement. */
export function slabPart(s: number, w: SlabWindow, j: number, n: number, reduced: boolean = false, out?: PartStyle): PartStyle {
  const o: PartStyle = out ?? { opacity: 0, y: 0 };
  const x = Number.isNaN(s) ? -Infinity : s;
  if (reduced) {
    o.opacity = x >= (w.inFrom + w.inTo) / 2 && x < (w.outFrom + w.outTo) / 2 ? 1 : 0;
    o.y = 0;
    return o;
  }
  const count = Math.max(1, Math.floor(n));
  const idx = Math.min(Math.max(0, Math.floor(j)), count - 1);
  const span = w.inTo - w.inFrom;
  const stag = count > 1 ? Math.min(SLAB_STAGGER, span / (2 * (count - 1))) : 0;
  const vin = smooth(ramp(x, w.inFrom + idx * stag, w.inTo - (count - 1 - idx) * stag));
  const vout = smooth(ramp(x, w.outFrom, w.outTo));
  o.opacity = vin * (1 - vout);
  o.y = (1 - vin) * SLAB_RISE_PX - vout * SLAB_LIFT_PX;
  return o;
}

// ── Caption rail timing (Crypto): holds centred on stops, transitions strictly between them ──
export const S_MIN = -1;                 // stop coordinate range for 4 stops: approach .. end of the hand-off fade
export const S_MAX = 4;
/** Maps the stop coordinate onto the rail's 0..1 flow axis (ScrollCaptions clamps its input to 0..1). */
export function railU(s: number): number {
  return (s - S_MIN) / (S_MAX - S_MIN);
}
export const CRYPTO_RAIL_HOLDS_S: readonly number[] = [0, 0.5, 1, 2, 3]; // 24/7 (entry), kicker (mid slab 1), stops 112, 139, 179
export const CRYPTO_RAIL_HOLD_HALF = 0.1;
export const CRYPTO_RAIL_FROM_S = -0.5;  // rail starts entering during the approach
export const CRYPTO_RAIL_TO_S = 3.4;     // gone 40% into the hand-off fade
/** FlowSpec-compatible windows (lib/caption-flow.ts) for the Crypto rail. */
export function cryptoRailSpec(): { from: number; to: number; steps: { start: number; end: number }[] } {
  return {
    from: railU(CRYPTO_RAIL_FROM_S),
    to: railU(CRYPTO_RAIL_TO_S),
    steps: CRYPTO_RAIL_HOLDS_S.map((s) => ({ start: railU(s - CRYPTO_RAIL_HOLD_HALF), end: railU(s + CRYPTO_RAIL_HOLD_HALF) })),
  };
}

// ── Coin clearance for the slab 3 text (mirrors .cslab--close in app/globals.css) ──
/** Rows (of 1080) the text must stay above. The BTC top is >= 480 for raw 157-198 (measured); the close window shows the text only there. */
export const COIN_CLEAR_ROW = 440;
export const DEPTH_MAX_SCALE = 1.16;   // DepthStage worst-case push-in about the centre: cover 1.07 x translateZ <= 88px at perspective 1200
const SRC_W = 1920;
const SRC_H = 1080;
const PORTRAIT_ASPECT = 0.8;          // lib/frame-sequence/sources.ts PORTRAIT_MAX_ASPECT (portrait tier: full rows, no DepthStage)

/** Viewport y (px) of row COIN_CLEAR_ROW for a W x H sticky. Landscape tiers: cover-fit 1920x1080 plus push-in k. */
export function coinTopPx(W: number, H: number, k: number = DEPTH_MAX_SCALE): number {
  if (!(W > 0 && H > 0)) return 0;
  if (W / H <= PORTRAIT_ASPECT) return (COIN_CLEAR_ROW / SRC_H) * H;
  const s = Math.max(W / SRC_W, H / SRC_H);
  const y = COIN_CLEAR_ROW * s - (SRC_H * s - H) / 2;
  return H / 2 + (y - H / 2) * k;
}

/** The CSS value --coin-top: min(39dvh, 50dvh - 6.1vw) on landscape, 40dvh on portrait (<= 4/5). */
export function coinSafeTopPx(W: number, H: number): number {
  if (!(W > 0 && H > 0)) return 0;
  return W / H <= PORTRAIT_ASPECT ? 0.40 * H : Math.min(0.39 * H, 0.5 * H - 0.061 * W);
}
```

**New `tests/step-scroll.test.mjs`**
- Imports: `'../lib/step-scroll.ts'` and `uniqueLocalFrames` from `'../lib/frame-sequence/sources.ts'`.
- Helpers: `near(a, b, eps = 1e-9)`, `U = uniqueLocalFrames()`, `ST = [0, 89, 110, 142]`, `KP = 5/7`.

1. `stopListIndex`:
   - `CRYPTO_STOPS_RAW.map(r => stopListIndex(r, U))` deep-equals `ST`;
   - raw 3 (a pulldown repeat) → 1;
   - raw 240 → 191;
   - raw 0 → 0.
2. `knotProgress(350, 100)` is near 5/7.
3. `framePos`:
   - `framePos(0, 192, 142, KP) === 0`;
   - `near(framePos(KP, 192, 142, KP), 142)`;
   - `framePos(1, …) === 191`;
   - monotone over 1000 samples;
   - continuous at the knot (`|f(KP+1e-9) − f(KP−1e-9)| < 1e-5`).
4. Round trip: for pos in {0, 44.5, 89, 110, 142, 160, 191}, `near(framePos(progressAt(pos, 192, 142, KP), 192, 142, KP), pos, 1e-9)`.
5. Desktop stops: top 1000, viewport 1000, height 4500, so range 3500. `ys = ST.map(i => stopScrollY(i, 192, 142, KP, 1000, 3500))`.
   - `ys[0] === 1000`;
   - `near(ys[3], 3500)`, which is the ForexFade start (Forex top − innerHeight = 4500 − 1000);
   - ys strictly ascending.
   - Each `ys[k]` maps back exactly: `near(framePos(sectionProgressOf(ys[k], 1000, 4500, 1000), 192, 142, KP), ST[k])`.
6. Mobile, never inside the fade: for L = 1000 and D ∈ {1000, 950, 900, 800}, `stopScrollY(142, 192, 142, KP, 0, 4.5*L − D) <= 3.5*L − D + 1e-9`.
7. `stepDuration`:
   - 89 → near(2.25417, 1e-5), 21 → near(0.8375), 32 → near(1.06667, 1e-5);
   - for each, the cruise speed `f / (d − STEP_RAMP_S)` is near 48;
   - 5 → 0.8 (floor).
8. `cruiseEase`:
   - `e(0) = 0` and `e(1) = 1` for a ∈ {0, 0.1, 0.37, 0.48, 0.5, 0.9};
   - monotone over 1000 samples;
   - `near(e(t) + e(1 − t), 1, 1e-12)`;
   - continuous at the joins (`< 1e-6`);
   - the finite-difference slope is ≤ `1/(1 − a) + 1e-6` and equals it mid-cruise;
   - `a = 0` is the identity, and a > 0.5 behaves like 0.5.
9. `feedWheel` (times in ms):
   - mouse spin, 10 × 100 every 40 ms → 1 fresh;
   - notches 300 ms apart → each fresh;
   - trackpad swipe 2, 5, 9, 14, 20, 26, 30 (16 ms apart), then a tail `30 × 0.94^k` for 2 s → 1 gesture;
   - the same tail with a new push `3, 6, 12, 22, 35` inserted → exactly 2 gestures, and the fresh flag falls on the 12;
   - a sign flip → fresh.
10. `decideStep` with `ys = [1000, 2567, 2937, 3500]` and tol 2:

    | case | input | expected |
    |---|---|---|
    | above, no cross | y 500, target 900, dir 1 | pass |
    | above, crossing | y 500, target 1200, dir 1, acted 'pass' | catch 0 |
    | above, moving away | y 500, dir −1 | pass |
    | stop 0 | y 1000.5, dir 1, fresh | glide 1 |
    | stop 0, tail | same, not fresh, acted 'consume' | swallow |
    | stop 0, exit | y 1000, dir −1, fresh | pass |
    | stop 3, exit | y 3500, dir 1, fresh | pass |
    | stop 3, tail of exit | y 3501, dir 1, not fresh, acted 'pass' | pass |
    | stop 3, back | y 3500, dir −1, fresh | glide 2 |
    | below, crossing | y 4000, target 3400, dir −1 | catch 3 |
    | between stops | y 2700, dir 1 | glide 2 |
    | between stops | y 2700, dir −1 | glide 1 |
    | busy | busy true (any position) | swallow |
    | stop 2, not fresh, no record | acted null | swallow |
11. `stopAt` / `nearestStop`: 1001 → 0 / 0, 1003 → −1 / 0, 2700 → −1 / 1.
12. `stopCoord` with ys above, approach 1000, exit 1000: ys[k] → k. The midpoint of ys[1] and ys[2] → 1.5. 500 → −0.5. −5000 → −1. 4000 → 3.5. 9000 → 4.

**New `tests/crypto-slabs.test.mjs`**
- Imports: `'../lib/crypto-slabs.ts'`, `flowState` from `'../lib/caption-flow.ts'`, and `uniqueLocalFrames` from `'../lib/frame-sequence/sources.ts'`.

1. The windows are ordered and separate: `intro.outTo <= teach.inFrom` and `teach.outTo <= close.inFrom`. Each has `inFrom < inTo <= outFrom < outTo`.
2. Fully shown at the stops (every part opacity 1 and y 0):
   - intro (n = 4) at s = 0 and s = 1;
   - teach (n = 4) at s = 2;
   - close (n = 2) at s = 3.
3. Hidden: everything at s = −1. Intro at s ≥ 1.3, teach at s = 1 and s = 3, close at s ≤ 2.5 and s ≥ 3.28.
4. Continuity: for each slab and j < n, over s ∈ [−1, 4] in steps of 1e-4, the max |Δopacity| is < 0.01 and the max |Δy| is < 0.1. In the middle of the intro in-window, part 0 opacity ≥ part 3 opacity.
5. Reduced: values are only 0 or 1, y is always 0, and the state flips at the window midpoints.
6. Close only while the coin is low. For s in [2, 4] in steps of 0.001, wherever any close part has opacity > 0:
   - `list = s < 3 ? 110 + (s − 2) × 32 : 142 + (s − 3) × 49`;
   - for both `floor(list)` and `ceil(list)`, `uniqueLocalFrames()[i] + 1` lies in [157, 198].
7. Coin clearance: for W 320..3840 and H 320..1600 in steps of 8, `coinSafeTopPx(W, H) <= coinTopPx(W, H)` (planning check: worst margin 0.34 px, plus the CSS gap).
8. Rail, using `spec = cryptoRailSpec()`:
   - for k = 0..3, `flowState(railU(k), spec)` has `index === [0, 2, 3, 4][k]` with `draw === 0`, `advance === 0`, `enter === 1` and `exit === 0`;
   - `flowState(railU(3.4), spec).exit === 1`;
   - `spec.from < spec.steps[0].start`, the windows are disjoint and ascending, and `spec.steps[4].end < spec.to`.

```bash
node --test tests/step-scroll.test.mjs tests/crypto-slabs.test.mjs && corepack pnpm lint
git add lib/step-scroll.ts lib/crypto-slabs.ts tests/step-scroll.test.mjs tests/crypto-slabs.test.mjs
git commit -m "Step scroll: pure stop, gesture, slab and rail math with tests"
```

### Phase 3: plumbing (commit "Step scroll: Lenis input gate, layout and scroll in frame updates, Start journey force")

**`components/providers/LenisProvider.tsx`**
```ts
import Lenis, { type VirtualScrollData } from 'lenis';
/** Input gate: return false to consume a wheel/touch event (Lenis then ignores it; the gate must call preventDefault itself). */
export type ScrollGate = (data: VirtualScrollData) => boolean;
const gates = new Set<ScrollGate>();
/** Registers a gate; returns the unregister function. Every gate sees every event; any false consumes it. */
export function addScrollGate(gate: ScrollGate): () => void {
  gates.add(gate);
  return () => { gates.delete(gate); };
}
function runGates(data: VirtualScrollData): boolean {
  let pass = true;
  for (const g of gates) pass = g(data) && pass;
  return pass;
}
```
Add `virtualScroll: runGates,` to the `new Lenis({...})` options. Change nothing else.

**`components/hooks/useFrameSequence.ts`**
- Rename `interface Layout` to `export interface SequenceLayout { top: number; height: number; viewportH: number }` and update `layoutRef`'s type.
- In `FrameSequenceUpdate`, add `pos: number;` (the fractional frame position requested) and `scroll: number;` (the scroll offset used this tick).
- In `UseFrameSequenceOptions`, add `/** Called after every layout measure (mount, resize). */ onLayout?: (layout: Readonly<SequenceLayout>) => void;`
- At the end of `measure()`: `optsRef.current.onLayout?.(layout);`
- In `tick`:
  ```ts
  const scroll = currentScroll();
  const L = layoutRef.current;
  const target = sectionProgress(scroll, L.top, L.height, L.viewportH);
  ```
  This replaces the `targetProgress()` call (keep the function for the activeIO snap). Pass `opts.onUpdate?.({ progress: p, frame, shownFrame: shown, pos, scroll })`.

**`lib/start-journey.ts`**: add `force: true` to all three `lenis.scrollTo(...)` calls. Nothing else changes.

```bash
corepack pnpm test && corepack pnpm lint && corepack pnpm build
git add components/providers/LenisProvider.tsx components/hooks/useFrameSequence.ts lib/start-journey.ts
git commit -m "Step scroll: Lenis input gate, layout and scroll in frame updates, Start journey force"
```

### Phase 4: controller (commit "Step scroll: one gesture per slab with landing hold")

**New `components/hooks/useStepScroll.ts`** (`'use client'`)

Imports:
- `useEffect` and `useState` from react
- `import type Lenis from 'lenis'` and `import type { VirtualScrollData } from 'lenis'`
- `addScrollGate` and `useLenis` from `@/components/providers/LenisProvider`
- `type SequenceLayout` from `@/components/hooks/useFrameSequence`
- every needed name from `@/lib/step-scroll`

```ts
export interface StepScrollOptions {
  /** Stop list indices, ascending (Crypto [0, 89, 110, 142]). The last stop is the knot (see framePos). */
  stops: readonly number[];
  /** Frame list length (Crypto 192). */
  total: number;
  /** Progress at which the last stop is shown (Crypto 5/7 = ForexFade start). */
  knotP: number;
  /** Cruise speed in list frames per second. Default STEP_FPS. */
  fps?: number;
}

interface TouchState {
  active: boolean; multi: boolean; x0: number; y0: number;
  engaged: boolean;   // started inside the zone or while busy: moves are cancelled unless released
  decided: boolean;   // first move evaluated
  released: boolean;  // native for the rest of this touch (exit or horizontal)
  committed: boolean; // this touch already stepped (or must never step)
  lastEnd: number;    // performance.now() of the last touchend
}

export class StepScrollController {
  onLayout = (l: Readonly<SequenceLayout>): void => { /* below */ };
  /** Exact stop index while resting on it, else the computed position. */
  frameFor = (pos: number): number => (this.restIdx >= 0 && Math.abs(pos - this.restIdx) <= REST_SNAP_FRAMES ? this.restIdx : pos);
  /** Stop coordinate for a scroll offset (slab texts, rail). */
  coord = (scroll: number): number => { /* below */ };
  attach(lenis: Lenis | null): () => void { /* below */ }
}

export function useStepScroll(options: StepScrollOptions): StepScrollController {
  const [ctl] = useState(() => new StepScrollController(options));
  const lenis = useLenis();
  useEffect(() => ctl.attach(lenis), [ctl, lenis]);
  return ctl;
}
```
The component only calls methods or arrow properties. It never mutates fields during render, which keeps the React Compiler lint rules quiet.

**Private state:**
- `stops`, `total`, `knotIdx = stops[stops.length - 1]`, `knotP`, `fps = options.fps ?? STEP_FPS`.
- `ys: number[] = []` and `layout = { top: 0, height: 0, viewportH: 0 }`.
- `ready = false` and `firstLayout = true`.
- `lenis: Lenis | null = null`.
- `gliding = false`, `glideDeadline = 0`, `holdUntil = 0`.
- `restStop = -1` and `restIdx = -1`.
- `wheel = createWheelGesture()`.
- `acted = { id: 0, kind: 'pass' as 'consume' | 'pass' }`. Wheel ids are ≥ 1 and key ids ≤ −1.
- `keySeq = 0`.
- `touch: TouchState` = all false, numbers 0, `lastEnd = -1e12`.
- `prevY = 0`, `inCatch = false`, `locked = false`.
- `settleTimer` and `unlockTimer`: `ReturnType<typeof setTimeout> | null`.

**Helpers:**
- `y()`: `this.lenis ? this.lenis.animatedScroll : window.scrollY`.
- `busy()`: `this.gliding || performance.now() < this.holdUntil`.
- `inZone(y)`: `n > 0 && y >= ys[0] - STOP_TOL_PX && y <= ys[n-1] + STOP_TOL_PX`.
- `posAt(y)`: `framePos(sectionProgressOf(y, top, height, viewportH), total, knotIdx, knotP)`.
- `watchdog()`: `if (this.gliding && performance.now() > this.glideDeadline) { this.gliding = false; this.refreshRest(); }`.
- `refreshRest()`:
  ```ts
  const L = this.lenis;
  const moving = this.gliding || (L !== null && L.isScrolling !== false);
  const k = moving || !this.ready ? -1 : stopAt(this.ys, this.y(), STOP_TOL_PX);
  if (k >= 0 && this.restStop < 0) this.holdUntil = performance.now() + HOLD_MIN_MS; // landing: brief hold
  this.restStop = k; this.restIdx = k >= 0 ? this.stops[k] : -1;
  ```
- `jump(Y)`: `this.lenis ? this.lenis.scrollTo(Y, { immediate: true, force: true }) : window.scrollTo({ top: Y, behavior: 'instant' })`, then `refreshRest()`.
- `blocked()`: `!!L && (L.isStopped || (L.isLocked && !this.gliding))`. The mobile menu, the gallery modal, or another locked glide such as Start journey take precedence.

**`onLayout(l)`:**
1. Copy `l` into `this.layout` and compute `ys = stops.map(i => stopScrollY(i, total, knotIdx, knotP, l.top, l.height - l.viewportH))`.
2. Set `ready = l.height > l.viewportH && ys.length > 0`. If not ready, return.
3. If not gliding:
   - if `restStop >= 0` and `|y() − ys[restStop]| > STOP_TOL_PX`, call `jump(ys[restStop])` (a resize moved the stop);
   - otherwise, if `firstLayout`, `inZone(y())` and `stopAt(ys, y(), tol) < 0`, call `jump(ys[nearestStop(ys, y())])` (reload restored mid-zone).
4. Set `firstLayout = false`, `prevY = y()` and call `refreshRest()`.

**`coord(scroll)`:**
```ts
const n = this.ys.length;
if (n === 0) return -1;
const exit = this.layout.top + (this.layout.height - this.layout.viewportH) - this.ys[n - 1]; // the hand-off fade
return stopCoord(scroll, this.ys, this.layout.viewportH, exit);
```

**`glideTo(k)`:**
```ts
const Y = this.ys[k]; const L = this.lenis;
this.restStop = -1; this.restIdx = -1;
const frames = Math.abs(this.posAt(Y) - this.posAt(this.y()));
if (!L || frames < 1e-3) { this.jump(Y); return; }             // reduced motion (no Lenis): straight to the stop
const d = stepDuration(frames, this.fps); const share = rampShare(d);
this.gliding = true;
this.glideDeadline = performance.now() + d * 1000 + GLIDE_WATCHDOG_MS;
L.scrollTo(Y, { duration: d, easing: (t) => cruiseEase(t, share), lock: true, force: true,
  onComplete: () => {
    this.gliding = false;
    if (Math.abs(this.y() - this.ys[k]) > STOP_TOL_PX) this.jump(this.ys[k]); // layout moved during the glide
    this.refreshRest();
  } });
```

**`catchTo(k)`** (wheel and keys, entry):
```ts
const Y = this.ys[k]; const L = this.lenis;
if (!L) { this.jump(Y); return; }
if (L.targetScroll !== Y) L.scrollTo(Y, { programmatic: false, lerp: L.options.lerp, force: true });
```
Rest and the landing hold are picked up by `refreshRest()` when Lenis finishes and emits `scroll` with `isScrolling === false`.

**`apply(a: StepAction, e: Event, id: number): boolean`** (true = let it through):
- `pass`: `acted = { id, kind: 'pass' }`, then return true.
- Anything else: `acted = { id, kind: 'consume' }`, then `if (e.cancelable) e.preventDefault();`. For `glide`, call `glideTo(a.stop)`; for `catch`, call `catchTo(a.stop)`. Return false.

**`onInput = (data: VirtualScrollData): boolean`** (the Lenis gate; the native adapter calls it too):
```ts
const e = data.event;
if (e.type === 'wheel') {
  const we = e as WheelEvent;
  if (we.ctrlKey || data.deltaY === 0) return true;                 // pinch-zoom / horizontal
  const fresh = feedWheel(this.wheel, we.timeStamp, data.deltaY);   // always fed: keeps gesture timing exact
  if (!this.ready || this.blocked()) return true;
  this.watchdog();
  const y = this.y(); const L = this.lenis; const id = this.wheel.id;
  return this.apply(decideStep(this.ys, STOP_TOL_PX, {
    y, target: (L ? L.targetScroll : y) + data.deltaY, dir: data.deltaY > 0 ? 1 : -1, fresh,
    acted: this.acted.id === id ? this.acted.kind : null, busy: this.busy(),
  }), we, id);
}
if (!this.ready || this.blocked()) return true;
this.watchdog();
return this.onTouch(e as TouchEvent);
```

**`onTouch(e: TouchEvent): boolean`** (`t = this.touch`):
- **`touchstart`**
  - If `e.touches.length > 1`: `t.multi = true`, return true.
  - Otherwise: `t.active = true; t.multi = false; t.x0/t.y0 = touches[0].clientX/Y; t.decided = false; t.released = false; t.engaged = this.busy() || this.inZone(this.y()); t.committed = this.busy();` then return true. Never cancel a touchstart: taps and links must work.
- **`touchmove`**
  - If `!t.active || t.multi || e.touches.length > 1`: `t.multi = true`, return true.
  - If `t.released || !t.engaged`, return true. Native scroll is fine; the entry catch happens in `onScroll`.
  - `dx = clientX − x0` and `up = y0 − clientY` (positive = scroll down).
  - If `!t.decided`: set `t.decided = true`.
    - If `|dx| > |up|`: `t.released = true`, return true (horizontal).
    - If `!this.busy() && !t.committed` and `decideStep(ys, tol, { y, target: y + up, dir: up >= 0 ? 1 : -1, fresh: true, acted: null, busy: false }).kind === 'pass'`: `t.released = true`, return true. This is an exit at stop 0 up or stop 3 down, so native scroll and momentum work.
  - `if (e.cancelable) e.preventDefault();`
  - If `!t.committed && !this.busy() && |up| >= SWIPE_MIN_PX`: set `t.committed = true`, run `decideStep(...)` with `dir: up > 0 ? 1 : -1` and `fresh: true`, then `glideTo` or `catchTo` if it says so. A `pass` here means the finger reversed into an exit: do nothing.
  - Return false.
- **`touchend`**
  - `t.active = false; t.lastEnd = performance.now();` and `if (e.touches.length === 0) t.multi = false;`
  - If `locked`, call `unlockSoon()`. Return true.

**`onKey = (e: KeyboardEvent): void`** (window `keydown`):
1. If `!ready`, `e.defaultPrevented`, `altKey`, `ctrlKey`, `metaKey` or `blocked()`: return.
2. `dir`: ArrowDown, PageDown and Space (no Shift) → 1. ArrowUp, PageUp and Shift+Space → −1. Any other key (Home and End included) → return.
3. If the target is editable, return. Editable means `el.isContentEditable` or `el.closest('input, textarea, select')`. For Space only, also return for `el.closest('button, a[href], summary, [role="button"]')`.
4. `watchdog()`. `if (!e.repeat) this.keySeq -= 1; const id = this.keySeq;`
5. `step = e.key.startsWith('Arrow') ? KEY_ARROW_PX : KEY_PAGE_SHARE * layout.viewportH`.
6. `apply(decideStep(ys, tol, { y, target: y + dir * step, dir, fresh: !e.repeat, acted: acted.id === id ? acted.kind : null, busy: busy() }), e, id)`.

**`onScroll = (): void`** (Lenis `'scroll'` event, or window `scroll` when there is no Lenis):
```ts
if (!this.ready || this.inCatch) return;
this.watchdog();
const y = this.y(); const L = this.lenis;
const native = !L || L.isScrolling === 'native';
if (native && !this.gliding) {
  const n = this.ys.length; const first = this.ys[0]; const last = this.ys[n - 1];
  const touchy = this.touch.active || performance.now() - this.touch.lastEnd < MOMENTUM_WINDOW_MS;
  if (touchy) {
    if (this.prevY < first - STOP_TOL_PX && y >= first - STOP_TOL_PX) { this.touchCatch(0); return; }
    if (this.prevY > last + STOP_TOL_PX && y <= last + STOP_TOL_PX) { this.touchCatch(n - 1); return; }
  } else if (y > first + STOP_TOL_PX && y < last - STOP_TOL_PX) {
    this.armSettle();
  }
}
this.prevY = y;
this.refreshRest();
```

**`touchCatch(k)`:**
1. `inCatch = true`.
2. If not already locked: `locked = true` and `document.documentElement.style.overflow = 'hidden'`.
3. `prevY = ys[k]`, then `jump(ys[k])`, then `inCatch = false`.
4. Update the touch: `t.engaged = true; t.decided = true; t.released = false; t.committed = true;`.
5. If `!t.active`, call `unlockSoon()`.

**`unlockSoon()`:** clear `unlockTimer`, then `setTimeout(OVERFLOW_UNLOCK_MS)`. When it fires, if no touch is active, set `locked = false` and `document.documentElement.style.overflow = ''`.

**`armSettle()`:** clear `settleTimer`, then `setTimeout(settle, SETTLE_IDLE_MS)`.

**`settle()`:** if `!ready`, `gliding`, `touch.active` or `blocked()`, return. Otherwise, if `inZone(y)` and `stopAt(ys, y, tol) < 0`, call `glideTo(nearestStop(ys, y))`.

**`attach(lenis)`:**
```ts
this.lenis = lenis; this.prevY = this.ready ? this.y() : 0;
const offs: Array<() => void> = [];
if (lenis) {
  offs.push(addScrollGate(this.onInput));
  offs.push(lenis.on('scroll', this.onScroll));
} else {
  // Reduced motion (no Lenis): own non-passive listeners, same policy, instant jumps.
  const onWheel = (e: WheelEvent): void => {
    const m = e.deltaMode === 1 ? 100 / 6 : e.deltaMode === 2 ? window.innerHeight : 1; // same as Lenis VirtualScroll
    this.onInput({ deltaX: e.deltaX * m, deltaY: e.deltaY * m, event: e });
  };
  const onTouch = (e: TouchEvent): void => { this.onInput({ deltaX: 0, deltaY: 0, event: e }); };
  const opt = { passive: false } as const;
  window.addEventListener('wheel', onWheel, opt);
  window.addEventListener('touchstart', onTouch, opt);
  window.addEventListener('touchmove', onTouch, opt);
  window.addEventListener('touchend', onTouch, opt);
  window.addEventListener('scroll', this.onScroll, { passive: true });
  offs.push(() => { /* remove the five listeners with the same options */ });
}
window.addEventListener('keydown', this.onKey);
offs.push(() => window.removeEventListener('keydown', this.onKey));
this.refreshRest();
return () => {
  for (const off of offs) off();
  if (this.settleTimer) clearTimeout(this.settleTimer);
  if (this.unlockTimer) clearTimeout(this.unlockTimer);
  this.settleTimer = this.unlockTimer = null;
  if (this.locked) { this.locked = false; document.documentElement.style.overflow = ''; }
  this.gliding = false; this.lenis = null;
};
```

Performance notes:
- Nothing runs per frame except `onScroll`, which is arithmetic on `lenis.animatedScroll`. It runs inside Lenis's emit in the `update` step, before the frame `render` step.
- No layout reads: the layout comes only from the frame hook's `measure()`.
- `window.scrollY` is read only in the no-Lenis path, inside event handlers, as the existing hook already does.

```bash
corepack pnpm lint && corepack pnpm build
git add components/hooks/useStepScroll.ts
git commit -m "Step scroll: one gesture per slab with landing hold"
```

### Phase 5: Crypto wiring, slab texts, rail re-timing, copy, CSS (commit "Crypto: stepped slabs, slab texts, rail on stops, clean hand-off at 179")

**`lib/content.ts`**: append after `CLOSING_LINES` (draft copy, no numbers or new claims beyond the owner's brief):
```ts
// ─── Crypto step slabs (components/sections/CryptoSlabs.tsx) ────────────────
export interface CryptoSlabCopy {
  /** Wide-tracked small-caps label. */
  label: string;
  /** Display serif title: [plain part, gold italic part]. */
  title: readonly [string, string];
  /** Optional paragraph (hidden on phones, portrait and short screens). */
  body?: string;
  /** Optional path row, separated by gold diamonds. */
  path?: readonly string[];
}
/** Slab 2 (frames 112 -> 139). DRAFT for the owner to edit: how Master of Pipsology teaches crypto, basics to trading. */
export const CRYPTO_SLAB_TEACH: CryptoSlabCopy = {
  label: 'How we teach crypto',
  title: ['From the very basics', 'to your first trade.'],
  body: 'We start at zero: what crypto is, how exchanges work, how to read a chart. Then structure, liquidity and risk, step by step, until you can plan and manage a trade on your own.',
  path: ['Basics', 'Structure', 'Risk', 'Trading'],
};
/** Slab 3 (frames 139 -> 179, the hand-off stop): centred above the falling coin. DRAFT for the owner to edit. */
export const CRYPTO_SLAB_CLOSE: CryptoSlabCopy = {
  label: 'Asset class 01 · Crypto',
  title: ['Every coin moves on structure.', 'Learn to read it.'],
};
```

**`lib/scroll-captions.ts`:** re-time `CRYPTO_FLOW` onto the stops. Add `import { cryptoRailSpec } from '@/lib/crypto-slabs';` and replace the Crypto block:
```ts
// Crypto: driven by the stop coordinate (CryptoMarketScroll passes railU(s)): one hold per stop, transitions only between stops.
const cryptoRail = cryptoRailSpec();
const cryptoLines: Array<[string, string]> = [
  [crypto.heading, crypto.body.split(' exhibit')[0]], // entry (raw 1): "Crypto markets run 24/7"
  [crypto.heading, crypto.kicker],                    // passes mid-glide of slab 1
  [crypto.heading, crypto.tags[0]],                   // stop raw 112: Bitcoin & Ethereum
  [crypto.heading, crypto.tags[1]],                   // stop raw 139: On-chain data
  [chapterLabel(1), MARQUEE_ITEMS[4]],                // stop raw 179 (hand-off): Programme 01 · Liquidity Analysis
];
export const CRYPTO_FLOW: CaptionFlow = {
  from: cryptoRail.from,
  to: cryptoRail.to,
  steps: cryptoLines.map(([label, text], i) => ({ label, text, start: cryptoRail.steps[i].start, end: cryptoRail.steps[i].end })),
};
```
`crypto.tags[2]` ("Futures basis") is no longer used in Crypto (Q2). `FOREX_FLOW` is untouched.

**New `components/sections/CryptoSlabs.tsx`** (`'use client'`)
- Exports `export type SlabDriver = { current: ((s: number) => void) | null };` and `export function CryptoSlabs({ driverRef }: { driverRef: SlabDriver }): React.ReactElement`.
- Markup: a root `<div ref={rootRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>` containing:
  1. **Intro (slab 1).** The existing editorial overlay, moved verbatim from CryptoMarketScroll minus `RevealText`:
     ```tsx
     <div data-slab="intro" className="cslab cslab--intro">
       <div className="w-full h-full max-w-7xl mx-auto px-5 sm:px-8 md:px-12 lg:px-16 flex flex-col justify-between py-10 md:py-14">
         <div className="flex flex-col items-end text-right max-w-xl self-end">
           <div data-part className="flex items-center gap-2 text-xs font-mono text-[#8C6D23] uppercase tracking-widest mb-3">…label + gold rule (unchanged)…</div>
           <h2 data-part className="font-display font-medium leading-[1.08] tracking-tight text-[#0E0F14] text-3xl sm:text-4xl md:text-5xl lg:text-[3.6rem]"
               style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', textShadow: '0 1px 18px rgba(255,255,255,0.6)' }}>
             Let me introduce you <br className="hidden sm:inline" />to the market, <br /><span className="italic font-normal text-[#B38728]">first crypto.</span>
           </h2>
           <p data-part className="mt-4 md:mt-6 text-sm md:text-base font-body text-[#524C42] leading-relaxed max-w-md">…unchanged…</p>
           <div data-part className="mt-6 flex flex-wrap justify-end gap-2.5">…the three chips, unchanged…</div>
         </div>
       </div>
     </div>
     ```
  2. **Teach (slab 2):**
     - `<div data-slab="teach" className="cslab cslab--teach">`
     - `<div data-part className="cslab__label"><span>{label}</span><span className="cslab__rule" /></div>`
     - `<h3 data-part className="cslab__title">{title[0]}<br /><em>{title[1]}</em></h3>`
     - `<p data-part className="cslab__body">{body}</p>`
     - `<div data-part className="cslab__path">` mapping `path` to `<Fragment key={s}>{i > 0 && <i aria-hidden="true" />}<span>{s}</span></Fragment>`
  3. **Close (slab 3):**
     - `<div data-slab="close" className="cslab cslab--close">`
     - `<div data-part className="cslab__label"><span className="cslab__rule" /><span>{label}</span><span className="cslab__rule" /></div>`
     - `<h3 data-part className="cslab__title">{title[0]}{' '}<br className="cslab__br" /><em>{title[1]}</em></h3>`
- Driver: one `useEffect(..., [driverRef])`, the same pattern as ScrollCaptions.
  - Query the three `[data-slab]` elements and their `[data-part]` children once, into arrays.
  - Keep per-part string caches for opacity and transform, plus one cached visibility per slab.
  - `reduced` comes from `matchMedia('(prefers-reduced-motion: reduce)')` with a change listener that re-applies with force.
  - `apply(s, force?)`:
    1. Return early if `s === last && !force`.
    2. For each slab and part j, run `slabPart(s, CRYPTO_SLAB_WINDOWS[id], j, parts.length, reduced, scratch)`.
    3. Write `style.opacity = o.toFixed(3)` and `style.transform = \`translate3d(0,${y.toFixed(2)}px,0)\`` only when the string changed.
    4. Set the slab's `style.visibility` to `'visible'` if any part opacity > 0.002, else `'hidden'` (written only on change).
  - Set `driverRef.current = apply`; on cleanup null it and remove the listener.
  - Use plain `for` loops (no per-tick closures or allocations).

**`app/globals.css`**: append after the workflow-captions block:
```css
/* ─── Crypto slab texts (components/sections/CryptoSlabs.tsx) ─── */
/* Scrubbed from the Crypto frame tick by JS (lib/crypto-slabs.ts): transform + opacity only, no CSS transitions. */
.cslab { position: absolute; pointer-events: none; visibility: hidden; }
.cslab [data-part] { opacity: 0; will-change: transform, opacity; }
.cslab--intro { inset: 0; }
.cslab__label { display: flex; align-items: center; gap: .6rem; font-family: var(--font-body); font-size: var(--fs-label);
  font-weight: 600; letter-spacing: .28em; text-transform: uppercase; font-variant: small-caps; color: #8C6D23; }
.cslab__rule { display: block; width: 1.5rem; height: 1px; background: #D4AF37; }
.cslab__title { margin-top: .75rem; font-family: var(--font-display); font-weight: 500; line-height: 1.08; letter-spacing: -.01em;
  color: #0E0F14; text-shadow: 0 1px 18px rgba(255, 255, 255, .6); }
.cslab__title em { font-style: italic; font-weight: 400; color: #B38728; }
.cslab__body { margin-top: 1rem; font-family: var(--font-body); font-size: clamp(.875rem, .8rem + .2vw, 1rem); line-height: 1.6; color: #524C42; }
.cslab__path { margin-top: 1rem; display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .75rem; font-family: var(--font-body);
  font-size: var(--fs-label); font-weight: 600; letter-spacing: .24em; text-transform: uppercase; color: #38332B; }
.cslab__path i { display: block; width: 5px; height: 5px; transform: rotate(45deg);
  background: linear-gradient(135deg, #F6E3A1, #D4AF37 50%, #8C6D23); }

/* Slab 2: phones/portrait = top band under the nav pill; landscape >= md = top-left, clear of the ETH/SOL coins
   (lower-left), the BTC flight (x >= 35%) in frames 112-139, and the caption rail (bottom-left). */
.cslab--teach { left: 1.25rem; right: 1.25rem; top: 5rem; }
.cslab--teach .cslab__title { font-size: clamp(1.5rem, 6.4vw, 2rem); }
.cslab--teach .cslab__body { display: none; }
@media (width >= 48rem) and (min-aspect-ratio: 4/5) {
  .cslab--teach { left: max(1.5rem, 4.5vw); right: auto; top: 6.5rem; width: min(22rem, 28vw); }
  .cslab--teach .cslab__title { font-size: clamp(1.75rem, 1rem + 1.6vw, 2.75rem); }
  .cslab--teach .cslab__body { display: block; }
}
@media (max-height: 30rem) { .cslab--teach .cslab__body { display: none; } }

/* Slab 3 (stop raw 179): centred above the falling coin. --coin-top = coin row 440/1080 under cover-fit and DepthStage push-in;
   the text is visible only while the coin top is >= row 480 (lib/crypto-slabs.ts, tests/crypto-slabs.test.mjs). */
.cslab--close { --coin-top: min(39dvh, calc(50dvh - 6.1vw)); --coin-gap: clamp(.75rem, 2.5dvh, 1.5rem);
  left: 0; right: 0; bottom: calc(100% - var(--coin-top) + var(--coin-gap)); padding: 0 1.25rem; text-align: center; }
.cslab--close .cslab__label { justify-content: center; }
.cslab--close .cslab__title { margin-top: .5rem; font-size: clamp(1.5rem, min(4.4dvh, 3vw), 3.25rem); }
.cslab--close .cslab__br { display: none; }
@media (max-aspect-ratio: 4/5) {
  .cslab--close { --coin-top: 40dvh; }
  .cslab--close .cslab__title { font-size: clamp(1.5rem, 6.5vw, 2.75rem); }
  .cslab--close .cslab__br { display: inline; }
}
@media (max-height: 30rem) {
  .cslab--close .cslab__label { display: none; }
  .cslab--close .cslab__title { font-size: 1.25rem; }
}
```

Checked numbers for slab 3 (`text top..bottom` against the coin top at raw 179):

| viewport | text | coin top at 179 | title |
|---|---|---|---|
| 1920x1080 | 320..397 | 692 | one line |
| 1440x900 | 260..329 | 577 | |
| 1366x768 | 218..280 | 492 | |
| 1280x620 | 161..216 | 411 | |
| 2560x1080 | 283..360 | 743 | |
| 390x844 | 236..317 | 541 | two lines |
| 375x667 | 171..250 | 427 | |
| 768x1024 | 265..386 | 656 | |
| 844x390 | 110..132 | 262 | 20 px, no label |

Every text top clears the nav pill (bottom ≈ 66 px).

**`components/sections/CryptoMarketScroll.tsx`** (final shape; the Phase 1 HEAD version is the base)
- **Imports:**
  - `useFrameSequence`, `type FrameSequenceUpdate`
  - `useStepScroll`, `type StepScrollOptions`
  - `loadProgress`
  - `DepthStage`
  - `ScrollCaptions`, `type CaptionDriver`
  - `CRYPTO_FLOW`
  - `CryptoSlabs`, `type SlabDriver`
  - from sources: `buildFrameSet, warmFirstFrame, warmIndices, FRAMES_PER_SEQ, SEQ_SCROLL_VH, FOREX_OVERLAP_VH, UNIQUE_LOCAL, UNIQUE_PER_SEQ, type FrameSet, type FrameTier`
  - `CRYPTO_STOPS_RAW, knotProgress, framePos, stopListIndex` from `@/lib/step-scroll`
  - `railU` from `@/lib/crypto-slabs`
- **Remove:** the `RevealText` import and the old editorial `<div>` (it moved to CryptoSlabs), and the module-level `frameForProgress`.
- **Module constants:**
  ```ts
  const TOTAL_FRAMES = UNIQUE_PER_SEQ; // 192 unique of 240
  const urlsFor = (tier: FrameTier): FrameSet => buildFrameSet(['crypto'], tier, FRAMES_PER_SEQ, UNIQUE_LOCAL);
  const CRYPTO_STOP_INDICES: readonly number[] = CRYPTO_STOPS_RAW.map((r) => stopListIndex(r, UNIQUE_LOCAL)); // [0, 89, 110, 142]
  const CRYPTO_KNOT_IDX = CRYPTO_STOP_INDICES[CRYPTO_STOP_INDICES.length - 1]; // 142 = raw 179, the hand-off stop
  // raw 179 is shown exactly where ForexFade starts (Crypto top + 250vh); raw 180-240 keep playing under the fade.
  const CRYPTO_KNOT_P = knotProgress(SEQ_SCROLL_VH, FOREX_OVERLAP_VH); // 5/7
  const CRYPTO_STEP: StepScrollOptions = { stops: CRYPTO_STOP_INDICES, total: TOTAL_FRAMES, knotP: CRYPTO_KNOT_P };
  // Every landing frame (and the last frame) fetched first and never evicted.
  const PINNED: readonly number[] = [...CRYPTO_STOP_INDICES, TOTAL_FRAMES - 1]; // [0, 89, 110, 142, 191]
  // First 24 frames, then every 8th: a coarse fallback exists before the full fetch starts.
  const CRYPTO_WARM = warmIndices(TOTAL_FRAMES);
  ```
  Keep the `loadProgress.register` / `warmFirstFrame` block.
- **In the component:**
  - Keep the HUD refs, `lastHud`, `progressRef` and `captionRef`.
  - `const slabRef: SlabDriver = useRef(null);`
  - `const step = useStepScroll(CRYPTO_STEP);`
  - `const frameForProgress = useCallback((p: number, total: number): number => step.frameFor(framePos(p, total, CRYPTO_KNOT_IDX, CRYPTO_KNOT_P)), [step]);`
  - `onUpdate` (`useCallback`, deps `[step]`):
    ```ts
    progressRef.current = u.progress;
    const s = step.coord(u.scroll);
    captionRef.current?.(railU(s));
    slabRef.current?.(s);
    ```
    followed by the existing HUD writes (`UNIQUE_LOCAL[frame]`).
  - `useFrameSequence({ urlsFor, pinned: PINNED, warm: CRYPTO_WARM, frameForProgress, background: '#EFE7DC', onUpdate, onLayout: step.onLayout, onFrameReady })`. `onFrameReady` is unchanged.
- **JSX:** the section and sticky stay unchanged (450vh, `id="crypto-sequence"`). Inside the sticky: `DepthStage` + canvas, then `<CryptoSlabs driverRef={slabRef} />`, then `<ScrollCaptions flow={CRYPTO_FLOW} driverRef={captionRef} />`. The rail stays last (z-40, bottom-left).

```bash
corepack pnpm test && corepack pnpm lint && corepack pnpm build
git add lib/content.ts lib/scroll-captions.ts components/sections/CryptoSlabs.tsx components/sections/CryptoMarketScroll.tsx app/globals.css
git commit -m "Crypto: stepped slabs with holds, slab texts, rail on stops, clean hand-off at 179"
```
Note: `lib/content.ts` was committed in `887ff37`, so this diff is only the slab copy.

---

## 4. Verification commands
```bash
cd /c/Users/Suhas/Desktop/MOP_lux/masterogpipsology_client
node --test tests/step-scroll.test.mjs tests/crypto-slabs.test.mjs tests/frame-sources.test.mjs tests/caption-flow.test.mjs
corepack pnpm test && corepack pnpm lint && corepack pnpm build
# expect no output:
grep -rn "activeLocals\|allFramesMode\|allframes\|forexCfg\|cryptoCfg" app components lib tests
grep -rn "has('frames')\|includes('frames')" app components lib
# expect exactly one hit each:
grep -n "virtualScroll: runGates" components/providers/LenisProvider.tsx
grep -n "NODE_ENV === 'development' && <FrameDebugHud" app/page.tsx
grep -c "force: true" lib/start-journey.ts   # 3
git log --oneline -8                          # phase commits present
git status --short                            # only the untracked docs/plans/*/*.json traces remain
```
There is no automated browser QA. The owner checks with `corepack pnpm dev` at `http://localhost:3000`, where the HUD is shown in dev only. After `corepack pnpm build && corepack pnpm start` the HUD must not appear, even with `?frames`.

## 5. Acceptance (owner checks visually)
1. **Entry from the hero.** A hard wheel spin or trackpad flick eases into frame 1 and holds. The intro rises in on the right, and the rail shows "Crypto markets run 24/7". No frame past 1 plays.
2. **One gesture = one slab, same speed for a light or a hard flick.**
   - 1→112 takes ≈ 2.25 s, with the kicker caption passing mid-way.
   - It holds on frame 112 (HUD `pos 89.00`) with "CRYPTO / Bitcoin & Ethereum" fully shown.
   - 112→139 holds on HUD `pos 110.00`, "On-chain data", with slab 2's text at the top-left.
   - 139→179 holds on HUD `pos 142.00`, "PROGRAMME 01 / Liquidity Analysis", with the closing line centred above the falling coin.
3. **No skipping.** The trackpad inertia tail never triggers a second slab, and gestures during a glide or within ≈ 0.45 s of landing are ignored.
4. **Stop 179 is clean.** No Forex is visible: the HUD shows only Crypto `[on screen]`, not "Forex fading in".
   - The next gesture scrolls normally: the coin keeps moving under the fade while Forex rises in, reaching Forex frame 1. No jump.
   - The closing line fades out early in the fade.
5. **Back from Forex.** A hard upward flick catches on 179, then steps back through 139, 112 and 1. One more upward gesture at frame 1 returns to the hero.
6. **Keys.** Arrow, PageUp/PageDown and Space step once per press; holding a key does not multi-step. Home and End jump natively.
7. **Scrollbar.** Releasing the thumb mid-Crypto glides to the nearest stop. Dragging straight through is never blocked.
8. **iPhone / Android.**
   - A swipe is one slab.
   - A flick from the hero stops on frame 1 (a tiny bounce-back is OK).
   - A swipe down at 1 goes back to the hero; a swipe up at 179 enters the hand-off.
   - Pinch-zoom and taps still work.
9. **Reduced motion.** Each gesture jumps to the next stop, and the texts and rail switch without motion.
10. **Start journey** from anywhere, including mid-glide, lands on frame 1.
11. **Same stop frame on every screen size.** The HUD `pos` is exact on 1280x620, 1440x900, 1920x1080 and a phone. The HUD `frames:` line names the tier, and `file` is the file actually fetched.
12. **Forex is unchanged:** 192 unique frames per folder, the same overlays and the same video hand-off.

## 6. Out of scope
- Forex stops (the owner picks them later; see section 7).
- Any tier-policy change (D12).
- Docs follow-up for docs-writer: add `lib/step-scroll.ts`, `lib/crypto-slabs.ts` and `components/hooks/useStepScroll.ts` to the rules.md quick reference, and note there that the debug HUD is dev-only.

## 7. Applying the same mechanism to Forex later
- Call `useStepScroll({ stops, total: 576, knotP: FRAME_SCROLL_PORTION, fps })` in ForexMarketScroll.
  - Pass `onLayout` to its `useFrameSequence`.
  - Wrap its `frameForProgress` as `step.frameFor(framePos(p, total, lastStop, FRAME_SCROLL_PORTION))`.
  - With the last stop = 575 (the last frame), this is exactly today's Forex mapping.
  - The gate registry already supports two zones.
- **Stop mapping across the three folders:** for raw global G (1..720), `folder = floor((G − 1)/240)` and `list = folder × 192 + stopListIndex(((G − 1) % 240) + 1, UNIQUE_LOCAL)`.
- **Zone edges:**
  - Forex stop 0 must be list 0 at Forex progress 0, which is the end of the hand-off fade.
  - The gap between Crypto stop 179 and Forex stop 0 is exactly the 100vh fade, where scrolling is free.
  - Crypto catches upward flicks at 179 and Forex catches downward flicks at its frame 1.
- **After the last Forex stop**, a new gesture releases normal scrolling into the 420vh doorway/video tail. `HUD_FADE_START = at(-28)` falls inside the last glide, which is fine.
- **Speed:** Stock and Opportunity move ≈ 2x more per frame (mean motion 4.5-4.8 vs Crypto 2.2), so consider `fps: 32-40`. `fps` is already per zone.
- **Pinning:** pin the Forex stop frames (8.3 MB each on the full tier; keep about 6 or fewer).
- **Captions:** re-time `FOREX_FLOW` the same way (a `forexRailSpec` built from its stops).
- `FOLDER_CUTS` need nothing.
- `VIDEO_ARM_FRAME` and the overlay thresholds work on frame numbers and are unaffected.

## 8. Risks and knobs
- **iOS/Android momentum catch** (root `overflow: hidden` ≤ 120 ms after the finger is up) needs a real-device check (rules.md pre-deploy). Fallback: raise `OVERFLOW_UNLOCK_MS` to 250.
- **Decode throughput at 48 frames/s** on the full tier. The engine substitutes the nearest decoded frame if it falls behind. Knob: `STEP_FPS`.
- **Very long Mac trackpad tails** outlast a glide. They are swallowed by design; a fresh push is detected by the rise rule.
- **A scrollbar-drag pause over 220 ms mid-drag** inside Crypto starts a settle glide. This is rare.
- **Lenis internals** (synchronous `lock`, reset to `actualScroll`, the `virtualScroll` contract) were verified for 1.3.26. Re-check if Lenis is upgraded.
- **`HOLD_MIN_MS` (450)** is the "brief hold". 300-700 ms are all sensible values.

## 9. Open questions for the owner
- **Q1 "Brief hold" vs "one gesture = one slab" during a continuous scroll.** The plan: every landing holds ≥ 0.45 s, then the next slab needs a new gesture, so a long continuous spin or push moves exactly one slab. The alternative is that a scroll still in progress after the hold carries on to the next slab, which re-introduces force-dependence. **Recommended: keep one gesture = one slab with the 0.45 s minimum hold.**
- **Q2 Crypto rail copy.** With 4 stops the rail becomes:
  - entry: "Crypto markets run 24/7";
  - "Digital assets with structural logic" passing mid-way through slab 1;
  - your three stop captions;
  - "Futures basis" dropped from Crypto, because it has no stop left before the hand-off and would only flash under the Forex fade.

  **Recommended: yes, drop it** (it stays in the Markets section copy).
