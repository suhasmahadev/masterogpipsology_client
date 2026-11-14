# Slab hook box: one changing hook per stop (Crypto + Forex chain), rails removed, slower text motion

Planner: Opus. Coder: implement exactly this. Do not explore beyond the files named here. No Next API is touched.
`hx` is not installed in this repo, so the decisions are recorded in section 9 of this file. Base: `main` @ `73018c2`.

## Owner override (implemented)

The planned overlap params (§3.2: 0.70/0.92 in, 0.80/0.94 out) and the detailed window timing in §4.1–4.2 were **not implemented** as written. Actual implementation (lib/hook-box.ts):
- Windows are in stop coordinate, scrubbed to the frame glide.
- Old hook leaves over 0–0.25 of each glide.
- New hook reveals letter by letter over 0.25–1.0 and its last letter finishes exactly when frames land on the stop.
- No hook overlaps, no early settle. Short glides just compress.

---

## 0. Goal

The owner asked for this:
- The Forex headline box ("Chapter two is forex. / The world, in pairs.") shows a **different hook at every stop**.
- The Crypto section gets the same treatment: one hook box that changes per stop.
- The workflow caption rails (bottom-left) are **removed from rendering**.
- The text animation is **noticeably slower**.

The changes:
- One shared component, `HookBox`, renders N stacked hooks in one grid cell. It reuses `useSlabScrub` (no React state, transform and opacity only).
- Each hook is in during the glide into its stop. It is fully settled before the landing and leaves during the glide out.
- Old components and libs stay on disk, unmounted. No file is deleted, and all existing tests must pass unchanged.

## 1. Facts verified in code (do not re-derive)

- Crypto stop coordinate `s` (`step.coord`): -1 is the approach, 0 is raw 1, 1 is raw 112, 2 is raw 139 and 3 is raw 179. 3..4 is the hand-off glide
  (slab 4) to Forex Y0. Glides in list frames: 89, 21, 32 and 49 (hand-off).
- Forex chain `s`: 0 is Y0 (forex 1, shared with Crypto s 4). Then 1 F1 (forex 64), 2 F2 (111), 3 F3 (194), 4 S1 (stock 32),
  5 S2 (stock 189), 6 O1 (opp 97), 7 O2 (opp 216), 8 O3 (last frame) and 9 V (video, auto-advance). Forex s -1..0 is the same
  hand-off glide as Crypto s 3..4. Glides: 50, 38, 66, 63, 125, 119, 95 and 19 (O3), then 72 virtual (V).
- Folder cuts in s: forex->stock at **3.595** and stock->opportunity at **5.349**. Text must not straddle a cut.
- `s` is linear in scroll, and frames are linear in scroll inside every glide, so the s fraction equals the frame fraction of the glide.
  Glide speed: `glideProfile` (48 fps cruise, 0.4 s smoothstep in = 9.6 frames, 1.0 s power-2 brake = 16 frames).
- `MarketSlabs` sits inside the Forex `hudContainerRef` div. The HUD fade (`HUD_FADE_START` = at(-28)) starts at chain 559.7 =
  s 7.19 and reaches 0.6 opacity at O3. So nothing can be held at O3. The closing lines on the video (`CLOSING_LINES`, at V)
  are the O3/V hook.
- Frame tones in the top-right box area: crypto and forex frames are light (cream), so dark ink works. Stock and
  opportunity frames are dark: the current `#0E0F14` ink is unreadable there. Hooks at S1, S2, O1 and O2 get `tone: 'dark'`.
- The top-right box is clear of the coins at crypto 112, 139 and 179. The old intro slab already sat there through raw 112. The
  BTC top is at row ~285/1080 at 112 and lower afterwards.
- `useSlabScrub(rootRef, ids, windows, driverRef, name)` handles everything else:
  - It finds `[data-slab=id]` and collects `[data-part]` and `[data-u]` units at mount.
  - It writes only in odd zones (entering and leaving).
  - Reduced motion is a whole-part crossfade over the same windows, with units at their final state.

## 2. Hook copy (owner-requested copy change; true statements only, no numbers)

