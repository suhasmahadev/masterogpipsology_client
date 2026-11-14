'use client';
import React from 'react';

// ─── Certificate Display SVG ──────────────────────────────────────────────────
// Right frame in the gallery. Certificate with brass double border and seal,
// trophy and audit medal. Inline SVG — CSS-var aware.

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { CERTIFICATE_NAME, CERTIFICATE_SUBTITLE, AUDIT_BODY } from '@/lib/content';
import { fadeUpVariants } from '@/lib/motion';

export function CertificateDisplay(): React.ReactElement {
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
          Certification & awards
        </span>
      </motion.div>

      {/* Certificate frame */}
      <motion.div
        custom={1}
        variants={fadeUpVariants}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        className="flex-1"
      >
        <svg
          viewBox="0 0 280 200"
          className="w-full"
          aria-label={`${CERTIFICATE_NAME} professional trading certificate with brass seal`}
          role="img"
        >
          {/* Outer brass border */}
          <rect
            x="4"
            y="4"
            width="272"
            height="192"
            rx="6"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
          />
          {/* Inner brass border (double frame) */}
          <rect
            x="10"
            y="10"
            width="260"
            height="180"
            rx="4"
            fill="none"
            stroke="var(--accent-bright)"
            strokeWidth="0.75"
            strokeDasharray="4 3"
          />

          {/* Corner ornaments */}
          {[
            [20, 20], [260, 20], [20, 180], [260, 180],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x},${y})`}>
              <circle r="3" fill="var(--accent)" />
              <circle r="5" fill="none" stroke="var(--accent)" strokeWidth="0.5" />
            </g>
          ))}

          {/* Logo mark */}
          <circle cx="140" cy="42" r="14" fill="none" stroke="var(--accent)" strokeWidth="1" />
          <polyline
            points="132,48 136,44 140,49 144,42 148,45"
            stroke="var(--accent-bright)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Title */}
          <text
            x="140"
            y="76"
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize="13"
            fontWeight="400"
            fill="var(--text)"
            letterSpacing="-0.02em"
          >
            {CERTIFICATE_NAME}
          </text>

          {/* Subtitle */}
          <text
            x="140"
            y="92"
            textAnchor="middle"
            fontFamily="var(--font-body)"
            fontSize="7"
            fill="var(--text-muted)"
            letterSpacing="0.12em"
          >
            {CERTIFICATE_SUBTITLE.toUpperCase()}
          </text>

          {/* Divider line */}
          <line x1="60" y1="102" x2="220" y2="102" stroke="var(--accent)" strokeWidth="0.5" opacity="0.5" />

          {/* Body copy */}
          <text x="140" y="118" textAnchor="middle" fontFamily="var(--font-body)" fontSize="7" fill="var(--text-muted)">
            This certifies the successful completion of the
          </text>
          <text x="140" y="128" textAnchor="middle" fontFamily="var(--font-body)" fontSize="7" fill="var(--text-muted)">
            12-week Master of Pipsology trading programme
          </text>

          {/* Seal */}
          <g transform="translate(140,158)">
            <circle r="18" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
            <circle r="14" fill="none" stroke="var(--accent-bright)" strokeWidth="0.5" />
            {/* Star points */}
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i * 360) / 8;
              const rad = (angle * Math.PI) / 180;
              const x1 = Math.cos(rad) * 10;
              const y1 = Math.sin(rad) * 10;
              const x2 = Math.cos(rad) * 14;
              const y2 = Math.sin(rad) * 14;
              return (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth="0.75" />
              );
            })}
            <text textAnchor="middle" y="1" fontFamily="var(--font-body)" fontSize="5" fill="var(--accent)" letterSpacing="0.08em">
              VERIFIED
            </text>
            <text textAnchor="middle" y="7" fontFamily="var(--font-body)" fontSize="4" fill="var(--text-muted)">
              2025
            </text>
          </g>

          {/* Audit medal badge */}
          <g transform="translate(230,158)">
            <circle r="14" fill="none" stroke="var(--accent)" strokeWidth="1" />
            <text textAnchor="middle" y="-2" fontFamily="var(--font-body)" fontSize="4.5" fill="var(--accent)" letterSpacing="0.06em">
              AUDIT
            </text>
            <text textAnchor="middle" y="5" fontFamily="var(--font-body)" fontSize="3.5" fill="var(--text-muted)">
              PASSED
            </text>
            <circle r="8" fill="none" stroke="var(--accent-bright)" strokeWidth="0.5" opacity="0.6" />
          </g>
        </svg>
      </motion.div>

      {/* Audit body attribution */}
      <motion.div
        custom={2}
        variants={fadeUpVariants}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        className="flex items-center justify-center gap-2 py-2 rounded-lg border"
        style={{ borderColor: 'var(--hairline)' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="6" stroke="var(--accent)" strokeWidth="1" />
          <path d="M 4 7 L 6 9 L 10 5" stroke="var(--accent-bright)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-body" style={{ color: 'var(--text-muted)' }}>
          {AUDIT_BODY}
        </span>
      </motion.div>
    </div>
  );
}
