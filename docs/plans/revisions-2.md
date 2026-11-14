# Revisions 2: hero revert + zoom, typing headline with flare, gold nav chips, "Join the team" capsules, gilded section seams

Branch `luxury-upgrade` (base fa5581b). Original site = `74ebc1e`. No browser runs by the coder; the user tests manually.
`hx` is not installed on this machine, so the design decisions are recorded in section 9 of this file instead of `hx decision add`.

## 0. User feedback and what it means

> "this looks so odd, the change in hero section is revert the change, let that static image be there, and if you can the image zoom do it. Other than that the visibility of the nav bar elements: let there be gold-bordered transparent boxes around the nav bar words, and when the cursor moves in, they should fill metallically. Change 'join cohort' to 'join the team' and let that be two options, 'join telegram group' and 'join whatsapp group'. Let those capsules be filled, and on cursor move let the colour go down. Bring the letter-by-letter typing animation back. Let 'Execution' be gold, with a light flare on the border of the E when 'execution' comes. The section change is plain, think of something creative."

| # | Requirement | Section |
|---|---|---|
| R1 | Hero back to the 74ebc1e look (photo, scrim, warm light orbs, bottom fade, cream text, filled/outline CTAs). Remove the R3F stage, glass pane, live chip and gold dust. Add only a scroll-scrubbed photo zoom. | 2 |
| R2 | Letter-by-letter typing headline. "execution" is gold. A one-shot light flare runs along the edge of its first "e". | 3 |
| R3 | Each nav link sits in a transparent pill with a thin gold border. On hover/focus it fills with metallic gold from the cursor entry point. Fix the invisible CTA. | 4 |
| R4 | "Join the next cohort" becomes "Join the team", shown as two filled capsules, "Join Telegram group" and "Join WhatsApp group". On hover the fill drains downward. Applies to the nav (as a dropdown), hero, FinalCta and mobile menu. | 5 |
| R5 | One creative, perf-safe section transition between the major sections. | 6 |

### 0.1 Why the hero looks like "plain beige with no photo"
- The photo is still in the DOM and still loads. I checked this on the user's running dev server (localhost:3000):
  - The SSR HTML has `<img ... srcSet="/_next/image?url=%2Fhero%2Fhero-3200.jpg...">` inside `#hero`.
  - `/_next/image?url=%2Fhero%2Fhero-3200.jpg&w=1920&q=90` returns `200 image/jpeg`, 138 KB.
  - `public/hero/hero-3200.jpg` has the same per-channel mean, min and max as `public/background_image.png` (227/209/190). It is a faithful downscale.
- The cause is the revisions-1 hero rewrite (commit 530986d), `components/sections/Hero.tsx:77-97`:
  - It deleted every original light layer from `74ebc1e:components/sections/Hero.tsx:91-234`: the warm orbs, the light shaft, the left dark scrim `linear-gradient(108deg, rgba(14,14,18,.68) ...)` and the bottom fade.
  - It switched the text to dark ink (`Hero.tsx:140, 164`).
- About 55% of the photo (the whole left side, behind the text) is a flat, pale beige wall; I confirmed this from a downscaled preview. Without the scrim and orbs it is the same colour as the page (`#EFE7DC`), so the hero reads as an empty beige page.
- On high-tier devices, `Hero.tsx:97` also mounts `HeroStage` at `components/three/hero/HeroStage.tsx:65-71`. That is a full-bleed WebGL canvas at `z-[1]` directly over the photo, faded to opacity 1 at `:60`. It is transparent by design, and it is the only element that can sit between the photo and the viewer. This revision removes it, so it can no longer be a factor.
- The fix: restore the original layers (R1), remove the R3F stage, and keep the 3200 px derivative.
- Verification for the user, if the photo still seems missing after this revision: in DevTools, `document.querySelector('#hero img').currentSrc` should be a `/_next/image?url=%2Fhero%2Fhero-3200.jpg...` URL, and `.naturalWidth` should be greater than 0.

### 0.2 Why the nav CTA is invisible
- `app/globals.css:593-600`: `.btn-liquid` has `color:#e8c766` on `background: rgba(212,175,55,.1)`, on a pale glass pill over a beige page. That is gold on gold.
- Section 5 replaces it with a filled metallic capsule with dark ink text, which is readable on both nav tones.

## 1. Files

| Action | File |
|---|---|
| rewrite | `components/sections/Hero.tsx` |
| rewrite | `components/ui/TypingHeading.tsx` |
| new | `lib/typing.ts` (pure, no imports) |
| new | `tests/typing.test.mjs` |
| new | `components/ui/JoinCapsules.tsx` (no `'use client'`, no hooks; usable from server and client components) |
| new | `components/nav/JoinMenu.tsx` (`'use client'`) |
| new | `components/fx/SectionSeam.tsx` (`'use client'`) |
| edit | `components/nav/GlassHeader.tsx` |
| edit | `components/nav/MobileMenuSheet.tsx` |
| edit | `components/sections/FinalCta.tsx` |
| edit | `lib/content.ts` |
| edit | `app/page.tsx` |
| edit | `app/globals.css` |
| delete | `components/sections/hero/HeroLiveTicker.tsx`, `components/sections/hero/useHeroScroll.ts` |
| delete | `components/three/hero/HeroStage.tsx`, `GlassPanel.tsx`, `Candles.tsx`, `constants.ts` |

Keep these unchanged, even though they become unused or partly unused, because tests import them:
- `lib/hero-zoom.ts`
- `lib/live-candles.ts`
- `lib/three/*`
- `lib/scroll-store.ts` (its `heroProgress` field)
- `components/three/{StageCanvas,ClockBridge,GoldEnvironment,GoldDust,useInViewActive}.tsx`
- `components/nav/nav-math.ts`

Do not delete any file under `public/` or `components/assets/`.

After the deletions, run `grep -rn "three/hero\|sections/hero/\|HeroLiveTicker\|useHeroScroll\|hero-3d" components app lib`. It must return nothing.

---

## 2. R1: hero revert plus photo zoom (`components/sections/Hero.tsx`)

### 2.1 Keep from the current file
- The module-scope `loadProgress.register('hero-image', 0.45)`.
- `bgImgRef`, `markHeroImage` and the `img.complete` effect (current lines 30, 44-57).
  - The preloader waits on `'hero-image'`.

### 2.2 Remove
- The `HeroStage` dynamic import.
- The `'hero-3d'` register effect.
- `useHeroScroll`, `HeroLiveTicker`, `RevealText`, `GoldShimmer`.
- The `hero-ink` class.
- The `btn-liquid--on-light` usage.

### 2.3 Structure
Mirror 74ebc1e. Static positions are the original values at p = 0. Only transform and opacity animate.

