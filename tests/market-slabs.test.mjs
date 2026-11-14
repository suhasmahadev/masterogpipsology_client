import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKET_SLAB_WINDOWS as W, marketSlabX } from '../lib/market-slabs.ts';
import { slabPart } from '../lib/crypto-slabs.ts';
import { enterAt, leaveAt, TM_MAX_UNITS, splitWords, splitChars } from '../lib/text-motion.ts';
import { FOREX_SLAB, STOCK_SLAB } from '../lib/content.ts';

const FOLDER_CUT_S = 3.595;

test('windows are ordered', () => {
  assert.ok(W.forex.outTo <= FOLDER_CUT_S);
  assert.ok(W.forex.outTo <= W.stock.inFrom);
  assert.ok(W.forex.inFrom > -0.72);
  for (const w of Object.values(W)) assert.ok(w.inFrom < w.inTo && w.inTo <= w.outFrom && w.outFrom < w.outTo);
});

test('fully shown at the stops, units settled', () => {
  const cases = [
    ['forex', 0], ['forex', 1], ['forex', 2], ['forex', 3],
    ['stock', 4], ['stock', 5],
  ];
  for (const [id, x] of cases) {
    const w = W[id];
    const p = slabPart(x, w, 0, 1);
    assert.equal(p.opacity, 1, `${id} ${x}`);
    assert.equal(p.y, 0);
    for (let part = 0; part < 4; part++) {
      for (let unit = 0; unit < 6; unit++) {
        assert.equal(enterAt(x, w.inFrom, w.inTo, part, 4, unit, 6), 1);
        assert.equal(leaveAt(x, w.outFrom, w.outTo, part, 4, unit, 6), 0);
      }
    }
  }
});

test('hidden where they should be', () => {
  assert.equal(slabPart(-1, W.forex, 0, 1).opacity, 0);
  assert.equal(slabPart(3.6, W.forex, 0, 1).opacity, 0);
  assert.equal(slabPart(3.6, W.stock, 0, 1).opacity, 0);
  assert.equal(slabPart(5.4, W.stock, 0, 1).opacity, 0);
});

test('marketSlabX', () => {
  assert.equal(marketSlabX(4), 4);
  assert.equal(marketSlabX(5.5), 5.5);
  assert.equal(marketSlabX(NaN), -1);
  assert.equal(marketSlabX(2), 2);
});

test('copy unit budget', () => {
  const count = (c) => 1 + 1 + splitWords(c.title[0]).length
    + splitWords(c.title[1]).reduce((n, w) => n + splitChars(w).length, 0)
    + splitWords(c.body).length + c.tags.length;
  assert.equal(count(FOREX_SLAB), 54);
  assert.equal(count(STOCK_SLAB), 58);
  assert.ok(count(FOREX_SLAB) <= TM_MAX_UNITS && count(STOCK_SLAB) <= TM_MAX_UNITS);
  assert.ok(FOREX_SLAB.label.length <= 32 && STOCK_SLAB.label.length <= 32);
});

test('reduced motion: no movement', () => {
  for (let x = -1; x <= 5; x += 0.1) {
    assert.equal(slabPart(x, W.forex, 0, 1, true).y, 0);
    assert.equal(slabPart(x, W.stock, 0, 1, true).y, 0);
  }
});
