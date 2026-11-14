import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HANDOFF_FRAME, DOOR_FRAME, DOOR_VIDEO, videoPlacement, frameLockRect, nativeVideoRect,
  settleTransform, rectAt, covers,
} from '../lib/frame-sequence/handoff.ts';
import { coverDest } from '../lib/frame-sequence/math.ts';

const sz = (w, h) => ({ w, h });
const PORTRAIT = [sz(390, 844), sz(360, 780), sz(375, 667), sz(430, 932)];
const TABLET = [sz(768, 1024), sz(820, 1180)];
const DESKTOP = [sz(1024, 768), sz(1280, 800), sz(1440, 900), sz(1920, 1080), sz(2560, 1080), sz(3440, 1440)];
const ALL = [...PORTRAIT, ...TABLET, ...DESKTOP];

test('videoPlacement matches measured values', () => {
  const p = videoPlacement();
  assert.ok(p.k >= 1.215 && p.k <= 1.235);
  assert.ok(Math.abs(p.dx) < 3);
  assert.ok(p.dy >= -80 && p.dy <= -72);
});

test('lock rect covers every viewport', () => {
  for (const c of ALL) assert.ok(covers(frameLockRect(c), c), `${c.w}x${c.h}`);
});

test('doorway aligns between canvas frame and locked video', () => {
  for (const c of ALL) {
    const d = coverDest(HANDOFF_FRAME, c);
    const r = frameLockRect(c);
    const tol = Math.max(1.5, 0.006 * c.h);
    const fx = (v) => d.x + (v * d.w) / 1920;
    const fy = (v) => d.y + (v * d.h) / 1080;
    const vx = (v) => r.x + (v * r.w) / 1664;
    const vy = (v) => r.y + (v * r.h) / 1248;
    assert.ok(Math.abs(fx(DOOR_FRAME.x0) - vx(DOOR_VIDEO.x0)) <= tol, `x0 ${c.w}x${c.h}`);
    assert.ok(Math.abs(fx(DOOR_FRAME.x1) - vx(DOOR_VIDEO.x1)) <= tol, `x1 ${c.w}x${c.h}`);
    assert.ok(Math.abs(fy(DOOR_FRAME.y0) - vy(DOOR_VIDEO.y0)) <= tol, `y0 ${c.w}x${c.h}`);
    assert.ok(Math.abs(fy(DOOR_FRAME.y1) - vy(DOOR_VIDEO.y1)) <= tol, `y1 ${c.w}x${c.h}`);
  }
});

test('settle keeps portrait and tablet covered', () => {
  const run = (list, mode) => {
    for (const c of list) {
      const native = nativeVideoRect(c, mode);
      const lock = frameLockRect(c);
      for (let i = 0; i <= 10; i++) {
        assert.ok(covers(rectAt(native, settleTransform(native, lock, i / 10)), c), `${mode} ${c.w}x${c.h} s=${i / 10}`);
      }
    }
  };
  run(PORTRAIT, 'portrait');
  run(TABLET, 'tablet');
});

test('desktop settle', () => {
  for (const c of DESKTOP) {
    const native = nativeVideoRect(c, 'desktop');
    const lock = frameLockRect(c);
    assert.ok(covers(rectAt(native, settleTransform(native, lock, 0)), c), `${c.w}x${c.h} s=0`);
    const u = c.h / 1058;
    for (let i = 0; i <= 10; i++) {
      const r = rectAt(native, settleTransform(native, lock, i / 10));
      assert.ok(r.y <= 2 * u && r.y + r.h >= c.h - 2 * u, `${c.w}x${c.h} s=${i / 10}`);
    }
  }
});

test('settleTransform endpoints', () => {
  const n = { x: 10, y: 20, w: 300, h: 200 };
  const l = { x: -30, y: -5, w: 360, h: 240 };
  assert.deepEqual(settleTransform(n, l, 1), { k: 1, tx: 0, ty: 0 });
  const r = rectAt(n, settleTransform(n, l, 0));
  for (const k of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(r[k] - l[k]) < 1e-6);
});

test('native portrait uses 43% object-position', () => {
  const r = nativeVideoRect(sz(390, 844), 'portrait');
  assert.ok(Math.abs(r.x - -(1125.0 - 390) * 0.43) <= 1);
});
