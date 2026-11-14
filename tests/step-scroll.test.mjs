import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRYPTO_STOPS_RAW,
  FOREX_STOPS_RAW,
  STOCK_STOPS_RAW,
  linearFrameMap,
  knotFrameMap,
  chainStopIndices,
  STEP_FPS,
  STEP_EASE_IN_S,
  STEP_DECEL_S,
  STEP_DECEL_POW,
  glideProfile,
  glideEase,
  handoffEndY,
  stopListIndex,
  knotProgress,
  framePos,
  progressAt,
  stopScrollY,
  sectionProgressOf,
  createWheelGesture,
  feedWheel,
  decideStep,
  stopAt,
  nearestStop,
  stopCoord,
} from '../lib/step-scroll.ts';
import { uniqueLocalFrames } from '../lib/frame-sequence/sources.ts';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b} (eps ${eps})`);
const U = uniqueLocalFrames();
const ST = [0, 89, 110, 142];
const KP = 5 / 7;

test('stopListIndex maps raw files to list indices', () => {
  assert.deepEqual(CRYPTO_STOPS_RAW.map((r) => stopListIndex(r, U)), ST);
  assert.equal(stopListIndex(3, U), 1);
  assert.equal(stopListIndex(240, U), 191);
  assert.equal(stopListIndex(0, U), 0);
});

test('knotProgress', () => {
  near(knotProgress(350, 100), 5 / 7);
});

test('framePos is piecewise linear with a knot at the last stop', () => {
  assert.equal(framePos(0, 192, 142, KP), 0);
  near(framePos(KP, 192, 142, KP), 142);
  assert.equal(framePos(1, 192, 142, KP), 191);
  let prev = -1;
  for (let i = 0; i <= 1000; i++) {
    const v = framePos(i / 1000, 192, 142, KP);
    assert.ok(v >= prev);
    prev = v;
  }
  assert.ok(Math.abs(framePos(KP + 1e-9, 192, 142, KP) - framePos(KP - 1e-9, 192, 142, KP)) < 1e-5);
});

test('framePos / progressAt round trip', () => {
  for (const pos of [0, 44.5, 89, 110, 142, 160, 191]) {
    near(framePos(progressAt(pos, 192, 142, KP), 192, 142, KP), pos, 1e-9);
  }
});

test('desktop stop offsets', () => {
  const ys = ST.map((i) => stopScrollY(i, 192, 142, KP, 1000, 3500));
  assert.equal(ys[0], 1000);
  near(ys[3], 3500);
  for (let k = 1; k < ys.length; k++) assert.ok(ys[k] > ys[k - 1]);
  for (let k = 0; k < ys.length; k++) {
    near(framePos(sectionProgressOf(ys[k], 1000, 4500, 1000), 192, 142, KP), ST[k]);
  }
});

test('mobile: the hand-off stop is never inside the fade', () => {
  const L = 1000;
  for (const D of [1000, 950, 900, 800]) {
    assert.ok(stopScrollY(142, 192, 142, KP, 0, 4.5 * L - D) <= 3.5 * L - D + 1e-9);
  }
});

test('glideProfile durations', () => {
  near(glideProfile(89).duration, 2.7208333, 1e-6);
  near(glideProfile(21).duration, 1.1484375, 1e-6);
  near(glideProfile(32).duration, 1.5333333, 1e-6);
  near(glideProfile(49).duration, 1.8875, 1e-6);
  assert.equal(glideProfile(5).duration, 0.8);
  assert.equal(glideProfile(0).duration, 0.8);
  for (const f of [89, 32, 49]) {
    const p = glideProfile(f);
    assert.equal(p.v, STEP_FPS);
    assert.equal(p.tIn, STEP_EASE_IN_S);
    assert.equal(p.tOut, STEP_DECEL_S);
  }
  assert.equal(glideProfile(21).v, STEP_FPS);
  assert.equal(glideProfile(21).tCruise, 0);
});

test('glideEase ends and shape', () => {
  for (const f of [0.5, 5, 21, 32, 49, 89]) {
    const p = glideProfile(f);
    assert.equal(glideEase(0, p), 0);
    assert.equal(glideEase(1, p), 1);
    assert.equal(glideEase(NaN, p), 0);
    assert.equal(glideEase(-1, p), 0);
    assert.equal(glideEase(2, p), 1);
    const dt = 1e-4;
    let prev = 0;
    let prevV = 0;
    for (let i = 1; i <= 10000; i++) {
      const e = glideEase(i * dt, p);
      assert.ok(e >= prev - 1e-12);
      const vel = ((e - prev) * p.frames) / (dt * p.duration);
      assert.ok(vel <= STEP_FPS + 1e-6, `vel ${vel} f=${f}`);
      if (i > 1) assert.ok(Math.abs(vel - prevV) < 0.5, `jump ${vel - prevV} f=${f} i=${i}`);
      prev = e;
      prevV = vel;
    }
    assert.ok(prevV < 0.01, `final velocity ${prevV}`);
  }
});

test('glideEase decel length', () => {
  for (const f of [25.6, 32, 49, 89]) {
    const p = glideProfile(f);
    const at = (sec) => glideEase((p.duration - sec) / p.duration, p) * p.frames;
    near(p.frames - at(STEP_DECEL_S), (STEP_FPS * STEP_DECEL_S) / (STEP_DECEL_POW + 1), 1e-9);
    near(p.frames - at(0.5), 2, 1e-9);
  }
});

test('glide asymmetry is deliberate', () => {
  const p = glideProfile(89);
  const tFor = (target) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (glideEase(m, p) * p.frames < target) lo = m; else hi = m;
    }
    return lo * p.duration;
  };
  const first = tFor(16);
  const last = p.duration - tFor(89 - 16);
  assert.ok(first < last);
});

test('handoffEndY', () => {
  assert.equal(handoffEndY(1000, 4500, 350, 100), 4500);
  const L = 1000;
  for (const D of [1000, 950, 900, 800]) {
    const y = handoffEndY(0, 4.5 * L, 350, 100);
    near(y, 3500);
    assert.ok(y <= 4.5 * L - D);
    assert.ok(y > stopScrollY(142, 192, 142, KP, 0, 4.5 * L - D) + 2);
  }
});

test('stopCoord with five stops', () => {
  const ys = [1000, 2567, 2937, 3500, 4500];
  near(stopCoord(3500, ys, 1000, 1000), 3);
  near(stopCoord(4000, ys, 1000, 1000), 3.5);
  near(stopCoord(4500, ys, 1000, 1000), 4);
  near(stopCoord(5000, ys, 1000, 1000), 4.5);
  near(stopCoord(9000, ys, 1000, 1000), 5);
});

test('decideStep with the tail', () => {
  const ys = [1000, 2567, 2937, 3500, 4500];
  const base = { target: 0, dir: 1, fresh: true, acted: null, busy: false };
  const d = (o) => decideStep(ys, 2, { ...base, ...o });
  assert.deepEqual(d({ y: 4500 }), { kind: 'pass' });
  assert.deepEqual(d({ y: 4500, dir: -1 }), { kind: 'glide', stop: 3 });
  assert.deepEqual(d({ y: 6000, dir: -1, target: 4400 }), { kind: 'catch', stop: 4 });
  assert.deepEqual(d({ y: 3500 }), { kind: 'glide', stop: 4 });
});

function run(g, events) {
  let fresh = 0;
  for (const [t, d] of events) if (feedWheel(g, t, d)) fresh++;
  return fresh;
}

test('feedWheel gesture splitting', () => {
  // mouse spin
  const a = [];
  for (let i = 0; i < 10; i++) a.push([i * 40, 100]);
  assert.equal(run(createWheelGesture(), a), 1);
  // notches 300 ms apart
  const b = [];
  for (let i = 0; i < 5; i++) b.push([i * 300, 100]);
  assert.equal(run(createWheelGesture(), b), 5);
  // trackpad swipe + decaying tail
  const swipe = [2, 5, 9, 14, 20, 26, 30];
  const c = [];
  let t = 0;
  for (const d of swipe) { c.push([t, d]); t += 16; }
  let tail = 30;
  for (let k = 0; k < 125; k++) { tail *= 0.94; c.push([t, tail]); t += 16; }
  assert.equal(run(createWheelGesture(), c), 1);
  // same tail with a fresh push inserted
  const d = c.slice(0, 7 + 40);
  let tt = d[d.length - 1][0];
  const g = createWheelGesture();
  let freshAt = [];
  let idx = 0;
  for (const [ti, de] of d) { if (feedWheel(g, ti, de)) freshAt.push(idx); idx++; }
  for (const push of [3, 6, 12, 18, 25]) {
    tt += 16;
    if (feedWheel(g, tt, push)) freshAt.push(push);
  }
  assert.equal(freshAt.length, 2);
  assert.equal(freshAt[1], 12);
  // sign flip
  const h = createWheelGesture();
  feedWheel(h, 0, 50);
  assert.equal(feedWheel(h, 16, -50), true);
});

test('decideStep', () => {
  const ys = [1000, 2567, 2937, 3500];
  const base = { target: 0, dir: 1, fresh: true, acted: null, busy: false };
  const d = (o) => decideStep(ys, 2, { ...base, ...o });
  assert.deepEqual(d({ y: 500, target: 900 }), { kind: 'pass' });
  assert.deepEqual(d({ y: 500, target: 1200, acted: 'pass' }), { kind: 'catch', stop: 0 });
  assert.deepEqual(d({ y: 500, target: 400, dir: -1 }), { kind: 'pass' });
  assert.deepEqual(d({ y: 1000.5 }), { kind: 'glide', stop: 1 });
  assert.deepEqual(d({ y: 1000.5, fresh: false, acted: 'consume' }), { kind: 'swallow' });
  assert.deepEqual(d({ y: 1000, dir: -1 }), { kind: 'pass' });
  assert.deepEqual(d({ y: 3500 }), { kind: 'pass' });
  assert.deepEqual(d({ y: 3501, fresh: false, acted: 'pass' }), { kind: 'pass' });
  assert.deepEqual(d({ y: 3500, dir: -1 }), { kind: 'glide', stop: 2 });
  assert.deepEqual(d({ y: 4000, target: 3400, dir: -1 }), { kind: 'catch', stop: 3 });
  assert.deepEqual(d({ y: 2700 }), { kind: 'glide', stop: 2 });
  assert.deepEqual(d({ y: 2700, dir: -1 }), { kind: 'glide', stop: 1 });
  assert.deepEqual(d({ y: 2700, busy: true }), { kind: 'swallow' });
  assert.deepEqual(d({ y: 100, busy: true }), { kind: 'swallow' });
  assert.deepEqual(d({ y: 2937, fresh: false }), { kind: 'swallow' });
});

test('stopAt / nearestStop', () => {
  const ys = [1000, 2567, 2937, 3500];
  assert.equal(stopAt(ys, 1001, 2), 0);
  assert.equal(nearestStop(ys, 1001), 0);
  assert.equal(stopAt(ys, 1003, 2), -1);
  assert.equal(nearestStop(ys, 1003), 0);
  assert.equal(stopAt(ys, 2700, 2), -1);
  assert.equal(nearestStop(ys, 2700), 1);
});

test('stopCoord', () => {
  const ys = [1000, 2567, 2937, 3500];
  for (let k = 0; k < ys.length; k++) near(stopCoord(ys[k], ys, 1000, 1000), k);
  near(stopCoord((ys[1] + ys[2]) / 2, ys, 1000, 1000), 1.5);
  near(stopCoord(500, ys, 1000, 1000), -0.5);
  near(stopCoord(-5000, ys, 1000, 1000), -1);
  near(stopCoord(4000, ys, 1000, 1000), 3.5);
  near(stopCoord(9000, ys, 1000, 1000), 4);
});

import { UNIQUE_LOCAL as UL } from '../lib/frame-sequence/sources.ts';

test('linearFrameMap', () => {
  const m = linearFrameMap(576, 5 / 7);
  assert.equal(m.pos(0), 0);
  assert.ok(Math.abs(m.pos(5 / 7) - 575) < 1e-9);
  assert.equal(m.pos(1), 575);
  assert.ok(Math.abs(m.pos(5 / 14) - 287.5) < 1e-9);
  assert.equal(m.pos(NaN), 0);
  for (let i = 0; i < 50; i++) {
    const p = ((5 / 7) * i) / 49;
    assert.ok(Math.abs(m.progress(m.pos(p)) - p) < 1e-9);
  }
  assert.ok(Math.abs(m.progress(217) - (217 / 575) * (5 / 7)) < 1e-12);
});

test('knotFrameMap equals framePos / progressAt', () => {
  const m = knotFrameMap(192, 142, 5 / 7);
  for (let i = 0; i <= 20; i++) {
    const p = i / 20;
    assert.equal(m.pos(p), framePos(p, 192, 142, 5 / 7));
    const q = (i / 20) * 191;
    assert.equal(m.progress(q), progressAt(q, 192, 142, 5 / 7));
  }
});

test('chainStopIndices forex + stock', () => {
  assert.deepEqual(chainStopIndices([FOREX_STOPS_RAW, STOCK_STOPS_RAW], UL), [0, 50, 88, 154, 217, 342]);
});

test('forex/stock glide durations', () => {
  const want = { 50: 1.908, 38: 1.658, 66: 2.242, 63: 2.179 };
  for (const [d, dur] of Object.entries(want)) {
    const p = glideProfile(Number(d));
    assert.ok(Math.abs(p.duration - dur) < 1e-3, `${d}: ${p.duration}`);
    assert.equal(p.v, 48);
    assert.equal(p.tIn, 0.4);
    assert.equal(p.tOut, 1.0);
    assert.equal(glideEase(1, p), 1);
    assert.equal(glideEase(0, p), 0);
    let prev = 0;
    for (let i = 1; i <= 200; i++) {
      const e = glideEase(i / 200, p);
      assert.ok(e >= prev);
      prev = e;
    }
  }
});

test('decideStep foreign guard', () => {
  const ys = [1000, 2000];
  const base = { fresh: true, acted: null, busy: false };
  assert.equal(decideStep(ys, 2, { ...base, y: 900, dir: 1, target: 1001, foreign: false }).kind, 'catch');
  assert.equal(decideStep(ys, 2, { ...base, y: 900, dir: 1, target: 1001, foreign: true }).kind, 'pass');
  assert.equal(decideStep(ys, 2, { ...base, y: 2100, dir: -1, target: 1999, foreign: false }).kind, 'catch');
  assert.equal(decideStep(ys, 2, { ...base, y: 2100, dir: -1, target: 1999, foreign: true }).kind, 'pass');
});

test('shared boundary Y0 between Crypto and Forex controllers', () => {
  const C = [0, 500, 800, 1200];
  const F = [1200, 2100, 2800, 4000, 5200];
  const at = (ys, dir, extra = {}) => decideStep(ys, 2, { y: 1200, target: 1200 + dir * 100, dir, fresh: true, acted: null, busy: false, ...extra });
  let a = at(C, 1), b = at(F, 1);
  assert.equal(a.kind, 'pass');
  assert.equal(b.kind, 'glide');
  assert.equal(b.stop, 1);
  a = at(C, -1); b = at(F, -1);
  assert.equal(a.kind, 'glide');
  assert.equal(a.stop, 2);
  assert.equal(b.kind, 'pass');
  assert.equal(at(C, 1, { fresh: false, acted: 'consume' }).kind, 'swallow');
  assert.equal(at(F, 1, { fresh: false, acted: 'pass' }).kind, 'pass');
});
