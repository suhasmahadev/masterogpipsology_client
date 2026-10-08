'use client';
import React, { useRef } from 'react';
// ─── Curriculum Section ───────────────────────────────────────────────────────
// Six numbered chapters on a 12-week timeline. A gold line (scaleY) is drawn by
// scroll; week nodes light as it passes. Static tier shows the finished state.

import { CURRICULUM_CHAPTERS, CURRICULUM_INTRO } from '@/lib/content';
import { weeksForChapter } from '@/lib/curriculum-math';
import { gsap, useGSAP } from '@/lib/gsap';
import { useDeviceTier } from '@/lib/device-tier';
import { Hairline } from '@/components/ui/Hairline';
import { FillStatement } from '@/components/motion/FillStatement';

const WEEKS = 12;
const pad = (n: number): string => String(n).padStart(2, '0');

export function Curriculum(): React.ReactElement {
  const tier = useDeviceTier();
  const listRef = useRef<HTMLOListElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const settled = tier === 'static';

  useGSAP(
    () => {
      const list = listRef.current;
      const line = lineRef.current;
      if (!list || !line || tier === 'static') return;
      const nodes = Array.from(list.querySelectorAll<HTMLElement>('.tl-node'));
      let active = -1;
      const apply = (count: number): void => {
        if (count === active) return;
        active = count;
        nodes.forEach((n, i) => n.setAttribute('data-on', i < count ? 'true' : 'false'));
      };
      apply(0);

      gsap.fromTo(
        line,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: list,
            start: 'top 70%',
            end: 'bottom 70%',
            scrub: true,
            onUpdate: (self) => apply(Math.min(WEEKS, Math.floor(self.progress * WEEKS))),
          },
        },
      );

      list.querySelectorAll('[data-chapter]').forEach((li) => {
        gsap.from(li, {
          y: 30,
          opacity: 0,
          duration: 0.9,
          ease: 'expo.out',
          scrollTrigger: { trigger: li, start: 'top 88%', once: true },
        });
      });
    },
    { scope: listRef, dependencies: [tier] },
  );

  return (
    <section
      id="curriculum"
      className="py-20 md:py-28 px-4 md:px-8 lg:px-16 max-w-7xl mx-auto"
      aria-labelledby="curriculum-heading"
    >
      {/* Section label */}
      <div className="flex items-center gap-3 mb-4">
        <span className="label-caps" style={{ color: 'var(--accent)' }}>
          The programme
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--hairline)' }} aria-hidden="true" />
      </div>

      <div className="flex flex-col md:flex-row md:gap-16 mb-12 md:mb-16">
        <FillStatement
          as="h2"
          id="curriculum-heading"
          className="display md:w-1/2"
          style={{ fontSize: 'var(--fs-h2)', color: 'var(--text)' }}
        >
          {'Twelve weeks.\nSix modules.\nOne system.'}
        </FillStatement>

        <p
          className="md:w-1/2 mt-4 md:mt-0 text-base leading-relaxed font-body self-end body-max"
          style={{ color: 'var(--text-muted)' }}
        >
          {CURRICULUM_INTRO}
        </p>
      </div>

      {/* Timeline + chapter list */}
      <ol ref={listRef} className="list-none relative pl-14 md:pl-[120px]" aria-label="Curriculum chapters">
        {/* Left rail: 1px track, gold line and 12 week nodes */}
        <li aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-14 md:w-[120px] pointer-events-none">
          <span className="absolute top-0 bottom-0 w-px" style={{ left: 12, background: 'rgba(212,175,55,.18)' }} />
          <span
            ref={lineRef}
            className="tl-line absolute top-0 bottom-0 w-px"
            style={{
              left: 12,
              background: 'linear-gradient(180deg, #F5D77F, #D4AF37)',
              transformOrigin: 'top',
              transform: settled ? 'scaleY(1)' : 'scaleY(0)',
              willChange: 'transform',
            }}
          />
          {Array.from({ length: WEEKS }, (_, i) => (
            <span
              key={i}
              className="tl-node absolute flex items-center gap-3"
              data-on={settled ? 'true' : 'false'}
              style={{ top: `${(i / (WEEKS - 1)) * 100}%`, left: 8, transform: 'translateY(-50%)' }}
            >
              <span className="tl-dot">
                <span className="tl-gold" />
              </span>
              <span className="tl-num hidden md:inline font-mono text-[11px] tracking-widest">{pad(i + 1)}</span>
            </span>
          ))}
        </li>

        <Hairline />
        {CURRICULUM_CHAPTERS.map((chapter, ci) => {
          const [from, to] = weeksForChapter(ci, CURRICULUM_CHAPTERS.length, WEEKS);
          return (
            <li key={chapter.number} data-chapter>
              <div className="py-6 md:py-8 flex flex-col md:flex-row md:gap-12">
                {/* Chapter number */}
                <div
                  className="display font-medium text-3xl md:text-4xl leading-none flex-shrink-0 md:w-20 mb-3 md:mb-0"
                  style={{ color: 'var(--accent)', opacity: 0.7 }}
                  aria-hidden="true"
                >
                  {chapter.number}
                </div>

                {/* Content */}
                <div className="flex flex-col gap-2">
                  <span
                    className="font-mono text-[11px] tracking-widest"
                    style={{ color: 'var(--text-muted)' }}
                    aria-hidden="true"
                  >
                    {pad(from)} - {pad(to)}
                  </span>
                  <h3
                    className="display font-medium text-xl md:text-2xl tracking-tight leading-snug"
                    style={{ color: 'var(--text)' }}
                  >
                    {chapter.title}
                  </h3>
                  <p className="text-base leading-relaxed font-body body-max" style={{ color: 'var(--text-muted)' }}>
                    {chapter.description}
                  </p>
                </div>
              </div>
              <Hairline />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
