'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface MagneticProps {
  children: React.ReactNode;
  className?: string;
  /** Max pull in px. */
  strength?: number;
}

/** Wrapper that nudges its content towards the pointer (transform only; fine pointers, no reduced motion). */
export function Magnetic({ children, className, strength = 10 }: MagneticProps): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const opts = { duration: 0.5, ease: 'power3.out' };
      const qx = gsap.quickTo(el, 'x', opts);
      const qy = gsap.quickTo(el, 'y', opts);
      const onMove = (e: PointerEvent): void => {
        const r = el.getBoundingClientRect();
        qx(((e.clientX - (r.left + r.width / 2)) / r.width) * strength * 2);
        qy(((e.clientY - (r.top + r.height / 2)) / r.height) * strength * 2);
      };
      const onLeave = (): void => {
        qx(0);
        qy(0);
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      return () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      };
    },
    { scope: ref, dependencies: [strength] },
  );

  return (
    <span ref={ref} className={`inline-block ${className ?? ''}`}>
      {children}
    </span>
  );
}
