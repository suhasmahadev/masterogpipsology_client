import test from 'node:test';
import assert from 'node:assert/strict';
import { indicatorTransform, stretchKeyframes } from '../components/nav/nav-math.ts';

test('indicatorTransform maps left/width to x/sx', () => {
  assert.deepEqual(indicatorTransform(40, 80), { x: 40, sx: 80 });
});
test('stretch forward spans the union then lands on target', () => {
  const [a, b] = stretchKeyframes(0, 50, 100, 60);
  assert.deepEqual(a, { x: 0, sx: 160 });
  assert.deepEqual(b, { x: 100, sx: 60 });
});
test('stretch backward spans the union', () => {
  const [a, b] = stretchKeyframes(100, 60, 0, 50);
  assert.deepEqual(a, { x: 0, sx: 160 });
  assert.deepEqual(b, { x: 0, sx: 50 });
});
