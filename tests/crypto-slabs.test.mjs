import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRYPTO_SLAB_WINDOWS,
  CRYPTO_RAIL_HOLDS_S,
  slabPart,
  railU,
  cryptoRailSpec,
  coinTopPx,
  coinSafeTopPx,
} from '../lib/crypto-slabs.ts';
import { flowState } from '../lib/caption-flow.ts';
import { enterAt, leaveAt, unitStyle, TM_MAX_UNITS } from '../lib/text-motion.ts';
import { CRYPTO_SLAB_INTRO, CRYPTO_SLAB_TEACH, CRYPTO_SLAB_CLOSE, CRYPTO_RAIL_LINES } from '../lib/content.ts';
import { uniqueLocalFrames } from '../lib/frame-sequence/sources.ts';

const W = CRYPTO_SLAB_WINDOWS;
const COUNTS = { intro: 4, teach: 4, close: 2 };

test('slab windows are ordered and separate', () => {
  assert.ok(W.intro.outTo <= W.teach.inFrom);
  assert.ok(W.teach.outTo <= W.close.inFrom);
  for (const w of Object.values(W)) assert.ok(w.inFrom < w.inTo && w.inTo <= w.outFrom && w.outFrom < w.outTo);
});

function allAt(id, s, check) {
  for (let j = 0; j < COUNTS[id]; j++) check(slabPart(s, W[id], j, COUNTS[id]), j);
}

test('fully shown at the stops', () => {
  const shown = (o) => { assert.equal(o.opacity, 1); assert.equal(o.y, 0); };
  allAt('intro', 0, shown);
  allAt('intro', 1, shown);
  allAt('teach', 2, shown);
  allAt('close', 3, shown);
});

test('hidden where they should be', () => {
  const hidden = (o) => assert.equal(o.opacity, 0);
  for (const id of ['intro', 'teach', 'close']) allAt(id, -1, hidden);
  allAt('intro', 1.3, hidden);
  allAt('intro', 4, hidden);
  allAt('teach', 1, hidden);
  allAt('teach', 3, hidden);
  allAt('close', 2.5, hidden);
  allAt('close', 2, hidden);
  allAt('close', 3.28, hidden);
  allAt('close', 4, hidden);
});

test('continuity over s', () => {
  for (const id of ['intro', 'teach', 'close']) {
    for (let j = 0; j < COUNTS[id]; j++) {
      let prev = slabPart(-1, W[id], j, COUNTS[id]);
      let po = prev.opacity;
      let py = prev.y;
      for (let s = -1; s <= 4; s += 1e-4) {
        const o = slabPart(s, W[id], j, COUNTS[id]);
        assert.ok(Math.abs(o.opacity - po) < 0.01);
        assert.ok(Math.abs(o.y - py) < 0.1);
        po = o.opacity;
        py = o.y;
      }
    }
  }
  const s = (W.intro.inFrom + W.intro.inTo) / 2;
  assert.ok(slabPart(s, W.intro, 0, 4).opacity >= slabPart(s, W.intro, 3, 4).opacity);
});

test('reduced motion is a still crossfade', () => {
  const stops = { intro: [0, 1], teach: [2], close: [3] };
  for (const id of ['intro', 'teach', 'close']) {
    const w = W[id];
    let prev = null;
    for (let s = -1; s <= 4; s += 0.001) {
      const base = slabPart(s, w, 0, 4, true);
      for (let j = 0; j < 4; j++) {
        const o = slabPart(s, w, j, 4, true);
        assert.equal(o.y, 0);
        assert.equal(o.opacity, base.opacity);
      }
      if (s <= w.inFrom || s >= w.outTo) assert.equal(base.opacity, 0);
      if (prev !== null) assert.ok(Math.abs(base.opacity - prev) < 0.05);
      prev = base.opacity;
    }
    for (const st of stops[id]) assert.equal(slabPart(st, w, 0, 4, true).opacity, 1);
  }
});

// Mirrors the JSX in CryptoSlabs.tsx (parts in DOM order). Letters of the gold accent are counted without spaces.
const words = (t) => t.trim().split(/\s+/).filter(Boolean);
const letters = (t) => words(t).reduce((n, w) => n + Array.from(w).length, 0);
function unitCounts(copy, kind) {
  const parts = [];
  parts.push(kind === 'close' ? 3 : 2);                    // label: rule(s) + text
  parts.push(words(copy.title[0]).length);                 // plain title, words
  parts.push(letters(copy.title[1]));                      // gold accent, letters
  if (copy.body) parts.push(words(copy.body).length);      // body, words
  if (copy.tags) parts.push(copy.tags.length);             // intro chips
  if (copy.path) parts.push(copy.path.length * 2 - 1);     // teach path items + diamonds
  return parts;
}
const COPY = { intro: CRYPTO_SLAB_INTRO, teach: CRYPTO_SLAB_TEACH, close: CRYPTO_SLAB_CLOSE };
const STOPS = { intro: [0, 1], teach: [2], close: [3] };