```tsx
<section id="hero" ref={ref} className="relative min-h-screen w-full flex items-center overflow-hidden" aria-label="Hero">
  <div className="absolute inset-0" aria-hidden="true">
    {/* Photo: the only zoomed layer */}
    <div ref={photoRef} className="absolute inset-0" style={{ transformOrigin: '60% 50%', willChange: 'transform' }}>
      <Image src="/hero/hero-3200.jpg" ref={bgImgRef} onLoad={markHeroImage} alt="" fill preload fetchPriority="high"
        sizes="100vw" quality={90} style={{ objectFit: 'cover', objectPosition: '65% center' }} />
    </div>
    <div className="hl-orb hl-orb1" style={{ top: '8%', left: '68%', opacity: 0.55 }} />
    <div className="hl-orb hl-orb2" style={{ top: '70%', left: '10%', opacity: 0 }} />
    <div className="hl-orb hl-orb3" style={{ top: '30%', left: '110%', opacity: 0 }} />
    <div className="hl-shaft" style={{ opacity: 0 }} />
    <div className="hl-scrim absolute inset-0" />
    <div className="hl-bottom absolute inset-x-0 bottom-0 h-48" />
  </div>

  <div ref={contentRef} className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 md:px-12 lg:px-16 pt-28 sm:pt-32 pb-24 sm:pb-28">
    <div className="max-w-xl lg:max-w-2xl flex flex-col gap-5 sm:gap-6">
      {/* Cohort badge: copy 74ebc1e lines 236-258 verbatim (var(--accent) border/text, 12% accent bg, pulse dot, "Education before execution") */}
      <TypingHeading
        as="h1"
        segments={HEADLINE}
        className="display font-medium leading-[1.05] tracking-tight"
        style={{ fontSize: 'clamp(2.2rem, 6vw, 5rem)', color: '#F3ECE0', textShadow: '0 2px 28px rgba(0,0,0,0.35)' }}
      />
      {/* Brass rule: same as now */}
      {/* Subline: same motion.p, but style color 'rgba(243,236,224,0.80)', textShadow '0 1px 12px rgba(0,0,0,0.3)' (74ebc1e) */}
      <motion.div custom={5} variants={fadeUpVariants} initial="hidden" animate={inView ? 'visible' : 'hidden'}
        className="flex flex-col gap-3 pt-1">
        <span className="font-body text-[11px] tracking-[0.28em] uppercase" style={{ color: 'rgba(243,236,224,0.72)' }}>{CTA_PRIMARY}</span>
        <div className="flex flex-wrap items-center gap-3">
          <JoinCapsules tone="dark" size="lg" idPrefix="hero-join" className="contents" />
          <Button as="a" href="#curriculum" size="lg" variant="outline" id="hero-cta-secondary">{CTA_SECONDARY}</Button>
        </div>
      </motion.div>
    </div>
  </div>
</section>
```

- `const HEADLINE: TypingSegment[] = [{ text: 'Education before ' }, { text: 'execution', gold: true, flare: true }];` at module scope. Import the type from `@/lib/typing`.
- `export const HERO_PHOTO_ZOOM = 1.12;` at module scope in Hero.tsx. The zoom is subtle, and the cover crop never exposes an edge because the scale is at least 1 from origin 60% 50%.
- `className="contents"` on JoinCapsules makes the two capsules siblings of the outline button in the same flex-wrap row. `data-tone` still inherits through `display: contents`.

### 2.4 Scroll timeline
One ScrollTrigger runs on the shared gsap ticker. `scrub: 0.8` replaces the original `useSpring` smoothing.

```ts
const tier = useDeviceTier();
useGSAP(() => {
  if (tier === 'static') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const hero = ref.current, photo = photoRef.current, content = contentRef.current;
  if (!hero || !photo || !content) return;
  const q = gsap.utils.selector(hero);
  const W = (): number => hero.clientWidth;
  const H = (): number => hero.clientHeight;
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8, invalidateOnRefresh: true },
  });
  tl.fromTo(photo, { scale: 1 }, { scale: HERO_PHOTO_ZOOM, duration: 1 }, 0)
    .fromTo(content, { yPercent: 0 }, { yPercent: -12, duration: 1 }, 0)
    // orb1: left 68%->52%, top 8%->-18%, scale 1->1.35; opacity .55 -> .72 (0.3) -> .4 (0.8) -> .2 (1)
    .fromTo(q('.hl-orb1'), { x: 0, y: 0, scale: 1 }, { x: () => -0.16 * W(), y: () => -0.26 * H(), scale: 1.35, duration: 1 }, 0)
    .fromTo(q('.hl-orb1'), { opacity: 0.55 }, { opacity: 0.72, duration: 0.3 }, 0)
    .to(q('.hl-orb1'), { opacity: 0.4, duration: 0.5 }, 0.3)
    .to(q('.hl-orb1'), { opacity: 0.2, duration: 0.2 }, 0.8)
    // orb2: left 10%->32%, top 70%->20%; opacity 0 -> .38 (0.4) -> .18 (1)
    .fromTo(q('.hl-orb2'), { x: 0, y: 0 }, { x: () => 0.22 * W(), y: () => -0.5 * H(), duration: 1 }, 0)
    .fromTo(q('.hl-orb2'), { opacity: 0 }, { opacity: 0.38, duration: 0.4 }, 0)
    .to(q('.hl-orb2'), { opacity: 0.18, duration: 0.6 }, 0.4)
    // orb3: left 110% -> 85% (0.3) -> 60% (1); opacity 0 -> .28 (.25) -> .42 (.7) -> .18 (1)
    .fromTo(q('.hl-orb3'), { x: 0 }, { x: () => -0.25 * W(), duration: 0.3 }, 0)
    .to(q('.hl-orb3'), { x: () => -0.5 * W(), duration: 0.7 }, 0.3)
    .fromTo(q('.hl-orb3'), { opacity: 0 }, { opacity: 0.28, duration: 0.25 }, 0)
    .to(q('.hl-orb3'), { opacity: 0.42, duration: 0.45 }, 0.25)
    .to(q('.hl-orb3'), { opacity: 0.18, duration: 0.3 }, 0.7)
    // shaft opacity 0 -> .18 (.15) -> .28 (.6) -> .08 (1)
    .fromTo(q('.hl-shaft'), { opacity: 0 }, { opacity: 0.18, duration: 0.15 }, 0)
    .to(q('.hl-shaft'), { opacity: 0.28, duration: 0.45 }, 0.15)
    .to(q('.hl-shaft'), { opacity: 0.08, duration: 0.4 }, 0.6)
    // scrim 1 -> .8 (.5) -> .45 (1); bottom fade 1 -> .6 (.7) -> .3 (1)
    .fromTo(q('.hl-scrim'), { opacity: 1 }, { opacity: 0.8, duration: 0.5 }, 0)
    .to(q('.hl-scrim'), { opacity: 0.45, duration: 0.5 }, 0.5)
    .fromTo(q('.hl-bottom'), { opacity: 1 }, { opacity: 0.6, duration: 0.7 }, 0)
    .to(q('.hl-bottom'), { opacity: 0.3, duration: 0.3 }, 0.7);
}, { dependencies: [tier], scope: ref, revertOnUpdate: true });
```

