// Frame URL sets and tier selection. Pure and import-free (loaded by `node --test`).
// Window access happens only inside functions.

export type FrameTier = 'full' | 'lite' | 'portrait';
export type SeqName = 'crypto' | 'forex' | 'stock_market' | 'opportunity';

/** Bump and write a NEW folder when frames change (cache busting: /frames is immutable). */
export const FRAME_SET_VERSION = 'v1';
export const FRAMES_PER_SEQ = 240;
export const PORTRAIT_MAX_ASPECT = 0.8; // 864/1080
export const LITE_MAX_BACKING_W = 1408;
export const TIER_SIZE: Record<FrameTier, { w: number; h: number }> = {
  full: { w: 1920, h: 1080 },
  lite: { w: 1280, h: 720 },
  portrait: { w: 864, h: 1080 },
};

const pad3 = (i: number): string => String(i + 1).padStart(3, '0');

export function jpegFrameUrl(seq: SeqName, i: number): string {
  return `/assets/${seq}/ezgif-frame-${pad3(i)}.jpg`;
}

export function frameUrl(seq: SeqName, i: number, tier: FrameTier): string {
  if (tier === 'full') return jpegFrameUrl(seq, i);
  return `/frames/${FRAME_SET_VERSION}/${seq}/${tier === 'portrait' ? 'p1080' : '1280'}/${pad3(i)}.webp`;
}

export interface FrameSet {
  urls: string[];
  fallback: string[] | null;
  expected: { w: number; h: number };
}

export function buildFrameSet(seqs: readonly SeqName[], tier: FrameTier, perSeq: number = FRAMES_PER_SEQ): FrameSet {
  const urls: string[] = [];
  const jpegs: string[] = [];
  for (const seq of seqs) {
    for (let i = 0; i < perSeq; i++) {
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

export function chooseFrameTier(i: TierInput): FrameTier {
  if (i.cssH > 0 && i.cssW / i.cssH <= PORTRAIT_MAX_ASPECT) return 'portrait';
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

export function detectFrameTier(): FrameTier {
  if (typeof window === 'undefined') return 'full';
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  return chooseFrameTier({
    cssW: window.innerWidth,
    cssH: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    saveData: nav.connection?.saveData,
    effectiveType: nav.connection?.effectiveType,
    deviceMemoryGB: nav.deviceMemory,
  });
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
  fetch(frameUrl(seq, 0, detectFrameTier()), { cache: 'force-cache', priority: 'high' } as RequestInit).catch(() => {});
}
