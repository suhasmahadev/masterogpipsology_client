'use client';
import React, { useRef } from 'react';

// ─── Gilded seam ──────────────────────────────────────────────────────────────
// Zero-height sibling between sections. A gold lozenge is stamped, two sparks
// engrave a hairline outward, a bloom settles. Scroll-scrubbed, transform/opacity only.

import { gsap, useGSAP } from '@/lib/gsap';

export function SectionSeam({ tone = 'dark' }: { tone?: 'light' | 'dark' }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        root.classList.add('seam--static');
        return;
      }
      const band = q('.seam__band')[0] as HTMLElement;
      const half = (): number => band.clientWidth / 2;
      gsap.set(q('.seam__spark'), { x: 0, opacity: 0 });
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: root, start: 'top 88%', end: 'top 30%', scrub: 0.6, invalidateOnRefresh: true },
      });
      tl.fromTo(q('.seam__mark'), { scale: 0, rotation: 0 }, { scale: 1, rotation: 45, duration: 0.15, ease: 'back.out(2)' }, 0)
        .fromTo(q('.seam__ring'), { scale: 0.4, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 0.3, ease: 'power2.out' }, 0.05)
        .fromTo(q('.seam__bloom'), { scaleX: 0.3, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.5, ease: 'power1.out' }, 0.1)
        .fromTo(q('.seam__line'), { scaleX: 0 }, { scaleX: 1, duration: 0.65, ease: 'power2.inOut' }, 0.12)
        .to(q('.seam__spark'), { opacity: 1, duration: 0.05 }, 0.12)
        .to(q('.seam__spark--r'), { x: () => half(), duration: 0.65, ease: 'power2.inOut' }, 0.12)
        .to(q('.seam__spark--l'), { x: () => -half(), duration: 0.65, ease: 'power2.inOut' }, 0.12)
        .to(q('.seam__spark'), { opacity: 0, duration: 0.12 }, 0.72)
        .to(q('.seam__bloom'), { opacity: 0.35, duration: 0.25 }, 0.75);
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={`seam seam--${tone}`} aria-hidden="true">
      <div className="seam__band">
        <span className="seam__bloom" />
        <span className="seam__line seam__line--l" />
        <span className="seam__line seam__line--r" />
        <span className="seam__spark seam__spark--l" />
        <span className="seam__spark seam__spark--r" />
        <span className="seam__ring" />
        <span className="seam__mark" />
      </div>
    </div>
  );
}

export default SectionSeam;
