// Pure, dependency-free helpers for the scroll-driven frame sequence engine.
// No `@/` imports and only erasable TypeScript syntax so `node --test` can load it.

export interface Size { w: number; h: number }
export interface Rect { x: number; y: number; w: number; h: number }

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

/** 0..1 progress of a sticky section. range = sectionH - viewportH; returns 0 if range <= 0. */
export function sectionProgress(scroll: number, top: number, sectionH: number, viewportH: number): number {
  const range = sectionH - viewportH;
  if (!(range > 0)) return 0;
  return clamp01((scroll - top) / range);
}

/** Frame-rate independent exponential damping. rate <= 0 returns target. Snaps when |target-next| < 1e-5. */
export function damp(current: number, target: number, rate: number, dtSec: number): number {
  if (!(rate > 0)) return target;
  const next = current + (target - current) * (1 - Math.exp(-dtSec * rate));
  return Math.abs(target - next) < 1e-5 ? target : next;
}

/**
 * Canvas backing size: DPR-aware but never more pixels than the cover-fitted source can supply.
 */
export function computeBackingSize(css: Size, src: Size, dpr: number, dprCap: number = 2): Size {
  const cover = Math.max(css.w / src.w, css.h / src.h);
  const useful = cover > 0 ? 1 / cover : 1;
  const scale = Math.max(1, Math.min(Math.min(dpr || 1, dprCap), useful));
  return {
    w: Math.max(1, Math.round(css.w * scale)),
    h: Math.max(1, Math.round(css.h * scale)),
  };
}

/** Integer, centred source crop that a cover-fit to `dest` shows. */
export function coverCrop(src: Size, dest: Size): Rect {
  const scale = Math.max(dest.w / src.w, dest.h / src.h);
  const w = clamp(Math.round(dest.w / scale), 1, src.w);
  const h = clamp(Math.round(dest.h / scale), 1, src.h);
  const x = Math.max(0, Math.floor((src.w - w) / 2));
  const y = Math.max(0, Math.floor((src.h - h) / 2));
  return { x, y, w, h };
}

/** Integer dest rect to draw an image of size `img` so it covers `dest` (centred). */
export function coverDest(img: Size, dest: Size): Rect {
  const ratio = Math.max(dest.w / img.w, dest.h / img.h);
  const w = Math.round(img.w * ratio);
  const h = Math.round(img.h * ratio);
  return { x: Math.round((dest.w - w) / 2), y: Math.round((dest.h - h) / 2), w, h };
}

/** Nearest index i with flags[i] truthy, searching idx, idx-1, idx+1, idx-2, idx+2... -1 if none. */
export function nearestAvailable(flags: ArrayLike<number>, idx: number): number {
  const n = flags.length;
  if (n === 0) return -1;
  const start = clamp(idx, 0, n - 1);
  if (flags[start]) return start;
  for (let d = 1; d < n; d++) {
    const back = start - d;
    if (back >= 0 && flags[back]) return back;
    const fwd = start + d;
    if (fwd < n && flags[fwd]) return fwd;
    if (back < 0 && fwd >= n) break;
  }
  return -1;
}

export const FETCH_STRIDES: readonly number[] = [16, 8, 4, 2, 1];

/**
 * Lower = sooner. Frames within nearWindow of current: score = dist. Otherwise
 * (strideLevel+1)*1_000_000 + dist. dist = |i-current|, doubled when behind the scroll direction.
 */
export function fetchScore(i: number, current: number, dir: number, nearWindow: number): number {
  const delta = i - current;
  const raw = Math.abs(delta);
  const dist = delta * (dir >= 0 ? 1 : -1) < 0 ? raw * 2 : raw;
  if (raw <= nearWindow) return dist;
  let level = FETCH_STRIDES.length - 1;
  for (let k = 0; k < FETCH_STRIDES.length; k++) {
    if (i % FETCH_STRIDES[k] === 0) { level = k; break; }
  }
  return (level + 1) * 1_000_000 + dist;
}

/**
 * state: 0 idle, 1 in flight, 2 ready, 3 failed. Pinned idle frames first (in given order);
 * if !full only pinned are eligible; else min fetchScore among idle. -1 if none.
 */
export function pickNextFetch(
  state: ArrayLike<number>,
  pinned: readonly number[],
  current: number,
  dir: number,
  nearWindow: number,
  full: boolean,
  warm: readonly number[] = [],
  notBefore?: ArrayLike<number>,
  now: number = 0,
): number {
  for (let k = 0; k < pinned.length; k++) {
    const p = pinned[k];
    if (p >= 0 && p < state.length && state[p] === 0 && !(notBefore && notBefore[p] > now)) return p;
  }
  for (let k = 0; k < warm.length; k++) {
    const w = warm[k];
    if (w >= 0 && w < state.length && state[w] === 0 && !(notBefore && notBefore[w] > now)) return w;
  }
  if (!full) return -1;
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < state.length; i++) {
    if (state[i] !== 0) continue;
    if (notBefore && notBefore[i] > now) continue;
    const s = fetchScore(i, current, dir, nearWindow);
    if (s < bestScore) { bestScore = s; best = i; }
  }
  return best;
}