`label` = small caps with the gold rule. `title[0]` = plain line. `title[1]` = gold line (Crypto: Bodoni tilt letters; market: Cinzel
ticker-roll letters). Existing copy is reused where it fits (marked *existing*).

| id | stop | label | title[0] | title[1] | tone |
|---|---|---|---|---|---|
| c0 | Crypto raw 1 (entry) | Master of Pipsology · Crypto | Learn the market | that never sleeps. | light (*existing intro*) |
| c1 | Crypto raw 112 | The MOP method | Structure first. | Risk defined. | light |
| c2 | Crypto raw 139 | Live · Mysore & Bengaluru | From the first chart | to the final call. | light (*existing teach*) |
| c3 | Crypto raw 179 | Master of Pipsology | Crypto is chapter one. | Forex comes next. | light (*existing close*) |
| m0 | Y0 forex 1 | Master of Pipsology · Forex | Chapter two is forex. | The world, in pairs. | light (*existing*) |
| m1 | F1 forex 64 | Forex · Major pairs | Every pair is | two economies. | light |
| m2 | F2 forex 111 | Forex · London & NY sessions | Timing is a skill. | Sessions, taught live. | light |
| m3 | F3 forex 194 | Forex · Interbank flow | Follow the money | behind the move. | light |
| m4 | S1 stock 32 | Master of Pipsology · Equities | Then the equity floor. | One stock to the index. | dark (*existing stock*) |
| m5 | S2 stock 189 | Equities · Indices & earnings | Bull or bear, | the plan comes first. | dark |
| m6 | O1 opp 97 | Where it all converges | This is your moment, | the opportunity. | dark (*existing opportunity*) |
| m7 | O2 opp 216 | Master of Pipsology | Education before | execution. | dark (= `FINAL_CTA_HEADLINE`) |
| (none) | O3 / V | closing lines on the video carry it (unchanged) | | | |

All labels are 32 characters or fewer. Every hook is under the 60-unit budget (largest is m4: about 26 units).

## 3. Timing (the slower motion)

Two independent levers. Both are needed: wider windows alone still roll each letter in about 0.1 s.

### 3.1 Windows: use almost the whole glide (lib/hook-box.ts)

The window rule, in glide time T (from `glideProfile`):
- The outgoing hook leaves over t = 0.03..0.42 T.
- The box is empty for a short breath.
- The incoming hook enters over t = 0.50..0.90 T. In s that ends at about k + 0.99, so the hook settles during the brake,
  0.1 to 0.35 s before landing.
- There is a hold margin of ±0.01 s around every stop. The leaving and entering windows of a glide that holds a cut are clipped to
  that cut.

The numbers are below in s, rounded. Seconds are the measured window spans: *old* is the current window and *new* is this plan.

| hook | in (s) | out (s) | in span (new) | out span (new) |
|---|---|---|---|---|
| c0 | -0.70 .. -0.05 (native approach) | 0.01 .. 0.51 | scroll-paced | 0.99 s (old intro out 0.76 s) |
| c1 | 0.66 .. 0.99 | 1.01 .. 1.67 | 0.92 s | 0.40 s (21-frame glide: 1.15 s total) |
| c2 | 1.80 .. 1.99 | 2.01 .. 2.65 | 0.35 s (old teach in 0.32 s) | 0.54 s |
| c3 | 2.80 .. 2.99 | 3.01 .. 3.58 | 0.47 s (old 0.46 s) | 0.67 s (old 0.49 s) |
| m0 | -0.24 .. -0.01 | 0.01 .. 0.58 | 0.59 s | 0.68 s |
| m1 | 0.75 .. 0.99 | 1.01 .. 1.62 | 0.61 s | 0.58 s |
| m2 | 1.79 .. 1.99 | 2.01 .. 2.54 | 0.51 s | 0.80 s |
| m3 | 2.70 .. 2.99 | 3.01 .. 3.54 (cut 3.595) | 0.73 s | 0.78 s (old forex out 0.46 s) |
| m4 | 3.71 .. 3.99 (after cut) | 4.01 .. 4.48 | 0.71 s | 1.28 s |
| m5 | 4.62 .. 4.99 | 5.01 .. 5.33 (cut 5.349) | 1.23 s | 0.85 s |
| m6 | 5.62 .. 5.99 (after cut) | 6.01 .. 6.50 | 1.19 s | 1.03 s |
| m7 | 6.65 .. 6.99 | 7.01 .. 7.90 (in the O3 glide, with the HUD fade) | 0.97 s | 0.56 s |

