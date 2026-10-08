'use client';

import { useEffect } from 'react';
import { markIntroDone } from '@/lib/intro';

/** Placeholder until the Phase 4 preloader calls markIntroDone itself. */
export function IntroAutoStart(): null {
  useEffect(() => {
    markIntroDone();
  }, []);
  return null;
}
