'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useDeviceTier } from '@/lib/device-tier';

interface CurtainImageProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

/** Curtain reveal built from transforms (no clip-path animation). No-op on the static tier. */
export function CurtainImage({ children, className = '', delay = 0 }: CurtainImageProps): React.ReactElement {
  const tier = useDeviceTier();
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (tier === 'static' || !outer.current || !inner.current) return;
      const media = inner.current.querySelectorAll('img, video, canvas, picture');
      const tl = gsap.timeline({
        delay,
        defaults: { ease: 'expo.out', duration: 1.3 },
        scrollTrigger: { trigger: outer.current, start: 'top 85%', once: true },
      });
      tl.from(outer.current, { yPercent: 100 }, 0).from(inner.current, { yPercent: -100 }, 0);
      if (media.length) tl.from(media, { scale: 1.15 }, 0);
    },
    { scope: outer, dependencies: [tier, delay] },
  );

  return (
    <div ref={outer} className={`overflow-hidden ${className}`}>
      <div ref={inner} className="h-full w-full">
        {children}
      </div>
    </div>
  );
}
