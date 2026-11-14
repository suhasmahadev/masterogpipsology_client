# Section headlines: luxury fonts + letter-by-letter motion

Owner request (verbatim):

> "use some luxury fonts and letter to letter animation ,like how the first hero page has the typing thing ,use some diffrent animations to diffrent"

Scope: the six display headlines in the dark sections below the scroll sequences. Each one gets its own luxury face and its own
per-letter entrance, played once when it scrolls into view. Out of scope: Hero, Crypto/Forex/Opportunity frame sequences and slabs,
HallmarkDial, MomentsReel (it only has a label-caps eyebrow, no headline), card/footer h3s, BurjKhalifaReveal/ArchitecturalScene (not mounted).

Rules that apply (rules.md): animate transform/opacity only (no animated filter or blur, no text mutation per frame), no extra rAF loops,
respect `prefers-reduced-motion` (device tier `static` == reduced motion, see `lib/device-tier-core.ts`), copy unchanged, never delete files.
Commit before the change. No new tests (owner tests visually). `hx` is not installed in this repo; decisions are recorded at the bottom of this file.

Note: rules.md section 4 locks "Display: Cormorant Garamond". This is an explicit owner request for new faces on these headlines only;
afterwards ask docs-writer to add a line under Typography (see "After merge").

---

## 1. Headline map

| # | File:line (today) | Text (unchanged) | Font | Variant | Motion |
|---|---|---|---|---|---|
| 1 | `components/sections/Markets.tsx:46` (FillStatement) | Three markets. / One framework. | Cinzel 500 (`--font-mkt-display`, already loaded) | `roll` | Ticker-tape slot roll: each letter is a tape of 3 decoy glyphs + the real one, clipped in its own mask; tape rolls down to the real letter, left to right. |
| 2 | `components/sections/LuxuryTeamGallery.tsx:81` (RevealText) | Architects of the framework. / *Mentors in live execution.* (gold gradient italic) | Bodoni Moda 500 (`--font-lux-display`, already loaded) | `flip` | 3D flip: letters swing up from lying flat (rotateX -95deg -> 0, origin bottom, perspective 700) with a slight back-overshoot. Gradient kept per letter. |
| 3 | `components/sections/Curriculum.tsx:67` (FillStatement) | Six modules. / One system. | Playfair Display 500 (NEW `--font-playfair`) | `shimmer` | Gold wave: letters rise from dim (opacity .16) to full; a gold copy of each letter flashes on then fades, so a gold light travels letter by letter and leaves cream text. |
| 4 | `components/sections/Gallery.tsx:36` (RevealText) | Real results from / real traders. | Italiana 400 (NEW `--font-italiana`) | `track` | Tracking converge: per line, letters start spread outward from the line centre (x = 0.6 x distance to centre) at opacity 0 and close in, staggered from the centre. |
| 5 | `components/sections/Testimonial.tsx:45` (RevealText) | "I had three losing months ..." (TESTIMONIAL.quote) | Cormorant Garamond italic (unchanged) | `bloom` | Soft bloom: each letter fades in from scale 1.45 / yPercent -14 to rest, very fast ripple (whole ~260-char quote spread over 2.2 s). Reads as ink settling; no blur filter. |
| 6 | `components/sections/FinalCta.tsx:37` (RevealText + GoldShimmer) | Education before *execution.* | Cormorant Garamond 500 (`display`, same as hero) | typewriter | Hero bookend: reuse `TypingHeading` (gold caret, gold "execution." with the light flare on its first "e") but started by scroll, not the intro. |

All triggers: ScrollTrigger, play once on enter (`start: 'top 82%'`, TypingHeading `'top 80%'`). If the page loads already scrolled past,
ScrollTrigger plays it on refresh; TypingHeading also checks its rect once (below).

---

## 2. Files