Imports: `gsap, useGSAP` from `@/lib/gsap`, plus `useDeviceTier`, `TypingHeading`, `JoinCapsules`, `Button`, `motion`, `useInView`, `Image`, `HERO_SUBLINE`, `CTA_PRIMARY`, `CTA_SECONDARY`, `fadeUpVariants` and `brassRuleVariants`.

With reduced motion or the static tier, every layer stays at its p = 0 state, which matches the original first frame.

### 2.5 CSS
Add to `app/globals.css` under a new heading `/* ─── Revisions 2: hero light layers ─── */`.
- There is no `filter: blur()` and no `mix-blend-mode`. Softness comes from extra gradient stops (decision D3).
- Centring uses margins, so GSAP owns `transform` cleanly.

```css
.hl-orb { position: absolute; border-radius: 50%; pointer-events: none; will-change: transform, opacity;
  width: var(--s); height: var(--s); margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2); }
.hl-orb1 { --s: clamp(400px, 65vw, 900px);
  background: radial-gradient(circle, rgba(255,220,140,.62) 0%, rgba(245,190,90,.42) 18%, rgba(235,170,70,.24) 36%, rgba(220,150,60,.11) 54%, rgba(220,150,60,.04) 66%, transparent 74%); }
.hl-orb2 { --s: clamp(300px, 50vw, 700px);
  background: radial-gradient(circle, rgba(240,200,120,.5) 0%, rgba(230,175,90,.26) 30%, rgba(215,155,65,.09) 55%, rgba(215,155,65,.03) 68%, transparent 76%); }
.hl-orb3 { --s: clamp(250px, 40vw, 600px);
  background: radial-gradient(circle, rgba(200,215,240,.45) 0%, rgba(190,205,230,.22) 32%, rgba(175,190,215,.08) 56%, transparent 76%); }
.hl-shaft { position: absolute; top: -10%; left: 35%; width: 180%; height: 180%; pointer-events: none; will-change: opacity;
  background: linear-gradient(105deg, transparent 30%, rgba(255,225,130,.18) 45%, rgba(255,225,130,.28) 50%, rgba(255,225,130,.18) 55%, transparent 70%); }
.hl-scrim { pointer-events: none; will-change: opacity;
  background: linear-gradient(108deg, rgba(14,14,18,.68) 0%, rgba(14,14,18,.44) 38%, rgba(14,14,18,.10) 62%, transparent 80%); }
.hl-bottom { pointer-events: none; will-change: opacity; background: linear-gradient(to bottom, transparent 0%, var(--bg) 100%); }
```

Delete the now-dead CSS blocks in `app/globals.css`:
- `/* Hero on a light photo */` (lines 691-693, `.hero-ink ...` and `.btn-liquid--on-light`).
- `/* Hero live chip */` through `.hl-c[data-up="0"] b {...}` (lines 695-708).
- Careful: those deleted rules include `.hl-c`, `.hl-w` and `.hl-b`. The new class names `.hl-orb*`, `.hl-shaft`, `.hl-scrim` and `.hl-bottom` do not collide with them.

---

## 3. R2: typing headline with a gold "execution" and an edge flare

### 3.1 `lib/typing.ts` (new, pure, no imports; tests import it directly)
```ts
export interface TypingSegment { text: string; gold?: boolean; flare?: boolean }
export interface TypingChar { ch: string; i: number; gold: boolean; flare: boolean }
export interface TypingLayout { text: string; total: number; words: TypingChar[][]; flareIndex: number }

/** Splits segments into words of chars. Global index i counts every character, spaces included; spaces end a word and emit no char. Only the first non-space char of the first flare segment gets flare: true. */
export function layoutTyping(segments: readonly TypingSegment[]): TypingLayout;

/** Number of characters revealed after elapsedMs: 0 before delayMs, then floor((elapsed - delay) / speed) + 1, capped at total. */
export function revealCount(elapsedMs: number, delayMs: number, speedMs: number, total: number): number;
```

`layoutTyping` algorithm:
- `text = segments.map(s => s.text).join('')`, `total = text.length`, `i = 0`, `words = []`, `cur = []`, `flareIndex = -1`.
- For each segment, for each char `ch`:
  - If `ch === ' '`: when `cur.length`, push `cur` and set `cur = []`.
  - Otherwise:
    - `const flare = !!seg.flare && flareIndex < 0;`
    - `if (flare) flareIndex = i;`
    - `cur.push({ ch, i, gold: !!seg.gold, flare })`.
  - Then `i++`.
- At the end, push `cur` if it is non-empty.

### 3.2 `tests/typing.test.mjs` (new)
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutTyping, revealCount } from '../lib/typing.ts';
const SEG = [{ text: 'Education before ' }, { text: 'execution', gold: true, flare: true }];
```
- **layout:**
  - `text === 'Education before execution'`, `total === 26`, `words.length === 3`.
  - `words.map(w => w.map(c => c.ch).join(''))` equals `['Education','before','execution']`.
- **gold and flare:**
  - `words[2][0]` deep-equals `{ ch: 'e', i: 17, gold: true, flare: true }`, and `flareIndex === 17`.
  - Exactly one char across all words has `flare: true`.
  - No char in `words[0]` or `words[1]` is gold.
  - The indices of `words[1]` are 10..15.
- **no flare:** `layoutTyping([{ text: 'a b' }]).flareIndex === -1`.
- **revealCount endpoints:** `(0,350,70,26) === 0`, `(349,350,70,26) === 0`, `(350,350,70,26) === 1`, `(350+70*25,350,70,26) === 26`, `(1e6,350,70,26) === 26`.
- **revealCount monotonic:** for t in 0..3000 step 7, the value never decreases and stays in [0, 26].

### 3.3 `components/ui/TypingHeading.tsx` (full rewrite, `'use client'`)
Props:
```ts
interface TypingHeadingProps {
  segments: readonly TypingSegment[];
  as?: 'h1' | 'h2';
  speedMs?: number;   // default 70 (original)
  delayMs?: number;   // default 350 (original), counted from intro done
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}
```
Export both the named and the default export (as before).

Render. Nothing re-renders while typing; the reveal toggles classes on pre-rendered spans.
```tsx
const layout = useMemo(() => layoutTyping(segments), [segments]);
<Tag id={id} className={className} style={style}>
  <span className="sr-only">{layout.text}</span>
  <span ref={rootRef} className="th" aria-hidden="true">
    {layout.words.map((w, wi) => (
      <Fragment key={wi}>
        {wi > 0 ? ' ' : null}
        <span className={clsx('th-w', w.some(c => c.gold) && 'th-w--gold')}>
          {w.map(c => {
            const char = <span key={c.i} className={clsx('th-c', c.gold && 'th-c--gold')} data-i={c.i}>{c.ch}</span>;
            return c.flare ? (
              <span key={c.i} className="th-fx">
                {React.cloneElement(char, { key: undefined })}
                <span className="th-flare"><span className="th-flare__edge">{c.ch}</span><span className="th-flare__star" /></span>
              </span>
            ) : char;
          })}
        </span>
      </Fragment>
    ))}
    <span ref={caretRef} className="th-caret" />
  </span>
