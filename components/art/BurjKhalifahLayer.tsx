'use client';
import React from 'react';

// ─── Burj Khalifa Architectural Layer ─────────────────────────────────────────
// This component makes the Burj Khalifa feel like a PHYSICAL 3D OBJECT existing
// inside the webpage — not a flat image sitting in a section.
//
// Layer stack (bottom → top):
//   1. Atmospheric ambient glow      (warm radial, breathing pulse)
//   2. Ground contact shadow         (dark ellipse beneath base, grows w/ scroll)
//   3. Lower ambient occlusion       (gradient darkening toward podium level)
//   4. The Burj Khalifa PNG          (sharp, realistic, left-anchored)
//   5. Upper morning atmospheric haze (very subtle warm overlay integrating sky)
//   6. Specular edge highlight       (thin rim on right edge — morning light)
//
// Parallax: tower moves at 0.3× scroll rate vs content — creates depth
// Scale: subtle grow (1.0 → 1.06) simulating camera drift forward
// Ground shadow: grows in opacity and spread as scroll progresses
//
// Desktop: tower occupies left 38% of viewport
// Mobile: tower stays visible, anchored left, ~55% wide, scaled down

import Image from 'next/image';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

interface BurjKhalifahLayerProps {
  /** The scroll container ref for measuring scroll progress */
  containerRef: React.RefObject<HTMLElement | null>;
}