| File | Change |
|---|---|
| `components/motion/LetterReveal.tsx` | NEW shared component (variants roll / flip / shimmer / track / bloom). |
| `components/ui/TypingHeading.tsx` | Add `trigger` + `scrollStart` props (scroll start mode). Hero call unchanged. |
| `app/layout.tsx` | Add Playfair Display + Italiana via `next/font/google` (preload: false). |
| `app/globals.css` | Append LetterReveal + font-face utility classes; one TypingHeading rule. |
| `components/sections/Markets.tsx` | FillStatement -> LetterReveal `roll`, Cinzel. |
| `components/sections/LuxuryTeamGallery.tsx` | RevealText -> LetterReveal `flip`, Bodoni; gradient span class swap. |
| `components/sections/Curriculum.tsx` | FillStatement -> LetterReveal `shimmer`, Playfair. |
| `components/sections/Gallery.tsx` | RevealText -> LetterReveal `track`, Italiana. |
| `components/sections/Testimonial.tsx` | RevealText -> LetterReveal `bloom`. |
| `components/sections/FinalCta.tsx` | RevealText + GoldShimmer -> TypingHeading `trigger="scroll"`. |

Do NOT delete `FillStatement.tsx`, `RevealText.tsx`, `GoldShimmer.tsx` (RevealText/GoldShimmer may still be used later; rule: never delete).
No test references these files (checked `tests/`).

---

## 3. Fonts: `app/layout.tsx`

Next 16.3.5. Non-variable fonts need `weight` (node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md:177). Font data checked:
Italiana = weight 400 only, normal only; Playfair Display = variable wght, normal + italic.

```ts
import { Bodoni_Moda, Cinzel, Cormorant_Garamond, Italiana, Manrope, Playfair_Display } from 'next/font/google';

// Curriculum headline face. Below the fold: no preload.
const playfair = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
  preload: false,
});

// Results headline face (thin Didone). Below the fold: no preload.
const italiana = Italiana({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-italiana',
  display: 'swap',
  preload: false,
});
```
Place them next to `mkt`, and add `playfair.variable, italiana.variable` to the `cn(...)` on `<html>`.

---

## 4. CSS: append to the END of `app/globals.css`

Must come after `.display` (line ~315) so the `ff-*` classes win (same specificity, later rule).

```css
/* ─── Section letter reveals (components/motion/LetterReveal.tsx) ─── */
.ff-cinzel   { font-family: var(--font-mkt-display), 'Cinzel', Georgia, serif; font-weight: 500; letter-spacing: .04em; line-height: 1.08; }
.ff-bodoni   { font-family: var(--font-lux-display), 'Bodoni Moda', Georgia, serif; font-weight: 500; letter-spacing: -.01em; line-height: 1.06; }
.ff-playfair { font-family: var(--font-playfair), 'Playfair Display', Georgia, serif; font-weight: 500; letter-spacing: -.01em; line-height: 1.06; }
.ff-italiana { font-family: var(--font-italiana), 'Italiana', Georgia, serif; font-weight: 400; letter-spacing: .01em; line-height: 1.08; }

@keyframes lr-failsafe { to { opacity: 1; } }
html.js .lr-pending { opacity: 0; animation: lr-failsafe 0s 5.5s forwards; }
@media (prefers-reduced-motion: reduce) { html.js .lr-pending { opacity: 1; animation: none; } }

.lr .lr-w { white-space: nowrap; }
.lr .lr-c { position: relative; }
/* roll: SplitText wraps each char in .lr-c-mask with inline overflow:clip; clip vertically only (decoys/italics may be wider) */
.lr--roll .lr-c-mask { overflow: visible clip !important; vertical-align: top; }
.lr-roll-d { position: absolute; left: 50%; transform: translateX(-50%); pointer-events: none; user-select: none; -webkit-user-select: none; }
/* shimmer: gold copy of each letter (opacity only) */
.lr-gold { position: absolute; left: 0; top: 0; color: #E8CA65; text-shadow: 0 0 16px rgba(212, 175, 55, .55);
  opacity: 0; pointer-events: none; user-select: none; -webkit-user-select: none; white-space: nowrap; }
/* gradient text that survives per-letter transforms (Faculty line 2) */
.lr-grad { background-image: linear-gradient(90deg, #F5E5C9 0%, #E2BE68 50%, #FAF1DE 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
.lr.is-split .lr-grad { background-image: none; }
.lr-grad-c { -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }

/* TypingHeading trigger="scroll": keep letters hidden until typed even if the 9 s CSS failsafe already fired */
html.js .th--armed .th-c:not(.is-on) { opacity: 0; animation: none; }
```