c3 (out) and m0 (in) share the hand-off glide: c3 is gone at Forex s -0.42, and m0 starts at -0.24 while ForexFade is about 76%
opaque. Both boxes sit in the same top-right spot, so it reads as one box changing.

The two short glides (crypto 112->139 at 21 frames and O2->O3 at 19 frames) cannot be slower without slowing the glide itself. This
plan does not change glide speed (see open question 2).

### 3.2 Per-unit cascade: slower letters (lib/text-motion.ts overlaps, hook box only)

The current overlaps are part 0.55 / unit 0.82 (in) and 0.7 / 0.9 (out). A 16-letter gold line has 3 parts, so each letter rolls in
about 0.14 x window. The hook box uses **in 0.70 / 0.92** and **out 0.80 / 0.94**, which makes each letter about 0.28 x window,
**2x slower per letter**. Combined with 3.1, a typical Forex letter roll goes from about 0.07 s to 0.2 s or more. Other users of
`enterAt` and `leaveAt` keep their defaults.

### 3.3 Hold: 450 ms -> 700 ms (separate one-line step, revertible)

The hook is fully settled about 0.2 to 0.35 s before landing. With a 700 ms hold, a reader on continuous swipes gets at least
about 0.9 to 1.05 s of still text per stop (it was about 0.65 s). The O3 -> video auto-advance keeps **450 ms**
(new `AUTO_ADVANCE_MS`), so the video hand-off is unchanged.

## 4. Files and exact changes

### 4.1 `lib/text-motion.ts` (backward compatible)