</Tag>
```
- The `cloneElement` is optional. It is simpler to write the inner `<span className="th-c th-c--gold" data-i={c.i}>` twice.
- `Tag` is `as`. Cast it the way `RevealText.tsx:32` does.
- Use `clsx` (already a dependency).
- Do not put `aria-label` on the h1. The sr-only span carries the text.

Behaviour, in `useGSAP((ctx, contextSafe) => {...}, { dependencies: [layout, speedMs, delayMs], revertOnUpdate: true })`:
1. Set up the character map:
   - `els: (HTMLElement|null)[] = Array(layout.total).fill(null)`, filled from `root.querySelectorAll('.th-c')` by `data-i`.
   - `const firstIdx = els.findIndex(Boolean)`.
2. Measure character positions:
   - `measure()` caches `rects[i] = { l, r, t, h }` from `el.getBoundingClientRect()` minus `root.getBoundingClientRect()` (left/top).
   - It also caches `gap = parseFloat(getComputedStyle(root).fontSize) * 0.08` and `caretH = caret.offsetHeight`.
   - Rect-based measurement is immune to the `.th-fx` wrapper and to the content drift transform.
3. Place the caret:
   - `placeCaret()`: `k` is the largest index below `shown` with `els[k]`.
   - If there is none, `x = rects[firstIdx].l`. Otherwise `x = rects[k].r + gap`.
   - `y = rects[k or firstIdx].t + (h - caretH) / 2`.
   - Then `caret.style.transform = \`translate3d(${x}px, ${y}px, 0)\``.
4. Reduced motion:
   - If `matchMedia('(prefers-reduced-motion: reduce)')` matches: `root.classList.add('th--static')`, add `is-on` to all chars, `shown = total`, `measure()`, `placeCaret()`, return.
   - There is no flare.
5. Set up the flare:
   - `playFlare = contextSafe(() => {...})`, once only (a `flared` flag). Let `fx = els[layout.flareIndex]?.parentElement` (the `.th-fx`), `edge = fx.querySelector('.th-flare__edge')`, `star = fx.querySelector('.th-flare__star')`.
   - `gsap.set(star, { x: 0, scale: 0, rotation: 0, opacity: 0 })`, then `const tl = gsap.timeline()`:
     - `tl.to(edge, { opacity: 1, duration: 0.22, ease: 'power2.out' }, 0)`
     - `tl.to(edge, { opacity: 0, duration: 0.7, ease: 'power2.in' }, 0.3)`
     - `tl.to(star, { x: () => fx.offsetWidth * 0.85, rotation: 90, duration: 0.85, ease: 'power2.inOut' }, 0.05)`
     - `tl.to(star, { scale: 1.15, opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.05)`
     - `tl.to(star, { scale: 0, opacity: 0, duration: 0.35, ease: 'power2.in' }, 0.55)`
6. Typing loop on the shared ticker:
   - `start()` is idempotent. It sets `t0 = -1` and `unsub = onEveryFrame((ts) => {...}, 'update')`. Each frame:
     - `if (t0 < 0) t0 = ts;`
     - `n = revealCount(ts - t0, delayMs, speedMs, layout.total)`.
     - If `n !== shown`:
       - Add `is-on` to `els[shown..n-1]`.
       - `const hitFlare = layout.flareIndex >= 0 && shown <= layout.flareIndex && n > layout.flareIndex;`
       - `shown = n; placeCaret(); if (hitFlare) playFlare();`
     - `if (n >= total) { unsub(); unsub = null; root.classList.add('th--done'); }`
   - The caret keeps blinking after completion via CSS, as in the original.
7. Start triggers:
   - `measure(); placeCaret();`
   - `const offIntro = onIntroDone(start);` (the Preloader calls `markIntroDone`, `Preloader.tsx:58`).
   - `const failsafe = window.setTimeout(start, 6000);`
   - `const ro = new ResizeObserver(() => { measure(); placeCaret(); }); ro.observe(root);`
   - `document.fonts?.ready.then(() => { measure(); placeCaret(); });`
8. Cleanup: `offIntro(); clearTimeout(failsafe); unsub?.(); ro.disconnect();`

Imports: `gsap, useGSAP` from `@/lib/gsap`, `onEveryFrame` from `@/lib/frame-loop`, `onIntroDone` from `@/lib/intro`, `layoutTyping`, `revealCount` and `type TypingSegment` from `@/lib/typing`, `clsx`.

### 3.4 CSS (append to globals.css, heading `/* ─── Revisions 2: typing headline ─── */`)
```css
.th { position: relative; display: block; }
.th-w { display: inline-block; white-space: nowrap; }
.th-c { position: relative; display: inline-block; }
.th-fx { position: relative; display: inline-block; }
html.js .th-c { opacity: 0; animation: th-failsafe 0s 9s forwards; }
html.js .th-c.is-on, html.js .th--static .th-c { opacity: 1; animation: none; }
@keyframes th-failsafe { to { opacity: 1; } }
.th-c--gold {
  background-image: linear-gradient(180deg, #F6E3A1 0%, #E8CA65 38%, #D4AF37 62%, #A97F22 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; text-shadow: none;
}
.th-w--gold { filter: drop-shadow(0 2px 12px rgba(0, 0, 0, .3)); }
.th-caret { position: absolute; left: 0; top: 0; width: 3px; height: .82em; border-radius: 2px; background: #D4AF37;
  box-shadow: 0 0 10px rgba(212, 175, 55, .75); pointer-events: none; will-change: transform;
  animation: th-blink .9s cubic-bezier(.4, 0, .6, 1) infinite; }
@media (min-width: 640px) { .th-caret { width: 4px; } }
@keyframes th-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.th-flare { position: absolute; inset: 0; pointer-events: none; }
.th-flare__edge { position: absolute; inset: 0; color: transparent; -webkit-text-fill-color: transparent;
  -webkit-text-stroke: 1.25px #FFF4D2; text-shadow: 0 0 8px rgba(255, 236, 190, .95), 0 0 20px rgba(212, 175, 55, .7); opacity: 0; }
.th-flare__star { position: absolute; left: 0; top: 30%; width: .42em; height: .42em; margin: -.21em 0 0 -.21em; opacity: 0;
  will-change: transform, opacity;
  background: radial-gradient(circle, #fff 0 10%, rgba(255, 244, 210, .85) 22%, rgba(255, 236, 190, 0) 62%); }
.th-flare__star::before, .th-flare__star::after { content: ''; position: absolute; left: 50%; top: 50%; width: 160%; height: 2px;
  margin: -1px 0 0 -80%; background: linear-gradient(90deg, transparent, #fff 50%, transparent); }
.th-flare__star::after { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .th-caret { animation: none; } .th-flare { display: none; } }
```

