'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLenis } from '@/components/providers/LenisProvider';
import { onEveryFrame } from '@/lib/frame-loop';
import { FrameSequenceEngine } from '@/lib/frame-sequence/engine';
import { damp, sectionProgress } from '@/lib/frame-sequence/math';
import { hudActive, hudTick } from '@/components/debug/FrameDebugHud'; // TEMP debug HUD
import { UNIQUE_LOCAL, pinFrameClass, sessionFrameTier, type FrameSet, type FrameTier } from '@/lib/frame-sequence/sources'; // UNIQUE_LOCAL: TEMP debug HUD

const HUD_TIER: Record<FrameTier, string> = { full: 'full (JPEG 1920x1080)', lite: 'lite (WebP 1280x720)', portrait: 'portrait (WebP 864x1080 centre crop)' }; // TEMP debug HUD

export interface FrameSequenceUpdate {
  progress: number;
  frame: number;
  shownFrame: number;
  /** Fractional frame position requested this tick. */
  pos: number;
  /** Scroll offset used this tick. */
  scroll: number;
}

export interface UseFrameSequenceOptions {
  /** Builds the global URL list for a tier. Pass a module-level function. */
  urlsFor: (tier: FrameTier) => FrameSet;
  /** Fractional frame position 0..total-1 (must reach exactly total-1 at the end). The engine blends floor(pos) and floor(pos)+1. */
  frameForProgress: (progress: number, total: number) => number;
  /** Global indices fetched first and never evicted. */
  pinned?: readonly number[];
  /** Global indices fetched right after pinned, before the full fetch. */
  warm?: readonly number[];
  background: string;
  /** Damping rate, used ONLY when Lenis is inactive and motion is allowed. Default 12. */
  smoothing?: number;
  /** Every rendered tick while visible. Must guard its own DOM writes. */
  onUpdate?: (u: FrameSequenceUpdate) => void;
  onActiveChange?: (visible: boolean) => void;
  prefetchMargin?: string;
  decodeMargin?: string;
  /** Fired after a frame (global index) is decoded. */
  onFrameReady?: (index: number) => void;
  /** Frames within this distance of the current frame are fetched strictly nearest-first. Engine default 24. */
  nearWindow?: number;
  /** Frames further than this from the current frame are fetched last (e.g. one source folder). */
  fetchHorizon?: number;
  /** Fired once when every frame has been fetched. */
  onAllFetched?: () => void;
  /** Indices i where frame i -> i+1 is a hard cut (e.g. joins of source folders). Never blended across. */
  cuts?: readonly number[];
  /** Called after every layout measure (mount, resize). */
  onLayout?: (layout: Readonly<SequenceLayout>) => void;
}

