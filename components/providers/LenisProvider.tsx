'use client';
import React from 'react';

// ─── Lenis Smooth Scroll Provider ─────────────────────────────────────────────
// Wraps the page in Lenis smooth scrolling, driven by the gsap ticker. Disabled entirely under prefers-reduced-motion.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Lenis from 'lenis';
import { useReducedMotion } from 'framer-motion';
import { onEveryFrame } from '@/lib/frame-loop';
import { ScrollTrigger } from '@/lib/gsap';
import { scrollStore } from '@/lib/scroll-store';

let currentLenis: Lenis | null = null;

/** Lenis instance for non-React code (nav, cursor, particles). */
export function getLenis(): Lenis | null {
  return currentLenis;
}

interface LenisContextValue {
  lenis: Lenis | null;
}

const LenisContext = createContext<LenisContextValue>({ lenis: null });

export function useLenis(): Lenis | null {
  return useContext(LenisContext).lenis;
}

interface LenisProviderProps {
  children: ReactNode;
}

export function LenisProvider({ children }: LenisProviderProps): React.ReactElement {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const prefersReduced = useReducedMotion();

  // Single passive pointer listener feeding the shared store (-1..1).
  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      scrollStore.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      scrollStore.mouseY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useEffect(() => {
    if (prefersReduced) return;

    const instance = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 1,
      syncTouch: false,
      autoRaf: false,
      anchors: { offset: -80 },
    });
    currentLenis = instance;

    instance.on('scroll', ScrollTrigger.update);
    instance.on('scroll', (l: Lenis) => {
      scrollStore.velocity = l.velocity;
      scrollStore.direction = l.direction as 1 | -1 | 0;
    });

    // Lenis runs in the "update" step; ScrollTrigger follows synchronously; sequences run in "render".
    const stop = onEveryFrame((t) => instance.raf(t), 'update');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- publishing external Lenis instance
    setLenis(instance);

    return () => {
      stop();
      if (currentLenis === instance) currentLenis = null;
      scrollStore.velocity = 0;
      scrollStore.direction = 0;
      instance.destroy();
      setLenis(null);
    };
  }, [prefersReduced]);

  const value = useMemo(() => ({ lenis }), [lenis]);

  return (
    <LenisContext.Provider value={value}>
      {children}
    </LenisContext.Provider>
  );
}
