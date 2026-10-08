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

**Targets:**
- Lighthouse 90+
- No long tasks during fast scroll
- 60 fps minimum on production devices

---

## 3. Content Rules

- **Copy:** Don't change unless owner explicitly asks
- **Metrics:** No fake numbers — no hardcoded/random counters, stats, FPS readouts, or "real data" you invented. Only real data is allowed.
- **Assets:** Never delete
- **Social links:** Placeholders in `lib/content.ts` — verify names before launch:
  - `TELEGRAM_URL` (currently `'#telegram'`)
  - `WHATSAPP_URL` (currently `'#whatsapp'`)
- **Join buttons:** Live only in navbar and mobile menu (nowhere else)

---

## 4. Design Rules

**Owner's decisions — locked:**

- **Palette:** Warm beige/cream, marble and gold → dark as you scroll
- **Typography:**
  - Display: Cormorant Garamond
  - Body: Manrope
  - Labels: Wide-tracked small caps
- **Hero:** Original static photo (`root hero.png` via `next/image`) + only gentle scroll zoom. No dark overlays, no 3D.
- **Headlines:** Letter by letter with gold "execution" and light flare on its first "e"
- **Nav chips:** Soft foggy beige-gold border-trace, then fill on hover (nothing flashy)
- **Nav reflection:** Sweep every 5 seconds
- **Cursor:** No custom cursor
- **Sections:**
  - Crypto → Forex: Forex fades in and overlaps Crypto
  - Intelligence: Show only "Be a man." / "Take that goddamn risk."
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
| `lib/content.ts` | All copy, `TELEGRAM_URL`, `WHATSAPP_URL` |
| `docs/FRAME_QUALITY.md` | Frame pipeline: extract, upscale, denoise, encode |
| `package.json` | Scripts: `frames`, `build`, `test` |

---

**Last updated:** 2026-10-08
