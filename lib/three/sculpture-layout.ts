// Pure layout for the sculpture interlude: instanced blocks that assemble into
// 7 gold candlesticks. Deterministic for a given seed.
// Local copy of mulberry32 (lib/three/prng.ts): relative '.ts' imports are rejected by tsc here,
// and node --test needs this file to be self-contained.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SculptureLayout {
  count: number;
  start: Float32Array;
  target: Float32Array;
  scatter: Float32Array;
  delay: Float32Array;
  rot: Float32Array;
}

export const SCULPTURE_HEIGHTS: readonly number[] = [1.1, 1.6, 1.3, 2.1, 1.8, 2.6, 3.0];

export const BODY_W = 0.42;
export const BODY_D = 0.42;
export const WICK_W = 0.06;
export const SPACING = 0.7;
export const BASE_Y = -1.5;
export const WICK_FACTOR = 0.35;

interface Box { cx: number; cy: number; cz: number; w: number; h: number; d: number }

function boxes(): { bodies: Box[]; wicks: Box[] } {
  const n = SCULPTURE_HEIGHTS.length;
  const bodies: Box[] = [];
  const wicks: Box[] = [];
  SCULPTURE_HEIGHTS.forEach((h, i) => {
    const x = (i - (n - 1) / 2) * SPACING;
    bodies.push({ cx: x, cy: BASE_Y + h / 2, cz: 0, w: BODY_W, h, d: BODY_D });
    // Wick runs 0.35*h above and below the body.
    wicks.push({ cx: x, cy: BASE_Y + h / 2, cz: 0, w: WICK_W, h: h * (1 + 2 * WICK_FACTOR), d: WICK_W });
  });
  return { bodies, wicks };
}

/** Bounds box (min/max) that every target lies inside. */
export function sculptureBounds(): { min: [number, number, number]; max: [number, number, number] } {
  const { bodies, wicks } = boxes();
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const b of [...bodies, ...wicks]) {
    min[0] = Math.min(min[0], b.cx - b.w / 2);
    min[1] = Math.min(min[1], b.cy - b.h / 2);
    min[2] = Math.min(min[2], b.cz - b.d / 2);
    max[0] = Math.max(max[0], b.cx + b.w / 2);
    max[1] = Math.max(max[1], b.cy + b.h / 2);
    max[2] = Math.max(max[2], b.cz + b.d / 2);
  }
  return { min, max };
}

function surfaceArea(b: Box): number {
  return 2 * (b.w * b.h + b.w * b.d + b.h * b.d);
}

/** Point on the surface of b. Face chosen by area from s (0..1), position from rnd. */
function surfacePoint(b: Box, s: number, rnd: () => number): [number, number, number] {
  const aXY = b.w * b.h;
  const aXZ = b.w * b.d;
  const aYZ = b.h * b.d;
  let t = s * 2 * (aXY + aXZ + aYZ);
  const a = rnd() - 0.5;
  const c = rnd() - 0.5;
  const sign = rnd() < 0.5 ? -0.5 : 0.5;
  if (t < 2 * aXY) return [b.cx + a * b.w, b.cy + c * b.h, b.cz + sign * b.d];
  t -= 2 * aXY;
  if (t < 2 * aXZ) return [b.cx + a * b.w, b.cy + sign * b.h, b.cz + c * b.d];
  return [b.cx + sign * b.w, b.cy + a * b.h, b.cz + c * b.d];
}

export function buildSculpture(count: number, seed: number): SculptureLayout {
  const rnd = mulberry32(seed);
  const n = Math.max(0, Math.floor(count));
  const { bodies, wicks } = boxes();
  const start = new Float32Array(n * 3);
  const target = new Float32Array(n * 3);
  const scatter = new Float32Array(n * 3);
  const delay = new Float32Array(n);
  const rot = new Float32Array(n * 3);

  const bodyArea = bodies.reduce((s, b) => s + surfaceArea(b), 0);
  const wickArea = wicks.reduce((s, b) => s + surfaceArea(b), 0);
  const nWick = Math.round(n * 0.15);
  const nBody = n - nWick;

  // Jittered strata: stratum k of m maps to a distance along cumulative surface area.
  const place = (list: Box[], totalArea: number, k: number, m: number): [number, number, number] => {
    const want = ((k + rnd()) / Math.max(1, m)) * totalArea;
    let acc = 0;
    for (let i = 0; i < list.length; i++) {
      const a = surfaceArea(list[i]);
      if (want <= acc + a || i === list.length - 1) {
        return surfacePoint(list[i], Math.min(1, Math.max(0, (want - acc) / a)), rnd);
      }
      acc += a;
    }
    return [0, 0, 0];
  };

  for (let i = 0; i < n; i++) {
    const p = i < nBody ? place(bodies, bodyArea, i, nBody) : place(wicks, wickArea, i - nBody, nWick);
    target[i * 3] = p[0];
    target[i * 3 + 1] = p[1];
    target[i * 3 + 2] = p[2];
  }

  let minX = Infinity, maxX = -Infinity, cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    const x = target[i * 3];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    cx += x; cy += target[i * 3 + 1]; cz += target[i * 3 + 2];
  }
  if (n > 0) { cx /= n; cy /= n; cz /= n; }
  const span = maxX - minX || 1;

  for (let i = 0; i < n; i++) {
    // Start: seeded sphere shell, radius 5-7.
    const z = rnd() * 2 - 1;
    const phi = rnd() * Math.PI * 2;
    const r = 5 + rnd() * 2;
    const rr = Math.sqrt(1 - z * z);
    start[i * 3] = Math.cos(phi) * rr * r;
    start[i * 3 + 1] = Math.sin(phi) * rr * r;
    start[i * 3 + 2] = z * r;

    // Scatter: away from the centroid plus an upward lift.
    const dx = target[i * 3] - cx, dy = target[i * 3 + 1] - cy, dz = target[i * 3 + 2] - cz;
    const len = Math.hypot(dx, dy, dz) || 1;
    const push = 3 + rnd() * 4;
    scatter[i * 3] = target[i * 3] + (dx / len) * push;
    scatter[i * 3 + 1] = target[i * 3 + 1] + (dy / len) * push + 1.5 + rnd() * 2;
    scatter[i * 3 + 2] = target[i * 3 + 2] + (dz / len) * push;

    delay[i] = (target[i * 3] - minX) / span;
    rot[i * 3] = rnd() * Math.PI * 2;
    rot[i * 3 + 1] = rnd() * Math.PI * 2;
    rot[i * 3 + 2] = rnd() * Math.PI * 2;
  }
  return { count: n, start, target, scatter, delay, rot };
}
