// Maps image UV (top-left origin) to world coordinates on a plane that fills the
// view and shows the image with object-fit: cover + object-position (focus).
// Mirrors the cover mapping in the former hero background-plane shader.

export interface Vec2Like { x: number; y: number }

/** Fraction of the image (u, v) that is visible under cover-fit. */
export function coverFraction(viewAspect: number, imgAspect: number): Vec2Like {
  return viewAspect > imgAspect
    ? { x: 1, y: imgAspect / viewAspect }
    : { x: viewAspect / imgAspect, y: 1 };
}

/**
 * Image UV (u right, v down, 0..1) to world x/y. The view is centred on the origin,
 * viewW x viewH world units, +y up.
 */
export function imageUvToWorld(
  u: number,
  v: number,
  viewW: number,
  viewH: number,
  imgAspect: number,
  focus: Vec2Like,
): Vec2Like {
  const f = coverFraction(viewW / viewH, imgAspect);
  const offU = focus.x * (1 - f.x);
  const offV = focus.y * (1 - f.y);
  const sx = (u - offU) / f.x;
  const sy = (v - offV) / f.y;
  return { x: (sx - 0.5) * viewW, y: (0.5 - sy) * viewH };
}
