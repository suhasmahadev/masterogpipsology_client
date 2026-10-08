'use client';
import React from 'react';

// ─── Forex fades in over the end of Crypto ────────────────────────────────────
// #forex-sequence is pulled up by 100vh (marginTop in ForexMarketScroll) so its
// first screen overlaps Crypto's last screen. Crypto stays visible underneath;
// the Forex sticky viewport rises and fades in, scrubbed on scroll via GSAP
// (shared ticker). Transform/opacity only. Reduced motion: opacity crossfade.

import { gsap, useGSAP } from '@/lib/gsap';

export function ForexFade(): null {
  useGSAP(() => {
    const section = document.getElementById('forex-sequence');
    const sticky = section?.firstElementChild as HTMLElement | null;
    if (!section || !sticky) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.fromTo(
      sticky,
      { opacity: 0, y: reduced ? 0 : 72 },
      {
        opacity: 1,
        y: 0,
        ease: 'none',
        immediateRender: true,
        scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: true },
      },
    );
  }, []);
  return null;
}