No `will-change` on chars (up to ~260 layers on the quote); GSAP uses translate3d only while tweening.

---

## 5. NEW `components/motion/LetterReveal.tsx`

Pattern copied from `RevealText.tsx` (SplitText + fonts.ready + contextSafe + pending class). Full shape:

```tsx
'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';
import { rollDecoys } from '@/lib/text-motion';

export type LetterVariant = 'roll' | 'flip' | 'shimmer' | 'track' | 'bloom';

interface LetterRevealProps {
  as?: 'h2' | 'h3' | 'p';
  variant: LetterVariant;
  /** Text, <br />, and inline spans (e.g. <span className="italic lr-grad">). */
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  /** ScrollTrigger start. */
  start?: string;
}

const GRAD = 'linear-gradient(90deg, #F5E5C9 0%, #E2BE68 50%, #FAF1DE 100%)'; // keep in sync with .lr-grad

/** Per-letter gradient for chars inside .lr-grad (parent background-clip:text does not follow transformed children). Reads all rects first, then writes. */
function paintGradient(root: HTMLElement, chars: HTMLElement[]): void { ... }

export function LetterReveal({ as = 'h2', variant, children, className, style, id, start = 'top 82%' }: LetterRevealProps): React.ReactElement
```

`paintGradient` body:
```ts
root.querySelectorAll<HTMLElement>('.lr-grad').forEach((g) => {
  const gr = g.getBoundingClientRect();
  const inside = chars.filter((c) => g.contains(c));
  const rs = inside.map((c) => c.getBoundingClientRect());          // reads
  inside.forEach((c, i) => {                                         // writes
    c.classList.add('lr-grad-c');
    c.style.backgroundImage = GRAD;
    c.style.backgroundSize = `${gr.width}px 100%`;
    c.style.backgroundPosition = `${gr.left - rs[i].left}px 0`;
  });
});
```

useGSAP body (deps `[variant, start]`, `scope: ref`):
```ts
(_ctx, contextSafe) => {
  const el = ref.current;
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.remove('lr-pending'); return; } // static tier: final state
  let cancelled = false;
  let played = false;               // after first play, re-splits (autoSplit on resize/font swap) show the final state, never replay
  let split: SplitText | null = null;

  const onSplit = (self: SplitText): gsap.core.Timeline | undefined => {
    const chars = self.chars as HTMLElement[];
    el.classList.add('is-split');
    paintGradient(el, chars);       // before any transform is set (measures untransformed rects)
    if (played) { el.classList.remove('lr-pending'); return undefined; }
    const tl = gsap.timeline({
      onStart: () => { played = true; },
      scrollTrigger: { trigger: el, start, once: true },
    });
    buildVariant(variant, self, chars, tl, el);   // sets initial states + adds tweens (section 6)
    el.classList.remove('lr-pending');            // only after initial states are set: no flash
    return tl;                                    // SplitText kills it on re-split/revert
  };

  const run = (): void => {
    if (cancelled) return;
    split = SplitText.create(el, {
      type: variant === 'track' ? 'lines,words,chars' : 'words,chars',
      linesClass: 'lr-l',
      wordsClass: 'lr-w',
      charsClass: 'lr-c',
      ...(variant === 'roll' ? { mask: 'chars' } : {}),   // mask class becomes .lr-c-mask
      aria: 'auto',                                      // h2 gets aria-label = full text, pieces aria-hidden
      autoSplit: true,
      onSplit,
    } as SplitText.Vars);
  };
  const begin = contextSafe ? contextSafe(run) : run;
  document.fonts.ready.then(begin, begin);

  return () => {
    cancelled = true;
    split?.revert();
    el.classList.remove('is-split');
  };
}
```

