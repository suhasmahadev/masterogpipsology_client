# Rules: Master of Pipsology

Rulebook for anyone (human or AI) changing or deploying this site. Commit before each change; the owner tests visually before any go-ahead.

---

## 1. Deployment & Caching

**Immutable assets** (`/assets`, `/frames`, `/textures`, `/hero`, `/intelligence-layer.mp4`): served with `Cache-Control: public, max-age=31536000, immutable` (one year). Never replace a file in place.

- **Versioning rule:** Write a new folder (e.g. `/frames/v2`) and bump `FRAME_SET_VERSION` in `lib/frame-sequence/sources.ts` (currently `v1`).
- **Deployment size:** `public/` ≈ 128 MB current. Check before deploy (add new frames → ~140 MB).
- **Unused files:** `public/background_image.png` and `public/bhurj_khalifa.png` — only delete with owner's approval.
- **Pre-deploy checklist:**
  - `corepack pnpm build`
  - `corepack pnpm test`
  - Real iPhone fast scroll through Crypto and Forex sections
  - No visual jank, dropped frames, or layout shift

**Frame regeneration:**
- Script: `corepack pnpm frames` (writes WebP sets to `/frames/v1/<seq>/{1280,p1080}/`)
- Originals: `public/assets/<seq>/ezgif-frame-NNN.jpg` (1920×1080 JPEG fallback) must never be overwritten
- See `docs/FRAME_QUALITY.md` for full pipeline (upscale, denoise, encode)

---

## 2. Performance Rules

**Animation constraints:**
- Animate only `transform` and `opacity`. No animated CSS filters (blur, saturate), no `top`/`left`, no `width`, no html-wide CSS variables per frame.
- Single shared clock: `gsap.ticker` via `lib/frame-loop.ts` — no extra `requestAnimationFrame` loops
- Lenis feeds ScrollTrigger; no competing scroll libraries

**Frame engine:**
- Decode with plain `createImageBitmap(blob)` — no resize options (they run on main thread)
- Draw only on frame change
- Respect shared memory budget (cap instance count, compress textures, pause off-screen rendering)

**Viewport & responsiveness:**
- DPR cap: 2
- Lazy-load below the fold
- WebGL/Three.js: lazy-loaded with static fallbacks
- Respect `prefers-reduced-motion`

**Scroll timing (step scroll, `lib/step-scroll.ts` → `STEP_TUNING`):**
- Every tunable lives in `STEP_TUNING`: min push per device (touch 8 px, wheel 1 px, trackpad 3 px), base glide (48 fps,
  0.4 s ease-in, 1.0 s brake), speed steps 1 / 1.4 / 1.8 / 2.2 x (cap level 3), streak window 600 ms, final-stop holds
  700 / 500 / 350 / 250 ms by level (80–250 ms when input is queued), run extension cap 3 stops, reverse brake 0.3 s,
  tap < 8 px and ≤ 300 ms. Change values there only.
- Extra same-direction swipes during a glide extend it straight through the next stops (continuous speed, brake only into the
  final stop; only the final stop holds). Input during a hold is queued, never dropped. Runs stop at sequence edges.
- Glides run on the shared ticker (`onEveryFrame(..., 'update')`, delta time); no own rAF, no Lenis duration tweens.
- Video auto-advance (Forex O3 → video) is `AUTO_ADVANCE_MS` = 450 ms, always 1x, never extended; not part of `STEP_TUNING`.
- Sticky stages use `touch-action: pan-y pinch-zoom`; `html.step-zone` disables overscroll inside the zone.
- Reduced motion: no Lenis, instant jumps, same queue and hold rules.

**Targets:**
- Lighthouse 90+
- No long tasks during fast scroll
- 60 fps minimum on production devices

---

## 3. Content Rules

- **Copy:** Don't change unless owner explicitly asks. Hook boxes (one per sequence stop, Crypto and Forex) are sourced from `CRYPTO_HOOKS` and `MARKET_HOOKS` in `lib/content.ts`. Workflow caption rails are no longer rendered. Hook text leaves over 0–0.25 of the glide away; incoming text reveals letter by letter over 0.25–1.0 of the glide into each stop, settling as the frame lands at any glide speed; hooks of stops passed mid-run may flash past but never overlap.
- **Metrics:** No fake numbers — no hardcoded/random counters, stats, FPS readouts, or "real data" you invented. Only real data is allowed.
- **Assets:** Never delete
- **Social links:** Placeholders in `lib/content.ts` — verify names before launch:
  - `TELEGRAM_URL` (currently `'#telegram'`)
  - `WHATSAPP_URL` (currently `'#whatsapp'`)
- **Join buttons:** Live in navbar, mobile menu, and Final CTA section. Final CTA "Join now" button reveals WhatsApp/Instagram/Telegram capsules via `JoinNow.tsx` using `JOIN_LINKS` from `lib/content.ts` (currently placeholder links; toggle with Escape/outside-click, respects reduced motion)

---

## 4. Design Rules

**Owner's decisions — locked:**

- **Palette:** Warm beige/cream, marble and gold → dark as you scroll
- **Typography:**
  - Display: Cormorant Garamond
  - Body: Manrope
  - Labels: Wide-tracked small caps
  - Crypto hook box: Bodoni Moda (display), motion 'Rise and lift' per letter; text reveals letter by letter over the glide, settling at the frame landing
  - Market hook box: Cinzel (display), motion 'Glide and ticker roll' per letter; text reveals letter by letter over the glide, settling at the frame landing
  - Section headlines (below the sequences): per-section faces (Cinzel, Bodoni Moda, Playfair Display, Italiana, Cormorant) with letter-by-letter reveals via LetterReveal.tsx (see docs/plans/section-letter-motion.md)
- **Hero:** Original static photo (`root hero.png` via `next/image`) + only gentle scroll zoom. No dark overlays, no 3D.
- **Headlines:** Letter by letter with gold "execution" and light flare on its first "e"
- **Nav chips:** Soft foggy beige-gold border-trace, then fill on hover (nothing flashy)
- **Nav reflection:** Sweep every 5 seconds
- **Cursor:** No custom cursor
- **Sections:**
  - Crypto → Forex: Forex fades in and overlaps Crypto
  - Intelligence: calm two-line serif closing statement (`CLOSING_LINES` in `lib/content.ts`), second line gold italic, fade-in only. No drips or effects.
  - Moments: Swipe card stack
  - Gold seam transitions between sections
  - Logo (Rings of Precision): Centred and locked

---

## 5. Workflow

- Work on `luxury-upgrade` branch
- **Commit before each change** so it can be rolled back
- No push or deploy without owner's explicit go-ahead
- Owner tests visually before launch
- `git status` before any destructive op (`reset --hard`, `checkout .`, `rm -rf`)

---

## Quick Reference

| File | What it does |
|------|------------|
| `next.config.ts` | Cache headers, image optimization |
| `lib/frame-sequence/sources.ts` | `FRAME_SET_VERSION`, frame URLs, tier selection |
| `lib/frame-loop.ts` | Shared gsap.ticker rAF loop |
| `lib/step-scroll.ts` | Step-scroll policy and `STEP_TUNING` (all scroll feel tunables) |
| `lib/content.ts` | All copy, `TELEGRAM_URL`, `WHATSAPP_URL` |
| `docs/FRAME_QUALITY.md` | Frame pipeline: extract, upscale, denoise, encode |
| `package.json` | Scripts: `frames`, `build`, `test` |

---

**Last updated:** 2026-10-26
