# Plan: workflow-captions (connected caption flow + smoother frame motion)

Branch `luxury-upgrade`. Use `corepack pnpm`. Follow `rules.md`: transform/opacity only, one shared clock (`lib/frame-loop.ts` / gsap ticker), no copy changes, never touch `public/`. Commit before each phase (one commit per phase below). Do not push. Do not touch the user's dev server on :3000. No automated browser QA: the owner checks visually.

No Next.js API is touched (client component + CSS + pure TS only), so the `node_modules/next/dist/docs` read is not needed for this change.

Owner request (verbatim): "the text boxes that apperar on each flow so that the user wont feel it is a break our someting ,instead of random words coming ,lt it be like worklow ,with connecting those boxes on scroll ,it should match the same theme and also plan out the frame move rate based on the smoothness to make it extra smoother"

`hx` is not installed (`hx: command not found`, `where hx` finds nothing), so decisions are in section 2 rather than `hx decision add`.

---

## 1. Findings

### 1.1 Why the captions feel like "breaks"
`components/sections/ScrollCaptions.tsx` + `lib/scroll-captions.ts` today:
- Only one caption exists at a time. Between captions there is a gap with **nothing** on screen: `spread()` gives each caption 86% of its step and leaves 14% empty (`lib/scroll-captions.ts:28-37`). For Crypto that gap is 0.14 x 0.15 x 350vh = 7.35vh = 66 px at a 900 px viewport, which is less than one wheel notch (100 px). A single notch takes you from caption A, through nothing, to caption B.
- The change is a **timed** CSS transition (`.scroll-caption`: opacity 0.4 s, transform 0.5 s, `app/globals.css:902-908`). It starts when an index threshold is crossed and is not linked to scroll. It plays at the same speed whether you creep or flick, and it keeps playing after you stop.
- Nothing visually links caption N to caption N+1, so each one reads as an isolated pop.

### 1.2 Frame motion today (numbers)
| Lever | Current value | Where |
|---|---|---|
| Pace | 350vh per 192 unique frames (`SEQ_SCROLL_VH`, `UNIQUE_PER_SEQ`) = 3.5 x vh / 191 px per frame: **16.5 px** at vh 900, 19.8 px at vh 1080, 15.5 px at vh 844 (phone) | `lib/frame-sequence/sources.ts:22`, sections |
| Scroll smoothing | Lenis `lerp 0.1` = frame-rate-independent damp with λ = 0.1 x 60 = 6/s (τ = 167 ms, 95% settled in 0.5 s). Touch is native (`syncTouch: false`) | `components/providers/LenisProvider.tsx:52-59`, `node_modules/lenis/dist/lenis.mjs:86` |
| Sequence damping | rate 0 while Lenis is active (Lenis is the only smoother: decision 1 in scroll-frame-performance.md) | `components/hooks/useFrameSequence.ts:151` |
| Clock | one gsap ticker, `lagSmoothing(0)`. Lenis runs in `update`, sequences in `render`, and captions are driven from the sequence `onUpdate` in the same tick | `lib/frame-loop.ts`, `lib/gsap.ts` |
| Blend | frame floor(pos) is opaque, floor(pos)+1 is drawn over it at `smoothstep(frac)`, quantised to 1/64 | `lib/frame-sequence/math.ts:93-105` |

Frames per 60 Hz refresh = speed / (60 x px-per-frame), at vh 900:
- 600 px/s (peak of one Lenis-smoothed 100 px wheel notch = 100 x 6/s): **0.61**
- 1000 px/s (brisk reading scroll): **1.01**
- 2000 px/s (fast flick): 2.02. Frames are skipped here whatever the settings, because the source holds only 192 frames.

So at the current pace, normal scrolling stays at about 1 frame per refresh or less, and the blend always has two neighbouring frames to work with. **The remaining visible unevenness comes from the blend curve, not the pace.** `smoothstep` has zero slope at whole frames, so the picture dwells on each source frame and then hurries through the middle of the blend. At a slow 10 frames/s (6 refreshes per frame), the alpha step per refresh is 0.074, 0.185, 0.241, 0.241, 0.185, 0.074. That is a 3.3:1 swing that repeats 10 times a second, and it is seen as a soft stepping pulse. A linear curve gives 0.167 on every refresh.

---

## 2. Design decisions (would be `hx decision add`; hx not installed)

