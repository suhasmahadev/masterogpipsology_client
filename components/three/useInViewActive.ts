'use client';

import { useEffect, useState, type RefObject } from 'react';

/** True while the element is within rootMargin of the viewport. State only flips on enter/leave. */
export function useInViewActive(ref: RefObject<Element | null>, rootMargin = '100px'): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) setActive(last.isIntersecting);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return active;
}

/** True while the tab is visible. */
export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = (): void => setVisible(document.visibilityState === 'visible');
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}
