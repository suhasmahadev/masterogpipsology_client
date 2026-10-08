'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFrameSequence, type FrameSequenceUpdate } from '@/components/hooks/useFrameSequence';
import { IntelligenceHero } from '@/components/sections/IntelligenceHero';
import { RevealText } from '@/components/motion/RevealText';
import { buildFrameSet, type FrameSet, type FrameTier } from '@/lib/frame-sequence/sources';
import {
  frameLockRect,
  nativeVideoRect,
  settleTransform,
  smoothstep01,
  type HRect,
  type NativeMode,
} from '@/lib/frame-sequence/handoff';

// ── Tunable constants ────────────────────────────────────────────────────────
const FOREX_FRAMES       = 240;
const STOCK_FRAMES       = 240;
const OPPORTUNITY_FRAMES = 240;
const TOTAL_FRAMES       = FOREX_FRAMES + STOCK_FRAMES + OPPORTUNITY_FRAMES; // 720

const SCROLL_HEIGHT_VH     = 1500; // 500vh per phase + transition buffer
const FRAME_SCROLL_PORTION = 0.70; // 0.00 .. 0.70 = 720 frames; then dissolve, settle and reveal (below)

// Hand-off to the video (see lib/frame-sequence/handoff.ts)
const XFADE_START = 0.73; // HUD gone (0.68..0.73), frame 720 settled since 0.70
const XFADE_END   = 0.81;
const SETTLE_END  = 0.89;
const REVEAL_ON   = 0.89;
const REVEAL_OFF  = 0.85;

// ── Sequence descriptor ──────────────────────────────────────────────────────
type SeqName = 'forex' | 'stock' | 'opportunity';

interface SeqInfo {
  name:   SeqName;
  start:  number;
  frames: number;
  label:  string;
}

const SEQUENCES: SeqInfo[] = [
  { name: 'forex',       start: 0,                           frames: FOREX_FRAMES,       label: 'Asset Class 02 \u2022 Foreign Exchange' },
  { name: 'stock',       start: FOREX_FRAMES,                frames: STOCK_FRAMES,       label: 'Asset Class 03 \u2022 Stock Market'     },
  { name: 'opportunity', start: FOREX_FRAMES + STOCK_FRAMES, frames: OPPORTUNITY_FRAMES, label: 'The Opportunity'                        },
];

function resolveSeq(globalIdx: number): { seq: SeqInfo; localIdx: number } {
  for (let s = SEQUENCES.length - 1; s >= 0; s--) {
    if (globalIdx >= SEQUENCES[s].start)
      return { seq: SEQUENCES[s], localIdx: globalIdx - SEQUENCES[s].start };
  }
  return { seq: SEQUENCES[0], localIdx: globalIdx };
}

const urlsFor = (tier: FrameTier): FrameSet => buildFrameSet(['forex', 'stock_market', 'opportunity'], tier);
const PINNED = [0, 719] as const;
const frameForProgress = (p: number, total: number): number =>
  p < FRAME_SCROLL_PORTION
    ? Math.min(total - 1, Math.max(0, Math.floor((p / FRAME_SCROLL_PORTION) * total)))
    : total - 1;