---

## 4. R3: gold-bordered nav chips with a metallic fill (`GlassHeader.tsx` + CSS)

### 4.1 GlassHeader.tsx edits
1. **Imports.**
   - Remove `indicatorTransform` and `stretchKeyframes` (line 15).
   - Remove `Button` and `CTA_PRIMARY` (lines 11-12). Keep `NAV_LINKS`.
   - Add `import { JoinMenu } from './JoinMenu';`.
2. **Remove the liquid indicator.**
   - Delete `indicatorRef` (line 29), the `indicator` null check (line 53-54), the `<li aria-hidden ...><span ref={indicatorRef} .../></li>` (lines 246-248), and the block at lines 104-135.
   - Replace that block with:
     ```ts
     const links = Array.from(ul.querySelectorAll<HTMLAnchorElement>('a.lg-link'));
     let active = -1;
     const setActive = (i: number): void => {
       if (active >= 0) { links[active]?.classList.remove('is-active'); links[active]?.removeAttribute('aria-current'); }
       active = i;
       if (i >= 0) { links[i]?.classList.add('is-active'); links[i]?.setAttribute('aria-current', 'location'); }
     };
     // Metallic fill grows from the pointer entry point and shrinks toward the exit point.
     const setOrigin = (e: PointerEvent): void => {
       const a = e.currentTarget as HTMLElement;
       const r = a.getBoundingClientRect();
       a.style.setProperty('--fx', `${e.clientX - r.left}px`);
       a.style.setProperty('--fy', `${e.clientY - r.top}px`);
     };
     links.forEach((a) => { a.addEventListener('pointerenter', setOrigin); a.addEventListener('pointerleave', setOrigin); });
     cleanups.push(() => links.forEach((a) => { a.removeEventListener('pointerenter', setOrigin); a.removeEventListener('pointerleave', setOrigin); }));
     ```
   - The `NAV_LINKS.forEach(... ScrollTrigger ... setActive ...)` block (lines 137-149) stays unchanged.
3. **Desktop `<ul>`.** Use `className="relative hidden md:flex items-center gap-1.5 lg:gap-2.5"`.
   - Each link: `className="lg-link font-body font-medium no-underline text-sm"`, still with `data-magnetic`.
4. **Wordmark at md only.** Add `md:max-lg:hidden` to the wordmark span (line 237) so the chips plus the Join trigger fit at 768-1023 px.
5. **Right side.** Replace lines 264-268 with `<div className="hidden md:block"><JoinMenu /></div>`.
6. **Hide on scroll.** The rule `if (next && (mobileOpenRef.current || wrap.contains(document.activeElement))) next = false;` already keeps the bar visible while the dropdown has focus. No change.

### 4.2 CSS
Replace `app/globals.css:553-554`, the old `.lg-link` and `.lg-link:hover` rules. Delete the `.lg-indicator` rule (565-578). In the reduced-motion list at 637, keep `.lg-link`.
```css
.lg-link {
  position: relative; display: inline-flex; align-items: center; padding: 6px 14px; border-radius: 999px;
  border: 1px solid rgba(212, 175, 55, .6); color: inherit; overflow: hidden; isolation: isolate;
  transition: color .35s cubic-bezier(.16, 1, .3, 1), border-color .35s, background-color .35s;
}
.lg-link::before { /* metallic fill: a disc growing from the pointer */
  content: ''; position: absolute; left: var(--fx, 50%); top: var(--fy, 50%); z-index: -1; pointer-events: none;
  width: 240%; aspect-ratio: 1; margin: -120% 0 0 -120%; border-radius: 50%;
  background: linear-gradient(135deg, #7d5e17 0%, #c9a13b 22%, #f6e3a1 42%, #d4af37 58%, #fff1c1 70%, #a97f22 88%, #6f5313 100%);
  transform: scale(0); transition: transform .55s cubic-bezier(.16, 1, .3, 1);
}
.lg-link::after { /* sheen pass after the fill */
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, .6) 50%, transparent 70%);
  transform: translateX(-120%); transition: transform .8s cubic-bezier(.16, 1, .3, 1) .1s;
}
.lg-link:hover, .lg-link:focus-visible { color: #1a1408; border-color: rgba(241, 217, 138, .95); }
.lg-link:hover::before, .lg-link:focus-visible::before { transform: scale(1); }
.lg-link:hover::after, .lg-link:focus-visible::after { transform: translateX(120%); }
.lg-link.is-active { border-color: #d4af37; background-color: rgba(212, 175, 55, .16); }
.lg-pill.lg-dark .lg-link { border-color: rgba(212, 175, 55, .7); }
.lg-pill.lg-dark .lg-link:hover, .lg-pill.lg-dark .lg-link:focus-visible { color: #1a1408; }
@media (prefers-reduced-motion: reduce) { .lg-link::before, .lg-link::after { transition: none; } }
```

---

## 5. R4: "Join the team" capsules

### 5.1 `lib/content.ts`
- Replace line 75 with `export const CTA_PRIMARY = 'Join the team';`.
- Add after line 76:
```ts
// TODO: replace with the real invite links before launch.
export const TELEGRAM_URL = '#telegram';
export const WHATSAPP_URL = '#whatsapp';

export interface JoinChannel { id: 'telegram' | 'whatsapp'; label: string; href: string }
export const JOIN_CHANNELS: JoinChannel[] = [
  { id: 'telegram', label: 'Join Telegram group', href: TELEGRAM_URL },
  { id: 'whatsapp', label: 'Join WhatsApp group', href: WHATSAPP_URL },
];
```
No other copy changes.