- **D1 Connector = CSS hairlines animated with `transform: scaleY`, not SVG `stroke-dashoffset`.** A 1 px gold div per gap with `transform-origin: top` is compositor-only. `stroke-dashoffset` repaints the SVG every tick and needs `getTotalLength()` measurement. The layout is a straight vertical rail, so no curves are needed. The elbow from a node to its box is a `::before` arm on the box.
- **D2 Layout = one vertical "workflow rail", bottom-left on every breakpoint** (the same anchor as today's captions). Each step = gold diamond node on the rail + arm + the existing cream plate. The steps sit in a track that glides up by one step per transition. Visible at most: previous step (dimmed to 0.42), current step, the next node as a faint target (0.35), and the node after that while it fades in during a glide (at most 4 rows at once). Viewports ≤ 700 px tall hide the dimmed previous step so the headline area stays clear.
- **D3 Scrubbed, not timed.** Every caption, node, line and spark value is a pure function of the same smoothed progress `p` that drives the frame engine. It is written in the same gsap tick (the existing `onUpdate` → `captionRef.current(p)` path). All CSS transitions on captions are removed. Scrolling back reverses everything exactly, and stopping freezes it in place.
- **D4 Timing: 60% hold / 40% transition per step** (`FLOW_TRANSITION_SHARE = 0.4`, was a 14% empty gap). Inside a transition `u ∈ [0,1]`, the connector draws over `u ∈ [0, 0.6]` and the glide plus next-box reveal run over `u ∈ [0.4, 1]`. Each phase is eased with smoothstep. The phases overlap by 0.2, so the motion never stops between "line arrives" and "box slides in". Every value is continuous in `p` (unit-tested), so nothing can pop.
- **D5 One continuous chain across Forex → Equities → Opportunity.** The group joins sit exactly on the folder hard cuts (1/3, 2/3), so a connector is mid-draw across each cut and carries the eye across the shot change.
- **D6 Frame pace and Lenis stay as they are:** 350vh per sequence and `lerp 0.1`, with no new smoothing stage. Reasons: (a) ≤ 1 frame per refresh already holds up to about 1000 px/s. (b) Reaching 1 frame per refresh at 1500 px/s would need 530vh (+51% scroll length). (c) Lenis is page-wide, and a second smoother brings back the measured rubber-band lag. Slowing the pace to 400vh is the only sensible option, so it is open question Q1.
- **D7 Blend curve: linear instead of smoothstep** (`BLEND_SOFTNESS = 0` in `lib/frame-sequence/math.ts`). It gives an even cross-dissolve rate on every refresh and removes the per-frame dwell. Draw-time blending, folder-join cuts, 1/64 quantisation and reduced-motion whole frames are all kept as they are. Cost: about 9% more two-image draws, because linear collapses to one frame only for frac < 1/128, while smoothstep does so for frac < about 0.05. The draws were measured at ≤ 0.2 ms. The knob is kept so the owner can soften it (see section 7). Caption phases keep smoothstep easing on purpose: they are one-off moves that should start and stop gently. The frame blend is a repeating signal, and there a dwell turns into a pulse.
- **D8 Reduced motion: discrete states.** Each transition switches at u = 0.7 (where `advance` would reach 0.5). There is no glide, no partial line and no spark. Lines up to the current node are fully drawn. Writes happen only when a value changes. This matches "reduced-motion whole frames".
- **D9 One gold style for both sections.** Crypto and Forex frames are light beige, while Stock and Opportunity frames are dark. Nodes and lines use the seam gold gradient plus a faint cream halo (`rgba(250,246,237,.3-.55)`, the plate colour), so they read on both. The plate keeps its exact current look: cream `rgba(250,246,237,0.82)`, gold border `rgba(212,175,55,0.55)`, ink `#0B0B0B`, wide-tracked small-caps label, display serif line.
- **D10 Copy is unchanged.** The same 6 + 15 lines in the same order. Only the window timing changes.

---

## 3. Changes

### Phase 1: Frame blend curve (commit "Frames: linear blend alpha for even cross-dissolve cadence")

`lib/frame-sequence/math.ts`
- After `smoothstep` (line 79-82), add:
  ```ts
  /** Blend curve: 0 = linear (even cross-dissolve rate on every refresh, smoothest motion), 1 = smoothstep (dwells on whole frames). */
  export const BLEND_SOFTNESS = 0;
  /** Alpha of frame floor(pos)+1 for a fractional part `frac`. Clamped; blendAlpha(0)=0, (0.5)=0.5, (1)=1 for any softness in [0,1]. */
  export function blendAlpha(frac: number, softness: number = BLEND_SOFTNESS): number {
    const x = clamp01(frac);
    return x + (smoothstep(x) - x) * clamp01(softness);
  }
  ```
- `planBlend` line 101: `const q = Math.round(blendAlpha(frac) * BLEND_LEVELS);`
- `planBlend` doc comment line 89: replace "at smoothstep(frac)" with "at blendAlpha(frac)".

`lib/frame-sequence/engine.ts`
- Header comment lines 8-9: replace "(smoothstep alpha, 1/64 steps)" with "(blendAlpha, linear by default, 1/64 steps)". No code change.

`tests/frame-blend.test.mjs`
- Import line 3: `import { planBlend, smoothstep, blendAlpha, BLEND_SOFTNESS, BLEND_LEVELS } from '../lib/frame-sequence/math.ts';`
- Test "planBlend: alpha is smoothstep(frac), quantised to 1/64 steps" (line 41): rename it to "...alpha is blendAlpha(frac)..." and change the expectation to `Math.round(blendAlpha(frac) * BLEND_LEVELS)`.
- Test "alpha near 0 or 1 collapses" (line 51): change `30.01` to `30.005` and `30.99` to `30.995`. With a linear curve, 30.01 gives q = 1, so it legitimately blends. 30.005/30.995 collapse for every softness in [0,1].
- Add the tests listed in section 5.1.

### Phase 2: Pure flow math + tests (commit "Captions: pure workflow timing (caption-flow) with continuity tests")

New file `lib/caption-flow.ts`. It must be pure, with **no `@/` imports, no imports at all**, and only erasable TS (no enum, no namespace, no parameter properties), so that `node --test` can load it. It defines its own `clamp01` and `ease`.

```ts
export const FLOW_TRANSITION_SHARE = 0.4; // share of each step spent moving; 0.6 holds still for reading
export const FLOW_DRAW_END = 0.6;         // connector draws over u ∈ [0, 0.6] of a transition
export const FLOW_ADVANCE_START = 0.4;    // glide + next-box reveal over u ∈ [0.4, 1]
export const FLOW_PREV_DIM = 0.42;        // opacity of the previous step (the trail)
export const FLOW_TARGET_FAINT = 0.35;    // opacity of a node that has not been reached yet
export const FLOW_NODE_MIN_SCALE = 0.6;   // unreached node scale
export const FLOW_PLATE_SHIFT_PX = 12;    // box slides in from the rail by this much
export const FLOW_LIFT_PX = 16;           // whole flow rises this much on intro / exit

export interface FlowWindow { start: number; end: number }       // hold window: fully shown while start <= p <= end
export interface FlowSpec { from: number; to: number; steps: readonly FlowWindow[] }
export interface FlowState { index: number; draw: number; advance: number; enter: number; exit: number }
export interface StepStyle { presence: number; node: number; nodeScale: number; plate: number; plateX: number; line: number; lineOpacity: number }
export interface SparkStyle { y: number; opacity: number }
```
Helpers (internal): `clamp01(v)`, `ease(t) = t*t*(3-2t)` on clamped t, `ramp(x, a, b) = b > a ? clamp01((x-a)/(b-a)) : (x >= b ? 1 : 0)`.

1. `export function spreadWindows(count: number, from: number, to: number, share: number = FLOW_TRANSITION_SHARE): FlowWindow[]`
   `step = (to-from)/count`, `gap = step*share`, window i = `{ start: from + i*step + gap/2, end: from + (i+1)*step - gap/2 }`. This is the same formula as today's `spread()` with 0.14 replaced by `share`. `count <= 0` → `[]`.

2. `export function flowState(p: number, flow: FlowSpec, reduced: boolean = false, out?: FlowState): FlowState`
   Writes into `out` when it is given (no per-tick allocation), otherwise into a new object. Algorithm:
   ```
   s = out ?? {}; s.index=0; s.draw=0; s.advance=0; s.enter=0; s.exit=0
   n = steps.length; if n === 0 return s
   x = p is NaN or -Infinity ? 0 : p === +Infinity ? 1 : clamp01(p)
   if x < steps[0].start:            s.enter = ease(ramp(x, flow.from, steps[0].start))      // intro, index 0
   else:
     s.enter = 1
     i = 0; while (i < n-1 && x >= steps[i+1].start) i++                                       // last step whose start <= x
     s.index = i
     if x > steps[i].end:
       if i < n-1:  u = ramp(x, steps[i].end, steps[i+1].start)
                    s.draw    = ease(clamp01(u / FLOW_DRAW_END))
                    s.advance = ease(clamp01((u - FLOW_ADVANCE_START) / (1 - FLOW_ADVANCE_START)))
       else:        s.exit = ease(ramp(x, steps[i].end, flow.to))                              // outro after the last hold
   if reduced:
     if s.advance >= 0.5 && s.index < n-1: s.index += 1                                        // switch at u = 0.7
     s.draw = 0; s.advance = 0; s.enter = s.enter >= 0.5 ? 1 : 0; s.exit = s.exit >= 0.5 ? 1 : 0
   return s
   ```

3. `export function stepStyle(j: number, s: FlowState, prevDim: number, out?: StepStyle): StepStyle`
   ```
   i = s.index; live = 1 - s.exit
   presence = j === i-1 ? prevDim * (1 - s.advance)
            : j === i   ? s.enter * (1 - (1 - prevDim) * s.advance)
            : j === i+1 ? s.enter
            : j === i+2 ? s.advance
            : 0
   presence *= live
   reveal   = j < i ? 1 : j === i ? s.enter : j === i+1 ? s.advance : 0
   line     = j < i ? 1 : j === i ? s.draw : 0                 // connector j -> j+1
   node        = presence * (FLOW_TARGET_FAINT + (1 - FLOW_TARGET_FAINT) * reveal)
   nodeScale   = FLOW_NODE_MIN_SCALE + (1 - FLOW_NODE_MIN_SCALE) * reveal
   plate       = presence * reveal
   plateX      = -(1 - reveal) * FLOW_PLATE_SHIFT_PX
   lineOpacity = presence
   ```

4. `export function trackOffset(rowTop: ArrayLike<number>, s: FlowState): number`
   `n = rowTop.length; if n === 0 return 0; i = min(s.index, n-1); k = min(i+1, n-1)`
   `return rowTop[i] + (rowTop[k] - rowTop[i]) * s.advance + FLOW_LIFT_PX * (s.exit - (1 - s.enter))`
   During a hold this is exactly `rowTop[i]` (an integer from `offsetTop`), so the text is pixel-crisp at rest. The component applies `translate3d(0, -offset px, 0)`.

5. `export function sparkStyle(rowTop: ArrayLike<number>, nodeY: number, s: FlowState, out?: SparkStyle): SparkStyle`
   `n = rowTop.length; i = s.index`
   If `n === 0 || i >= n-1 || !(s.draw > 0 && s.draw < 1)`, return `{ y: (n ? rowTop[min(i,n-1)] : 0) + nodeY, opacity: 0 }`.
   Otherwise `y = rowTop[i] + nodeY + s.draw * (rowTop[i+1] - rowTop[i])` and `opacity = Math.sin(Math.PI * s.draw) * (1 - s.exit)`.

New file `tests/caption-flow.test.mjs`: see section 5.2.

### Phase 3: Data, component, CSS, call sites (commit "Captions: connected workflow rail scrubbed from the frame tick")

`lib/scroll-captions.ts`
- Add `import { spreadWindows, type FlowWindow } from '@/lib/caption-flow';`
- `export interface ScrollCaption extends FlowWindow { label: string; text: string; }`. Remove the separate `start`/`end` fields, since they are inherited. Update the doc comment: "Fully shown while start <= progress <= end; the connector to the next step draws between end and the next start."
- `export interface CaptionFlow { from: number; to: number; steps: ScrollCaption[] }`
- `spread(lines, from, to)` becomes `spreadWindows(lines.length, from, to).map((w, i) => ({ label: lines[i][0], text: lines[i][1], start: w.start, end: w.end }))`.
- Replace `CRYPTO_CAPTIONS` with `export const CRYPTO_FLOW: CaptionFlow = { from: 0.04, to: 0.94, steps: spread([...same 6 pairs, same order...], 0.04, 0.94) };`
- Replace `FOREX_CAPTIONS` with `export const FOREX_FLOW: CaptionFlow = { from: 0.01, to: 0.91, steps: [...spread(group1, 0.01, T), ...spread(group2, T, 2 * T), ...spread(group3, 2 * T, 0.91)] };`. The 15 pairs and their order are exactly as today. Keep the existing comments about the copy source and "ends by 0.91".

`components/sections/ScrollCaptions.tsx`: full rewrite. Keep the file name, the export names `ScrollCaptions` and `CaptionDriver` (same type), the default export, `'use client'` and `INK = '#0B0B0B'`.
- Props: `{ flow: CaptionFlow; driverRef: CaptionDriver }`.
- Imports: `useEffect, useRef` from react; `type CaptionFlow` from `@/lib/scroll-captions`; `flowState, stepStyle, trackOffset, sparkStyle, FLOW_PREV_DIM, type FlowState, type StepStyle, type SparkStyle` from `@/lib/caption-flow`.
- Refs: `trackRef`, `sparkRef` (HTMLDivElement / HTMLSpanElement) and arrays `rowRefs`, `nodeRefs`, `plateRefs`, `lineRefs` (`useRef<Array<HTMLElement | null>>([])`, assigned in ref callbacks like today).
- Markup (`aria-hidden="true"`, `pointer-events-none`; `n = flow.steps.length`):
  ```
  <div aria-hidden className="wf absolute inset-x-0 z-40 pointer-events-none"
       style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--wf-focus))', height: 0 }}>
    <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8 md:px-12 lg:px-16">
      <div className="relative">
        <div ref={trackRef} className="wf__track">
          {steps.map((c, i) => (
            <div key={`${c.label}-${c.text}-${i}`} ref={rowRefs[i]} className="wf__step">
              {i < n - 1 && <span ref={lineRefs[i]} className="wf__line" />}   // line BEFORE node: node paints on top
              <span ref={nodeRefs[i]} className="wf__node" />
              <div ref={plateRefs[i]} className="wf__plate w-fit max-w-[88%] md:max-w-md rounded-sm px-4 py-3 md:px-5 md:py-3.5"
                   style={{ background: 'rgba(250,246,237,0.82)', border: '1px solid rgba(212,175,55,0.55)', color: INK }}>
                {label div: unchanged classes + style from today (lines 78-83)}
                {text div:  unchanged classes + style from today (lines 84-89)}
              </div>
            </div>
          ))}
          <span ref={sparkRef} className="wf__spark" />
        </div>
      </div>
    </div>
  </div>
  ```
  Every `ref={xRefs[i]}` above means a ref callback `(el) => { xRefs.current[i] = el; }`, as in today's file.
  The `.wf` root's top edge is the **focus line**. The track hangs from it, and translating the track by `-trackOffset` puts the current row's top on that line. Initial styles all come from CSS (everything hidden), so SSR markup shows nothing until the first scrubbed write.
- One `useEffect(..., [flow, driverRef])` with no React state:
  - Locals: `n`, `rowTop = new Float64Array(n)`, `nodeY = 0`, `measured = false`, `painted = false`, `lastP = 0`, `disposed = false`. Scratch objects: `st: FlowState`, `ss: StepStyle`, `sp: SparkStyle`. Write caches: string arrays `cVis, cNodeO, cNodeT, cPlateO, cPlateT, cLineT, cLineO` (length n) and strings `cTrack, cSparkT, cSparkO`. `invalidate()` resets every cache to `''`.
  - `reduceMq = matchMedia('(prefers-reduced-motion: reduce)')`, `shortMq = matchMedia('(max-height: 700px)')`, `let reduced = reduceMq.matches`, `let prevDim = shortMq.matches ? 0 : FLOW_PREV_DIM`.
  - `put(el, cache, idx, value, write)`: write only if `cache[idx] !== value`. This is the same idea as Forex's `put()`.
  - `apply(p: number, force = false)`: `if (!force && painted && p === lastP) return; lastP = p; if (!measured) return; painted = true;`
    - `flowState(p, flow, reduced, st)`
    - For every row `j` in `0..n-1`, call `stepStyle(j, st, prevDim, ss)` and then:
      - row `visibility`: `ss.presence > 0.0005 ? 'visible' : 'hidden'`
      - node `opacity` `ss.node.toFixed(3)`; node `transform` `` `rotate(45deg) scale(${ss.nodeScale.toFixed(4)})` ``
      - plate `opacity` `ss.plate.toFixed(3)`; plate `transform` `` `translate3d(${ss.plateX.toFixed(2)}px,0,0)` ``
      - if `j < n-1`: line `transform` `` `scaleY(${ss.line.toFixed(4)})` ``; line `opacity` `ss.lineOpacity.toFixed(3)`
    - track `transform` `` `translate3d(0,${(-trackOffset(rowTop, st)).toFixed(2)}px,0)` ``
    - `sparkStyle(rowTop, nodeY, st, sp)`: spark `transform` `` `translate3d(0,${sp.y.toFixed(2)}px,0)` ``, spark `opacity` `(reduced ? 0 : sp.opacity).toFixed(3)`
  - `measure()` is the only layout read, and it runs on resize and fonts only, never per tick: `rowTop[j] = rowRefs[j]?.offsetTop ?? 0`. Then `const n0 = nodeRefs[0]; nodeY = n0 ? n0.offsetTop + n0.offsetHeight / 2 : 0`. Then `prevDim = shortMq.matches ? 0 : FLOW_PREV_DIM; measured = true; invalidate(); apply(lastP, true)`. `offsetTop` ignores transforms, so the track's own translate does not distort it.
  - `ro = new ResizeObserver(measure); ro.observe(trackRef.current)`. The track height changes on viewport width changes and font swaps. Also `document.fonts?.ready.then(() => { if (!disposed) measure(); })`.
  - `reduceMq` change → `reduced = e.matches; invalidate(); apply(lastP, true)`. `shortMq` change → `measure()`.
  - `driverRef.current = (p) => apply(p)`.
  - Cleanup: `disposed = true; driverRef.current = null; ro.disconnect();` and remove both mq listeners.
  - Per tick this is about 15 x 7 cached string compares and at most about 10 real style writes during a transition (zero during holds once settled). No layout reads and no React renders.

`app/globals.css`: replace lines 902-908 (the `.scroll-caption` block) with:
```css
/* ─── Workflow captions (components/sections/ScrollCaptions.tsx) ─── */
/* Scrubbed from the frame tick by JS: transform + opacity only, no CSS transitions. Mobile first; md = 48rem. */
.wf { --wf-rail: 1.375rem; --wf-gap: 1.25rem; --wf-node: 8px; --wf-node-y: 1.15rem; --wf-focus: 9.5rem; }
@media (width >= 48rem) { .wf { --wf-rail: 1.75rem; --wf-gap: 1.75rem; --wf-node: 9px; --wf-node-y: 1.35rem; --wf-focus: 11.5rem; } }
.wf__track { position: absolute; left: 0; top: 0; width: 100%; display: flex; flex-direction: column; gap: var(--wf-gap); will-change: transform; }
.wf__step { position: relative; padding-left: var(--wf-rail); visibility: hidden; }
.wf__node { position: absolute; left: 0; top: var(--wf-node-y); width: var(--wf-node); height: var(--wf-node); margin-top: calc(var(--wf-node) / -2);
  background: linear-gradient(135deg, #F6E3A1, #D4AF37 50%, #8C6D23);
  box-shadow: 0 0 0 1px rgba(250, 246, 237, .55), 0 0 12px rgba(212, 175, 55, .5);
  opacity: 0; transform: rotate(45deg) scale(.6); will-change: transform, opacity; }
.wf__line { position: absolute; left: calc(var(--wf-node) / 2 - .5px); top: var(--wf-node-y);
  bottom: calc(-1 * (var(--wf-gap) + var(--wf-node-y))); width: 1px;
  background: linear-gradient(180deg, #D4AF37, #B38728);
  box-shadow: 0 0 0 .5px rgba(250, 246, 237, .3), 0 0 8px rgba(212, 175, 55, .35);
  transform-origin: 50% 0; transform: scaleY(0); opacity: 0; will-change: transform, opacity; }
.wf__plate { position: relative; opacity: 0; will-change: transform, opacity; }
.wf__plate::before { content: ''; position: absolute; right: 100%; top: calc(var(--wf-node-y) - 1.5px); height: 1px;
  width: calc(var(--wf-rail) - var(--wf-node) * 1.5);
  background: linear-gradient(90deg, rgba(179, 135, 40, .5), #B38728); }
.wf__spark { position: absolute; left: calc(var(--wf-node) / 2); top: 0; width: 14px; height: 14px; margin: -7px 0 0 -7px;
  border-radius: 50%; opacity: 0; pointer-events: none; will-change: transform, opacity;
  background: radial-gradient(circle, #fff 0 20%, #F6E3A1 42%, rgba(212, 175, 55, 0) 70%); }
@media (prefers-reduced-motion: reduce) { .wf__spark { display: none; } }
```
Geometry notes for the coder:
- `.wf__line` runs from this row's node centre to the next row's node centre, because rows are separated by exactly `--wf-gap`. Its length is therefore `rowHeight + gap = rowTop[j+1] - rowTop[j]`, which is the same length `sparkStyle` uses.
- The arm `top` is `node-y - 0.5px - 1px`, because the `::before` containing block starts inside the plate's 1px border.
- `--wf-focus` is the distance from the viewport bottom (plus safe area) to the current box's top. Desktop 184 px: a one-line box is about 80 px, so the next node sits about 54 px above the bottom. Mobile 152 px: a two-line box is about 95 px, so the next node still sits about 19 px above the bottom.
- **Visible change:** the current box now sits about 60-80 px higher than today, to make room for the connector and next node below it.

`components/sections/CryptoMarketScroll.tsx`
- Line 8: `import { CRYPTO_FLOW } from '@/lib/scroll-captions';`
- Line 134: `<ScrollCaptions flow={CRYPTO_FLOW} driverRef={captionRef} />`. The `onUpdate` call `captionRef.current?.(progress)` is unchanged.

`components/sections/ForexMarketScroll.tsx`
- Line 8: `import { FOREX_FLOW } from '@/lib/scroll-captions';`
- Line 430: `<ScrollCaptions flow={FOREX_FLOW} driverRef={captionRef} />`. The `onUpdate` call `captionRef.current?.(Math.min(1, progress / FRAME_SCROLL_PORTION))` is unchanged.

Not changed: `useFrameSequence.ts`, `LenisProvider.tsx`, `sources.ts` (pace), `DepthStage.tsx`, `lib/content.ts`, anything under `public/`.

---

## 4. Timing numbers (what the owner will feel)

Caption timing, in vh of scroll (at vh 900, 1vh = 9 px; a Windows wheel notch is 100 px ≈ 11vh):

| Flow | Step | Hold (box still) | Transition (line + glide) | Intro / exit |
|---|---|---|---|---|
| Crypto, 6 steps, p 0.04-0.94 of 350vh | 52.5vh | 31.5vh | 21.0vh (draw 12.6, glide 12.6, overlap 4.2) | 10.5vh |
| Forex group 1 (forex), 5 steps, 0.01-1/3 of 1050vh | 67.9vh | 40.7vh | 27.2vh | intro 13.6vh |
| Forex group 2 (equities), 1/3-2/3 | 70.0vh | 42.0vh | 28.0vh | - |
| Forex group 3 (chapters + brand), 2/3-0.91 | 51.1vh | 30.7vh | 20.4vh | exit 10.2vh |
| Group joins (at the folder cuts) | - | - | 27.6vh / 24.2vh | - |

A transition spans about 2 wheel notches, and Lenis (τ 167 ms) smooths that into roughly 0.4-0.6 s of continuous motion. Before this change, the empty gap was 66 px, less than one notch.

Frame motion after this change: pace and Lenis are unchanged (D6). With the blend now linear (D7), the per-refresh alpha step is constant at any steady speed. Captions read the same `p` as `frameForProgress` in the same tick, so text and frames cannot drift apart.

---

## 5. Tests (pure math only; `node --test` loads `.ts` directly)

### 5.1 `tests/frame-blend.test.mjs` (additions)
1. `BLEND_SOFTNESS === 0` (documents the chosen value).
2. `blendAlpha`: for softness in `[0, 0.5, 1]`, `blendAlpha(0,s) === 0`, `blendAlpha(1,s) === 1` and `blendAlpha(0.5,s) === 0.5`. It clamps (`-1 → 0`, `2 → 1`) and is monotonic over 101 samples.
3. `blendAlpha(x, 0) === x` and `blendAlpha(x, 1) === smoothstep(x)` for x in `[0.1, 0.25, 0.6, 0.9]` (within 1e-12).
4. Even cadence: for positions `40 + k/6`, `k = 0..6`, map each `planBlend` to an effective q (q if `b >= 0`, `BLEND_LEVELS` if `a === 41`, else 0). The 6 consecutive differences satisfy `max - min <= 1` (linear gives 11, 10, 11, 11, 10, 11). Add a comment that smoothstep gives 5, 12, 15, 15, 12, 5.
5. The existing tests stay, with the two edits from Phase 1.

### 5.2 `tests/caption-flow.test.mjs` (new)
Fixtures in the test (mirror `lib/scroll-captions.ts`, which cannot be imported because it uses `@/`):
`CRYPTO = { from: 0.04, to: 0.94, steps: spreadWindows(6, 0.04, 0.94) }`
`T = 1/3; FOREX = { from: 0.01, to: 0.91, steps: [...spreadWindows(5, 0.01, T), ...spreadWindows(5, T, 2*T), ...spreadWindows(5, 2*T, 0.91)] }`
`rowTop` fixture: `Float64Array.from({length: n}, (_, j) => j * 112 + (j % 3) * 9)` (uneven heights); `nodeY = 20`.

1. `spreadWindows(6, 0.04, 0.94)`: length 6; `[0].start ≈ 0.07`, `[0].end ≈ 0.16`, `[5].start ≈ 0.82`, `[5].end ≈ 0.91`; every hold is ≈ 0.09 and every gap ≈ 0.06 (1e-12); strictly increasing. `spreadWindows(4, 0, 1, 0)` tiles `[0,.25],[.25,.5],...`. `spreadWindows(0, 0, 1)` is `[]`.
2. `flowState` before `from`, at `p = 0`, at `NaN` and at `-Infinity` gives `{index 0, draw 0, advance 0, enter 0, exit 0}`. `p = +Infinity` and `p = 1` give `index n-1, exit 1`.
3. Hold midpoints for every i in both fixtures give `{index i, enter 1, draw 0, advance 0, exit 0}`, and `trackOffset(rowTop, s) === rowTop[i]` **exactly** (crisp text at rest).
4. Transition phases (Crypto, i = 2, `u` = fraction between `steps[2].end` and `steps[3].start`):
   - u = 0.3: draw ≈ 0.5, advance = 0
   - u = 0.5: draw ≈ ease(5/6) = 0.9259, advance ≈ ease(1/6) = 0.0741
   - u = 0.7: draw = 1, advance ≈ 0.5
   - u = 0.999999: advance > 0.99999
5. Continuity ("nothing can pop"): for both fixtures, sample p from 0 to 1 in steps of 1e-5. For every row j, across consecutive samples:
   - presence, node, nodeScale, plate, line and lineOpacity each change by < 0.01
   - plateX changes by < 0.05 px
   - `trackOffset` changes by < 0.5 px
   - `sparkStyle` opacity changes by < 0.01 and y by < 0.5 px
   (The analytic worst case, Forex group 3, is about 0.0015 / 0.02 px / 0.2 px.)
6. Index-switch seam: for every i < n-1, `stepStyle(j, flowState(steps[i+1].start - 1e-9))` ≈ `stepStyle(j, flowState(steps[i+1].start))` for j in i-1..i+3 (1e-6), and the same for `trackOffset`.
7. Window size: across the samples in test 5, the rows with `presence > 0` are a subset of `[index-1, index+2]` (at most 4 rows).
8. The connector is drawing across each Forex folder cut: at `p = T` and `p = 2*T`, `flowState(p, FOREX)` has `0 < draw <= 1` and `index` 4 and 9 respectively.
9. Spark: opacity is 0 in every hold midpoint, at the intro (`p = 0.05` for Crypto), at the exit (`p = 0.93`), on the last index, and when `reduced`. At a transition where draw = 0.5 (u = 0.3), opacity ≈ 1 and `y ≈ rowTop[i] + nodeY + 0.5 * (rowTop[i+1] - rowTop[i])`.
10. Reduced motion: over all samples, `draw === 0` and `advance === 0`; enter and exit are in `{0, 1}`; `index` never decreases as p increases. Inside transition i the index switches from i to i+1 at u = 0.7 (± 1e-3). Every `stepStyle` field is in the discrete set `{0, 1, FLOW_PREV_DIM, FLOW_TARGET_FAINT, FLOW_NODE_MIN_SCALE, -FLOW_PLATE_SHIFT_PX}` (1e-9).
11. `stepStyle` with `prevDim = 0` (short viewport): the previous row's presence is 0 in every hold.
12. Exit: `trackOffset` at `p = 1` equals `rowTop[n-1] + FLOW_LIFT_PX`. All presences are 0.

---

## 6. Verification commands
```sh
cd C:/Users/Suhas/Desktop/MOP_lux/masterogpipsology_client
node --test tests/caption-flow.test.mjs tests/frame-blend.test.mjs   # fast loop while coding
corepack pnpm test && corepack pnpm lint && corepack pnpm build
git diff --stat   # expect: math.ts, engine.ts (comment), caption-flow.ts (new), scroll-captions.ts, ScrollCaptions.tsx, globals.css, CryptoMarketScroll.tsx, ForexMarketScroll.tsx, 2 test files. Nothing under public/, no lib/content.ts.
git diff lib/scroll-captions.ts   # copy pairs identical, same order; only spread/flow wiring changed
```
No browser automation. The owner checks visually on :3000 (section 7).

## 7. Acceptance (owner checks visually)
1. Crypto and Forex: the boxes form one connected rail. A gold line draws down from the current node to a faint next node, a small spark rides its tip, the next node lights, its box slides in from the rail, and the rail glides up one step. The previous box stays dimmed above. There is never a moment with no box and no line mid-section.
2. Stop scrolling mid-transition: everything freezes in place. Scroll back: it reverses exactly. Nothing keeps animating on a timer.
3. Forex: the line is mid-draw at the forex → stock and stock → opportunity shot cuts. The chain continues through to the last box and fades out before the HUD fade and the video hand-off (unchanged timing).
4. Same theme: cream plate, gold border, black serif line and small-caps label look identical to today. Nodes and lines are visible on the light (crypto/forex) and dark (stock/opportunity) frames.
5. Frames: at a slow, steady scroll the image glides with no "stepping" pulse. If resting frames look soft or ghosted, set `BLEND_SOFTNESS = 0.5` in `lib/frame-sequence/math.ts` (half-way to the old smoothstep; one-line revert to `1`).
6. Phone (real iPhone per rules.md): the rail sits bottom-left, the current box plus the next node fit above the home indicator, and nothing overlaps the headline. On short viewports (≤ 700 px tall) the dimmed previous box is hidden.
7. DevTools > Rendering > emulate `prefers-reduced-motion: reduce`: boxes switch in whole steps with no glide, no spark and no partial lines. Frames show whole frames.
8. Performance: in the DevTools Performance panel, scrolling through both sections shows no Layout events per frame from the captions (only on resize), and no long tasks.

## 8. Out of scope
Pace change (Q1), Lenis tuning, decode or fetch scheduling, the hand-off video, and caption copy.

## 9. Open questions for the owner
- **Q1 Frame pace.** Keep 350vh per sequence (recommended; 16.5 px of scroll per frame, about 1 frame per refresh at a brisk scroll) or slow it to 400vh (18.9 px per frame, so 12.5% fewer frames per refresh at any given scroll speed)? 400vh makes Crypto 450→500vh and Forex 1570→1720vh. It is a one-constant change (`SEQ_SCROLL_VH` in `lib/frame-sequence/sources.ts` and its test). Caption timings are in progress units and scale automatically. The hand-off offsets are measured in vh from the end of the frames and stay correct.
