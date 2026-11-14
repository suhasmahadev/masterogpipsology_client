// Pure timing math for the workflow captions. No imports (node --test loads this file directly).

export const FLOW_TRANSITION_SHARE = 0.4; // share of each step spent moving; 0.6 holds still for reading
export const FLOW_DRAW_END = 0.6; // connector draws over u in [0, 0.6] of a transition
export const FLOW_ADVANCE_START = 0.4; // glide + next-box reveal over u in [0.4, 1]
export const FLOW_PREV_DIM = 0.42; // opacity of the previous step (the trail)
export const FLOW_TARGET_FAINT = 0.35; // opacity of a node that has not been reached yet
export const FLOW_NODE_MIN_SCALE = 0.6; // unreached node scale
export const FLOW_PLATE_SHIFT_PX = 12; // box slides in from the rail by this much
export const FLOW_LIFT_PX = 16; // whole flow rises this much on intro / exit

/** Hold window: fully shown while start <= p <= end. */
export interface FlowWindow { start: number; end: number }
export interface FlowSpec { from: number; to: number; steps: readonly FlowWindow[] }
export interface FlowState { index: number; draw: number; advance: number; enter: number; exit: number }
export interface StepStyle {
  presence: number;
  node: number;
  nodeScale: number;
  plate: number;
  plateX: number;
  line: number;
  lineOpacity: number;
}
export interface SparkStyle { y: number; opacity: number }

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function ease(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function ramp(x: number, a: number, b: number): number {
  return b > a ? clamp01((x - a) / (b - a)) : x >= b ? 1 : 0;
}

/** Spread `count` hold windows evenly over [from, to], leaving `share` of each step as a transition gap. */
export function spreadWindows(count: number, from: number, to: number, share: number = FLOW_TRANSITION_SHARE): FlowWindow[] {
  if (count <= 0) return [];
  const step = (to - from) / count;
  const gap = step * share;
  const out: FlowWindow[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ start: from + i * step + gap / 2, end: from + (i + 1) * step - gap / 2 });
  }
  return out;
}

export function flowState(p: number, flow: FlowSpec, reduced: boolean = false, out?: FlowState): FlowState {
  const s: FlowState = out ?? { index: 0, draw: 0, advance: 0, enter: 0, exit: 0 };
  s.index = 0;
  s.draw = 0;
  s.advance = 0;
  s.enter = 0;
  s.exit = 0;
  const steps = flow.steps;
  const n = steps.length;
  if (n === 0) return s;
  const x = Number.isNaN(p) || p === -Infinity ? 0 : p === Infinity ? 1 : clamp01(p);
  if (x < steps[0].start) {
    s.enter = ease(ramp(x, flow.from, steps[0].start));
  } else {
    s.enter = 1;
    let i = 0;
    while (i < n - 1 && x >= steps[i + 1].start) i++;
    s.index = i;
    if (x > steps[i].end) {
      if (i < n - 1) {
        const u = ramp(x, steps[i].end, steps[i + 1].start);
        s.draw = ease(clamp01(u / FLOW_DRAW_END));
        s.advance = ease(clamp01((u - FLOW_ADVANCE_START) / (1 - FLOW_ADVANCE_START)));
      } else {
        s.exit = ease(ramp(x, steps[i].end, flow.to));
      }
    }
  }
  if (reduced) {
    if (s.advance >= 0.5 && s.index < n - 1) s.index += 1;
    s.draw = 0;
    s.advance = 0;
    s.enter = s.enter >= 0.5 ? 1 : 0;
    s.exit = s.exit >= 0.5 ? 1 : 0;
  }
  return s;
}

export function stepStyle(j: number, s: FlowState, prevDim: number, out?: StepStyle): StepStyle {
  const o: StepStyle = out ?? { presence: 0, node: 0, nodeScale: 0, plate: 0, plateX: 0, line: 0, lineOpacity: 0 };
  const i = s.index;
  const live = 1 - s.exit;
  let presence =
    j === i - 1 ? prevDim * (1 - s.advance)
    : j === i ? s.enter * (1 - (1 - prevDim) * s.advance)
    : j === i + 1 ? s.enter
    : j === i + 2 ? s.advance
    : 0;
  presence *= live;
  const reveal = j < i ? 1 : j === i ? s.enter : j === i + 1 ? s.advance : 0;
  o.presence = presence;
  o.line = j < i ? 1 : j === i ? s.draw : 0;
  o.node = presence * (FLOW_TARGET_FAINT + (1 - FLOW_TARGET_FAINT) * reveal);
  o.nodeScale = FLOW_NODE_MIN_SCALE + (1 - FLOW_NODE_MIN_SCALE) * reveal;
  o.plate = presence * reveal;
  o.plateX = -(1 - reveal) * FLOW_PLATE_SHIFT_PX;
  o.lineOpacity = presence;
  return o;
}

export interface TextPhase { vin: number; vout: number }
/** Text phase of rail step j: vin while it becomes current, vout while it leaves the trail (or the flow exits). */
export function stepTextPhase(j: number, s: FlowState, out?: TextPhase): TextPhase {
  const o = out ?? { vin: 0, vout: 0 };
  const i = s.index;
  o.vin = j < i ? 1 : j === i ? s.enter : j === i + 1 ? s.advance : 0;
  const leave = j < i - 1 ? 1 : j === i - 1 ? s.advance : 0;
  o.vout = leave > s.exit ? leave : s.exit;
  return o;
}

export function trackOffset(rowTop: ArrayLike<number>, s: FlowState): number {
  const n = rowTop.length;
  if (n === 0) return 0;
  const i = Math.min(s.index, n - 1);
  const k = Math.min(i + 1, n - 1);
  return rowTop[i] + (rowTop[k] - rowTop[i]) * s.advance + FLOW_LIFT_PX * (s.exit - (1 - s.enter));
}

export function sparkStyle(rowTop: ArrayLike<number>, nodeY: number, s: FlowState, out?: SparkStyle): SparkStyle {
  const o: SparkStyle = out ?? { y: 0, opacity: 0 };
  const n = rowTop.length;
  const i = s.index;
  if (n === 0) {
    o.y = nodeY;
    o.opacity = 0;
    return o;
  }
  if (i >= n - 1) {
    o.y = rowTop[n - 1] + nodeY;
    o.opacity = 0;
    return o;
  }
  // y follows the (clamped) draw so it stays continuous when the spark hides at draw = 0 / 1.
  o.y = rowTop[i] + nodeY + clamp01(s.draw) * (rowTop[i + 1] - rowTop[i]);
  if (!(s.draw > 0 && s.draw < 1)) {
    o.opacity = 0;
    return o;
  }
  o.opacity = Math.sin(Math.PI * s.draw) * (1 - s.exit);
  return o;
}
