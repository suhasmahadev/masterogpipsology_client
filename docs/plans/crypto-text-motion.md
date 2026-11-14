# Crypto text motion, display font and promotional copy

Branch `luxury-upgrade`, base `47bb423` (Crypto step scroll, approved). Owner request (verbatim):

> "now the texts must be animated not plane text it should come in in movement, and go out in movement, set up some good
> cool million dollar animation for all text with the same speed of the sc[roll] and also different font and some sensible
> text to promote our company"

Scope: every text in the Crypto step scroll:
- slab 1 intro (eyebrow, headline, body, tags)
- slab 2 "How we teach"
- slab 3 line above the coin
- the Crypto caption rail

The Forex rail keeps its current look. `ScrollCaptions` is shared, so the new behaviour is opt-in through a `variant` prop.

**Addendum (coordinator): two step-scroll changes are planned in section 9.** They are a momentum-style ease-out into every
stop, and a fourth slab 179 -> Forex frame 1 across the ForexFade. They change the timing the text motion scrubs against, so
they are implemented **first**, as Phase S (section 9), before Phase 1 below.

`hx` is not installed in this repo (`hx: command not found`). Design decisions are recorded in section 2, as in
`docs/plans/crypto-step-scroll.md`.

---

## 1. Findings (from code, no exploration needed by the coder)

- **Driver.** `components/sections/CryptoMarketScroll.tsx` `onUpdate` computes `s = step.coord(u.scroll)` (the stop coordinate,
  -1..4; stops at s = 0, 1, 2, 3 = raw 1, 112, 139, 179). It then calls `slabRef.current?.(s)` and
  `captionRef.current?.(railU(s))`. Everything below is a pure function of `s`, so it moves at the exact speed of the frames and
  plays backwards on scroll-up. There is no time-based animation.
- **Slab windows.** `lib/crypto-slabs.ts` `CRYPTO_SLAB_WINDOWS` is unchanged. Every slab is fully shown at its stop(s):
  - intro: s = 0 and 1
  - teach: s = 2
  - close: s = 3

  The coin-clearance and "close text only while the coin is low" tests depend on these windows, so they must not move.
- **Current slab motion.** `slabPart` sets opacity and an 18 px rise per `[data-part]`. Reduced motion is a discrete 0/1 switch.
- **Rail.** `ScrollCaptions` has one effect and no React state. It writes transform and opacity to nodes, lines and plates.
  `measure()` (offsetTop) runs only on resize, fonts.ready and media change. The text sits inside `.wf__plate`.
- **Rules (`rules.md`).**
  - §2: "Animate only transform and opacity. No animated CSS filters (blur, saturate)". There is one shared clock (gsap.ticker),
    and we are already inside it.
  - §3: copy changes only when the owner asks. The owner asked.
  - §3: no invented numbers.
  - §4: "Typography: Display: Cormorant Garamond" is listed as locked. The owner now explicitly asks for a different font, so this
    plan scopes the new face to the Crypto texts only and leaves the site-wide lock intact (see Q1).
