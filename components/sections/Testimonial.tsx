import React from 'react';
// ─── Testimonial Section ──────────────────────────────────────────────────────
// One large pull quote in Fraunces at display size, on an inverted panel,
// with attribution. Server Component.

import { TESTIMONIAL } from '@/lib/content';
import { RevealText } from '@/components/motion/RevealText';
import { Hairline } from '@/components/ui/Hairline';

export function Testimonial(): React.ReactElement {
  return (
    <section
      aria-labelledby="testimonial-heading"
      className="py-16 md:py-24 px-4 md:px-8 lg:px-16"
    >
      <div
        className="max-w-5xl mx-auto rounded-3xl px-8 py-12 md:px-16 md:py-20 relative overflow-hidden"
        style={{
          backgroundColor: 'transparent',
          border: '1px solid rgba(212,175,55,.28)',
        }}
      >
        {/* Large quotation mark decoration */}
        <div
          aria-hidden="true"
          className="absolute -top-4 -left-2 font-display text-[10rem] leading-none opacity-10 select-none"
          style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}
        >
          &ldquo;
        </div>

        {/* Diffuse glow */}
        <div
          aria-hidden="true"
          className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--accent) 9%, transparent) 0%, color-mix(in srgb, var(--accent) 3%, transparent) 45%, transparent 85%)',
          }}
        />

        <figure className="relative z-10">
          <Hairline variant="gold" className="mb-10" />
          <blockquote>
            <RevealText
              as="h2"
              mode="lines"
              trigger="scroll"
              id="testimonial-heading"
              className="display italic mb-8"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.9rem, 1rem + 3vw, 3.6rem)',
                lineHeight: 1.12,
                maxWidth: '22ch',
                color: 'var(--text)',
              }}
            >
              &ldquo;{TESTIMONIAL.quote}&rdquo;
            </RevealText>
          </blockquote>

          <figcaption className="flex items-center gap-4">
            {/* Avatar placeholder — initials */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-body font-medium text-sm"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
                color: 'var(--accent)',
              }}
              aria-hidden="true"
            >
              {TESTIMONIAL.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div>
              <div className="label-caps" style={{ color: 'var(--text)' }}>
                {TESTIMONIAL.name}
              </div>
              <div className="label-caps mt-1" style={{ color: 'var(--text-muted)' }}>
                {TESTIMONIAL.role} · {TESTIMONIAL.cohort}
              </div>
            </div>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
