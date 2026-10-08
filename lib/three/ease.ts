// Small pure easing helpers shared by the 3D scenes.

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}
export function easeInCubic(t: number): number {
  return t * t * t;
}
