'use client';

import React, { useRef, useCallback } from 'react';
import { useFrameSequence, type FrameSequenceUpdate } from '@/components/hooks/useFrameSequence';
import { loadProgress } from '@/lib/load-progress';
import { RevealText } from '@/components/motion/RevealText';
import {
  buildFrameSet,
  warmFirstFrame,
  warmIndices,
  type FrameSet,
  type FrameTier,
} from '@/lib/frame-sequence/sources';

// ── Tunable constants ────────────────────────────────────────────────────────
const TOTAL_FRAMES = 240;

const urlsFor = (tier: FrameTier): FrameSet => buildFrameSet(['crypto'], tier);
const PINNED = [0, TOTAL_FRAMES - 1] as const;
// First 24 frames, then every 8th: a coarse fallback exists before the full fetch starts.
const CRYPTO_WARM = warmIndices(TOTAL_FRAMES);
if (typeof window !== 'undefined') {
  loadProgress.register('crypto-first-frame', 0.15);
  warmFirstFrame('crypto');
}
const frameForProgress = (p: number, total: number): number =>
  Math.min(total - 1, Math.max(0, Math.round(p * (total - 1))));

export function CryptoMarketScroll(): React.ReactElement {
  // HUD refs – written directly, never via React state
  const hudFrameRef = useRef<HTMLSpanElement>(null);
  const hudProgressRef = useRef<HTMLDivElement>(null);
  const lastHud = useRef({ frame: -1, pct: -1 });

  const onUpdate = useCallback(({ progress, frame }: FrameSequenceUpdate): void => {
    const last = lastHud.current;
    if (frame !== last.frame) {
      last.frame = frame;
      if (hudFrameRef.current) hudFrameRef.current.textContent = String(frame + 1).padStart(3, '0');
    }
    const pct = Math.round(progress * 100);
    if (pct !== last.pct) {
      last.pct = pct;
      if (hudProgressRef.current) hudProgressRef.current.style.transform = `scaleX(${pct / 100})`;
    }
  }, []);

  const { sectionRef, stickyRef, canvasRef } = useFrameSequence({
    urlsFor,
    pinned: PINNED,
    warm: CRYPTO_WARM,
    frameForProgress,
    background: '#EFE7DC',
    onUpdate,
    onFrameReady: (i) => {
      if (i === 0) loadProgress.complete('crypto-first-frame');
    },
  });

  return (
    <section
      ref={sectionRef}
      id="crypto-sequence"
      aria-label="Crypto Market Interactive Scroll Sequence"
      className="relative w-full"
      style={{ height: '450vh', backgroundColor: '#EFE7DC' }}
    >
      {/* Sticky viewport – contain: layout paint avoids unnecessary compositing */}
      <div
        ref={stickyRef}
        className="sticky top-0 w-full overflow-hidden select-none"
        style={{
          height: '100dvh',
          backgroundColor: '#EFE7DC',
          contain: 'layout paint',
        }}
      >
        {/* Canvas fills the sticky wrapper exactly */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          style={{ display: 'block', imageRendering: 'auto' }}
        />

        {/* Editorial overlay – transform/opacity only, no layout properties */}
        <div
          className="relative z-10 w-full h-full max-w-7xl mx-auto px-5 sm:px-8 md:px-12 lg:px-16 flex flex-col justify-between py-10 md:py-14 pointer-events-none"
        >

          {/* Headline */}
          <div className="flex flex-col items-end text-right max-w-xl self-end">
            <div className="flex items-center gap-2 text-xs font-mono text-[#8C6D23] uppercase tracking-widest mb-3">
              <span>The Inaugural Asset Class</span>
              <span className="w-6 h-px bg-[#D4AF37]" />
            </div>
            <RevealText as="h2" mode="lines" trigger="scroll"
              className="font-display font-medium leading-[1.08] tracking-tight text-[#0E0F14] text-3xl sm:text-4xl md:text-5xl lg:text-[3.6rem]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', textShadow: '0 1px 18px rgba(255,255,255,0.6)' }}
            >
              Let me introduce you <br className="hidden sm:inline" />
              to the market, <br />
              <span className="italic font-normal text-[#B38728]">first crypto.</span>
            </RevealText>
            <p className="mt-4 md:mt-6 text-sm md:text-base font-body text-[#524C42] leading-relaxed max-w-md">
              Where 24/7 algorithmic volatility, perpetual order flow, and global liquidity pools converge. The foundation every modern institutional trader masters.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2.5">
              <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">
                BTC • BITCOIN
              </span>
              <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">
                ETH • ETHEREUM
              </span>
              <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">
                SOL • SOLANA
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CryptoMarketScroll;
