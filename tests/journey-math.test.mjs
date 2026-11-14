import test from 'node:test';
import assert from 'node:assert/strict';
import { planJourney } from '../lib/journey-math.ts';

const VH = 900;
const TARGET = 1200;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('from the hero: glides down, no cut, duration clamped to 1.6', () => {
  const p = planJourney(0, TARGET, VH);
  assert.equal(p.cutTo, null);
  assert.equal(p.glideFrom, 0);
  assert.equal(p.duration, 1.6);
});

test('short trips clamp to 0.9', () => {
  assert.equal(planJourney(900, TARGET, VH).duration, 0.9);
  const p = planJourney(1200, TARGET, VH);
  assert.equal(p.cutTo, null);
  assert.equal(p.duration, 0.9);
});

test('upward trip within one viewport glides straight back', () => {
  const p = planJourney(1800, TARGET, VH);
  assert.equal(p.cutTo, null);
  near(p.duration, 0.5 + (0.9 * 600) / 900);
});

test('from the footer: cut to half a viewport above, then glide in', () => {
  const p = planJourney(30000, TARGET, VH);
  assert.equal(p.cutTo, 750);
  assert.equal(p.glideFrom, 750);
  near(p.duration, 0.5 + (0.9 * 450) / 900);
});

test('cut never goes below 0', () => {
  assert.equal(planJourney(30000, 200, VH).cutTo, 0);
});

test('downward trips over 3 viewports also cut', () => {
  assert.equal(planJourney(0, 5000, VH).cutTo, 4550);
});

test('degenerate viewport height stays finite and in range', () => {
  for (const vh of [0, -5]) {
    const p = planJourney(0, TARGET, vh);
    assert.ok(Number.isFinite(p.duration));
    assert.ok(p.duration >= 0.9 && p.duration <= 1.6);
    assert.ok(p.cutTo === null || Number.isFinite(p.cutTo));
  }
});
