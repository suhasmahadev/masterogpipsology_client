import test from 'node:test';
import assert from 'node:assert/strict';
import { planBlend, smoothstep, blendAlpha, BLEND_SOFTNESS, BLEND_LEVELS } from '../lib/frame-sequence/math.ts';
import { UNIQUE_PER_SEQ } from '../lib/frame-sequence/sources.ts';

const PER = UNIQUE_PER_SEQ; // 192
const TOTAL = PER * 3; // 576, Forex chain

function cutFlags(total, cuts) {
  const f = new Uint8Array(total);
  for (const c of cuts) f[c] = 1;
  return f;
}

test('smoothstep: endpoints, midpoint, clamp, monotonic', () => {
  assert.equal(smoothstep(0), 0);
  assert.equal(smoothstep(1), 1);
  assert.equal(smoothstep(0.5), 0.5);
  assert.equal(smoothstep(-3), 0);
  assert.equal(smoothstep(9), 1);
  let prev = -1;
  for (let i = 0; i <= 100; i++) {
    const v = smoothstep(i / 100);
    assert.ok(v >= prev);
    prev = v;
  }
});

test('planBlend: integer position draws a single frame', () => {
  assert.deepEqual(planBlend(0, 192), { a: 0, b: -1, q: 0 });
  assert.deepEqual(planBlend(57, 192), { a: 57, b: -1, q: 0 });
});

test('planBlend: mid position blends floor and floor+1 at alpha 0.5', () => {
  const p = planBlend(10.5, 192);
  assert.equal(p.a, 10);
  assert.equal(p.b, 11);
  assert.equal(p.q, BLEND_LEVELS / 2);
});

test('planBlend: alpha is blendAlpha(frac), quantised to 1/64 steps', () => {
  for (const frac of [0.1, 0.25, 0.4, 0.6, 0.75, 0.9]) {
    const p = planBlend(20 + frac, 192);
    assert.equal(p.a, 20);
    assert.equal(p.b, 21);
    assert.equal(p.q, Math.round(blendAlpha(frac) * BLEND_LEVELS));
    assert.ok(Number.isInteger(p.q) && p.q > 0 && p.q < BLEND_LEVELS);
  }
});

test('planBlend: alpha near 0 or 1 collapses to one frame (no wasted overlay draw)', () => {
  assert.deepEqual(planBlend(30.005, 192), { a: 30, b: -1, q: 0 });
  assert.deepEqual(planBlend(30.995, 192), { a: 31, b: -1, q: 0 });
});

test('planBlend: alpha rises with position; quantised key changes are bounded', () => {
  let prevQ = 0;
  const keys = new Set();
  for (let i = 0; i <= 1000; i++) {
    const p = planBlend(40 + i / 1000, 192);
    const q = p.b >= 0 ? p.q : p.a === 41 ? BLEND_LEVELS : 0;
    assert.ok(q >= prevQ);
    prevQ = q;
    keys.add(`${p.a}:${p.b}:${p.q}`);
  }
  // At most 1 + 63 blended steps + the two single-frame states.
  assert.ok(keys.size <= BLEND_LEVELS + 1);
});

test('planBlend: last frame is always drawn alone (frac 0 at the final frame)', () => {
  assert.deepEqual(planBlend(TOTAL - 1, TOTAL), { a: TOTAL - 1, b: -1, q: 0 });
  assert.deepEqual(planBlend(TOTAL + 5, TOTAL), { a: TOTAL - 1, b: -1, q: 0 });
  assert.deepEqual(planBlend(Infinity, TOTAL), { a: TOTAL - 1, b: -1, q: 0 });
  // Float noise just below the final frame snaps onto it, never past it.
  assert.deepEqual(planBlend(TOTAL - 1 - 1e-9, TOTAL), { a: TOTAL - 1, b: -1, q: 0 });
  assert.deepEqual(planBlend(0, 1), { a: 0, b: -1, q: 0 });
});

test('planBlend: pos is clamped at the start and NaN is treated as 0', () => {
  assert.deepEqual(planBlend(-4, 192), { a: 0, b: -1, q: 0 });
  assert.deepEqual(planBlend(NaN, 192), { a: 0, b: -1, q: 0 });
  assert.deepEqual(planBlend(3, 0), { a: 0, b: -1, q: 0 });
});

