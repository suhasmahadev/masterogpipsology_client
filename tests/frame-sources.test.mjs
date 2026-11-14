import test from 'node:test';
import assert from 'node:assert/strict';
import { frameUrl, buildFrameSet, chooseFrameTier, warmIndices, uniqueLocalFrames, UNIQUE_LOCAL, UNIQUE_PER_SEQ, SEQ_SCROLL_VH, FOREX_OVERLAP_VH } from '../lib/frame-sequence/sources.ts';

test('frameUrl', () => {
  assert.equal(frameUrl('crypto', 0, 'full'), '/assets/crypto/ezgif-frame-001.jpg');
  assert.equal(frameUrl('stock_market', 239, 'lite'), '/frames/v1/stock_market/1280/240.webp');
  assert.equal(frameUrl('forex', 9, 'portrait'), '/frames/v1/forex/p1080/010.webp');
});

test('buildFrameSet', () => {
  const s = buildFrameSet(['forex', 'stock_market', 'opportunity'], 'portrait');
  assert.equal(s.urls.length, 720);
  assert.equal(s.urls[240], '/frames/v1/stock_market/p1080/001.webp');
  assert.equal(s.fallback[240], '/assets/stock_market/ezgif-frame-001.jpg');
  assert.deepEqual(s.expected, { w: 864, h: 1080 });
  const f = buildFrameSet(['crypto'], 'full');
  assert.equal(f.fallback, null);
  assert.equal(f.urls.length, 240);
});

test('chooseFrameTier', () => {
  assert.equal(chooseFrameTier({ cssW: 390, cssH: 844, dpr: 3 }), 'portrait');
  assert.equal(chooseFrameTier({ cssW: 768, cssH: 1024, dpr: 2 }), 'portrait');
  assert.equal(chooseFrameTier({ cssW: 1440, cssH: 900, dpr: 1 }), 'full');
  assert.equal(chooseFrameTier({ cssW: 1366, cssH: 768, dpr: 1 }), 'lite');
  assert.equal(chooseFrameTier({ cssW: 1280, cssH: 800, dpr: 2 }), 'full');
  assert.equal(chooseFrameTier({ cssW: 1440, cssH: 900, dpr: 2, saveData: true }), 'lite');
  assert.equal(chooseFrameTier({ cssW: 1920, cssH: 1080, dpr: 1, effectiveType: '3g' }), 'lite');
  assert.equal(chooseFrameTier({ cssW: 1920, cssH: 1080, dpr: 1, deviceMemoryGB: 2 }), 'lite');
  assert.equal(chooseFrameTier({ cssW: 844, cssH: 390, dpr: 3, coarsePointer: true }), 'lite');
  assert.equal(chooseFrameTier({ cssW: 1024, cssH: 1280, dpr: 2 }), 'portrait');
});

test('warmIndices', () => {
  const w = warmIndices(240);
  assert.equal(w.length, 51);
  assert.equal(w[0], 0);
  for (const i of [23, 24, 32, 232]) assert.ok(w.includes(i));
  assert.ok(!w.includes(25));
  for (let i = 1; i < w.length; i++) assert.ok(w[i] > w[i - 1]);
});

test('uniqueLocalFrames drops pulldown duplicates', () => {
  assert.equal(uniqueLocalFrames(240).length, 192);
  assert.equal(UNIQUE_PER_SEQ, 192);
  assert.equal(SEQ_SCROLL_VH, 350);
  assert.equal(FOREX_OVERLAP_VH, 100);
  assert.deepEqual(UNIQUE_LOCAL.slice(0, 7), [0, 1, 3, 4, 5, 6, 8]);
  assert.ok(UNIQUE_LOCAL.includes(239));
  for (const x of [2, 7, 237]) assert.ok(!UNIQUE_LOCAL.includes(x));
  for (let k = 1; k < UNIQUE_LOCAL.length; k++) assert.ok(UNIQUE_LOCAL[k] > UNIQUE_LOCAL[k - 1]);
});

test('buildFrameSet with unique locals', () => {
  const s = buildFrameSet(['forex', 'stock_market', 'opportunity'], 'portrait', 240, UNIQUE_LOCAL);
  assert.equal(s.urls.length, 576);
  assert.equal(s.urls[2], '/frames/v1/forex/p1080/004.webp');
  assert.equal(s.urls[192], '/frames/v1/stock_market/p1080/001.webp');
  assert.equal(s.urls[575], '/frames/handoff-v1/opportunity/p1080/240.webp');
  assert.equal(s.fallback[575], '/frames/handoff-v1/opportunity/1920/240.jpg');
  const c = buildFrameSet(['crypto'], 'full', 240, UNIQUE_LOCAL);
  assert.equal(c.urls.length, 192);
  assert.equal(c.fallback, null);
});

import { chooseFrameClass, tierFor, resolveSessionClass, sessionFrameTier } from '../lib/frame-sequence/sources.ts';

test('chooseFrameClass', () => {
  assert.equal(chooseFrameClass({ cssW: 1920, cssH: 1080, dpr: 1 }), 'full');
  assert.equal(chooseFrameClass({ cssW: 1366, cssH: 768, dpr: 1 }), 'lite');
  assert.equal(chooseFrameClass({ cssW: 1440, cssH: 900, dpr: 1 }), 'full');
  assert.equal(chooseFrameClass({ cssW: 1920, cssH: 1080, dpr: 1, coarsePointer: true }), 'lite');
  assert.equal(chooseFrameClass({ cssW: 2560, cssH: 1440, dpr: 1, saveData: true }), 'lite');
});

test('tierFor', () => {
  assert.equal(tierFor('lite', true), 'portrait');
  assert.equal(tierFor('full', false), 'full');
});

test('resolveSessionClass', () => {
  const never = () => { throw new Error('detect must not be called'); };
  assert.deepEqual(resolveSessionClass('lite', 'full', never), { cls: 'lite', store: true });
  assert.deepEqual(resolveSessionClass(null, 'full', never), { cls: 'full', store: false });
  assert.deepEqual(resolveSessionClass(null, 'junk', () => 'lite'), { cls: 'lite', store: true });
  assert.deepEqual(resolveSessionClass('bogus', null, () => 'full'), { cls: 'full', store: true });
});

test('sessionFrameTier in node (no window)', () => {
  assert.equal(sessionFrameTier(), 'full');
});
