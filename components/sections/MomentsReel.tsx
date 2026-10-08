'use client';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';

// ─── MomentsReel: swipeable card stack ────────────────────────────────────────
// Real GALLERY_MOMENTS photos as a stack. Drag/swipe the top card (pointer events),
// or use the buttons / arrow keys. Transform + opacity only, driven by GSAP.

import { GALLERY_MOMENTS } from '@/lib/content';
import { gsap } from '@/lib/gsap';

const N = GALLERY_MOMENTS.length;
const VISIBLE = 4; // depths 0..3 are mounted; depth 3 is hidden (preloads next-next)

const POSES = [
  { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
  { x: 0, y: 16, scale: 0.94, rotation: 3, opacity: 0.92 },
  { x: 0, y: 32, scale: 0.88, rotation: -3, opacity: 0.75 },
  { x: 0, y: 32, scale: 0.88, rotation: -3, opacity: 0 },
] as const;

const chipStyle: React.CSSProperties = {
  color: '#D4AF37',
  border: '1px solid rgba(212,175,55,0.3)',
  backgroundColor: 'rgba(212,175,55,0.08)',
};

function reduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function MomentsReel(): React.ReactElement {
  const [index, setIndex] = useState(0);
  const stackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const busy = useRef(false);
  const enterFrom = useRef<number>(0); // -1: previous card should slide in from the left
  const drag = useRef<{ id: number; x0: number; y0: number; t0: number; dx: number } | null>(null);

  const depthOf = useCallback((i: number, base: number) => (i - base + N) % N, []);

  // Apply poses whenever the index changes (instant, except for a "previous" entrance).
  useLayoutEffect(() => {
    const from = enterFrom.current;
    enterFrom.current = 0;
    const w = stackRef.current?.offsetWidth ?? 600;
    GALLERY_MOMENTS.forEach((m, i) => {
      const el = cardRefs.current.get(m.id);
      if (!el) return;
      const d = depthOf(i, index);
      if (d >= VISIBLE) return;
      if (from < 0 && !reduced()) {
        if (d === 0) {
          busy.current = true;
          gsap.fromTo(
            el,
            { x: -w * 1.2, rotation: -14, opacity: 0, y: 0, scale: 1 },
            { ...POSES[0], duration: 0.5, ease: 'power3.out', onComplete: () => { busy.current = false; } },
          );
        } else {
          gsap.to(el, { ...POSES[d], duration: 0.5, ease: 'power3.out' });
        }
      } else {
        gsap.killTweensOf(el);
        gsap.set(el, POSES[d]);
      }
    });
  }, [index, depthOf]);

  const fly = useCallback(
    (dir: 1 | -1, fromDx = 0) => {
      if (busy.current) return;
      const top = cardRefs.current.get(GALLERY_MOMENTS[index].id);
      if (!top) return;
      const next = (index + 1) % N;
      if (reduced()) {
        setIndex(next);
        return;
      }
      busy.current = true;
      const w = stackRef.current?.offsetWidth ?? 600;
      // dir: -1 = fly left, +1 = fly right
      gsap.to(top, {
        x: fromDx + dir * w * 1.3,
        rotation: dir * 18,
        opacity: 0,
        duration: 0.45,
        ease: 'power2.in',
        onComplete: () => {
          busy.current = false;
          setIndex(next);
        },
      });
      [1, 2].forEach((d) => {
        const el = cardRefs.current.get(GALLERY_MOMENTS[(index + d) % N].id);
        if (el) gsap.to(el, { ...POSES[d - 1], duration: 0.45, ease: 'power3.out' });
      });
    },
    [index],
  );

  const prev = useCallback(() => {
    if (busy.current) return;
    enterFrom.current = -1;
    setIndex((i) => (i - 1 + N) % N);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>): void => {
    if (busy.current || drag.current) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), dx: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    const top = cardRefs.current.get(GALLERY_MOMENTS[index].id);
    if (top) gsap.killTweensOf(top);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>): void => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dx = e.clientX - d.x0;
    const top = cardRefs.current.get(GALLERY_MOMENTS[index].id);
    if (top) gsap.set(top, { x: d.dx, rotation: d.dx * 0.05 });
  };

  const endDrag = (e: React.PointerEvent<HTMLElement>, cancelled: boolean): void => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const w = stackRef.current?.offsetWidth ?? 600;
    const dt = Math.max(1, performance.now() - d.t0);
    const v = d.dx / dt; // px per ms
    const top = cardRefs.current.get(GALLERY_MOMENTS[index].id);
    if (!cancelled && (Math.abs(d.dx) > w * 0.25 || Math.abs(v) > 0.5) && d.dx !== 0) {
      fly(d.dx > 0 ? 1 : -1, d.dx);
    } else if (top) {
      if (reduced()) gsap.set(top, POSES[0]);
      else gsap.to(top, { ...POSES[0], duration: 0.6, ease: 'elastic.out(1, 0.6)' });
    }
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      fly(-1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    }
  };

  const pad = (n: number): string => String(n).padStart(2, '0');

  return (
    <section
      id="moments"
      aria-labelledby="moments-eyebrow"
      className="relative py-20 md:py-28 overflow-hidden"
    >
      <div className="px-4 md:px-8 lg:px-16 max-w-7xl w-full mx-auto flex items-center gap-3 mb-10">
        <span id="moments-eyebrow" className="label-caps" style={{ color: '#D4AF37' }}>
          Trading Floor &amp; Moments
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,175,55,0.25)' }} aria-hidden="true" />
      </div>

      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Trading Floor & Moments"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex flex-col items-center gap-8 outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF37]/50 rounded-xl"
      >
        <div
          ref={stackRef}
          className="relative w-[88vw] md:w-[min(560px,40vw)] aspect-[4/5] mb-10"
        >
          {GALLERY_MOMENTS.map((moment, i) => {
            const d = depthOf(i, index);
            if (d >= VISIBLE) return null;
            const top = d === 0;
            return (
              <figure
                key={moment.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(moment.id, el);
                  else cardRefs.current.delete(moment.id);
                }}
                aria-hidden={top ? undefined : true}
                onPointerDown={top ? onPointerDown : undefined}
                onPointerMove={top ? onPointerMove : undefined}
                onPointerUp={top ? (e) => endDrag(e, false) : undefined}
                onPointerCancel={top ? (e) => endDrag(e, true) : undefined}
                className="moment-frame absolute inset-0 overflow-hidden rounded-xl will-change-transform select-none"
                style={{
                  zIndex: VISIBLE - d,
                  touchAction: 'pan-y',
                  cursor: top ? 'grab' : 'default',
                  pointerEvents: top ? 'auto' : 'none',
                  opacity: POSES[d].opacity,
                  transform: `translate3d(0,${POSES[d].y}px,0) rotate(${POSES[d].rotation}deg) scale(${POSES[d].scale})`,
                }}
              >
                <Image
                  src={moment.image}
                  alt={moment.title}
                  fill
                  loading="lazy"
                  draggable={false}
                  sizes="(max-width: 768px) 88vw, 560px"
                  className="object-cover pointer-events-none"
                />
                <div className="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-t from-[#08080A] via-[#08080A]/35 to-transparent" />
                <figcaption className="absolute z-[4] left-6 right-6 bottom-8 max-w-xl pointer-events-none">
                  <div className="label-caps mb-2" style={{ color: '#D4AF37' }}>
                    {moment.tag}
                  </div>
                  <h3
                    className="display font-medium tracking-tight"
                    style={{ fontSize: 'var(--fs-h3)', color: '#FAF6F0', lineHeight: 1.05 }}
                  >
                    {moment.title}
                  </h3>
                  <p className="mt-2 text-sm font-body leading-relaxed" style={{ color: '#C9C1B4' }}>
                    {moment.subtitle}
                  </p>
                  <div
                    aria-hidden="true"
                    className="mt-4 h-px w-full"
                    style={{ background: 'linear-gradient(90deg, #D4AF37, transparent)' }}
                  />
                </figcaption>
              </figure>
            );
          })}
        </div>

        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous moment"
            className="label-caps rounded-full px-4 py-2 transition-opacity hover:opacity-80"
            style={chipStyle}
          >
            &larr;
          </button>
          <span className="label-caps tabular-nums" style={{ color: '#C9C1B4' }} aria-live="polite">
            {pad(index + 1)} / {pad(N)}
          </span>
          <button
            type="button"
            onClick={() => fly(-1)}
            aria-label="Next moment"
            className="label-caps rounded-full px-4 py-2 transition-opacity hover:opacity-80"
            style={chipStyle}
          >
            &rarr;
          </button>
        </div>
      </div>
    </section>
  );
}
