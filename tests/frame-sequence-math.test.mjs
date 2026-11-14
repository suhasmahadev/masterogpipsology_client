import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sectionProgress,
  damp,
  computeBackingSize,
  coverCrop,
  coverDest,
  nearestAvailable,
  fetchScore,
  pickNextFetch,
  decodeWindow,
  pickNextDecode,
  bitmapBudget,
  frameVelocity,
  lookahead,
  decodeStride,
  retryDelayMs,
  splitBudget,
  FETCH_HORIZON_PENALTY,
} from '../lib/frame-sequence/math.ts';

test('sectionProgress', () => {
  assert.equal(sectionProgress(0, 100, 1000, 500), 0);
  assert.equal(sectionProgress(350, 100, 1000, 500), 0.5);
  assert.equal(sectionProgress(9999, 100, 1000, 500), 1);
  assert.equal(sectionProgress(300, 100, 500, 500), 0);
  assert.equal(sectionProgress(300, 100, 400, 500), 0);
});

test('damp', () => {
  assert.equal(damp(0, 1, 0, 0.016), 1);
  const v = damp(0, 1, 10, 0.016);
  assert.ok(v > 0 && v < 1);
  const two = damp(damp(0, 1, 10, 0.008), 1, 10, 0.008);
  assert.ok(Math.abs(two - v) < 1e-9);
  assert.equal(damp(0.999995, 1, 10, 0.016), 1);
});

test('computeBackingSize', () => {
  const src = { w: 1920, h: 1080 };
  assert.deepEqual(computeBackingSize({ w: 1440, h: 900 }, src, 2), { w: 1728, h: 1080 });
  const p = computeBackingSize({ w: 390, h: 844 }, src, 3);
  assert.ok(Math.abs(p.w - 499) <= 1 && Math.abs(p.h - 1080) <= 1);
  assert.deepEqual(computeBackingSize({ w: 2560, h: 1440 }, src, 2), { w: 2560, h: 1440 });
  const one = computeBackingSize({ w: 1440, h: 900 }, src, 1);
  assert.ok(one.w <= 1440 && one.h <= 900);
});

test('coverCrop', () => {
  const src = { w: 1920, h: 1080 };
  assert.deepEqual(coverCrop(src, { w: 1728, h: 1080 }), { x: 96, y: 0, w: 1728, h: 1080 });
  const p = coverCrop(src, { w: 499, h: 1080 });
  assert.ok(Math.abs(p.x - 710) <= 1 && Math.abs(p.w - 499) <= 1);
  for (const dest of [{ w: 499, h: 1080 }, { w: 1728, h: 1080 }, { w: 1000, h: 1000 }, { w: 2560, h: 1440 }]) {
    const c = coverCrop(src, dest);
    assert.ok(c.x + c.w <= src.w && c.y + c.h <= src.h && c.w >= 1 && c.h >= 1);
    for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isInteger(c[k]));
  }
});

test('coverDest', () => {
  assert.deepEqual(coverDest({ w: 1728, h: 1080 }, { w: 1728, h: 1080 }), { x: 0, y: 0, w: 1728, h: 1080 });
  const d = coverDest({ w: 1920, h: 1080 }, { w: 1000, h: 1000 });
  assert.equal(d.h, 1000);
  assert.ok(Math.abs(d.w - 1778) <= 1);
  assert.ok(Math.abs(d.x + 389) <= 1);
});

test('nearestAvailable', () => {
  assert.equal(nearestAvailable([0, 0, 1, 0, 1], 3), 2);
  assert.equal(nearestAvailable([0, 0, 0], 1), -1);
  assert.equal(nearestAvailable([0, 1, 1], 1), 1);
});

test('fetchScore', () => {
  assert.ok(fetchScore(105, 100, 1, 12) < 1_000_000);
  assert.ok(fetchScore(200, 100, 1, 12) < 1_000_000 === false);
  assert.ok(fetchScore(208, 100, 1, 12) < fetchScore(201, 100, 1, 12)); // stride 16 vs stride 1
  assert.ok(fetchScore(95, 100, 1, 12) > fetchScore(105, 100, 1, 12));
  assert.ok(fetchScore(105, 100, -1, 12) > fetchScore(95, 100, -1, 12));
});

test('pickNextFetch', () => {
  const state = new Uint8Array(240);
  assert.equal(pickNextFetch(state, [0, 239], 100, 1, 12, false), 0);
  state[0] = 2;
  assert.equal(pickNextFetch(state, [0, 239], 100, 1, 12, false), 239);
  state[239] = 2;
  assert.equal(pickNextFetch(state, [0, 239], 100, 1, 12, false), -1);
  const first = pickNextFetch(state, [0, 239], 100, 1, 12, true);
  assert.ok(first >= 100 && first <= 112);
});

test('decodeWindow', () => {
  assert.deepEqual(decodeWindow(5, 1, 240, 20, 10), [0, 25]);
  assert.deepEqual(decodeWindow(235, 1, 240, 20, 10), [225, 239]);
  assert.deepEqual(decodeWindow(100, -1, 240, 20, 10), [80, 110]);
  assert.deepEqual(decodeWindow(100, 1, 240, 20, 10), [90, 120]);
});

