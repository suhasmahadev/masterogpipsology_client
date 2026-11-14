'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/content';
import { circlePath, roseRing, sunburst, tickRing } from '@/lib/guilloche';

const RING_A = circlePath(492) + circlePath(484) + tickRing(120, 462, 480, 448, 10);
const RING_B = roseRing(72, 405, 48) + circlePath(350) + circlePath(460);
const RING_C = sunburst(96, 150, 340, 0.012, 6, 24) + circlePath(340);

const words = BRAND_NAME.split(' ');
const pre = words.slice(0, -1).join(' ');
const name = words[words.length - 1];

function GoldDef({ id }: { id: string }): React.ReactElement {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#F3E2B3" />
        <stop offset=".35" stopColor="#D4AF37" />
        <stop offset=".65" stopColor="#8C6D23" />
        <stop offset="1" stopColor="#E9D29A" />
      </linearGradient>
    </defs>
  );
}

/** The Hallmark Dial: an engraved-gold guilloche watch dial whose rings turn against each other on scroll. */
export function HallmarkDial(): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const ringA = useRef<SVGSVGElement>(null);
  const ringB = useRef<SVGSVGElement>(null);
  const ringC = useRef<SVGSVGElement>(null);
  const sheenOuter = useRef<HTMLDivElement>(null);
  const sheenInner = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const dial = dialRef.current;
      const a = ringA.current, b = ringB.current, c = ringC.current;
      const so = sheenOuter.current, si = sheenInner.current, text = textRef.current;
      if (!ref.current || !dial || !a || !b || !c || !so || !si || !text) return;
      gsap.set([a, b, c, so, si], { transformOrigin: '50% 50%' });
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: ref.current, start: 'top 70%', end: 'bottom bottom', scrub: 0.6 },
      });
      tl.fromTo(dial, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.18, ease: 'power2.out' }, 0)
        .fromTo(a, { rotation: 0 }, { rotation: -14, duration: 1 }, 0)
        .fromTo(b, { rotation: 0 }, { rotation: 22, duration: 1 }, 0)
        .fromTo(c, { rotation: 0 }, { rotation: -9, duration: 1 }, 0)
        .fromTo(so, { rotation: -40 }, { rotation: 200, duration: 1 }, 0)
        .fromTo(si, { rotation: 30 }, { rotation: -110, duration: 1 }, 0)
        .fromTo(text, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }, 0.22)
        .to(dial, { opacity: 0, scale: 0.97, duration: 0.18, ease: 'power1.in' }, 0.82);
    },
    { scope: ref },
  );

  return (
    <section id="hallmark" ref={ref} data-nav-tone="dark" aria-label={BRAND_NAME} className="hm-section relative">
      <div className="hm-sticky">
        <div ref={dialRef} className="hm-dial">
          <div className="hm-glow" aria-hidden="true" />
          <svg ref={ringA} className="hm-layer" viewBox="0 0 1000 1000" aria-hidden="true">
            <GoldDef id="hm-gold-a" />
            <path d={RING_A} stroke="url(#hm-gold-a)" strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" opacity={0.8} />
          </svg>
          <svg ref={ringB} className="hm-layer" viewBox="0 0 1000 1000" aria-hidden="true">
            <GoldDef id="hm-gold-b" />
            <path d={RING_B} stroke="url(#hm-gold-b)" strokeWidth={0.75} fill="none" vectorEffect="non-scaling-stroke" opacity={0.55} />
          </svg>
          <svg ref={ringC} className="hm-layer" viewBox="0 0 1000 1000" aria-hidden="true">
            <GoldDef id="hm-gold-c" />
            <path d={RING_C} stroke="url(#hm-gold-c)" strokeWidth={0.6} fill="none" vectorEffect="non-scaling-stroke" opacity={0.4} />
          </svg>
          <div ref={sheenOuter} className="hm-sheen hm-sheen--outer" aria-hidden="true" />
          <div ref={sheenInner} className="hm-sheen hm-sheen--inner" aria-hidden="true" />
          <div ref={textRef} className="hm-sign">
            <span className="hm-sign__pre">{pre}</span>
            <span className="hm-sign__name">{name}</span>
            <span className="hm-sign__rule" aria-hidden="true" />
            <span className="hm-sign__tag">{BRAND_TAGLINE}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
