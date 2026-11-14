// Pure scroll plan for "Start journey" (lib/start-journey.ts). Import-free for node --test.
export const JOURNEY_PRE_ROLL_VH = 0.5;  // long or upward trips cut to this far above the target, then glide in
export const JOURNEY_REWIND_VH = 1;      // upward trips up to this glide straight back
export const JOURNEY_MAX_GLIDE_VH = 3;   // downward trips longer than this also cut
export interface JourneyPlan { cutTo: number | null; glideFrom: number; duration: number }
export function planJourney(from: number, target: number, vh: number): JourneyPlan {
  const v = vh > 0 ? vh : 1;
  const longWay = from > target + JOURNEY_REWIND_VH * v || target - from > JOURNEY_MAX_GLIDE_VH * v;
  const cutTo = longWay ? Math.max(0, target - JOURNEY_PRE_ROLL_VH * v) : null;
  const glideFrom = cutTo ?? from;
  const duration = Math.min(1.6, Math.max(0.9, 0.5 + (0.9 * Math.abs(target - glideFrom)) / v));
  return { cutTo, glideFrom, duration };
}
