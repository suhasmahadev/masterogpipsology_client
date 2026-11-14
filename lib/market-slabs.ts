// Slab windows for the Forex, Stock and Opportunity texts (components/sections/MarketSlabs.tsx). Import-free.
// Coordinate x: the Forex stop coordinate s (0 Y0, 1-3 F1-F3, 4 S1, 5 S2, 6 O1, 7 O2).

export const MARKET_SLAB_WINDOWS = {
  forex: { inFrom: -0.6, inTo: -0.05, outFrom: 3.15, outTo: 3.5 }, // in during the hand-off fade (Crypto slab 3 is out by -0.72), held at stops 0-3, out in S1 before the cut (s 3.595)
  stock: { inFrom: 3.62, inTo: 3.95, outFrom: 5.08, outTo: 5.32 }, // held through S1 AND S2; out in S2->O1 before the stock->opportunity cut (5.349)
  opportunity: { inFrom: 5.4, inTo: 5.92, outFrom: 6.08, outTo: 6.5 }, // in after the cut, held at O1, fully out long before O2 (s 7)
} as const;

/** Slab coordinate = the Forex stop coordinate. NaN -> -1. */
export function marketSlabX(s: number): number {
  return Number.isNaN(s) ? -1 : s;
}
