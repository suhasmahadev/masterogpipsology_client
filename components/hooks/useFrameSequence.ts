'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLenis } from '@/components/providers/LenisProvider';
import { onEveryFrame } from '@/lib/frame-loop';
import { FrameSequenceEngine } from '@/lib/frame-sequence/engine';
import { damp, sectionProgress } from '@/lib/frame-sequence/math';
import { detectFrameTier, type FrameSet, type FrameTier } from '@/lib/frame-sequence/sources';

export interface FrameSequenceUpdate {
  progress: number;
  frame: number;
  shownFrame: number;
}

export interface UseFrameSequenceOptions {
  /** Builds the global URL list for a tier. Pass a module-level function. */
  urlsFor: (tier: FrameTier) => FrameSet;
  /** Integer 0..total-1 */
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
}

export interface FrameSequenceRefs {
  sectionRef: RefObject<HTMLElement | null>;
  stickyRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

interface Layout {
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
  const layoutRef = useRef<Layout>({ top: 0, height: 0, viewportH: 0 });
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

    const tier = detectFrameTier();
    const set = optsRef.current.urlsFor(tier);
    const engine = new FrameSequenceEngine({
      urls: set.urls,
      fallbackUrls: set.fallback,
      pinned: optsRef.current.pinned ?? [],
      warm: optsRef.current.warm ?? [],
      expectedSize: set.expected,
      background: optsRef.current.background,
      onFrameReady: (i) => optsRef.current.onFrameReady?.(i),
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
    };

    const currentScroll = (): number => {
      const l = lenisRef.current;
      return l ? l.scroll : nativeScrollRef.current;
    };

    const targetProgress = (): number => {
      const L = layoutRef.current;
      return sectionProgress(currentScroll(), L.top, L.height, L.viewportH);
    };

    const tick = (_ts: number, deltaMs: number): void => {
      const opts = optsRef.current;
      const target = targetProgress();
      const rate = reducedRef.current || lenisRef.current ? 0 : (opts.smoothing ?? 12);
      const p = damp(progressRef.current, target, rate, Math.min(deltaMs / 1000, 0.05));
      progressRef.current = p;
      const frame = opts.frameForProgress(p, engine.total);
      const shown = engine.update(frame);
      opts.onUpdate?.({ progress: p, frame, shownFrame: shown });
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
        } else if (unsub) {
          tick(0, 16); // apply the final 0 or 1 end state
          unsub();
          unsub = null;
          optsRef.current.onActiveChange?.(false);
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
