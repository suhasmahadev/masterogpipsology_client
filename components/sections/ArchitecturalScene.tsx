'use client';
import React, { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { BurjKhalifahLayer } from '@/components/art/BurjKhalifahLayer';

interface ArchitecturalSceneProps {
  children?: ReactNode;
}

export function ArchitecturalScene({ children }: ArchitecturalSceneProps): React.ReactElement {
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Spring-smooth for buttery parallax
  const smooth = useSpring(scrollYProgress, { stiffness: 28, damping: 26, mass: 1 });

  // Midground content — subtle horizontal drift
  const contentX = useTransform(smooth, [0, 1], ['0%', '-1.8%']);

  // Background atmospheric gradient — almost stationary
  const bgX = useTransform(smooth, [0, 1], ['0%', '-0.6%']);

  return (
    <div
      ref={sectionRef}
      className="relative w-full"
      style={{ overflow: 'hidden' }}
    >
      {/* ── Architectural Burj Khalifa — sticky foreground landmark ─── */}
      <BurjKhalifahLayer containerRef={sectionRef} />

      {/* ── Background atmospheric layer — anchors the scene ─────────── */}
      <motion.div
        aria-hidden="true"
        style={{
          x: bgX,
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(
              ellipse 75% 50% at 15% 30%,
              rgba(243, 236, 218, 0.6) 0%,
              transparent 70%
            ),
            radial-gradient(
              ellipse 55% 45% at 85% 65%,
              rgba(247, 242, 232, 0.45) 0%,
              transparent 65%
            )
          `,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* ── Midground Architectural Presence & Editorial Content ─────── */}
      <motion.div
        style={{ x: contentX, position: 'relative', zIndex: 18 }}
        className="pt-24 pb-20 md:pt-32 md:pb-28 px-4 sm:px-8 md:px-12 lg:px-16 max-w-7xl mx-auto"
      >
        <div className="flex flex-col md:flex-row justify-end items-start">
          {/* Positioned on the right to complement the left-anchored Burj Khalifa */}
          <div className="w-full md:w-1/2 lg:w-5/12 md:ml-auto space-y-6 pt-8 md:pt-16">
            <div className="flex items-center gap-3">
              <span
                className="text-xs font-body font-medium uppercase tracking-widest text-[#967C3B] bg-[#967C3B]/10 px-3 py-1 rounded-full border border-[#967C3B]/20"
              >
                Global Liquidity Hub · Dubai
              </span>
              <div className="flex-1 h-px bg-[#D6CBB8]" aria-hidden="true" />
            </div>

            <h2
              className="display font-medium leading-[1.08] tracking-tight"
              style={{ fontSize: 'clamp(2.2rem, 4vw, 3.4rem)', color: 'var(--text)' }}
            >
              The physical epicentre of high-volume flow.
            </h2>

            <p className="text-base sm:text-lg text-[var(--text-muted)] font-body leading-relaxed">
              Situated at the crossroads of European, Asian, and Middle Eastern trading sessions. Master of Pipsology maintains physical desk presence in Dubai, bridging institutional macro strategy with retail execution.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#D6CBB8]/60">
              <div>
                <div className="text-2xl sm:text-3xl font-display font-medium text-[var(--text)]">
                  $7.5T
                </div>
                <div className="text-xs font-body text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                  Daily Global Turnover
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-display font-medium text-[var(--text)]">
                  Session Overlap
                </div>
                <div className="text-xs font-body text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                  London & New York
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Children (e.g. Lifted Stage / Galleries) ────────────────── */}
      {children}
    </div>
  );
}