Render:
```tsx
const Tag = as as unknown as React.ComponentType<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;
return <Tag ref={ref} id={id} className={cn('lr', `lr--${variant}`, 'lr-pending', className)} style={style}>{children}</Tag>;
```

## 6. Variant builders (inside LetterReveal.tsx, `function buildVariant(v, self, chars, tl, el): void`)

Only transform (x, yPercent, rotationX, scale) and opacity. DOM additions (decoys, gold copies) are created once in onSplit, aria-hidden by
inheritance (SplitText marks chars aria-hidden).

`roll` (Markets):
```ts
const decoys: HTMLElement[] = [];
chars.forEach((c) => {
  rollDecoys(c.textContent ?? '').forEach((d, i) => {
    const s = document.createElement('span');
    s.className = 'lr-roll-d'; s.textContent = d; s.style.top = `${(i + 1) * 100}%`;
    c.appendChild(s); decoys.push(s);
  });
});
gsap.set(chars, { yPercent: -300 });
tl.to(chars, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.035 })
  .set(decoys, { autoAlpha: 0 });   // hide the tape after it lands (no decoy slivers under the line)
```
(rollDecoys default n = 3, deterministic; from lib/text-motion.ts. Same tape idea as SplitWords 'roll'.)

`flip` (Faculty):
```ts
gsap.set(chars, { rotationX: -95, opacity: 0, transformOrigin: '50% 100%', transformPerspective: 700 });
tl.to(chars, { rotationX: 0, opacity: 1, duration: 1.1, ease: 'back.out(1.4)', stagger: 0.03 });
```

`shimmer` (Curriculum):
```ts
const golds = chars.map((c) => {
  const g = document.createElement('span');
  g.className = 'lr-gold'; g.textContent = c.textContent; c.appendChild(g); return g;
});
gsap.set(chars, { opacity: 0.16, yPercent: 18 });
tl.to(chars, { opacity: 1, yPercent: 0, duration: 0.6, ease: 'sine.out', stagger: 0.045 }, 0)
  .to(golds, { opacity: 1, duration: 0.2, ease: 'sine.out', stagger: 0.045 }, 0)
  .to(golds, { opacity: 0, duration: 0.8, ease: 'sine.in', stagger: 0.045 }, 0.25);
```

`track` (Gallery), uses `self.lines`:
```ts
const xs = new Map<HTMLElement, number>();
(self.lines as HTMLElement[]).forEach((line) => {
  const cs = Array.from(line.querySelectorAll<HTMLElement>('.lr-c'));
  if (!cs.length) return;
  const rs = cs.map((c) => c.getBoundingClientRect());                     // reads only
  const mid = (rs[0].left + rs[rs.length - 1].right) / 2;                  // centre of the TEXT, not the block line box
  cs.forEach((c, i) => xs.set(c, (rs[i].left + rs[i].width / 2 - mid) * 0.6));
});
gsap.set(chars, { x: (i: number) => xs.get(chars[i]) ?? 0, opacity: 0 });
tl.to(chars, { x: 0, opacity: 1, duration: 1.5, ease: 'expo.out', stagger: { each: 0.025, from: 'center' } });
```

`bloom` (Testimonial):
```ts
gsap.set(chars, { opacity: 0, scale: 1.45, yPercent: -14, transformOrigin: '50% 70%' });
tl.to(chars, { opacity: 1, scale: 1, yPercent: 0, duration: 1.1, ease: 'power3.out', stagger: { amount: 2.2 } });
```