### 5.2 `components/ui/JoinCapsules.tsx` (new)
There is no `'use client'` and there are no hooks, so it works inside the server `FinalCta` and the client components.
```ts
import { Send, MessageCircle } from 'lucide-react';   // both exist in lucide-react 1.47
interface JoinCapsulesProps {
  tone?: 'light' | 'dark';      // hover text colour once the fill has drained; omit = inherit --cap-hover-ink
  size?: 'sm' | 'lg';           // default 'lg'
  className?: string;           // layout of the wrapper (e.g. 'contents', 'flex flex-col gap-2.5')
  capClassName?: string;        // extra class per capsule (e.g. 'w-full')
  idPrefix?: string;            // ids `${idPrefix}-telegram` / `${idPrefix}-whatsapp`
  onNavigate?: () => void;      // e.g. close the mobile sheet
}
export function JoinCapsules(p: JoinCapsulesProps): React.ReactElement
```
Markup:
```tsx
<div className={clsx('join-caps', className ?? 'flex flex-wrap items-center gap-3')} data-tone={tone}>
  {JOIN_CHANNELS.map(c => {
    const Icon = c.id === 'telegram' ? Send : MessageCircle;
    return (
      <a key={c.id} href={c.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate}
         id={idPrefix ? `${idPrefix}-${c.id}` : undefined}
         className={clsx('cap-btn', size === 'sm' ? 'cap-btn--sm' : 'cap-btn--lg', capClassName)}>
        <span className="cap-btn__fill" aria-hidden="true" />
        <Icon className="cap-btn__icon" aria-hidden="true" />
        <span>{c.label}</span>
      </a>
    );
  })}
</div>
```

### 5.3 `components/nav/JoinMenu.tsx` (new, `'use client'`)
This is a disclosure pattern, not `role="menu"`.
- State `open`, refs `root` (div) and `btn` (button), `closeTimer`.
- Root: `<div ref={root} className="join-menu-root relative" onPointerEnter={hoverOpen} onPointerLeave={hoverClose} onKeyDown={onKey} onBlur={onBlur}>`.
- Trigger: `<button ref={btn} type="button" data-magnetic className="cap-btn cap-btn--sm join-trigger" aria-expanded={open} aria-controls="join-menu" onClick={() => setOpen(o => !o)}>`, containing:
  - `<span className="cap-btn__fill" aria-hidden="true" />`
  - `{CTA_PRIMARY}`
  - `<ChevronDown className="join-trigger__chev" aria-hidden="true" />`
- Panel: `<div id="join-menu" className="join-menu" data-open={open ? '' : undefined}>` containing `<JoinCapsules size="sm" className="flex flex-col gap-2" capClassName="w-full" onNavigate={() => setOpen(false)} />`.
  - Leave `tone` unset so the panel's `--cap-hover-ink` applies.
- Behaviour:
  - `hoverOpen`: only when `matchMedia('(hover:hover) and (pointer:fine)').matches`. It clears `closeTimer` and opens.
  - `hoverClose`: `closeTimer = setTimeout(() => setOpen(false), 140)`.
  - `onKey`: `Escape` closes the panel and focuses `btn`.
  - `onBlur`: `(e) => { if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false); }`.
  - `useEffect` while open: a document `pointerdown` handler closes the panel when the target is outside `root`. Remove it on close or unmount, and clear the timer on unmount.
- Import `CTA_PRIMARY` from `@/lib/content`, `ChevronDown` from `lucide-react` and `JoinCapsules`.

### 5.4 CSS (append, heading `/* ─── Revisions 2: join capsules ─── */`)
```css
.cap-btn {
  position: relative; isolation: isolate; overflow: hidden; display: inline-flex; align-items: center; justify-content: center;
  gap: .55em; border-radius: 999px; border: 1px solid rgba(212, 175, 55, .85); color: #1a1408;
  font-family: var(--font-body); font-weight: 600; white-space: nowrap; text-decoration: none; cursor: pointer;
  background: transparent;
  box-shadow: 0 6px 22px rgba(120, 90, 25, .22), inset 0 1px 0 rgba(255, 255, 255, .5);
  transition: color .45s cubic-bezier(.16, 1, .3, 1), border-color .45s;
}
.cap-btn--sm { padding: 8px 16px; font-size: .875rem; }
.cap-btn--lg { padding: 14px 26px; font-size: 1rem; }
.cap-btn__icon { width: 1.05em; height: 1.05em; flex: none; }
.cap-btn__fill { /* the colour drains downward on hover */
  position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: linear-gradient(180deg, #F6E3A1 0%, #E2C163 35%, #D4AF37 55%, #B38728 80%, #8C6D23 100%);
  transform-origin: 50% 100%; transform: scaleY(1); transition: transform .6s cubic-bezier(.16, 1, .3, 1);
}
.cap-btn__fill::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 45%;
  background: linear-gradient(180deg, rgba(255, 255, 255, .45), transparent); }
.cap-btn:hover .cap-btn__fill, .cap-btn:focus-visible .cap-btn__fill { transform: scaleY(0); }
.cap-btn:hover, .cap-btn:focus-visible { color: var(--cap-hover-ink, #6B5320); border-color: #d4af37; }
.cap-btn:focus-visible { outline: 2px solid #d4af37; outline-offset: 3px; }
.join-caps[data-tone='light'] { --cap-hover-ink: #6B5320; }
.join-caps[data-tone='dark'] { --cap-hover-ink: #F1D98A; }

.join-trigger__chev { width: 14px; height: 14px; transition: transform .35s cubic-bezier(.16, 1, .3, 1); }
.join-trigger[aria-expanded='true'] .join-trigger__chev { transform: rotate(180deg); }
.lg-pill { --cap-hover-ink: #6B5320; }
.lg-pill.lg-dark { --cap-hover-ink: #F1D98A; }

.join-menu {
  position: absolute; right: 0; top: calc(100% + 10px); min-width: 236px; padding: 10px; border-radius: 22px; z-index: 5;
  background: rgba(250, 246, 237, .97); border: 1px solid rgba(212, 175, 55, .45);
  box-shadow: 0 18px 48px rgba(40, 30, 10, .22);
  transform-origin: 100% 0; opacity: 0; visibility: hidden; pointer-events: none; transform: translateY(-6px) scale(.98);
  transition: opacity .25s ease, transform .35s cubic-bezier(.16, 1, .3, 1), visibility 0s linear .35s;
}
.join-menu[data-open] { opacity: 1; visibility: visible; pointer-events: auto; transform: none; transition-delay: 0s; }
.lg-pill.lg-dark .join-menu { background: rgba(14, 12, 9, .95); }
@media (prefers-reduced-motion: reduce) { .cap-btn, .cap-btn__fill, .join-menu, .join-trigger__chev { transition: none; } }
```
- Contrast check: dark ink `#1a1408` on the metallic fill passes AA.
- After the fill drains: `#6B5320` on the light panel or beige passes AA, and `#F1D98A` on the dark/scrim areas passes AA.

