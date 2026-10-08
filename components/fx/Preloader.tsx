'use client';

// Preloader tied to real load progress (fonts, hero image, first crypto frame).
// Exits when everything is loaded or after a 3.2 s cap. Skipped (short fade) on
// repeat visits in the same tab and under reduced motion. Transform/opacity only.

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { gsap } from '@/lib/gsap';
import { onEveryFrame } from '@/lib/frame-loop';
import { loadProgress } from '@/lib/load-progress';
import { markIntroDone } from '@/lib/intro';

const SESSION_KEY = 'mop-intro';
const MIN_MS = 600;
const MAX_MS = 3200;
const SKIP_MAX_MS = 1200;

if (typeof window !== 'undefined') {
  loadProgress.register('fonts', 0.15);
  const done = (): void => loadProgress.complete('fonts');
  if (document.fonts?.ready) document.fonts.ready.then(done, done);
  else done();
}

export function Preloader(): React.ReactElement | null {
  const [mounted, setMounted] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const logo = logoRef.current;
    const line = lineRef.current;
    if (!panel || !logo || !line) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      /* storage unavailable */
    }
    const skip = reduced || seen;

    let shown = 0;
    let startTs = -1;
    let exiting = false;
    let tl: gsap.core.Timeline | null = null;

    const finish = (): void => {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      markIntroDone();
      setMounted(false);
    };

    const exit = (): void => {
      if (exiting) return;
      exiting = true;
      if (skip) {
        tl = gsap.timeline({ onComplete: finish });
        tl.to(panel, { opacity: 0, duration: reduced ? 0.15 : 0.25, ease: 'none' });
        return;
      }
      line.style.transform = 'scaleX(1)';
      tl = gsap.timeline({ onComplete: finish });
      tl.to(logo, { scale: 0.92, opacity: 0, duration: 0.35, ease: 'power2.in' });
      tl.to(panel, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, '>-0.05');
    };

    const unsub = onEveryFrame((ts) => {
      if (exiting) {
        unsub();
        return;
      }
      if (startTs < 0) startTs = ts;
      const elapsed = ts - startTs;
      const target = loadProgress.progress();
      const next = shown + (target - shown) * 0.15;
      const v = Math.abs(target - next) < 0.001 ? target : next;
      if (v !== shown) {
        shown = v;
        line.style.transform = `scaleX(${shown})`;
      }
      if (skip) {
        if (loadProgress.isDone('hero-image') || elapsed >= SKIP_MAX_MS) exit();
      } else if ((loadProgress.allDone() && elapsed >= MIN_MS) || elapsed >= MAX_MS) {
        exit();
      }
    }, 'render');

    return () => {
      unsub();
      tl?.kill();
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      ref={panelRef}
      className="preloader fixed inset-0 z-[90] flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: '#EFE7DC' }}
      aria-hidden="true"
    >
      <div
        ref={logoRef}
        className="rounded-full overflow-hidden flex items-center justify-center"
        style={{ width: 96, height: 96, border: '1px solid rgba(212,175,55,.6)' }}
      >
        <Image src="/main_logo.png" alt="" width={96} height={96} className="object-contain" priority />
      </div>
      <div style={{ width: 160, height: 1, background: 'rgba(212,175,55,.2)' }}>
        <div
          ref={lineRef}
          style={{
            width: '100%',
            height: '100%',
            background: '#D4AF37',
            transformOrigin: '0 50%',
            transform: 'scaleX(0)',
          }}
        />
      </div>
    </div>
  );
}