---

## 7. `components/ui/TypingHeading.tsx`: scroll trigger mode

- Import `ScrollTrigger` too: `import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';`
- New props: `trigger?: 'intro' | 'scroll'` (default `'intro'`), `scrollStart?: string` (default `'top 80%'`). (Not `start`: the effect already has a local `start` function.)
- Replace
  ```ts
  const offIntro = onIntroDone(start);
  const failsafe = window.setTimeout(start, 6000);
  ```
  with
  ```ts
  let offIntro = (): void => {};
  let failsafe = 0;
  let st: ScrollTrigger | null = null;
  if (trigger === 'scroll') {
    root.classList.add('th--armed');
    st = ScrollTrigger.create({ trigger: root, start: scrollStart, once: true, onEnter: () => start() });
    if (root.getBoundingClientRect().top < window.innerHeight * 0.8) start(); // loaded already past it
  } else {
    offIntro = onIntroDone(start);
    failsafe = window.setTimeout(start, 6000);
  }
  ```
  and in the cleanup add `st?.kill(); root.classList.remove('th--armed');` (keep `offIntro(); clearTimeout(failsafe);`).
- Add `trigger, scrollStart` to `dependencies`.
- The reduced-motion branch returns before this, so static tier never arms (text shown, caret parked at the end).
- Hero call (`Hero.tsx:136`) passes nothing new: behaviour unchanged.

---

## 8. Section edits (exact)

Markets.tsx: remove `FillStatement` import, add `import { LetterReveal } from '@/components/motion/LetterReveal';`
```tsx
<LetterReveal
  as="h2"
  variant="roll"
  id="markets-heading"
  className="display ff-cinzel mb-12 md:mb-16"
  style={{ fontSize: 'calc(var(--fs-h2) * .82)', color: 'var(--text)' }}
>
  Three markets.<br />One framework.
</LetterReveal>
```

LuxuryTeamGallery.tsx: swap `RevealText` import for LetterReveal (check RevealText is not used elsewhere in the file; grep first).
```tsx
<LetterReveal
  as="h2"
  variant="flip"
  className="display ff-bodoni max-w-3xl mb-4"
  style={{ fontSize: 'var(--fs-h2)', color: '#FAF6F0' }}
>
  Architects of the framework.<br />
  <span className="italic lr-grad">Mentors in live execution.</span>
</LetterReveal>
```
(The tailwind `bg-gradient-to-r from-[#F5E5C9] via-[#E2BE68] to-[#FAF1DE] bg-clip-text text-transparent` is replaced by `.lr-grad`, same colours.)

Curriculum.tsx: remove FillStatement import, add LetterReveal.
```tsx
<LetterReveal
  as="h2"
  variant="shimmer"
  id="curriculum-heading"
  className="display ff-playfair md:w-1/2"
  style={{ fontSize: 'var(--fs-h2)', color: 'var(--text)' }}
>
  Six modules.<br />One system.
</LetterReveal>
```

Gallery.tsx: RevealText -> LetterReveal.
```tsx
<LetterReveal
  as="h2"
  variant="track"
  id="gallery-heading"
  className="display ff-italiana mb-12 md:mb-16"
  style={{ fontSize: 'calc(var(--fs-h2) * 1.06)', color: 'var(--text)' }}
>
  Real results from<br />real traders.
</LetterReveal>
```

Testimonial.tsx (server component, fine to import a client component): RevealText -> LetterReveal, keep every class and style as today:
```tsx
<LetterReveal as="h2" variant="bloom" id="testimonial-heading" className="display italic mb-8" style={{ /* unchanged object */ }}>
  &ldquo;{TESTIMONIAL.quote}&rdquo;
</LetterReveal>
```

