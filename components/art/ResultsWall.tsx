'use client';
import React from 'react';

// ─── Results Wall SVG ─────────────────────────────────────────────────────────
// Left frame in the gallery. Shows the programme pillars.

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { PROGRAMME_PILLARS } from '@/lib/content';
import { fadeUpVariants } from '@/lib/motion';

export function ResultsWall(): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <div ref={ref} className="flex flex-col gap-4 h-full">
      {/* Header */}
      <motion.div
        custom={0}
        variants={fadeUpVariants}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        className="flex items-center gap-2"
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: 'var(--accent)' }}
          aria-hidden="true"
        />
        <span
          className="text-xs font-body font-medium uppercase tracking-widest"
          style={{ color: 'var(--accent)' }}
        >
          Programme framework
        </span>
      </motion.div>

      {/* Record tiles */}
      <div className="grid grid-cols-2 gap-2">
        {PROGRAMME_PILLARS.map((record, i) => (
          <motion.div
            key={record.label}
            custom={i + 1}
            variants={fadeUpVariants}
            initial="hidden"
            animate={inView ? 'visible' : 'hidden'}
            className="rounded-lg p-3 border"
            style={{ borderColor: 'var(--hairline)' }}
            role="figure"
            aria-label={`${record.value} ${record.label}`}
          >
            <div
              className="font-display font-medium text-lg leading-none mb-0.5"
              style={{ color: 'var(--accent)' }}
            >
              {record.value}
            </div>
            <div
              className="text-xs font-body leading-tight"
              style={{ color: 'var(--text-muted)' }}
            >
              {record.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
