// Pure math for scroll-scrubbed text motion (components/sections/CryptoSlabs.tsx, ScrollCaptions variant "crypto").
// Import-free: node --test loads it. Every value is a function of the scrubbed coordinate only (no time).

export type UnitKind = 'tilt' | 'rise' | 'line' | 'pop' | 'roll' | 'track' | 'glide';

export const TM_RISE_PCT = 130;         // enters from this far below its mask (% of own height; clears mask padding .28em)
export const TM_LIFT_PCT = 130;         // leaves this far above
export const TM_TILT_IN_DEG = 40;       // 'tilt': rotateX while rising (origin 50% 100%: top edge leans away)
export const TM_TILT_OUT_DEG = 18;      // 'tilt': rotateX(-) while lifting out (tips forward)
export const TM_IN_PART_OVERLAP = 0.55; // parts of a block overlap this share while entering
export const TM_IN_UNIT_OVERLAP = 0.82; // units (words, letters) inside a part
export const TM_OUT_PART_OVERLAP = 0.7; // exits are tighter
export const TM_OUT_UNIT_OVERLAP = 0.9;
export const TM_ROLL_GLYPHS = 4;       // 'roll': the real letter plus 3 decoys stacked below at 100% steps
export const TM_ROLL_PCT = (TM_ROLL_GLYPHS - 1) * 100; // 300
export const TM_ROLL_OUT_X_PCT = 60;    // 'roll': the tape slides left by this much on exit
export const TM_TRACK_IN_PCT = 38;      // 'track': spread per unit of distance from the centre (% of own width), entering
export const TM_TRACK_OUT_PCT = 22;     // and leaving
export const TM_GLIDE_PCT = 105;        // 'glide': tape wipe, in from the right and out to the left
export const TM_MAX_UNITS = 60;         // per slab (dev warning + copy test)

export interface Span { a: number; b: number }
export interface UnitStyle { opacity: number; y: number; rot: number; x: number; scale: number }

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const ramp = (x: number, a: number, b: number): number => (b > a ? clamp01((x - a) / (b - a)) : x >= b ? 1 : 0);

const sc: Span = { a: 0, b: 0 };

/** Sub-window k of n over [from, to]: equal lengths d, starts d * (1 - overlap) apart, k = 0 starts at from, k = n - 1 ends at to. */
export function cascade(from: number, to: number, k: number, n: number, overlap: number, out?: Span): Span {
  const o: Span = out ?? { a: 0, b: 0 };
  const count = Math.max(1, Math.floor(n));
  const idx = clamp(Math.floor(k), 0, count - 1);
  const ov = clamp(overlap, 0, 0.99);
  const step = 1 - ov;
  const d = (to - from) / (1 + (count - 1) * step);
  o.a = from + idx * d * step;
  o.b = o.a + d;
  return o;
}

/** Raw 0..1 progress of unit (unit of units) in part (part of parts) over [from, to]. NaN -> 0; -Infinity -> 0; +Infinity -> 1. */
export function staged(x: number, from: number, to: number, part: number, parts: number, unit: number, units: number,
  partOverlap: number, unitOverlap: number): number {
  if (Number.isNaN(x)) return 0;
  cascade(from, to, part, parts, partOverlap, sc);
  cascade(sc.a, sc.b, unit, units, unitOverlap, sc);
  return ramp(x, sc.a, sc.b);
}

export function easeOutQuart(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 4);
}
export function easeInCubic(t: number): number {
  const c = clamp01(t);
  return c * c * c;
}

/** Eased entry 0..1 (easeOutQuart of staged with the IN overlaps). */
export function enterAt(x: number, from: number, to: number, part: number, parts: number, unit: number, units: number): number {
  return easeOutQuart(staged(x, from, to, part, parts, unit, units, TM_IN_PART_OVERLAP, TM_IN_UNIT_OVERLAP));
}
/** Eased exit 0..1 (easeInCubic of staged with the OUT overlaps). */
export function leaveAt(x: number, from: number, to: number, part: number, parts: number, unit: number, units: number): number {
  return easeInCubic(staged(x, from, to, part, parts, unit, units, TM_OUT_PART_OVERLAP, TM_OUT_UNIT_OVERLAP));
}

