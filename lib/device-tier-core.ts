export type Tier = 'high' | 'low' | 'static';

export interface TierInput {
  reducedMotion: boolean;
  width: number;
  coarsePointer: boolean;
  deviceMemory?: number;
  cores?: number;
  saveData?: boolean;
  webgl2: boolean;
}

export function computeTier(i: TierInput): Tier {
  if (i.reducedMotion) return 'static';
  if (
    !i.webgl2 ||
    i.width < 768 ||
    i.coarsePointer ||
    i.saveData ||
    (i.deviceMemory !== undefined && i.deviceMemory < 4) ||
    (i.cores !== undefined && i.cores <= 4)
  ) {
    return 'low';
  }
  return 'high';
}