Add after `TM_MAX_UNITS`:
```ts
/** Cascade overlaps for a scrubbed block (enterAt / leaveAt). */
export interface MotionOverlaps { inPart: number; inUnit: number; outPart: number; outUnit: number }
export const TM_DEFAULT_OVERLAPS: MotionOverlaps = {
  inPart: TM_IN_PART_OVERLAP, inUnit: TM_IN_UNIT_OVERLAP, outPart: TM_OUT_PART_OVERLAP, outUnit: TM_OUT_UNIT_OVERLAP,
};
```
Give both functions two optional trailing params (the defaults are today's behaviour):
```ts
export function enterAt(x: number, from: number, to: number, part: number, parts: number, unit: number, units: number,
  partOverlap: number = TM_IN_PART_OVERLAP, unitOverlap: number = TM_IN_UNIT_OVERLAP): number {
  return easeOutQuart(staged(x, from, to, part, parts, unit, units, partOverlap, unitOverlap));
}
export function leaveAt(x: number, from: number, to: number, part: number, parts: number, unit: number, units: number,
  partOverlap: number = TM_OUT_PART_OVERLAP, unitOverlap: number = TM_OUT_UNIT_OVERLAP): number {
  return easeInCubic(staged(x, from, to, part, parts, unit, units, partOverlap, unitOverlap));
}
```
Header comment line 1: add `HookBox.tsx` to the list of users.

### 4.2 `components/motion/useSlabScrub.ts`

- Import `TM_DEFAULT_OVERLAPS, type MotionOverlaps` from `@/lib/text-motion`.
- Add a 6th param `overlaps: MotionOverlaps = TM_DEFAULT_OVERLAPS`.
- In `apply`, the full-motion branch becomes:
  ```ts
  : writeUnit(u, enterAt(s, w.inFrom, w.inTo, u.part, u.parts, u.unit, u.units, overlaps.inPart, overlaps.inUnit),
      leaveAt(s, w.outFrom, w.outTo, u.part, u.parts, u.unit, u.units, overlaps.outPart, overlaps.outUnit));
  ```
- Effect deps: `[rootRef, ids, windows, driverRef, name, overlaps]`. Callers pass module constants, so there are no re-runs.
- Doc comment: users are CryptoSlabs, MarketSlabs and HookBox.

### 4.3 New `lib/hook-box.ts` (import-free)

```ts
// Hook box timing (components/sections/HookBox.tsx): one hook per step-scroll stop, in during the glide into its stop
// (settled ~0.2-0.35 s before landing), out during the glide away. Coordinate: the controller's stop coordinate s.
// Rule: out over glide time 0.03..0.42 T, in over 0.50..0.90 T (glideProfile), clipped to the folder cuts. Import-free.

export interface HookWindow { inFrom: number; inTo: number; outFrom: number; outTo: number }

/** Slower cascade than the slab default (0.55/0.82 in, 0.7/0.9 out): each letter takes ~2x longer. */
export const HOOK_OVERLAPS = { inPart: 0.7, inUnit: 0.92, outPart: 0.8, outUnit: 0.94 } as const;

// Crypto s: -1 approach, 0 raw 1, 1 raw 112, 2 raw 139, 3 raw 179, 3..4 hand-off glide to Forex Y0.
export const CRYPTO_HOOK_IDS = ['c0', 'c1', 'c2', 'c3'] as const;
export const CRYPTO_HOOK_WINDOWS: Readonly<Record<(typeof CRYPTO_HOOK_IDS)[number], HookWindow>> = {
  c0: { inFrom: -0.7, inTo: -0.05, outFrom: 0.01, outTo: 0.51 },
  c1: { inFrom: 0.66, inTo: 0.99, outFrom: 1.01, outTo: 1.67 },
  c2: { inFrom: 1.8, inTo: 1.99, outFrom: 2.01, outTo: 2.65 },
  c3: { inFrom: 2.8, inTo: 2.99, outFrom: 3.01, outTo: 3.58 }, // gone at Forex s -0.42 (same glide)
};

// Forex chain s: 0 Y0, 1-3 F1-F3, 4 S1, 5 S2, 6 O1, 7 O2, 8 O3, 9 V. Cuts: forex->stock 3.595, stock->opportunity 5.349.
export const MARKET_HOOK_IDS = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'] as const;
export const MARKET_HOOK_WINDOWS: Readonly<Record<(typeof MARKET_HOOK_IDS)[number], HookWindow>> = {
  m0: { inFrom: -0.24, inTo: -0.01, outFrom: 0.01, outTo: 0.58 },
  m1: { inFrom: 0.75, inTo: 0.99, outFrom: 1.01, outTo: 1.62 },
  m2: { inFrom: 1.79, inTo: 1.99, outFrom: 2.01, outTo: 2.54 },
  m3: { inFrom: 2.7, inTo: 2.99, outFrom: 3.01, outTo: 3.54 },  // out before the forex->stock cut
  m4: { inFrom: 3.71, inTo: 3.99, outFrom: 4.01, outTo: 4.48 }, // in after the cut
  m5: { inFrom: 4.62, inTo: 4.99, outFrom: 5.01, outTo: 5.33 }, // out before the stock->opportunity cut
  m6: { inFrom: 5.62, inTo: 5.99, outFrom: 6.01, outTo: 6.5 },
  m7: { inFrom: 6.65, inTo: 6.99, outFrom: 7.01, outTo: 7.9 },  // O2; leaves in the O3 glide (HUD fade); closing lines own V
};
```

### 4.4 `lib/content.ts`

Insert after `CRYPTO_RAIL_LINES` (leave every existing constant untouched; tests pin them):
```ts
// ─── Hook box (components/sections/HookBox.tsx): one hook per step-scroll stop ─────
export interface HookCopy {
  /** Wide-tracked small-caps label (<= 32 chars). */
  label: string;
  /** [plain line, gold line]. */
  title: readonly [string, string];
  /** Frame behind the box: 'light' (cream frames, dark ink; default) or 'dark' (stock/opportunity frames, cream ink). */
  tone?: 'light' | 'dark';
}
/** Crypto stops raw 1, 112, 139, 179 (lib/hook-box.ts CRYPTO_HOOK_IDS order). */
export const CRYPTO_HOOKS: readonly HookCopy[] = [
  { label: 'Master of Pipsology · Crypto', title: ['Learn the market', 'that never sleeps.'] },
  { label: 'The MOP method', title: ['Structure first.', 'Risk defined.'] },
  { label: 'Live · Mysore & Bengaluru', title: ['From the first chart', 'to the final call.'] },
  { label: 'Master of Pipsology', title: ['Crypto is chapter one.', 'Forex comes next.'] },
];
/** Forex chain stops Y0, F1-F3, S1, S2, O1, O2 (lib/hook-box.ts MARKET_HOOK_IDS order). O3/V: CLOSING_LINES on the video. */
export const MARKET_HOOKS: readonly HookCopy[] = [
  { label: 'Master of Pipsology · Forex', title: ['Chapter two is forex.', 'The world, in pairs.'] },
  { label: 'Forex · Major pairs', title: ['Every pair is', 'two economies.'] },
  { label: 'Forex · London & NY sessions', title: ['Timing is a skill.', 'Sessions, taught live.'] },
  { label: 'Forex · Interbank flow', title: ['Follow the money', 'behind the move.'] },
  { label: 'Master of Pipsology · Equities', title: ['Then the equity floor.', 'One stock to the index.'], tone: 'dark' },
  { label: 'Equities · Indices & earnings', title: ['Bull or bear,', 'the plan comes first.'], tone: 'dark' },
  { label: 'Where it all converges', title: ['This is your moment,', 'the opportunity.'], tone: 'dark' },
  { label: 'Master of Pipsology', title: ['Education before', 'execution.'], tone: 'dark' },
];
```

### 4.5 New `components/sections/HookBox.tsx`

```tsx
'use client';

import React, { useRef } from 'react';
import type { HookCopy } from '@/lib/content';
import { HOOK_OVERLAPS, type HookWindow } from '@/lib/hook-box';
import { SplitWords } from '@/components/motion/SplitWords';
import { useSlabScrub, type SlabDriver } from '@/components/motion/useSlabScrub';

type Variant = 'crypto' | 'market';

interface Props {
  variant: Variant;
  ids: readonly string[];                          // module constant (lib/hook-box.ts)
  windows: Readonly<Record<string, HookWindow>>;   // module constant
  hooks: readonly HookCopy[];                      // same order and length as ids
  driverRef: SlabDriver;
}

/** One hook: label + rule, plain line, gold line. Crypto = Bodoni rise/tilt; market = Cinzel glide + ticker roll. */
function Hook({ id, copy, variant }: { id: string; copy: HookCopy; variant: Variant }): React.ReactElement {
  const market = variant === 'market';
  const tone = copy.tone === 'dark' ? ' hook--dark' : '';
  return (
    <div data-slab={id} className={`hook hook--${variant}${tone} col-start-1 row-start-1 flex flex-col items-end text-right`}>
      <div data-part className={market
        ? 'hook__label flex items-center gap-2 text-xs font-mono uppercase tracking-widest mb-3'
        : 'cslab__label hook__label'}>
        <span className="tm-mask"><span className="tm-u" data-u={market ? 'glide' : 'rise'}>{copy.label}</span></span>
        <span className="hook__rule" data-u="line" />
      </div>
      <h2 className={market ? 'mslab__title' : 'cslab__title cslab__title--intro'}>
        <span className="sr-only">{copy.title[0]} {copy.title[1]}</span>
        <span aria-hidden="true">
          <span data-part><SplitWords text={copy.title[0]} kind={market ? 'glide' : 'tilt'} /></span>
          <br />
          <em data-part><SplitWords text={copy.title[1]} kind={market ? 'roll' : 'tilt'} letters /></em>
        </span>
      </h2>
    </div>
  );
}

/**
 * The hook box: one top-right box per sequence whose text changes at every step-scroll stop. No React state: scrubbed by the
 * stop coordinate from the host frame tick (useSlabScrub, slower HOOK_OVERLAPS cascade). Transform + opacity only.
 * market: grid items for the Forex overlay grid. crypto: its own absolute layer with the same container geometry.
 */
export function HookBox({ variant, ids, windows, hooks, driverRef }: Props): React.ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useSlabScrub(rootRef, ids, windows, driverRef, `HookBox(${variant})`, HOOK_OVERLAPS);
  if (process.env.NODE_ENV !== 'production' && hooks.length !== ids.length) {
    console.warn(`HookBox(${variant}): ${hooks.length} hooks for ${ids.length} ids`);
  }
  const items = ids.map((id, i) => hooks[i] && <Hook key={id} id={id} copy={hooks[i]} variant={variant} />);
  if (variant === 'market') return <div ref={rootRef} className="contents">{items}</div>;
  return (
    <div ref={rootRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      <div className="w-full h-full max-w-7xl mx-auto px-5 sm:px-8 md:px-12 lg:px-16 flex flex-col justify-between py-10 md:py-14">
        <div className="grid grid-cols-1 justify-items-end text-right max-w-xl self-end">{items}</div>
      </div>
    </div>
  );
}

export default HookBox;
```
Note: `HOOK_OVERLAPS` (`as const`, readonly props) is assignable to `MotionOverlaps` (TS allows readonly -> mutable props).
Keep `lib/hook-box.ts` import-free (do not import `text-motion` there).

### 4.6 `app/globals.css`

Append after the `.tm-word > .tm-u` line (end of the "Forex and Stock slab texts" block):
```css
/* ─── Hook box (components/sections/HookBox.tsx, lib/hook-box.ts): one box per sequence, one hook per stop ─── */
.hook { visibility: hidden; }
.hook [data-u] { opacity: 0; will-change: transform, opacity; }
.hook--crypto { --font-lux: var(--font-lux-display), 'Bodoni Moda', 'Bodoni 72', Didot, Georgia, serif; }
.hook--market { --font-mkt: var(--font-mkt-display), 'Cinzel', 'Trajan Pro', Georgia, serif; }
.hook--market .hook__label { color: #8C6D23; }
.hook__rule { display: block; width: 1.5rem; height: 1px; background: #D4AF37; transform-origin: 0 50%; }
/* Dark frames (stock, opportunity): cream ink, warm gold accent, dark halo. Static per hook, never animated. */
.hook--dark .hook__label { color: #D4AF37; }
.hook--dark .mslab__title { color: #F3EBDD; text-shadow: 0 1px 18px rgba(0, 0, 0, .55); }
.hook--dark .mslab__title em { color: #E2C46B; }
```
Do not edit any existing `.cslab*`, `.mslab*` or `.wf*` rule.

### 4.7 `components/sections/CryptoMarketScroll.tsx`

- Remove the imports `ScrollCaptions, type CaptionDriver`, `CryptoSlabs, type SlabDriver`, `CRYPTO_FLOW` and `railU`.
- Add the imports:
  `import { HookBox } from '@/components/sections/HookBox';`
  `import type { SlabDriver } from '@/components/motion/useSlabScrub';`
  `import { CRYPTO_HOOK_IDS, CRYPTO_HOOK_WINDOWS } from '@/lib/hook-box';`
  `import { CRYPTO_HOOKS } from '@/lib/content';`
- Delete `const captionRef: CaptionDriver = useRef(null);` and the line `captionRef.current?.(railU(s));`. Keep `slabRef.current?.(s);`.
- JSX: replace `<CryptoSlabs driverRef={slabRef} />` and the `<ScrollCaptions ... variant="crypto" />` line with:
  ```tsx
  {/* Hook box: one hook per stop, transform/opacity only, scrubbed by the stop coordinate */}
  <HookBox variant="crypto" ids={CRYPTO_HOOK_IDS} windows={CRYPTO_HOOK_WINDOWS} hooks={CRYPTO_HOOKS} driverRef={slabRef} />
  ```
- Nothing else changes: stops, `CRYPTO_STEP`, the HUD refs and `PINNED`.

### 4.8 `components/sections/ForexMarketScroll.tsx`

- Remove the imports `ScrollCaptions, type CaptionDriver`, `FOREX_FLOW` and `MarketSlabs`. Change
  `import { FOREX_CHAIN_STOPS, forexRailU } from '@/lib/forex-rail';` to `import { FOREX_CHAIN_STOPS } from '@/lib/forex-rail';`.
- Add the imports `HookBox` (`@/components/sections/HookBox`), `MARKET_HOOK_IDS, MARKET_HOOK_WINDOWS` (`@/lib/hook-box`) and `MARKET_HOOKS`
  (`@/lib/content`).
- Delete `const captionRef: CaptionDriver = useRef(null);` and `captionRef.current?.(forexRailU(s));` in `onUpdate`. Keep
  `const s = step.coord(scroll);` and `slabRef.current?.(marketSlabX(s));`.
- JSX: replace `<MarketSlabs driverRef={slabRef} />` (and its comment) with
  ```tsx
  {/* Hook box: one hook per stop (Y0, F1-F3, S1, S2, O1, O2), ticker roll, fades with the HUD before the video */}
  <HookBox variant="market" ids={MARKET_HOOK_IDS} windows={MARKET_HOOK_WINDOWS} hooks={MARKET_HOOKS} driverRef={slabRef} />
  ```
  Delete the line `<ScrollCaptions flow={FOREX_FLOW} driverRef={captionRef} variant="market" />`.
- Untouched: stops, `FOREX_STEP`, the hand-off constants, video, HUD writes, `PINNED` and `FOLDER_CUTS`.

### 4.9 Hold (step 3.3): `lib/step-scroll.ts` and `components/hooks/useStepScroll.ts`

- `lib/step-scroll.ts`: change `export const HOLD_MIN_MS = 450;` to `700` (comment: `every landing holds at least this long (hook
  reading time); input inside it is swallowed`). Add right below:
  `export const AUTO_ADVANCE_MS = 450;     // autoAdvance stop (Forex O3) -> next stop after this still (video hand-off timing)`
- `useStepScroll.ts`: import `AUTO_ADVANCE_MS`. In `armAuto`, replace `}, HOLD_MIN_MS);` with `}, AUTO_ADVANCE_MS);`.
  Line 244 stays `HOLD_MIN_MS`.
- Update the comment in `lib/step-scroll.ts` line 220 only if it mentions the value (it does not).

### 4.10 Not touched (stay on disk, unmounted)

`components/sections/CryptoSlabs.tsx`, `MarketSlabs.tsx`, `ScrollCaptions.tsx`, `lib/caption-flow.ts`, `lib/scroll-captions.ts`,
`lib/forex-rail.ts` (`FOREX_CHAIN_STOPS` still used), `lib/crypto-slabs.ts`, `lib/market-slabs.ts` (`marketSlabX` still used) and all
existing copy constants. `components/debug/FrameDebugHud.tsx` is untouched.

## 5. Tests

No new tests. **No expected values change.** The windows, copy constants and overlaps that are pinned by tests are not edited.
`enterAt` and `leaveAt` only gain optional params, and no test pins `HOLD_MIN_MS`. These must still pass unchanged:
`text-motion`, `crypto-slabs`, `market-slabs`, `forex-rail`, `caption-flow` and `step-scroll`. If a test fails, the change broke
compatibility: fix the code, not the test.

## 6. Verify (coder)

```
npx tsc --noEmit
npm run lint
npm test
npm run build
```
Unused imports in the two scroll components must be gone (lint). In dev, the console must show no `HookBox(...)` warnings and
no "animated units (budget 60)" warnings.

Manual check (owner, `npm run dev`, desktop and phone portrait):
1. Crypto: at raw 1, 112, 139 and 179 the top-right box shows c0 to c3, fully settled at each stop. The text changes only during the
   glides. No bottom-left rail anywhere.
2. Hand-off: c3 leaves while Forex fades in, and "Chapter two is forex. / The world, in pairs." rolls in at the same spot.
3. Forex chain: m1 to m7 at F1, F2, F3, S1, S2, O1 and O2. No text crosses a folder cut. S1 to O2 hooks are cream on the dark frames
   and readable. O2 text leaves during the O3 glide. The video hand-off and closing lines are unchanged and still auto-advance
   about 0.45 s after O3.
4. Motion: letters visibly roll or tilt in about 2 to 3x slower than before. Scrolling back up reverses every swap cleanly.
5. Reduced motion (OS setting): hooks crossfade, nothing moves, each stop shows its final hook.
6. Hold: after each landing, input is ignored for about 0.7 s (it was 0.45 s). If it feels sticky, revert only 4.9.
7. At 1366x768, at crypto 112, the c1 box clears the BTC coin's top edge.

## 7. Commits (local only, never push; docs-writer writes the messages)

1. `lib/text-motion.ts` and `components/motion/useSlabScrub.ts` (optional overlaps).
2. `lib/hook-box.ts`, `lib/content.ts`, `components/sections/HookBox.tsx`, `app/globals.css`,
   `components/sections/CryptoMarketScroll.tsx` and `components/sections/ForexMarketScroll.tsx` (hook box in, rails out).
3. `lib/step-scroll.ts` and `components/hooks/useStepScroll.ts` (hold 700 ms, auto-advance 450 ms). Kept separate so it can be reverted alone.
4. This plan. Docs-writer follow-up: `rules.md` §3 says crypto copy lives in `CRYPTO_SLAB_*` and `CRYPTO_RAIL_LINES`. Change it to
   `CRYPTO_HOOKS` and `MARKET_HOOKS` (rails unmounted). §4 Typography: crypto hook = Bodoni rise and lift, market hook = Cinzel
   ticker roll.

## 8. Open questions

1. O3 has no hook of its own: the HUD (and the box with it) is already fading there, and the closing lines take over at V.
   **Recommendation:** keep it this way. The alternative is holding m7 through O3 at about 60% opacity, which looks wrong.
2. The 21-frame crypto 112->139 glide and the 19-frame O2->O3 glide are about 1.1 s in total, so their swaps stay short (about 0.4 s).
   Slowing them needs a lower `STEP_FPS` or a higher `STEP_MIN_S` (frame-motion feel). **Recommendation:** leave the glides as they are.
3. The crypto hooks keep Bodoni rise-and-lift (locked in rules.md). The user's "animation can be applied for crypto also" could
   instead mean the Forex ticker roll. To switch, in `HookBox` use `kind="roll"` for crypto `title[1]` (one line).
   **Recommendation:** keep Bodoni and tilt, and ask the owner.

## 9. Decisions

- D1. One hook per stop, stacked hooks in one grid cell, driven by the existing `useSlabScrub`. No new animation engine and no React
  state. Hook = label + rule + two-line title only: no body or chips, so the box reads as a hook and stays within the unit budget.
- D2. Windows follow the glide's time profile: out over 0.03 to 0.42 T and in over 0.50 to 0.90 T, settled in the brake. They are
  clipped so no text crosses a folder cut.
- D3. Slower per-letter motion comes from hook-only cascade overlaps (in 0.70/0.92, out 0.80/0.94) through optional params. The
  global `TM_*` constants and the old components are unchanged, so tests are unchanged.
- D4. Rails are unmounted, not deleted. Their libs stay because tests cover them, and `FOREX_CHAIN_STOPS` and `marketSlabX` are still used.
- D5. Per-hook `tone`: stock and opportunity frames are dark, so the S1 to O2 hooks use cream ink. The colour is static per hook
  (no animated colour).
- D6. O2 gets a hook (supersedes the opportunity-video-handoff D6/D7 rule "O2 must be text-free", per the owner's "every slide").
  It leaves during the O3 glide. O3/V belongs to the closing lines.
- D7. The landing hold goes from 450 to 700 ms for reading time. The O3 -> video auto-advance stays at 450 ms (`AUTO_ADVANCE_MS`).
- D8. The crypto box moves to one top-right position (the old intro spot, clear of the coins at all four stops). This replaces the
  three positions (top-right, top-left, centred above the coin). The `.cslab--teach`/`--close` CSS stays, unused.
