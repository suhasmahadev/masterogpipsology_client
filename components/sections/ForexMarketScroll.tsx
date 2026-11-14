'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFrameSequence, type FrameSequenceUpdate } from '@/components/hooks/useFrameSequence';
import { useStepScroll, type StepScrollOptions } from '@/components/hooks/useStepScroll';
import { IntelligenceHero } from '@/components/sections/IntelligenceHero';
import { DepthStage } from '@/components/sections/DepthStage';
import { HookBox } from '@/components/sections/HookBox';
import type { SlabDriver } from '@/components/motion/useSlabScrub';
import { MARKET_HOOK_IDS, MARKET_HOOK_WINDOWS } from '@/lib/hook-box';
import { MARKET_HOOKS } from '@/lib/content';
import { marketSlabX } from '@/lib/market-slabs';
import { linearFrameMap } from '@/lib/step-scroll';
import { FOREX_CHAIN_STOPS } from '@/lib/forex-rail';
import {
  buildFrameSet,
  warmIndices,
  FRAMES_PER_SEQ,
  SEQ_SCROLL_VH,
  FOREX_OVERLAP_VH,
  UNIQUE_LOCAL,
  UNIQUE_PER_SEQ,
  HANDOFF_POSTER,
  type FrameSet,
  type FrameTier,
} from '@/lib/frame-sequence/sources';
import {
  frameLockRect,
  nativeVideoRect,
  settleTransform,
  smoothstep01,
  type HRect,
  type NativeMode,
} from '@/lib/frame-sequence/handoff';

// ── Tunable constants ────────────────────────────────────────────────────────────────────────
const PER          = UNIQUE_PER_SEQ;              // 192 unique frames per source folder
const TOTAL_FRAMES = PER * 3;                     // 576
// Same pace as Crypto: one folder per SEQ_SCROLL_VH (350vh). Tail length unchanged (was 0.30 x 1400vh).
const FRAME_VH  = 3 * SEQ_SCROLL_VH;              // 1050
const TAIL_VH   = 420;
const RANGE_VH  = FRAME_VH + TAIL_VH;             // 1470
const SCROLL_HEIGHT_VH     = RANGE_VH + 100;      // 1570 (sticky = 100vh)
const FRAME_SCROLL_PORTION = FRAME_VH / RANGE_VH; // 5/7
const at = (vhAfterFrames: number): number => (FRAME_VH + vhAfterFrames) / RANGE_VH;

// Hand-off to the video (see lib/frame-sequence/handoff.ts). Same vh offsets as before (old p x 1400 - 980).
const HUD_FADE_START = at(-28);
const HUD_FADE_LEN   = 70 / RANGE_VH;
const XFADE_START = at(42);  // HUD gone, last frame settled
const XFADE_END   = at(154);
const SETTLE_END  = at(266);
const REVEAL_ON   = at(266);
const REVEAL_OFF  = at(210);
const HANDOFF_TAIL_FRAMES = 72;                   // virtual list frames for the V glide: 2.37 s at the same speed rule
const VIDEO_ARM_FRAME = 342;                      // S2: the video preloads about 6 s of glides before O3

// ── Sequence descriptor ───────────────────────────────────────────────────────────────
type SeqName = 'forex' | 'stock' | 'opportunity';

interface SeqInfo {
  name:     SeqName;
  start:    number;
  frames:   number;
  rawStart: number;
  label:    string;
}

const SEQUENCES: SeqInfo[] = [
  { name: 'forex',       start: 0,       frames: PER, rawStart: 0,   label: 'Asset Class 02 • Foreign Exchange' },
  { name: 'stock',       start: PER,     frames: PER, rawStart: 240, label: 'Asset Class 03 • Stock Market'     },
  { name: 'opportunity', start: 2 * PER, frames: PER, rawStart: 480, label: 'The Opportunity'                        },
];

function resolveSeq(globalIdx: number): { seq: SeqInfo; localIdx: number } {
  for (let s = SEQUENCES.length - 1; s >= 0; s--) {
    if (globalIdx >= SEQUENCES[s].start)
      return { seq: SEQUENCES[s], localIdx: globalIdx - SEQUENCES[s].start };
  }
  return { seq: SEQUENCES[0], localIdx: globalIdx };
}

