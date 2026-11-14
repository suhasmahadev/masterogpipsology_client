'use client';

import React, { useEffect, useRef } from 'react';
import { onEveryFrame } from '@/lib/frame-loop';
import { scrollStore } from '@/lib/scroll-store';
import { sessionFrameTier } from '@/lib/frame-sequence/sources';
import { smoothstep01 } from '@/lib/frame-sequence/handoff';

const MAX_TILT = 4;      // deg, hard cap
const COVER_SCALE = 0.07; // extra scale at full tilt so edges never show
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

interface DepthStageProps {
  /** Latest section scroll progress 0..1, written by the owner's onUpdate. */
  progressRef: React.RefObject<number>;
  /** Tilt eases to 0 between these progress values (hand-off alignment). Omit for always on. */
  easeOut?: readonly [number, number];
  zIndex: number;
  /** The frame canvas. */
  children: React.ReactNode;
}

/**
 * Perspective wrapper that gives the flat frame sequence a 3D read: scroll/velocity/pointer driven
 * tilt + push-in on the canvas wrapper, plus two cheap layers (edge-light vignette and specular sheen)
 * that parallax against the tilt. Transform/opacity only, one shared-ticker callback, no React state.
 */
export function DepthStage({ progressRef, easeOut, zIndex, children }: DepthStageProps): React.ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const vigRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const wrap = wrapRef.current;
    const vig = vigRef.current;
    const sheen = sheenRef.current;
    if (!host || !wrap || !vig || !sheen) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (sessionFrameTier() !== 'full') return;
    const fine = window.matchMedia('(pointer: fine)').matches;

    let visible = false;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '10% 0px' });
    io.observe(host);

    const s = { rx: 0, ry: 0, z: 0, k: 1, o: 0 };
    const lastStr = { w: '', v: '', s: '', vo: '', so: '' };

    const off = onEveryFrame((_ts, deltaMs) => {
      if (!visible || document.hidden) return;
      const p = progressRef.current ?? 0;
      const f = easeOut ? 1 - smoothstep01(easeOut[0], easeOut[1], p) : 1;
      const vel = clamp(scrollStore.velocity / 60, -1, 1);
      const mx = fine ? scrollStore.mouseX : 0;
      const my = fine ? scrollStore.mouseY : 0;

      const tRx = clamp(-my * 1.6 + vel * 1.4 + Math.sin(p * Math.PI * 6) * 0.9, -MAX_TILT, MAX_TILT) * f;
      const tRy = clamp(mx * 2.2 + Math.cos(p * Math.PI * 4) * 1.2, -MAX_TILT, MAX_TILT) * f;
      const tZ = (30 + p * 40 + Math.abs(vel) * 30) * f;
      const tK = 1 + COVER_SCALE * f;

      const a = 1 - Math.exp(-Math.min(deltaMs, 64) / 140);
      // Hand-off ease is applied directly (not lagged) so it is exactly 0 where alignment matters.
      s.rx += (tRx - s.rx) * a; s.ry += (tRy - s.ry) * a;
      s.z += (tZ - s.z) * a;
      s.k += (tK - s.k) * a;
      s.o += (f - s.o) * a;
      if (f === 0) { s.rx = 0; s.ry = 0; s.z = 0; s.k = 1; s.o = 0; }

      const w = `translateZ(${s.z.toFixed(1)}px) rotateX(${s.rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg) scale(${s.k.toFixed(4)})`;
      if (w !== lastStr.w) { lastStr.w = w; wrap.style.transform = w; }
      const v = `translate3d(${(s.ry * -6).toFixed(1)}px,${(s.rx * 6).toFixed(1)}px,0)`;
      if (v !== lastStr.v) { lastStr.v = v; vig.style.transform = v; }
      const sh = `translate3d(${(s.ry * 40).toFixed(1)}px,${(-s.rx * 30).toFixed(1)}px,0)`;
      if (sh !== lastStr.s) { lastStr.s = sh; sheen.style.transform = sh; }
      const vo = (s.o * 0.9).toFixed(3);
      if (vo !== lastStr.vo) { lastStr.vo = vo; vig.style.opacity = vo; }
      const so = (s.o * clamp(0.35 + Math.abs(s.ry) / MAX_TILT * 0.65, 0, 1)).toFixed(3);
      if (so !== lastStr.so) { lastStr.so = so; sheen.style.opacity = so; }
    }, 'render');

    return () => { off(); io.disconnect(); };
  }, [progressRef, easeOut]);

  return (
    <>
      <div
        ref={hostRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex, perspective: '1200px', perspectiveOrigin: '50% 50%' }}
      >
        <div ref={wrapRef} className="absolute inset-0" style={{ transformOrigin: '50% 50%', willChange: 'transform' }}>
          {children}
        </div>
      </div>
      <div
        ref={vigRef}
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          zIndex: zIndex + 1, inset: '-4%', opacity: 0, willChange: 'transform, opacity',
          background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(10,8,4,0.22) 100%)',
        }}
      />
      <div
        ref={sheenRef}
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          zIndex: zIndex + 1, inset: '-10%', opacity: 0, willChange: 'transform, opacity',
          background: 'linear-gradient(115deg, rgba(255,255,255,0) 38%, rgba(255,246,222,0.10) 50%, rgba(255,255,255,0) 62%)',
        }}
      />
    </>
  );
}
