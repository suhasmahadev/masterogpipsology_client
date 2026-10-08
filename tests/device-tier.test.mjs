import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTier } from '../lib/device-tier-core.ts';

const base = { reducedMotion: false, width: 1440, coarsePointer: false, deviceMemory: 8, cores: 8, saveData: false, webgl2: true };

test('reduced motion gives static', () => {
  assert.equal(computeTier({ ...base, reducedMotion: true }), 'static');
});
test('mobile width gives low', () => {
  assert.equal(computeTier({ ...base, width: 390 }), 'low');
});
test('coarse pointer gives low', () => {
  assert.equal(computeTier({ ...base, coarsePointer: true }), 'low');
});
test('low memory gives low', () => {
  assert.equal(computeTier({ ...base, deviceMemory: 2 }), 'low');
});
test('no webgl2 gives low', () => {
  assert.equal(computeTier({ ...base, webgl2: false }), 'low');
});
test('desktop gives high', () => {
  assert.equal(computeTier(base), 'high');
});
