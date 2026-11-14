// Frame URL sets and tier selection. Pure and import-free (loaded by `node --test`).
// Window access happens only inside functions.

export type FrameTier = 'full' | 'lite' | 'portrait';
export type SeqName = 'crypto' | 'forex' | 'stock_market' | 'opportunity';

/** Bump and write a NEW folder when frames change (cache busting: /frames is immutable). */
export const FRAME_SET_VERSION = 'v1';
export const FRAMES_PER_SEQ = 240;
/** Every source sequence was exported 24->30 fps: 0-based local frame i with i % 5 === 2 repeats i - 1
 *  (verified by docs/plans/forex-smoothness/cadence.mjs). Those frames are never fetched or shown. */
export const PULLDOWN_PERIOD = 5;
export const PULLDOWN_PHASE = 2;
export function uniqueLocalFrames(perSeq: number = FRAMES_PER_SEQ): number[] {
  const out: number[] = [];
  for (let i = 0; i < perSeq; i++) if (i % PULLDOWN_PERIOD !== PULLDOWN_PHASE) out.push(i);
  return out;
}
export const UNIQUE_LOCAL: readonly number[] = uniqueLocalFrames(); // 192 entries, [0,1,3,4,5,6,8,...,239]
export const UNIQUE_PER_SEQ = UNIQUE_LOCAL.length; // 192
/** Scroll distance (vh) that plays one source sequence. Crypto: 450vh section - 100vh sticky. */
export const SEQ_SCROLL_VH = 350;
/** Forex is pulled up by this much (marginTop) so it fades in over Crypto's last screen (components/fx/ForexFade.tsx). */
export const FOREX_OVERLAP_VH = 100;
export const PORTRAIT_MAX_ASPECT = 0.8; // 864/1080
export const LITE_MAX_BACKING_W = 1408;
export const TIER_SIZE: Record<FrameTier, { w: number; h: number }> = {
  full: { w: 1920, h: 1080 },
  lite: { w: 1280, h: 720 },
  portrait: { w: 864, h: 1080 },
};

const pad3 = (i: number): string => String(i + 1).padStart(3, '0');

/** Pre-baked dissolve of the last 12 opportunity frames into the video's first frame (scripts/make-handoff-frames.mjs). */
export const HANDOFF_SET = 'handoff-v1';
export const HANDOFF_RAW_FROM = 226; // 1-based opportunity raws >= this come from /frames/handoff-v1
export const HANDOFF_POSTER = `/frames/${HANDOFF_SET}/intelligence-t0.jpg`;
const isHandoff = (seq: SeqName, i: number): boolean => seq === 'opportunity' && i + 1 >= HANDOFF_RAW_FROM;

export function jpegFrameUrl(seq: SeqName, i: number): string {
  if (isHandoff(seq, i)) return `/frames/${HANDOFF_SET}/opportunity/1920/${pad3(i)}.jpg`;
  return `/assets/${seq}/ezgif-frame-${pad3(i)}.jpg`;
}

export function frameUrl(seq: SeqName, i: number, tier: FrameTier): string {
  if (isHandoff(seq, i)) {
    if (tier === 'full') return jpegFrameUrl(seq, i);
    return `/frames/${HANDOFF_SET}/opportunity/${tier === 'portrait' ? 'p1080' : '1280'}/${pad3(i)}.webp`;
  }
  if (tier === 'full') return jpegFrameUrl(seq, i);
  return `/frames/${FRAME_SET_VERSION}/${seq}/${tier === 'portrait' ? 'p1080' : '1280'}/${pad3(i)}.webp`;
}

export interface FrameSet {
  urls: string[];
  fallback: string[] | null;
  expected: { w: number; h: number };
}

export function buildFrameSet(
  seqs: readonly SeqName[],
  tier: FrameTier,
  perSeq: number = FRAMES_PER_SEQ,
  locals: readonly number[] | null = null,
): FrameSet {
  const urls: string[] = [];
  const jpegs: string[] = [];
  for (const seq of seqs) {
    const idx = locals ?? Array.from({ length: perSeq }, (_, i) => i);
    for (const i of idx) {
      urls.push(frameUrl(seq, i, tier));
      jpegs.push(jpegFrameUrl(seq, i));
    }
  }
  return { urls, fallback: tier === 'full' ? null : jpegs, expected: TIER_SIZE[tier] };
}

