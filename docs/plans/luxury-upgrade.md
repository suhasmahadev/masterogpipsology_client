# Plan: luxury-upgrade

Spec: `UPGRADE_BRIEF.md` (P1-P7). Branch `luxury-upgrade` (snapshot `74ebc1e` on `main`). Predecessor plan `docs/plans/scroll-frame-performance.md` is IMPLEMENTED in `74ebc1e` (engine, math, frame-loop, useFrameSequence, tests, fake-metric removals F1-F13). Do not re-do that work.

`hx` is not installed in this environment, so design decisions are recorded in section 9 (Decisions) of this file instead of `hx decision add`.

Tooling facts (verified 2026-10-08):
- `pnpm` is not on PATH in Git Bash. Use `corepack pnpm <cmd>` (pnpm 10.33.0). Baseline `corepack pnpm build` passes (Turbopack, routes `/`, `/_not-found`, `/intelligence`).
- Unit tests: `node --test "tests/**/*.test.mjs"` (11 pass). `node --test tests/` FAILS (directory arg); use the glob.
- Next 16: `next/image` `priority` is deprecated; use `preload` or `fetchPriority="high"` (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md:265-293`). `next/dynamic(..., { ssr: false })` only inside Client Components (`.../02-guides/lazy-loading.md:66`). `next/font` options: `.../02-components/font.md`.
- Frames: 4 x 240 baseline JPEG, 1920x1080, ezgif export, 7.5-10 MB per folder (median ~35 KB/frame => heavily compressed, banding/blocking). Hero `public/background_image.png` is a 21 MB, 6688x3764 PNG; the marble arch and glass chart panel are BAKED into it.
- Latest packages: gsap 3.15.0, @gsap/react 2.1.2, @react-three/fiber 9.8.1 (peer react >=19 <19.4, three >=0.156), @react-three/drei 10.7.9. lenis 1.3.26 has `lerp`, `anchors`, `autoRaf`. three r180 has `renderer.transmissionResolutionScale`.

---

## Summary for the user

1. Stack: add `gsap` 3.15 (ScrollTrigger + SplitText, now free), `@gsap/react`, `@react-three/fiber` 9 + `@react-three/drei` 10 on the existing `three` 0.180 (+ `@types/three`), and `sharp` as a dev tool. One clock: `gsap.ticker` drives Lenis, ScrollTrigger, the frame sequences and R3F (`frameloop="never"` + `advance`). framer-motion stays only for discrete UI (menu/modal presence, shared-element `layoutId`); every scroll-linked framer hook moves to GSAP. Fonts use `next/font/google`, which downloads at build time and self-hosts woff2 under `/_next/static/media` with automatic preload and a metric-matched fallback (no layout shift, no font files to manage). `next/font/local` is the fallback if builds must run offline.
2. Root causes of lag. Already fixed in `74ebc1e`: main-thread JPEG re-decode (now `createImageBitmap` windowed cache, `lib/frame-sequence/engine.ts:369-417`), double smoothing, a Lenis context that was always null, several rAF loops (`lib/frame-loop.ts`), an oversized canvas (`math.ts:32`), unprioritised preload and per-tick DOM writes. Still present: (a) Forex animates `filter: blur(<=24px) brightness()` on a full-viewport canvas every frame (`ForexMarketScroll.tsx:155-163`, `will-change: filter` at `:235`); (b) the header stacks two backdrop-filters (blur 20 + blur 36, saturate 220%) that re-filter the moving canvas, and 7 springs animate `color` (`GlassHeader.tsx:27-35, 63-106, 129-195`); (c) the Hero animates `top`/`left` of three 400-900px `blur(55-70px)` blend-mode orbs and repaints a 180% gradient each frame, on a spring that settles for about 1 s after the hero has left (`Hero.tsx:41, 94-205`), and `TypingHeading.tsx:26-35` re-renders and re-wraps the h1 every 70 ms; (d) `lib/theme.ts:43-47, 65-74` writes `--accent` on `<html>` over the whole page, which recalculates styles for the whole document around 200 times per scroll pass; (e) the HUD bars animate `width` (`CryptoMarketScroll.tsx:34`, `ForexMarketScroll.tsx:107`); (f) MagicRings runs its own rAF (`components/MagicRings.jsx:205, 248`) next to four framer `useScroll`/`useSpring` chains; (g) `LuxuryTeamGallery.tsx:17-23, 166` calls setState on every slider scroll; (h) the LCP image is a 21 MB, 25 MP PNG.
3. Fonts: Cormorant Garamond (variable 300-700 plus italic) for display, Manrope (variable 200-800) for body, and Manrope 600 uppercase tracked at 0.22em for small labels. These replace Fraunces and Geist.
4. 3D (desktop high-tier only, lazy-loaded, DPR capped at 2, paused off-screen). The hero stage sits inside `#hero`. The hero photo becomes an in-scene plane with 2.5D marble-arch parallax and a gold light-sweep shader. The chart becomes a real glass panel (MeshPhysicalMaterial transmission, extruded gold frame, procedural Lightformer HDRI with no network fetch) holding instanced candlesticks that grow with an additive gold glow. Gold dust particles render in one draw call and react to Lenis velocity and the mouse, and the camera dollies as you leave the hero. The mid-page wow object is a new `SculptureInterlude` after Forex: 1,400 instanced gold blocks assemble into a candlestick sculpture on the gold beat, then disperse into the dark while the camera orbits. Mobile and reduced-motion visitors get the static image with a CSS sweep and an SVG sculpture instead.
5. Page order: Preloader, Nav, Hero, Crypto, Forex (+ IntelligenceHero), SculptureInterlude (new), Markets (re-mounted, which fixes the dead `#markets` nav link), Faculty (LuxuryTeamGallery refactor), MomentsReel (new; the pinned horizontal gallery built from the "moments" tab), Curriculum (12-week timeline), Results (Gallery + Testimonial), MagicRingShowcase, FinalCta, Footer.
6. Fake metrics. Most were already removed in `74ebc1e` (prices, HERO_STATS, ACHIEVEMENT_STATS, results records, cohort dates, team metrics). Still rendered and to be removed: the hardcoded `SPARKLINES` (`components/art/ResultsWall.tsx:14-20`, drawn at `:66-94`) and `EQUITY_CURVE` (`:22-24`, drawn at `:97-138`) charts in the Results section. Kept because they reflect real data: the `FRAME n / 240` HUD (real frame index), the "1920x1080" label (true) and "LIVE WEBGL" (true). Dead code that is not rendered: the prices in `BurjKhalifaReveal.tsx:228-237, 275-281, 353-369`. Copy claims I cannot change, for you to verify: "taught across 14 cohorts" (`lib/content.ts:247`), the placeholder testimonial "Cohort 11" (`content.ts:192`), "Real results from real traders." (`Gallery.tsx:41`) and the seal year "2025" (`CertificateDisplay.tsx:157`).

---

## 1. Global rules for every phase

- Do not edit any user-visible string or `lib/content.ts` text. Moving an existing string to a new place is allowed (stated per phase). Never delete files under `public/` or `components/assets/`.
- Animate only `transform` and `opacity`. No animated `filter`, `width`, `top/left`, `clip-path`, `background-position` or CSS custom properties on `<html>`. Static filters and blurs are fine but must not be animated.
- Every scroll or animation driver subscribes through `lib/frame-loop.ts` (gsap.ticker) or GSAP tweens or ScrollTriggers. No new `requestAnimationFrame`, no `window.addEventListener('scroll')` except the existing reduced-motion fallback in `useFrameSequence.ts:72-75`, and no React setState per scroll or pointer frame.
- `prefers-reduced-motion: reduce`: no Lenis, no 3D, no pins, no parallax, no grain animation, no cursor. Content is shown in its final state.
- Device tier (`lib/device-tier.ts`, Phase 1) gates 3D, grain, cursor and pins.
- Pure logic goes in dependency-free `.ts` files (no `@/` imports, erasable TS only: no `enum`/`namespace`/parameter properties) so `node --test` can import them. Tests go in `tests/*.test.mjs`.
- Each phase must end with `corepack pnpm lint`, `node --test "tests/**/*.test.mjs"` and `corepack pnpm build` all green.

---

## 2. Phase order (safe implementation order)

| Order | Phase | Brief | Depends on |
|---|---|---|---|
| 0 | Setup: deps, scripts, asset derivatives | - | - |
| 1 | Smoothness foundation + fake-metric cleanup | P3 | 0 |
| 2 | Typography + text-reveal system | P4 | 1 |
| 3 | Liquid glass navbar + mobile menu | P2 | 1, 2 |
| 4 | Scroll-effects layer: preloader, palette, grain, leaks, cursor, reveal utils | P5 | 1, 2 |
| 5 | 3D: hero stage, particles, sculpture interlude | P1 | 1, 4 |
| 6 | Sections: Markets, Faculty, MomentsReel, Curriculum, Results, CTA, Footer | P6 (+ P5 pin) | 2, 4 |
| 7 | Frame quality: commands + WebP set wiring | P7 | 1 |

Phases 3, 4 and 7 can run in parallel once Phase 2 is done. Phase 5 and Phase 6 touch different files (Phase 6 never edits `Hero.tsx` or `components/three/*`).

---

## 3. Phase 0: Setup

Files: `package.json`, `pnpm-lock.yaml`, new `scripts/make-derivatives.mjs`, new `public/hero/*`, new `public/textures/grain-256.png`.

1. Install:
   ```
   corepack pnpm add gsap@^3.15.0 @gsap/react@^2.1.2 @react-three/fiber@^9.8.1 @react-three/drei@^10.7.9
   corepack pnpm add -D @types/three@~0.180.0 sharp@^0.35.4
   ```
   `pnpm-workspace.yaml` lists sharp under `ignoredBuiltDependencies`. That is fine because sharp uses the prebuilt `@img/sharp-win32-x64`. Leave the stale `package-lock.json` untouched.
2. `package.json` scripts: add `"test": "node --test \"tests/**/*.test.mjs\""` and `"derivatives": "node scripts/make-derivatives.mjs"`.
3. `scripts/make-derivatives.mjs` (ESM, uses `sharp`, `{ limitInputPixels: false }`). Never overwrite existing files. Skip any output that already exists unless `--force` is passed.
   - From `public/background_image.png` (6688x3764), with lanczos3 resize, write:
     - `public/hero/hero-3200.jpg` (mozjpeg, quality 88). This becomes the `next/image` src, so the optimizer no longer has to chew a 25 MP PNG.
     - `public/hero/hero-2560.webp` (quality 85, effort 6). This is the WebGL texture for the high tier.
     - `public/hero/hero-1600.webp` (quality 82). This is the WebGL texture when DPR is 1 and the viewport is 1600 px or narrower.
   - `public/textures/grain-256.png`: 256x256 grey noise with alpha. Build it from a raw RGBA buffer filled with seeded pseudo-random values (mulberry32, seed 7): RGB = noise, A = 40 + noise*0.25.
   - `public/textures/glow-64.png`: 64x64 radial white-to-transparent disc (premultiplied soft falloff), used for the candle glow sprites.
4. Run `corepack pnpm derivatives` once and commit the generated files. They are new assets; nothing is deleted.

Acceptance: `corepack pnpm build` is green. `node -e "require('gsap');require('@react-three/fiber')"` resolves. The `public/hero/` files exist and `hero-3200.jpg` is under about 1.5 MB.

---

## 4. Phase 1 (P3): Smoothness foundation

### 4.1 `lib/gsap.ts` (new, client)
```ts
'use client';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.config({ ignoreMobileResize: true });
}
export { gsap, ScrollTrigger, SplitText, useGSAP };
```
All other modules import GSAP only from `@/lib/gsap`.

### 4.2 `lib/frame-loop.ts` (rewrite, same public API)
Keep `export type FrameStep = 'update' | 'render'`, `FrameCallback = (timestampMs: number, deltaMs: number) => void` and `onEveryFrame(cb, step): () => void`. Implementation:
- Two module-level `Set<FrameCallback>`: `update` and `render`.
- `install()` runs once: `gsap.ticker.add(master)`. `master(time: number /*s*/, deltaTime: number /*ms*/)` computes `ts = time * 1000`, then for each update cb `cb(ts, deltaTime)`, then for each render cb `cb(ts, deltaTime)`. Iterate over `Array.from(set)` so unsubscribing during iteration is safe.
- Remove the framer-motion import.
- Order guarantee: Lenis (update), then ScrollTrigger (synchronously via `lenis.on('scroll')`), then sequences and R3F (render). This is one rAF for the app. Framer-motion's own loop only wakes for discrete UI animations.

### 4.3 `components/providers/LenisProvider.tsx` (edit)
- Options: `{ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, syncTouch: false, autoRaf: false, anchors: { offset: -80 } }`. Remove `duration`/`easing`, because lerp is frame-rate independent and steadier under continuous wheel input. Remove `touchMultiplier`.
- After construction: `instance.on('scroll', ScrollTrigger.update)`; `const stop = onEveryFrame((t) => instance.raf(t), 'update')`.
- Keep the existing `useReducedMotion` gating and context.
- Also export `getLenis(): Lenis | null` through a module-level variable set in the effect, for non-React code (nav, cursor, particles).

### 4.4 `lib/scroll-store.ts` (new, plain TS, no React)
```ts
export interface ScrollStore { velocity: number; direction: 1 | -1 | 0; heroProgress: number; sculptureProgress: number; mouseX: number; mouseY: number; }
export const scrollStore: ScrollStore = { velocity: 0, direction: 0, heroProgress: 0, sculptureProgress: 0, mouseX: 0, mouseY: 0 };
```
Written by LenisProvider (`instance.on('scroll', l => { scrollStore.velocity = l.velocity; scrollStore.direction = l.direction })`; on the reduced-motion path velocity stays 0) and by a single passive `pointermove` listener installed in `LenisProvider` (`mouseX/Y` in -1..1). Read by 3D and the nav. There is no React state.

### 4.5 `lib/device-tier.ts` (new; pure core + client hook)
- Pure: `export type Tier = 'high' | 'low' | 'static'`; `export function computeTier(i: { reducedMotion: boolean; width: number; coarsePointer: boolean; deviceMemory?: number; cores?: number; saveData?: boolean; webgl2: boolean }): Tier`. Rules: reducedMotion gives `static`; `!webgl2 || width < 768 || coarsePointer || saveData || (deviceMemory !== undefined && deviceMemory < 4) || (cores !== undefined && cores <= 4)` gives `low`; otherwise `high`.
- Put the pure function in `lib/device-tier-core.ts` (testable). `lib/device-tier.ts` ('use client') exports `useDeviceTier(): Tier` via `useSyncExternalStore`, with server snapshot `'static'` (SSR renders the fallback, so there is no hydration mismatch) and client snapshot computed once plus on `matchMedia` changes of `(prefers-reduced-motion: reduce)` and `(max-width: 767px)`. WebGL2 probe: create a canvas once and call `getContext('webgl2')`, then release it with `getExtension('WEBGL_lose_context')?.loseContext()`.
- Test `tests/device-tier.test.mjs`: 6 cases (reduced, mobile width, coarse, low memory, no webgl2, desktop high).

### 4.6 Remove remaining jank sources
1. `lib/theme.ts` and `components/providers/ThemeScrollWrapper.tsx`: delete both files. In `app/page.tsx`, replace `<ThemeScrollWrapper>` with `<div className="relative">`. First grep that nothing else imports them. `--accent` keeps its CSS default.
2. `components/sections/ForexMarketScroll.tsx`:
   - Lines 145-169: replace the `filter` blur/brightness writes with transform/opacity. Add a new `<div ref={doorwayShadeRef} className="absolute inset-0 z-[11] pointer-events-none bg-black" style={{ opacity: 0 }} />` directly after the canvas. For `progress > 0.73`, with `t` as now: `canvas.style.opacity = 1 - t`, `canvas.style.transform = scale(${1 + t * 0.06})`, `shade.style.opacity = min(1, t * 0.9) * (1 - t)` (brightness feel without a filter). Write each through the existing `put()` guard. Delete the `put('filter', ...)` calls.
   - Canvas style (`:235-237`): `willChange: 'transform, opacity'`; remove `translateZ(0)`.
   - HUD bar (`:107`): `put('hudScale', hp.toFixed(3), v => bar.style.transform = \`scaleX(${v})\`)`. The bar element gets `style={{ width: '100%', transform: 'scaleX(0)', transformOrigin: '0 50%' }}`.
3. `components/sections/CryptoMarketScroll.tsx:31-46, 91`: the same scaleX change for `hudProgressRef`.
4. `components/sections/Hero.tsx` (interim; Phase 5 adds the 3D):
   - Remove `useScroll`/`useSpring`/`useTransform` and all `motion.div` orb/shaft/scrim layers driven by `smooth`.
   - Replace them with `components/sections/hero/HeroLightLayers.tsx` (new client): the same 3 orbs and shaft as plain divs **without `filter: blur`**. Softness comes from the radial gradient stops (extend to `transparent 85%`). Positions are set by static `left/top` once; motion uses `transform` only. Keep `mixBlendMode` only on orb 1.
   - One `useGSAP` timeline with `scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true }` animates `xPercent/yPercent/scale/opacity` with the same keyframe values as the old transforms (convert the % deltas). Shaft: `rotate` 105 to 84 via `transform: rotate()` on a wrapper with a fixed gradient angle.
   - Scrim and bottom-fade opacity go in the same timeline. Hero content `y` 0 to -12% goes in the same timeline.
   - Write `scrollStore.heroProgress = self.progress` in `onUpdate`.
   - `<Image src="/hero/hero-3200.jpg" preload fetchPriority="high" ...>`, replacing `src="/background_image.png" priority`. The original PNG stays on disk.
5. `components/MagicRings.jsx`: replace the `requestAnimationFrame(animate)` loop (`:205`, `:248`) with `onEveryFrame` subscribe/unsubscribe inside the existing IntersectionObserver and visibilitychange handlers (`:258-271`). `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` at `:172` (check the current value).
6. `components/art/MagicRingShowcase.tsx`: replace `useScroll/useSpring/useTransform` (`:11-34`) with one `useGSAP` scrubbed timeline using the same value maps (scale, opacity, rotateX, y, aura scale/opacity, medallion y). Remove `filter: blur(45px)` at `:114` (soften the gradient instead). At `:141`, replace `backdrop-blur-2xl` with an opaque `bg-black/85`.
7. `components/sections/LuxuryTeamGallery.tsx:17-23, 184-`: replace the `scrollProgress` state with a ref to the progress-bar element. `onScroll` writes `bar.style.transform = scaleX(p)`, guarded by a changed value. (Phase 6 rewrites this section; the fix keeps Phase 1 standalone.)
8. `components/nav/GlassHeader.tsx` interim fix (Phase 3 replaces it): delete the light glass layer's backdrop-filter (`:68-69`) so only ONE backdrop-filter element exists, and change the dark layer to `blur(16px) saturate(160%)`.

### 4.7 Fake metrics (P3)
- `components/art/ResultsWall.tsx`: delete `SPARKLINES` (`:13-20`) and `EQUITY_CURVE` (`:22-24`), the sparkline `<svg>` inside each tile (`:66-94`), and the whole "Equity curve" block (`:97-138`, including the "Illustrative equity curve" caption and aria-label). This removes the fake metric only; no other copy changes. The tiles keep `PROGRAMME_PILLARS` value/label. The component becomes the 2x2 pillar grid with `h-full` preserved.
- Keep the `FRAME 001 / 240` HUDs: they are driven by the real frame index.

### 4.8 Dev long-task probe
`components/dev/LongTaskProbe.tsx` ('use client'): when `process.env.NODE_ENV !== 'production'` OR `location.search` includes `perf=1`, register `new PerformanceObserver(l => l.getEntries().forEach(e => console.warn('[longtask]', Math.round(e.duration), 'ms')))` with `observe({ type: 'longtask', buffered: true })`. It renders `null`, never draws UI, and is mounted in `app/page.tsx`.

### Acceptance (Phase 1)
- `grep -rn "requestAnimationFrame" components lib` returns only `lib/frame-sequence/engine.ts` if any (the engine uses microtasks, so expect none).
- `grep -rn "useScroll\|useSpring" components lib` returns no scroll-linked hits in Hero, MagicRingShowcase or theme. GlassHeader and TiltFrame may remain until later phases.
- DevTools Performance (desktop, 4x CPU throttle): fast wheel-scroll from top to the Faculty section shows no `[longtask]` warnings over 50 ms after the initial load, no "Recalculate Style" on `html` per frame, and no Layout in frames during the sequences.
- `node --test "tests/**/*.test.mjs"` passes (new device-tier tests), and lint and build are green.

---

## 5. Phase 2 (P4): Typography + reveal system

### 5.1 Fonts, `app/layout.tsx`
```ts
import { Cormorant_Garamond, Manrope } from 'next/font/google';
const display = Cormorant_Garamond({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-display-serif', display: 'swap' }); // variable wght 300-700
const sans = Manrope({ subsets: ['latin'], variable: '--font-sans-body', display: 'swap' }); // variable wght 200-800
```
- Remove `Fraunces`, `Geist` and the `geist` class. `<html className={cn(display.variable, sans.variable)}>`.
- Add inline `<head><script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} /></head>` (used by reveal FOUC guards).
- `app/globals.css`: `--font-display: var(--font-display-serif), 'Cormorant Garamond', Georgia, serif;` and `--font-body: var(--font-sans-body), system-ui, sans-serif;`. Fix the self-referencing `--font-sans: var(--font-sans)` (line 46) to `var(--font-body)` and `--font-heading` to `var(--font-display)`.
- Replace the 4 inline `var(--font-fraunces)` usages (`CryptoMarketScroll.tsx:105`, `ForexMarketScroll.tsx:282, 310, 338`) with `var(--font-display)`. In `IntelligenceHero.module.css:25, 299`, replace `var(--font-manrope)` with `var(--font-body)`.
- Type scale in `globals.css` (fluid, no layout shift):
  ```css
  :root{--fs-hero:clamp(2.75rem,1.2rem+6.2vw,6.5rem);--fs-h2:clamp(2rem,1.1rem+3.6vw,4.25rem);--fs-h3:clamp(1.35rem,1rem+1.2vw,2rem);--fs-body:clamp(1rem,.95rem+.25vw,1.125rem);--fs-label:clamp(.6875rem,.66rem+.1vw,.75rem)}
  .display{font-family:var(--font-display);font-weight:500;letter-spacing:-0.015em;line-height:1.02}
  .label-caps{font-family:var(--font-body);font-weight:600;text-transform:uppercase;letter-spacing:.22em;font-size:var(--fs-label)}
  ```
  Cormorant runs small, so headings switch to the `--fs-*` vars. Hero h1 uses `var(--fs-hero)`, section h2s use `var(--fs-h2)`. Existing "uppercase tracking-widest" label spans get the `label-caps` class.

### 5.2 Reveal components (new, `components/motion/`)
All use `useGSAP` from `@/lib/gsap` with `{ scope: ref }`, wait for `document.fonts.ready` before splitting, and use SplitText `autoSplit: true` + `onSplit(self) { return tween }` so re-wrapping on resize re-creates the animation. Reduced motion: no split, content visible.
1. `RevealText.tsx`: `props { as?: 'h1'|'h2'|'h3'|'p'|'span'; children: React.ReactNode; mode?: 'lines'|'chars'; trigger?: 'intro'|'scroll'; delay?: number; className?: string; style?: React.CSSProperties; id?: string }`.
   - `SplitText.create(el, { type: mode === 'chars' ? 'lines,chars' : 'lines', mask: 'lines', linesClass: 'rt-line', aria: 'auto' })`.
   - Tween: `from(targets, { yPercent: 110, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: mode==='chars' ? 0.018 : 0.09, delay })`.
   - `trigger: 'scroll'` gives `scrollTrigger: { trigger: el, start: 'top 85%', once: true }`. `'intro'` waits for `onIntroDone` (5.3).
   - FOUC guard CSS: `html.js .rt-pending{opacity:0}` plus `@media (prefers-reduced-motion: reduce){html.js .rt-pending{opacity:1}}` plus a failsafe `animation: rt-failsafe 0s 3.5s forwards` that sets opacity 1. The component renders with class `rt-pending` and removes it right after the split is created (same tick as `gsap.set`).
2. `GoldShimmer.tsx`: `<span className="gold-shimmer" data-text={text}>`, where `text` is a string child. Base: `background: linear-gradient(100deg,#B38728,#E8CA65 45%,#B38728); -webkit-background-clip:text; color:transparent`. Three absolutely positioned aria-hidden copies (`.gs-l`, `.gs-c`, `.gs-r`) each with a static narrow white-gold highlight band at 20%/50%/80% and `opacity:0`. A GSAP repeat timeline (`repeat:-1, repeatDelay: 5`) pulses their opacity 0 to 0.9 to 0 in sequence (0.35 s each, overlapping 0.2 s), which reads as a sweep using opacity only. It pauses when off-screen via ScrollTrigger `toggleActions: 'play pause resume pause'`. Reduced motion: no timeline.
3. `FillStatement.tsx`: `props { as, children: string, className, style }`. SplitText `type: 'words'`. For each word element, append an aria-hidden clone `<span class="fs-gold">word</span>` absolutely over it (`color: #D4AF37`, `opacity:0`). Base word colour `rgba(239,231,220,0.28)` on dark, or `rgba(14,15,20,0.25)` when `tone="light"`. Timeline: `to('.fs-gold', { opacity: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true } })`.
4. `lib/intro.ts` (plain TS): `let done=false; const subs=new Set<() => void>(); export function onIntroDone(cb){ if(done){cb();return ()=>{}} subs.add(cb); return ()=>subs.delete(cb) } export function markIntroDone(){ if(done) return; done=true; subs.forEach(f=>f()); subs.clear() }`. Until Phase 4 adds the preloader, `app/page.tsx` mounts `components/motion/IntroAutoStart.tsx`, which calls `markIntroDone()` in an effect.

### 5.3 Apply (copy unchanged)
- `Hero.tsx:265-274`: replace `<TypingHeading text="Education before execution" />` with `<RevealText as="h1" mode="chars" trigger="intro" className="display" style={{fontSize:'var(--fs-hero)', color:'#F3ECE0', textShadow:...}}>Education before <GoldShimmer>execution</GoldShimmer></RevealText>`. The visible text is identical. Keep the `TypingHeading.tsx` file (unused).
- Section h2s use `RevealText mode="lines" trigger="scroll"`: Crypto h2, the three Forex h2s, Faculty h2, Gallery h2, Testimonial quote.
- `FillStatement`: Curriculum h2 ("Twelve weeks. Six modules. One system.") and Markets h2 ("Three markets. One framework."). FinalCta headline `Education before execution.` uses RevealText lines plus GoldShimmer on "execution.".

Acceptance: build is green. The Network panel shows only `/_next/static/media/*.woff2` font requests (no fonts.googleapis.com), with 2 preloaded woff2 in `<head>`. Lighthouse CLS < 0.02. With reduced motion emulated, all headings are visible immediately. SplitText keeps text readable to screen readers (h1 `aria-label` set by `aria:'auto'`).

---

## 6. Phase 3 (P2): Liquid glass navbar

Files: rewrite `components/nav/GlassHeader.tsx`, rewrite `components/nav/MobileMenuSheet.tsx`, new `components/nav/LiquidGlassFilter.tsx`, new `components/nav/nav-math.ts`, edit `components/ui/Button.tsx` (add `liquid` variant), and CSS in `app/globals.css` (`.lg-*` classes). Strings: `NAV_LINKS`, `CTA_PRIMARY`, `BRAND_NAME`, "MASTER OF PIPSOLOGY", and the aria-labels are reused verbatim.

1. Structure: `<header class="lg-wrap fixed top-3 inset-x-0 z-50 flex justify-center pointer-events-none">` contains `<div class="lg-pill pointer-events-auto">`. The pill is an inset floating pill (`max-width: min(1080px, calc(100% - 24px))`, radius 999px).
2. Glass: ONE backdrop layer `.lg-pill::before`: `backdrop-filter: blur(14px) saturate(180%)`; background `linear-gradient(180deg, rgba(255,250,240,.16), rgba(20,18,14,.28))`.
   - Refraction (Chromium only): if `(navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands?.some(b => b.brand === 'Chromium')` (only Chromium renders SVG filters inside backdrop-filter), add class `lg-refract`, which sets `backdrop-filter: url(#lg-refract) blur(10px) saturate(180%)`. Other browsers keep plain blur+saturate.
   - `LiquidGlassFilter.tsx` renders a hidden `<svg width="0" height="0">` with `<filter id="lg-refract" x="0" y="0" width="100%" height="100%"><feImage href={dataUrl} result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="18" xChannelSelector="R" yChannelSelector="G"/></filter>`. `dataUrl` is a 64x64 radial-edge displacement PNG generated once in JS via an OffscreenCanvas: R/G encode normalised offset that is strongest at the edges (lens).
   - Gold specular edge: `.lg-pill::after` 1px border via `mask` composite trick, `background: linear-gradient(120deg, rgba(255,236,190,.9), rgba(212,175,55,.35) 30%, transparent 55%, rgba(212,175,55,.5) 85%)`.
   - Inner glow: `box-shadow: inset 0 1px 0 rgba(255,255,255,.35), inset 0 0 24px rgba(212,175,55,.10), 0 10px 40px rgba(0,0,0,.25)`.
3. Tone: light text on dark sections and dark ink on beige. Use a ScrollTrigger per `[data-nav-tone="dark"]` section (add the attribute to `#forex-sequence`, `#sculpture` and the black wrapper div in `page.tsx`). It toggles class `lg-dark` on the pill (`toggleClass`). Colour changes use CSS `transition: color .4s`, a one-shot discrete toggle rather than per frame.
4. Shrink after hero: `ScrollTrigger.create({ trigger: '#hero', start: 'bottom 80px', onEnter/onLeaveBack })` toggles `lg-compact`. Compact state: `.lg-pill { transform: scale(.94) }`, wordmark span `opacity:0; transform: translateX(-6px)`, transitions on transform and opacity only.
5. Hide/show: in an `onEveryFrame(..., 'render')` callback, read `scrollStore.direction` and `window.scrollY` (cached by Lenis as `lenis.scroll`; reduced-motion falls back to `ScrollTrigger.getScrollFunc(window)()`). Hide when direction is 1 and scroll > hero height; show on -1. Only toggle class `lg-hidden` when the boolean changes. `.lg-hidden { transform: translateY(calc(-100% - 20px)) }`, 0.45 s `cubic-bezier(.16,1,.3,1)`. Never hide while the mobile menu is open or focus is inside the header.
6. Active-section liquid indicator: an absolutely positioned `<span class="lg-indicator">` behind the links (gold-tinted glass blob, `height: 32px`, `width: 1px`, origin left).
   - `nav-math.ts` (pure): `export function indicatorTransform(linkLeft: number, linkWidth: number): { x: number; sx: number }` gives `{ x: linkLeft, sx: linkWidth }`; `export function stretchKeyframes(fromX, fromW, toX, toW)` gives 2 keyframes: first the union span (`x = min`, `sx = max(right) - min(left)`), then the target.
   - Measure link offsets (`offsetLeft/offsetWidth` relative to `ul`) on mount and on `ResizeObserver(ul)` only.
   - Active section: ScrollTrigger per id in `NAV_LINKS` (`#curriculum`, `#markets`, `#team`, `#gallery`), `start: 'top 55%', end: 'bottom 55%'`, `onToggle(self => self.isActive && setActive(i))`, where `setActive` is a ref plus a GSAP timeline with no React state. Animate `x/scaleX` through the 2 stretch keyframes (0.18 s `power2.in`, then 0.42 s `expo.out`) for the liquid squash-and-stretch. Hide (opacity 0) when no section is active.
   - Test `tests/nav-math.test.mjs` (3 cases).
7. Magnetic hover (desktop `(hover:hover) and (pointer:fine)` and not reduced): per link and the CTA, `gsap.quickTo(el, 'x', { duration: .4, ease: 'power3' })` plus the same for y. On `pointermove` within the element bounds plus a 12 px margin, move `(dx*0.25, dy*0.35)`. On `pointerleave`, go back to 0.
8. CTA liquid fill: `Button` `variant="liquid"`. Markup `<a class="btn-liquid"><span class="btn-liquid__fill" aria-hidden/><span class="btn-liquid__label">{children}</span><span class="btn-liquid__label btn-liquid__label--ink" aria-hidden>{children}</span></a>`. The fill is a gold gradient block with an SVG wave top edge (inline `mask-image` data URI), `transform: translateY(102%)` going to `translateY(0)` on hover/focus-visible (0.6 s expo). The two labels crossfade on opacity (gold label to ink label). Use it for the nav CTA and the hero primary CTA (same text).
9. Mobile full-screen glass menu (`MobileMenuSheet.tsx`, keep its props and the `id="mobile-menu"` that the hamburger's `aria-controls` points to):
   - Fixed inset-0 `backdrop-filter: blur(24px) saturate(170%)`, `background: rgba(12,11,9,.72)`, gold hairline top.
   - Links in `display` serif `var(--fs-h2)`, staggered reveal (framer `AnimatePresence` + `listItemVariants`, y 40 to 0 / opacity, stagger 0.06; keep framer here).
   - CTA `liquid` at the bottom. On open: `getLenis()?.stop()`, focus the first link, trap Tab, Esc closes, restore focus to the hamburger. On close: `getLenis()?.start()`.
   - Hamburger morphs to X via transform rotate on the bars.

Acceptance: only one element with backdrop-filter in the header, verified in DevTools Layers. Scroll down past the hero and the pill hides; scroll up and it shows; it shrinks after the hero. The indicator glides between Programme, Markets, Faculty and Results (needs Phase 6 for `#markets`; until then the Markets link stays inactive). Keyboard: Tab order is unchanged and focus-visible rings are present. Mobile at 390 px: the menu opens, the page underneath does not scroll, and Esc/close works. Build is green.

---

## 7. Phase 4 (P5): Scroll-effects layer

New files under `components/fx/`, and edits to `app/page.tsx`, `app/globals.css`, `Hero.tsx` (load registration only), `useFrameSequence.ts` and `engine.ts` (one optional callback).

1. **Real load progress**, `lib/load-progress.ts` (pure TS, tested):
   ```ts
   export function createLoadProgress() { /* tasks: Map<string,{weight:number;done:number}> */ return {
     register(id: string, weight: number): void, update(id: string, fraction: number): void, complete(id: string): void,
     progress(): number /* sum(w*done)/sum(w), 1 when no tasks */, allDone(): boolean, subscribe(fn: (p:number)=>void): () => void } }
   export const loadProgress = createLoadProgress();
   ```
   Tasks:
   - `fonts` (w 0.15): `document.fonts.ready`.
   - `hero-image` (w 0.45): ref to the hero `<Image>` via `onLoad`, then `img.decode()`.
   - `crypto-first-frame` (w 0.15): add an optional `onFrameReady?: (index: number) => void` to `FrameSequenceEngineOptions` (`engine.ts:22`), invoked after a successful decode in the decode `.then`, plus a pass-through `onFrameReady` in `UseFrameSequenceOptions`. Crypto completes the task when index 0 is ready.
   - `hero-3d` (w 0.25): registered only by Phase 5 when tier is high.
   - Tasks register synchronously at module or effect start, before the preloader reads them.
   Test `tests/load-progress.test.mjs`: weights, unknown id ignored, clamp, subscribe/unsubscribe, empty gives 1.
2. **Preloader**, `components/fx/Preloader.tsx` (client, mounted first in `app/page.tsx` so it is SSR-rendered):
   - Fixed inset-0 z-[90], bg `#EFE7DC`.
   - Centred gold monogram: the existing `/main_logo.png` via `next/image` (96 px) inside a thin gold ring (`border:1px solid rgba(212,175,55,.6)`), with a 160 px gold hairline below. The hairline `transform: scaleX(p)` follows `loadProgress` (lerped in an `onEveryFrame` callback toward the real value, 0.15 per frame, write guarded). No numbers.
   - Exit when `allDone()` or 3.2 s max (min display 0.6 s): logo `scale .92 / opacity 0`, then the panel `yPercent: -100` (0.9 s `expo.inOut`), then `markIntroDone()` and unmount.
   - Skip conditions: `sessionStorage.getItem('mop-intro')==='1'` or reduced motion. In those cases fade out in 0.25 s as soon as `hero-image` is done (max 1.2 s). Set the session flag on exit.
   - CSS failsafe: `.preloader{animation:pl-failsafe 0s 5s forwards}`, `@keyframes pl-failsafe{to{visibility:hidden;opacity:0}}`.
   - Remove `IntroAutoStart` from `page.tsx`.
3. **Palette backdrop**, `components/fx/PaletteBackdrop.tsx`:
   - Fixed inset-0, z-index -1, aria-hidden. Three layers: `.pb-beige` (`#EFE7DC`, always opacity 1), `.pb-dark` (`#08080A`), `.pb-gold` (`radial-gradient(ellipse 70% 55% at 50% 55%, rgba(212,175,55,.55), rgba(140,100,30,.25) 45%, transparent 75%)` over transparent).
   - One `useGSAP` with ScrollTriggers (scrub true): `.pb-dark` opacity 0 to 1 over `#forex-sequence` `start:'60% bottom'` to `end:'bottom bottom'`; `.pb-gold` opacity 0 to 1 over `#sculpture` `top bottom` to `center center`, then 1 to 0 from `center center` to `bottom top`.
   - In `app/page.tsx`, remove `backgroundColor: 'var(--bg)'` from `<main>` (line 29) and `bg-[#08080A]` from the black wrapper, which becomes transparent over `.pb-dark` (keep `text-[#F5EFEB]`). Body keeps `background-color: var(--bg)` as a no-JS fallback.
4. **Film grain**, `components/fx/Grain.tsx`: fixed `inset:-50%`, z-[60], pointer-events none, `background: url(/textures/grain-256.png)`, `opacity:.06`, CSS `animation: grain 0.8s steps(6) infinite` with keyframes of 6 `translate3d` offsets (transform only). Render only when tier is `high`. Reduced motion: none. No mix-blend-mode.
5. **Gold light leaks**, `components/fx/LightLeak.tsx`: `props { className?: string; from?: 'left'|'right'; intensity?: number }`. An absolutely positioned 60vmax circle `radial-gradient(circle, rgba(255,214,140,.35), rgba(212,175,55,.12) 40%, transparent 70%)`, `mix-blend-mode: screen`, no filter. A scrubbed ScrollTrigger on its parent animates `xPercent -20 to 20`, `opacity 0 to intensity to 0`. Mount at: the hero bottom edge, `#sculpture`, the top of `#team`, and `#cta`. Hidden on `static` tier.
6. **Custom cursor**, `components/fx/Cursor.tsx`: only when `matchMedia('(hover:hover) and (pointer:fine)')` and tier `high`.
   - Ring 36 px (1px gold border) and dot 6 px. `gsap.quickTo` x/y (ring 0.35 s `power3`, dot 0.08 s).
   - Delegated `pointerover` on `document` for `a, button, [data-cursor]` toggles class `is-hover` (ring `scale(1.6)`, dot `opacity 0`).
   - `pointerdown` scales to 0.85. Hide on `pointerleave` of document.
   - Add class `has-cursor` on `<html>` with `html.has-cursor, html.has-cursor a, html.has-cursor button { cursor: none }`, but keep the native cursor for `input, textarea, [contenteditable]`. z-[95].
7. **Reveal utilities**, `components/fx/CurtainImage.tsx`: the clip-path-style reveal done with transforms. Outer `overflow:hidden` wrapper gets `yPercent: 100 to 0`, inner gets `yPercent: -100 to 0` plus image `scale 1.15 to 1`, `expo.out` 1.3 s, ScrollTrigger `start: 'top 85%', once`. Props `{ children; className?; delay? }`. Parallax helper `components/fx/Parallax.tsx`: `props { speed: number /* -0.3..0.3 */ }` with scrubbed `yPercent: speed*100` (transform). Both are no-ops on `static`.
8. Mount in `app/page.tsx`: `<Preloader/>`, `<PaletteBackdrop/>`, `<Grain/>`, `<Cursor/>`, `<LongTaskProbe/>`. Keep them out of `layout.tsx` so `/intelligence` is unaffected.

Acceptance: hard reload with "Slow 4G" throttling and the hairline advances in steps tied to real events (log `loadProgress.progress()`); a second load in the same tab skips the intro. With JS disabled the preloader disappears by 5 s. Lighthouse LCP is still the hero image and LCP < 2.5 s desktop. No animated filter/clip-path in the Performance panel. Cursor is absent on touch emulation. Tests and build are green.

---

## 8. Phase 5 (P1): 3D

### 8.1 Shared 3D infrastructure (`components/three/`)
- `ClockBridge.tsx`: inside `<Canvas frameloop="never">`. `const advance = useThree(s => s.advance)`. Props `{ active: boolean }`. When active, `onEveryFrame((ts) => advance(ts), 'render')`; unsubscribe when inactive or unmounted. Confirm the `advance(timestamp: number, runGlobalEffects?: boolean)` signature and its ms unit in `node_modules/@react-three/fiber/dist/declarations/src/core/*.d.ts` after install; if it expects seconds, pass `ts / 1000`.
- `useInViewActive(ref, rootMargin='100px'): boolean`: IntersectionObserver wrapper with state that toggles on enter/leave only (rare).
- `StageCanvas.tsx`: common `<Canvas>` wrapper: `dpr={[1, Math.min(2, window.devicePixelRatio)]}`, `gl={{ antialias: dpr < 1.5, alpha: <prop>, powerPreference: 'high-performance', stencil: false }}`, `onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; gl.transmissionResolutionScale = 0.5 }}`. Include drei `<PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(Math.min(2, devicePixelRatio))}>`, with dpr state held in a ref plus `useThree(s => s.setDpr)`.
- `GoldEnvironment.tsx`: drei `<Environment resolution={256} frames={1}>` with 4 `<Lightformer>`: a warm key rect `#fff1d6` intensity 3 at [-4,3,4]; a gold strip `#d4af37` intensity 2 at [4,1,2], rotated; a soft ring `#ffffff` intensity 1 overhead; a dark floor. No HDR file download (decision D7).
- `GoldDust.tsx`: `props { count: number; area: [number, number, number]; size?: number; color?: string }`. `THREE.Points` + `ShaderMaterial` (`transparent`, `depthWrite:false`, `AdditiveBlending`). Attributes `position` (seeded mulberry32 within the area), `aSeed` (0..1).
  - Uniforms: `uTime`, `uVel` (smoothed `scrollStore.velocity`, clamp ±60, lerp 0.08), `uMouse` (vec2 world-projected from `scrollStore.mouseX/Y`), `uPixelRatio`, `uSize`, `uColor`.
  - Vertex: vertical drift wrap `p.y = mod(p.y + uTime*0.04*(0.5+aSeed) + uVel*0.002, area.y) - area.y*.5`; sway `sin(uTime*0.6 + aSeed*6.283)*0.04`; mouse repulsion in view space radius 1.2, push 0.35; `gl_PointSize = uSize * uPixelRatio * (1.0 + abs(uVel)*0.01) * (20.0 / -mvPosition.z)`.
  - Fragment: soft disc `smoothstep(.5, 0., length(gl_PointCoord-.5))`, alpha 0.7*twinkle.
  - `useFrame` only updates 3 uniforms. Counts: hero 500, sculpture 900.
- Pure `lib/three/prng.ts`: `mulberry32(seed: number): () => number`.

### 8.2 Hero stage, `components/three/hero/HeroStage.tsx` (default export)
Mounted from `Hero.tsx` via `const HeroStage = dynamic(() => import('@/components/three/hero/HeroStage'), { ssr: false })`, rendered only when `useDeviceTier() === 'high'`. Wrapper `<div className="absolute inset-0 z-[1]" style={{ opacity: 0 }}>` sits above the `<Image>` and below the content. After the first rendered frame (`onCreated` plus one `advance`) and texture load, `gsap.to(wrapper, { opacity: 1, duration: 0.8 })` and `loadProgress.complete('hero-3d')`. Register `hero-3d` (w 0.25) in `Hero.tsx` when tier is high, before the dynamic import resolves. The DOM image stays underneath as the LCP element and fallback. `HeroLightLayers` (Phase 1) is hidden when the stage is visible (set its wrapper opacity 0 in the same tween).

Scene (camera `fov 30`, position `[0,0,10]`):
1. `BackgroundPlane.tsx`: a plane sized to fill the frustum at z=0 (`h = 2*10*tan(15deg)`, `w = h*aspect`), recomputed on `size` change.
   - `ShaderMaterial` with `toneMapped:false`. Texture `useTexture(dpr>1.25 || width>1600 ? '/hero/hero-2560.webp' : '/hero/hero-1600.webp')`, `colorSpace = SRGBColorSpace`, `generateMipmaps = true`, `minFilter = LinearMipmapLinearFilter`, `anisotropy = 4`.
   - Uniforms: `uMap`, `uImgAspect = 6688/3764`, `uViewAspect`, `uFocus = vec2(0.65, 0.5)` (matches `objectPosition: '65% center'`), `uProgress` (= `scrollStore.heroProgress`), `uMouse`, `uTime`, `uPanelRect = vec4(0.531, 0.296, 0.923, 0.830)` (u0, v0-top, u1, v1 in image UV, top-left origin), `uPanelRadius = 0.012`, `uArch = vec4(0.871, 0.489, 0.188, 0.133)` (centre u, centre v, outer R and inner R in u-units; v scaled by image aspect), `uDebug`.
   - Fragment:
     a. Cover-UV with focus, so it matches the DOM `object-fit: cover` exactly.
     b. `archMask = smoothstep(Ro+e, Ro-e, d) * smoothstep(Ri-e, Ri+e, d) * step(cy - v_up, 0.)` with feather e=0.01, upper half only. Also `rockMask` = a soft box at u > 0.52, v > 0.80.
     c. Parallax: `uv += (uMouse*0.006 + vec2(0., uProgress*0.015)) * (archMask*1.0 + rockMask*0.6)`. Base wall gets `uv += uMouse*0.002`.
     d. Clean plate: `pm = roundedRectMask(uvImg, uPanelRect, uPanelRadius, feather 0.006)`, then `col = mix(col, textureLod(uMap, uvImg, 6.5).rgb * 1.02, pm)` (WebGL2 `textureLod` in GLSL3; set `glslVersion: THREE.GLSL3`). This erases the baked panel so the 3D one replaces it.
     e. Light sweep: `t = fract(uTime*0.045) * 1.6 - 0.3 + uProgress*0.5`, `band = exp(-pow((uvImg.x*0.8 + uvImg.y*0.6 - t) * 9., 2.))`, `col += vec3(1.0, .84, .55) * band * 0.32 * (archMask + rockMask*0.4)`.
     f. `uDebug` (from `?heroDebug=1`) tints archMask red and pm blue, for tuning the 6 constants against the photo. Values are measured from a 1200 px proof; adjust within ±0.01.
2. `GlassPanel.tsx`: world rect computed from `uPanelRect` through the same cover mapping (export a pure `imageUvToWorld(u, v, viewW, viewH, imgAspect, focus)` from `lib/three/cover-math.ts`, which is tested).
   - Mesh: drei `<RoundedBox args={[w, h, 0.06]} radius={0.04} smoothness={4}>` with `<meshPhysicalMaterial transmission={1} thickness={0.35} roughness={0.16} ior={1.45} clearcoat={1} clearcoatRoughness={0.08} attenuationColor="#f3e6cf" attenuationDistance={2.5} color="#fffaf0" envMapIntensity={1.2} specularIntensity={1} />`.
   - Gold frame: `ExtrudeGeometry` of a rounded-rect `Shape` minus an inner hole (inset 0.025), depth 0.03, bevel 0.006, `meshStandardMaterial color="#d4af37" metalness={1} roughness={0.22}`.
   - Group anchored at the panel centre, z=0.04.
   - Motion in `useFrame`, reading `p = scrollStore.heroProgress` eased by `damp` from `lib/frame-sequence/math.ts`, rate 8: `position.z = 0.04 + 2.1*p`, `position.y = c.y + 0.35*p + sin(t*0.6)*0.03*(1-p)`, `rotation.x = -0.16*p + mouseY*0.05`, `rotation.y = 0.30*p + mouseX*0.07`.
3. `Candles.tsx`: a fixed authored array `CANDLES: readonly [open, close, high, low][]` of 36 entries in `lib/three/hero-candles.ts`, hand-shaped to mirror the baked uptrend. This is art, not data, unlabelled and not random (decision D9).
   - Two `InstancedMesh` objects (bodies BoxGeometry, wicks thin Box), laid out inside the panel's inner rect at z=0.035 (inside the glass), with green/red tones desaturated toward cream: up `#9fbf9a`, down `#d9978a`.
   - Growth `g = clamp01(intro*0.4 + p*1.4)`, where `intro` is tweened 0 to 1 over 1.6 s `expo.out` on `onIntroDone`. Per instance `scaleY = easeOutExpo(clamp01(g*1.25 - i/36*0.25))`.
   - Gold glow: a third `InstancedMesh` of planes with `/textures/glow-64.png`, `AdditiveBlending`, colour `#ffcf6b`, opacity `0.55*g`, scaled to each body.
   - Matrices are recomputed only when `g` changes by more than 1e-3.
4. `GoldDust count={500} area={[14, 8, 4]}` in front of the plane.
5. Camera in `useFrame`: `position.z = 10 - 1.4*p`, `position.y = -0.3*p`, `lookAt(panelCentre.x*0.3*p, 0, 0)`.
6. `ClockBridge active={inView && document.visibilityState === 'visible'}`; `inView` comes from `useInViewActive(heroRef)`.

Low tier: unchanged DOM hero (Phase 1 light layers) plus `components/sections/hero/HeroSweep.tsx`, a CSS diagonal gold band (`transform: translateX(-120%)` to `translateX(120%)`, 2.4 s on intro, then every 9 s, opacity 0.25) clipped by the hero `overflow:hidden`. Static tier: image only.

### 8.3 Sculpture interlude (wow object)
- `components/sections/SculptureInterlude.tsx` ('use client'): `<section id="sculpture" data-nav-tone="dark" aria-hidden="true" className="relative" style={{ height: tier==='high' ? '260vh' : '140vh' }}>` with `<div className="sticky top-0 h-[100dvh] overflow-hidden">`. It contains no text. Insert it in `app/page.tsx` between `<ForexMarketScroll />` and the black wrapper.
- ScrollTrigger `{ trigger: section, start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: s => scrollStore.sculptureProgress = s.progress }`.
- High tier: `dynamic(() => import('@/components/three/sculpture/SculptureStage'), { ssr: false })` with transparent canvas (`alpha: true`) over the PaletteBackdrop gold glow, plus `<LightLeak />`.
- `lib/three/sculpture-layout.ts` (pure, tested):
  ```ts
  export interface SculptureLayout { count: number; start: Float32Array; target: Float32Array; scatter: Float32Array; delay: Float32Array; rot: Float32Array }
  export const SCULPTURE_HEIGHTS: readonly number[] = [1.1, 1.6, 1.3, 2.1, 1.8, 2.6, 3.0];
  export function buildSculpture(count: number, seed: number): SculptureLayout;
  ```
  - Targets: 7 candle bodies (width 0.42, depth 0.42, spacing 0.7, x centred, bottom at y = -1.5), each with a wick (height 0.35*h above and below). Distribute `count` points over body surfaces proportional to area (85%) and wicks (15%) on a jittered grid (seeded).
  - Start: a seeded sphere shell, radius 5-7. Scatter: `target + normalize(target - centroid) * (3 + rnd*4) + (0, 1.5 + rnd*2, 0)`.
  - Delay: `(x - minX)/(maxX - minX)` (left to right assembly). Rot: random Euler triples.
  - Tests: `count` honoured, deterministic for the same seed, all targets within the bounds box, delay in [0,1].
- `components/three/sculpture/SculptureStage.tsx`:
  - `InstancedMesh(BoxGeometry(1,1,1), MeshStandardMaterial({ color:'#d4af37', metalness:1, roughness:0.28, envMapIntensity:1.4 }), 1400)` with `instanceMatrix.setUsage(DynamicDrawUsage)`; instance scale 0.055.
  - Per frame, if `|p - lastP| > 1e-4`: `a = smoothstep(0, .42, p - delay*.15)`, `d = smoothstep(.62, 1, p - delay*.1)`; `pos = mix(mix(start, target, easeOutCubic(a)), scatter, easeInCubic(d))`; rotation `slerp(rand, identity, a)`; scale `0.055*(1 - 0.6*d)`. Compose into the matrix and set `needsUpdate`.
  - Group `rotation.y = p*0.9 + t*0.05`.
  - Sweep light: `spotLight` colour `#ffd58a` intensity 40, angle 0.5, position x from -6 to 6 across p 0.3-0.7.
  - Camera orbit: radius `9 - 2*smoothstep(0,.5,p)`, angle `-0.5 + p*1.0` rad, y `1.2 - 0.8*p`, `lookAt(0,0.2,0)`.
  - `GoldEnvironment`, `GoldDust count={900} area={[16,10,8]}`, `ClockBridge active={inView}`.
- Low/static tier: `components/sections/SculptureFallback.tsx` is an inline SVG of 7 gold candlesticks (linear gradient `#8c6d23` to `#f5d77f` to `#b38728`, heights matching `SCULPTURE_HEIGHTS`). Low tier: each `<g>` animates `y 60 to 0 / opacity 0 to 1` with stagger (scrubbed 0-0.5), then `opacity 1 to 0, y 0 to -40` (0.6-1). Static tier: shown assembled, no animation.

Acceptance: desktop Chrome with the hero visible holds 60 fps (Performance panel shows frames under 16.7 ms with 4x throttle off and under 33 ms with 4x on). When the hero is scrolled out, the GPU is idle (no "GPU" activity in the Performance panel while in the Crypto section). Only two WebGL contexts ever exist simultaneously (hero plus sculpture), while MagicRings is off-screen. `?heroDebug=1` masks line up with the photo. At 390 px width and in reduced motion, no `three` chunk is requested (Network panel, filter "three"). Seamless crossfade: no visible jump between the DOM image and the canvas plane at scroll 0. `tests/` pass (sculpture-layout, cover-math, prng), and lint and build are green.

---

## 9. Phase 6 (P6): Sections

Final `app/page.tsx` order (strings unchanged):
```
<Preloader/><PaletteBackdrop/><Grain/><Cursor/><LongTaskProbe/>
<GlassHeader/>
<div className="relative"><main id="main-content">
  skip link · <Hero/> · <CryptoMarketScroll/> · <ForexMarketScroll/> · <SculptureInterlude/>
  <div className="theme-black-section relative w-full text-[#F5EFEB]" data-nav-tone="dark">
    <Markets/> · <LuxuryTeamGallery/> (Faculty, id="team") · <MomentsReel/> · <Curriculum/> ·
    <Gallery/> (Results, id="gallery") · <Testimonial/> · <MagicRingShowcase/> · <FinalCta/> · <Footer/>
  </div>
</main></div>
```
Markets moves into the dark wrapper, so its colours come from the `.theme-black-section` vars.

1. **Markets** (`components/sections/Markets.tsx`): 3D tilt glass cards.
   - Grid `md:grid-cols-3 gap-6`, container `style={{ perspective: '1200px' }}`.
   - Card: `transform-style: preserve-3d`, glass `background: linear-gradient(160deg, rgba(255,255,255,.06), rgba(255,255,255,.02))`, 1px gold hairline border `rgba(212,175,55,.28)`, static `backdrop-filter: blur(12px)` (over a static backdrop, fine), radius 24.
   - Content per card: `market.kicker` (label-caps), `market.heading` (display, `--fs-h3`), `market.body`, `market.tags` chips.
   - Tilt: desktop fine pointer only. `gsap.quickTo` on `rotateX/rotateY` (±8deg) from pointer position, plus a glare `<span>` (radial white) moving via `x/y` transform and opacity 0 to .35. Inner content at `translateZ(30px)`.
   - Remove `useState` hover and `AnimatePresence`. Entry: CurtainImage-style stagger `y 40 / opacity` (ScrollTrigger once). The h2 is a `FillStatement`.
2. **Faculty** (`components/sections/LuxuryTeamGallery.tsx`, keep `id="team"`, export name and header copy):
   - Remove the tabs and slider controls. "Faculty Leadership" stays as a `label-caps` eyebrow above the grid. "Trading Floor & Moments" moves to MomentsReel as its eyebrow.
   - Editorial grid (`lg:grid-cols-12`): member 1 spans `col-span-5 row-span-2` (portrait 4:5); members 2-5 alternate `col-span-3/4` with aspect 3:4 and 1:1 and a vertical offset `lg:mt-24` on even cards (asymmetric magazine layout). Mobile: 1 column.
   - Hover focus: CSS only, `.faculty-grid:has(.fc:hover) .fc:not(:hover){opacity:.35} .fc:hover .fc-img{transform:scale(1.04)}`, transitions on opacity and transform 0.5 s.
   - Card shows image, name, title and pedigree (existing fields/strings).
   - Shared-element detail view: keep framer. Card image wrapper `<motion.div layoutId={\`fac-${member.id}\`}>`, and the modal's image uses the same `layoutId` inside the existing `AnimatePresence` modal. Keep the existing modal content strings. Modal: `role="dialog" aria-modal`, focus trap, Esc, `getLenis()?.stop()/start()`.
   - Delete `CreativeFacultyCard` springs (`:346-348`); tilt is not needed in the editorial layout. Card images use `<CurtainImage>`.
3. **MomentsReel** (new `components/sections/MomentsReel.tsx`, `id="moments"`): the creative gallery concept "Atelier film strip" (decision D11). Data is `GALLERY_MOMENTS` (tag, title, subtitle, image unchanged).
   - High tier, desktop: section pinned (`ScrollTrigger pin: true, scrub: true, end: () => '+=' + (track.scrollWidth - innerWidth)`, `invalidateOnRefresh: true`), with the track animated `x: () => -(track.scrollWidth - innerWidth)` and `ease: 'none'`. Panels are 62vw x 70vh. Per panel (via `containerAnimation`), the inner image `xPercent: -12 to 12` (parallax), caption lines reveal, and a gold hairline `scaleX 0 to 1`.
   - Panel frame: thin gold hairline plus film-strip sprocket dots (CSS repeating-radial-gradient, static).
   - Low tier: no pin. Native `overflow-x:auto; scroll-snap-type:x mandatory` carousel with panels at 85vw (the existing `MomentsReel` markup with a different class).
   - Static tier: vertical stack.
4. **Curriculum** (`components/sections/Curriculum.tsx`, becomes `'use client'`, keep `id="curriculum"` and strings): 12-week timeline.
   - Layout: a left rail (`md:` 120 px column) with a 1px track `rgba(212,175,55,.18)` and an overlaid gold line `<span class="tl-line">` (`transform-origin: top; transform: scaleY(0)`), scrubbed `scaleY 0 to 1` over the `<ol>` from `top 70%` to `bottom 70%`.
   - 12 week nodes positioned at `i/11` along the rail. Each node is a dot plus the numeral `01`...`12` (aria-hidden, decorative; it repeats the "Twelve weeks" fact). A node's gold layer opacity goes 0 to 1 when the line passes: one ScrollTrigger `onUpdate` computes `activeCount = floor(progress*12)`, and the class toggles only when the value changes.
   - Each chapter `li` is anchored to its weeks via pure `lib/curriculum-math.ts` `export function weeksForChapter(index: number, chapters = 6, weeks = 12): [number, number]`, which returns `[2i+1, 2i+2]` and is used for the `aria-hidden` week range text on the chapter (e.g. "01 - 02"). This adds numerals only, no words. Test it.
   - Chapter entries reveal (`y 30 / opacity`, once).
5. **Results** = `Gallery.tsx` (keep id, label "Results", h2) + `Testimonial.tsx`:
   - Gallery: `TiltFrame` springs become `gsap.quickTo` (rotateX/Y ±6, sheen `x`). Remove `useSpring`/`useState` hover. ResultsWall is already cleaned in Phase 1.
   - Testimonial: big serif. The quote is `RevealText as="h2" mode="lines"` in Cormorant italic `clamp(1.9rem, 1rem + 3vw, 3.6rem)`, line-height 1.12, max-width 22ch per line. Gold hairline above (scaleX reveal). Name/role/cohort in `label-caps`. Remove `filter: blur(30px)` (`:38`) and soften the gradient instead. The card background becomes transparent on dark with a 1px gold-alpha border.
6. **FinalCta** (`FinalCta.tsx`): gold hairlines (`<Hairline variant="gold" />`: 1px `linear-gradient(90deg, transparent, #D4AF37 50%, transparent)`, scaleX 0 to 1 on enter) above and below. Primary button `variant="liquid"`, secondary outline with magnetic hover. Remove `filter: blur(50px)` (`:25`). Add `<LightLeak/>`.
7. **Footer**: gold hairlines between the columns block and the disclaimer (`Hairline variant="gold"`), column headings `label-caps` in `#D4AF37`, links in muted ivory with a hover underline `scaleX` (pseudo-element, transform-origin left). No copy change.
8. `components/ui/Hairline.tsx`: add `variant?: 'default' | 'gold'` (default unchanged).
9. **MagicRingShowcase**: unchanged beyond Phase 1.

Acceptance: all 4 nav links resolve and highlight (Programme, Markets, Faculty, Results). The horizontal pin releases cleanly into Curriculum, with no jump after a resize (`invalidateOnRefresh`). Faculty modal open/close morphs the portrait (shared element) and focus returns to the card. Curriculum line draws continuously with scroll and nodes light in order. In reduced motion everything is visible and static, with no pin. `diff` of visible strings: run `git diff 74ebc1e -- lib/content.ts` and it shows no text edits from this phase. Tests (curriculum-math) and build are green.

---

## 10. Phase 7 (P7): Frame quality

### 10.1 Facts
Current frames: `public/assets/{crypto,forex,stock_market,opportunity}/ezgif-frame-001..240.jpg`, 1920x1080 baseline JPEG, about 35 KB median. This is a low-quality ezgif export with visible blocking and banding in the beige gradients. The best fix is re-extracting from the source videos (not in the repo). Section B works from the existing JPEGs if the videos are lost. All outputs go to NEW folders under `D:\mop-frames` (or any path) and then `public\assets-hq\...`. Originals are never touched.

### 10.2 Tools (Windows)
Install, e.g. with Scoop (`scoop install ffmpeg libwebp libavif`) or the official release zips. Get `realesrgan-ncnn-vulkan` from the github.com/xinntao/Real-ESRGAN releases (zip includes models) and `rife-ncnn-vulkan` from github.com/nihui/rife-ncnn-vulkan releases. Verify with `ffmpeg -version`, `cwebp -version`, `avifenc --version`, `realesrgan-ncnn-vulkan.exe -h`, `rife-ncnn-vulkan.exe -h`. Topaz Video AI is a GUI alternative to steps 2-3 (Proteus/Iris model, 1x or 2x, export PNG sequence).

### 10.3 Commands (PowerShell)
```powershell
$names = 'crypto','forex','stock_market','opportunity'
$root  = 'D:\mop-frames'                          # scratch workspace, NOT inside public\
New-Item -ItemType Directory -Force "$root" | Out-Null

# A) Re-extract from source video at full quality (exactly 240 frames, lossless PNG masters)
#    Put source videos at $root\src\<name>.mp4
foreach ($n in $names) {
  $src = "$root\src\$n.mp4"; $out = "$root\01-master\$n"; New-Item -ItemType Directory -Force $out | Out-Null
  $dur = [double](ffprobe -v error -show_entries format=duration -of csv=p=0 $src)
  $fps = 240 / $dur
  ffmpeg -hide_banner -i $src -vf "fps=$fps,scale=1920:1080:flags=lanczos+accurate_rnd+full_chroma_int,format=rgb24" `
    -frames:v 240 -start_number 1 "$out\frame-%03d.png"
}

# B) If no source video: clean the existing JPEGs (deblock + denoise + deband) to PNG masters
foreach ($n in $names) {
  $out = "$root\01-master\$n"; New-Item -ItemType Directory -Force $out | Out-Null
  ffmpeg -hide_banner -start_number 1 -i "public\assets\$n\ezgif-frame-%03d.jpg" `
    -vf "deblock=filter=strong:block=8,hqdn3d=1.2:1.2:4:4,deband=1thr=0.015:2thr=0.015:3thr=0.015:range=18:blur=1,format=rgb24" `
    -start_number 1 "$out\frame-%03d.png"
}

# (A only) light denoise/deband on the masters, if the source itself is noisy
foreach ($n in $names) {
  $in = "$root\01-master\$n"; $out = "$root\02-clean\$n"; New-Item -ItemType Directory -Force $out | Out-Null
  ffmpeg -hide_banner -start_number 1 -i "$in\frame-%03d.png" `
    -vf "hqdn3d=1.0:1.0:3:3,deband=1thr=0.012:2thr=0.012:3thr=0.012:range=16:blur=1" -start_number 1 "$out\frame-%03d.png"
}
# If you skipped this step, use 01-master as the input of the next step.

# C) AI upscale (Real-ESRGAN) then supersample back to 1920 -> recovers detail, removes JPEG mush
#    x2 CG-friendly model (fast):
foreach ($n in $names) {
  $in = "$root\02-clean\$n"; $out = "$root\03-x2\$n"; New-Item -ItemType Directory -Force $out | Out-Null
  realesrgan-ncnn-vulkan.exe -i $in -o $out -n realesr-animevideov3 -s 2 -f png -t 256 -j 2:2:2
}
#    Higher quality photoreal option (x4 only; ~60 MB per PNG, ~15 GB per 240 frames):
#    realesrgan-ncnn-vulkan.exe -i $in -o "$root\03-x4\$n" -n realesrgan-x4plus -s 4 -f png -t 200

# D) Optional: RIFE 2x interpolation (240 -> 480 frames). Only if you also change the frame
#    counts in code (see 10.4); doubles download + memory.
foreach ($n in $names) {
  $in = "$root\03-x2\$n"; $out = "$root\04-rife\$n"; New-Item -ItemType Directory -Force $out | Out-Null
  rife-ncnn-vulkan.exe -i $in -o $out -m rife-v4.6 -n 480 -f "frame-%03d.png"
}

# E) Encode delivery sets: 1920x1080 and 1080x608, WebP q82 (primary) and AVIF q80 (optional)
$enc = "$root\03-x2"          # or 04-rife if you interpolated
foreach ($n in $names) {
  foreach ($w in 1920,1080) {
    $h = [int]([math]::Round($w * 9 / 16 / 2) * 2)   # 1080 or 608
    $pngTmp = "$root\05-sized\$n\$w"; New-Item -ItemType Directory -Force $pngTmp | Out-Null
    ffmpeg -hide_banner -start_number 1 -i "$enc\$n\frame-%03d.png" -vf "scale=${w}:${h}:flags=lanczos" -start_number 1 "$pngTmp\frame-%03d.png"
    $webp = "public\assets-hq\$n\$w"; New-Item -ItemType Directory -Force $webp | Out-Null
    Get-ChildItem "$pngTmp\*.png" | ForEach-Object {
      cwebp -quiet -q 82 -m 6 -sharp_yuv -af -mt $_.FullName -o (Join-Path $webp ($_.BaseName + '.webp'))
    }
    $avif = "public\assets-hq-avif\$n\$w"; New-Item -ItemType Directory -Force $avif | Out-Null
    Get-ChildItem "$pngTmp\*.png" | ForEach-Object {
      avifenc -q 80 -s 6 -j all -d 8 -y 420 $_.FullName (Join-Path $avif ($_.BaseName + '.avif')) | Out-Null
    }
  }
}
# Check: each public\assets-hq\<name>\1920 has 240 files, typical size 40-90 KB.
(Get-ChildItem public\assets-hq\crypto\1920\*.webp).Count
```
If the x4 path was used, step E's `scale=` already downsamples from 7680 px; nothing else changes.

### 10.4 Code wiring (coder, safe while the assets do not exist yet)
- New `lib/frame-sequence/sources.ts` (pure):
  ```ts
  export type FrameFormat = 'jpg' | 'webp';
  export const FRAME_FORMAT: FrameFormat = 'jpg'; // flip to 'webp' after running 10.3 E
  export type FrameSet = 1920 | 1080;
  export function pickFrameSet(backingW: number, backingH: number, saveData: boolean): FrameSet; // 1080 if saveData || (backingW <= 1250 && backingH <= 700), else 1920
  export function frameUrl(folder: 'crypto'|'forex'|'stock_market'|'opportunity', index0: number, format: FrameFormat, set: FrameSet): string;
  // jpg -> /assets/<folder>/ezgif-frame-NNN.jpg ; webp -> /assets-hq/<folder>/<set>/frame-NNN.webp
  ```
  Portrait phones need about 1688 px of source height for cover. Both sets are upscaled there, and the 1080 set would look soft, so the rule only drops to 1080 for small landscape canvases or Save-Data (decision D12).
- `CryptoMarketScroll.tsx:9-12` and `ForexMarketScroll.tsx:17-20` build `src` through `frameUrl(...)`. Set selection happens once at mount, using `computeBackingSize` from `math.ts` with the sticky size and `navigator.connection?.saveData`. Frame counts stay 240. If RIFE (480) is adopted later, change `TOTAL_FRAMES`/`*_FRAMES` constants and `PINNED` last-index values.
- Tests: `tests/frame-sources.test.mjs` covers pickFrameSet (4 cases) and frameUrl (jpg/webp padding).

Acceptance: with `FRAME_FORMAT='jpg'` behaviour is identical (build green). After generating assets and flipping to `'webp'`, the Network panel shows `/assets-hq/.../1920/frame-001.webp`, and a visual check of crypto frame 120 shows no blocking in the sky gradient.

---

## 11. Verification commands (every phase)
```
corepack pnpm lint
node --test "tests/**/*.test.mjs"
corepack pnpm build
corepack pnpm start            # then open http://localhost:3000
npx lighthouse http://localhost:3000 --preset=desktop --only-categories=performance,accessibility --view
npx lighthouse http://localhost:3000 --form-factor=mobile --only-categories=performance --view
```
Manual perf protocol: Chrome DevTools Performance, CPU 4x, record a fast wheel fling from top to footer and back. Targets: no task over 50 ms after load (also check console `[longtask]` with `?perf=1`), no Layout or Recalculate Style on `html` inside scroll frames, and the frame rate is steady at display refresh. Rendering panel: enable "Frame Rendering Stats" and "Layer borders" to confirm a single header backdrop layer. Emulate `prefers-reduced-motion: reduce` and a 390x844 touch device: no three chunk, no pins, all content visible.

Do not deploy, push or publish. Commit per phase on `luxury-upgrade` only when the user asks.

---

## 12. Decisions (recorded here because `hx` is unavailable)
- D1 One clock = `gsap.ticker`. `lib/frame-loop.ts` keeps its API and is re-pointed from the framer frameloop to the gsap ticker, and Lenis feeds `ScrollTrigger.update`. Reason: ScrollTrigger and SplitText need GSAP anyway, and R3F can be advanced manually. Alternative rejected: framer frameloop as master (GSAP cannot be driven by it cleanly).
- D2 R3F + drei over plain three for the new scenes (declarative, Suspense texture loading, `RoundedBox`, `Environment`/`Lightformer`, `PerformanceMonitor`). The existing `MagicRings.jsx` stays plain three, only re-clocked.
- D3 framer-motion is kept for discrete UI only (AnimatePresence menus/modals, `layoutId` shared element). Scroll-linked framer hooks are removed.
- D4 Fonts: `next/font/google` (build-time self-hosted woff2, preload, `adjustFontFallback`) with Cormorant Garamond + Manrope. Labels use Manrope caps instead of an extra small-caps family (fewer requests, better legibility at 11 px). Fall back to `next/font/local` only if CI has no network.
- D5 Lenis switches to `lerp: 0.1` (frame-rate independent damping) instead of `duration` easing. Frame sequences keep no extra smoothing (predecessor decision).
- D6 Hero 3D uses the photo as an in-scene plane, so transmission refracts the real background. A shader "clean plate" (high-mip fill) erases the baked panel, and the DOM `<Image>` stays the LCP element and the fallback.
- D7 HDRI is procedural via drei `Lightformer`s baked once (`frames={1}`): no HDR download and warm gold reflections under our control.
- D8 No post-processing bloom. Gold glow comes from additive sprite instances (saves a full-screen pass).
- D9 Decorative candlesticks use a fixed authored array, not random values, and are never labelled as data.
- D10 Clip-path reveals are implemented as transform "curtain" reveals (outer/inner counter-translate) to obey the transform/opacity rule. The gold shimmer uses opacity-pulsed highlight copies instead of an animated background-position.
- D11 Creative gallery = "Atelier film strip" pinned horizontal reel of the real `GALLERY_MOMENTS` photos. It doubles as the P5 pinned horizontal showcase, it is the only horizontal movement (contrast with the vertical frame films), and it uses authentic imagery only (trust, no fabricated results).
- D12 Frames are delivered as WebP q82 (fast decode via `createImageBitmap`, universal support). AVIF is generated but not wired, because its decode cost would slow fast-scroll catch-up. The 1080 set is used only for small landscape canvases or Save-Data.
- D13 Sculpture interlude placed after Forex (where the palette has gone dark) to create the gold beat (beige to gold to dark). Placing it between Crypto and Forex was rejected: both are beige and continuous.
- D14 Markets re-mounted because `NAV_LINKS` points to `#markets`, which is currently not rendered (dead link).
- D15 Device tiers: `high` gets full 3D/grain/cursor/pins, `low` (mobile, coarse pointer, low memory, Save-Data, no WebGL2) gets CSS and SVG fallbacks, `static` (reduced motion) gets final states only. SSR renders `static` markup and upgrades on the client.
