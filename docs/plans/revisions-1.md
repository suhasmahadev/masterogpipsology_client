# Plan: revisions-1 (user review of luxury-upgrade)

Branch `luxury-upgrade` (HEAD `7682519`, code HEAD `9dc5368`). The original site snapshot is commit `74ebc1e` on `main`.
Predecessor: `docs/plans/luxury-upgrade.md` (phases 0-6 are implemented). The global rules in its section 1 still apply:
- Do not change copy.
- Do not delete anything under `public/` or `components/assets/`.
- Animate only `transform` and `opacity`.
- Run every driver on the gsap ticker (GSAP tweens, ScrollTrigger, `lib/frame-loop.ts` `onEveryFrame`).
- Respect `prefers-reduced-motion`.
- Never call `setState` once per frame.

`hx` is not installed in this repo, so the decisions are recorded in section 9.
Tooling: `pnpm` is not on PATH. Use `corepack pnpm build`, `corepack pnpm test` (`node --test "tests/**/*.test.mjs"`, Node 24 strips TS types, so tests import `../lib/*.ts` directly) and `corepack pnpm lint`.
Lib files imported by tests must be self-contained: no imports, and erasable TS only (no enums, no namespaces, no parameter properties).

## The user's words (verbatim)
1. "remove the changes made to the hero section ,i want the photo intact and also the cursor ball thing it is not good ,remove the add a reflection kinda effect on the liquid glass that moves every 5 sec"
2. "after that end grame the video goes sie ways in the mobile veiw ,in desktop veiw it is good ,but mostly it is veiwed in mobile ,so i want you to fix that ,the blend should be so smooth from the last frame to that video that no one should eve nnotice ,and also the black there three d scroll based is not that good ,try soemthing else more proffesinally cooler and expesive feel"
3. This message clarifies the hero and supersedes the hero part of message 1: "the three d thing is good when i scroll down for the frist hero section ,buut there is the black screen covering that image , like a dark theme that erases the i mage ,just remove that and can you ckeep the image and add a live component and make it that scroll zoom effect when i scroll ,like no black theme the same image ,image color theme intact"

## Work items and order
- R2 Remove the custom cursor.
- R1 Hero: keep the 3D, remove every darkening layer, add a scroll zoom and a live element.
- R3 Navbar specular sweep every 5 s.
- R4 + R5 Seamless frame-to-video hand-off and no duplicate header (same component, so do them together).
- R6 Replace SculptureInterlude.

Make one commit per item, in this order: R2, R1, R3, R4+R5, R6. End each commit message with the attribution line from the session.

---

## 0. Findings (root causes, verified in headless Chrome against the running dev server)

### 0.1 What blacks out the hero (R1)
**Desktop (high tier): the in-scene photo shader fails to compile, so the opaque WebGL canvas covers the photo with black.**
- `components/three/hero/BackgroundPlane.tsx:139` sets `glslVersion={THREE.GLSL3}`, but the fragment shader writes `gl_FragColor` at `:80`. three r180 only defines `gl_FragColor` (as `pc_fragColor`) for non-GLSL3 shaders.
- Console on load:
  `THREE.WebGLProgram: Shader Error ... ERROR: 0:118: 'gl_FragColor' : undeclared identifier ... 'linearToOutputTexel' : no matching overloaded function`
- As a result the full-screen photo plane never draws. The canvas is opaque (`StageCanvas.tsx:29` `alpha = false`, `:44`), so it clears to black.
- `HeroStage.tsx:66` fades that canvas to opacity 1 over the DOM photo (`z-[1]`, `HeroStage.tsx:74`), and `Hero.tsx:75-77, 107` hides the DOM light layers when it is "ready".
- What the user sees: a black screen with only the glass frame, candles and dust. That is exactly "a dark theme that erases the image". A screenshot at 1440x900 confirmed it.
- Secondary bug: `CameraRig` (`HeroStage.tsx:30-39`) yaws the camera with `lookAt(panel.cx*0.3*p, 0, 0)`. At 16:10 this exposes the plane's right edge (about 10-20 px of clear colour) from p of about 0.1 onwards.
- Even if the shader compiled, it would still alter the photo. It replaces the baked chart panel with a blurred "clean plate" (`BackgroundPlane.tsx:66-69`), adds a gold sweep (`:71-74`) and adds arch/mouse UV parallax (`:61-64`).

