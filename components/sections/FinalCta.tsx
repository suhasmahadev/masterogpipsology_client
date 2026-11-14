import React from 'react';
// ─── Final CTA Section ────────────────────────────────────────────────────────
// Large centred headline naming the cohort date, support copy, two CTAs.
// Sits at the darkest point of the scroll transition (~100%).
// Server Component.

import { JoinNow } from '@/components/nav/JoinNow';
import { TypingHeading } from '@/components/ui/TypingHeading';
import type { TypingSegment } from '@/lib/typing';
import { LightLeak } from '@/components/fx/LightLeak';
import { Hairline } from '@/components/ui/Hairline';

const CTA_HEADLINE: TypingSegment[] = [
  { text: 'Education before ' },
  { text: 'execution.', gold: true, flare: true },
];

export function FinalCta(): React.ReactElement {
  return (
    <section
      id="cta"
      className="relative overflow-hidden py-24 md:py-36 px-4 md:px-8 lg:px-16"
      aria-labelledby="cta-heading"
    >
      <LightLeak from="right" intensity={0.6} />
      <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-8 relative">
        {/* Centred glow */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent) 0%, color-mix(in srgb, var(--accent) 4%, transparent) 40%, transparent 75%)',
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Brass hairline above */}
          <Hairline variant="gold" className="w-48 md:w-72" />

          <TypingHeading
            as="h2"
            id="cta-heading"
            trigger="scroll"
            segments={CTA_HEADLINE}
            className="display font-medium"
            style={{ fontSize: 'var(--fs-h2)', color: 'var(--text)' }}
          />

          <div className="flex flex-wrap justify-center items-center gap-3">
            <JoinNow />
          </div>

          {/* Brass hairline below */}
          <Hairline variant="gold" className="w-48 md:w-72 mt-2" />
        </div>
      </div>
    </section>
  );
}
