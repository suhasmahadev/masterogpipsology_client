import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoadProgress } from '../lib/load-progress.ts';

test('empty gives 1 and allDone', () => {
  const lp = createLoadProgress();
  assert.equal(lp.progress(), 1);
  assert.equal(lp.allDone(), true);
});
test('weights combine', () => {
  const lp = createLoadProgress();
  lp.register('a', 0.25);
  lp.register('b', 0.75);
  lp.complete('a');
  assert.equal(lp.progress(), 0.25);
  assert.equal(lp.allDone(), false);
  lp.update('b', 0.5);
  assert.equal(lp.progress(), 0.625);
  lp.complete('b');
  assert.equal(lp.allDone(), true);
});
test('unknown id ignored and values clamp', () => {
  const lp = createLoadProgress();
  lp.register('a', 1);
  lp.update('nope', 1);
  assert.equal(lp.progress(), 0);
  lp.update('a', 5);
  assert.equal(lp.progress(), 1);
  lp.update('a', -3);
  assert.equal(lp.progress(), 0);
});
test('subscribe and unsubscribe', () => {
  const lp = createLoadProgress();
  lp.register('a', 1);
  const seen = [];
  const off = lp.subscribe((p) => seen.push(p));
  lp.update('a', 0.5);
  off();
  lp.update('a', 1);
  assert.deepEqual(seen, [0.5]);
});
