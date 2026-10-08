import test from 'node:test';
import assert from 'node:assert/strict';
import { CANDLES } from '../lib/three/hero-candles.ts';
import { liveRing, liveClock, formingCandle, ringRange } from '../lib/live-candles.ts';

const near = (a, b) => Math.abs(a - b) < 1e-9;

test('ring has 72 entries and is continuous', () => {
  const ring = liveRing(CANDLES);
  assert.equal(ring.length, 72);
  for (let i = 0; i < 72; i++) assert.ok(near(ring[i][1], ring[(i + 1) % 72][0]));
});

test('liveClock', () => {
  assert.deepEqual(liveClock(0), { start: 0, phase: 0, f: 0 });
  assert.equal(liveClock(4.5 + 0.7).f, 1);
  assert.equal(liveClock(9.1).start, 2);
});

test('formingCandle is continuous at step edges and keeps wicks valid', () => {
  const c = CANDLES[10];
  for (const ph of [0, 4.5]) {
    const f = formingCandle(c, ph);
    for (let k = 0; k < 4; k++) assert.ok(near(f[k], c[k]));
  }
  for (let ph = 0; ph <= 4.5; ph += 0.1) {
    const f = formingCandle(c, ph);
    assert.ok(f[2] >= Math.max(f[0], f[1]) - 1e-12);
    assert.ok(f[3] <= Math.min(f[0], f[1]) + 1e-12);
  }
});

test('ringRange', () => {
  const r = ringRange(liveRing(CANDLES));
  assert.ok(near(r.min, 0.13));
  assert.ok(near(r.max, 1));
});