### 5.5 Usages
- **Hero:** see section 2.3. `tone="dark"`, because the CTAs sit on the restored dark scrim.
- **FinalCta.tsx:**
  - Imports: remove the `Button` import only if it becomes unused; it does not, because the secondary still uses it. Add `import { JoinCapsules } from '@/components/ui/JoinCapsules';`.
  - Replace the first `<Magnetic>...</Magnetic>` (lines 50-60) so the CTA area at lines 49-72 becomes:
    ```tsx
    <span className="font-body text-[11px] tracking-[0.28em] uppercase mt-2" style={{ color: 'rgba(245,239,235,0.7)' }}>{CTA_PRIMARY}</span>
    <div className="flex flex-wrap justify-center items-center gap-3">
      <JoinCapsules tone="dark" size="lg" idPrefix="cta-join" className="contents" />
      <Magnetic><Button as="a" href="#curriculum" size="lg" variant="outline" id="cta-secondary">{CTA_SECONDARY}</Button></Magnetic>
    </div>
    ```
  - The mailto link is gone, by the user's request: "Join the team" means Telegram or WhatsApp.
- **MobileMenuSheet.tsx:**
  - Imports: replace `CTA_PRIMARY` usage with the label, and add `JoinCapsules`. Remove the `Button` import if it is now unused.
  - Replace lines 141-143 (`<Button ...>{CTA_PRIMARY}</Button>`) with:
    ```tsx
    <p className="font-body text-[11px] tracking-[0.28em] uppercase mb-3 text-center" style={{ color: 'rgba(250,246,240,0.7)' }}>{CTA_PRIMARY}</p>
    <JoinCapsules tone="dark" size="lg" className="flex flex-col gap-2.5" capClassName="w-full" onNavigate={onClose} />
    ```
- **GlassHeader:** see section 4.1 step 5.
- `#cta` remains the FinalCta section id. Nothing else links to it after this change except the nav ScrollTriggers, which do not use it.

---

## 6. R5: "Gilded seam" section transition (`components/fx/SectionSeam.tsx`)

**Concept.** At each major boundary, a gold hallmark lozenge is stamped at the centre (with a ring ripple). Two sparks then run outward and engrave a gold hairline across the seam, and a soft gold bloom settles behind it. It is scroll-scrubbed and reversible, and it reads as a jeweller's seam joining two plates.

**Cost.** Everything is transform and opacity on small layers inside a 140 px band. There is no clip-path and nothing full-screen.

### 6.1 Component
```ts
'use client';
export function SectionSeam({ tone = 'dark' }: { tone?: 'light' | 'dark' }): React.ReactElement
```
Markup:
```tsx
<div ref={ref} className={`seam seam--${tone}`} aria-hidden="true">
  <div className="seam__band">
    <span className="seam__bloom" />
    <span className="seam__line seam__line--l" />
    <span className="seam__line seam__line--r" />
    <span className="seam__spark seam__spark--l" />
    <span className="seam__spark seam__spark--r" />
    <span className="seam__ring" />
    <span className="seam__mark" />
  </div>
</div>
```

`useGSAP(() => {...}, { scope: ref })`:
```ts
const root = ref.current; if (!root) return;
const q = gsap.utils.selector(root);
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { root.classList.add('seam--static'); return; }
const band = q('.seam__band')[0] as HTMLElement;
const half = (): number => band.clientWidth / 2;
gsap.set(q('.seam__spark'), { x: 0, opacity: 0 });
const tl = gsap.timeline({
  defaults: { ease: 'none' },
  scrollTrigger: { trigger: root, start: 'top 88%', end: 'top 30%', scrub: 0.6, invalidateOnRefresh: true },
});
tl.fromTo(q('.seam__mark'), { scale: 0, rotation: 0 }, { scale: 1, rotation: 45, duration: 0.15, ease: 'back.out(2)' }, 0)
  .fromTo(q('.seam__ring'), { scale: 0.4, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 0.3, ease: 'power2.out' }, 0.05)
  .fromTo(q('.seam__bloom'), { scaleX: 0.3, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.5, ease: 'power1.out' }, 0.1)
  .fromTo(q('.seam__line'), { scaleX: 0 }, { scaleX: 1, duration: 0.65, ease: 'power2.inOut' }, 0.12)
  .to(q('.seam__spark'), { opacity: 1, duration: 0.05 }, 0.12)
  .to(q('.seam__spark--r'), { x: () => half(), duration: 0.65, ease: 'power2.inOut' }, 0.12)
  .to(q('.seam__spark--l'), { x: () => -half(), duration: 0.65, ease: 'power2.inOut' }, 0.12)
  .to(q('.seam__spark'), { opacity: 0, duration: 0.12 }, 0.72)
  .to(q('.seam__bloom'), { opacity: 0.35, duration: 0.25 }, 0.75);
```
- The scrub uses the gsap ticker, which is the same shared ticker as `lib/frame-loop`.
- It runs on every tier, because it is cheap.

### 6.2 CSS (append, heading `/* ─── Revisions 2: gilded seam ─── */`)
```css
.seam { position: relative; z-index: 5; height: 0; pointer-events: none; }
.seam__band { position: absolute; left: 0; right: 0; top: -70px; height: 140px; overflow: hidden; }
.seam__line { position: absolute; top: 50%; height: 1px; width: 50%; margin-top: -.5px; transform: scaleX(0); will-change: transform; }
.seam__line--r { left: 50%; transform-origin: 0 50%;
  background: linear-gradient(90deg, #F1D98A, rgba(212, 175, 55, .55) 60%, rgba(212, 175, 55, 0)); }
.seam__line--l { right: 50%; transform-origin: 100% 50%;
  background: linear-gradient(270deg, #F1D98A, rgba(212, 175, 55, .55) 60%, rgba(212, 175, 55, 0)); }
.seam__spark { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; opacity: 0; will-change: transform, opacity;
  background: radial-gradient(circle, #fff 0 22%, #F6E3A1 42%, rgba(212, 175, 55, 0) 70%); }
.seam__mark { position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; transform: scale(0);
  background: linear-gradient(135deg, #F6E3A1, #D4AF37 50%, #8C6D23); box-shadow: 0 0 12px rgba(212, 175, 55, .55); }
.seam__ring { position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%;
  border: 1px solid rgba(232, 202, 101, .8); opacity: 0; }
.seam__bloom { position: absolute; left: 50%; top: 50%; width: min(70vw, 900px); height: 120px;
  margin: -60px 0 0 calc(min(70vw, 900px) / -2); opacity: 0; transform: scaleX(.3);
  background: radial-gradient(ellipse at center, rgba(212, 175, 55, .28), rgba(212, 175, 55, .08) 40%, transparent 70%); }
.seam--light .seam__line--r { background: linear-gradient(90deg, #B38728, rgba(179, 135, 40, .5) 60%, rgba(179, 135, 40, 0)); }
.seam--light .seam__line--l { background: linear-gradient(270deg, #B38728, rgba(179, 135, 40, .5) 60%, rgba(179, 135, 40, 0)); }
.seam--light .seam__bloom { background: radial-gradient(ellipse at center, rgba(179, 135, 40, .22), rgba(179, 135, 40, .06) 40%, transparent 70%); }
.seam--static .seam__line { transform: none; }
.seam--static .seam__mark { transform: rotate(45deg); }
.seam--static .seam__bloom { opacity: .35; transform: none; }
```

