import test from 'node:test';
import assert from 'node:assert/strict';
import { frameUrl, buildFrameSet, chooseFrameTier, warmIndices } from '../lib/frame-sequence/sources.ts';

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