- **Fonts today.** `app/layout.tsx` loads `Cormorant_Garamond` (normal + italic, `--font-display-serif`) and `Manrope`
  (`--font-sans-body`) through `next/font/google`, and applies them as `className` variables on `<html>`.
  `app/globals.css` maps them to `--font-display` and `--font-body` in `@theme inline`.
  The `next/font` docs (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`) say:
  - variable fonts need no `weight`
  - `axes` adds extra variable axes
  - `variable` names the CSS variable
  - `display` defaults to `swap`
  - `preload` defaults to true

  `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` confirms:
  - Bodoni Moda: variable; axes opsz 6..96 and wght 400..900; normal + italic
  - Instrument Serif: 400 only; normal + italic
  - Italiana: 400 only; normal only
- **CSS layering.** The `.cslab` and `.wf` rules sit unlayered at the end of `app/globals.css`, after `@import "tailwindcss"`.
  Unlayered rules beat Tailwind utilities, so the overrides below win without `!important`.
- **Tests.** `node --test "tests/**/*.test.mjs"` (Node 24, type stripping) imports `lib/*.ts` directly. New pure modules must be
  import-free and use only erasable TS syntax (no enums, no parameter properties).
- **No layout effect from the masks.** Inline-block masks with padding and equal negative margins keep the margin box equal to the
  line box. Line breaks, slab heights and coin clearance stay as they are, except for the font metric change handled in §3.4.

---

## 2. Design decisions (would be `hx decision add`)

**D1. Motion language "Rise and lift".** One coherent grammar for every Crypto text:
- **Words and letters** sit in overflow masks. They enter by rising from below the mask, hinged at their baseline and leaning back
  (rotateX). They settle flat. They exit by lifting out through the top of the mask with a slight forward tip.
- **Gold hairlines** draw in from the text side and, on exit, sweep on and away in the same direction. They do not shrink back.
- **Gold diamonds** (path separators) pop in and out with scale.
- **The gold italic accent** of each headline is staggered letter by letter (the site's "letter by letter" headline idiom from
  rules §4). Plain headline words and body words stagger word by word.
- **Order.** Exits run first-in-first-out, so the block leaves as an upward wave. Scrolling up replays everything in reverse
  exactly, because every value is a pure function of `s`.

**D2. No animated blur, no animated clip-path (cap = 0).**
- `filter: blur()` written per tick from JS is not a compositor-only change. Each changed radius re-rasterises the blurred layer.
  The cost grows with the blurred area times the radius. Across 40 to 60 word layers on a mid-range phone, blur would add several
  milliseconds of raster and GPU time per tick, on top of the frame canvas draw, during exactly the glides that must hold 60 fps.
  `rules.md` §2 also forbids it.
- `clip-path` written per tick triggers a repaint of the element.
- Overflow masks plus `transform` give the same "wipe/reveal" look and stay compositor-only.

**D3. Split at render, not with SplitText.** Words and letters are emitted as spans by a small server-renderable component
(`SplitWords`), from the strings in `lib/content.ts`. This means:
- no DOM mutation
- no layout read
- no re-split on resize, because word masks follow the natural line wrap

`collectUnits` gathers the spans once in the mount effect. The tick only reads cached arrays and writes `style.transform` and
`style.opacity`, with string caching, so there are no redundant writes and no React re-renders.

**D4. Two-level cascade timing.** Each slab window `[inFrom, inTo]` is split across its parts (label, title, accent, body,
tags/path) with overlap. Each part's sub-window is split across its units (words, letters, chips) with heavier overlap. Exits use
the same cascade over `[outFrom, outTo]` with tighter overlap, so exits are brisker.
- Every unit window is nested inside the slab window. At the stops every unit is exactly settled (identity transform, opacity 1).
- Nothing moves during the landing holds.

**D5. Reduced motion = still crossfade.**
- Slabs: units are written once at identity. Each `[data-part]` gets a scrubbed opacity crossfade over the slab's in and out
  windows (`slabPart(..., reduced = true)`, changed from discrete to a crossfade with y = 0).
- Rail: keeps its current reduced behaviour (discrete steps, no spark). Text units sit at identity.

**D6. Display face: Bodoni Moda (variable, opsz + wght, roman + italic) via `next/font/google`, scoped to Crypto texts.**
- It is applied through a new variable `--font-lux-display` and a local `--font-lux` stack on `.cslab` and `.wf--crypto` only.
- `--font-display` (Cormorant) is untouched, so the hero, Forex, the Intelligence closing lines and everything else are unchanged.
- Labels, body and chips stay Manrope (and the chips stay mono). The pairing is a high-contrast Didone with a geometric sans.
- Sizes are retuned by about 0.88 because Bodoni is wider than Cormorant at the same font-size.

**D7. Copy lives in `lib/content.ts`.**
- New: `CRYPTO_SLAB_INTRO`.
- Rewritten: `CRYPTO_SLAB_TEACH` and `CRYPTO_SLAB_CLOSE`.
- New: `CRYPTO_RAIL_LINES` (5 entries, one per rail hold).

`lib/scroll-captions.ts` stops deriving Crypto captions from `MARKETS` (the Curriculum copy stays as is). The copy follows these
rules:
- no profit promises
- no numbers
- every claim is either stated elsewhere already ("live" programme in `app/layout.tsx` metadata, Mysore and Bengaluru locations in
  the footer) or is descriptive

**D8. Budget.** At most `TM_MAX_UNITS = 60` animated units per slab, checked by a dev-only `console.warn` and by a unit test on the
copy. Planned counts:

| Text | Units |
|---|---|
| intro | 55 |
| teach | 57 |
| close | 22 |
| rail | 2 to 6 per caption |

- The tick skips a slab entirely while it sits in a static zone (before, hold, after).
- Peak load is one slab transition plus one rail transition: about 70 units, so at most about 140 cached style writes per tick,
  all compositor-only.

---

## 3. Changes and commits

The rule is to commit before each change. No push without the owner's OK.

### Phase 0: plan (commit "Plan: Crypto text motion, font, copy")

Commit this file only.

### Phase 1: pure math and tests (commit "Text motion: cascade and unit math with tests")

#### 3.1 New `lib/text-motion.ts` (import-free)

```ts
// Pure math for scroll-scrubbed text motion (components/sections/CryptoSlabs.tsx, ScrollCaptions variant "crypto").
// Import-free: node --test loads it. Every value is a function of the scrubbed coordinate only (no time).

export type UnitKind = 'tilt' | 'rise' | 'line' | 'pop';

export const TM_RISE_PCT = 130;         // enters from this far below its mask (% of own height; clears mask padding .28em)
export const TM_LIFT_PCT = 130;         // leaves this far above
export const TM_TILT_IN_DEG = 40;       // 'tilt': rotateX while rising (origin 50% 100%: top edge leans away)
export const TM_TILT_OUT_DEG = 18;      // 'tilt': rotateX(-) while lifting out (tips forward)
export const TM_IN_PART_OVERLAP = 0.55; // parts of a block overlap this share while entering
export const TM_IN_UNIT_OVERLAP = 0.82; // units (words, letters) inside a part
export const TM_OUT_PART_OVERLAP = 0.7; // exits are tighter
export const TM_OUT_UNIT_OVERLAP = 0.9;
export const TM_MAX_UNITS = 60;         // per slab (dev warning + copy test)

export interface Span { a: number; b: number }
export interface UnitStyle { opacity: number; y: number; rot: number; x: number; scale: number }

/** Sub-window k of n over [from, to]: equal lengths d, starts d * (1 - overlap) apart, k = 0 starts at from, k = n - 1 ends at to. */
export function cascade(from: number, to: number, k: number, n: number, overlap: number, out?: Span): Span;
//   count = max(1, floor(n)); idx = clamp(floor(k), 0, count - 1); ov = clamp(overlap, 0, 0.99); step = 1 - ov
//   d = (to - from) / (1 + (count - 1) * step); a = from + idx * d * step; b = a + d

/** Raw 0..1 progress of unit (unit of units) in part (part of parts) over [from, to]. NaN -> 0; -Infinity -> 0; +Infinity -> 1. */
export function staged(x: number, from: number, to: number, part: number, parts: number, unit: number, units: number,
  partOverlap: number, unitOverlap: number): number;
//   uses a module-level scratch Span: cascade(from, to, part, parts, partOverlap, sc); cascade(sc.a, sc.b, unit, units, unitOverlap, sc)
//   then ramp(x, sc.a, sc.b) with ramp(x, a, b) = b > a ? clamp01((x - a) / (b - a)) : x >= b ? 1 : 0

export function easeOutQuart(t: number): number; // 1 - (1 - c)^4, c = clamp01(t)
export function easeInCubic(t: number): number;  // c^3

/** Eased entry 0..1 (easeOutQuart of staged with the IN overlaps). */
export function enterAt(x: number, from: number, to: number, part: number, parts: number, unit: number, units: number): number;
/** Eased exit 0..1 (easeInCubic of staged with the OUT overlaps). */
export function leaveAt(x: number, from: number, to: number, part: number, parts: number, unit: number, units: number): number;

/** Style for entry vin and exit vout (both 0..1). Settled (vin 1, vout 0) = identity for every kind. */
export function unitStyle(kind: UnitKind, vin: number, vout: number, out?: UnitStyle): UnitStyle;
//   defaults: opacity = vin * (1 - vout); y = 0; rot = 0; x = 0; scale = 1
//   'tilt': y = (1 - vin) * TM_RISE_PCT - vout * TM_LIFT_PCT; rot = (1 - vin) * TM_TILT_IN_DEG - vout * TM_TILT_OUT_DEG
//   'rise': y as 'tilt', rot = 0
//   'line': scale = max(0, vin - vout); x = vout * 100; opacity = scale > 0 ? 1 : 0
//            (drawn segment = [x, x + scale] of the width: draws in from the origin side, then sweeps off the far end)
//   'pop':  scale = vin * (1 - vout)

/** CSS transform for a style. dir = -1 mirrors 'line' (origin on the right). */
export function unitTransform(kind: UnitKind, st: UnitStyle, dir: number): string;
//   'tilt': `translate3d(0,${st.y.toFixed(2)}%,0) rotateX(${st.rot.toFixed(2)}deg)`
//   'rise': `translate3d(0,${st.y.toFixed(2)}%,0)`
//   'line': `translate3d(${(dir * st.x).toFixed(2)}%,0,0) scaleX(${st.scale.toFixed(4)})`
//   'pop':  `rotate(45deg) scale(${st.scale.toFixed(4)})`

/** Words of a string (split on whitespace, empties dropped). */
export function splitWords(text: string): string[];   // text.trim().split(/\s+/).filter(Boolean)
/** Code points of a word (Array.from). */
export function splitChars(word: string): string[];
```

Note on `dir * st.x` producing `-0.00`: this is harmless. It only affects the string cache.

#### 3.2 `lib/crypto-slabs.ts` edits

1. Change the reduced branch of `slabPart` to a still crossfade. This is the same for every part, and `j` and `n` are ignored:
   ```ts
   if (reduced) {
     o.opacity = smooth(ramp(x, w.inFrom, w.inTo)) * (1 - smooth(ramp(x, w.outFrom, w.outTo)));
     o.y = 0;
     return o;
   }
   ```
   Update the doc comment to "reduced = whole-part crossfade over the windows, no movement".
2. Add the zone helper, used to skip static slabs in the tick:
   ```ts
   /** 0 before inFrom, 1 entering, 2 hold [inTo, outFrom), 3 leaving [outFrom, outTo], 4 after. Even zones are static. NaN -> 0. */
   export function slabZone(s: number, w: SlabWindow): 0 | 1 | 2 | 3 | 4 {
     if (Number.isNaN(s) || s < w.inFrom) return 0;
     if (s < w.inTo) return 1;
     if (s < w.outFrom) return 2;
     if (s <= w.outTo) return 3;
     return 4;
   }
   ```
   At `s === outFrom` the zone is 3 and every vout is 0 there, so writing is harmless. At `s === inTo` the zone is 2; every unit
   window ends at or before `inTo`, so all units are settled.

#### 3.3 `lib/caption-flow.ts` addition

```ts
export interface TextPhase { vin: number; vout: number }
/** Text phase of rail step j: vin while it becomes current, vout while it leaves the trail (or the flow exits). */
export function stepTextPhase(j: number, s: FlowState, out?: TextPhase): TextPhase {
  const o = out ?? { vin: 0, vout: 0 };
  const i = s.index;
  o.vin = j < i ? 1 : j === i ? s.enter : j === i + 1 ? s.advance : 0;
  const leave = j < i - 1 ? 1 : j === i - 1 ? s.advance : 0;
  o.vout = leave > s.exit ? leave : s.exit;
  return o;
}
```

Continuity at the index switch (advance 1, then index + 1 with advance 0) holds for every j. This is checked in the tests.

#### Tests: new `tests/text-motion.test.mjs`

It imports `../lib/text-motion.ts` and `../lib/caption-flow.ts`. Add these cases:

1. **cascade bounds.** For n in 1..60 and overlap in {0, 0.55, 0.82, 0.9, 0.99, 1.5, -1}:
   - k = 0 starts at `from` and k = n - 1 ends at `to` (within 1e-12)
   - all lengths are equal
   - starts are non-decreasing
   - every [a, b] lies within [from, to]
   - n = 1 returns [from, to]
2. **Nested containment.** For parts in 1..6, units in 1..60, and the IN and OUT overlaps: the unit window computed inside
   `staged` lies within [from, to]. Check it through `staged`: it returns 0 at x = from - 1e-9 and 1 at x = to + 1e-9 for every
   address.
3. **enterAt / leaveAt.**
   - 0 for x <= from, 1 for x >= to
   - monotone non-decreasing over x in [from - 0.1, to + 0.1] in 1e-4 steps
   - NaN gives 0
   - for k < k' in the same part, enterAt(x, ..k) >= enterAt(x, ..k') for all x (earlier units are ahead)
   - the same ordering holds across parts
4. **Continuity.** For parts = 5, units = 60, window [0, 0.5], 1e-4 steps: |delta enterAt| < 0.03 and |delta leaveAt| < 0.03.
5. **unitStyle.**
   - For every kind, (1, 0) gives opacity 1, y 0, rot 0, x 0, scale 1.
   - (0, 0) gives opacity 0 (line: scale 0 and opacity 0).
   - (1, 1) gives opacity 0.
   - 'tilt' at (0, 0): y = TM_RISE_PCT, rot = TM_TILT_IN_DEG. At (1, 1): y = -TM_LIFT_PCT, rot = -TM_TILT_OUT_DEG.
   - 'line' at (1, 0.5): scale 0.5, x 50.
6. **unitTransform.** The identity strings are exact:
   - `translate3d(0,0.00%,0) rotateX(0.00deg)`
   - `translate3d(0,0.00%,0)`
   - `translate3d(0.00%,0,0) scaleX(1.0000)`
   - `rotate(45deg) scale(1.0000)`

   Line with dir -1 at (1, 0.5) gives `translate3d(-50.00%,0,0) scaleX(0.5000)`.
7. **splitWords / splitChars.** `'  a  b\nc '` gives `['a','b','c']`. `''` gives `[]`. `splitChars('next.')` has length 5.
8. **stepTextPhase.** Use a 5-step spec built with `spreadWindows(5, 0.1, 0.9)` and `flowState`:
   - Hold midpoints: for j <= i, vin = 1. For j >= i + 1, vin = 0. For j < i - 1, vout = 1. For j in {i - 1, i}, vout = 0.
   - Continuity over p in 1e-4 steps: |delta vin| and |delta vout| < 0.02 for every j.
   - At p = 1 (exit 1), vout = 1 for all j.

#### Edits to `tests/crypto-slabs.test.mjs`

- Replace "reduced motion is discrete" with "reduced motion is a still crossfade". For every slab and s in -1..4 (0.01 steps),
  using j = 0..3 and n = 4:
  - y === 0
  - opacity is equal for all j
  - opacity is 1 at that slab's stops
  - opacity is 0 for s <= inFrom and s >= outTo
  - continuity: |delta| < 0.05 at 1e-3 steps
- Add "units are settled at the stops and inside the windows". Use the copy from `../lib/content.ts` and the test-only
  `unitCounts(copy)` below. For every slab, every part p and unit u, and every s:
  - At the slab's stops: `enterAt(s, w.inFrom, w.inTo, p, P, u, U) === 1` and `leaveAt(s, w.outFrom, w.outTo, p, P, u, U) === 0`.
  - For s <= w.inFrom, `unitStyle('tilt', vin, vout).opacity === 0`. The same holds for s >= w.outTo.
  - For the close slab: with s from 2 to 4 (step 0.001), whenever any unit has opacity > 0, the raw-frame check of the existing
    "close text only while the coin is low" test passes. Factor that check into a helper and reuse it.
  - Total units per slab are <= `TM_MAX_UNITS`.
  ```js
  // Mirrors the JSX in CryptoSlabs.tsx (parts in DOM order). Letters of the gold accent are counted without spaces.
  const words = (t) => t.trim().split(/\s+/).filter(Boolean);
  const letters = (t) => words(t).reduce((n, w) => n + Array.from(w).length, 0);
  function unitCounts(copy, kind) {
    const parts = [];
    parts.push(kind === 'close' ? 3 : 2);                    // label: rule(s) + text
    parts.push(words(copy.title[0]).length);                 // plain title, words
    parts.push(letters(copy.title[1]));                      // gold accent, letters
    if (copy.body) parts.push(words(copy.body).length);      // body, words
    if (copy.tags) parts.push(copy.tags.length);             // intro chips
    if (copy.path) parts.push(copy.path.length * 2 - 1);     // teach path items + diamonds
    return parts;
  }
  ```
- Add "rail copy fits".
  - `CRYPTO_RAIL_LINES.length === CRYPTO_RAIL_HOLDS_S.length` (5).
  - Every text is <= 28 characters and every label is <= 20.
  - The close and teach slab labels are <= 22 characters, so the close label plus its two rules fits a 360 px phone at .28em tracking. The intro label is exempt (see §3.8).

### Phase 2: font, CSS, split component, DOM helper (commit "Crypto text: Bodoni Moda, masks, split and scrub helpers")

#### 3.4 `app/layout.tsx`

```ts
import { Bodoni_Moda, Cormorant_Garamond, Manrope } from 'next/font/google';
// Crypto step-scroll display face (CryptoSlabs + Crypto caption rail). Variable: wght + opsz (optical size follows font-size).
const lux = Bodoni_Moda({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-lux-display',
  display: 'swap',
});
// <html className={cn(display.variable, sans.variable, lux.variable)} ...>
```

Keep the default `preload: true`, because Crypto is the first sequence after the hero. Do not pass `weight`; the font is variable.

#### 3.5 `app/globals.css`

Edit the "Crypto slab texts" block:
- Delete `.cslab [data-part] { opacity: 0; will-change: transform, opacity; }`.
- Change `.cslab__title` `font-family` to `var(--font-lux)`. Keep weight 500, line-height 1.08, letter-spacing -.01em and the
  text-shadow.
- The `em` keeps italic 400 and gold.

Add or replace these rules:

```css
/* Crypto text motion (lib/text-motion.ts): masks + transform/opacity only, written from the Crypto frame tick. */
.cslab, .wf--crypto { --font-lux: var(--font-lux-display), 'Bodoni Moda', 'Bodoni 72', Didot, Georgia, serif; }
.cslab [data-u], .wf--crypto [data-u] { opacity: 0; will-change: transform, opacity; }
.tm-mask { display: inline-block; vertical-align: top; overflow: hidden; white-space: nowrap; perspective: 600px;
  padding: .2em .12em .28em; margin: -.2em -.12em -.28em; }
.tm-mask--chip { padding: 4px; margin: -4px; }
.tm-mask > .tm-u { display: inline-block; }
.tm-u[data-u="tilt"] { transform-origin: 50% 100%; backface-visibility: hidden; }
.cslab__rule { transform-origin: 0 50%; }
.cslab__rule[data-dir="-1"] { transform-origin: 100% 50%; }

/* Bodoni sets wider than Cormorant: display sizes x ~0.88 */
.cslab__title--intro { font-size: calc(var(--fs-h2) * .88); }
```

Change the existing size rules to:

| Selector (context) | Old | New |
|---|---|---|
| `.cslab--teach .cslab__title` | `clamp(1.5rem, 6.4vw, 2rem)` | `clamp(1.35rem, 5.6vw, 1.75rem)` |
| same, `@media (width >= 48rem) and (min-aspect-ratio: 4/5)` | `clamp(1.75rem, 1rem + 1.6vw, 2.75rem)` | `clamp(1.55rem, .9rem + 1.4vw, 2.4rem)` |
| `.cslab--close .cslab__title` | `clamp(1.5rem, min(4.4dvh, 3vw), 3.25rem)` | `clamp(1.35rem, min(3.9dvh, 2.65vw), 2.85rem)` |
| same, `@media (max-aspect-ratio: 4/5)` | `clamp(1.5rem, 6.5vw, 2.75rem)` | `clamp(1.35rem, 5.7vw, 2.4rem)` |
| same, `@media (max-height: 30rem)` | `1.25rem` | `1.125rem` |

Leave all position rules alone: `.cslab--teach` left/top/width, `.cslab--close` `--coin-top`, `--coin-gap` and bottom. The close
block is bottom-anchored above the coin, so a taller title grows upward, away from the coin.

Add to the Workflow captions block:

```css
.wf__text { font-family: var(--font-display); }
.wf--crypto .wf__text { font-family: var(--font-lux); font-weight: 500; font-size: 1.125rem; letter-spacing: -.005em; }
@media (width >= 48rem) { .wf--crypto .wf__text { font-size: 1.375rem; } }
```

#### 3.6 New `components/motion/SplitWords.tsx`

This is a server-renderable component with no hooks and no `'use client'` (it is only used inside client components).

```tsx
import React, { Fragment } from 'react';
import { splitChars, splitWords, type UnitKind } from '@/lib/text-motion';

/**
 * Words in overflow masks; each word (letters = false) or each letter (letters = true) is one scrubbed unit ([data-u]).
 * Spaces stay as text nodes between masks, so lines wrap naturally. Callers hide this from AT and provide an sr-only copy.
 */
export function SplitWords({ text, kind = 'tilt', letters = false }: { text: string; kind?: UnitKind; letters?: boolean }): React.ReactElement {
  const words = splitWords(text);
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span className="tm-mask">
            {letters
              ? splitChars(w).map((c, k) => <span key={k} className="tm-u" data-u={kind}>{c}</span>)
              : <span className="tm-u" data-u={kind}>{w}</span>}
          </span>
        </Fragment>
      ))}
    </>
  );
}
export default SplitWords;
```

#### 3.7 New `components/motion/scrub-units.ts`

This is a client DOM helper. It is not pure and is not tested by node.

```ts
import { unitStyle, unitTransform, type UnitKind, type UnitStyle } from '@/lib/text-motion';

