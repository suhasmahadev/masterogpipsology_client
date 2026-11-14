'use client';
import React, { useRef } from 'react';
// ─── Curriculum Section ───────────────────────────────────────────────────────
// Six numbered chapters beside a vertical timeline. A gold line (scaleY) is drawn
// by scroll. Static tier shows the finished state.

import { CURRICULUM_CHAPTERS, CURRICULUM_INTRO } from '@/lib/content';
import { gsap, useGSAP } from '@/lib/gsap';
import { useDeviceTier } from '@/lib/device-tier';
import { Hairline } from '@/components/ui/Hairline';
import { LetterReveal } from '@/components/motion/LetterReveal';

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
        <LetterReveal
          as="h2"
          variant="shimmer"
          id="curriculum-heading"
          className="display ff-playfair md:w-1/2"
          style={{ fontSize: 'var(--fs-h2)', color: 'var(--text)' }}
        >
          Six modules.<br />One system.
        </LetterReveal>

        <p
          className="md:w-1/2 mt-4 md:mt-0 text-base leading-relaxed font-body self-end body-max"
          style={{ color: 'var(--text-muted)' }}
        >
          {CURRICULUM_INTRO}
        </p>
      </div>

      {/* Timeline + chapter list */}
      <ol ref={listRef} className="list-none relative pl-14 md:pl-[120px]" aria-label="Curriculum chapters">
        {/* Left rail: 1px track and gold line */}
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
        </li>

        <Hairline />
        {CURRICULUM_CHAPTERS.map((chapter) => {
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
