'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { onEveryFrame } from '@/lib/frame-loop';

interface ClockBridgeProps {
  active: boolean;
}

/**
 * Drives a frameloop="never" Canvas from the shared gsap ticker. R3F treats the
 * timestamp passed to advance() as SECONDS (it becomes clock.elapsedTime), so convert from ms.
 */
export function ClockBridge({ active }: ClockBridgeProps): null {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    if (!active) return;
    return onEveryFrame((ts) => advance(ts / 1000), 'render');
  }, [active, advance]);
  return null;
}