export interface ScrubUnit {
  el: HTMLElement; kind: UnitKind; dir: number;
  part: number; parts: number; unit: number; units: number;
  t: string; o: string; // last written transform / opacity
}

/** Mount-time only: [data-u] units grouped by their [data-part] under root, both in DOM order. */
export function collectUnits(root: ParentNode): ScrubUnit[] {
  const partEls = Array.from(root.querySelectorAll<HTMLElement>('[data-part]'));
  const out: ScrubUnit[] = [];
  partEls.forEach((p, pi) => {
    const us = Array.from(p.querySelectorAll<HTMLElement>('[data-u]'));
    us.forEach((el, ui) => {
      out.push({ el, kind: (el.dataset.u as UnitKind) ?? 'rise', dir: el.dataset.dir === '-1' ? -1 : 1,
        part: pi, parts: partEls.length, unit: ui, units: us.length, t: '', o: '' });
    });
  });
  return out;
}

export function invalidateUnits(list: ScrubUnit[]): void { for (const u of list) { u.t = ''; u.o = ''; } }

const st: UnitStyle = { opacity: 0, y: 0, rot: 0, x: 0, scale: 1 };
/** Writes one unit (cached; transform + opacity only). Returns its opacity. Reduced motion: call with (1, 0). */
export function writeUnit(u: ScrubUnit, vin: number, vout: number): number {
  unitStyle(u.kind, vin, vout, st);
  const t = unitTransform(u.kind, st, u.dir);
  const o = st.opacity.toFixed(3);
  if (t !== u.t) { u.t = t; u.el.style.transform = t; }
  if (o !== u.o) { u.o = o; u.el.style.opacity = o; }
  return st.opacity;
}
```

### Phase 3: wiring and copy (commit "Crypto text: rise-and-lift motion, Bodoni, MOP copy")

#### 3.8 `lib/content.ts`

Add `tags?: readonly string[]` to `CryptoSlabCopy` and update the `body` comment to "Optional paragraph". Then replace the two
slab constants and add the intro and rail constants, right after the `CryptoSlabCopy` interface:

```ts
/** Slab 1 (approach -> stop raw 112): who MOP is and why crypto comes first. */
export const CRYPTO_SLAB_INTRO: CryptoSlabCopy = {
  label: 'Master of Pipsology · Crypto',
  title: ['Learn the market', 'that never sleeps.'],
  body: 'Master of Pipsology is a trading academy in Mysore and Bengaluru. We begin with crypto, the clearest place to learn structure, liquidity and risk before real capital is on the line.',
  tags: ['BTC • BITCOIN', 'ETH • ETHEREUM', 'SOL • SOLANA'],
};
/** Slab 2 (frames 112 -> 139): how MOP teaches, from the basics to independent trading. */
export const CRYPTO_SLAB_TEACH: CryptoSlabCopy = {
  label: 'The MOP method',
  title: ['From the first chart', 'to the final call.'],
  body: 'Live sessions, one step at a time. We start at zero, then build structure, liquidity and risk until you can plan, take and manage a trade on your own.',
  path: ['Foundations', 'Structure', 'Risk', 'Execution'],
};
/** Slab 3 (stop raw 179, the hand-off): centred above the falling coin; Forex follows. */
export const CRYPTO_SLAB_CLOSE: CryptoSlabCopy = {
  label: 'Master of Pipsology',
  title: ['Crypto is chapter one.', 'Forex comes next.'],
};
/** Crypto caption rail, one [label, text] per hold (lib/crypto-slabs.ts CRYPTO_RAIL_HOLDS_S: s = 0, 0.5, 1, 2, 3). */
export const CRYPTO_RAIL_LINES: readonly (readonly [string, string])[] = [
  ['Crypto', 'Open around the clock'],
  ['Master of Pipsology', 'Where the journey begins'],
  ['Foundations', 'Bitcoin, Ethereum, Solana'],
  ['Discipline', 'Risk first, then the trade'],
  ['Mysore · Bengaluru', 'Two cities, one standard'],
];
```

Expected unit counts:

| Slab | Parts | Total |
|---|---|---|
| intro | label 2, title 3, accent 16, body 31, tags 3 | 55 |
| teach | label 2, title 4, accent 15, body 29, path 7 | 57 |
| close | label 3, title 4, accent 15 | 22 |

All are at or below 60.

The intro label (28 characters) sits top-right and is not width-constrained like the close label. For the "rail copy fits" test,
apply the 22-character label limit to `CRYPTO_SLAB_CLOSE` and `CRYPTO_SLAB_TEACH` only.

#### 3.9 `lib/scroll-captions.ts`

- Import `CRYPTO_RAIL_LINES` from `@/lib/content`.
- Remove `MARQUEE_ITEMS` from the import (it becomes unused). Also remove `const crypto = market('crypto');` and the old
  `cryptoLines`.
- Build `CRYPTO_FLOW` as before, with `steps: CRYPTO_RAIL_LINES.map(([label, text], i) => ({ label, text, start: cryptoRail.steps[i].start, end: cryptoRail.steps[i].end }))`.
- Update the header comment: Crypto rail copy comes from `CRYPTO_RAIL_LINES`.

#### 3.10 `components/sections/ScrollCaptions.tsx`

1. Add the prop `variant?: 'default' | 'crypto'` (default `'default'`) and set `const motion = variant === 'crypto';`.
2. Change the root `className` to `` `wf ${motion ? 'wf--crypto ' : ''}absolute inset-x-0 z-40 pointer-events-none` ``.
3. Plate content:
   ```tsx
   <div data-part className="text-[10px] md:text-[11px] font-body uppercase tracking-[0.28em] font-semibold" style={{ color: INK, fontVariant: 'small-caps' }}>
     {motion ? <span className="tm-mask"><span className="tm-u" data-u="rise">{c.label}</span></span> : c.label}
   </div>
   <div data-part className="wf__text mt-1 font-medium leading-tight text-xl md:text-2xl" style={{ color: INK }}>
     {motion ? <SplitWords text={c.text} kind="tilt" /> : c.text}
   </div>
   ```
   The inline `fontFamily` goes away; `.wf__text` supplies it, and Forex keeps `var(--font-display)`.
4. In the effect:
   - Collect the units: `const units: ScrubUnit[][] = motion ? rows.map((r) => (r ? collectUnits(r) : [])) : [];`
   - Create the phase object: `const tp: TextPhase = { vin: 0, vout: 0 };`
   - `invalidate()` also runs `for (const l of units) invalidateUnits(l);`.
   - In `apply`, inside the `for j` loop after the existing writes:
     ```ts
     if (motion) {
       stepTextPhase(j, st, tp);
       const list = units[j];
       for (let k = 0; k < list.length; k++) {
         const u = list[k];
         if (reduced) writeUnit(u, 1, 0);
         else writeUnit(u, enterAt(tp.vin, 0, 1, u.part, u.parts, u.unit, u.units), leaveAt(tp.vout, 0, 1, u.part, u.parts, u.unit, u.units));
       }
     }
     ```
   - Effect deps: `[flow, driverRef, motion]`.
5. Imports: `SplitWords`, `collectUnits`, `invalidateUnits`, `writeUnit`, `type ScrubUnit`, `enterAt`, `leaveAt`,
   `stepTextPhase`, `type TextPhase`.

#### 3.11 `components/sections/CryptoMarketScroll.tsx`

Change `<ScrollCaptions flow={CRYPTO_FLOW} driverRef={captionRef} />` to `<ScrollCaptions flow={CRYPTO_FLOW} driverRef={captionRef} variant="crypto" />`.
Nothing else changes.

#### 3.12 `components/sections/CryptoSlabs.tsx` (full replacement of body and JSX)

Imports:

```ts
import { CRYPTO_SLAB_CLOSE, CRYPTO_SLAB_INTRO, CRYPTO_SLAB_TEACH } from '@/lib/content';
import { CRYPTO_SLAB_WINDOWS, slabPart, slabZone, type PartStyle, type SlabId } from '@/lib/crypto-slabs';
import { enterAt, leaveAt, TM_MAX_UNITS } from '@/lib/text-motion';
import { SplitWords } from '@/components/motion/SplitWords';
import { collectUnits, invalidateUnits, writeUnit, type ScrubUnit } from '@/components/motion/scrub-units';
```

Keep `SlabDriver` and `IDS` unchanged. The effect:

```ts
useEffect(() => {
  const root = rootRef.current;
  if (!root) return;
  const slabs: HTMLElement[] = [];
  const parts: HTMLElement[][] = [];
  const units: ScrubUnit[][] = [];
  for (const id of IDS) {
    const el = root.querySelector<HTMLElement>(`[data-slab="${id}"]`);
    if (!el) return;
    slabs.push(el);
    parts.push(Array.from(el.querySelectorAll<HTMLElement>('[data-part]')));
    const list = collectUnits(el);
    if (process.env.NODE_ENV !== 'production' && list.length > TM_MAX_UNITS) {
      console.warn(`CryptoSlabs: "${id}" has ${list.length} animated units (budget ${TM_MAX_UNITS})`);
    }
    units.push(list);
  }
  const lastPartO: string[][] = parts.map((p) => p.map(() => ''));
  const lastVis: string[] = slabs.map(() => '');
  const lastZone: number[] = slabs.map(() => -1);
  const fade: PartStyle = { opacity: 0, y: 0 };
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = mq.matches;
  let last = Number.NaN;

  const apply = (s: number, force?: boolean): void => {
    if (s === last && !force) return;
    last = s;
    for (let i = 0; i < IDS.length; i++) {
      const w = CRYPTO_SLAB_WINDOWS[IDS[i]];
      const zone = slabZone(s, w);
      if (!force && zone === lastZone[i] && (zone & 1) === 0) continue; // before / hold / after: nothing moves
      lastZone[i] = zone;
      let any = false;
      // Reduced: whole parts crossfade, units still. Full motion: parts stay at 1, units move.
      slabPart(s, w, 0, 1, true, fade);
      const po = reduced ? fade.opacity.toFixed(3) : '1';
      if (reduced && fade.opacity > 0.002) any = true;
      const pl = parts[i];
      for (let j = 0; j < pl.length; j++) if (lastPartO[i][j] !== po) { lastPartO[i][j] = po; pl[j].style.opacity = po; }
      const list = units[i];
      for (let k = 0; k < list.length; k++) {
        const u = list[k];
        const op = reduced
          ? writeUnit(u, 1, 0)
          : writeUnit(u, enterAt(s, w.inFrom, w.inTo, u.part, u.parts, u.unit, u.units), leaveAt(s, w.outFrom, w.outTo, u.part, u.parts, u.unit, u.units));
        if (!reduced && op > 0.002) any = true;
      }
      const vis = any ? 'visible' : 'hidden';
      if (vis !== lastVis[i]) { lastVis[i] = vis; slabs[i].style.visibility = vis; }
    }
  };

  const onMq = (e: MediaQueryListEvent): void => {
    reduced = e.matches;
    for (const l of units) invalidateUnits(l);
    for (const p of lastPartO) p.fill('');
    apply(last, true);
  };
  mq.addEventListener('change', onMq);
  driverRef.current = apply;
  apply(-1, true);
  return () => { driverRef.current = null; mq.removeEventListener('change', onMq); };
}, [driverRef]);
```

JSX. Keep the wrapper `<div ref={rootRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>`.

```tsx
{/* Slab 1: intro, top-right */}
<div data-slab="intro" className="cslab cslab--intro">
  <div className="w-full h-full max-w-7xl mx-auto px-5 sm:px-8 md:px-12 lg:px-16 flex flex-col justify-between py-10 md:py-14">
    <div className="flex flex-col items-end text-right max-w-xl self-end">
      <div data-part className="cslab__label">
        <span className="tm-mask"><span className="tm-u" data-u="rise">{intro.label}</span></span>
        <span className="cslab__rule" data-u="line" />
      </div>
      <h2 className="cslab__title cslab__title--intro">
        <span className="sr-only">{intro.title[0]} {intro.title[1]}</span>
        <span aria-hidden="true">
          <span data-part><SplitWords text={intro.title[0]} kind="tilt" /></span>
          <br />
          <em data-part><SplitWords text={intro.title[1]} kind="tilt" letters /></em>
        </span>
      </h2>
      {intro.body && (
        <p className="mt-4 md:mt-6 text-sm md:text-base font-body text-[#524C42] leading-relaxed max-w-md">
          <span className="sr-only">{intro.body}</span>
          <span data-part aria-hidden="true"><SplitWords text={intro.body} kind="rise" /></span>
        </p>
      )}
      {intro.tags && (
        <div data-part className="mt-6 flex flex-wrap justify-end gap-2.5">
          {intro.tags.map((t) => (
            <span key={t} className="tm-mask tm-mask--chip">
              <span className="tm-u px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs" data-u="rise">{t}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
</div>

{/* Slab 2: the MOP method, top-left (phones: top band) */}
<div data-slab="teach" className="cslab cslab--teach">
  <div data-part className="cslab__label">
    <span className="tm-mask"><span className="tm-u" data-u="rise">{teach.label}</span></span>
    <span className="cslab__rule" data-u="line" />
  </div>
  <h3 className="cslab__title">
    <span className="sr-only">{teach.title[0]} {teach.title[1]}</span>
    <span aria-hidden="true">
      <span data-part><SplitWords text={teach.title[0]} kind="tilt" /></span>
      <br />
      <em data-part><SplitWords text={teach.title[1]} kind="tilt" letters /></em>
    </span>
  </h3>
  {teach.body && (
    <p className="cslab__body">
      <span className="sr-only">{teach.body}</span>
      <span data-part aria-hidden="true"><SplitWords text={teach.body} kind="rise" /></span>
    </p>
  )}
  {teach.path && (
    <div data-part className="cslab__path">
      {teach.path.map((s, i) => (
        <Fragment key={s}>
          {i > 0 && <i aria-hidden="true" data-u="pop" />}
          <span className="tm-mask"><span className="tm-u" data-u="rise">{s}</span></span>
        </Fragment>
      ))}
    </div>
  )}
</div>

{/* Slab 3: centred above the falling coin (stop raw 179) */}
<div data-slab="close" className="cslab cslab--close">
  <div data-part className="cslab__label">
    <span className="cslab__rule" data-u="line" data-dir="-1" />
    <span className="tm-mask"><span className="tm-u" data-u="rise">{close.label}</span></span>
    <span className="cslab__rule" data-u="line" />
  </div>
  <h3 className="cslab__title">
    <span className="sr-only">{close.title[0]} {close.title[1]}</span>
    <span aria-hidden="true">
      <span data-part><SplitWords text={close.title[0]} kind="tilt" /></span>{' '}
      <br className="cslab__br" />
      <em data-part><SplitWords text={close.title[1]} kind="tilt" letters /></em>
    </span>
  </h3>
</div>
```

Notes for the coder:
- The intro label now uses `.cslab__label` (Manrope small caps, gold) instead of the mono `text-xs` classes. It sits right-aligned
  because its parent is `items-end`.
- The intro `h2` loses its Tailwind font-size classes and the inline style. `.cslab__title` carries the shadow and font, and
  `--intro` carries the size.
- `.cslab__path i` keeps its CSS `rotate(45deg)`. JS overwrites it with `rotate(45deg) scale(..)`.
- Do not put `data-part` on the `h2`/`h3` themselves. The parts are the inner span and em, so that plain words and accent letters
  cascade as separate groups.
- Update the component's doc comment: "Rise-and-lift text motion (lib/text-motion.ts): units in overflow masks, transform +
  opacity only, written from the Crypto frame tick; reduced motion = still crossfade per part."

### Phase 4: docs, only after the owner approves visually (docs-writer)

In `rules.md` §4 Typography, add: "Crypto step-scroll texts: Bodoni Moda (display), motion 'Rise and lift' (docs/plans/crypto-text-motion.md)."
In §3 Copy, note the Crypto copy lives in `CRYPTO_SLAB_*` and `CRYPTO_RAIL_LINES`.

---

## 4. Verification commands

```bash
cd C:/Users/Suhas/Desktop/MOP_lux/masterogpipsology_client
corepack pnpm test                          # node --test "tests/**/*.test.mjs": all green, incl. text-motion + crypto-slabs
corepack pnpm exec tsc --noEmit             # types
corepack pnpm lint                          # no unused imports (MARQUEE_ITEMS, market('crypto') removed)
corepack pnpm build                         # next/font fetches Bodoni Moda at build; must succeed
git status --short                          # only the files listed in section 3 (+ AGENTS.md if next dev re-wrote it)
```

There is no automated browser QA; the owner checks visually.

## 5. Acceptance (owner, visual)

1. **Entering the Crypto section.**
   - The intro eyebrow rises out of its mask and the gold hairline draws outward from the text.
   - "Learn the market" rises word by word, leaning back, then settles flat.
   - "that never sleeps." follows letter by letter in gold italic.
   - The body rises word by word, then the three chips.
   - Everything is still at stop 1 (raw 1).
2. **One scroll to raw 112.** The intro stays settled at the stop.
3. **One scroll to raw 139.**
   - The intro lifts out upward as a wave and its hairline sweeps off to the right.
   - "The MOP method" enters with the same language. The diamonds pop between path items.
   - Everything is settled at 139.
4. **One scroll to raw 179.**
   - The teach block lifts out.
   - "Master of Pipsology" draws both hairlines outward, then "Crypto is chapter one." and "Forex comes next." settle above the
     coin. They never overlap the coin, on desktop or on phone portrait.
5. **Rail.** At each transition the outgoing caption's words lift out while the incoming caption's label and words rise in, in
   step with the frames. The Forex rail looks unchanged (Cormorant, no word motion).
6. **Scroll up from Forex back to raw 1.** Every motion plays exactly in reverse, at the speed of the frames.
7. **Font.** Crypto headings and rail lines use Bodoni Moda; labels and body stay Manrope. Hero, Forex, Intelligence and the rest
   of the site are unchanged.
8. **Reduced motion** (OS setting). Texts crossfade with no movement, and the rail steps discretely.
9. **Performance.** The iPhone fast scroll through Crypto shows no new jank. The DevTools Performance panel shows no Layout or
   Paint entries from the text during a glide; only Composite and style.

## 6. Out of scope

- Forex texts and the Forex rail.
- Hero and section headings outside Crypto.
- The Curriculum `MARKETS` copy.
- Slab positions and text windows, frames. (The step-scroll changes are in section 9; nothing else in the step scroll changes.)

## 7. Risks and knobs

- **Font metrics.** If titles wrap too much on a phone, tune the `.88` factor in `.cslab__title--intro` and the clamps in §3.5.
  Positions are unaffected.
- **Layer count.** About 150 units carry `will-change: transform, opacity`. Hidden slabs paint nothing, but if iOS memory warnings
  or blank tiles appear, drop `will-change` for `[data-u="rise"]` inside `.cslab__body`. Body words would then repaint their slab
  layer while moving (about 0.3 ms per tick) instead of being composited.
- **Feel.** `TM_TILT_IN_DEG` (40) sets the drama of the lean. `TM_*_OVERLAP` set how tight the wave is: higher means more units
  move at once. These constants are the only tuning surface.
- **Italic overhang or descenders clipped.** Raise the `.tm-mask` padding and the matching negative margin together. Keep
  `TM_RISE_PCT` above (line-height + bottom padding) / line-height.
- **Font swap** while the rail is on screen: `ScrollCaptions` already re-measures on `document.fonts.ready`.

## 8. Open questions for the owner

1. **Font scope.** Should Bodoni Moda (and the rise-and-lift motion) stay on the Crypto texts only, or replace Cormorant for display
   headings site-wide and on the Forex rail? Recommendation: Crypto only for now. `rules.md` locks Cormorant site-wide; extend after
   you have seen it.
2. **Copy facts.** The copy says "Live sessions" and "Two cities, one standard" (Mysore and Bengaluru). Are classes live, and run
   in both cities? Recommendation: keep both if true. Otherwise use "Guided sessions, one step at a time." and
   "Mysore · Bengaluru" / "Where we teach".

---

## 9. Step-scroll changes (coordinator addendum): ease-out into stops, fourth slab into Forex

Implement this as **Phase S**, before Phase 1 of the text work. Commit: "Step scroll: momentum ease-out into stops, hand-off
slab to Forex frame 1". All text windows in s stay valid, because s = 3 -> 4 still spans 179 -> fade end (see 9.3).

### 9.1 Findings

- **Current glide** (`components/hooks/useStepScroll.ts` `glideTo`): `L.scrollTo(Y, { duration: stepDuration(frames), easing: cruiseEase(t, rampShare(d)), lock: true, force: true })`.
  - The profile is a symmetric trapezoid: a 0.4 s smoothstep ramp in, cruise at 48 list fps, then a 0.4 s ramp out. The decel
    covers only 9.6 frames.
  - `frames = |posAt(Y) - posAt(y)|`. Within a segment, scroll is linear in frame position (`framePos` is piecewise linear), so
    the easing directly is the frame-rate curve.
  - On completion, the glide snaps to Y if layout moved. `refreshRest()` then sets `restIdx` (exact whole frame through
    `frameFor`) and `holdUntil = now + HOLD_MIN_MS` (0.45 s).
- **Stops today:** list [0, 89, 110, 142] (raw 1, 112, 139, 179). `decideStep` makes a fresh down gesture at the last stop a
  `pass`, so native scroll runs through the 100vh ForexFade. An upward flick from Forex is caught at 179 (`catch` n - 1 and
  touch momentum `touchCatch(n - 1)`).
- **Geometry.** Crypto height is (SEQ_SCROLL_VH + 100) = 450 vh, and Forex has `marginTop: -100vh`.
  - `components/fx/ForexFade.tsx` scrubs the Forex sticky from `top bottom` to `top top` of `#forex-sequence`, which is scroll
    Crypto top + 250 vh to Crypto top + 350 vh.
  - **The fade completes exactly at the Forex section top.** This is also Forex progress 0, where Forex shows list 0 (frame 1)
    at opacity 1, and where `onLeave` hides the Crypto sticky.
  - In Crypto layout terms that point is `top + height * 350/450`:
    - On desktop (L = D) it equals Crypto progress 1, list 191 (raw 240).
    - On mobile (L > D) it is (L - D) px before Crypto progress 1, so Crypto is a hair before 191 there. It is covered by then.
- **Scroll gates** (`components/providers/LenisProvider.tsx`): every gate sees every event, and any `false` consumes it. A
  future Forex controller can therefore coexist with the Crypto one (9.5).

### 9.2 Deceleration into stops: "cruise, then momentum release"

**Decision D9.** The velocity profile per glide, in list frames per second (V = `STEP_FPS` = 48, unchanged):

1. **Ease-in (unchanged in feel):** a smoothstep velocity ramp 0 -> V over `STEP_EASE_IN_S = 0.4` s. Distance V * 0.4 / 2 =
   **9.6 frames**.
2. **Cruise** at exactly V for whatever distance is left.
3. **Decel: momentum-style power release** over `STEP_DECEL_S = 1.0` s, with v(u) = V * (1 - u)^2, u = 0..1. The position is
   a cubic ease-out. Distance V * 1.0 / 3 = **16 frames**, so the last 16 frames before every stop decelerate.
   - Velocity is continuous at the hand-over (V), and it falls to exactly 0 at the stop, so the glide arrives with zero speed
     and no creep.
   - The last 0.5 s covers 2 frames and the last 0.25 s covers 0.25 frames. This is the natural "settling" of real scroll
     momentum.
   - The previous ramp-out covered 9.6 frames in 0.4 s.
4. **Short steps** (frames < 25.6 = 9.6 + 16): both phase times scale by k = frames / 25.6, the peak stays V, and there is no
   cruise. The cruise speed is never exceeded, and the decel stays about 70% of the step.
5. **Floor** `STEP_MIN_S = 0.8` (unchanged): if the total is below it, stretch every phase by m = 0.8 / total and divide the
   peak by m. This applies only to tiny partial glides after an interrupted glide or a scrollbar drag.

Why this curve and not an exponential:
- A true exponential never reaches zero and would need a cut-off, which breaks the exact whole-frame landing.
- Quint-out (pow 4) leaves about 0.3 s of visually frozen tail, which reads as lag before the hold.
- pow 2 has the momentum look with a clean zero.

New per-slab durations (list frames, desktop; mobile frame counts are the same except slab 4):

| Glide | Frames | Ease-in | Cruise | Decel | **Total** | Before |
|---|---|---|---|---|---|---|
| 1 -> 112 | 89 | 0.400 s | 1.321 s | 1.000 s | **2.721 s** | 2.254 s |
| 112 -> 139 | 21 | 0.328 s | 0 | 0.820 s | **1.148 s** | 0.838 s |
| 139 -> 179 | 32 | 0.400 s | 0.133 s | 1.000 s | **1.533 s** | 1.067 s |
| 179 -> Forex 1 (new) | 49 | 0.400 s | 0.488 s | 1.000 s | **1.888 s** | (native scroll) |

The same profile applies in both directions; upward glides also decelerate into their stop. The 0.45 s landing hold and the
exact whole-frame landing (`onComplete` snap, `restIdx`, `REST_SNAP_FRAMES`) are unchanged. Input during a glide is still
swallowed, so the time to the next accepted gesture is total + 0.45 s.

#### `lib/step-scroll.ts` changes

- Remove `STEP_RAMP_S`, `stepDuration`, `rampShare` and `cruiseEase`. Their only users are `useStepScroll.ts` and
  `tests/step-scroll.test.mjs`.
- Keep `STEP_FPS = 48` and `STEP_MIN_S = 0.8`.
- Add:

```ts
export const STEP_EASE_IN_S = 0.4;       // smoothstep velocity ramp 0 -> STEP_FPS at the start of a glide (9.6 frames)
export const STEP_DECEL_S = 1.0;         // momentum release into every stop: v = V (1 - u)^STEP_DECEL_POW (16 frames)
export const STEP_DECEL_POW = 2;

export interface GlideProfile { frames: number; v: number; tIn: number; tCruise: number; tOut: number; duration: number }

/** Velocity profile for a glide of |frames| list frames: smoothstep in, cruise at fps, power-law decel (plan 9.2). */
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

/** Position 0..1 at time t 0..1 of a glide with profile p (Lenis scrollTo easing). Exact 0 and 1 at the ends. */
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
```

The durations in the table were computed with exactly this math (scratch script, not committed).

#### `components/hooks/useStepScroll.ts` `glideTo` changes

Update the imports to match (drop `cruiseEase`, `rampShare` and `stepDuration`; add `glideProfile` and `glideEase`). Then:

```ts
const prof = glideProfile(frames, this.fps);
this.gliding = true;
this.glideDeadline = performance.now() + prof.duration * 1000 + GLIDE_WATCHDOG_MS;
L.scrollTo(Y, { duration: prof.duration, easing: (t) => glideEase(t, prof), lock: true, force: true, onComplete: /* unchanged */ });
```

### 9.3 Fourth slab: 179 -> Forex frame 1 across the fade

**Decision D10.** Add a **tail stop** at the scroll offset where ForexFade completes. It is not a Crypto frame index; it is
Forex frame 1 fully opaque. From 179, one down gesture glides there: Crypto plays 180 -> 240 underneath (49 list frames on
desktop) while Forex rises and fades in, and the glide decelerates into the clean Forex frame 1. It lands, holds 0.45 s, and:

- **A fresh down gesture at the tail stop** returns `pass` (existing `decideStep` exit rule), so normal Lenis or native
  scrolling resumes through Forex, exactly as Forex works today. This is how normal scroll resumes. Nothing in Forex changes.
- **A fresh up gesture at the tail stop** glides back to 179: Forex fades out, Crypto reverses 240 -> 179, and the motion
  decelerates into 179.
- **An upward flick from inside Forex** is caught at the tail stop (Forex frame 1). This is the existing wheel/key `catch` and
  touch `touchCatch` for stop n - 1, now n - 1 = tail. It holds there, and the next upward gesture steps to 179. Before this
  change, the catch happened at 179 after a free scroll through the fade.
- **Scrollbar drag, find-in-page or reload inside the fade:** the zone now ends at the tail stop, so the existing settle logic
  (`SETTLE_IDLE_MS` and the first-layout snap) glides or jumps to 179 or to Forex frame 1, whichever is nearest. No more
  half-faded rest states.

Pure helper in `lib/step-scroll.ts`:

```ts
/**
 * Scroll offset where ForexFade completes = the Forex section top (Forex marginTop -overlap vh; Crypto height (seq + 100) vh).
 * Desktop (L = D) this equals Crypto progress 1; on mobile it is (L - D) px earlier. Forex shows list 0 at opacity 1 here.
 */
export function handoffEndY(top: number, height: number, seqScrollVh: number, overlapVh: number): number {
  const total = seqScrollVh + 100;
  return total > 0 ? top + (height * (total - overlapVh)) / total : top;
}
```

Controller changes in `components/hooks/useStepScroll.ts`:

1. `StepScrollOptions` gets a new optional field:
   ```ts
   /** Extra last stop at a scroll offset (not a frame): Crypto = ForexFade end, Forex frame 1 opaque. Frame there is not snapped. */
   tail?: (l: Readonly<SequenceLayout>) => number;
   ```
   Store it as `private readonly tail?: ...` in the constructor.
2. `onLayout`. Build the frame stops as today, then append the tail. Clamp it to the sequence end and keep it strictly
   ascending:
   ```ts
   const base = this.stops.map((i) => stopScrollY(i, this.total, this.knotIdx, this.knotP, l.top, range));
   if (this.tail && base.length > 0) {
     const t = Math.min(l.top + range, this.tail(l));
     if (t > base[base.length - 1] + STOP_TOL_PX) base.push(t);
   }
   this.ys = base;
   ```
3. `refreshRest`: `this.restIdx = k >= 0 && k < this.stops.length ? this.stops[k] : -1;`. At the tail there is no frame snap;
   the Crypto sticky is hidden by ForexFade `onLeave` there.
4. `coord`. When the tail exists, s runs 4 -> 5 over one viewport after it. Nothing reads s > 4: slab windows end by 3.28 and
   `railU` clamps at `S_MAX = 4`.
   ```ts
   const end = this.layout.top + (this.layout.height - this.layout.viewportH);
   const exit = this.ys.length > this.stops.length ? this.layout.viewportH : end - this.ys[n - 1];
   ```
5. Nothing else changes. `decideStep`, `catchTo`, `touchCatch(n - 1)`, `inZone` and settle are all written against
   `ys.length` and `ys[n - 1]`, so they pick the tail up automatically. Grep `useStepScroll.ts` for `this.stops[` after the
   edit; `refreshRest` must be the only indexed use.

`components/sections/CryptoMarketScroll.tsx`:

```ts
import { CRYPTO_STOPS_RAW, knotProgress, framePos, stopListIndex, handoffEndY } from '@/lib/step-scroll';
const CRYPTO_STEP: StepScrollOptions = {
  stops: CRYPTO_STOP_INDICES, total: TOTAL_FRAMES, knotP: CRYPTO_KNOT_P,
  tail: (l) => handoffEndY(l.top, l.height, SEQ_SCROLL_VH, FOREX_OVERLAP_VH), // slab 4: 179 -> Forex frame 1 (fade complete)
};
```

`CRYPTO_KNOT_IDX`, `CRYPTO_KNOT_P`, `framePos` and `PINNED` are unchanged; 191 is already pinned. ForexFade and
`ForexMarketScroll` are untouched.

**Stop coordinate.** s = 3 at 179 and s = 4 at the tail stop. This is the same span as the old "3..4 = hand-off fade" (identical
on desktop, and (L - D) px shorter on mobile). So `CRYPTO_SLAB_WINDOWS`, `CRYPTO_RAIL_*`, `S_MAX` and every text window keep
their meaning. Update only comments: in `lib/crypto-slabs.ts`, "3..4 the hand-off fade into Forex" becomes "3..4 slab 4: the
hand-off glide 179 -> Forex frame 1".

### 9.4 Texts during slab 4 (decision D11)

- **Slab 3 text** ("Master of Pipsology / Crypto is chapter one. Forex comes next.") **exits during slab 4**, keeping the out
  window s 3.0 -> 3.28. With the new ease that is roughly the first 0.5 s of the 1.89 s glide: the words lift out as Forex
  starts to rise, before Forex passes about 25% opacity.
  - It must not stay: the Forex sticky fades in above the Crypto layer, so lingering text would dissolve muddily under it.
  - The line itself announces the move ("Forex comes next."), so lifting it away as Forex arrives is the payoff.
- **Caption rail.** The closing caption ("Mysore · Bengaluru / Two cities, one standard") holds at s = 3 ± 0.1. It lifts out
  over s 3.1 -> 3.4 (`CRYPTO_RAIL_TO_S`, unchanged), which is about the first 0.6 s of the glide, word by word upward, with the
  rail track lifting `FLOW_LIFT_PX` as today. It is fully gone before the landing.
- **At the tail stop the screen is clean Forex frame 1** with no Crypto texts. The Forex rail starts at Forex progress 0.01, so
  it appears on the first native scroll after landing. No overlap between the two rails.
- **Reverse:** everything plays backwards. The rail caption drops back in, then the slab 3 text settles above the coin by s = 3.

### 9.5 Forex without stops (now) and with stops (later)

- **Now:** Forex has no controller. After the tail landing, a fresh down gesture passes and Forex scrolls natively exactly as
  today. An upward flick from Forex catches at the tail stop.
- **Later, when the owner picks Forex stops:** Forex stop 0 will be Forex list 0 at Forex progress 0, which is the same scroll
  offset as Crypto's tail stop. With the gate rule (every gate sees every event; any false consumes), the two controllers hand
  over without code changes:
  - Down at that point: Crypto passes (exit at its last stop) and Forex glides (its stop 0 -> 1).
  - Up at that point: Forex passes (exit at its stop 0) and Crypto glides (tail -> 179).

  Two follow-ups for that plan:
  1. Disable Crypto's catch-from-below once Forex has stops, because Forex catches its own. Add an option `catchBelow?: false`
     then. It is not needed now.
  2. Share one landing hold, so a single gesture cannot be judged by both controllers in the same 0.45 s.

### 9.6 Phase S tests (`tests/step-scroll.test.mjs`)

Replace the `stepDuration` and `cruiseEase` tests and imports (`STEP_RAMP_S`, `stepDuration`, `cruiseEase`) with these cases.
Import `glideProfile`, `glideEase`, `handoffEndY`, `STEP_EASE_IN_S`, `STEP_DECEL_S` and `STEP_DECEL_POW`.

1. **glideProfile durations.**
   - 89 -> 2.7208333 (1e-6)
   - 21 -> 1.1484375
   - 32 -> 1.5333333
   - 49 -> 1.8875
   - 5 -> 0.8
   - 0 -> 0.8
   - For 89, 32 and 49: `v === STEP_FPS`, `tIn === STEP_EASE_IN_S`, `tOut === STEP_DECEL_S`. For 21: `v === STEP_FPS`,
     `tCruise === 0`.
2. **glideEase ends and shape.** For every frames in {0.5, 5, 21, 32, 49, 89}:
   - `glideEase(0) === 0` and `glideEase(1) === 1`; NaN gives 0, -1 gives 0, 2 gives 1.
   - Monotone non-decreasing over t in 1e-4 steps.
   - Velocity, (delta e * frames) / (delta t * duration), is <= fps + 1e-6 everywhere.
   - Velocity is continuous: adjacent finite differences differ by < 0.5 fps at 1e-4 steps, including across the tIn and
     tIn + tCruise boundaries.
   - The final velocity is below 0.01 fps.
3. **Decel length.** For frames >= 25.6, the frames covered in the last `STEP_DECEL_S` equal STEP_FPS * STEP_DECEL_S /
   (STEP_DECEL_POW + 1) = 16 (1e-9), and the frames covered in the last 0.5 s equal 2 (1e-9).
4. **Asymmetry is deliberate.** For 89: the first 16 frames take less time than the last 16 frames.
5. **handoffEndY.**
   - `handoffEndY(1000, 4500, 350, 100) === 4500` (= top + range on desktop with L = D = 1000).
   - Mobile: for L = 1000 and D in {1000, 950, 900, 800}, with top = 0 and height = 4.5 L, `handoffEndY` = 3500 <= 4.5 L - D.
     It is also > `stopScrollY(142, 192, 142, KP, 0, 4.5 * L - D) + STOP_TOL_PX`, so the tail stop is strictly after 179.
6. **stopCoord with five stops.** ys = desktop stops + 4500 and exit = 1000. Check:
   - `stopCoord(3500) === 3`
   - `stopCoord(4000) === 3.5`
   - `stopCoord(4500) === 4`
   - `stopCoord(5000) === 4.5`
   - `stopCoord(9000) === 5`
7. **decideStep with the tail.** With the five-stop ys:
   - At 4500, fresh dir +1: `pass`.
   - At 4500, fresh dir -1: glide to stop 3.
   - At 6000, dir -1 with target 4400: catch stop 4.
   - At 3500, fresh dir +1: glide to stop 4.

Existing tests to keep: `desktop stop offsets` and `mobile: the hand-off stop is never inside the fade` (179 is still before or
at the fade start).

### 9.7 Acceptance additions (owner, visual)

1. Every step cruises at the familiar speed, then visibly brakes over the last stretch and settles softly onto the stop frame,
   like a flick running out of momentum. There is no abrupt stop and no crawl. Upward steps do the same.
2. At 179, one scroll plays the coin on (180 -> 240) while Forex rises and fades in. The closing line and the closing caption
   lift away early. The motion brakes and lands on Forex frame 1, fully opaque, and holds.
3. Another down scroll continues through Forex normally. An up scroll from Forex frame 1 plays back to 179 in one gesture.
4. A hard upward flick from deep in Forex stops on Forex frame 1, and the next gesture goes to 179.
5. On phone portrait, the same as 2-4 by swipe. A swipe at Forex frame 1 continues natively into Forex.

### 9.8 Risks and knobs

- **`STEP_DECEL_S` (1.0) and `STEP_DECEL_POW` (2)** are the feel of the brake.
  - Longer or higher values give a longer, softer settle. 0.8 / 2 is snappier; 1.2 / 2.5 is more cinematic.
  - Each 0.1 s of `STEP_DECEL_S` adds 1.6 frames of decel and about 0.067 s per long step. Short steps scale automatically.
- **Waiting time.** The longest step (1 -> 112) goes from 2.25 s to 2.72 s, plus the 0.45 s hold. If the owner finds it slow,
  lower `STEP_DECEL_S`; do not raise `STEP_FPS`, which the owner approved.
- **Mobile tail.** On mobile, Crypto at the tail stop is about (L - D) / (4.5 L - D) of progress short of 240. It is invisible,
  because Forex is opaque and the Crypto sticky is hidden.
