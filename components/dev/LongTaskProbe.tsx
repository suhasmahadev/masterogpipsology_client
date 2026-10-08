'use client';

import { useEffect } from 'react';

/** Dev-only (or ?perf=1) long-task logger. Renders nothing. */
export function LongTaskProbe(): null {
  useEffect(() => {
    const enabled =
      process.env.NODE_ENV !== 'production' || window.location.search.includes('perf=1');
    if (!enabled || typeof PerformanceObserver === 'undefined') return;
    let po: PerformanceObserver | null = null;
    try {
      po = new PerformanceObserver((l) =>
        l.getEntries().forEach((e) => console.warn('[longtask]', Math.round(e.duration), 'ms')),
      );
      po.observe({ type: 'longtask', buffered: true });
    } catch {
      /* longtask unsupported */
    }
    return () => po?.disconnect();
  }, []);
  return null;
}
