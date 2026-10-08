'use client';
import React, { useRef } from 'react';

// ─── Markets Section ──────────────────────────────────────────────────────────
// Three 3D-tilt glass cards (Forex, Equities, Crypto). Tilt is pointer-driven
// via gsap.quickTo (fine pointers only); content floats at translateZ(30px).

import { MARKETS } from '@/lib/content';
import { gsap, useGSAP } from '@/lib/gsap';
import { FillStatement } from '@/components/motion/FillStatement';

export function Markets(): React.ReactElement {
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const grid = gridRef.current;
      if (!grid) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.from(grid.querySelectorAll('[data-market-card]'), {
        y: 40,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
        stagger: 0.12,
        scrollTrigger: { trigger: grid, start: 'top 82%', once: true },
      });
    },
    { scope: gridRef },
  );

  return (
    <section
      id="markets"
      className="py-20 md:py-28 px-4 md:px-8 lg:px-16 max-w-7xl mx-auto"
      aria-labelledby="markets-heading"
    >
      {/* Section label */}
      <div className="flex items-center gap-3 mb-4">
        <span className="label-caps" style={{ color: 'var(--accent)' }}>
          Markets covered
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--hairline)' }} aria-hidden="true" />
      </div>

      <FillStatement
        as="h2"
        id="markets-heading"
        className="display mb-12 md:mb-16"
        style={{ fontSize: 'var(--fs-h2)', color: 'var(--text)' }}
      >
        {'Three markets.\nOne framework.'}
      </FillStatement>

      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ perspective: '1200px' }}>
        {MARKETS.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
      </div>
    </section>
  );
}

function MarketCard({ market }: { market: (typeof MARKETS)[number] }): React.ReactElement {
  const cardRef = useRef<HTMLElement>(null);
  const glareRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const card = cardRef.current;
      const glare = glareRef.current;
      if (!card || !glare) return;
      const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!fine || reduce) return;

      gsap.set(glare, { xPercent: -50, yPercent: -50, opacity: 0 });
      const opts = { duration: 0.6, ease: 'power3.out' };
      const rx = gsap.quickTo(card, 'rotationX', opts);
      const ry = gsap.quickTo(card, 'rotationY', opts);
      const gx = gsap.quickTo(glare, 'x', opts);
      const gy = gsap.quickTo(glare, 'y', opts);
      const go = gsap.quickTo(glare, 'opacity', { duration: 0.4, ease: 'power2.out' });

      const onMove = (e: PointerEvent): void => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry((px - 0.5) * 16);
        rx(-(py - 0.5) * 16);
        gx(px * r.width);
        gy(py * r.height);
        go(0.35);
      };
      const onLeave = (): void => {
        rx(0);
        ry(0);
        go(0);
      };
      card.addEventListener('pointermove', onMove);
      card.addEventListener('pointerleave', onLeave);
      return () => {
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerleave', onLeave);
      };
    },
    { scope: cardRef },
  );

  return (
    <article
      ref={cardRef}
      data-market-card
      className="relative p-7 md:p-8"
      style={{
        transformStyle: 'preserve-3d',
        borderRadius: 24,
        border: '1px solid rgba(212,175,55,.28)',
        background: 'linear-gradient(160deg, rgba(255,255,255,.06), rgba(255,255,255,.02))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        willChange: 'transform',
      }}
    >
      {/* Glare (clipped in its own layer so the card keeps preserve-3d) */}
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ borderRadius: 24 }}
      >
        <span
          ref={glareRef}
          className="absolute left-0 top-0 block w-72 h-72 rounded-full"
          style={{
            opacity: 0,
            background: 'radial-gradient(circle, rgba(255,255,255,.9) 0%, rgba(255,255,255,0) 60%)',
          }}
        />
      </span>

      <div className="relative flex flex-col gap-5 h-full" style={{ transform: 'translateZ(30px)' }}>
        <div className="label-caps" style={{ color: 'var(--text-muted)' }}>
          {market.kicker}
        </div>
        <h3
          className="display font-medium tracking-tight leading-none"
          style={{ fontSize: 'var(--fs-h3)', color: 'var(--text)' }}
        >
          {market.heading}
        </h3>
        <p className="text-base leading-relaxed font-body" style={{ color: 'var(--text-muted)' }}>
          {market.body}
        </p>
        <div className="flex flex-wrap gap-2 mt-auto" role="list" aria-label={`${market.heading} topics`}>
          {market.tags.map((tag) => (
            <span
              key={tag}
              role="listitem"
              className="px-3 py-1 rounded-full text-xs font-body font-medium border"
              style={{ borderColor: 'rgba(212,175,55,.28)', color: 'var(--text-muted)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
