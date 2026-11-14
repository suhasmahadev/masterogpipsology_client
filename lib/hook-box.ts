// Hook box timing (components/sections/HookBox.tsx): one hook per step-scroll stop, in during the glide into its stop
// (last letter lands exactly at the stop), out during the first quarter of the glide away. Coordinate: the stop coordinate s.
// Rule, per glide k-1 -> k (s fraction == frame fraction): old hook out over 0..0.25, new hook in over 0.25..1.0, scrubbed with
// the frames. The in window of a glide that holds a folder cut starts after that cut. Default text-motion overlaps. Import-free.

export interface HookWindow { inFrom: number; inTo: number; outFrom: number; outTo: number }

// Crypto s: -1 approach, 0 raw 1, 1 raw 112, 2 raw 139, 3 raw 179, 3..4 hand-off glide to Forex Y0.
export const CRYPTO_HOOK_IDS = ['c0', 'c1', 'c2', 'c3'] as const;
export const CRYPTO_HOOK_WINDOWS: Readonly<Record<(typeof CRYPTO_HOOK_IDS)[number], HookWindow>> = {
  c0: { inFrom: -0.75, inTo: 0, outFrom: 0, outTo: 0.25 },
  c1: { inFrom: 0.25, inTo: 1, outFrom: 1, outTo: 1.25 },
  c2: { inFrom: 1.25, inTo: 2, outFrom: 2, outTo: 2.25 },
  c3: { inFrom: 2.25, inTo: 3, outFrom: 3, outTo: 3.25 }, // gone at Forex s -0.75 (same glide)
};

// Forex chain s: 0 Y0, 1-3 F1-F3, 4 S1, 5 S2, 6 O1, 7 O2, 8 O3, 9 V. Cuts: forex->stock 3.595, stock->opportunity 5.349.
export const MARKET_HOOK_IDS = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'] as const;
export const MARKET_HOOK_WINDOWS: Readonly<Record<(typeof MARKET_HOOK_IDS)[number], HookWindow>> = {
  m0: { inFrom: -0.75, inTo: 0, outFrom: 0, outTo: 0.25 },
  m1: { inFrom: 0.25, inTo: 1, outFrom: 1, outTo: 1.25 },
  m2: { inFrom: 1.25, inTo: 2, outFrom: 2, outTo: 2.25 },
  m3: { inFrom: 2.25, inTo: 3, outFrom: 3, outTo: 3.25 },
  m4: { inFrom: 3.6, inTo: 4, outFrom: 4, outTo: 4.25 },  // in starts after the forex->stock cut (3.595)
  m5: { inFrom: 4.25, inTo: 5, outFrom: 5, outTo: 5.25 }, // out ends before the stock->opportunity cut (5.349)
  m6: { inFrom: 5.35, inTo: 6, outFrom: 6, outTo: 6.25 }, // in starts after that cut
  m7: { inFrom: 6.25, inTo: 7, outFrom: 7, outTo: 7.25 }, // O2; leaves at the start of the O3 glide; closing lines own V
};