### 6.3 Placement (`app/page.tsx`)
Import `SectionSeam` from `@/components/fx/SectionSeam`. Insert it at these boundaries:
- **Light seam:**
  - Between `<Hero />` and `<CryptoMarketScroll />`: `<SectionSeam tone="light" />`.
- **Dark seams:**
  - Between `<HallmarkDial />` and the `theme-black-section` div: `<SectionSeam />`.
  - Inside the dark div, between each pair:
    - Markets | LuxuryTeamGallery
    - LuxuryTeamGallery | MomentsReel
    - MomentsReel | Curriculum
    - Curriculum | Gallery
    - Gallery | Testimonial
    - MagicRingShowcase | FinalCta
- Do not add a seam between Testimonial and MagicRingShowcase, before the Footer, or inside the Crypto/Forex sticky sequences.
- That makes 8 seams.

Why it is safe with sticky and pinned sections:
- The seam has height 0, so it adds no layout.
- It is a sibling, not a wrapper, so it never transforms or clips a sticky or pinned ancestor.
- Its ScrollTrigger is created after the preceding section's pin, because effects run in sibling order.

---

## 7. Phases (commit after each; message `Revisions 2 phase N: <title>`)
1. **Content + capsules:**
   - `lib/content.ts`, `JoinCapsules.tsx`, the cap CSS.
   - FinalCta and MobileMenuSheet usages.
2. **Nav:**
   - `JoinMenu.tsx`.
   - GlassHeader edits (chips, metallic fill, indicator removal, wordmark at md).
   - The nav CSS.
3. **Typing:**
   - `lib/typing.ts`, `tests/typing.test.mjs`.
   - The `TypingHeading.tsx` rewrite and the typing CSS.
4. **Hero revert:**
   - The `Hero.tsx` rewrite and the hero CSS.
   - Delete the hero 3D, live ticker and scroll-hook files.
   - Delete the dead CSS blocks.
5. **Seams:**
   - `SectionSeam.tsx`, the seam CSS and the `page.tsx` placement.
6. **Verify:** run the section 8 commands. Fix lint and type errors only in touched files.

## 8. Acceptance checks and commands
Run these from the repo root:
- `corepack pnpm test` passes, including the new `tests/typing.test.mjs`. `hero-zoom`, `live-candles` and `three-libs` still pass because their lib files are untouched.
- `corepack pnpm build` passes with no type errors.
- `corepack pnpm lint` shows no new errors in the touched files.
- `grep -rn "three/hero\|sections/hero/\|HeroLiveTicker\|useHeroScroll\|hero-3d\|hero-ink\|btn-liquid--on-light\|lg-indicator" components app lib` returns nothing.
- `grep -rn "next cohort" components app lib` returns nothing. `grep -rn "Join Telegram group\|Join WhatsApp group" lib/content.ts` returns 2 lines.

Manual checks for the user:
- **Hero:**
  - The photo is visible with the original warm look: dark left scrim, warm orbs and the bottom fade to beige, with cream text.
  - Scrolling zooms the photo smoothly to about 1.12 while the orbs drift.
  - There is no WebGL canvas in `#hero`.
- **Headline:**
  - It types letter by letter after the preloader, with a blinking gold caret.
  - "execution" is metallic gold.
  - When the first "e" appears, its outline glows and a star glint crosses it once.
  - There is no layout shift: the h1 height is constant while typing.
  - With reduced motion, the full text shows at once, with no flare and a static caret.
- **Nav:**
  - Each link sits in a thin gold-bordered transparent pill.
  - On hover, metallic gold fills from the cursor entry point with a sheen pass, and the text turns dark ink.
  - The current section's chip has a gold tint.
  - Keyboard focus shows the fill and the outline.
- **Join (nav):**
  - "Join the team" is a filled gold capsule, readable on beige and dark tones.
  - Hover or click opens a panel with two filled capsules. On a capsule's hover, its gold drains downward.
  - Escape and outside clicks close the panel. The links open in a new tab.
- **Mobile menu:** shows the "Join the team" label and both capsules full-width.
- **Hero and FinalCta:** show the two capsules plus "See the curriculum".
- **Seams:** at the 8 boundaries, the lozenge stamps, the sparks engrave the hairline outward and the bloom settles. Scrolling back reverses it. On mobile the hairline spans the full width.
- **Performance:**
  - In the DevTools Performance panel, scrolling the hero and the seams shows only composite or transform work.
  - There are no long tasks from typing: `LongTaskProbe` logs nothing new.

## 9. Decisions (record with `hx decision add` once hx is available)
- **D1. Hero:** restore the 74ebc1e layer stack and drop the R3F hero entirely. The photo zoom is a CSS transform on the photo wrapper only (1 → 1.12, origin 60% 50%), scrubbed with one timeline.
  - Reason: the user explicitly asked for the revert. The removed scrim was what made the photo read as a photo.
- **D2:** keep `public/hero/hero-3200.jpg` instead of the 21 MB PNG. Its channel stats are the same as the source, so it is visually identical at viewport sizes, and the optimizer serves AVIF/WebP from it.
- **D3:** approximate the original `filter: blur()` and `mix-blend-mode` orbs with multi-stop radial gradients under normal blending, and animate them with transform/opacity instead of top/left.
  - Reason: blur and blend on 900 px moving layers force render surfaces every frame. Accepted cost: the warm tint is slightly less "screen"-like than the original. Tune the alphas if the user notices.
- **D4. Typing:** all characters are pre-rendered, and the reveal toggles classes from the shared ticker (no React re-render per letter). The caret moves by transform from cached rects. The flare is a stroked duplicate glyph plus a star glint (opacity/transform only) on the first char of "execution", played once.
- **D5. Nav:** metallic fill is a pseudo-element disc scaled from the pointer entry point (CSS vars set on pointerenter/leave). The stretchy liquid indicator is replaced by an `.is-active` chip tint to avoid two competing highlights. `nav-math.ts` is kept for its tests.
- **D6. Join:**
  - The capsules are gold metallic, not brand-coloured, to stay on theme.
  - The nav uses a "Join the team" trigger with a hover/click disclosure panel, because two capsules do not fit beside the four chips at md widths.
  - The hero, FinalCta and mobile menu show both capsules inline.
  - URLs are placeholders in `lib/content.ts` (TODO). The links open in a new tab with `rel="noopener noreferrer"`. FinalCta loses its mailto link.
- **D7. Section transition: "Gilded seam".** A zero-height sibling at 8 boundaries, with a 140 px overflow-hidden band and transform/opacity only, scrubbed and reversible. It is never a wrapper, so sticky and pinned sections are unaffected.