const urlsFor = (tier: FrameTier): FrameSet =>
  buildFrameSet(['forex', 'stock_market', 'opportunity'], tier, FRAMES_PER_SEQ, UNIQUE_LOCAL);
const FOREX_MAP = linearFrameMap(TOTAL_FRAMES, FRAME_SCROLL_PORTION);
// Stops: forex 1, 64, 111, 194, stock 32, 189, opportunity 97, 216, 240 (chain 0..575). Stop 0 = Y0, shared with Crypto's slab 4 landing.
const FOREX_STEP: StepScrollOptions = {
  stops: FOREX_CHAIN_STOPS,
  total: TOTAL_FRAMES,
  map: FOREX_MAP,
  tail: (l) => l.top + REVEAL_ON * (l.height - l.viewportH), // V: video settled, closing lines in
  tailFrames: HANDOFF_TAIL_FRAMES,                           // 72 -> 2.37 s at the same speed rule
  autoAdvance: FOREX_CHAIN_STOPS.length - 1,                 // O3 (last frame) -> V after the 0.45 s hold
};
const PINNED: readonly number[] = [...FOREX_CHAIN_STOPS, TOTAL_FRAMES - 1]; // landing frames fetched first, never evicted
const FOREX_WARM = warmIndices(PER);
// Tilt reaches exactly 0 before the doorway dissolve starts, so the last frame matches the video lock.
const TILT_EASE = [at(-140), at(0)] as const;
// Folder joins (forex -> stock_market -> opportunity) are separate shots: never cross-blend them.
const FOLDER_CUTS = [PER - 1, 2 * PER - 1] as const;