test('planBlend: never blends across a hard cut (folder join), shows the nearest frame', () => {
  const cuts = cutFlags(TOTAL, [PER - 1, 2 * PER - 1]);
  // forex last (191) -> stock first (192)
  assert.deepEqual(planBlend(PER - 1 + 0.3, TOTAL, cuts), { a: PER - 1, b: -1, q: 0 });
  assert.deepEqual(planBlend(PER - 1 + 0.5, TOTAL, cuts), { a: PER, b: -1, q: 0 });
  assert.deepEqual(planBlend(PER - 1 + 0.7, TOTAL, cuts), { a: PER, b: -1, q: 0 });
  // stock last (383) -> opportunity first (384)
  assert.deepEqual(planBlend(2 * PER - 1 + 0.2, TOTAL, cuts), { a: 2 * PER - 1, b: -1, q: 0 });
  assert.deepEqual(planBlend(2 * PER - 1 + 0.8, TOTAL, cuts), { a: 2 * PER, b: -1, q: 0 });
});

test('planBlend: frames adjacent to a cut still blend within their own folder', () => {
  const cuts = cutFlags(TOTAL, [PER - 1, 2 * PER - 1]);
  assert.deepEqual(planBlend(PER - 2 + 0.5, TOTAL, cuts), { a: PER - 2, b: PER - 1, q: BLEND_LEVELS / 2 });
  assert.deepEqual(planBlend(PER + 0.5, TOTAL, cuts), { a: PER, b: PER + 1, q: BLEND_LEVELS / 2 });
});

test('planBlend: without cuts the same fractional position does blend', () => {
  assert.deepEqual(planBlend(PER - 1 + 0.5, TOTAL), { a: PER - 1, b: PER, q: BLEND_LEVELS / 2 });
  assert.deepEqual(planBlend(PER - 1 + 0.5, TOTAL, null), { a: PER - 1, b: PER, q: BLEND_LEVELS / 2 });
});

test('planBlend: Forex hand-off progress maps onto the last frame with frac 0', () => {
  // Mirrors ForexMarketScroll.frameForProgress: p >= portion -> total-1 exactly.
  const portion = 5 / 7;
  const frameForProgress = (p, total) =>
    p < portion ? Math.min(total - 1, Math.max(0, (p / portion) * (total - 1))) : total - 1;
  const cuts = cutFlags(TOTAL, [PER - 1, 2 * PER - 1]);
  for (const p of [portion, portion + 1e-6, 0.8, 0.95, 1]) {
    assert.deepEqual(planBlend(frameForProgress(p, TOTAL), TOTAL, cuts), { a: TOTAL - 1, b: -1, q: 0 });
  }
  assert.deepEqual(planBlend(frameForProgress(0, TOTAL), TOTAL, cuts), { a: 0, b: -1, q: 0 });
});

test('BLEND_SOFTNESS is linear (0)', () => {
  assert.equal(BLEND_SOFTNESS, 0);
});

test('blendAlpha: endpoints, midpoint, clamp, monotonic for any softness', () => {
  for (const s of [0, 0.5, 1]) {
    assert.equal(blendAlpha(0, s), 0);
    assert.equal(blendAlpha(1, s), 1);
    assert.equal(blendAlpha(0.5, s), 0.5);
    assert.equal(blendAlpha(-1, s), 0);
    assert.equal(blendAlpha(2, s), 1);
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = blendAlpha(i / 100, s);
      assert.ok(v >= prev);
      prev = v;
    }
  }
});

test('blendAlpha: softness 0 is linear, softness 1 is smoothstep', () => {
  for (const x of [0.1, 0.25, 0.6, 0.9]) {
    assert.ok(Math.abs(blendAlpha(x, 0) - x) < 1e-12);
    assert.ok(Math.abs(blendAlpha(x, 1) - smoothstep(x)) < 1e-12);
  }
});

test('planBlend: even cross-dissolve cadence at a steady speed', () => {
  // Linear gives steps 11, 10, 11, 11, 10, 11; smoothstep would give 5, 12, 15, 15, 12, 5.
  const qs = [];
  for (let k = 0; k <= 6; k++) {
    const p = planBlend(40 + k / 6, 192);
    qs.push(p.b >= 0 ? p.q : p.a === 41 ? BLEND_LEVELS : 0);
  }
  const diffs = qs.slice(1).map((q, i) => q - qs[i]);
  assert.ok(Math.max(...diffs) - Math.min(...diffs) <= 1, String(diffs));
});
