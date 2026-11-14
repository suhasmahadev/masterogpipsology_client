// Forex caption rail timing. Import-free: node --test loads it directly.
// Stop coordinate s from the Forex step controller: -1 at crypto 179 (one viewport above Y0), 0 = Y0 (forex 1, the Crypto slab 4
// landing), 1 = F1, 2 = F2, 3 = F3, 4 = S1, 5 = S2, 6 = O1, 7 = O2, 8 = O3 (last frame), 9 = V (video, tail stop).
// Every part of the rail is stepped: holds at stops, evenly spread captions passing in the glides between them.

export const FOREX_CHAIN_STOPS: readonly number[] = [0, 50, 88, 154, 217, 342, 461, 556, 575]; // = chainStopIndices([FOREX_STOPS_RAW, STOCK_STOPS_RAW, OPPORTUNITY_STOPS_RAW], UNIQUE_LOCAL) (test-locked)
export const FOREX_S_MIN = -1;
export const FOREX_S_MAX = 9;
export const FOREX_RAIL_HOLD_HALF = 0.1; // same as CRYPTO_RAIL_HOLD_HALF
export const FOREX_RAIL_FROM_S = -0.5; // rail enters in the 2nd half of the hand-off fade
export const FOREX_RAIL_TO_S = 6.5; // last caption (Programme 06 at O1) gone well before the O2 hold
const R = 2 / 3; // transition : hold = 0.4 : 0.6 (caption-flow FLOW_TRANSITION_SHARE, duplicated: import-free)

export function forexRailU(s: number): number {
  if (Number.isNaN(s)) return 0;
  const c = s < FOREX_S_MIN ? FOREX_S_MIN : s > FOREX_S_MAX ? FOREX_S_MAX : s;
  return (c - FOREX_S_MIN) / (FOREX_S_MAX - FOREX_S_MIN);
}

/** m holds strictly between stop holds a and b: m holds of length h and m + 1 equal transitions t = R h fill (a + .1, b - .1). */
export function railBetween(a: number, b: number, m: number): { start: number; end: number }[] {
  const span = b - a - 2 * FOREX_RAIL_HOLD_HALF;
  const h = span / (m + (m + 1) * R);
  const t = R * h;
  const out: { start: number; end: number }[] = [];
  for (let i = 0; i < m; i++) {
    const start = a + FOREX_RAIL_HOLD_HALF + t + i * (h + t);
    out.push({ start, end: start + h });
  }
  return out;
}

export function forexRailSpec(): { from: number; to: number; steps: { start: number; end: number }[] } {
  const U = forexRailU;
  const h = FOREX_RAIL_HOLD_HALF;
  const win = (k: number): { start: number; end: number } => ({ start: U(k - h), end: U(k + h) });
  const map = (w: { start: number; end: number }): { start: number; end: number } => ({ start: U(w.start), end: U(w.end) });
  const steps: { start: number; end: number }[] = [];
  for (let k = 0; k < 5; k++) steps.push(win(k)); // Y0, F1, F2, F3, S1 (equities kicker)
  for (const w of railBetween(4, 5, 3)) steps.push(map(w)); // equities rows passing S1 -> S2
  steps.push(win(5)); // S2: Programme 02
  for (const w of railBetween(5, 6, 3)) steps.push(map(w)); // Programmes 03-05 passing S2 -> O1
  steps.push(win(6)); // O1: Programme 06
  return { from: U(FOREX_RAIL_FROM_S), to: U(FOREX_RAIL_TO_S), steps };
}