// ── Component ────────────────────────────────────────────────────────────────
export function ForexMarketScroll(): React.ReactElement {
  const step = useStepScroll(FOREX_STEP);
  // Fractional: the engine blends the two neighbouring frames; at rest on a stop it is exactly the stop frame.
  const frameForProgress = useCallback((p: number): number => step.frameFor(FOREX_MAP.pos(p)), [step]);
  // Transition layers
  const heroContentRef  = useRef<HTMLDivElement>(null);
  const hudContainerRef = useRef<HTMLDivElement>(null);
  const videoRef        = useRef<HTMLVideoElement | null>(null);
  const videoStateRef   = useRef<'play' | 'pause'>('pause');
  const armedRef        = useRef<boolean>(false);
  const framesFetchedRef = useRef(false);

  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);
  const reducedRef  = useRef(false);
  const progressRef = useRef(0);
  const slabRef: SlabDriver = useRef(null);
  const shadeElRef  = useRef<HTMLElement | null>(null);
  const geomRef     = useRef<{ native: HRect; lock: HRect } | null>(null);

  // HUD and overlay refs
  const hudLabelRef    = useRef<HTMLSpanElement>(null);
  const hudFrameRef    = useRef<HTMLSpanElement>(null);
  const hudTotalRef    = useRef<HTMLSpanElement>(null);
  const hudProgressRef = useRef<HTMLDivElement>(null);

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

  const onUpdate = ({ progress, frame, scroll }: FrameSequenceUpdate): void => {
    progressRef.current = progress;
    const s = step.coord(scroll);
    const { seq, localIdx } = resolveSeq(frame);
    const rawLocal = UNIQUE_LOCAL[localIdx];

    // ── HUD text ──────────────────────────────────────────────────────────
    put('hudFrame', String(rawLocal + 1).padStart(3, '0'), (v) => { if (hudFrameRef.current) hudFrameRef.current.textContent = v; });
    put('hudTotal', String(FRAMES_PER_SEQ), (v) => { if (hudTotalRef.current) hudTotalRef.current.textContent = v; });
    put('hudLabel', seq.label, (v) => { if (hudLabelRef.current) hudLabelRef.current.textContent = v; });
    const hp = rawLocal / (FRAMES_PER_SEQ - 1);
    put('hudScale', hp.toFixed(3), (v) => { if (hudProgressRef.current) hudProgressRef.current.style.transform = `scaleX(${v})`; });

    // Fade entire HUD out cleanly as doorway frame settles
    let hudMasterOp = 1;
    if (progress > HUD_FADE_START) {
      hudMasterOp = Math.max(0, 1 - (progress - HUD_FADE_START) / HUD_FADE_LEN);
    }

    slabRef.current?.(marketSlabX(s));
    put('hudOp', hudMasterOp.toFixed(3), (v) => { if (hudContainerRef.current) hudContainerRef.current.style.opacity = v; });

    // ── Doorway-to-video dissolve (opacity only), settle (transform), reveal ──
    const canvas = canvasRef.current;
    const heroContent = heroContentRef.current;
    if (canvas && heroContent) {
      const e = smoothstep01(XFADE_START, XFADE_END, progress);
      put('opacity', (1 - e).toFixed(3), (v) => { canvas.style.opacity = v; });
      put('cvis', e >= 1 ? 'hidden' : 'visible', (v) => { canvas.style.visibility = v; });
      put('vis', progress >= FRAME_SCROLL_PORTION ? 'visible' : 'hidden', (v) => { heroContent.style.visibility = v; });
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
      if (!armedRef.current && (frame >= VIDEO_ARM_FRAME || (framesFetchedRef.current && frame >= PER))) {
        armedRef.current = true;
        video.preload = 'auto';
        video.load();
        // iOS ignores preload: a muted inline play+pause decodes frame 0.
        video.play().then(() => {
          if (videoStateRef.current !== 'play') { video.pause(); video.currentTime = 0; }
        }).catch(() => {});
      }
      if (progress >= XFADE_START && !reducedRef.current) setVideoState('play');
      else if (progress < XFADE_START) {
        setVideoState('pause');
        if (video.currentTime !== 0) video.currentTime = 0; // canvas opaque below XFADE_START: invisible reset
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
    warm: FOREX_WARM,
    fetchHorizon: PER,
    cuts: FOLDER_CUTS,
    onAllFetched: () => { framesFetchedRef.current = true; },
    background: '#050505',
    prefetchMargin: '400% 0px 400% 0px',
    onLayout: step.onLayout,
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
        marginTop: `-${FOREX_OVERLAP_VH}vh`,
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
          touchAction: 'pan-y pinch-zoom',
        }}
      >
        {/* Layer 0: The IntelligenceHero with its video plate – blends directly with the last frame */}
        <div
          ref={heroContentRef}
          className="absolute inset-0 z-0"
          style={{ pointerEvents: 'none', visibility: 'hidden' }}
        >
          <IntelligenceHero embedded revealed={revealed} autoPlayVideo={false} videoPreload="none" poster={HANDOFF_POSTER} />
        </div>

        {/* Layer 1: Single canvas – drawing surface for the 720 cinematic frames */}
        <DepthStage progressRef={progressRef} easeOut={TILT_EASE} zIndex={10}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              display: 'block',
              imageRendering: 'auto',
              willChange: 'opacity',
            }}
          />
        </DepthStage>

        {/* Layer 3: HUD and Editorial Overlays */}
        <div
          ref={hudContainerRef}
          className="relative z-30 w-full h-full max-w-7xl mx-auto px-5 sm:px-8 md:px-12 lg:px-16 flex flex-col justify-between py-10 md:py-14 pointer-events-none"
          style={{ willChange: 'opacity' }}
        >

          {/* Overlay panels – stacked in a single grid cell to prevent layout shift */}
          <div className="grid grid-cols-1 justify-items-end text-right max-w-xl self-end">

            {/* Hook box: one hook per stop (Y0, F1-F3, S1, S2, O1, O2), ticker roll, fades with the HUD before the video */}
            <HookBox variant="market" ids={MARKET_HOOK_IDS} windows={MARKET_HOOK_WINDOWS} hooks={MARKET_HOOKS} driverRef={slabRef} />

          </div>

        </div>
      </div>
    </section>
  );
}

export default ForexMarketScroll;
