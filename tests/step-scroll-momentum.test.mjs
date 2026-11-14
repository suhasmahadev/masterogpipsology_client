import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEP_TUNING,
  STREAK_CAP,
  AUTO_ADVANCE_MS,
  HOLD_MIN_MS,
  STEP_FPS,
  STEP_EASE_IN_S,
  STEP_DECEL_S,
  GESTURE_GAP_MS,
  glideProfile,
  glideEase,
  speedMult,
  holdMs,
  queuedHoldUntil,
  createStreak,
  nextStreak,
  streakLevelAt,
  pushPending,
  classifyWheel,
  touchAxis,
  classifyTouchEnd,
  pathFrames,
  pathY,
  reverseStop,
  runTarget,
  runUsed,
  stoppingFrames,
  tapTarget,
  reversePlan,
  createGlide,
  stepGlide,
} from '../lib/step-scroll.ts';
import { CRYPTO_HOOK_IDS, CRYPTO_HOOK_WINDOWS, MARKET_HOOK_IDS, MARKET_HOOK_WINDOWS } from '../lib/hook-box.ts';
import { slabZone } from '../lib/crypto-slabs.ts';
import { lookahead, decodeStride } from '../lib/frame-sequence/math.ts';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b} (eps ${eps})`);
const aUp = (m) => (1.5 * 48 * m) / (0.4 / m);

/** Runs stepGlide until land/edge. onTick(g, t) runs before each step. */
function simulate(g, dt, maxS = 10, onTick) {
  const ts = [];
  const xs = [];
  const vs = [];
  let t = 0;
  let res = 'move';
  while (t < maxS) {
    if (onTick) onTick(g, t);
    res = stepGlide(g, dt);
    t += dt;
    ts.push(t);
    xs.push(g.x);
    vs.push(g.v);
    if (res === 'land' || res === 'edge') break;
  }
  return { duration: t, ts, xs, vs, res };
}

test('1 tuning shape', () => {
  const s = STEP_TUNING.speed.steps;
  assert.equal(s[0], 1);
  for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1]);
  assert.equal(s[s.length - 1], 2.2);
  assert.equal(STREAK_CAP, 3);
  const { ms, pendingMs } = STEP_TUNING.hold;
  assert.equal(ms.length, s.length);
  assert.equal(pendingMs.length, s.length);
  for (let i = 0; i < s.length; i++) {
    if (i > 0) {
      assert.ok(ms[i] <= ms[i - 1]);
      assert.ok(pendingMs[i] <= pendingMs[i - 1]);
    }
    assert.ok(pendingMs[i] <= ms[i]);
  }
  assert.ok(STEP_TUNING.touch.tapMaxPx <= STEP_TUNING.devices.touch.minPx);
  assert.equal(STEP_TUNING.queue.max, 3);
  assert.equal(AUTO_ADVANCE_MS, 450);
  assert.ok(!('autoAdvance' in STEP_TUNING));
  assert.equal(HOLD_MIN_MS, 700);
  assert.equal(STEP_FPS, 48);
  assert.equal(STEP_EASE_IN_S, 0.4);
  assert.equal(STEP_DECEL_S, 1);
  assert.equal(GESTURE_GAP_MS, 180);
});

test('2 speedMult / holdMs', () => {
  assert.deepEqual([0, 1, 2, 3].map((l) => speedMult(l, 'touch')), [1, 1.4, 1.8, 2.2]);
  assert.equal(speedMult(9, 'wheel'), 2.2);
  assert.equal(speedMult(-1, 'key'), 1);
  assert.deepEqual([0, 1, 2, 3].map((l) => holdMs(l, false, 'touch')), [700, 500, 350, 250]);
  assert.deepEqual([0, 1, 2, 3].map((l) => holdMs(l, true, 'touch')), [250, 180, 120, 80]);
});

test('3 nextStreak / streakLevelAt', () => {
  let s = createStreak();
  const levels = [];
  for (let i = 0; i < 5; i++) {
    s = nextStreak(s, i * 200, 1);
    levels.push(s.level);
  }
  assert.deepEqual(levels, [0, 1, 2, 3, 3]);
  let a = nextStreak(createStreak(), 0, 1);
  a = nextStreak(a, 600, 1);
  assert.equal(a.level, 1);
  let b = nextStreak(createStreak(), 0, 1);
  b = nextStreak(b, 601, 1);
  assert.equal(b.level, 0);
  let c = nextStreak(createStreak(), 0, 1);
  c = nextStreak(c, 100, 1);
  c = nextStreak(c, 200, -1);
  assert.equal(c.level, 0);
  const st = { level: 3, dir: 1, lastT: 0 };
  assert.deepEqual([599, 600, 1200, 1800, 99999].map((t) => streakLevelAt(st, t)), [3, 2, 1, 0, 0]);
});

test('4 pushPending', () => {
  let p = { dir: 1, count: 0 };
  const counts = [];
  for (let i = 0; i < 4; i++) {
    p = pushPending(p, 1, false);
    counts.push(p.count);
  }
  assert.deepEqual(counts, [1, 2, 3, 3]);
  assert.deepEqual(pushPending({ dir: 1, count: 3 }, -1, false), { dir: -1, count: 1 });
  assert.equal(pushPending({ dir: 1, count: 2 }, 1, true).count, 2);
  assert.equal(pushPending({ dir: 1, count: 0 }, 1, true).count, 1);
});

test('5 queuedHoldUntil', () => {
  assert.equal(queuedHoldUntil(700, 0, 100, 0, 'touch'), 250);
  assert.equal(queuedHoldUntil(700, 0, 400, 0, 'touch'), 400);
  assert.equal(queuedHoldUntil(200, 0, 100, 0, 'touch'), 200);
});

test('6 classifyWheel', () => {
  for (const [m, d] of [[1, 3], [2, 1], [0, 100], [0, -120], [0, 150]]) assert.equal(classifyWheel(m, d), 'wheel');
  for (const d of [4.5, 12, 53.3, 49]) assert.equal(classifyWheel(0, d), 'trackpad');
});

test('7 touchAxis / classifyTouchEnd', () => {
  assert.equal(touchAxis(0, 0), null);
  assert.equal(touchAxis(2, 0), null);
  assert.equal(touchAxis(5, 1), 'h');
  assert.equal(touchAxis(1, 1), 'v');
  assert.equal(touchAxis(3, -2), 'v');
  assert.equal(touchAxis(0, 4), 'v');
  assert.equal(classifyTouchEnd(6, 6, 120, true), 'tap');
  assert.equal(classifyTouchEnd(6, 6, 120, false), 'none');
  assert.equal(classifyTouchEnd(20, 8, 90, true), 'swipe');
  assert.equal(classifyTouchEnd(20, -9, 90, false), 'swipe');
  assert.equal(classifyTouchEnd(7, 3, 400, true), 'none');
});

test('8 pathFrames / pathY', () => {
  const ys = [1000, 2567, 2937, 3500, 4500];
  const fs = [0, 89, 110, 142, 170];
  for (let k = 0; k < ys.length; k++) {
    near(pathFrames(ys[k], ys, fs), fs[k]);
    near(pathY(fs[k], ys, fs), ys[k]);
  }
  near(pathFrames((1000 + 2567) / 2, ys, fs), 44.5);
  for (let i = 0; i < 50; i++) {
    const y = 1000 + (i / 49) * 3500;
    near(pathY(pathFrames(y, ys, fs), ys, fs), y, 1e-9);
  }
  assert.equal(pathFrames(0, ys, fs), 0);
  assert.equal(pathFrames(9999, ys, fs), 170);
  assert.equal(pathY(-5, ys, fs), 1000);
  assert.equal(pathY(500, ys, fs), 4500);
});

test('9 reverseStop', () => {
  const fs = [0, 50, 88];
  assert.equal(reverseStop(fs, 30, -1), 0);
  assert.equal(reverseStop(fs, 30, 1), 1);
  assert.equal(reverseStop(fs, 50, -1), 0);
  assert.equal(reverseStop(fs, 50, 1), 2);
  assert.equal(reverseStop(fs, 100, 1), -1);
  assert.equal(reverseStop(fs, -1, -1), -1);
});

test('10 stepGlide matches glideProfile at 1x', () => {
  const prof = glideProfile(89);
  const dt = 1 / 60;
  const g = createGlide(0, 89, 1);
  const sim = simulate(g, dt);
  // landing triggers when the remaining tail is < 1 tick of travel, so the feedback glide ends ~0.14 s before the asymptotic profile
  assert.ok(Math.abs(sim.duration - prof.duration) <= 0.15, `${sim.duration} vs ${prof.duration}`);
  for (let i = 0; i < sim.xs.length; i++) {
    const want = glideEase(sim.ts[i] / prof.duration, prof) * 89;
    assert.ok(Math.abs(sim.xs[i] - want) <= 0.6, `tick ${i}: ${sim.xs[i]} vs ${want}`);
  }
  assert.equal(g.x, 89);
  assert.equal(g.v, 0);
  assert.equal(sim.res, 'land');
});

test('11 frame-rate independence', () => {
  const durs = [];
  for (const dt of [1 / 30, 1 / 60, 1 / 120, 1 / 144]) {
    const g = createGlide(0, 89, 1);
    const sim = simulate(g, dt);
    assert.equal(sim.res, 'land');
    assert.equal(g.x, 89);
    assert.ok(Math.max(...sim.vs.map(Math.abs)) <= 48 + 1e-9);
    assert.ok(Math.abs(sim.vs[sim.vs.length - 2]) < 1.5, `pre-landing v ${sim.vs[sim.vs.length - 2]}`);
    durs.push(sim.duration);
  }
  assert.ok(Math.max(...durs) - Math.min(...durs) <= 0.15, durs.join(','));
});

test('12 no velocity jumps', () => {
  const dt = 1 / 60;
  const g = createGlide(0, 89, 1);
  const sim = simulate(g, dt);
  let prev = 0;
  for (let i = 0; i < sim.vs.length - 1; i++) {
    assert.ok(Math.abs(sim.vs[i] - prev) <= aUp(1) * dt + 1e-6, `tick ${i}`);
    prev = sim.vs[i];
  }
});

test('13 speed-up', () => {
  const dur = [1, 1.4, 1.8, 2.2].map((m) => {
    const g = createGlide(0, 89, m);
    const sim = simulate(g, 1 / 60);
    assert.ok(Math.max(...sim.vs.map(Math.abs)) <= 48 * m + 1e-9);
    return sim.duration;
  });
  for (let i = 1; i < dur.length; i++) assert.ok(dur[i] < dur[i - 1], dur.join(','));
  assert.ok(dur[3] < 0.6 * dur[0]);
  const g = createGlide(0, 89, 2.2);
  const sim = simulate(g, 1 / 60);
  assert.ok(Math.max(...sim.vs) <= 48 * 2.2 + 1e-9);
});

test('14 mid-glide mult change', () => {
  const dt = 1 / 60;
  const g = createGlide(0, 89, 1);
  let prev = 0;
  const sim = simulate(g, dt, 10, (gg, t) => {
    if (t >= 0.6) gg.multTarget = 2.2;
  });
  prev = 0;
  for (let i = 0; i < sim.vs.length - 1; i++) {
    assert.ok(Math.abs(sim.vs[i] - prev) <= aUp(2.2) * dt + 1e-6, `tick ${i}`);
    prev = sim.vs[i];
  }
  assert.ok(Math.max(...sim.vs) > 48 * 1.3);
  assert.equal(sim.res, 'land');
  assert.equal(g.x, 89);
});

test('15 runTarget', () => {
  assert.deepEqual(runTarget(10, 2, 1, 3, 8), { stop: 5, rest: 0 });
  assert.deepEqual(runTarget(10, 6, 1, 3, 8), { stop: 8, rest: 0 });
  assert.deepEqual(runTarget(10, 8, 1, 1, 8), { stop: 9, rest: 0 });
  assert.deepEqual(runTarget(10, 1, -1, 3, -1), { stop: 0, rest: 2 });
  assert.deepEqual(runTarget(5, 2, 1, 3, -1), { stop: 4, rest: 1 });
  assert.deepEqual(runTarget(5, 2, 1, 0, -1), { stop: 2, rest: 0 });
});

test('16 runUsed', () => {
  const fs = [0, 10, 20, 30, 40];
  assert.equal(runUsed(fs, 5, 1, 1, 0), 0);
  assert.equal(runUsed(fs, 5, 1, 3, 0), 2);
  assert.equal(runUsed(fs, 5, 1, 4, 2), 5);
  assert.equal(runUsed(fs, 35, -1, 1, 0), 2);
  assert.equal(runUsed(fs, 45, 1, 4, 0), 0);
});

test('17 pass-through extension is continuous', () => {
  const dt = 1 / 60;
  const base = simulate(createGlide(0, 89, 1), dt).duration;
  const rest = simulate(createGlide(89, 110, 1), dt).duration;
  const g = createGlide(0, 89, 1);
  let extended = false;
  const sim = simulate(g, dt, 10, (gg) => {
    if (!extended && gg.x >= 80) {
      extended = true;
      gg.target = 110;
    }
  });
  assert.ok(extended);
  let prev = 0;
  for (let i = 0; i < sim.vs.length - 1; i++) {
    assert.ok(Math.abs(sim.vs[i] - prev) <= aUp(1) * dt + 1e-6, `tick ${i}`);
    assert.ok(sim.vs[i] > 0, `tick ${i} v=${sim.vs[i]}`);
    if (sim.xs[i] >= 85 && sim.xs[i] <= 95) assert.ok(sim.vs[i] > 20, `x=${sim.xs[i]} v=${sim.vs[i]}`);
    prev = sim.vs[i];
  }
  assert.equal(sim.res, 'land');
  assert.equal(g.x, 110);
  assert.ok(sim.duration < base + rest, `${sim.duration} < ${base + rest}`);
});

test('18 edge hand-over', () => {
  const dt = 1 / 60;
  const g = createGlide(0, 89, 1);
  g.extra = 50;
  const sim = simulate(g, dt);
  assert.equal(sim.res, 'edge');
  assert.ok(Math.abs(g.v) >= 0.9 * 48, `v ${g.v}`);
  assert.ok(g.x >= 89);
  assert.ok(g.x - 89 <= 48 / 60 + 1e-9);
  const vBefore = g.v;
  const over = g.x - 89;
  g.x = over;
  g.target = 50;
  g.extra = 0;
  const sim2 = simulate(g, dt);
  assert.ok(Math.abs(sim2.vs[0] - vBefore) <= aUp(1) * dt + 1e-6, `handover jump ${sim2.vs[0]} vs ${vBefore}`);
  assert.equal(sim2.res, 'land');
  assert.equal(g.x, 50);
  // exactly one edge: the first sim stopped at its first edge
  assert.equal(sim.res, 'edge');
});

test('19 tapTarget / stoppingFrames', () => {
  const fs = Array.from({ length: 21 }, (_, i) => i * 10);
  near(stoppingFrames(48, 1), 16);
  assert.equal(stoppingFrames(0, 1), 0);
  assert.equal(tapTarget(fs, 55, 48, 1), 8);
  assert.equal(tapTarget(fs, 55, 10, 1), 6);
  assert.equal(tapTarget(fs, 55, -48, 1), 3);
  assert.equal(tapTarget(fs, 195, 48, 1), -1);
  assert.equal(tapTarget(fs, 55, 0, 1), -1);

  const dt = 1 / 60;
  const g = createGlide(0, 200, 1);
  let set = false;
  let prev = 0;
  let maxJump = 0;
  const sim = simulate(g, dt, 20, (gg) => {
    if (!set && gg.x >= 55) {
      set = true;
      gg.target = fs[tapTarget(fs, gg.x, gg.v, gg.mult)];
    }
  });
  for (const v of sim.vs.slice(0, -1)) {
    maxJump = Math.max(maxJump, Math.abs(v - prev));
    prev = v;
  }
  assert.ok(set);
  assert.ok(maxJump <= aUp(1) * dt + 1e-6, `jump ${maxJump}`);
  assert.equal(sim.res, 'land');
  assert.equal(g.x, 80);
});

test('20 reversePlan + reversal simulation', () => {
  const fs = [0, 50, 89, 140];
  const p = reversePlan(fs, 60, 48, -1);
  assert.equal(p.stop, 1);
  assert.equal(p.limit, 140);
  const q = reversePlan(fs, 138, 5, -1);
  assert.equal(q.limit, 140);
  assert.equal(q.stop, 2);
  const r = reversePlan(fs, 60, 0, -1);
  assert.equal(r.stop, 1);
  assert.ok(Number.isNaN(r.limit));

  const dt = 1 / 60;
  const g = createGlide(0, 140, 1);
  let tRev = -1;
  let xRev = 0;
  let vRev = 0;
  let tStop = -1;
  let maxX = 0;
  let sawNeg = false;
  const sim = simulate(g, dt, 20, (gg, t) => {
    if (tRev < 0 && gg.x >= 60) {
      tRev = t;
      xRev = gg.x;
      vRev = gg.v;
      const pl = reversePlan(fs, gg.x, gg.v, -1);
      gg.target = fs[pl.stop];
      gg.limit = pl.limit;
    }
    maxX = Math.max(maxX, gg.x);
    if (tRev >= 0 && tStop < 0 && gg.v === 0 && t > tRev) tStop = t;
    if (tRev >= 0 && gg.v < 0) sawNeg = true;
    if (tRev >= 0 && !sawNeg) assert.ok(gg.v >= 0);
    if (sawNeg) assert.ok(gg.v <= 0);
  });
  // brake end = trigger x + v*0.3/2 (the trigger tick may overshoot 60 by up to one tick of travel)
  assert.ok(maxX <= xRev + (vRev * 0.3) / 2 + 0.5, `maxX ${maxX}`);
  assert.ok(tStop >= 0 && tStop - tRev <= 0.3 + 2 * dt, `brake ${tStop - tRev}`);
  assert.equal(sim.res, 'land');
  assert.equal(g.x, 50);

  // near the edge
  const g2 = createGlide(130, 140, 1);
  let rev = false;
  let over = false;
  const sim2 = simulate(g2, dt, 20, (gg) => {
    if (!rev && gg.x >= 138) {
      rev = true;
      const pl = reversePlan(fs, gg.x, gg.v, -1);
      gg.target = fs[pl.stop];
      gg.limit = pl.limit;
    }
    if (gg.x > 140) over = true;
  });
  assert.ok(rev);
  assert.ok(!over);
  assert.ok(g2.x <= 140);
  assert.equal(sim2.res, 'land');
  assert.equal(g2.x, 89);
});

test('21 hook windows', () => {
  for (const [ids, wins] of [[CRYPTO_HOOK_IDS, CRYPTO_HOOK_WINDOWS], [MARKET_HOOK_IDS, MARKET_HOOK_WINDOWS]]) {
    ids.forEach((id, i) => {
      const w = wins[id];
      assert.equal(w.inTo, i);
      assert.equal(w.outFrom, i);
      assert.ok(w.inFrom < w.inTo);
      if (i > 0) assert.ok(wins[ids[i - 1]].outTo <= w.inFrom, id);
    });
    for (let k = 0; k <= 11000; k++) {
      const s = -1 + k * 0.001;
      let n = 0;
      for (const id of ids) if (s > wins[id].inFrom && s < wins[id].outTo) n++;
      assert.ok(n <= 1, `s=${s} has ${n} hooks`);
    }
  }
});

test('22 frame jumps over a window still settle', () => {
  for (const wins of [CRYPTO_HOOK_WINDOWS, MARKET_HOOK_WINDOWS]) {
    for (const w of Object.values(wins)) {
      assert.equal(slabZone(w.inFrom - 0.01, w), 0);
      assert.equal(slabZone(w.outTo + 0.01, w), 4);
      assert.equal(slabZone(w.inTo, w), 3);
    }
  }
});

test('23 decode coverage at top speed', () => {
  const speed = 48 * 2.2;
  for (const w of [16, 24, 32, 48, 64]) {
    const { ahead } = lookahead(speed, w);
    const stride = decodeStride(speed, ahead);
    assert.ok(ahead * stride >= speed * 0.5, `window ${w}: ${ahead}*${stride} < ${speed * 0.5}`);
  }
});

test('24 dt guards', () => {
  for (const dt of [NaN, 0]) {
    const g = createGlide(0, 89, 1);
    stepGlide(g, dt);
    assert.equal(g.x, 0);
    assert.equal(g.v, 0);
  }
  const g = createGlide(0, 89, 1);
  stepGlide(g, 5);
  assert.ok(g.x <= 48 * 0.05);
});

test('25 short glides', () => {
  for (const frames of [19, 21]) {
    const sim = simulate(createGlide(0, frames, 1), 1 / 60);
    assert.equal(sim.res, 'land');
    assert.ok(sim.duration > 0.6 && sim.duration < 1.4, `${frames}: ${sim.duration}`);
  }
});
