'use client';
import React from 'react';

// ─── PriceChart SVG Component ─────────────────────────────────────────────────
// Animated inline SVG price chart.
// On load: line traces via pathLength → four candlesticks scale up staggered.
// Consumes CSS vars so it shifts with the scroll theme transition.

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { drawVariants, candleVariants } from '@/lib/motion';

interface Candle {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  bullish: boolean;
}

const LINE_POINTS =
  'M 10,90 C 30,80 50,95 70,75 S 100,55 120,65 S 155,45 170,40 S 200,30 220,20 S 255,15 270,18 S 295,25 310,20';

const CANDLES: Candle[] = [
  { x: 80, open: 70, close: 60, high: 55, low: 76, bullish: true },
  { x: 140, open: 60, close: 68, high: 56, low: 72, bullish: false },
  { x: 200, open: 42, close: 30, high: 25, low: 48, bullish: true },
  { x: 260, open: 28, close: 18, high: 14, low: 33, bullish: true },
];

export function PriceChart(): React.ReactElement {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <svg
      ref={ref}
      viewBox="0 0 320 110"
      className="w-full h-full"
      aria-label="Animated price chart showing an upward price trajectory"
      role="img"
      preserveAspectRatio="none"
    >
      {/* Grid lines */}
      {[25, 50, 75].map((y) => (
        <line
          key={y}
          x1="0"
          y1={y}
          x2="320"
          y2={y}
          stroke="var(--hairline)"
          strokeWidth="0.5"
          strokeDasharray="4 4"
          opacity="0.5"
        />
      ))}

      {/* Area fill under the line */}
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <clipPath id="areaClip">
          <path d={`${LINE_POINTS} L 310,110 L 10,110 Z`} />
        </clipPath>
      </defs>

      <motion.path
        d={`${LINE_POINTS} L 310,110 L 10,110 Z`}
        fill="url(#lineGrad)"
        custom={0}
        variants={drawVariants}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
        style={{ pathLength: 1, fillOpacity: 1 }}
      />

      {/* Main line */}
      <motion.path
        d={LINE_POINTS}
        stroke="var(--accent)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        custom={0}
        variants={drawVariants}
        initial="hidden"
        animate={inView ? 'visible' : 'hidden'}
      />

      {/* Candles */}
      {CANDLES.map((c, i) => (
        <motion.g
          key={c.x}
          custom={i}
          variants={candleVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          style={{ originY: '100%' }}
        >
          {/* Wick */}
          <line
            x1={c.x}
            y1={c.high}
            x2={c.x}
            y2={c.low}
            stroke={c.bullish ? 'var(--accent-bright)' : 'var(--text-muted)'}
            strokeWidth="1"
          />
          {/* Body */}
          <rect
            x={c.x - 5}
            y={Math.min(c.open, c.close)}
            width="10"
            height={Math.abs(c.close - c.open)}
            fill={c.bullish ? 'var(--accent)' : 'none'}
            stroke={c.bullish ? 'var(--accent)' : 'var(--text-muted)'}
            strokeWidth="1"
            rx="1"
          />
        </motion.g>
      ))}

      {/* Latest price dot */}
      <motion.circle
        cx="310"
        cy="20"
        r="3"
        fill="var(--accent-bright)"
        initial={{ opacity: 0, scale: 0 }}
        animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
        transition={{ delay: 1.8, duration: 0.3 }}
      />
    </svg>
  );
}
