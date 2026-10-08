'use client';
import React from 'react';

// ─── Mobile Menu Sheet ─────────────────────────────────────────────────────────
// Full-screen glass menu. The header pill (z-50) stays above it and its
// hamburger morphs to an X, so the sheet has no duplicate close row.

import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { NAV_LINKS, CTA_PRIMARY } from '@/lib/content';
import { JoinCapsules } from '@/components/ui/JoinCapsules';
import { getLenis } from '@/components/providers/LenisProvider';

export interface MobileMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

const FOCUSABLE = 'a[href], button:not([disabled])';

export function MobileMenuSheet({ isOpen, onClose }: MobileMenuSheetProps): React.ReactElement {
  const reduced = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock scroll, pause Lenis, focus first link
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    getLenis()?.stop();
    const raf = requestAnimationFrame(() => {
      sheetRef.current?.querySelector<HTMLElement>('nav a')?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = '';
      getLenis()?.start();
    };
  }, [isOpen]);

  // Escape closes; Tab is trapped between the hamburger and the sheet.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const burger = document.querySelector<HTMLElement>('[aria-controls="mobile-menu"]');
      const items = [
        ...(burger ? [burger] : []),
        ...Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
      ];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!items.includes(active as HTMLElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const dur = reduced ? 0 : undefined;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={sheetRef}
          key="mobile-menu-sheet"
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="fixed inset-0 z-[45] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur ?? 0.35, ease: EASE }}
          style={{
            backdropFilter: 'blur(24px) saturate(170%)',
            WebkitBackdropFilter: 'blur(24px) saturate(170%)',
            backgroundColor: 'rgba(12, 11, 9, 0.72)',
            borderTop: '1px solid rgba(212, 175, 55, 0.45)',
            color: '#FAF6F0',
          }}
        >
          <nav className="flex-1 flex flex-col justify-center px-8 pt-24" aria-label="Mobile navigation">
            <motion.ul
              className="flex flex-col gap-2"
              role="list"
              variants={listVariants}
              initial={reduced ? 'visible' : 'hidden'}
              animate="visible"
            >
              {NAV_LINKS.map((link) => (
                <motion.li key={link.href} variants={reduced ? undefined : itemVariants} role="listitem">
                  <a
                    href={link.href}
                    onClick={onClose}
                    className="block py-3 font-display font-medium tracking-tight no-underline"
                    style={{ fontSize: 'var(--fs-h2)', color: '#FAF6F0' }}
                  >
                    {link.label}
                  </a>
                  <div className="h-px" style={{ backgroundColor: 'rgba(212, 175, 55, 0.25)' }} aria-hidden="true" />
                </motion.li>
              ))}
            </motion.ul>
          </nav>

          <motion.div
            className="px-6"
            style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
          >
            <p className="font-body text-[11px] tracking-[0.28em] uppercase mb-3 text-center" style={{ color: 'rgba(250,246,240,0.7)' }}>{CTA_PRIMARY}</p>
            <JoinCapsules tone="dark" size="lg" className="flex flex-col gap-2.5" capClassName="w-full" onNavigate={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
