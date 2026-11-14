'use client';
import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { gsap, useGSAP } from '@/lib/gsap';
import { useDeviceTier } from '@/lib/device-tier';
import { RingsErrorBoundary } from './RingsErrorBoundary';
import { StaticRings } from './StaticRings';

// three is only fetched once the showcase is near the viewport (keeps it out of first-load JS).
const MagicRings = dynamic(() => import('@/components/MagicRings'), { ssr: false });


type Kf = [t: number, v: number];

/** Piecewise-linear keyframes (t in 0..1) as sequential tweens on a scrubbed timeline. */
function keyframes(tl: gsap.core.Timeline, el: Element, prop: string, kfs: Kf[]): void {
  for (let i = 1; i < kfs.length; i++) {
    tl.fromTo(
      el,
      { [prop]: kfs[i - 1][1] },
      { [prop]: kfs[i][1], duration: kfs[i][0] - kfs[i - 1][0], ease: 'none', immediateRender: i === 1 },
      kfs[i - 1][0],
    );
  }
}

export function MagicRingShowcase(): React.ReactElement {
  const containerRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const tier = useDeviceTier();
  const [ringsFailed, setRingsFailed] = useState(false);
  const staticRings = tier === 'static' || ringsFailed;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || nearViewport) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNearViewport(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [nearViewport]);

  // One scrubbed timeline replaces the four framer useScroll/useSpring chains.
  // start end -> end start matches the old offsets (centre-centre is progress 0.5).
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const card = cardRef.current, aura = auraRef.current;
      if (!card || !aura) return;
      const tl = gsap.timeline({
        scrollTrigger: { trigger: containerRef.current, start: 'top bottom', end: 'bottom top', scrub: true },
      });
      keyframes(tl, card, 'scale', [[0, 0.86], [0.5, 1], [0.85, 1], [1, 0.92]]);
      keyframes(tl, card, 'opacity', [[0, 0.25], [0.3, 1], [0.8, 1], [1, 0.35]]);
      keyframes(tl, card, 'rotationX', [[0, 15], [0.5, 0], [1, -8]]);
      keyframes(tl, card, 'y', [[0, 50], [0.5, 0], [1, -35]]);
      keyframes(tl, aura, 'scale', [[0, 0.75], [0.5, 1.3], [1, 0.85]]);
      keyframes(tl, aura, 'opacity', [[0, 0.15], [0.5, 0.65], [1, 0.2]]);
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      aria-label="Master of Pipsology Portal of Precision"
      className="relative w-full py-16 md:py-24 px-4 sm:px-6 md:px-8 lg:px-12 flex flex-col items-center justify-center overflow-hidden"
      style={{ perspective: 1200 }}
    >
      {/* ─── SCROLL-ANIMATED MAIN APERTURE CONTAINER ─── */}
      <div
        ref={cardRef}
        style={{
          transformStyle: 'preserve-3d',
          willChange: 'transform, opacity',
        }}
        className="relative w-full max-w-6xl h-[440px] sm:h-[500px] md:h-[580px] lg:h-[620px] rounded-[2rem] overflow-hidden border border-[#D4AF37]/35 bg-gradient-to-b from-[#0D0E12] via-[#08080A] to-[#040406] shadow-[0_24px_80px_rgba(0,0,0,0.92),0_0_80px_rgba(212,175,55,0.12)] flex items-center justify-center group"
      >
        {/* Subtle Ambient Vignette & Horizon Grid Line */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(4,4,6,0.85)_100%)]"
        />

        {/* Top & Bottom Specular Highlights */}
        <div
          aria-hidden="true"
          className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/80 to-transparent z-20 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent z-20 pointer-events-none"
        />

        {/* Top Status Badge */}
        <div className="absolute top-6 inset-x-0 z-20 flex justify-center items-center pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/60 border border-[#D4AF37]/30 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="font-mono text-[10px] md:text-[11px] tracking-[0.25em] text-[#D4AF37] uppercase font-semibold">
              
            </span>
          </div>
        </div>

        {/* ─── WEBGL MAGIC RINGS BACKGROUND ─── */}
        <div className="absolute inset-0 z-0">
          {staticRings ? <StaticRings /> : nearViewport && (
            <RingsErrorBoundary fallback={<StaticRings />}>
              <MagicRings color="#D4AF37" colorTwo="#FAF1DE" ringCount={7} speed={0.8} lineThickness={2.3}
                baseRadius={0.3} radiusStep={0.088} scaleRate={0.08} attenuation={10.5} ringGap={1.42}
                followMouse={false} parallax={0} hoverScale={1.14} clickBurst={true}
                maxDpr={tier === 'low' ? 1.5 : 2} onUnavailable={() => setRingsFailed(true)} />
            </RingsErrorBoundary>
          )}
        </div>

        {/* ─── EXPANDING GOLDEN AURA (Scroll Reactive) ─── */}
        <div
          ref={auraRef}
          aria-hidden="true"
          style={{
            opacity: 0.65,
            transform: 'scale(1.3)',
            willChange: 'transform, opacity',
          }}
          className="absolute w-72 h-72 sm:w-96 sm:h-96 md:w-[480px] md:h-[480px] rounded-full pointer-events-none -z-5"
        >
          <div
            className="w-full h-full rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(212,175,55,0.45) 0%, rgba(212,175,55,0.22) 30%, rgba(212,175,55,0.08) 55%, rgba(212,175,55,0.02) 75%, transparent 92%)',
            }}
          />
        </div>

        {/* ─── CENTER LOGO MEDALLION (concentric with the rings) ─── */}
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none">
          {/* Medallion disc: exact card centre = ring centre */}
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-full shadow-[0_0_60px_rgba(212,175,55,0.5)] transition-transform duration-500 group-hover:scale-105">
            {/* White face fills the circle; edge sits under the rim */}
            <div className="absolute inset-[1px] rounded-full overflow-hidden [clip-path:circle(50%)] bg-[#FEFEFE]">
              <div className="absolute inset-[5%]">
                <Image src="/main_logo.png" alt="Master of Pipsology Official Insignia" fill
                  sizes="(min-width: 768px) 176px, (min-width: 640px) 144px, 112px" quality={90}
                  className="object-contain" />
              </div>
            </div>
            {/* Gold rim on top: crisp, concentric. #AA8C2C = #D4AF37 @80% over the old black disc */}
            <div aria-hidden="true" className="absolute inset-0 rounded-full border-2 border-[#AA8C2C] shadow-[inset_0_0_12px_rgba(212,175,55,0.45)] pointer-events-none" />
            {/* Inner bezel hairline */}
            <div aria-hidden="true" className="absolute inset-1.5 rounded-full border border-[#D4AF37]/30 pointer-events-none" />
          </div>
          {/* Typography below the disc: 50% + disc radius + 1.5rem */}
          <div className="absolute inset-x-0 top-[calc(50%_+_5rem)] sm:top-[calc(50%_+_6rem)] md:top-[calc(50%_+_7rem)] px-4 text-center">
            <span className="font-display font-bold text-base sm:text-lg md:text-xl tracking-[0.24em] text-[#FAF6F0] uppercase block drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              MASTER OF PIPSOLOGY
            </span>
            <span className="text-xs sm:text-sm font-mono tracking-[0.28em] text-[#D4AF37] uppercase mt-2 block font-medium">
              EDUCATION BEFORE EXECUTION
            </span>
            <div className="mt-3 flex items-center justify-center gap-3 opacity-75">
              <span className="h-[1px] w-8 bg-[#D4AF37]/50" />
              <span className="h-[1px] w-8 bg-[#D4AF37]/50" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
