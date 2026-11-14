import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spreadWindows,
  flowState,
  stepStyle,
  trackOffset,
  sparkStyle,
  FLOW_PREV_DIM,
  FLOW_TARGET_FAINT,
  FLOW_NODE_MIN_SCALE,
  FLOW_PLATE_SHIFT_PX,
  FLOW_LIFT_PX,
} from '../lib/caption-flow.ts';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

const CRYPTO = { from: 0.04, to: 0.94, steps: spreadWindows(6, 0.04, 0.94) };
const T = 1 / 3;
const FOREX = {
  from: 0.01,
  to: 0.91,
  steps: [...spreadWindows(5, 0.01, T), ...spreadWindows(5, T, 2 * T), ...spreadWindows(5, 2 * T, 0.91)],
};
const NODE_Y = 20;
const rowsFor = (flow) => Float64Array.from({ length: flow.steps.length }, (_, j) => j * 112 + (j % 3) * 9);
const FLOWS = [['crypto', CRYPTO], ['forex', FOREX]];
const PREV = FLOW_PREV_DIM;

const mid = (w) => (w.start + w.end) / 2;
const transP = (flow, i, u) => flow.steps[i].end + u * (flow.steps[i + 1].start - flow.steps[i].end);

test('spreadWindows: even holds and gaps, strictly increasing', () => {
  const w = spreadWindows(6, 0.04, 0.94);
  assert.equal(w.length, 6);
  near(w[0].start, 0.07, 1e-12);
  near(w[0].end, 0.16, 1e-12);
  near(w[5].start, 0.82, 1e-12);
  near(w[5].end, 0.91, 1e-12);
  for (let i = 0; i < 6; i++) {
    near(w[i].end - w[i].start, 0.09, 1e-12);
    if (i > 0) {
      near(w[i].start - w[i - 1].end, 0.06, 1e-12);
      assert.ok(w[i].start > w[i - 1].start);
    }
  }
  const t = spreadWindows(4, 0, 1, 0);
  [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]].forEach(([s, e], i) => {
    near(t[i].start, s, 1e-12);
    near(t[i].end, e, 1e-12);
  });
  assert.deepEqual(spreadWindows(0, 0, 1), []);
});

test('flowState: before the flow and at the extremes', () => {
  const zero = { index: 0, draw: 0, advance: 0, enter: 0, exit: 0 };
  for (const p of [0, 0.02, NaN, -Infinity]) assert.deepEqual(flowState(p, CRYPTO), zero);
  for (const p of [Infinity, 1]) {
    const s = flowState(p, CRYPTO);
    assert.equal(s.index, 5);
    assert.equal(s.exit, 1);
  }
});

test('flowState: hold midpoints are still and trackOffset is exactly rowTop[i]', () => {
  for (const [, flow] of FLOWS) {
    const rows = rowsFor(flow);
    flow.steps.forEach((w, i) => {
      const s = flowState(mid(w), flow);
      assert.deepEqual(s, { index: i, draw: 0, advance: 0, enter: 1, exit: 0 });
      assert.equal(trackOffset(rows, s), rows[i]);
    });
  }
});

test('flowState: transition phases', () => {
  const ease = (t) => t * t * (3 - 2 * t);
  let s = flowState(transP(CRYPTO, 2, 0.3), CRYPTO);
  near(s.draw, 0.5, 1e-6);
  assert.equal(s.advance, 0);
  s = flowState(transP(CRYPTO, 2, 0.5), CRYPTO);
  near(s.draw, ease(5 / 6), 1e-6);
  near(s.advance, ease(1 / 6), 1e-6);
  s = flowState(transP(CRYPTO, 2, 0.7), CRYPTO);
  near(s.draw, 1, 1e-9);
  near(s.advance, 0.5, 1e-6);
  s = flowState(transP(CRYPTO, 2, 0.999999), CRYPTO);
  assert.ok(s.advance > 0.99999);
});

function* samples() {
  for (let k = 0; k <= 100000; k++) yield k * 1e-5;
}

test('continuity: nothing pops across fine scroll steps', () => {
  for (const [name, flow] of FLOWS) {
    const rows = rowsFor(flow);
    const n = rows.length;
    const prev = { st: null, ss: null, off: 0, sp: null };
    const st = { index: 0, draw: 0, advance: 0, enter: 0, exit: 0 };
    const ss = { presence: 0, node: 0, nodeScale: 0, plate: 0, plateX: 0, line: 0, lineOpacity: 0 };
    const sp = { y: 0, opacity: 0 };
    let first = true;
    const prevSS = Array.from({ length: n }, () => ({ ...ss }));
    let prevOff = 0;
    let prevSp = { y: 0, opacity: 0 };
    for (const p of samples()) {
      flowState(p, flow, false, st);
      const off = trackOffset(rows, st);
      sparkStyle(rows, NODE_Y, st, sp);
      for (let j = 0; j < n; j++) {
        stepStyle(j, st, PREV, ss);
        // window size
        if (ss.presence > 0) {
          assert.ok(j >= st.index - 1 && j <= st.index + 2, `${name} p=${p} row ${j} idx ${st.index}`);
        }
        if (!first) {
          const q = prevSS[j];
          for (const f of ['presence', 'node', 'nodeScale', 'plate', 'line', 'lineOpacity']) {
            assert.ok(Math.abs(ss[f] - q[f]) < 0.01, `${name} ${f} row ${j} p=${p}`);
          }
          assert.ok(Math.abs(ss.plateX - q.plateX) < 0.05, `${name} plateX row ${j} p=${p}`);
        }
        Object.assign(prevSS[j], ss);
      }
      if (!first) {
        assert.ok(Math.abs(off - prevOff) < 0.5, `${name} track p=${p}`);
        assert.ok(Math.abs(sp.opacity - prevSp.opacity) < 0.01, `${name} spark o p=${p}`);
        assert.ok(Math.abs(sp.y - prevSp.y) < 0.5, `${name} spark y p=${p}`);
      }
      prevOff = off;
      prevSp = { y: sp.y, opacity: sp.opacity };
      first = false;
    }
    void prev;
  }
});

