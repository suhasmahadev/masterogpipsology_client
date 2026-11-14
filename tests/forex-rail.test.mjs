import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOREX_CHAIN_STOPS, forexRailSpec, forexRailU,
} from '../lib/forex-rail.ts';
import { chainStopIndices, FOREX_STOPS_RAW, STOCK_STOPS_RAW, OPPORTUNITY_STOPS_RAW } from '../lib/step-scroll.ts';
import { UNIQUE_LOCAL } from '../lib/frame-sequence/sources.ts';
import { flowState } from '../lib/caption-flow.ts';

const spec = forexRailSpec();
const st = (u) => flowState(u, spec);

test('chain stops are locked to the raw picks', () => {
  assert.deepEqual([...FOREX_CHAIN_STOPS], chainStopIndices([FOREX_STOPS_RAW, STOCK_STOPS_RAW, OPPORTUNITY_STOPS_RAW], UNIQUE_LOCAL));
  assert.deepEqual([UNIQUE_LOCAL[50] + 1, UNIQUE_LOCAL[88] + 1, UNIQUE_LOCAL[154] + 1, UNIQUE_LOCAL[25] + 1], [64, 111, 194, 32]);
  assert.deepEqual([...FOREX_CHAIN_STOPS], [0, 50, 88, 154, 217, 342, 461, 556, 575]);
});

test('spec windows', () => {
  assert.equal(spec.steps.length, 13);
  spec.steps.forEach((w, i) => {
    assert.ok(w.start >= 0 && w.end <= 1);
    assert.ok(w.start < w.end);
    if (i < 12) assert.ok(w.end < spec.steps[i + 1].start);
  });
  assert.ok(Math.abs(spec.from - 0.05) < 1e-12);
  assert.ok(Math.abs(spec.to - 0.75) < 1e-12);
});

test('stops are fully in place', () => {
  for (const [k, row] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 8], [6, 12]]) {
    const s = st(forexRailU(k));
    assert.equal(s.index, row);
    assert.equal(s.draw, 0);
    assert.equal(s.advance, 0);
    assert.equal(s.enter, 1);
    assert.equal(s.exit, 0);
  }
});

test('captions change only between stops', () => {
  for (let k = 0; k < 4; k++) {
    for (let s = k; s < k + 0.9 - 1e-9; s += 0.01) assert.equal(st(forexRailU(s)).index, k, `s=${s}`);
    assert.equal(st(forexRailU(k + 0.95)).index, k + 1);
    assert.ok(st(forexRailU(k + 0.5)).draw > 0);
  }
});

test('entry', () => {
  assert.equal(st(forexRailU(-1)).enter, 0);
  assert.equal(st(forexRailU(-0.5)).enter, 0);
  const e = st(forexRailU(-0.3)).enter;
  assert.ok(e > 0 && e < 1);
});

test('NaN s', () => {
  assert.equal(forexRailU(NaN), 0);
  assert.equal(forexRailU(-5), 0);
});