// ── Component ────────────────────────────────────────────────────────────────
export function ForexMarketScroll(): React.ReactElement {
  // Transition layers
  const heroContentRef  = useRef<HTMLDivElement>(null);
  const hudContainerRef = useRef<HTMLDivElement>(null);
  const videoRef        = useRef<HTMLVideoElement | null>(null);
  const videoStateRef   = useRef<'play' | 'pause'>('pause');
  const armedRef        = useRef<boolean>(false);

  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);
  const reducedRef  = useRef(false);
  const progressRef = useRef(0);
  const shadeElRef  = useRef<HTMLElement | null>(null);
  const geomRef     = useRef<{ native: HRect; lock: HRect } | null>(null);

  // HUD and overlay refs
  const hudLabelRef    = useRef<HTMLSpanElement>(null);
  const hudFrameRef    = useRef<HTMLSpanElement>(null);
  const hudTotalRef    = useRef<HTMLSpanElement>(null);
  const hudProgressRef = useRef<HTMLDivElement>(null);

  const forexOverlayRef       = useRef<HTMLDivElement>(null);
  const stockOverlayRef       = useRef<HTMLDivElement>(null);
  const opportunityOverlayRef = useRef<HTMLDivElement>(null);

  // Last written value per DOM property: every write is skipped unless it changed.
  const last = useRef<Record<string, string>>({});
  const put = (key: string, value: string, apply: (v: string) => void): void => {
    if (last.current[key] !== value) {
      last.current[key] = value;
      apply(value);
    }
  };

  const getVideo = (): HTMLVideoElement | null => {
    if (!videoRef.current) videoRef.current = heroContentRef.current?.querySelector('video') ?? null;
    return videoRef.current;
  };

  const getShade = (): HTMLElement | null =>
    (shadeElRef.current ??= heroContentRef.current?.querySelector<HTMLElement>('[data-ih-shade]') ?? null);

  const applySettle = (progress: number): void => {
    const video = getVideo();
    const g = geomRef.current;
    if (!video || !g) return;
    const s = reducedRef.current ? 1 : smoothstep01(XFADE_END, SETTLE_END, progress);
    const tr = settleTransform(g.native, g.lock, s);
    put('vtr', `translate3d(${tr.tx.toFixed(2)}px,${tr.ty.toFixed(2)}px,0) scale(${tr.k.toFixed(5)})`,
      (v) => { video.style.transform = v; });
    put('shade', (reducedRef.current ? (progress >= XFADE_END ? 1 : 0) : s).toFixed(3),
      (v) => { const el = getShade(); if (el) el.style.opacity = v; });
  };

  // Measure native + frame-locked video geometry on mount and resize (layout is never written per frame).
  useEffect(() => {
    const host = heroContentRef.current;
    if (!host) return;
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const measure = (): void => {
      const video = getVideo();
      const c = { w: host.clientWidth, h: host.clientHeight };
      if (!video || !c.w || !c.h) return;
      const portrait = window.matchMedia('(max-aspect-ratio: 11/10)').matches;
      const mode: NativeMode = !portrait ? 'desktop'
        : window.matchMedia('(min-width: 600px)').matches ? 'tablet' : 'portrait';
      const native = nativeVideoRect(c, mode);
      geomRef.current = { native, lock: frameLockRect(c) };
      video.style.left = `${native.x}px`; video.style.top = `${native.y}px`;
      video.style.width = `${native.w}px`; video.style.height = `${native.h}px`;
      delete last.current.vtr;
      applySettle(progressRef.current);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setVideoState = (want: 'play' | 'pause'): void => {
    const video = getVideo();
    if (!video || videoStateRef.current === want) return;
    videoStateRef.current = want;
    if (want === 'play') {
      video.play().catch(() => { videoStateRef.current = 'pause'; });
    } else {
      video.pause();
    }
  };

  const onUpdate = ({ progress, frame }: FrameSequenceUpdate): void => {
    progressRef.current = progress;
    const globalIdx = frame;
    const { seq, localIdx } = resolveSeq(globalIdx);

    // ── HUD text ──────────────────────────────────────────────────────────
    put('hudFrame', String(localIdx + 1).padStart(3, '0'), (v) => { if (hudFrameRef.current) hudFrameRef.current.textContent = v; });
    put('hudTotal', String(seq.frames), (v) => { if (hudTotalRef.current) hudTotalRef.current.textContent = v; });
    put('hudLabel', seq.label, (v) => { if (hudLabelRef.current) hudLabelRef.current.textContent = v; });
    const hp = localIdx / Math.max(seq.frames - 1, 1);
    put('hudScale', hp.toFixed(3), (v) => { if (hudProgressRef.current) hudProgressRef.current.style.transform = `scaleX(${v})`; });

    // ── Overlay opacities (deterministic from global frame) ───────────────
    let forexOp = 0;
    let stockOp = 0;
    let oppOp   = 0;

    if (globalIdx < 240) {
      forexOp = globalIdx > 215 ? Math.max(0, 1 - (globalIdx - 215) / 24) : 1;
    } else if (globalIdx < 480) {
      if (globalIdx < 265) {
        stockOp = (globalIdx - 240) / 25;
      } else if (globalIdx > 455) {
        stockOp = Math.max(0, 1 - (globalIdx - 455) / 24);
      } else {
        stockOp = 1;
      }
    } else {
      if (globalIdx < 505) {
        oppOp = (globalIdx - 480) / 25;
      } else if (globalIdx > 660) {
        oppOp = Math.max(0, 1 - (globalIdx - 660) / 45);
      } else {
        oppOp = 1;
      }
    }

    // Fade entire HUD out cleanly as doorway frame settles
    let hudMasterOp = 1;
    if (progress > 0.68) {
      hudMasterOp = Math.max(0, 1 - (progress - 0.68) / 0.05);
    }

    put('forexOp', (forexOp * hudMasterOp).toFixed(3), (v) => { if (forexOverlayRef.current) forexOverlayRef.current.style.opacity = v; });
    put('stockOp', (stockOp * hudMasterOp).toFixed(3), (v) => { if (stockOverlayRef.current) stockOverlayRef.current.style.opacity = v; });
    put('oppOp', (oppOp * hudMasterOp).toFixed(3), (v) => { if (opportunityOverlayRef.current) opportunityOverlayRef.current.style.opacity = v; });
    put('hudOp', hudMasterOp.toFixed(3), (v) => { if (hudContainerRef.current) hudContainerRef.current.style.opacity = v; });

    // ── Doorway-to-video dissolve (opacity only), settle (transform), reveal ──
    const canvas = canvasRef.current;
    const heroContent = heroContentRef.current;
    if (canvas && heroContent) {
      const e = smoothstep01(XFADE_START, XFADE_END, progress);
      put('opacity', (1 - e).toFixed(3), (v) => { canvas.style.opacity = v; });
      put('vis', progress >= 0.70 ? 'visible' : 'hidden', (v) => { heroContent.style.visibility = v; });
    }
    applySettle(progress);
    const want = revealedRef.current ? progress >= REVEAL_OFF : progress >= REVEAL_ON;
    if (want !== revealedRef.current) {
      revealedRef.current = want;
      setRevealed(want); // threshold crossings only
      if (heroContent) heroContent.style.pointerEvents = want ? 'auto' : 'none';
    }

    // ── Background video: arm late, hold frame 0 until the dissolve completes ──
    const video = getVideo();
    if (video) {
      if (progress >= 0.45 && !armedRef.current) {
        armedRef.current = true;
        video.preload = 'auto';
        video.load();
        // iOS ignores preload: a muted inline play+pause decodes frame 0.
        video.play().then(() => {
          if (videoStateRef.current !== 'play') { video.pause(); video.currentTime = 0; }
        }).catch(() => {});
      }
      if (progress >= XFADE_END && !reducedRef.current) setVideoState('play');
      else if (progress < XFADE_END) {
        setVideoState('pause');
        if (progress < XFADE_START - 0.01 && video.currentTime !== 0) video.currentTime = 0; // canvas opaque: invisible reset
      }
    }
  };

  const onActiveChange = (visible: boolean): void => {
    if (!visible) setVideoState('pause');
  };

  const { sectionRef, stickyRef, canvasRef } = useFrameSequence({
    urlsFor,
    pinned: PINNED,
    frameForProgress,
    background: '#050505',
    prefetchMargin: '400% 0px 400% 0px',
    onUpdate,
    onActiveChange,
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section
      ref={sectionRef}
      id="forex-sequence"
      data-nav-tone="dark"
      aria-label="Forex, Stock Market and Opportunity Interactive Scroll Sequence"
      className="relative w-full z-20"
      style={{
        height: `${SCROLL_HEIGHT_VH}vh`,
        marginTop: '-100vh',
        backgroundColor: 'transparent',
      }}
    >
      {/* Sticky cinematic viewport: 720 frames merge directly into the video hero */}
      <div
        ref={stickyRef}
        className="sticky top-0 w-full overflow-hidden select-none z-20"
        style={{
          height: '100dvh',
          backgroundColor: '#050505',
          contain: 'layout paint',
        }}
      >
        {/* Layer 0: The IntelligenceHero with its video plate – blends directly with the last frame */}
        <div
          ref={heroContentRef}
          className="absolute inset-0 z-0"
          style={{ pointerEvents: 'none', visibility: 'hidden' }}
        >
          <IntelligenceHero embedded revealed={revealed} autoPlayVideo={false} videoPreload="none" />
        </div>

        {/* Layer 1: Single canvas – drawing surface for the 720 cinematic frames */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{
            display: 'block',
            imageRendering: 'auto',
            willChange: 'opacity',
          }}
        />


        {/* Layer 3: HUD and Editorial Overlays */}
        <div
          ref={hudContainerRef}
          className="relative z-30 w-full h-full max-w-7xl mx-auto px-5 sm:px-8 md:px-12 lg:px-16 flex flex-col justify-between py-10 md:py-14 pointer-events-none"
          style={{ willChange: 'opacity' }}
        >

          {/* Overlay panels – stacked in a single grid cell to prevent layout shift */}
          <div className="grid grid-cols-1 justify-items-end text-right max-w-xl self-end">

            {/* Forex overlay */}
            <div
              ref={forexOverlayRef}
              className="col-start-1 row-start-1 flex flex-col items-end text-right"
              style={{ opacity: 1, willChange: 'opacity' }}
            >
              <div className="flex items-center gap-2 text-xs font-mono text-[#8C6D23] uppercase tracking-widest mb-3">
                <span>The Global Reserve Market</span>
                <span className="w-6 h-px bg-[#D4AF37]" />
              </div>
              <RevealText as="h2" mode="lines" trigger="scroll"
                className="font-display font-medium leading-[1.08] tracking-tight text-[#0E0F14] text-3xl sm:text-4xl md:text-5xl lg:text-[3.6rem]"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', textShadow: '0 1px 18px rgba(255,255,255,0.6)' }}
              >
                And now, <br className="hidden sm:inline" />
                the global reserve, <br />
                <span className="italic font-normal text-[#B38728]">pure forex.</span>
              </RevealText>
              <p className="mt-4 md:mt-6 text-sm md:text-base font-body text-[#524C42] leading-relaxed max-w-md">
                The foreign exchange market moves $7.5 trillion a day. Where central banks, sovereign wealth funds, and interbank algorithms dictate institutional order flow.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">EUR/USD &bull; MAJOR</span>
                <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">GBP/JPY &bull; CROSS</span>
                <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">XAU/USD &bull; GOLD</span>
              </div>
            </div>

            {/* Stock Market overlay */}
            <div
              ref={stockOverlayRef}
              className="col-start-1 row-start-1 flex flex-col items-end text-right"
              style={{ opacity: 0, willChange: 'opacity' }}
            >
              <div className="flex items-center gap-2 text-xs font-mono text-[#8C6D23] uppercase tracking-widest mb-3">
                <span>The Equity Arena</span>
                <span className="w-6 h-px bg-[#D4AF37]" />
              </div>
              <RevealText as="h2" mode="lines" trigger="scroll"
                className="font-display font-medium leading-[1.08] tracking-tight text-[#0E0F14] text-3xl sm:text-4xl md:text-5xl lg:text-[3.6rem]"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', textShadow: '0 1px 18px rgba(255,255,255,0.6)' }}
              >
                And then, <br className="hidden sm:inline" />
                the market floor, <br />
                <span className="italic font-normal text-[#B38728]">pure stocks.</span>
              </RevealText>
              <p className="mt-4 md:mt-6 text-sm md:text-base font-body text-[#524C42] leading-relaxed max-w-md">
                Equities, indices, and the bull&ndash;bear cycle. Where institutional block orders, earnings catalysts, and central bank policy converge into price action.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">S&amp;P 500 &bull; INDEX</span>
                <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">NASDAQ &bull; INDEX</span>
                <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">GOLD &bull; COMMODITY</span>
              </div>
            </div>

            {/* Opportunity overlay */}
            <div
              ref={opportunityOverlayRef}
              className="col-start-1 row-start-1 flex flex-col items-end text-right"
              style={{ opacity: 0, willChange: 'opacity' }}
            >
              <div className="flex items-center gap-2 text-xs font-mono text-[#8C6D23] uppercase tracking-widest mb-3">
                <span>Where It All Converges</span>
                <span className="w-6 h-px bg-[#D4AF37]" />
              </div>
              <RevealText as="h2" mode="lines" trigger="scroll"
                className="font-display font-medium leading-[1.08] tracking-tight text-[#0E0F14] text-3xl sm:text-4xl md:text-5xl lg:text-[3.6rem]"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h2)', textShadow: '0 1px 18px rgba(255,255,255,0.6)' }}
              >
                This is <br className="hidden sm:inline" />
                your moment, <br />
                <span className="italic font-normal text-[#B38728]">the opportunity.</span>
              </RevealText>
              <p className="mt-4 md:mt-6 text-sm md:text-base font-body text-[#524C42] leading-relaxed max-w-md">
                Every market. Every asset class. Every edge. The complete picture of how institutional capital moves — and how you position yourself inside it.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">STRUCTURE &bull; ORDER FLOW</span>
                <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">RISK &bull; PSYCHOLOGY</span>
                <span className="px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs">EXECUTION &bull; CONSISTENCY</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}

export default ForexMarketScroll;