test('index-switch seam is continuous', () => {
  for (const [, flow] of FLOWS) {
    const rows = rowsFor(flow);
    const n = rows.length;
    for (let i = 0; i < n - 1; i++) {
      const p = flow.steps[i + 1].start;
      const a = flowState(p - 1e-9, flow);
      const b = flowState(p, flow);
      for (let j = i - 1; j <= i + 3; j++) {
        const sa = stepStyle(j, a, PREV);
        const sb = stepStyle(j, b, PREV);
        for (const f of Object.keys(sa)) near(sa[f], sb[f], 1e-6);
      }
      near(trackOffset(rows, a), trackOffset(rows, b), 1e-6);
    }
  }
});

test('connector is drawing across the Forex folder cuts', () => {
  let s = flowState(T, FOREX);
  assert.ok(s.draw > 0 && s.draw <= 1);
  assert.equal(s.index, 4);
  s = flowState(2 * T, FOREX);
  assert.ok(s.draw > 0 && s.draw <= 1);
  assert.equal(s.index, 9);
});

test('spark: only visible mid-draw', () => {
  for (const [, flow] of FLOWS) {
    const rows = rowsFor(flow);
    for (const w of flow.steps) assert.equal(sparkStyle(rows, NODE_Y, flowState(mid(w), flow)).opacity, 0);
  }
  const rows = rowsFor(CRYPTO);
  assert.equal(sparkStyle(rows, NODE_Y, flowState(0.05, CRYPTO)).opacity, 0);
  assert.equal(sparkStyle(rows, NODE_Y, flowState(0.93, CRYPTO)).opacity, 0);
  assert.equal(sparkStyle(rows, NODE_Y, flowState(1, CRYPTO)).opacity, 0);
  const s = flowState(transP(CRYPTO, 2, 0.3), CRYPTO);
  const sp = sparkStyle(rows, NODE_Y, s);
  near(sp.opacity, 1, 1e-3);
  near(sp.y, rows[2] + NODE_Y + 0.5 * (rows[3] - rows[2]), 1e-3);
  assert.equal(sparkStyle(rows, NODE_Y, flowState(transP(CRYPTO, 2, 0.3), CRYPTO, true)).opacity, 0);
});

test('reduced motion: discrete states', () => {
  const allowed = [0, 1, FLOW_PREV_DIM, FLOW_TARGET_FAINT, FLOW_NODE_MIN_SCALE, -FLOW_PLATE_SHIFT_PX];
  for (const [, flow] of FLOWS) {
    const n = flow.steps.length;
    let prevIndex = 0;
    for (const p of samples()) {
      if (Math.round(p * 1e5) % 7 !== 0) continue;
      const s = flowState(p, flow, true);
      assert.equal(s.draw, 0);
      assert.equal(s.advance, 0);
      assert.ok(s.enter === 0 || s.enter === 1);
      assert.ok(s.exit === 0 || s.exit === 1);
      assert.ok(s.index >= prevIndex);
      prevIndex = s.index;
      for (let j = 0; j < n; j++) {
        const ss = stepStyle(j, s, PREV);
        for (const v of Object.values(ss)) {
          assert.ok(allowed.some((a) => Math.abs(a - v) < 1e-9), `value ${v} at p=${p} row ${j}`);
        }
      }
    }
    for (let i = 0; i < n - 1; i++) {
      assert.equal(flowState(transP(flow, i, 0.69), flow, true).index, i);
      assert.equal(flowState(transP(flow, i, 0.71), flow, true).index, i + 1);
    }
  }
});

test('stepStyle: prevDim 0 hides the previous row in holds', () => {
  for (const [, flow] of FLOWS) {
    flow.steps.forEach((w, i) => {
      if (i === 0) return;
      const s = flowState(mid(w), flow);
      assert.equal(stepStyle(i - 1, s, 0).presence, 0);
    });
  }
});

test('exit: track lifts and every row is gone at p = 1', () => {
  for (const [, flow] of FLOWS) {
    const rows = rowsFor(flow);
    const n = rows.length;
    const s = flowState(1, flow);
    near(trackOffset(rows, s), rows[n - 1] + FLOW_LIFT_PX, 1e-9);
    for (let j = 0; j < n; j++) assert.equal(stepStyle(j, s, PREV).presence, 0);
  }
});
