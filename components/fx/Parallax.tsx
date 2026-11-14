'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useDeviceTier } from '@/lib/device-tier';

interface ParallaxProps {
  /** -0.3..0.3 */
  speed: number;
  children: React.ReactNode;
  className?: string;
}

/** Scrubbed yPercent parallax (transform only). No-op on the static tier. */
export function Parallax({ speed, children, className }: ParallaxProps): React.ReactElement {
  const tier = useDeviceTier();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (tier === 'static' || !ref.current) return;
      const s = Math.max(-0.3, Math.min(0.3, speed));
      gsap.fromTo(
        ref.current,
        { yPercent: -s * 50 },
        {
          yPercent: s * 50,
          ease: 'none',
          scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      );
    },
    { scope: ref, dependencies: [tier, speed] },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
