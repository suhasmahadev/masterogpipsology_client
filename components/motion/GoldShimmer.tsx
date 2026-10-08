'use client';

import { useRef } from 'react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';

/** Gold text with an opacity-only highlight sweep. `children` must be a string. */
export function GoldShimmer({ children }: { children: string }): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const bands = [el.querySelector('.gs-l'), el.querySelector('.gs-c'), el.querySelector('.gs-r')];
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 5, paused: true });
      bands.forEach((b, i) => {
        tl.to(b, { opacity: 0.9, duration: 0.175, ease: 'sine.inOut' }, i * 0.15)
          .to(b, { opacity: 0, duration: 0.175, ease: 'sine.inOut' }, i * 0.15 + 0.175);
      });
      ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
      });
    },
    { scope: ref },
  );

  return (
    <span ref={ref} className="gold-shimmer" data-text={children}>
      {children}
      <span className="gs-l" aria-hidden="true" data-text={children} />
      <span className="gs-c" aria-hidden="true" data-text={children} />
      <span className="gs-r" aria-hidden="true" data-text={children} />
    </span>
  );
}
