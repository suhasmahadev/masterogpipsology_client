import test from 'node:test';
import assert from 'node:assert/strict';
import { tickRing, roseRing, sunburst, circlePath, subpathCount } from '../lib/guilloche.ts';

test('tickRing subpaths', () => {
  assert.equal(subpathCount(tickRing(120, 462, 480, 448, 10)), 120);
});

test('roseRing: 72 subpaths, all numbers within the viewBox', () => {
  const d = roseRing(72, 405, 48);
  assert.equal(subpathCount(d), 72);
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  for (const n of nums) assert.ok(n >= 0 && n <= 1000, String(n));
});

test('sunburst: 96 lines of 24 points within the radius band', () => {
  const d = sunburst(96, 150, 340, 0.012, 6, 24);
  assert.equal(subpathCount(d), 96);
  const pts = [...d.matchAll(/[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)];
  assert.equal(pts.length, 96 * 24);
  for (const m of pts) {
    const r = Math.hypot(Number(m[1]) - 500, Number(m[2]) - 500);
    assert.ok(r >= 149.9 && r <= 340.1, String(r));
  }
});

test('deterministic', () => {
  assert.equal(sunburst(96, 150, 340, 0.012, 6, 24), sunburst(96, 150, 340, 0.012, 6, 24));
});

test('circlePath has two arcs', () => {
  assert.equal(circlePath(492).split('A').length - 1, 2);
});
