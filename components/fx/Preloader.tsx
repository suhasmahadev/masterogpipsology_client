'use client';

// ─── Enhanced Preloader ────────────────────────────────────────────────────────
// Waits for: fonts (ready + specific faces), all images decoded, Lenis first tick.
// Real progress bar (loaded ÷ total). Min 900ms display, 15s safety timeout.
// Gold line-wipe exit, then panel slide. Skips animation on reduced-motion.
// Scroll locked (body overflow:hidden + Lenis.stop) until fully exited.
// Only transform + opacity animate.

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { gsap } from '@/lib/gsap';
import { onEveryFrame } from '@/lib/frame-loop';
import { loadProgress } from '@/lib/load-progress';
import { markIntroDone } from '@/lib/intro';
import { getLenis } from '@/components/providers/LenisProvider';

const SESSION_KEY = 'mop-intro';
const MIN_MS = 900;
const SAFETY_MS = 15_000;
const SKIP_MAX_MS = 1200;

// ─── Font loading ─────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  loadProgress.register('fonts', 0.15);

  const loadFonts = async (): Promise<void> => {
    try {
      // Wait for the browser's general fonts-ready promise
      await document.fonts.ready;
      // Also explicitly load the two faces actually used in the loader UI
      await Promise.allSettled([
        document.fonts.load('600 1rem Manrope'),
        document.fonts.load('500 1rem "Cormorant Garamond"'),
      ]);
    } catch {
      /* fonts unavailable — count as done */
    }
    loadProgress.complete('fonts');
  };

  void loadFonts();
}

// ─── Eagerly preload all images (including lazy ones) ─────────────────────────
// Called once by the Preloader on mount, before the progress loop starts.
// Each image counts as a task with equal weight unless already registered
// (e.g. hero-image is registered by Hero.tsx with weight 0.45).
function preloadAllImages(registered: Set<string>): void {
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img'));
  imgs.forEach((img, i) => {
    const id = img.id || img.src || `img-${i}`;
    if (registered.has(id)) return;
    registered.add(id);

    // Override loading so the browser fetches it now
    if (img.loading === 'lazy') img.loading = 'eager';

    loadProgress.register(id, 0.4 / Math.max(imgs.length, 1));

    const markDone = (): void => {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => loadProgress.complete(id))
          .catch(() => loadProgress.complete(id)); // failed = counts as done
      } else {
        loadProgress.complete(id);
      }
    };

    if (img.complete && img.naturalWidth > 0) {
      markDone();
    } else {
      img.addEventListener('load', markDone, { once: true });
      img.addEventListener('error', () => loadProgress.complete(id), { once: true });
    }
  });
}

export function Preloader(): React.ReactElement | null {
  const [mounted, setMounted] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const wipeRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const logo = logoRef.current;
    const wipe = wipeRef.current;
    const line = lineRef.current;
    const pctEl = pctRef.current;
    if (!panel || !logo || !wipe || !line || !pctEl) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      /* storage unavailable */
    }
    const skip = reduced || seen;

    // Lock scroll immediately
    document.body.style.overflow = 'hidden';
    getLenis()?.stop();

    // Eagerly preload all images
    const registered = new Set<string>(['fonts', 'hero-image']);
    preloadAllImages(registered);

    // Wait for Lenis first RAF tick
    loadProgress.register('lenis-tick', 0.05);
    const firstTickUnsub = onEveryFrame(() => {
      loadProgress.complete('lenis-tick');
      firstTickUnsub();
    }, 'update');

    let shown = 0;
    let startTs = -1;
    let exiting = false;
    let tl: gsap.core.Timeline | null = null;

    const unlock = (): void => {
      document.body.style.overflow = '';
      getLenis()?.start();
    };

    const finish = (): void => {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      unlock();
      markIntroDone();
      setMounted(false);
    };

    const exit = (): void => {
      if (exiting) return;
      exiting = true;

      // Always fill the bar to 100% before exiting
      line.style.transform = 'scaleX(1)';
      pctEl.textContent = '100';

      if (skip) {
        tl = gsap.timeline({ onComplete: finish });
        tl.to(panel, { opacity: 0, duration: reduced ? 0.15 : 0.25, ease: 'none' });
        return;
      }

      // Gold line wipe across the panel, then slide panel away
      tl = gsap.timeline({ onComplete: finish });
      tl.fromTo(
        wipe,
        { scaleX: 0, opacity: 1 },
        { scaleX: 1, duration: 0.5, ease: 'expo.inOut', transformOrigin: '0 50%' },
      );
      tl.to(logo, { scale: 0.9, opacity: 0, duration: 0.3, ease: 'power2.in' }, '<');
      tl.to(panel, { yPercent: -100, duration: 0.7, ease: 'expo.inOut' }, '>-0.05');
    };

    // Safety timeout — after 15s, proceed regardless of missing assets
    const safetyTimer = setTimeout(() => {
      console.warn('[Preloader] Safety timeout reached. Proceeding despite incomplete assets.');
      exit();
    }, SAFETY_MS);

    const unsub = onEveryFrame((ts) => {
      if (exiting) {
        unsub();
        return;
      }
      if (startTs < 0) startTs = ts;
      const elapsed = ts - startTs;

      const target = loadProgress.progress();
      const next = shown + (target - shown) * 0.12;
      const v = Math.abs(target - next) < 0.001 ? target : next;
      if (v !== shown) {
        shown = v;
        line.style.transform = `scaleX(${shown})`;
        pctEl.textContent = String(Math.round(shown * 100));
      }

      if (skip) {
        if (loadProgress.isDone('hero-image') || elapsed >= SKIP_MAX_MS) {
          clearTimeout(safetyTimer);
          exit();
        }
      } else if ((loadProgress.allDone() && elapsed >= MIN_MS) || elapsed >= SAFETY_MS) {
        clearTimeout(safetyTimer);
        exit();
      }
    }, 'render');

    return () => {
      unsub();
      firstTickUnsub();
      clearTimeout(safetyTimer);
      tl?.kill();
      unlock();
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      ref={panelRef}
      className="preloader fixed inset-0 z-[90] flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: '#0E0F12' }}
      aria-hidden="true"
    >
      {/* Logo mark */}
      <div
        ref={logoRef}
        className="rounded-full overflow-hidden flex items-center justify-center"
        style={{
          width: 80,
          height: 80,
          border: '1px solid rgba(195,162,104,0.55)',
          boxShadow: '0 0 32px rgba(195,162,104,0.15)',
        }}
      >
        <Image src="/main_logo.png" alt="" width={80} height={80} className="object-contain" priority />
      </div>

      {/* Progress bar track */}
      <div
        style={{
          width: 160,
          height: 1,
          background: 'rgba(195,162,104,0.18)',
          position: 'relative',
        }}
      >
        <div
          ref={lineRef}
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #9A7539, #E0C38A 50%, #C3A268)',
            transformOrigin: '0 50%',
            transform: 'scaleX(0)',
          }}
        />
      </div>

      {/* Percentage */}
      <span
        ref={pctRef}
        style={{
          fontFamily: 'var(--font-sans-body), Manrope, system-ui, sans-serif',
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.14em',
          color: 'rgba(195,162,104,0.7)',
        }}
      >
        0
      </span>

      {/* Gold wipe overlay (exits behind the panel as it slides away) */}
      <div
        ref={wipeRef}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, #9A7539 0%, #C3A268 50%, #E0C38A 100%)',
          transformOrigin: '0 50%',
          transform: 'scaleX(0)',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    </div>
  );
}
