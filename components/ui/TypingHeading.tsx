'use client';

import React, { Fragment, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { gsap, useGSAP } from '@/lib/gsap';
import { onEveryFrame } from '@/lib/frame-loop';
import { onIntroDone } from '@/lib/intro';
import { layoutTyping, revealCount, type TypingSegment } from '@/lib/typing';

interface TypingHeadingProps {
  segments: readonly TypingSegment[];
  as?: 'h1' | 'h2';
  speedMs?: number;
  delayMs?: number;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

interface CharRect { l: number; r: number; t: number; h: number }

export function TypingHeading({
  segments,
  as = 'h1',
  speedMs = 70,
  delayMs = 350,
  className,
  style,
  id,
}: TypingHeadingProps): React.ReactElement {
  const layout = useMemo(() => layoutTyping(segments), [segments]);
  const rootRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const Tag = as as unknown as React.ComponentType<React.HTMLAttributes<HTMLElement>>;

  useGSAP(
    (_ctx, contextSafe) => {
      const root = rootRef.current;
      const caret = caretRef.current;
      if (!root || !caret || !contextSafe) return;

      const els: (HTMLElement | null)[] = Array(layout.total).fill(null);
      root.querySelectorAll<HTMLElement>('.th-c').forEach((el) => {
        const i = Number(el.dataset.i);
        if (!Number.isNaN(i)) els[i] = el;
      });
      const firstIdx = els.findIndex(Boolean);
      if (firstIdx < 0) return;

      const rects: (CharRect | undefined)[] = Array(layout.total).fill(undefined);
      let gap = 0;
      let caretH = 0;
      let shown = 0;

      const measure = (): void => {
        const rr = root.getBoundingClientRect();
        els.forEach((el, i) => {
          if (!el) return;
          const r = el.getBoundingClientRect();
          rects[i] = { l: r.left - rr.left, r: r.right - rr.left, t: r.top - rr.top, h: r.height };
        });
        gap = parseFloat(getComputedStyle(root).fontSize) * 0.08;
        caretH = caret.offsetHeight;
      };
      const placeCaret = (): void => {
        let k = -1;
        for (let i = Math.min(shown, layout.total) - 1; i >= 0; i--) {
          if (els[i]) { k = i; break; }
        }
        const ref = rects[k >= 0 ? k : firstIdx];
        if (!ref) return;
        const x = k >= 0 ? ref.r + gap : ref.l;
        const y = ref.t + (ref.h - caretH) / 2;
        caret.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      };

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        root.classList.add('th--static');
        els.forEach((el) => el?.classList.add('is-on'));
        shown = layout.total;
        measure();
        placeCaret();
        return;
      }

      let flared = false;
      const playFlare = contextSafe(() => {
        if (flared) return;
        flared = true;
        const fx = els[layout.flareIndex]?.parentElement;
        if (!fx) return;
        const edge = fx.querySelector('.th-flare__edge');
        const star = fx.querySelector('.th-flare__star');
        if (!edge || !star) return;
        gsap.set(star, { x: 0, scale: 0, rotation: 0, opacity: 0 });
        const tl = gsap.timeline();
        tl.to(edge, { opacity: 1, duration: 0.22, ease: 'power2.out' }, 0);
        tl.to(edge, { opacity: 0, duration: 0.7, ease: 'power2.in' }, 0.3);
        tl.to(star, { x: () => fx.offsetWidth * 0.85, rotation: 90, duration: 0.85, ease: 'power2.inOut' }, 0.05);
        tl.to(star, { scale: 1.15, opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.05);
        tl.to(star, { scale: 0, opacity: 0, duration: 0.35, ease: 'power2.in' }, 0.55);
      });

      let unsub: (() => void) | null = null;
      let started = false;
      const start = (): void => {
        if (started) return;
        started = true;
        let t0 = -1;
        unsub = onEveryFrame((ts) => {
          if (t0 < 0) t0 = ts;
          const n = revealCount(ts - t0, delayMs, speedMs, layout.total);
          if (n !== shown) {
            for (let i = shown; i < n; i++) els[i]?.classList.add('is-on');
            const hitFlare = layout.flareIndex >= 0 && shown <= layout.flareIndex && n > layout.flareIndex;
            shown = n;
            placeCaret();
            if (hitFlare) playFlare();
          }
          if (n >= layout.total) {
            unsub?.();
            unsub = null;
            root.classList.add('th--done');
          }
        }, 'update');
      };

      measure();
      placeCaret();
      const offIntro = onIntroDone(start);
      const failsafe = window.setTimeout(start, 6000);
      const ro = new ResizeObserver(() => { measure(); placeCaret(); });
      ro.observe(root);
      void document.fonts?.ready.then(() => { measure(); placeCaret(); });

      return () => {
        offIntro();
        clearTimeout(failsafe);
        unsub?.();
        ro.disconnect();
      };
    },
    { dependencies: [layout, speedMs, delayMs], revertOnUpdate: true },
  );

  return (
    <Tag id={id} className={className} style={style}>
      <span className="sr-only">{layout.text}</span>
      <span ref={rootRef} className="th" aria-hidden="true">
        {layout.words.map((w, wi) => (
          <Fragment key={wi}>
            {wi > 0 ? ' ' : null}
            <span className={clsx('th-w', w.some((c) => c.gold) && 'th-w--gold')}>
              {w.map((c) =>
                c.flare ? (
                  <span key={c.i} className="th-fx">
                    <span className={clsx('th-c', c.gold && 'th-c--gold')} data-i={c.i}>{c.ch}</span>
                    <span className="th-flare">
                      <span className="th-flare__edge">{c.ch}</span>
                      <span className="th-flare__star" />
                    </span>
                  </span>
                ) : (
                  <span key={c.i} className={clsx('th-c', c.gold && 'th-c--gold')} data-i={c.i}>{c.ch}</span>
                ),
              )}
            </span>
          </Fragment>
        ))}
        <span ref={caretRef} className="th-caret" />
      </span>
    </Tag>
  );
}

export default TypingHeading;
