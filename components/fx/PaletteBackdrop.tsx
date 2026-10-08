'use client';

// Fixed backdrop of three stacked layers; scroll crossfades their opacity
// (beige -> dark -> gold glow). No background-color animation.

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

export function PaletteBackdrop(): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const forex = document.getElementById('forex-sequence');
      if (forex) {
        gsap.fromTo(
          q('.pb-dark'),
          { opacity: 0 },
          {
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: forex, start: '60% bottom', end: 'bottom bottom', scrub: true },
          },
        );
      }
      // #hallmark (HallmarkDial) drives the gold backdrop glow; skipped until it exists.
      const hallmark = document.getElementById('hallmark');
      if (hallmark) {
        const gold = q('.pb-gold');
        gsap.fromTo(
          gold,
          { opacity: 0 },
          {
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: hallmark, start: 'top bottom', end: 'center center', scrub: true },
          },
        );
        gsap.to(gold, {
          opacity: 0,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: { trigger: hallmark, start: 'center center', end: 'bottom top', scrub: true },
        });
      }
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="pb-root" aria-hidden="true">
      <div className="pb-layer pb-beige" />
      <div className="pb-layer pb-dark" />
      <div className="pb-layer pb-gold" />
    </div>
  );
}