/** Style for entry vin and exit vout (both 0..1). Settled (vin 1, vout 0) = identity for every kind. */
/** k = signed offset of the unit from the part centre (used by 'track' only). */
export function unitStyle(kind: UnitKind, vin: number, vout: number, out?: UnitStyle, k: number = 0): UnitStyle {
  const o: UnitStyle = out ?? { opacity: 0, y: 0, rot: 0, x: 0, scale: 1 };
  o.opacity = vin * (1 - vout);
  o.y = 0;
  o.rot = 0;
  o.x = 0;
  o.scale = 1;
  if (kind === 'tilt' || kind === 'rise') {
    o.y = (1 - vin) * TM_RISE_PCT - vout * TM_LIFT_PCT;
    if (kind === 'tilt') o.rot = (1 - vin) * TM_TILT_IN_DEG - vout * TM_TILT_OUT_DEG;
  } else if (kind === 'roll') {
    o.y = (vin - 1) * TM_ROLL_PCT;
    o.x = 0 - vout * TM_ROLL_OUT_X_PCT; // (0 - ...) and (... + 0) keep the settled state +0, never -0
  } else if (kind === 'track') {
    o.x = k * ((1 - vin) * TM_TRACK_IN_PCT + vout * TM_TRACK_OUT_PCT) + 0;
  } else if (kind === 'glide') {
    o.x = (1 - vin) * TM_GLIDE_PCT - vout * TM_GLIDE_PCT;
  } else if (kind === 'line') {
    o.scale = Math.max(0, vin - vout);
    o.x = vout * 100;
    o.opacity = o.scale > 0 ? 1 : 0;
  } else {
    o.scale = vin * (1 - vout);
  }
  return o;
}

/** CSS transform for a style. dir = -1 mirrors 'line' (origin on the right). */
export function unitTransform(kind: UnitKind, st: UnitStyle, dir: number): string {
  if (kind === 'tilt') return `translate3d(0,${st.y.toFixed(2)}%,0) rotateX(${st.rot.toFixed(2)}deg)`;
  if (kind === 'rise') return `translate3d(0,${st.y.toFixed(2)}%,0)`;
  if (kind === 'roll') return `translate3d(${st.x.toFixed(2)}%,${st.y.toFixed(2)}%,0)`;
  if (kind === 'track' || kind === 'glide') return `translate3d(${st.x.toFixed(2)}%,0,0)`;
  if (kind === 'line') return `translate3d(${(dir * st.x).toFixed(2)}%,0,0) scaleX(${st.scale.toFixed(4)})`;
  return `rotate(45deg) scale(${st.scale.toFixed(4)})`;
}

/** Words of a string (split on whitespace, empties dropped). */
export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}
/** Code points of a word (Array.from). */
export function splitChars(word: string): string[] {
  return Array.from(word);
}

/**
 * Deterministic decoy glyphs for the 'roll' unit (hydration safe). Letters: same case, never equal to ch; anything else: digits.
 */
export function rollDecoys(ch: string, n: number = TM_ROLL_GLYPHS - 1): string[] {
  const code = ch.codePointAt(0) ?? 0;
  const out: string[] = [];
  const upper = ch >= 'A' && ch <= 'Z';
  const lower = ch >= 'a' && ch <= 'z';
  for (let k = 0; k < n; k++) {
    if (upper || lower) {
      const base = upper ? 65 : 97;
      const own = code - base;
      let v = (code * 7 + (k + 1) * 11) % 26;
      if (v === own) v = (v + 1) % 26;
      out.push(String.fromCharCode(base + v));
    } else {
      out.push(String((code + 3 * (k + 1)) % 10));
    }
  }
  return out;
}
