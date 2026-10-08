'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useDeviceTier } from '@/lib/device-tier';

interface LightLeakProps {
  className?: string;
  from?: 'left' | 'right';
  intensity?: number;
}

/** Soft gold light leak that drifts as its (positioned) parent scrolls through the viewport. */
export function LightLeak({
  className = '',
  from = 'left',
  intensity = 0.8,
}: LightLeakProps): React.ReactElement | null {
  const tier = useDeviceTier();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      const parent = el?.parentElement;
      if (!el || !parent || tier === 'static') return;
      const dir = from === 'left' ? 1 : -1;
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: parent, start: 'top bottom', end: 'bottom top', scrub: true },
      });
      tl.fromTo(el, { xPercent: -20 * dir }, { xPercent: 20 * dir, duration: 1 }, 0)
        .fromTo(el, { opacity: 0 }, { opacity: intensity, duration: 0.5 }, 0)
        .to(el, { opacity: 0, duration: 0.5 }, 0.5);
    },
    { scope: ref, dependencies: [tier, from, intensity] },
  );

  if (tier === 'static') return null;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`fx-leak ${from === 'left' ? 'left-0' : 'right-0'} ${className}`}
      style={{ opacity: 0 }}
    />
  );
}