**Mobile and low tier (the user's main device): the dark legibility scrim.**
- `components/sections/hero/HeroLightLayers.tsx:180-189` is a `linear-gradient(108deg, rgba(14,14,18,.68) ... )` over the photo. It only lifts to 0.45 opacity (`:87`).
- Plus the bottom fade (`:191-199`).
- Plus screen-blend gold orbs and a shaft that re-tint the photo (`:129-178`).
- Plus `HeroSweep` (`Hero.tsx:105`), a gold band every 9 s.
- Plus `LightLeak` (`Hero.tsx:108`).
- Plus global `.fx-grain` (`app/globals.css:638-647`, z 60, high tier).
- The 390x844 screenshot shows the top of the photo grey/brown instead of beige.
- `PaletteBackdrop` is **not** a cause: `.pb-root` is `z-index:-1` (`globals.css:629`), and `.pb-dark` only ramps in from `#forex-sequence` 60% (`PaletteBackdrop.tsx:23`).
- The next section (`CryptoMarketScroll`) is beige `#EFE7DC`, so no black wash comes from there either.

Consequence: the hero text is cream `#F3ECE0` (`Hero.tsx:151, 175`) and it was only legible because of the scrim. With the scrim removed, the hero text must switch to dark ink, the way `CryptoMarketScroll` already sets dark text on beige.

### 0.2 Mobile frame-to-video misalignment (R4)
The last canvas frame is `public/assets/opportunity/ezgif-frame-240.jpg` (global frame 719, 1920x1080). It is drawn cover-fit and **centred** (`lib/frame-sequence/math.ts:53-58` `coverDest`, used at `lib/frame-sequence/engine.ts:258`).

Underneath it is `IntelligenceHero` (`components/sections/ForexMarketScroll.tsx:221-227`). Its video, `IntelligenceHero.tsx:74`, is byte-identical to `public/intelligence-layer.mp4`. It is **not the same picture**:
- The video is **1664x1248 (4:3)**.
- It is a different shot of the same doorway. Bright door rect: frame 240 is x 827-1092, y 266-884; video t=0 is x 723-939, y 462-968.
- So K = 1.224 frame px per video px.

Portrait placement (`IntelligenceHero.module.css:412-420`):
- `object-fit: cover; object-position: 43% center` (44% in the tablet band, `:699-700`), while the canvas is centred at 50%.
- At 390x844 the video door is centred at x ≈ 246 px versus the canvas door at x ≈ 195 px (measured in screenshot and by the formula: offset `0.43*(1125-390)=316`).
- The video door is also about 30% smaller, because its scale comes from cover-fitting a 4:3 picture rather than from K.
- Result: two doorways and two figures, offset sideways. Reproduced at progress 0.79.

Desktop (`:50-59`, a hand-tuned 1492x1054 `--u` box) is also misaligned by about 25%.
- It only looks fine because the crossfade hides it: a black shade dip plus `scale(1→1.06)` on the canvas (`ForexMarketScroll.tsx:149-166, 239-243`).
- Also, the video is already **playing** from progress 0.62 (`:179`), before the 0.73 crossfade starts.
- And the portrait scrim `.plate::after` (`IntelligenceHero.module.css:422-435`) and the text are visible *during* the fade, because `inView` fires as soon as the hidden layer becomes visible.

### 0.3 Stray icons around the mobile nav pill (R5)
They are `IntelligenceHero`'s own header (`IntelligenceHero.tsx:80-163`), rendered inside the Forex sticky (`ForexMarketScroll.tsx:226`):
- The grey bolt brand SVG on the left.
- A **2-bar** burger (`<i/><i/>`, `:160-161`) on the right. This is the "=" in the screenshot; GlassHeader's burger has 3 bars.

On portrait, `IntelligenceHero.module.css:438-485` makes `.topbar` an in-flow flex row at the top of the stage, with the burger at `z-index:100`.
- The GlassHeader pill is `max-width: min(1080px, calc(100% - 24px))` (`app/globals.css:494`), so both icons peek out at its sides. Screenshot at 390 px: bolt at x 0-25, burger at x 350-390, y 15-55.
- On desktop, the same header renders dead "About/Features/FAQ/Contact" links and a "Get Started" pill whenever GlassHeader auto-hides.

Two related portrait bugs in the same component:
- `padding: env(safe-area-inset-*, 24px)` (`:396`) resolves to 0 on most phones, so the text touches the screen edge.
- The inline headline/sub spans render "Layerof" and "build,ship", because the spans are `display:inline` at `:604-620` and the JSX has no whitespace between them (`IntelligenceHero.tsx:206-207, 216-217`).

### 0.4 SculptureInterlude (R6)
Phones are always the `low` tier (`lib/device-tier-core.ts:18-27`: width < 768 or coarse pointer), so they only ever got the SVG fallback. The replacement must be premium on the low tier, not only with WebGL.

---

## R2. Remove the custom cursor

- `app/page.tsx`: delete `import { Cursor } ...` (line 25) and `<Cursor />` (line 33).
- Delete `components/fx/Cursor.tsx` (created in Phase 4).
- `app/globals.css`: delete the block from `.fx-cursor-ring, .fx-cursor-dot {` to `html.has-cursor input, html.has-cursor textarea, html.has-cursor [contenteditable] { cursor: auto; }` (currently lines 673-685).
- Keep `scrollStore.mouseX/mouseY` (`components/providers/LenisProvider.tsx:42-43`); the 3D still uses them.

Acceptance:
- `grep -rn "has-cursor\|fx-cursor\|fx/Cursor" app components` returns nothing.
- The native cursor shows everywhere on desktop.

---

## R1. Hero: same photo, no dark layers, 3D kept, scroll zoom, live element

### Design
- **The photo is always the DOM `<Image>`, never covered by anything opaque or tinted.**
  - The only things drawn over it are the text and UI, a transparent WebGL layer (gold dust and a frosted glass pane that only appears once you scroll), and a small "live" chip.
  - No scrim, no fade, no orbs, no sweep, no grain, no light leak.
  - The photo's colours are therefore exactly the JPEG's.
- **Scroll zoom on every animated tier.**
  - The photo wrapper scales from 1 to 1.19 (and pans slightly toward the chart panel) while the hero scrolls out.
  - On the high tier the WebGL camera dollies with **exactly the same projection**, so the 3D layer stays registered with the photo.
  - Formula, in `lib/hero-zoom.ts`:
    - `scale = 10/(10 - 1.6p)`
    - camera `z = 10/scale`
    - camera `x = panFrac * worldW`
    - DOM `x = -scale * panFrac * heroWidth`
  - No `lookAt`, so no edge can ever reveal.
- **3D (high tier) keeps what the user liked:**
  - camera dolly,
  - a glass pane with gold frame and candles that lifts toward you and tilts as you scroll,
  - mouse tilt,
  - gold dust.
- The pane is invisible at rest (opacity 0, registered on the baked panel). It fades in over p 0.01-0.16 while lifting, so it reads as a glass layer peeling off the photo's own screen. The baked panel in the photo is never erased.
- `BackgroundPlane` (the failing shader and clean plate) is deleted. The canvas becomes transparent (`alpha`).
- **Live element:**
  - (a) The 3D candles tick: every 4.5 s the window slides one candle left and a new one grows in, and the newest candle "breathes" (close oscillates ±0.03). Deterministic and authored (decision D9), no numbers.
  - (b) A small DOM glass chip with 16 mini candles and a pulsing dot, using the same tick logic. It sits under the CTAs on **every tier**, so the hero is "live" at rest on phones too.
  - Static tier: the chip is static and there is no zoom.
- **Text palette for a light photo:** dark ink plus a soft cream halo text-shadow, the deep-gold shimmer for "execution", and dark-on-light CTAs. Copy is unchanged.
- **Hand-off to the next section:** the hero bottom meets `CryptoMarketScroll` (beige) with a clean edge. No dark layer is involved; the first dark backdrop starts at Forex 60%.

### R1.1 New pure module `lib/hero-zoom.ts` (no imports)
```ts
export const HERO_CAM_Z = 10;
export const HERO_DOLLY = 1.6;          // camera travel at p = 1 -> scale 1.19
export const HERO_PAN = 0.22;           // fraction of the focus offset the camera pans
export const HERO_IMG_ASPECT = 6688 / 3764;
export const HERO_FOCUS_X = 0.65;       // CSS objectPosition '65% center'
export const HERO_PANEL_U = 0.727;      // baked chart panel centre, image u ((0.531 + 0.923) / 2)

export interface HeroZoom { scale: number; panFrac: number }

/** Horizontal screen fraction (0..1) of image u under object-fit: cover + object-position focusX. */
export function screenXOfImageU(u: number, viewW: number, viewH: number,
  imgAspect: number = HERO_IMG_ASPECT, focusX: number = HERO_FOCUS_X): number;
// vA = viewW / viewH; if (vA >= imgAspect) return u;
// fx = vA / imgAspect; off = focusX * (1 - fx); return (u - off) / fx;

/** Zoom state at hero progress p. focusX is clamped to [0.2, 0.8] so the scaled photo always covers the hero. */
export function heroZoom(p: number, focusX: number): HeroZoom;
// t = clamp01(p); scale = HERO_CAM_Z / (HERO_CAM_Z - HERO_DOLLY * t);
// f = min(0.8, max(0.2, focusX)); return { scale, panFrac: HERO_PAN * (f - 0.5) * t };
```
Coverage proof (the test checks it): `|scale*panFrac| <= (scale-1)/2`, i.e. `0.066t*10/(10-1.6t) <= 0.8t/(10-1.6t)`.

### R1.2 New hook `components/sections/hero/useHeroScroll.ts` (`'use client'`)
```ts
export function useHeroScroll(
  heroRef: React.RefObject<HTMLElement | null>,
  zoomRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,          // tier !== 'static'
): void
```
Body: one `useGSAP(() => {...}, { dependencies: [enabled], revertOnUpdate: true })` from `@/lib/gsap`:
- Return early if `!enabled`, if any ref is missing, or if `matchMedia('(prefers-reduced-motion: reduce)').matches`.
- `const setScale = gsap.quickSetter(zoom, 'scale') as (v: number) => void;`
- `const setX = gsap.quickSetter(zoom, 'x', 'px') as (v: number) => void;`
- `let fx = screenXOfImageU(HERO_PANEL_U, hero.clientWidth, hero.clientHeight);`
- `apply(p)`:
  - `scrollStore.heroProgress = p;`
  - `const z = heroZoom(p, fx);`
  - `setScale(z.scale);`
  - `setX(-z.scale * z.panFrac * hero.clientWidth);`
- `ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onUpdate: s => apply(s.progress), onRefresh: s => { fx = screenXOfImageU(...); apply(s.progress); } })`.
  - This uses no scrub, so DOM and 3D read the same progress in the same tick.
- Content drift (as before): `gsap.fromTo(content, { yPercent: 0 }, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })`.
- Cleanup: `scrollStore.heroProgress = 0`. The context reverts everything else.

### R1.3 New pure module `lib/live-candles.ts` (no imports; pass `CANDLES` in from callers)
```ts
export type Candle = readonly [number, number, number, number]; // open, close, high, low (0..1)
export const LIVE_STEP_S = 4.5;    // one new candle per step
export const LIVE_SLIDE_S = 0.7;   // slide duration at the start of each step
export const LIVE_BREATH_S = 2.4;  // forming-candle oscillation period
export const LIVE_AMP = 0.03;

/** Authored base followed by its mirror (reversed, open/close swapped): a continuous up-then-down ring. */
export function liveRing(base: readonly Candle[]): Candle[];
// [...base, ...base.slice().reverse().map(([o, c, h, l]) => [c, o, h, l])]

export interface LiveClock { start: number; phase: number; f: number }
/** start = floor(t / LIVE_STEP_S); phase = t - start * LIVE_STEP_S; f = smoothstep(0, LIVE_SLIDE_S, phase). */
export function liveClock(tSeconds: number): LiveClock;

/** Newest candle "breathing". The envelope is 0 at phase 0 and LIVE_STEP_S, so steps are continuous. */
export function formingCandle(c: Candle, phase: number): Candle;
// env = sin(PI * clamp01(phase / LIVE_STEP_S)); w = sin(2 * PI * phase / LIVE_BREATH_S);
// close = c[1] + LIVE_AMP * env * w; return [c[0], close, max(c[2], close), min(c[3], close)];

export function ringRange(ring: readonly Candle[]): { min: number; max: number }; // min low, max high
```
Window rule, shared by 3D and DOM, with N visible plus 1 entering:
- Entry `i` (0..N) is `ring[(start + i) % ring.length]`. Entry N goes through `formingCandle(·, phase)`.
- x slot is `i - f`.
- Entry 0 visibility is `1 - f`; entry N is `f`; the rest are 1.

### R1.4 `components/sections/hero/HeroLiveTicker.tsx` (new, `'use client'`)
- Constants: `N = 16`, `SLOT = 8` (px), `H = 26` (px).
- `const RING = liveRing(CANDLES)` (from `@/lib/three/hero-candles`) and `const R = ringRange(RING)`, both at module scope.
- Markup (all `aria-hidden`):
  ```tsx
  <div ref={root} className="hero-live" aria-hidden="true">
    <span className="hero-live__dot pulse-dot" />
    <div className="hero-live__plot">
      <div ref={strip} className="hero-live__strip">
        {Array.from({ length: N + 1 }, (_, i) => (
          <i key={i} className="hl-c" style={{ left: i * SLOT, ...initialOpacity(i) }} data-up={...}>
            <b className="hl-w" style={{ transform: wickTf(i) }} />
            <b className="hl-b" style={{ transform: bodyTf(i) }} />
          </i>
        ))}
      </div>
    </div>
  </div>
  ```
- Initial transforms are computed at render for `start=0, f=0, phase=0`, so SSR shows the chart.
- Map value `v` to px with `y(v) = (v - R.min) / (R.max - R.min) * H`.
  - Wick: `translateY(-y(low)px) scaleY((y(high) - y(low)) / H)`.
  - Body: `translateY(-y(min(o,c))px) scaleY(max(1.5, y(max(o,c)) - y(min(o,c))) / H)`.
  - Origin is bottom for both.
  - `data-up = close >= open ? '1' : '0'`.
- Driver:
  - `const active = useInViewActive(root) && useDocumentVisible()` (from `@/components/three/useInViewActive`, a plain DOM hook).
  - `useEffect`: if not active, or under reduced motion, or `tier === 'static'`, return. Otherwise `onEveryFrame((ts) => tick(ts / 1000), 'update')`.
  - `tick`:
    - Compute `liveClock`.
    - Set strip `translate3d(${-f*SLOT}px,0,0)`.
    - When `start` changed since the last frame, rewrite all N+1 candles (transform plus `data-up`). Otherwise rewrite only entry N (forming), and entry 0 and entry N opacity.
  - Skip writes when the string is unchanged.
- Props: `{ tier: Tier }`.

### R1.5 `components/sections/Hero.tsx` (rewrite of the body; keep the preloader plumbing)
Keep exactly:
- `loadProgress.register('hero-image', 0.45)` at module scope.
- `bgImgRef`, `markHeroImage`, and the `img.complete` effect.
- The `HeroStage` dynamic import with its `.catch` that completes `'hero-3d'`.
- The `hero-3d` register effect for the high tier.
- `RevealText` with `GoldShimmer` for the headline.
- The badge, brass rule and subline structure.
- All copy.

Remove:
- `HeroLightLayers`
- `HeroSweep`
- `LightLeak`
- `lightsRef`
- `hideLights`
- The `onReady` prop usage
- `gsap` import if unused

Structure:
```tsx
<section id="hero" ref={ref} className="hero-ink relative min-h-screen w-full flex items-center overflow-hidden" aria-label="Hero">
  <div ref={zoomRef} className="absolute inset-0" style={{ transformOrigin: '50% 50%', willChange: 'transform' }} aria-hidden="true">
    <Image src="/hero/hero-3200.jpg" ref={bgImgRef} onLoad={markHeroImage} alt="" fill preload fetchPriority="high"
           sizes="100vw" quality={90} style={{ objectFit: 'cover', objectPosition: '65% center' }} />
  </div>
  {tier === 'high' && <HeroStage />}
  <div ref={contentRef} className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 md:px-12 lg:px-16 pt-28 sm:pt-32 pb-24 sm:pb-28">
    ... badge, headline, brass rule, subline, CTAs (as now, with the colours below) ...
    <motion.div custom={6} variants={fadeUpVariants} initial="hidden" animate={inView ? 'visible' : 'hidden'} className="pt-2">
      <HeroLiveTicker tier={tier} />
    </motion.div>
  </div>
</section>
```
- `useHeroScroll(ref, zoomRef, contentRef, tier !== 'static')`.
- `quality={90}` is allowed by `next.config.ts` `qualities`.

Colours (copy unchanged):
- **Badge span style**: `borderColor: 'rgba(140,109,35,0.55)', color: '#6B5320', backgroundColor: 'rgba(250,246,237,0.55)'`. Dot: `backgroundColor: '#8C6D23'`.
- **h1 `RevealText` style**: `color: '#14161B', textShadow: '0 1px 24px rgba(255,248,236,0.55)'`. Keep `fontSize: 'var(--fs-hero)'`.
- **Subline style**: `color: 'rgba(20,22,27,0.78)', textShadow: '0 1px 14px rgba(255,248,236,0.6)'`.
- **Primary CTA**: `variant="liquid" className="btn-liquid--on-light"`.
- **Secondary CTA**: `variant="ghost" className="border border-[rgba(20,22,27,0.35)]"`. Ghost has no border or colour classes of its own to conflict.

### R1.6 `components/three/hero/*`
- **Delete** `BackgroundPlane.tsx`. It is the failing GLSL3 shader and the clean plate.
- `constants.ts`:
  - Remove `ARCH` and `PANEL_RADIUS`.
  - Import `HERO_CAM_Z` from `@/lib/hero-zoom` and set `export const CAMERA_Z = HERO_CAM_Z`.
  - Keep `IMG_ASPECT`, `FOCUS`, `PANEL_RECT`, `CAMERA_FOV = 30` and `useViewWorld`.
- `HeroStage.tsx`:
  - Remove `BackgroundPlane` and the `onReady` prop. `handleReady` keeps the opacity fade-in and `loadProgress.complete('hero-3d')`.
  - Pass `alpha` to `StageCanvas`: `<StageCanvas alpha camera={...}>`.
  - New `CameraRig`:
    ```ts
    function CameraRig(): null {
      const size = useThree((s) => s.size);
      const { w: worldW } = useViewWorld();
      useFrame(({ camera }) => {
        const fx = screenXOfImageU(HERO_PANEL_U, size.width, size.height);
        const z = heroZoom(scrollStore.heroProgress, fx);
        camera.position.set(z.panFrac * worldW, 0, CAMERA_Z / z.scale);
      });
      return null;
    }
    ```
    No `lookAt`. The camera keeps its initial straight-ahead rotation.
  - Keep `GoldEnvironment`, `GlassPanel`, `GoldDust count={500}`, `ReadyProbe` and `ClockBridge`.
- `GlassPanel.tsx`:
  - Refs: `glassMat` (`MeshPhysicalMaterial`), `frameMat` (`MeshStandardMaterial`), `alpha = useRef(0)`.
  - Glass material (no transmission, which needs an opaque background):
    `<meshPhysicalMaterial ref={glassMat} color="#ffffff" emissive="#fff4e0" emissiveIntensity={1} roughness={0.15} metalness={0} clearcoat={1} clearcoatRoughness={0.06} envMapIntensity={1.4} transparent opacity={0} depthWrite={false} toneMapped={false} />`
    - This makes a light frost that can only brighten, never darken.
  - Frame: add `ref={frameMat} transparent opacity={0}`.
  - `useFrame`:
    - `p = damp(prog, heroProgress, 8, dt)`
    - `a = smoothstep(0.01, 0.16, p)` (from `@/lib/three/ease`)
    - `alpha.current = a; g.visible = a > 0.002`
    - `glassMat.opacity = 0.14 * a; frameMat.opacity = a`
    - `g.position.set(cx, cy + 0.35*p + Math.sin(t*0.6)*0.03*a*(1-p), 0.04 + 2.1*p)`
    - `g.rotation.x = -0.16*p + mouseY*0.05*a`
    - `g.rotation.y = 0.3*p + mouseX*0.07*a`
  - `<Candles w={w - 0.05} h={h - 0.05} alpha={alpha} />`.
- `Candles.tsx` (live tick):
  - New prop `alpha: React.RefObject<number>`.
  - Instances `N + 1`, where `N = CANDLES.length`.
  - `const ring = useMemo(() => liveRing(CANDLES), [])`.
  - Material refs for bodies and wicks with `transparent`.
  - `useFrame((state) => { ... })`:
    - `a = alpha.current`. If `a <= 0.002`, return.
    - `{ start, phase, f } = liveClock(state.clock.elapsedTime)`.
    - `g = clamp01(intro.v*0.4 + heroProgress*1.4)`.
    - For each entry `i` in 0..N, take the candle per the window rule (R1.3):
      - `vis` per the rule
      - `s = easeOutExpo(clamp01(g*1.25 - (i/N)*0.25)) * vis`
      - `x = x0 + (i - f) * sw`
      - Same body, wick and glow matrices as today.
    - Recolour all instances (`setColorAt`) when `start` changes; recolour entry N each frame only if its direction flipped.
    - Body and wick material `opacity = a`. Glow `opacity = 0.55*g*a`.
  - Remove the `lastG` early-out (36 instances per frame is trivial).
  - Layout margins already leave more than one slot free on each side, so the sliding entries stay inside the frame.
- `StageCanvas.tsx`: no change (it already supports `alpha`; R3F clears with alpha 0).

### R1.7 Delete the hero darkening code (all created during the upgrade)
- Delete `components/sections/hero/HeroLightLayers.tsx` (its ScrollTrigger and `heroProgress` move to `useHeroScroll`).
- Delete `components/sections/hero/HeroSweep.tsx`.
- `LightLeak` and `GoldShimmer` stay; `FinalCta` and `LuxuryTeamGallery` still use them.

### R1.8 Grain off over the hero
- `components/fx/Grain.tsx`:
  - Add `const ref = useRef<HTMLDivElement>(null)`.
  - Add `useGSAP(() => { if (!ref.current) return; ScrollTrigger.create({ trigger: '#hero', start: 'top bottom', end: 'bottom top', toggleClass: { targets: ref.current, className: 'fx-grain--off' } }); }, { dependencies: [tier] })`.
  - Put `ref={ref}` on the div.
- `app/globals.css` `.fx-grain` (line 638):
  - Add `transition: opacity .6s ease;`.
  - Add a new rule `.fx-grain--off { opacity: 0; }`.

### R1.9 CSS (`app/globals.css`, after the `.fx-leak` rules)
```css
/* Hero on a light photo */
.hero-ink .gold-shimmer { background-image: linear-gradient(100deg, #8C6D23, #B38728 45%, #8C6D23); }
.btn-liquid.btn-liquid--on-light { color: #5A4413; background: rgba(250, 246, 237, 0.5); border-color: rgba(140, 109, 35, 0.6); }

/* Hero live chip */
.hero-live { display: inline-flex; align-items: center; gap: 10px; padding: 8px 14px; border-radius: 999px;
  background: rgba(255, 250, 240, 0.42); border: 1px solid rgba(140, 109, 35, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 6px 24px rgba(60, 45, 20, 0.12);
  -webkit-backdrop-filter: blur(8px) saturate(140%); backdrop-filter: blur(8px) saturate(140%); }
.hero-live__dot { width: 6px; height: 6px; border-radius: 50%; background: #3FA34D; flex: none; }
.hero-live__plot { position: relative; width: 128px; height: 26px; overflow: hidden; }
.hero-live__strip { position: absolute; inset: 0; will-change: transform; }
.hl-c { position: absolute; bottom: 0; width: 8px; height: 26px; }
.hl-c b { position: absolute; bottom: 0; height: 26px; transform-origin: 50% 100%; }
.hl-w { left: 3.5px; width: 1px; }
.hl-b { left: 2px; width: 4px; border-radius: 1px; }
.hl-c[data-up="1"] b { background: #6F9A6A; }
.hl-c[data-up="0"] b { background: #C47766; }
```
`.pulse-dot` already exists (`globals.css:283-290`, transform and opacity). Reduced motion already pins the global animations; if `.pulse-dot` is not covered, add `@media (prefers-reduced-motion: reduce) { .hero-live__dot { animation: none; } }`.

### R1.10 Tests
`tests/hero-zoom.test.mjs`:
1. `heroZoom(0, x).scale === 1` and `panFrac === 0`. `heroZoom(1, 0.5).scale ≈ 10/8.4`.
2. Coverage: for p in 0..1 (step 0.05) and focusX in `[0, 0.2, 0.5, 0.8, 1]`, `Math.abs(z.scale * z.panFrac) <= (z.scale - 1) / 2 + 1e-9`.
3. `screenXOfImageU(0.727, 1920, 900) === 0.727` (wide view). `screenXOfImageU(0.727, 390, 844)` ≈ 0.946.
4. Monotonic: scale is strictly increasing in p.

`tests/live-candles.test.mjs` (import `CANDLES` from `../lib/three/hero-candles.ts`):
1. `liveRing(CANDLES).length === 72`.
2. Continuity: `ring[i][1]` equals `ring[(i+1) % 72][0]` within 1e-9 for every i.
3. `liveClock(0)` gives `{ start: 0, phase: 0, f: 0 }`. `liveClock(4.5 + 0.7).f === 1`. `liveClock(9.1).start === 2`.
4. `formingCandle(c, 0)` and `formingCandle(c, 4.5)` deep-equal `c` within 1e-9. For phase in 0..4.5, high ≥ max(o, c) and low ≤ min(o, c).
5. `ringRange` gives min 0.13 and max 1.

### R1 acceptance
1. Load at 1440x900 (high tier). The DevTools console has **no** `THREE.WebGLProgram: Shader Error`.
2. At scroll 0, the photo is pixel-identical to `/hero/hero-3200.jpg` with the same crop as `74ebc1e`. The only changes are the text in dark ink and the drifting gold dust. There is no grey or black anywhere.
3. Scroll slowly:
   - The photo zooms in smoothly (about 1.19 at the hero's end) and pans slightly toward the chart.
   - A frosted glass pane with a gold rim lifts off the chart panel toward the viewer and tilts. Its candles slide and one new candle grows every 4.5 s.
   - At no scroll position does the photo darken, and no black strip appears at any edge (check 16:10, 16:9 and 21:9).
4. At 390x844 (low tier):
   - Bright beige photo with no scrim, zooming on scroll.
   - Dark legible text.
   - The live chip under the CTAs ticks.
5. Reduced motion: no zoom or drift, and the chip is static.
6. The hero bottom meets the beige Crypto section with no dark band.
7. `grep -rn "HeroLightLayers\|HeroSweep\|BackgroundPlane\|glslVersion" components app lib` returns nothing.

---

## R3. Navbar specular sweep every 5 s

### `components/nav/GlassHeader.tsx`
- New ref: `bandRef = useRef<HTMLSpanElement>(null)`.
- Markup: insert as the **first child** of `<div ref={pillRef} className="lg-pill ...">` (line 198, before `<nav>`):
  `<span className="lg-sheen" aria-hidden="true"><span ref={bandRef} className="lg-sheen__band" /></span>`
- Inside the existing `gsap.context(() => { ... })`, after the magnetic block (around line 181), add:
  ```ts
  const band = bandRef.current;
  if (band && !reduced) {
    const sheen = gsap.timeline({ repeat: -1, repeatDelay: 3.6, delay: 1.5 });
    sheen.fromTo(band, { xPercent: -130 }, { xPercent: 390, duration: 1.4, ease: 'power2.inOut' });
    const onVis = (): void => { if (document.hidden) sheen.pause(); else sheen.resume(); };
    document.addEventListener('visibilitychange', onVis);
    cleanups.push(() => document.removeEventListener('visibilitychange', onVis));
  }
  ```
  - The cycle is 1.4 + 3.6 = 5.0 s. `ctx.revert()` kills it.
  - The band is 28% of the pill width, so `-130%` starts fully off the left edge and `390%` ends fully off the right edge.
  - It runs on the same component on mobile, so the mobile pill gets it too.

### `app/globals.css` (after `.lg-content` at line 538)
```css
.lg-sheen {
  position: absolute; inset: 0; border-radius: inherit; overflow: hidden;
  clip-path: inset(0 round 999px); /* Safari: clip the composited child */
  pointer-events: none; z-index: 0;
}
.lg-sheen__band {
  position: absolute; top: 0; bottom: 0; left: 0; width: 28%;
  background: linear-gradient(105deg,
    rgba(255,255,255,0) 0%, rgba(255,248,230,0) 22%,
    rgba(255,248,230,.55) 46%, rgba(255,236,190,.38) 54%,
    rgba(255,255,255,0) 78%);
  mix-blend-mode: screen; opacity: .85; will-change: transform;
  transform: translateX(-130%);
}
.lg-pill.lg-dark .lg-sheen__band { opacity: .5; }
@media (prefers-reduced-motion: reduce) { .lg-sheen { display: none; } }
```
Paint order: `::before` (glass), then `.lg-sheen` (z 0), then `.lg-content` (z 1, text stays crisp), then `::after` (gold rim).

Acceptance:
- One soft band glides left to right every 5 s (about 1.4 s of motion, then 3.6 s of rest).
- It is clipped to the rounded pill at 390 px and at desktop width, on both light and dark tones.
- It pauses on a hidden tab and is absent under reduced motion.
- Paint flashing shows no pill repaint (transform only).

---

## R4 + R5. Seamless frame-to-video hand-off, no duplicate header

### Design
1. **Dissolve (progress 0.73 → 0.81), opacity only.**
   - The video is placed with exactly the canvas's cover math, scaled by K and offset by the measured door centres ("frame-lock"). Frame 240's doorway and the video's doorway therefore coincide at every viewport.
   - The video is held paused on frame 0, the frame that was measured.
   - The IntelligenceHero scrim and text are at 0. Only the canvas opacity changes.
2. **Settle (0.81 → 0.89), transform only, scrubbed.**
   - The video glides from the frame-lock placement to the component's own designed placement: desktop 1492u box, portrait cover at 43%, tablet 44%.
   - Meanwhile the scrim (a new real div with the same gradients as `.plate::after`) fades in with the same progress.
   - It reads as a slow camera pull-back. On portrait this also moves the bright door out from behind the headline, which keeps the text legible.
   - Desktop ends exactly as it looks today.
3. **Reveal (≥ 0.89, hysteresis off below 0.85).** The headline, sub, CTAs and logos fade in (time-based framer, once per crossing). The video plays from 0.81 on.

Geometry is computed by pure functions on resize (ResizeObserver on the sticky-sized wrapper) and applied as one `transform` string per frame. Under reduced motion there is no settle: native placement throughout, with a plain opacity dissolve.

### R4.1 New pure module `lib/frame-sequence/handoff.ts` (no imports)
```ts
export interface HSize { w: number; h: number }
export interface HRect { x: number; y: number; w: number; h: number }
export interface DoorBox { x0: number; x1: number; y0: number; y1: number }
export interface VideoPlacement { k: number; vw: number; vh: number; dx: number; dy: number }
export type NativeMode = 'desktop' | 'portrait' | 'tablet';
export interface SettleTransform { tx: number; ty: number; k: number }

export const HANDOFF_FRAME: HSize = { w: 1920, h: 1080 };
export const HANDOFF_VIDEO: HSize = { w: 1664, h: 1248 };
/** Bright doorway (L > 200, connected door region), opportunity frame 240. */
export const DOOR_FRAME: DoorBox = { x0: 827, x1: 1092, y0: 266, y1: 884 };
/** Same doorway in intelligence-layer.mp4 at t = 0. */
export const DOOR_VIDEO: DoorBox = { x0: 723, x1: 939, y0: 462, y1: 968 };

export function videoPlacement(frame = HANDOFF_FRAME, video = HANDOFF_VIDEO, df = DOOR_FRAME, dv = DOOR_VIDEO): VideoPlacement;
// k = ((df.x1-df.x0)/(dv.x1-dv.x0) + (df.y1-df.y0)/(dv.y1-dv.y0)) / 2
// fcx = (df.x0+df.x1)/2; fcy = (df.y0+df.y1)/2; vcx = (dv.x0+dv.x1)/2; vcy = (dv.y0+dv.y1)/2
// cx = fcx + (video.w/2 - vcx)*k; cy = fcy + (video.h/2 - vcy)*k
// return { k, vw: video.w*k, vh: video.h*k, dx: cx - frame.w/2, dy: cy - frame.h/2 }
// Expected: k ≈ 1.2241, vw ≈ 2036.9, vh ≈ 1527.7, dx ≈ +0.7, dy ≈ -76.4

/** Rect of the full video picture, frame-locked to a centred cover-fit 1920x1080 canvas in container c. */
export function frameLockRect(c: HSize, p: VideoPlacement = videoPlacement(), frame = HANDOFF_FRAME): HRect;
// s = max(c.w/frame.w, c.h/frame.h); w = p.vw*s; h = p.vh*s; x = c.w/2 + p.dx*s - w/2; y = c.h/2 + p.dy*s - h/2

/** Rect of the full video picture as IntelligenceHero.module.css lays it out natively (stage = container c). */
export function nativeVideoRect(c: HSize, mode: NativeMode, video = HANDOFF_VIDEO): HRect;
// desktop: u = c.h/1058; bw = Math.min(1492*u, c.w)   // Tailwind preflight `video { max-width: 100% }`
//          bh = 1054*u; bx = c.w/2 - bw/2 - 0.5*u; by = 1*u        // CSS :50-59
//          sc = max(bw/video.w, bh/video.h); pw = video.w*sc; ph = video.h*sc
//          return { x: bx + (bw-pw)/2, y: by + (bh-ph)/2, w: pw, h: ph }   // object-fit cover, 50% 50%
// portrait | tablet: sc = max(c.w/video.w, c.h/video.h); pw, ph as above
//          posX = mode === 'tablet' ? 0.44 : 0.43                       // CSS :419, :700
//          return { x: (c.w - pw)*posX, y: (c.h - ph)*0.5, w: pw, h: ph }

/** s = 0: maps native onto lock; s = 1: identity. Transform-origin is the element's top-left (= native.x, native.y). */
export function settleTransform(native: HRect, lock: HRect, s: number): SettleTransform;
// t = clamp01(s); k0 = lock.w/native.w
// return { k: k0 + (1-k0)*t, tx: (lock.x - native.x)*(1-t), ty: (lock.y - native.y)*(1-t) }

export function rectAt(native: HRect, tr: SettleTransform): HRect; // { x: native.x+tr.tx, y: native.y+tr.ty, w: native.w*tr.k, h: native.h*tr.k }
export function covers(r: HRect, c: HSize, eps = 0.5): boolean;     // r.x <= eps && r.y <= eps && r.x+r.w >= c.w-eps && r.y+r.h >= c.h-eps
export function smoothstep01(e0: number, e1: number, x: number): number;
```

### R4.2 `components/sections/IntelligenceHero.tsx`
- New optional props (so `/intelligence` stays as is):
  ```ts
  embedded?: boolean;   // rendered inside ForexMarketScroll's sticky
  revealed?: boolean;   // embedded only: show the text
  ```
- `const show = embedded ? !!revealed : inView;`
- Every `animate={inView ? X : {}}` becomes `animate={show ? X : embedded ? HIDDEN : {}}`.
  - `HIDDEN` is that element's own `initial` object: `{ opacity: 0, y: 14 }`, `{ opacity: 0, y: 20 }` for the brand, or `{ opacity: 0 }` for the logos.
- Stage class: ``${styles.stage} ${embedded ? styles.embedded : ''} ${isOpen ? styles.isOpen : ''}``.
- Inside `.plate`, after `<video>`: `{embedded && <div className={styles.plateShade} data-ih-shade="" aria-hidden="true" />}`.
- **R5 fix:** wrap `<header className={styles.topbar}>…</header>` and `<nav id="mobile-intelligence-menu">…</nav>` in `{!embedded && (…)}`. In the Escape/matchMedia effect, add `if (embedded) return;` as its first line and `[embedded]` as its deps.
- Word spacing fix (rendering only, no copy change): put `{' '}` between the two `<span>`s of the headline (`:206-207`) and of the sub (`:216-217`). Desktop spans are block-level, so the space is inert there.
- `<video>` attributes are unchanged. ForexMarketScroll controls the video.

### R4.3 `components/sections/IntelligenceHero.module.css`
- Change the selector `.plate::after` to `.plate::after, .plateShade` in three places: the base rule (line 62), the portrait rule (line 422) and the tablet rule (around line 702). The declarations are unchanged.
- Append at the **end of the file**:
```css
/* ==========================================================================
   EMBEDDED IN FOREX STICKY (see lib/frame-sequence/handoff.ts)
   ========================================================================== */
.plateShade { position: absolute; inset: 0; pointer-events: none; opacity: 0; will-change: opacity; }
.embedded .plate::after { content: none; }
.stage.embedded { height: 100%; min-height: 0; overflow: hidden; }
.embedded .plate { position: absolute; inset: 0; width: auto; height: auto; }
.embedded .plateVideo {
  /* left/top/width/height are set inline by ForexMarketScroll on resize */
  position: absolute; right: auto; bottom: auto;
  max-width: none; max-height: none;
  object-fit: cover; object-position: 50% 50%;
  transform-origin: 0 0; will-change: transform;
}
@media (max-aspect-ratio: 11/10) {
  .stage.embedded {
    padding: max(env(safe-area-inset-top), calc(12 * var(--m))) max(env(safe-area-inset-right), calc(22 * var(--m)))
             max(env(safe-area-inset-bottom), calc(18 * var(--m))) max(env(safe-area-inset-left), calc(22 * var(--m)));
  }
  .embedded .hero { margin-top: calc(146 * var(--m)); }   /* removed topbar (76m) + original 70m */
}
@media (min-width: 600px) and (max-aspect-ratio: 11/10) {
  .embedded .hero { margin-top: calc(166 * var(--m)); }   /* 76m + 90m */
}
```
Specificity: `.embedded .plateVideo` (2 classes) beats the media-query `.plateVideo` (1 class). The inline `transform` overrides the CSS `transform`.

### R4.4 `components/sections/ForexMarketScroll.tsx`
- Imports:
  - `React, { useEffect, useRef, useState }`
  - `{ frameLockRect, nativeVideoRect, settleTransform, smoothstep01, type HRect, type NativeMode } from '@/lib/frame-sequence/handoff'`
- Constants: replace the comment on line 15, and add
  ```ts
  const XFADE_START = 0.73; // HUD gone (0.68..0.73), frame 720 settled since 0.70
  const XFADE_END   = 0.81;
  const SETTLE_END  = 0.89;
  const REVEAL_ON   = 0.89;
  const REVEAL_OFF  = 0.85;
  ```
- **Remove the doorway shade**: `doorwayShadeRef` (line 69), its uses (149, 156, 164) and the `<div ref={doorwayShadeRef} …/>` (239-243). **Never set a transform on the canvas again.** Canvas style becomes `willChange: 'opacity'` (line 236).
- New state and refs:
  ```ts
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);
  const reducedRef  = useRef(false);
  const progressRef = useRef(0);
  const shadeElRef  = useRef<HTMLElement | null>(null);
  const geomRef     = useRef<{ native: HRect; lock: HRect } | null>(null);
  const getShade = (): HTMLElement | null =>
    (shadeElRef.current ??= heroContentRef.current?.querySelector<HTMLElement>('[data-ih-shade]') ?? null);
  const applySettle = (progress: number): void => {
    const video = getVideo(); const g = geomRef.current;
    if (!video || !g) return;
    const s = reducedRef.current ? 1 : smoothstep01(XFADE_END, SETTLE_END, progress);
    const tr = settleTransform(g.native, g.lock, s);
    put('vtr', `translate3d(${tr.tx.toFixed(2)}px,${tr.ty.toFixed(2)}px,0) scale(${tr.k.toFixed(5)})`,
        (v) => { video.style.transform = v; });
    put('shade', (reducedRef.current ? (progress >= XFADE_END ? 1 : 0) : s).toFixed(3),
        (v) => { const el = getShade(); if (el) el.style.opacity = v; });
  };
  ```
- Mount effect (measure and resize):
  ```ts
  useEffect(() => {
    const host = heroContentRef.current;
    if (!host) return;
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const measure = (): void => {
      const video = getVideo();
      const c = { w: host.clientWidth, h: host.clientHeight };
      if (!video || !c.w || !c.h) return;
      const portrait = window.matchMedia('(max-aspect-ratio: 11/10)').matches;
      const mode: NativeMode = !portrait ? 'desktop'
        : window.matchMedia('(min-width: 600px)').matches ? 'tablet' : 'portrait';
      const native = nativeVideoRect(c, mode);
      geomRef.current = { native, lock: frameLockRect(c) };
      video.style.left = `${native.x}px`; video.style.top = `${native.y}px`;
      video.style.width = `${native.w}px`; video.style.height = `${native.h}px`;
      delete last.current.vtr;
      applySettle(progressRef.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  ```
  - Layout properties are written only on resize, never per frame.
- In `onUpdate`, set `progressRef.current = progress;` first. Then replace the "Doorway-to-video blend" block (147-169) with:
  ```ts
  const canvas = canvasRef.current;
  const heroContent = heroContentRef.current;
  if (canvas && heroContent) {
    const e = smoothstep01(XFADE_START, XFADE_END, progress);
    put('opacity', (1 - e).toFixed(3), (v) => { canvas.style.opacity = v; });
    put('vis', progress >= 0.70 ? 'visible' : 'hidden', (v) => { heroContent.style.visibility = v; });
  }
  applySettle(progress);
  const want = revealedRef.current ? progress >= REVEAL_OFF : progress >= REVEAL_ON;
  if (want !== revealedRef.current) {
    revealedRef.current = want;
    setRevealed(want);   // threshold crossings only
    if (heroContent) heroContent.style.pointerEvents = want ? 'auto' : 'none';
  }
  ```
- Replace the "Background video" block (171-181) with:
  ```ts
  const video = getVideo();
  if (video) {
    if (progress >= 0.45 && !armedRef.current) {
      armedRef.current = true;
      video.preload = 'auto';
      video.load();
      // iOS ignores preload: a muted inline play+pause decodes frame 0.
      video.play().then(() => {
        if (videoStateRef.current !== 'play') { video.pause(); video.currentTime = 0; }
      }).catch(() => {});
    }
    if (progress >= XFADE_END && !reducedRef.current) setVideoState('play');
    else if (progress < XFADE_END) {
      setVideoState('pause');
      if (progress < XFADE_START - 0.01 && video.currentTime !== 0) video.currentTime = 0; // canvas opaque: invisible reset
    }
  }
  ```
- Wrapper JSX (221-227):
  ```tsx
  <div ref={heroContentRef} className="absolute inset-0 z-0" style={{ pointerEvents: 'none', visibility: 'hidden' }}>
    <IntelligenceHero embedded revealed={revealed} autoPlayVideo={false} videoPreload="none" />
  </div>
  ```
- `onActiveChange` is unchanged.

### R4.5 Test `tests/handoff.test.mjs`
Import from `../lib/frame-sequence/handoff.ts` and `coverDest` from `../lib/frame-sequence/math.ts`.

Use these viewports:
- Portrait: `[390x844, 360x780, 375x667, 430x932]`
- Tablet: `[768x1024, 820x1180]`
- Desktop: `[1024x768, 1280x800, 1440x900, 1920x1080, 2560x1080, 3440x1440]`

Cases:
1. `videoPlacement()`: `k` in [1.215, 1.235], `|dx| < 3`, `dy` in [-80, -72].
2. Lock coverage: `covers(frameLockRect(c), c)` for every viewport.
3. Door alignment at lock:
   - Map the frame door through the canvas cover: `d = coverDest(HANDOFF_FRAME, c)`; `fx0 = d.x + DOOR_FRAME.x0 * d.w/1920`, and the same for the other edges.
   - Map the video door through `r = frameLockRect(c)`: `vx0 = r.x + DOOR_VIDEO.x0 * r.w/1664`, and so on.
   - All four edges agree within `max(1.5, 0.006*c.h)` px.
4. Settle coverage (portrait and tablet viewports with their mode): `covers(rectAt(native, settleTransform(native, lock, s)), c)` for s in 0..1 step 0.1.
5. Desktop:
   - s = 0 covers.
   - For all s, vertical coverage holds within 2u (`u = c.h/1058`), i.e. `r.y <= 2u` and `r.y + r.h >= c.h - 2u`.
6. `settleTransform(n, l, 1)` gives `{ k: 1, tx: 0, ty: 0 }`. `rectAt(n, settleTransform(n, l, 0))` equals `l` within 1e-6.
7. Native portrait at 390x844: `x` ≈ `-(1125.0 - 390) * 0.43` within 1 px (regression on the 43% CSS).

### R4/R5 acceptance (manual, `corepack pnpm build && corepack pnpm start`)
1. In device mode at 390x844, 360x780, 430x932 and 768x1024, plus 1440x900 and 2560x1080, scroll slowly through the end of the Forex sequence.
   - From frame 720 to the end of the dissolve, there must be **one** doorway at every position: no sideways slide, no scale pop and no dark dip.
   - Pixel check: stop mid-dissolve. The doorway edges coincide to about 1-2 px.
   - The figure may differ by about 15 px vertically on phones, because the two shots differ. That is accepted.
2. After the dissolve, the video plays and gently pulls back into the designed composition while the gradient fades in. Then the text fades in.
3. On desktop the final frame looks exactly as it does today.
4. Scrolling back reverses everything cleanly.
5. On mobile there is no grey bolt and no 2-bar "=" burger beside the nav pill. On desktop there is no second "About/Features/FAQ/Contact/Get Started" nav when the GlassHeader hides.
6. "The Next Layer of Intelligence" and "build, ship" have proper spaces, and the portrait text has side padding.
7. `/intelligence` still has its own header, working burger and menu, and an autoplaying video.
8. Reduced motion: the opacity dissolve is still scroll-driven, there is no pull-back, and the video stays a still.

---

## R6. Replace SculptureInterlude with "The Hallmark Dial"

### Concept (one)
**A guilloché watch dial in engraved gold on black.**
- Three concentric engraved rings turn slowly against each other as you scroll: a minute-track bezel, a rose-engine lattice and a wavy sunburst centre.
- A specular highlight glides around the polished metal, like a watch tilted under a lamp.
- The brand signature resolves in the centre.

Why it fits:
- Haute-horlogerie craft (Breguet/Patek guilloché) says precision, patience and discipline, which is exactly "Education before execution".
- It is restraint, not particle spectacle.
- It is pure SVG hairlines plus compositor-only rotations, so phones (the low tier) get the identical, full-quality experience at 60 fps.
- It sits naturally between the dark IntelligenceHero and the dark Markets section, with the existing gold backdrop glow blooming behind it.

Copy: existing only, `BRAND_NAME` ("Master of Pipsology") and `BRAND_TAGLINE` ("Trading education. No shortcuts.") from `lib/content.ts:234-235`.

### R6.1 New pure module `lib/guilloche.ts` (no imports, deterministic)
All coordinates use a 1000x1000 viewBox with centre (500, 500). Numbers are formatted with `toFixed(2)`.
```ts
/** n radial ticks; every majorEvery-th tick starts at rMajor (longer). Angle i*2π/n - π/2. "M x0 y0 L x1 y1 " per tick. */
export function tickRing(n: number, rInner: number, rOuter: number, rMajor: number, majorEvery: number): string;
/** count circles of radius rCircle, centres on a circle of radius rCentre. Per circle two arcs:
 *  `M ${cx+r} ${cy} A ${r} ${r} 0 1 0 ${cx-r} ${cy} A ${r} ${r} 0 1 0 ${cx+r} ${cy} ` */
export function roseRing(count: number, rCentre: number, rCircle: number): string;
/** lines radial wavy polylines r0 -> r1; angle offset amp*sin(waves*π*u), u in 0..1, steps points each. */
export function sunburst(lines: number, r0: number, r1: number, amp: number, waves: number, steps: number): string;
export function circlePath(r: number): string;     // two-arc circle
export function subpathCount(d: string): number;   // count of 'M'
```
Rings:
- Ring A = `circlePath(492) + circlePath(484) + tickRing(120, 462, 480, 448, 10)`.
- Ring B = `roseRing(72, 405, 48) + circlePath(350) + circlePath(460)`.
- Ring C = `sunburst(96, 150, 340, 0.012, 6, 24) + circlePath(340)`.

Compute these strings once at module scope in the component.

### R6.2 New component `components/sections/HallmarkDial.tsx` (`'use client'`)
```tsx
<section id="hallmark" ref={ref} data-nav-tone="dark" aria-label={BRAND_NAME} className="hm-section relative">
  <div className="hm-sticky">
    <div ref={dialRef} className="hm-dial">
      <div className="hm-glow" aria-hidden="true" />
      <svg ref={ringA} className="hm-layer" viewBox="0 0 1000 1000" aria-hidden="true">
        <defs><linearGradient id="hm-gold-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3E2B3" /><stop offset=".35" stopColor="#D4AF37" />
          <stop offset=".65" stopColor="#8C6D23" /><stop offset="1" stopColor="#E9D29A" /></linearGradient></defs>
        <path d={RING_A} stroke="url(#hm-gold-a)" strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" opacity={0.8} />
      </svg>
      {/* ringB: id hm-gold-b, strokeWidth 0.75, opacity 0.55. ringC: id hm-gold-c, strokeWidth 0.6, opacity 0.4 */}
      <div ref={sheenOuter} className="hm-sheen hm-sheen--outer" aria-hidden="true" />
      <div ref={sheenInner} className="hm-sheen hm-sheen--inner" aria-hidden="true" />
      <div ref={textRef} className="hm-sign">
        <span className="hm-sign__pre">{pre}</span>
        <span className="hm-sign__name">{name}</span>
        <span className="hm-sign__rule" aria-hidden="true" />
        <span className="hm-sign__tag">{BRAND_TAGLINE}</span>
      </div>
    </div>
  </div>
</section>
```
- `const words = BRAND_NAME.split(' '); const pre = words.slice(0, -1).join(' '); const name = words[words.length - 1];` gives "Master of" and "Pipsology". The copy is unchanged; only the line break is new.
- Animation: one `useGSAP` from `@/lib/gsap`, skipped under `prefers-reduced-motion`:
  ```ts
  const tl = gsap.timeline({ defaults: { ease: 'none' },
    scrollTrigger: { trigger: ref.current, start: 'top 70%', end: 'bottom bottom', scrub: 0.6 } });
  tl.fromTo(dial, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.18, ease: 'power2.out' }, 0)
    .fromTo(ringA, { rotation: 0 }, { rotation: -14, duration: 1 }, 0)
    .fromTo(ringB, { rotation: 0 }, { rotation: 22, duration: 1 }, 0)
    .fromTo(ringC, { rotation: 0 }, { rotation: -9, duration: 1 }, 0)
    .fromTo(sheenOuter, { rotation: -40 }, { rotation: 200, duration: 1 }, 0)
    .fromTo(sheenInner, { rotation: 30 }, { rotation: -110, duration: 1 }, 0)
    .fromTo(text, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, 0.22)
    .to(dial, { opacity: 0, scale: 0.97, duration: 0.18, ease: 'power1.in' }, 0.82);
  ```
  - Set `transformOrigin: '50% 50%'` on the rotating layers (the CSS also sets it).
  - Scale is always ≤ 1, so rasterised layers never upscale or blur.

### R6.3 CSS in `app/globals.css` (new block after the Phase 6 section)
```css
/* ─── Hallmark dial ─── */
.hm-section { height: 220vh; }
.hm-sticky { position: sticky; top: 0; height: 100dvh; display: grid; place-items: center; overflow: hidden; }
.hm-dial { position: relative; width: min(86vw, 78dvh, 760px); aspect-ratio: 1; will-change: transform, opacity; container-type: inline-size; }
.hm-layer, .hm-sheen, .hm-glow { position: absolute; inset: 0; width: 100%; height: 100%; transform-origin: 50% 50%; }
.hm-layer, .hm-sheen { will-change: transform; }
.hm-glow { inset: -18%; width: auto; height: auto; border-radius: 50%;
  background: radial-gradient(circle, rgba(212,175,55,.16) 0%, rgba(140,100,30,.08) 38%, transparent 66%); }
.hm-sheen { border-radius: 50%; mix-blend-mode: screen; pointer-events: none; }
.hm-sheen--outer {
  background: conic-gradient(from 0deg, transparent 0deg, rgba(255,240,205,0) 20deg, rgba(255,240,205,.42) 42deg,
    rgba(255,240,205,0) 66deg, transparent 200deg, rgba(255,236,190,.22) 228deg, transparent 252deg);
  -webkit-mask: radial-gradient(circle, transparent 69%, #000 70%, #000 98.4%, transparent 98.6%);
          mask: radial-gradient(circle, transparent 69%, #000 70%, #000 98.4%, transparent 98.6%);
}
.hm-sheen--inner {
  opacity: .55;
  background: conic-gradient(from 90deg, transparent 0deg, rgba(255,240,205,.3) 30deg, transparent 60deg,
    transparent 180deg, rgba(255,240,205,.18) 210deg, transparent 240deg);
  -webkit-mask: radial-gradient(circle, transparent 29%, #000 31%, #000 67.5%, transparent 68%);
          mask: radial-gradient(circle, transparent 29%, #000 31%, #000 67.5%, transparent 68%);
}
.hm-sign { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; color: #EADBB5; border-radius: 50%;
  background: radial-gradient(circle, rgba(8,8,10,.86) 0%, rgba(8,8,10,.7) 22%, transparent 34%); }
.hm-sign__pre { font-family: var(--font-display); font-style: italic; font-size: clamp(14px, 3.4cqi, 26px); opacity: .85; }
.hm-sign__name { font-family: var(--font-display); font-weight: 500; text-transform: uppercase; letter-spacing: .18em;
  font-size: clamp(20px, 6.2cqi, 46px); line-height: 1.05; margin-right: -.18em;
  background: linear-gradient(180deg, #F6E7BF, #C9A245 60%, #8C6D23); -webkit-background-clip: text; background-clip: text; color: transparent; }
.hm-sign__rule { width: 18%; height: 1px; margin: .9em 0 .8em; background: linear-gradient(90deg, transparent, #D4AF37, transparent); }
.hm-sign__tag { font-family: var(--font-body); font-size: clamp(9px, 1.9cqi, 12px); letter-spacing: .3em; text-transform: uppercase; color: #B9A27A; margin-right: -.3em; }
@media (prefers-reduced-motion: reduce) {
  .hm-section { height: auto; }
  .hm-sticky { position: relative; height: auto; min-height: 100svh; }
}
```
With JS disabled or reduced motion, the dial shows assembled with the text visible.

### R6.4 Wiring and removal
- `app/page.tsx`: replace the `SculptureInterlude` import and usage (lines 12, 59-60) with `import { HallmarkDial } from '@/components/sections/HallmarkDial';` and `<HallmarkDial />`. Use the comment "Hallmark dial: guilloché gold beat between Forex and the dark sections".
- `components/fx/PaletteBackdrop.tsx:27-28`: change `getElementById('sculpture')` to `getElementById('hallmark')` and update the comment.
- Delete `components/sections/SculptureInterlude.tsx`, `components/sections/SculptureFallback.tsx` and `components/three/sculpture/SculptureStage.tsx`.
- Keep `lib/three/sculpture-layout.ts` (tested). `scrollStore.sculptureProgress` becomes unused; leave it.

### R6.5 Test `tests/guilloche.test.mjs`
- `subpathCount(tickRing(120, 462, 480, 448, 10)) === 120`.
- `roseRing(72, 405, 48)` has 72 subpaths, and every number is within [0, 1000].
- `sunburst(96, 150, 340, 0.012, 6, 24)` has 96 subpaths and 96*24 points, each at a radius within [149.9, 340.1] from (500, 500).
- Same args give an identical string.
- `circlePath(492)` contains exactly two `A` commands.

### R6 acceptance
- 390x844 and desktop show the same dial.
- With a 4x CPU throttle, scrolling the 220vh section keeps 60 fps with only Composite per frame (no Paint or Layerize).
- The rings counter-rotate, the highlight circles the bezel, and the signature appears around 25-40% of the section. The dial recedes before Markets.
- Reduced motion: a static dial with no pin.
- `grep -rn "Sculpture" app components` returns nothing.

---

## 7. Files touched
- **Edit:**
  - `app/page.tsx`
  - `app/globals.css`
  - `components/sections/Hero.tsx`
  - `components/three/hero/{HeroStage,GlassPanel,Candles,constants}.tsx/.ts`
  - `components/fx/Grain.tsx`
  - `components/nav/GlassHeader.tsx`
  - `components/sections/IntelligenceHero.tsx`
  - `components/sections/IntelligenceHero.module.css`
  - `components/sections/ForexMarketScroll.tsx`
  - `components/fx/PaletteBackdrop.tsx`
- **New:**
  - `lib/hero-zoom.ts`
  - `lib/live-candles.ts`
  - `lib/frame-sequence/handoff.ts`
  - `lib/guilloche.ts`
  - `components/sections/hero/useHeroScroll.ts`
  - `components/sections/hero/HeroLiveTicker.tsx`
  - `components/sections/HallmarkDial.tsx`
  - `tests/hero-zoom.test.mjs`
  - `tests/live-candles.test.mjs`
  - `tests/handoff.test.mjs`
  - `tests/guilloche.test.mjs`
- **Delete** (code created during the upgrade):
  - `components/fx/Cursor.tsx`
  - `components/three/hero/BackgroundPlane.tsx`
  - `components/sections/hero/HeroLightLayers.tsx`
  - `components/sections/hero/HeroSweep.tsx`
  - `components/sections/SculptureInterlude.tsx`
  - `components/sections/SculptureFallback.tsx`
  - `components/three/sculpture/SculptureStage.tsx`
- **Assets:** none deleted or overwritten.

## 8. Verify
```
corepack pnpm lint
corepack pnpm test        # all old tests + hero-zoom, live-candles, handoff, guilloche
corepack pnpm build       # must pass (type-check included)
grep -rn "HeroLightLayers\|HeroSweep\|BackgroundPlane\|glslVersion\|fx/Cursor\|has-cursor\|Sculpture\|doorwayShade" app components
corepack pnpm start       # then the manual checks in R1, R3, R4/R5, R6
```
- Check the DevTools console on `/` at 1440x900: there must be no `THREE.WebGLProgram` errors.
- A headless check is possible with Chrome (`chrome --headless=new --remote-debugging-port=9333 --enable-unsafe-swiftshader`) and CDP `Page.captureScreenshot` at scroll positions. That is how the findings in section 0 were captured.

## 9. Decisions (would be `hx decision add`)
1. **Hero photo stays a DOM image; WebGL becomes a transparent overlay.** The in-scene photo plane is deleted.
   - Its GLSL3 shader never compiled, which caused the black.
   - Even fixed, it re-encoded the photo through WebGL, erased the baked panel and tinted it.
   - DOM is the only way to guarantee "image colour theme intact".
2. **Scroll zoom is shared math (`lib/hero-zoom.ts`).** The DOM scale/pan and the camera dolly/pan use one formula with no `lookAt`, so the 3D stays registered and no edge can ever show. It is unscrubbed so both read the same progress in the same tick.
3. **The glass pane is invisible at rest and lifts off as you scroll.**
   - The photo is untouched at rest. The pane is frosted, non-transmissive, emissive and un-tone-mapped, so it can only lighten.
   - This keeps the "3D thing" the user liked without erasing the baked panel.
4. **Live element = deterministic candle tick** (authored ring of the existing CANDLES plus its mirror, decision D9 kept).
   - It appears in the 3D pane and in a small DOM glass chip under the CTAs on every tier, so phones get it too.
   - No numbers or labels. It is shared by `lib/live-candles.ts`.
5. **Hero text switches to dark ink** with a cream halo, deep-gold shimmer and dark-on-light CTAs, because the dark scrim that made cream text legible is removed. Copy is unchanged.
6. **No bottom fade on the hero.** A clean edge meets the beige Crypto section, so the photo is unaltered to its last pixel.
7. **Hand-off = frame-lock, then settle.**
   - Opacity-only dissolve with the video frame-locked (door-matched, K = 1.224) and paused on frame 0.
   - Then a scrubbed transform glide into the component's designed placement, with the scrim fading in alongside.
   - Desktop ends exactly as today, and portrait ends with the door clear of the headline.
   - Geometry is computed by pure tested functions, with layout written only on resize.
8. **The embedded IntelligenceHero drops its own header and menu.** GlassHeader is the site nav. `/intelligence` keeps them.
9. **Grain is suppressed over the hero.**
10. **Navbar sheen is a GSAP timeline** on the shared ticker, paused on `visibilitychange`.
11. **R6 is non-WebGL** (SVG guilloché plus composited rotations), identical on all tiers. The sculpture code is deleted; the shared R3F infra and pure libs are kept.