/** Inclusive [lo, hi] decode window, `ahead` frames in scroll direction and `behind` the other way. */
export function decodeWindow(current: number, dir: number, total: number, ahead: number, behind: number): [number, number] {
  const fwd = dir >= 0;
  const lo = current - (fwd ? behind : ahead);
  const hi = current + (fwd ? ahead : behind);
  return [Math.max(0, lo), Math.min(total - 1, hi)];
}

/**
 * needs[i] truthy = blob ready, not in flight, bitmap missing or stale. Pinned needing decode first;
 * else nearest to current within [lo,hi], ahead-of-direction wins ties. -1 if none.
 */
export function pickNextDecode(
  needs: ArrayLike<number>,
  pinned: readonly number[],
  current: number,
  dir: number,
  lo: number,
  hi: number,
  stride: number = 1,
): number {
  for (let k = 0; k < pinned.length; k++) {
    const p = pinned[k];
    if (p >= 0 && p < needs.length && needs[p]) return p;
  }
  if (lo > hi) return -1;
  const step = dir >= 0 ? 1 : -1;
  const maxD = Math.max(Math.abs(hi - current), Math.abs(current - lo));
  if (stride > 1) {
    for (let d = 0; d <= maxD; d++) {
      const ahead = current + step * d;
      if (ahead >= lo && ahead <= hi && ahead >= 0 && ahead < needs.length && ahead % stride === 0 && needs[ahead]) return ahead;
      if (d === 0) continue;
      const behind = current - step * d;
      if (behind >= lo && behind <= hi && behind >= 0 && behind < needs.length && behind % stride === 0 && needs[behind]) return behind;
    }
  }
  for (let d = 0; d <= maxD; d++) {
    const ahead = current + step * d;
    if (ahead >= lo && ahead <= hi && ahead >= 0 && ahead < needs.length && needs[ahead]) return ahead;
    if (d === 0) continue;
    const behind = current - step * d;
    if (behind >= lo && behind <= hi && behind >= 0 && behind < needs.length && needs[behind]) return behind;
  }
  return -1;
}

const MB = 1024 * 1024;

/** Max decoded frames for this canvas (see plan A3). */
export function bitmapBudget(bitmap: Size, deviceMemoryGB: number | undefined, total: number, coarsePointer: boolean = false): number {
  let mb = deviceMemoryGB === undefined ? (coarsePointer ? 160 : 256) : deviceMemoryGB >= 8 ? 384 : deviceMemoryGB >= 4 ? 256 : 128;
  if (coarsePointer) mb = Math.min(mb, 192);
  const bytes = Math.max(1, bitmap.w * bitmap.h * 4);
  const hi = Math.min(total, 240);
  return Math.min(hi, Math.max(16, Math.floor((mb * MB) / bytes)));
}

/** EMA of frame velocity (frames/s). dtSec <= 0 returns prev. Snaps to 0 below 0.5 f/s. */
export function frameVelocity(prev: number, deltaFrames: number, dtSec: number): number {
  if (!(dtSec > 0)) return prev;
  const inst = deltaFrames / Math.max(dtSec, 1 / 240);
  const a = 1 - Math.exp(-dtSec / 0.1);
  const v = prev + (inst - prev) * a;
  return Math.abs(v) < 0.5 ? 0 : v;
}

/** Split a decode window of `windowSize` bitmaps into ahead/behind (in scroll direction), velocity-aware. */
export function lookahead(speed: number, windowSize: number, horizonSec: number = 0.5, minAhead: number = 6): { ahead: number; behind: number } {
  const w = Math.max(2, Math.floor(windowSize));
  const want = Math.max(Math.ceil(w * 0.55), Math.round(Math.abs(speed) * horizonSec), minAhead);
  const ahead = Math.min(w - 2, want);
  return { ahead, behind: w - ahead };
}

/** Decode every Nth frame ahead when the window cannot cover `horizonSec` of travel. 1..4. */
export function decodeStride(speed: number, ahead: number, horizonSec: number = 0.5): number {
  return clamp(Math.ceil((Math.abs(speed) * horizonSec) / Math.max(1, ahead)), 1, 4);
}

/** Fetch retry backoff: 500, 1000, 2000, 4000, then 8000 ms max. attempt >= 1. */
export function retryDelayMs(attempt: number): number {
  return Math.min(8000, 500 * 2 ** Math.max(0, attempt - 1));
}
