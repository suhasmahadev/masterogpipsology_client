// Pure geometry for the frame-to-video hand-off (opportunity frame 240 -> intelligence-layer.mp4).
// No imports (tests import this file directly).

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

export function videoPlacement(
  frame: HSize = HANDOFF_FRAME,
  video: HSize = HANDOFF_VIDEO,
  df: DoorBox = DOOR_FRAME,
  dv: DoorBox = DOOR_VIDEO,
): VideoPlacement {
  const k = ((df.x1 - df.x0) / (dv.x1 - dv.x0) + (df.y1 - df.y0) / (dv.y1 - dv.y0)) / 2;
  const fcx = (df.x0 + df.x1) / 2;
  const fcy = (df.y0 + df.y1) / 2;
  const vcx = (dv.x0 + dv.x1) / 2;
  const vcy = (dv.y0 + dv.y1) / 2;
  const cx = fcx + (video.w / 2 - vcx) * k;
  const cy = fcy + (video.h / 2 - vcy) * k;
  return { k, vw: video.w * k, vh: video.h * k, dx: cx - frame.w / 2, dy: cy - frame.h / 2 };
}

/** Rect of the full video picture, frame-locked to a centred cover-fit 1920x1080 canvas in container c. */
export function frameLockRect(
  c: HSize,
  p: VideoPlacement = videoPlacement(),
  frame: HSize = HANDOFF_FRAME,
): HRect {
  const s = Math.max(c.w / frame.w, c.h / frame.h);
  const w = p.vw * s;
  const h = p.vh * s;
  return { x: c.w / 2 + p.dx * s - w / 2, y: c.h / 2 + p.dy * s - h / 2, w, h };
}

/** Rect of the full video picture as IntelligenceHero.module.css lays it out natively (stage = container c). */
export function nativeVideoRect(c: HSize, mode: NativeMode, video: HSize = HANDOFF_VIDEO): HRect {
  if (mode === 'desktop') {
    const u = c.h / 1058;
    const bw = Math.min(1492 * u, c.w); // Tailwind preflight `video { max-width: 100% }`
    const bh = 1054 * u;
    const bx = c.w / 2 - bw / 2 - 0.5 * u;
    const by = 1 * u;
    const sc = Math.max(bw / video.w, bh / video.h);
    const pw = video.w * sc;
    const ph = video.h * sc;
    return { x: bx + (bw - pw) / 2, y: by + (bh - ph) / 2, w: pw, h: ph };
  }
  const sc = Math.max(c.w / video.w, c.h / video.h);
  const pw = video.w * sc;
  const ph = video.h * sc;
  const posX = mode === 'tablet' ? 0.44 : 0.43;
  return { x: (c.w - pw) * posX, y: (c.h - ph) * 0.5, w: pw, h: ph };
}

/** s = 0: maps native onto lock; s = 1: identity. Transform-origin is the element's top-left (= native.x, native.y). */
export function settleTransform(native: HRect, lock: HRect, s: number): SettleTransform {
  const t = s < 0 ? 0 : s > 1 ? 1 : s;
  const k0 = lock.w / native.w;
  return { k: k0 + (1 - k0) * t, tx: (lock.x - native.x) * (1 - t) + 0, ty: (lock.y - native.y) * (1 - t) + 0 };
}

export function rectAt(native: HRect, tr: SettleTransform): HRect {
  return { x: native.x + tr.tx, y: native.y + tr.ty, w: native.w * tr.k, h: native.h * tr.k };
}

export function covers(r: HRect, c: HSize, eps = 0.5): boolean {
  return r.x <= eps && r.y <= eps && r.x + r.w >= c.w - eps && r.y + r.h >= c.h - eps;
}

export function smoothstep01(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
