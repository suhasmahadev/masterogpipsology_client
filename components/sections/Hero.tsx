'use client';
import React from 'react';

// ─── Hero Section ─────────────────────────────────────────────────────────────
// Static photo with the original 74ebc1e light layers (orbs, shaft, scrim, bottom
// fade). One scroll-scrubbed timeline zooms the photo and drifts the light layers;
// only transform and opacity animate.

import { useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import heroImg from '@/public/hero/hero-master-3840.jpg';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { TypingHeading } from '@/components/ui/TypingHeading';
import { gsap, useGSAP } from '@/lib/gsap';
import { useDeviceTier } from '@/lib/device-tier';
import { loadProgress } from '@/lib/load-progress';
import type { TypingSegment } from '@/lib/typing';
import {
  HERO_SUBLINE,
  CTA_SECONDARY,
} from '@/lib/content';
import {
  fadeUpVariants,
  brassRuleVariants,
} from '@/lib/motion';

if (typeof window !== 'undefined') loadProgress.register('hero-image', 0.45);

const HEADLINE: TypingSegment[] = [
  { text: 'Education before ' },
  { text: 'Execution', gold: true, flare: true },
];

export const HERO_PHOTO_ZOOM = 1.12;

export function Hero(): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const markHeroImage = useCallback((): void => {
    const img = bgImgRef.current;
    if (!img) return;
    loadProgress.update('hero-image', 0.8);
    const done = (): void => loadProgress.complete('hero-image');
    if (typeof img.decode === 'function') img.decode().then(done, done);
    else done();
  }, []);
  useEffect(() => {
    // Image may have finished loading before hydration attached onLoad.
    if (bgImgRef.current?.complete) markHeroImage();
  }, [markHeroImage]);
  const inView = useInView(ref, { once: true, amount: 0.08 });
  const tier = useDeviceTier();

  useGSAP(() => {
    if (tier === 'static') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const hero = ref.current, photo = photoRef.current, content = contentRef.current;
    if (!hero || !photo || !content) return;
    const q = gsap.utils.selector(hero);
    const W = (): number => hero.clientWidth;
    const H = (): number => hero.clientHeight;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8, invalidateOnRefresh: true },
    });
    tl.fromTo(photo, { scale: 1 }, { scale: HERO_PHOTO_ZOOM, duration: 1 }, 0)
      .fromTo(content, { yPercent: 0 }, { yPercent: -12, duration: 1 }, 0)
      // orb1: left 68%->52%, top 8%->-18%, scale 1->1.35; opacity .55 -> .72 (0.3) -> .4 (0.8) -> .2 (1)
      .fromTo(q('.hl-orb1'), { x: 0, y: 0, scale: 1 }, { x: () => -0.16 * W(), y: () => -0.26 * H(), scale: 1.35, duration: 1 }, 0)
      .fromTo(q('.hl-orb1'), { opacity: 0.55 }, { opacity: 0.72, duration: 0.3 }, 0)
      .to(q('.hl-orb1'), { opacity: 0.4, duration: 0.5 }, 0.3)
      .to(q('.hl-orb1'), { opacity: 0.2, duration: 0.2 }, 0.8)
      // orb2: left 10%->32%, top 70%->20%; opacity 0 -> .38 (0.4) -> .18 (1)
      .fromTo(q('.hl-orb2'), { x: 0, y: 0 }, { x: () => 0.22 * W(), y: () => -0.5 * H(), duration: 1 }, 0)
      .fromTo(q('.hl-orb2'), { opacity: 0 }, { opacity: 0.38, duration: 0.4 }, 0)
      .to(q('.hl-orb2'), { opacity: 0.18, duration: 0.6 }, 0.4)
      // orb3: left 110% -> 85% (0.3) -> 60% (1); opacity 0 -> .28 (.25) -> .42 (.7) -> .18 (1)
      .fromTo(q('.hl-orb3'), { x: 0 }, { x: () => -0.25 * W(), duration: 0.3 }, 0)
      .to(q('.hl-orb3'), { x: () => -0.5 * W(), duration: 0.7 }, 0.3)
      .fromTo(q('.hl-orb3'), { opacity: 0 }, { opacity: 0.28, duration: 0.25 }, 0)
      .to(q('.hl-orb3'), { opacity: 0.42, duration: 0.45 }, 0.25)
      .to(q('.hl-orb3'), { opacity: 0.18, duration: 0.3 }, 0.7)
      // shaft opacity 0 -> .18 (.15) -> .28 (.6) -> .08 (1)
      .fromTo(q('.hl-shaft'), { opacity: 0 }, { opacity: 0.18, duration: 0.15 }, 0)
      .to(q('.hl-shaft'), { opacity: 0.28, duration: 0.45 }, 0.15)
      .to(q('.hl-shaft'), { opacity: 0.08, duration: 0.4 }, 0.6)
      // scrim 1 -> .8 (.5) -> .45 (1); bottom fade 1 -> .6 (.7) -> .3 (1)
      .fromTo(q('.hl-scrim'), { opacity: 1 }, { opacity: 0.8, duration: 0.5 }, 0)
      .to(q('.hl-scrim'), { opacity: 0.45, duration: 0.5 }, 0.5)
      .fromTo(q('.hl-bottom'), { opacity: 1 }, { opacity: 0.6, duration: 0.7 }, 0)
      .to(q('.hl-bottom'), { opacity: 0.3, duration: 0.3 }, 0.7);
  }, { dependencies: [tier], scope: ref, revertOnUpdate: true });

  return (
    <section
      id="hero"
      ref={ref}
      className="relative min-h-screen w-full flex items-center overflow-hidden"
      aria-label="Hero"
    >
      <div className="absolute inset-0" aria-hidden="true">
        {/* Photo: the only zoomed layer */}
        <div ref={photoRef} className="absolute inset-0" style={{ transformOrigin: '60% 50%', willChange: 'transform' }}>
          <Image
            src={heroImg}
            ref={bgImgRef}
            onLoad={markHeroImage}
            alt=""
            fill
            preload
            fetchPriority="high"
            sizes="100vw"
            quality={90}
            style={{ objectFit: 'cover', objectPosition: '65% center' }}
          />
        </div>
        <div className="hl-orb hl-orb1" style={{ top: '8%', left: '68%', opacity: 0.55 }} />
        <div className="hl-orb hl-orb2" style={{ top: '70%', left: '10%', opacity: 0 }} />
        <div className="hl-orb hl-orb3" style={{ top: '30%', left: '110%', opacity: 0 }} />
        <div className="hl-shaft" style={{ opacity: 0 }} />
        <div className="hl-scrim absolute inset-0" />
        <div className="hl-bottom absolute inset-x-0 bottom-0 h-48" />
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div
        ref={contentRef}
        className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 md:px-12 lg:px-16 pt-28 sm:pt-32 pb-24 sm:pb-28"
      >
        {/* Text column */}
        <div className="max-w-xl lg:max-w-2xl flex flex-col gap-5 sm:gap-6">

          {/* Headline */}
          <TypingHeading
            as="h1"
            segments={HEADLINE}
            className="display font-medium leading-[1.05] tracking-tight"
            style={{ fontSize: 'clamp(2.2rem, 6vw, 5rem)', color: '#F3ECE0', textShadow: '0 2px 28px rgba(0,0,0,0.35)' }}
          />

          {/* Brass rule */}
          <motion.div
            className="brass-rule w-20 sm:w-28"
            aria-hidden="true"
            variants={brassRuleVariants}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
          />

          {/* Subline */}
          <motion.p
            custom={4}
            variants={fadeUpVariants}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="text-base sm:text-lg leading-relaxed font-body max-w-prose"
            style={{
              color: 'rgba(243,236,224,0.80)',
              textShadow: '0 1px 12px rgba(0,0,0,0.3)',
            }}
          >
            {HERO_SUBLINE}
          </motion.p>

          {/* CTAs */}
          <motion.div
            custom={5}
            variants={fadeUpVariants}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="flex flex-col gap-3 pt-1"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button as="a" href="#curriculum" size="lg" variant="outline" id="hero-cta-secondary">
                {CTA_SECONDARY}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
