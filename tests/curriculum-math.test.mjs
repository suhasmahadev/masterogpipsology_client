import test from 'node:test';
import assert from 'node:assert/strict';
import { weeksForChapter } from '../lib/curriculum-math.ts';

test('chapter i covers weeks 2i+1..2i+2 by default', () => {
  assert.deepEqual(weeksForChapter(0), [1, 2]);
  assert.deepEqual(weeksForChapter(3), [7, 8]);
  assert.deepEqual(weeksForChapter(5), [11, 12]);
});
test('custom chapter/week counts split evenly', () => {
  assert.deepEqual(weeksForChapter(1, 4, 12), [4, 6]);
});