export function BurjKhalifahLayer({ containerRef }: BurjKhalifahLayerProps): React.ReactElement {
  const { scrollYProgress } = useScroll({
    target: containerRef as React.RefObject<HTMLElement>,
    offset: ['start start', 'end end'],
  });

  // Spring-smooth the scroll value for buttery motion
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 35,
    damping: 30,
    mass: 1.0,
  });

  // ── Parallax vertical drift (tower moves slower than page content) ───────
  // Content moves at 100vh per scroll unit. Tower drifts at ~30% of that.
  // This creates the illusion the tower is closer / in foreground.
  const towerY = useTransform(smoothProgress, [0, 1], ['0vh', '-18vh']);

  // ── Subtle forward scale — simulates camera moving toward building ────────
  const towerScale = useTransform(smoothProgress, [0, 0.6], [1.0, 1.06]);

  // ── Ground shadow grows as scroll progresses ──────────────────────────────
  const groundShadowOpacity = useTransform(smoothProgress, [0, 0.15, 0.7], [0.0, 0.35, 0.82]);
  const groundShadowScale = useTransform(smoothProgress, [0, 0.7], [0.6, 1.15]);

  // ── Lower ambient occlusion on the building base ──────────────────────────
  const aoOpacity = useTransform(smoothProgress, [0.05, 0.5], [0.0, 0.55]);

  // ── Atmospheric glow around base brightens slightly at entry ──────────────
  const glowOpacity = useTransform(smoothProgress, [0, 0.2, 0.5], [0.22, 0.32, 0.18]);

  // ── Horizontal parallax — tower drifts slightly left as content scrolls ───
  // Gives the impression of camera moving through 3D space
  const towerX = useTransform(smoothProgress, [0, 1], ['0%', '-3%']);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      <motion.div
        style={{
          position: 'sticky',
          top: 0,
          width: '100%',
          height: '100vh',
          y: towerY,
          x: towerX,
        }}
      >
        {/* ─── Layer 1: Atmospheric ambient glow ───────────────────────── */}
        {/* Warm morning radial glow emanating from around tower base */}
        <motion.div
          className="atmos-glow"
          style={{
            position: 'absolute',
            bottom: '4%',
            left: '-2%',
            width: '55%',
            height: '40%',
            background: `
              radial-gradient(
                ellipse 70% 60% at 40% 85%,
                rgba(220, 175, 100, 0.45) 0%,
                rgba(220, 175, 100, 0.15) 40%,
                transparent 75%
              )
            `,
            filter: 'blur(28px)',
            opacity: glowOpacity,
          }}
        />

        {/* ─── Layer 2: Full-Width Ground Foundation Plane (Screen Left-to-Right) ─── */}
        {/* Architectural ground plane spanning 100% full screen width from left to right */}
        <motion.div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: 'clamp(140px, 22vh, 260px)',
            background: `
              linear-gradient(
                to top,
                #08080A 0%,
                rgba(8, 8, 10, 0.95) 25%,
                rgba(12, 10, 8, 0.70) 55%,
                rgba(18, 14, 10, 0.25) 80%,
                transparent 100%
              )
            `,
            opacity: groundShadowOpacity,
            zIndex: 10,
          }}
        />

        {/* ─── Layer 2b: Concentrated Podial Contact Shadow ─────────────────── */}
        <motion.div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: '14%',
            background: `
              radial-gradient(
                ellipse 85% 100% at 30% 100%,
                rgba(6, 6, 8, 0.98) 0%,
                rgba(10, 8, 6, 0.75) 45%,
                rgba(18, 14, 10, 0.25) 75%,
                transparent 100%
              )
            `,
            filter: 'blur(16px)',
            opacity: groundShadowOpacity,
            scaleX: groundShadowScale,
            transformOrigin: '30% 100%',
            zIndex: 10,
          }}
        />

        {/* ─── Layer 2c: Full-Width Horizon Hairline Rule ────────────────────── */}
        <motion.div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.4) 25%, rgba(255,225,140,0.7) 50%, rgba(212,175,55,0.4) 75%, transparent 100%)',
            opacity: groundShadowOpacity,
            zIndex: 15,
          }}
        />

        {/* ─── Layer 3: Lower ambient occlusion / deep shadow on podium ─── */}
        {/* Gradient that darkens the lower 35% of the building progressively */}
        <motion.div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: 'clamp(280px, 48vw, 680px)',
            height: '45%',
            background: `
              linear-gradient(
                to top,
                rgba(8, 8, 10, 0.95) 0%,
                rgba(12, 10, 6, 0.65) 20%,
                rgba(14, 10, 6, 0.20) 45%,
                transparent 70%
              )
            `,
            opacity: aoOpacity,
            pointerEvents: 'none',
            zIndex: 12,
          }}
        />

        {/* ─── Layer 4: The Burj Khalifa PNG ───────────────────────────── */}
        {/* Sized prominently with bottom covering and grounding */}
        <motion.div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: 'clamp(280px, 48vw, 680px)',
            height: 'auto',
            scale: towerScale,
            transformOrigin: 'bottom left',
            zIndex: 11,
            // Multi-layer drop shadow for dimensional depth
            filter: `
              drop-shadow(0px 40px 60px rgba(8, 6, 4, 0.65))
              drop-shadow(0px 16px 32px rgba(8, 6, 4, 0.45))
              drop-shadow(0px 6px 12px rgba(8, 6, 4, 0.30))
            `,
          }}
        >
          <Image
            src="/bhurj_khalifa.png"
            alt="Burj Khalifa — architectural landmark of Dubai"
            width={680}
            height={1400}
            priority
            sizes="(max-width: 480px) 65vw, (max-width: 768px) 55vw, 48vw"
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              objectPosition: 'bottom left',
              // Warm morning light integration
              filter: 'brightness(1.04) contrast(1.02) saturate(1.05)',
            }}
          />
        </motion.div>

        {/* ─── Layer 5: Upper atmospheric morning haze ──────────────────── */}
        {/* Integrates the tower top into the warm beige sky — avoids cut-out look */}
        <motion.div
          style={{
            position: 'absolute',
            top: '8%',
            left: 0,
            width: '42%',
            height: '32%',
            background: `
              linear-gradient(
                to bottom,
                rgba(239, 230, 214, 0.35) 0%,
                rgba(239, 230, 214, 0.12) 45%,
                transparent 75%
              )
            `,
            pointerEvents: 'none',
            zIndex: 13,
          }}
        />

        {/* ─── Layer 6: Specular edge rim (morning light on right edge) ─── */}
        {/* Thin vertical warm light rim suggesting the sun is to the right */}
        <motion.div
          style={{
            position: 'absolute',
            top: '10%',
            left: 'clamp(260px, 46vw, 650px)',
            width: '3px',
            height: '60%',
            background: `
              linear-gradient(
                to bottom,
                transparent 0%,
                rgba(240, 210, 140, 0.55) 15%,
                rgba(240, 210, 140, 0.72) 40%,
                rgba(240, 210, 140, 0.38) 70%,
                transparent 90%
              )
            `,
            filter: 'blur(2px)',
            opacity: 0.6,
            zIndex: 14,
          }}
        />
      </motion.div>
    </div>
  );
}
