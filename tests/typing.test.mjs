import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutTyping, revealCount } from '../lib/typing.ts';

const SEG = [{ text: 'Education before ' }, { text: 'execution', gold: true, flare: true }];

test('layout splits words and counts every char', () => {
  const l = layoutTyping(SEG);
  assert.equal(l.text, 'Education before execution');
  assert.equal(l.total, 26);
  assert.equal(l.words.length, 3);
  assert.deepEqual(
    l.words.map((w) => w.map((c) => c.ch).join('')),
    ['Education', 'before', 'execution'],
  );
});

test('gold and flare', () => {
  const l = layoutTyping(SEG);
  assert.deepEqual(l.words[2][0], { ch: 'e', i: 17, gold: true, flare: true });
  assert.equal(l.flareIndex, 17);
  assert.equal(l.words.flat().filter((c) => c.flare).length, 1);
  assert.ok(![...l.words[0], ...l.words[1]].some((c) => c.gold));
  assert.deepEqual(l.words[1].map((c) => c.i), [10, 11, 12, 13, 14, 15]);
});

test('no flare', () => {
  assert.equal(layoutTyping([{ text: 'a b' }]).flareIndex, -1);
});

test('revealCount endpoints', () => {
  assert.equal(revealCount(0, 350, 70, 26), 0);
  assert.equal(revealCount(349, 350, 70, 26), 0);
  assert.equal(revealCount(350, 350, 70, 26), 1);
  assert.equal(revealCount(350 + 70 * 25, 350, 70, 26), 26);
  assert.equal(revealCount(1e6, 350, 70, 26), 26);
});

test('revealCount is monotonic and bounded', () => {
  let prev = 0;
  for (let t = 0; t <= 3000; t += 7) {
    const n = revealCount(t, 350, 70, 26);
    assert.ok(n >= prev);
    assert.ok(n >= 0 && n <= 26);
    prev = n;
  }
});