export interface FrameSequenceRefs {
  sectionRef: RefObject<HTMLElement | null>;
  stickyRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export interface SequenceLayout {
  top: number;
  height: number;
  viewportH: number;
}

export function useFrameSequence(options: UseFrameSequenceOptions): FrameSequenceRefs {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const optsRef = useRef<UseFrameSequenceOptions>(options);
  const lenisRef = useRef<ReturnType<typeof useLenis>>(null);
  const nativeScrollRef = useRef(0);
  const reducedRef = useRef(false);
  const layoutRef = useRef<SequenceLayout>({ top: 0, height: 0, viewportH: 0 });
  const progressRef = useRef(0);

  const lenis = useLenis();

  // Re-create the engine when the viewport flips between portrait and landscape (tier change).
  const [tierEpoch, setTierEpoch] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia('(max-aspect-ratio: 4/5)');
    const on = (): void => setTierEpoch((e) => e + 1);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    optsRef.current = options;
  });

  // Scroll source: Lenis when active, otherwise a cached native scrollY (no layout read per tick).
  useEffect(() => {
    lenisRef.current = lenis;
    if (lenis) return;
    nativeScrollRef.current = window.scrollY;
    const onScroll = (): void => {
      nativeScrollRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [lenis]);

  useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const canvas = canvasRef.current;
    if (!section || !sticky || !canvas) return;

    const tier = sessionFrameTier();
    const set = optsRef.current.urlsFor(tier);
    const engine = new FrameSequenceEngine({
      urls: set.urls,
      fallbackUrls: set.fallback,
      pinned: optsRef.current.pinned ?? [],
      warm: optsRef.current.warm ?? [],
      expectedSize: set.expected,
      background: optsRef.current.background,
      onFrameReady: (i) => optsRef.current.onFrameReady?.(i),
      nearWindow: optsRef.current.nearWindow,
      fetchHorizon: optsRef.current.fetchHorizon,
      onAllFetched: () => optsRef.current.onAllFetched?.(),
      cuts: optsRef.current.cuts,
      onWholeSetFallback: () => pinFrameClass('full'),
    });
    engine.attachCanvas(canvas);

    // Reduced motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = mq.matches;
    const onMq = (e: MediaQueryListEvent): void => {
      reducedRef.current = e.matches;
    };
    mq.addEventListener('change', onMq);

    // The only layout read in the hook.
    const measure = (): void => {
      const rect = section.getBoundingClientRect();
      const layout = layoutRef.current;
      layout.top = rect.top + window.scrollY;
      layout.height = rect.height;
      layout.viewportH = sticky.clientHeight;
      engine.resize(sticky.clientWidth, sticky.clientHeight, window.devicePixelRatio || 1);
      optsRef.current.onLayout?.(layout);
    };

    const currentScroll = (): number => {
      const l = lenisRef.current;
      return l ? l.scroll : nativeScrollRef.current;
    };

    const targetProgress = (): number => {
      const L = layoutRef.current;
      return sectionProgress(currentScroll(), L.top, L.height, L.viewportH);
    };

    // TEMP debug HUD: names derived from the URL list, no component wiring needed.
    const hudSeqs = set.urls.map((u) => /\/(crypto|forex|stock_market|opportunity)\//.exec(u)?.[1] ?? '');
    const hudName = hudSeqs[0] === 'crypto' ? 'Crypto' : 'Forex'; // TEMP debug HUD
    const hudOn = process.env.NODE_ENV === 'development'; // TEMP debug HUD
    const hudSample = (shown: number, pos: number, p: number): Parameters<typeof hudTick>[0] => { // TEMP debug HUD
      const locals = UNIQUE_LOCAL; // TEMP debug HUD
      const per = hudName === 'Forex' ? engine.total / 3 : engine.total; // TEMP debug HUD
      const listIdx = shown % per; // TEMP debug HUD
      return { // TEMP debug HUD
        seq: hudName, shown, total: engine.total, pos, progress: p, folder: hudSeqs[shown] || hudName.toLowerCase(), // TEMP debug HUD
        raw: (locals[listIdx] ?? listIdx) + 1, rawTotal: 240, listIdx, listTotal: per, // TEMP debug HUD
        ended: hudName === 'Forex' && pos >= engine.total - 1, // TEMP debug HUD
        file: engine.urlOf(shown).split('/').pop() ?? '', // TEMP debug HUD
        tier: HUD_TIER[tier], // TEMP debug HUD
        fallback: engine.isUsingFallback() ? 'whole set JPEG fallback' : (tier !== 'full' && /\.jpg$/.test(engine.urlOf(shown)) ? 'per-frame JPEG fallback' : ''), // TEMP debug HUD
      }; // TEMP debug HUD
    };

    const tick = (_ts: number, deltaMs: number): void => {
      const opts = optsRef.current;
      const scroll = currentScroll();
      const L = layoutRef.current;
      const target = sectionProgress(scroll, L.top, L.height, L.viewportH);
      engine.setActive(target > 0 && target < 1);
      const rate = reducedRef.current || lenisRef.current ? 0 : (opts.smoothing ?? 12);
      const p = damp(progressRef.current, target, rate, Math.min(deltaMs / 1000, 0.05));
      progressRef.current = p;
      const pos = opts.frameForProgress(p, engine.total);
      const frame = Math.min(engine.total - 1, Math.max(0, Math.round(pos)));
      // Reduced motion: whole frames, no cross-blend.
      const shown = engine.update(reducedRef.current ? frame : pos);
      opts.onUpdate?.({ progress: p, frame, shownFrame: shown, pos, scroll });
      if (hudOn) hudTick(hudSample(shown, pos, p)); // TEMP debug HUD
    };

    let unsub: (() => void) | null = null;

    const ro = new ResizeObserver(measure);
    ro.observe(section);
    ro.observe(sticky);
    ro.observe(document.body);
    measure();

    const prefetchIO = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          engine.setFullFetch(true);
          prefetchIO.disconnect();
        }
      },
      { rootMargin: optsRef.current.prefetchMargin ?? '200% 0px 200% 0px' },
    );
    prefetchIO.observe(section);

    const decodeIO = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) engine.setDecodeEnabled(last.isIntersecting);
      },
      { rootMargin: optsRef.current.decodeMargin ?? '100% 0px 100% 0px' },
    );
    decodeIO.observe(section);

    const activeIO = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (!last) return;
        if (last.isIntersecting) {
          if (unsub) return;
          progressRef.current = targetProgress(); // snap: no catch-up from a stale value
          unsub = onEveryFrame(tick, 'render');
          tick(0, 16);
          optsRef.current.onActiveChange?.(true);
          hudActive(hudName, true); // TEMP debug HUD
        } else if (unsub) {
          tick(0, 16); // apply the final 0 or 1 end state
          unsub();
          unsub = null;
          optsRef.current.onActiveChange?.(false);
          hudActive(hudName, false); // TEMP debug HUD
        }
      },
      { rootMargin: '0px' },
    );
    activeIO.observe(section);

    // No requests or decodes while the tab is hidden.
    const onVis = (): void => engine.setPaused(document.hidden);
    onVis();
    document.addEventListener('visibilitychange', onVis);

    // Keep frame requests behind the hero LCP.
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => engine.start(), { timeout: 500 });
    } else {
      timeoutId = setTimeout(() => engine.start(), 200);
    }

    return () => {
      if (unsub) {
        unsub();
        unsub = null;
      }
      ro.disconnect();
      prefetchIO.disconnect();
      decodeIO.disconnect();
      activeIO.disconnect();
      mq.removeEventListener('change', onMq);
      document.removeEventListener('visibilitychange', onVis);
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) clearTimeout(timeoutId);
      engine.destroy();
    };
  }, [tierEpoch]);

  return { sectionRef, stickyRef, canvasRef };
}
