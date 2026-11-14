'use client';
import React from 'react';

// ─── Mobile Nav Pill ──────────────────────────────────────────────────────────
// Floating glass pill anchored near the bottom of the viewport for thumb reach.
// Tapping it opens the MobileMenuSheet.
// Respects env(safe-area-inset-bottom) so it clears the home indicator.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MobileMenuSheet } from './MobileMenuSheet';
import { BRAND_NAME } from '@/lib/content';
import { SPRING_SNAPPY } from '@/lib/motion';

export function MobileNavPill(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div
        className="fixed left-0 right-0 bottom-0 z-40 md:hidden flex justify-center px-4"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <motion.button
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
          className="flex items-center gap-3 px-5 py-3 rounded-full overflow-hidden"
          style={{
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            backgroundColor: 'color-mix(in srgb, var(--surface) 65%, transparent)',
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,0.45),
              inset 0 -1px 0 rgba(0,0,0,0.04),
              0 8px 32px rgba(52,38,12,0.22)
            `,
          }}
          whileTap={{ scale: 0.96 }}
          transition={SPRING_SNAPPY}
        >
          {/* Logo mark */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="14" cy="14" r="12" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
            <polyline
              points="6,16 10,12 14,17 18,10 22,13"
              stroke="var(--accent-bright)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="14" cy="14" r="1.5" fill="var(--accent)" />
          </svg>

          <span
            className="font-display font-medium text-sm tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            {BRAND_NAME}
          </span>

          {/* Hamburger */}
          <span className="flex flex-col gap-1 ml-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block w-4 h-px"
                style={{ backgroundColor: 'var(--text-muted)' }}
              />
            ))}
          </span>
        </motion.button>
      </div>

      <MobileMenuSheet isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
