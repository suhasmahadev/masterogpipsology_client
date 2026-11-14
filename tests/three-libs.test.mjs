import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../lib/three/prng.ts';
import { imageUvToWorld, coverFraction } from '../lib/three/cover-math.ts';
import { buildSculpture, sculptureBounds } from '../lib/three/sculpture-layout.ts';
import { CANDLES } from '../lib/three/hero-candles.ts';

test('mulberry32 is deterministic and in [0,1)', () => {
  const a = mulberry32(5), b = mulberry32(5);
  for (let i = 0; i < 50; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('cover-math: wide view crops vertically, focus 0.5 centres', () => {
  const f = coverFraction(2, 1);
  assert.deepEqual(f, { x: 1, y: 0.5 });
  const c = imageUvToWorld(0.5, 0.5, 4, 2, 1, { x: 0.5, y: 0.5 });
  assert.ok(Math.abs(c.x) < 1e-9 && Math.abs(c.y) < 1e-9);
  // top of the visible window maps to the top of the view
  const t = imageUvToWorld(0.5, 0.25, 4, 2, 1, { x: 0.5, y: 0.5 });
  assert.ok(Math.abs(t.y - 1) < 1e-9);
});

test('cover-math: tall view crops horizontally honouring focus', () => {
  const left = imageUvToWorld(0, 0.5, 1, 2, 1, { x: 0, y: 0.5 });
  assert.ok(Math.abs(left.x + 0.5) < 1e-9);
  const right = imageUvToWorld(1, 0.5, 1, 2, 1, { x: 1, y: 0.5 });
  assert.ok(Math.abs(right.x - 0.5) < 1e-9);
});

test('sculpture layout: count, determinism, bounds, delay', () => {
  const l = buildSculpture(1400, 7);
  assert.equal(l.count, 1400);
  assert.equal(l.target.length, 4200);
  assert.equal(l.delay.length, 1400);
  const l2 = buildSculpture(1400, 7);
  assert.deepEqual(Array.from(l.target), Array.from(l2.target));
  assert.notDeepEqual(Array.from(l.target), Array.from(buildSculpture(1400, 8).target));
  const { min, max } = sculptureBounds();
  const e = 1e-4;
  for (let i = 0; i < l.count; i++) {
    for (let k = 0; k < 3; k++) {
      const v = l.target[i * 3 + k];
      assert.ok(v >= min[k] - e && v <= max[k] + e, `axis ${k} value ${v}`);
    }
    assert.ok(l.delay[i] >= 0 && l.delay[i] <= 1);
  }
});

test('hero candles: 36 entries, valid ohlc', () => {
  assert.equal(CANDLES.length, 36);
  for (const [o, c, h, lo] of CANDLES) {
    assert.ok(h >= Math.max(o, c) && lo <= Math.min(o, c) && lo >= 0 && h <= 1);
  }
});