test('pickNextDecode', () => {
  const needs = new Uint8Array(240);
  assert.equal(pickNextDecode(needs, [0, 239], 100, 1, 90, 120), -1);
  needs[95] = 1; needs[105] = 1; needs[130] = 1;
  assert.equal(pickNextDecode(needs, [], 100, 1, 90, 120), 105);
  assert.equal(pickNextDecode(needs, [], 100, -1, 90, 120), 95);
  needs[130] = 1;
  needs[105] = 0; needs[95] = 0;
  assert.equal(pickNextDecode(needs, [], 100, 1, 90, 120), -1); // 130 outside window
  needs[239] = 1;
  assert.equal(pickNextDecode(needs, [0, 239], 100, 1, 90, 120), 239);
  assert.equal(pickNextDecode(new Uint8Array(10), [], 5, 1, 1, 0), -1);
});

test('bitmapBudget', () => {
  assert.equal(bitmapBudget({ w: 1728, h: 1080 }, 8, 240), 53);
  assert.equal(bitmapBudget({ w: 1728, h: 1080 }, undefined, 240), bitmapBudget({ w: 1728, h: 1080 }, 4, 240));
  assert.equal(bitmapBudget({ w: 3000, h: 3000 }, 1, 240), 16);
  assert.equal(bitmapBudget({ w: 100, h: 100 }, 8, 240), 240);
  assert.equal(bitmapBudget({ w: 100, h: 100 }, 8, 100), 100);
});

test('frameVelocity', () => {
  let v = 0;
  for (let i = 0; i < 30; i++) v = frameVelocity(v, 4, 1 / 60);
  assert.ok(Math.abs(v - 240) / 240 < 0.05);
  assert.equal(frameVelocity(240, 0, 1), 0);
  assert.equal(frameVelocity(7, 3, 0), 7);
});

test('lookahead', () => {
  assert.deepEqual(lookahead(0, 16), { ahead: 9, behind: 7 });
  assert.deepEqual(lookahead(300, 16), { ahead: 14, behind: 2 });
  assert.deepEqual(lookahead(0, 40), { ahead: 22, behind: 18 });
  for (const w of [8, 16, 53]) {
    const { ahead, behind } = lookahead(100, w);
    assert.equal(ahead + behind, w);
  }
});

test('decodeStride', () => {
  assert.equal(decodeStride(0, 14), 1);
  assert.equal(decodeStride(300, 14), 4);
  assert.equal(decodeStride(40, 20), 1);
  assert.equal(decodeStride(100, 20), 3);
});

test('retryDelayMs', () => {
  assert.equal(retryDelayMs(1), 500);
  assert.equal(retryDelayMs(2), 1000);
  assert.equal(retryDelayMs(3), 2000);
  assert.equal(retryDelayMs(5), 8000);
  assert.equal(retryDelayMs(10), 8000);
});

test('pickNextFetch with backoff and warm', () => {
  const state = new Uint8Array(10);
  const notBefore = new Float64Array(10);
  notBefore[0] = 1000;
  assert.equal(pickNextFetch(state, [0], 0, 1, 4, false, [], notBefore, 500), -1);
  assert.equal(pickNextFetch(state, [0], 0, 1, 4, false, [5], notBefore, 500), 5);
  assert.equal(pickNextFetch(state, [0], 0, 1, 4, false, [], notBefore, 1500), 0);
});

test('pickNextDecode with stride', () => {
  const needs = new Uint8Array(40);
  for (let i = 10; i <= 30; i++) needs[i] = 1;
  assert.equal(pickNextDecode(needs, [], 10, 1, 10, 30, 4), 12);
  for (let i = 0; i < 40; i += 4) needs[i] = 0;
  assert.equal(pickNextDecode(needs, [], 10, 1, 10, 30, 4), 10);
});

test('bitmapBudget with coarse pointer', () => {
  assert.equal(bitmapBudget({ w: 864, h: 1080 }, undefined, 240, true), 44);
  assert.equal(bitmapBudget({ w: 864, h: 1080 }, 8, 240, true), 53);
  assert.equal(bitmapBudget({ w: 1920, h: 1080 }, 8, 240), 48);
  assert.equal(bitmapBudget({ w: 1920, h: 1080 }, 4, 240), 32);
});

test('fetchScore horizon', () => {
  assert.ok(fetchScore(300, 0, 1, 24, 192) >= FETCH_HORIZON_PENALTY);
  assert.ok(fetchScore(160, 0, 1, 24, 192) < FETCH_HORIZON_PENALTY);
  assert.equal(fetchScore(10, 0, 1, 24, 5), 10);
  assert.equal(fetchScore(300, 0, 1, 24), fetchScore(300, 0, 1, 24, Infinity));
});

test('pickNextFetch horizon', () => {
  const state = new Uint8Array(400);
  for (let i = 0; i < 400; i++) if (i <= 24 || i % 16 === 0 || (i % 8 === 0 && i <= 100)) state[i] = 2;
  assert.equal(pickNextFetch(state, [], 0, 1, 24, true), 104);
  assert.equal(pickNextFetch(state, [], 0, 1, 24, true, [], undefined, 0, 100), 28);
});

test('splitBudget', () => {
  assert.equal(splitBudget(46, 1, 0, false, 2), 46);
  assert.equal(splitBudget(46, 2, 1, true, 2), 34);
  assert.equal(splitBudget(46, 2, 1, false, 2), 14);
  assert.equal(splitBudget(46, 2, 0, false, 2), 23);
  assert.equal(splitBudget(46, 2, 2, true, 2), 23);
  assert.equal(splitBudget(20, 3, 1, true, 2), 16);
});