// Raw-frame check shared by the close-text tests: the raw frame at s must be 157..198 (coin low).
function assertCoinLow(s) {
  const U = uniqueLocalFrames();
  const list = s < 3 ? 110 + (s - 2) * 32 : 142 + (s - 3) * 49;
  for (const i of [Math.floor(list), Math.ceil(list)]) {
    const raw = U[i] + 1;
    assert.ok(raw >= 157 && raw <= 198, `s=${s} list=${list} raw=${raw}`);
  }
}

test('units are settled at the stops and inside the windows', () => {
  for (const id of ['intro', 'teach', 'close']) {
    const w = W[id];
    const counts = unitCounts(COPY[id], id);
    const P = counts.length;
    assert.ok(counts.reduce((a, b) => a + b, 0) <= TM_MAX_UNITS, `${id} units`);
    for (let p = 0; p < P; p++) {
      for (let u = 0; u < counts[p]; u++) {
        for (const s of STOPS[id]) {
          assert.equal(enterAt(s, w.inFrom, w.inTo, p, P, u, counts[p]), 1);
          assert.equal(leaveAt(s, w.outFrom, w.outTo, p, P, u, counts[p]), 0);
        }
        for (let s = -1; s <= 4; s += 0.01) {
          if (s <= w.inFrom || s >= w.outTo) {
            const o = unitStyle('tilt', enterAt(s, w.inFrom, w.inTo, p, P, u, counts[p]), leaveAt(s, w.outFrom, w.outTo, p, P, u, counts[p]));
            assert.equal(o.opacity, 0);
          }
        }
      }
    }
  }
  const w = W.close;
  const counts = unitCounts(CRYPTO_SLAB_CLOSE, 'close');
  const P = counts.length;
  for (let s = 2; s <= 4; s += 0.001) {
    let any = false;
    for (let p = 0; p < P && !any; p++) {
      for (let u = 0; u < counts[p]; u++) {
        const o = unitStyle('tilt', enterAt(s, w.inFrom, w.inTo, p, P, u, counts[p]), leaveAt(s, w.outFrom, w.outTo, p, P, u, counts[p]));
        if (o.opacity > 0) { any = true; break; }
      }
    }
    if (any) assertCoinLow(s);
  }
});

test('close text only while the coin is low', () => {
  for (let s = 2; s <= 4; s += 0.001) {
    let any = false;
    for (let j = 0; j < 2; j++) if (slabPart(s, W.close, j, 2).opacity > 0) any = true;
    if (any) assertCoinLow(s);
  }
});

test('rail copy fits', () => {
  assert.equal(CRYPTO_RAIL_LINES.length, CRYPTO_RAIL_HOLDS_S.length);
  for (const [label, text] of CRYPTO_RAIL_LINES) {
    assert.ok(text.length <= 28, text);
    assert.ok(label.length <= 20, label);
  }
  assert.ok(CRYPTO_SLAB_CLOSE.label.length <= 22);
  assert.ok(CRYPTO_SLAB_TEACH.label.length <= 22);
});

test('coin clearance for the slab 3 text', () => {
  for (let w = 320; w <= 3840; w += 8) {
    for (let h = 320; h <= 1600; h += 8) {
      assert.ok(coinSafeTopPx(w, h) <= coinTopPx(w, h), `${w}x${h}`);
    }
  }
});

test('rail holds sit on the stops', () => {
  const spec = cryptoRailSpec();
  [0, 2, 3, 4].forEach((idx, k) => {
    const f = flowState(railU(k), spec);
    assert.equal(f.index, idx);
    assert.equal(f.draw, 0);
    assert.equal(f.advance, 0);
    assert.equal(f.enter, 1);
    assert.equal(f.exit, 0);
  });
  assert.equal(flowState(railU(3.4), spec).exit, 1);
  assert.ok(spec.from < spec.steps[0].start);
  for (let i = 1; i < spec.steps.length; i++) assert.ok(spec.steps[i].start > spec.steps[i - 1].end);
  assert.ok(spec.steps[4].end < spec.to);
});
