import test from 'node:test';
import assert from 'node:assert/strict';
import { heroZoom, screenXOfImageU } from '../lib/hero-zoom.ts';

test('heroZoom endpoints', () => {
  const z0 = heroZoom(0, 0.65);
  assert.equal(z0.scale, 1);
  assert.equal(z0.panFrac, 0);
  assert.ok(Math.abs(heroZoom(1, 0.5).scale - 10 / 8.4) < 1e-9);
});

test('heroZoom keeps the photo covering the hero', () => {
  for (let i = 0; i <= 20; i++) {
    const p = i * 0.05;
    for (const fx of [0, 0.2, 0.5, 0.8, 1]) {
      const z = heroZoom(p, fx);
      assert.ok(Math.abs(z.scale * z.panFrac) <= (z.scale - 1) / 2 + 1e-9);
    }
  }
});

test('screenXOfImageU', () => {
  assert.equal(screenXOfImageU(0.727, 1920, 900), 0.727);
  assert.ok(Math.abs(screenXOfImageU(0.727, 390, 844) - 0.946) < 0.005);
});

test('scale strictly increases with progress', () => {
  let prev = 0;
  for (let i = 0; i <= 20; i++) {
    const s = heroZoom(i * 0.05, 0.65).scale;
    assert.ok(s > prev);
    prev = s;
  }
});
