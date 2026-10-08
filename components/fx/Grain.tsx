'use client';

import { useRef } from 'react';
import { useDeviceTier } from '@/lib/device-tier';
import { ScrollTrigger, useGSAP } from '@/lib/gsap';

/** Animated film grain (transform-only). High tier; hidden under reduced motion and over the hero. */
export function Grain(): React.ReactElement | null {
  const tier = useDeviceTier();
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!ref.current) return;
      ScrollTrigger.create({
        trigger: '#hero',
        start: 'top bottom',
        end: 'bottom top',
        toggleClass: { targets: ref.current, className: 'fx-grain--off' },
      });
    },
    { dependencies: [tier] },
  );
  if (tier !== 'high') return null;
  return <div ref={ref} className="fx-grain" aria-hidden="true" />;
}
