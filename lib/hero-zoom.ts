// Shared hero scroll-zoom math. Pure, no imports (tests import this file directly).

export const HERO_CAM_Z = 10;
export const HERO_DOLLY = 1.6; // camera travel at p = 1 -> scale 1.19
export const HERO_PAN = 0.22; // fraction of the focus offset the camera pans
export const HERO_IMG_ASPECT = 6688 / 3764;
export const HERO_FOCUS_X = 0.65; // CSS objectPosition '65% center'
export const HERO_PANEL_U = 0.727; // baked chart panel centre, image u ((0.531 + 0.923) / 2)

export interface HeroZoom {
  scale: number;
  panFrac: number;
}

/** Horizontal screen fraction (0..1) of image u under object-fit: cover + object-position focusX. */
export function screenXOfImageU(
  u: number,
  viewW: number,
  viewH: number,
  imgAspect: number = HERO_IMG_ASPECT,
  focusX: number = HERO_FOCUS_X,
): number {
  const vA = viewW / viewH;
  if (vA >= imgAspect) return u;
  const fx = vA / imgAspect;
  const off = focusX * (1 - fx);
  return (u - off) / fx;
}

/** Zoom state at hero progress p. focusX is clamped to [0.2, 0.8] so the scaled photo always covers the hero. */
export function heroZoom(p: number, focusX: number): HeroZoom {
  const t = p < 0 ? 0 : p > 1 ? 1 : p;
  const scale = HERO_CAM_Z / (HERO_CAM_Z - HERO_DOLLY * t);
  const f = Math.min(0.8, Math.max(0.2, focusX));
  return { scale, panFrac: HERO_PAN * (f - 0.5) * t };
}