export interface TierInput {
  cssW: number;
  cssH: number;
  dpr: number;
  coarsePointer?: boolean;
  saveData?: boolean;
  effectiveType?: string;
  deviceMemoryGB?: number;
}

export type FrameClass = 'full' | 'lite';
export const FRAME_CLASS_KEY = 'mop.frameClass.v1'; // sessionStorage key

export function isPortraitViewport(cssW: number, cssH: number): boolean {
  return cssH > 0 && cssW / cssH <= PORTRAIT_MAX_ASPECT;
}

/** Resolution class: chooseFrameTier minus the portrait branch. */
export function chooseFrameClass(i: TierInput): FrameClass {
  if (
    i.saveData ||
    i.coarsePointer ||
    (i.deviceMemoryGB !== undefined && i.deviceMemoryGB < 4) ||
    i.effectiveType === 'slow-2g' ||
    i.effectiveType === '2g' ||
    i.effectiveType === '3g'
  ) {
    return 'lite';
  }
  return i.cssW * Math.min(i.dpr || 1, 2) <= LITE_MAX_BACKING_W ? 'lite' : 'full';
}

export function tierFor(cls: FrameClass, portrait: boolean): FrameTier {
  return portrait ? 'portrait' : cls;
}

export function chooseFrameTier(i: TierInput): FrameTier {
  return tierFor(chooseFrameClass(i), isPortraitViewport(i.cssW, i.cssH));
}

function readTierInput(): TierInput {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  return {
    cssW: window.innerWidth,
    cssH: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    saveData: nav.connection?.saveData,
    effectiveType: nav.connection?.effectiveType,
    deviceMemoryGB: nav.deviceMemory,
  };
}

export function detectFrameTier(): FrameTier {
  if (typeof window === 'undefined') return 'full';
  return chooseFrameTier(readTierInput());
}

export function parseFrameClass(v: string | null | undefined): FrameClass | null {
  return v === 'full' || v === 'lite' ? v : null;
}

/** Pure: decides the session class. override = ?frames= query value, stored = sessionStorage value. */
export function resolveSessionClass(
  override: string | null,
  stored: string | null,
  detect: () => FrameClass,
): { cls: FrameClass; store: boolean } {
  const o = parseFrameClass(override);
  if (o) return { cls: o, store: true };
  const s = parseFrameClass(stored);
  if (s) return { cls: s, store: false };
  return { cls: detect(), store: true };
}

let sessionClass: FrameClass | null = null;

/** The frame class (full JPEG vs lite WebP) is chosen once per tab session and then never changes. */
export function sessionFrameClass(): FrameClass {
  if (typeof window === 'undefined') return 'full';
  if (sessionClass) return sessionClass;
  let override: string | null = null;
  let stored: string | null = null;
  try { override = new URLSearchParams(window.location.search).get('frames'); } catch { /* ignore */ }
  try { stored = window.sessionStorage.getItem(FRAME_CLASS_KEY); } catch { /* ignore */ }
  const r = resolveSessionClass(override, stored, () => chooseFrameClass(readTierInput()));
  sessionClass = r.cls;
  if (r.store) {
    try { window.sessionStorage.setItem(FRAME_CLASS_KEY, r.cls); } catch { /* ignore */ }
  }
  return sessionClass;
}

export function pinFrameClass(c: FrameClass): void {
  sessionClass = c;
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(FRAME_CLASS_KEY, c); } catch { /* ignore */ }
}

export function sessionFrameTier(): FrameTier {
  if (typeof window === 'undefined') return 'full';
  return tierFor(sessionFrameClass(), isPortraitViewport(window.innerWidth, window.innerHeight));
}

/** 0..head-1 then every `stride`th frame after, sorted, unique. */
export function warmIndices(total: number, head: number = 24, stride: number = 8): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.min(head, total); i++) out.push(i);
  for (let i = head; i < total; i++) {
    if (i % stride === 0) out.push(i);
  }
  return out;
}

/** Starts the first frame download as early as the client chunk evaluates. Same URL the engine will request. */
export function warmFirstFrame(seq: SeqName): void {
  if (typeof window === 'undefined') return;
  fetch(frameUrl(seq, 0, sessionFrameTier()), { cache: 'force-cache', priority: 'high' } as RequestInit).catch(() => {});
}
