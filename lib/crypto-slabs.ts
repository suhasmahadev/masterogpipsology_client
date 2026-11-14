// Pure timing and geometry for the Crypto slab texts (components/sections/CryptoSlabs.tsx) and the Crypto caption
// rail timing (lib/scroll-captions.ts CRYPTO_FLOW). Import-free.

/** In over [inFrom, inTo], fully shown until outFrom, out over [outFrom, outTo]. Units: stop coordinate s (lib/step-scroll stopCoord). */
export interface SlabWindow { inFrom: number; inTo: number; outFrom: number; outTo: number }
export type SlabId = 'intro' | 'teach' | 'close';

// s: -1..0 approach, 0..3 the three slabs (stops raw 1, 112, 139, 179), 3..4 slab 4: the hand-off glide 179 -> Forex frame 1.
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

/** Style of part j of n at stop coordinate s. Continuous in s; reduced = whole-part crossfade over the windows, no movement. */
export function slabPart(s: number, w: SlabWindow, j: number, n: number, reduced: boolean = false, out?: PartStyle): PartStyle {
  const o: PartStyle = out ?? { opacity: 0, y: 0 };
  const x = Number.isNaN(s) ? -Infinity : s;
  if (reduced) {
    o.opacity = smooth(ramp(x, w.inFrom, w.inTo)) * (1 - smooth(ramp(x, w.outFrom, w.outTo)));
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

/** 0 before inFrom, 1 entering, 2 hold [inTo, outFrom), 3 leaving [outFrom, outTo], 4 after. Even zones are static. NaN -> 0. */
export function slabZone(s: number, w: SlabWindow): 0 | 1 | 2 | 3 | 4 {
  if (Number.isNaN(s) || s < w.inFrom) return 0;
  if (s < w.inTo) return 1;
  if (s < w.outFrom) return 2;
  if (s <= w.outTo) return 3;
  return 4;
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
