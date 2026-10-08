'use client';
import React from 'react';

// ─── Results Gallery ──────────────────────────────────────────────────────────
// Two framed pieces side by side (desktop) / stacked (mobile).
// Left: ResultsWall — programme framework pillars.
// Right: CertificateDisplay — certification with brass border and seal.
// Desktop: pointer-tracking tilt (max 6deg, gsap.quickTo). Disabled on touch.
// Specular sheen sweep on hover. Frames enter with a transform curtain.

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { ResultsWall } from '@/components/art/ResultsWall';
import { CertificateDisplay } from '@/components/art/CertificateDisplay';
import { RevealText } from '@/components/motion/RevealText';
import { CurtainImage } from '@/components/fx/CurtainImage';

export function Gallery(): React.ReactElement {
  return (
    <section
      id="gallery"
      className="py-20 md:py-28 px-4 md:px-8 lg:px-16 max-w-7xl mx-auto"
      aria-labelledby="gallery-heading"
    >
      {/* Section label */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="label-caps"
          style={{ color: 'var(--accent)' }}
        >
          Results
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--hairline)' }} aria-hidden="true" />
      </div>

      <RevealText
        as="h2"
        mode="lines"
        trigger="scroll"
        id="gallery-heading"
        className="display mb-12 md:mb-16"
        style={{ fontSize: 'var(--fs-h2)', color: 'var(--text)' }}
      >
        Real results from<br />real traders.
      </RevealText>

      {/* Gallery frames */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <CurtainImage className="rounded-2xl">
          <TiltFrame label="Programme framework">
            <ResultsWall />
          </TiltFrame>
        </CurtainImage>

        <CurtainImage className="rounded-2xl" delay={0.12}>
          <TiltFrame label="Certification and awards">
            <CertificateDisplay />
          </TiltFrame>
        </CurtainImage>
      </div>
    </section>
  );
}

// ─── Tilt frame ───────────────────────────────────────────────────────────────
interface TiltFrameProps {
  children: React.ReactNode;
  label: string;
}

function TiltFrame({ children, label }: TiltFrameProps): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const frame = ref.current;
      const tilt = tiltRef.current;
      const sheen = sheenRef.current;
      if (!frame || !tilt || !sheen) return;
      // Disable on touch-primary devices and under reduced motion
      if (window.matchMedia('(hover: none)').matches) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.set(sheen, { x: -120 });
      const opts = { duration: 0.7, ease: 'power3.out' };
      const rx = gsap.quickTo(tilt, 'rotationX', opts);
      const ry = gsap.quickTo(tilt, 'rotationY', opts);
      const sx = gsap.quickTo(sheen, 'x', opts);

      const onMove = (e: PointerEvent): void => {
        const rect = frame.getBoundingClientRect();
        const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        rx(-dy * 6);
        ry(dx * 6);
        sx(e.clientX - rect.left);
      };
      const onLeave = (): void => {
        rx(0);
        ry(0);
        sx(-120);
      };
      frame.addEventListener('pointermove', onMove);
      frame.addEventListener('pointerleave', onLeave);
      return () => {
        frame.removeEventListener('pointermove', onMove);
        frame.removeEventListener('pointerleave', onLeave);
      };
    },
    { scope: ref },
  );

  return (
    <figure
      ref={ref}
      className="group relative rounded-2xl border overflow-hidden"
      style={{
        borderColor: 'var(--accent)',
        perspective: '800px',
        boxShadow: 'var(--shadow-lg)',
      }}
      aria-label={label}
    >
      <div
        ref={tiltRef}
        className="w-full p-5 md:p-6"
        style={{ transformStyle: 'preserve-3d', backgroundColor: 'var(--surface)', willChange: 'transform' }}
      >
        {children}

        {/* Specular sheen */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <div
            ref={sheenRef}
            className="absolute top-0 bottom-0 left-0 w-24"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
              transform: 'skewX(-15deg)',
            }}
          />
        </div>
      </div>

      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