FinalCta.tsx: remove `RevealText` and `GoldShimmer` imports; add
`import { TypingHeading } from '@/components/ui/TypingHeading';` and `import type { TypingSegment } from '@/lib/typing';`
```tsx
const CTA_HEADLINE: TypingSegment[] = [
  { text: 'Education before ' },
  { text: 'execution.', gold: true, flare: true },
];
...
<TypingHeading
  as="h2"
  id="cta-heading"
  trigger="scroll"
  segments={CTA_HEADLINE}
  className="display font-medium"
  style={{ fontSize: 'var(--fs-h2)', color: 'var(--text)' }}
/>
```
(Module-level const keeps the `layout` useMemo stable. Text identical to today: lowercase "execution." with full stop.)

---

## 9. Acceptance checks

1. Each of the six headlines animates letter by letter once, on first scroll into view, and each looks different (roll / flip / gold wave / converge / bloom / typewriter). Scrolling back up and down does not replay.
2. Fonts: Markets = Cinzel, Faculty = Bodoni Moda (line 2 gold gradient italic, gradient continuous across the line), Curriculum = Playfair Display, Results = Italiana, Testimonial = Cormorant italic, CTA = Cormorant with gold "execution." + flare.
3. No flash of full text before the animation; no clipped letters at rest (Cinzel roll masks, Bodoni italic); no decoy glyph slivers under Markets after it lands.
4. Reduced motion (DevTools > Rendering > emulate prefers-reduced-motion): every headline is shown final, no split, no caret blink; CTA typed text static.
5. Resize the window after the animations played: lines re-wrap, text stays visible, no replay; Faculty gradient still continuous.
6. Reload while scrolled to the footer: CTA and Testimonial end in the final state (played or typed), never stuck invisible.
7. Screen reader: each h2 announces its full sentence once (aria-label from SplitText; TypingHeading sr-only span). `aria-labelledby` ids still resolve.
8. Hero typing unchanged. Crypto/Forex sequences untouched (`git diff --stat` shows only the files in section 2).
9. Performance tab while scrolling into the Testimonial: no long tasks > 50 ms from the split; only transform/opacity in the animation.

## 10. Verify commands (repo root)

```
corepack pnpm exec tsc --noEmit
corepack pnpm lint
corepack pnpm test
corepack pnpm build
git diff --stat
```
Then the owner checks visually (`corepack pnpm dev`). No automated browser QA.

---

## Decisions (hx not available; recorded here)

- D1 Shared `LetterReveal` with a `variant` prop on GSAP SplitText (aria:'auto', autoSplit) instead of per-section components or React-rendered spans: one code path, built-in a11y, re-wraps on resize, no React re-renders.
- D2 FinalCta reuses `TypingHeading` (new `trigger="scroll"`) as a bookend to the hero instead of a sixth LetterReveal variant; this drops the looping GoldShimmer on that word in favour of the hero's gold + flare. GoldShimmer.tsx stays in the repo.
- D3 No scramble/decode (ScrambleTextPlugin mutates text every frame -> layout per frame) and no blur-in (animated filter is banned). Replaced by `roll` (transform-only decoy tape, reusing `rollDecoys`) and `bloom` (scale + opacity).
- D4 Gradient text under per-letter transforms: per-char background positioned to the parent span width, parent background removed while split (`.lr.is-split .lr-grad`).
- D5 Static tier == prefers-reduced-motion (`computeTier`), so the component checks `matchMedia` directly instead of `useDeviceTier()` (whose server snapshot is 'static' and would cause a show-then-hide flash on hydration).
- D6 New fonts limited to two (Playfair Display, Italiana), `preload: false` so they never compete with the hero LCP.
- D7 Play once (`once: true` + `played` flag across autoSplit re-splits); no reverse/scrub, to keep it calm and cheap.

## After merge

docs-writer: rules.md section 4 Typography, add "Section headlines (below the sequences): per-section faces and letter motion, see docs/plans/section-letter-motion.md".
