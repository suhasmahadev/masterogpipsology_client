'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';

// ─── 8 Strategies Section ─────────────────────────────────────────────────────
// Dark-and-gold surface. 4×2 grid on desktop, 2 cols on tablet, 1 on mobile.
// Each card is a <button>-headed accordion. One card open at a time.
// Locked padlock row links to the WhatsApp channel.
// Staggered scroll entrance (once). Mask-reveal heading.
// Only transform + opacity animate; no CSS filters on animation paths.

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { gsap, useGSAP, ScrollTrigger } from '@/lib/gsap';
import {
  STRATEGIES,
  STRATEGIES_LABEL,
  STRATEGIES_HEADLINE_PLAIN,
  STRATEGIES_HEADLINE_EM,
  STRATEGIES_SUBLINE,
  STRATEGIES_JOIN_HEADLINE,
  STRATEGIES_JOIN_BODY,
  WHATSAPP_URL,
  INSTAGRAM_URL,
  type Strategy,
} from '@/lib/content';

// ─── Strategy icons (inline SVG, currentColor, 1.5px stroke) ─────────────────
function StrategyIcon({ id }: { id: number }): React.ReactElement {
  const props = {
    width: 22,
    height: 22,
    viewBox: '0 0 22 22',
    fill: 'none',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    stroke: 'currentColor',
    'aria-hidden': true,
  };
  switch (id) {
    case 1: // Indecision — two arrows pulling apart (balance scales)
      return (
        <svg {...props}>
          <path d="M11 4v14M6 7l5-3 5 3M6 15l5 3 5-3" />
        </svg>
      );
    case 2: // 50% — a range with midpoint line
      return (
        <svg {...props}>
          <rect x="3" y="5" width="16" height="12" rx="1.5" />
          <line x1="3" y1="11" x2="19" y2="11" />
        </svg>
      );
    case 3: // Third dimension — layered planes
      return (
        <svg {...props}>
          <path d="M3 15l8-5 8 5M3 11l8-5 8 5" />
        </svg>
      );
    case 4: // Fourth dimension — clock
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <polyline points="11,6 11,11 14,13" />
        </svg>
      );
    case 5: // Wick-Body — candle
      return (
        <svg {...props}>
          <line x1="11" y1="2" x2="11" y2="5" />
          <rect x="7" y="5" width="8" height="12" rx="1" />
          <line x1="11" y1="17" x2="11" y2="20" />
        </svg>
      );
    case 6: // Candle Analysis — multi candles
      return (
        <svg {...props}>
          <line x1="5" y1="2" x2="5" y2="5" />
          <rect x="3" y="5" width="4" height="8" rx="0.75" />
          <line x1="5" y1="13" x2="5" y2="16" />
          <line x1="11" y1="4" x2="11" y2="7" />
          <rect x="9" y="7" width="4" height="6" rx="0.75" />
          <line x1="11" y1="13" x2="11" y2="17" />
          <line x1="17" y1="3" x2="17" y2="6" />
          <rect x="15" y="6" width="4" height="9" rx="0.75" />
          <line x1="17" y1="15" x2="17" y2="19" />
        </svg>
      );
    case 7: // Sentiment — crowd/wave
      return (
        <svg {...props}>
          <path d="M2 14c2-4 4-6 6-6s4 4 6 4 4-6 6-6" />
        </svg>
      );
    case 8: // Geopolitical — globe
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <path d="M11 3a14 14 0 0 1 0 16M11 3a14 14 0 0 0 0 16M3 11h16" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
        </svg>
      );
  }
}

// ─── Padlock icon ─────────────────────────────────────────────────────────────
function PadlockIcon(): React.ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      aria-hidden
    >
      <rect x="2" y="6" width="10" height="7" rx="1.5" />
      <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" />
    </svg>
  );
}

// ─── ChevronDown icon ─────────────────────────────────────────────────────────
function ChevronDown(): React.ReactElement {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

// ─── Section-scoped CSS tokens ────────────────────────────────────────────────
const S = {
  bg: '#0E0F12',
  surface: '#14161B',
  text: '#F3ECE0',
  muted: '#A89F8E',
  gold: '#C3A268',
  goldBright: '#E0C38A',
  goldDeep: '#9A7539',
} as const;

// Gold gradient border (light→mid→light) used on cards
const GOLD_BORDER =
  'linear-gradient(135deg, #E0C38A 0%, #C3A268 40%, #E0C38A 100%)';

// ─── Individual card ──────────────────────────────────────────────────────────
interface CardProps {
  strategy: Strategy;
  isOpen: boolean;
  onToggle: () => void;
  reducedMotion: boolean | null;
}

const panelVariants = {
  open: { height: 'auto', opacity: 1 },
  closed: { height: 0, opacity: 0 },
};

function StrategyCard({ strategy, isOpen, onToggle, reducedMotion }: CardProps): React.ReactElement {
  const panelId = `strategy-panel-${strategy.id}`;
  const headerId = `strategy-header-${strategy.id}`;
  const tileRef = useRef<HTMLDivElement>(null);

  // Desktop pointer: subtle lift + sheen on hover (off on touch)
  useGSAP(
    () => {
      const tile = tileRef.current;
      if (!tile) return;
      if (window.matchMedia('(hover: none)').matches) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const enter = (): void => {
        gsap.to(tile, { y: -4, duration: 0.4, ease: 'power3.out' });
      };
      const leave = (): void => {
        gsap.to(tile, { y: 0, duration: 0.4, ease: 'power3.out' });
      };
      tile.addEventListener('mouseenter', enter);
      tile.addEventListener('mouseleave', leave);
      return () => {
        tile.removeEventListener('mouseenter', enter);
        tile.removeEventListener('mouseleave', leave);
      };
    },
    { scope: tileRef },
  );

  const idx = String(strategy.id).padStart(2, '0');

  return (
    <div
      ref={tileRef}
      className="strat-card"
      style={{ willChange: 'transform' }}
    >
      {/* Gold-gradient border wrapper */}
      <div
        className="strat-card__border"
        style={{
          padding: 1,
          borderRadius: 14,
          background: isOpen ? GOLD_BORDER : `linear-gradient(135deg, rgba(195,162,104,0.55) 0%, rgba(154,117,57,0.3) 50%, rgba(195,162,104,0.55) 100%)`,
          transition: reducedMotion ? 'none' : 'background 0.35s ease',
        }}
      >
        {/* Card inner */}
        <div
          style={{
            borderRadius: 13,
            background: S.surface,
            overflow: 'hidden',
          }}
        >
          {/* @supports backdrop-filter */}
          <div
            style={{
              borderRadius: 13,
            }}
            className="strat-card__glass"
          >
            {/* Header button */}
            <button
              id={headerId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={onToggle}
              className="strat-card__btn"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '20px 20px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: S.text,
                outline: 'none',
              }}
            >
              {/* Index */}
              <span
                aria-hidden
                style={{
                  fontFamily: 'var(--font-sans-body), system-ui, sans-serif',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  color: S.goldBright,
                  lineHeight: '1.8rem',
                  flexShrink: 0,
                  paddingTop: 2,
                }}
              >
                {idx}
              </span>

              {/* Icon */}
              <span
                style={{
                  color: S.gold,
                  flexShrink: 0,
                  paddingTop: 4,
                  display: 'flex',
                }}
              >
                <StrategyIcon id={strategy.id} />
              </span>

              {/* Name */}
              <span
                style={{
                  fontFamily: 'var(--font-display-serif), Cormorant Garamond, Georgia, serif',
                  fontSize: 'clamp(1rem, 1.5vw, 1.25rem)',
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: '-0.01em',
                  flex: 1,
                  color: S.text,
                }}
              >
                {strategy.name}
              </span>

              {/* Chevron */}
              <span
                style={{
                  color: S.gold,
                  flexShrink: 0,
                  transition: reducedMotion ? 'none' : 'transform 0.35s cubic-bezier(0.16,1,0.3,1)',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  paddingTop: 4,
                }}
              >
                <ChevronDown />
              </span>
            </button>

            {/* Panel */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={headerId}
                  initial={reducedMotion ? false : 'closed'}
                  animate="open"
                  exit={reducedMotion ? undefined : 'closed'}
                  variants={reducedMotion ? undefined : panelVariants}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 340, damping: 28 }
                  }
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '0 20px 20px' }}>
                    {/* Thin gold hairline divider */}
                    <div
                      aria-hidden
                      style={{
                        height: 1,
                        marginBottom: 14,
                        background: `linear-gradient(90deg, transparent, ${S.gold} 40%, transparent)`,
                        opacity: 0.45,
                      }}
                    />

                    {/* Teaser */}
                    <p
                      style={{
                        fontFamily: 'var(--font-sans-body), system-ui, sans-serif',
                        fontSize: '0.9rem',
                        lineHeight: 1.7,
                        color: S.muted,
                        marginBottom: 16,
                      }}
                    >
                      {strategy.teaser}
                    </p>

                    {/* Locked row */}
                    <a
                      href={WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontFamily: 'var(--font-sans-body), system-ui, sans-serif',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        color: S.goldBright,
                        textDecoration: 'none',
                        border: `1px solid rgba(195,162,104,0.4)`,
                        borderRadius: 999,
                        padding: '7px 14px 7px 10px',
                        transition: 'border-color 0.2s ease, background 0.2s ease',
                      }}
                      className="strat-locked-link"
                    >
                      <PadlockIcon />
                      Read the full strategy
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
export function StrategiesSection(): React.ReactElement {
  const [openId, setOpenId] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(
    (id: number) => {
      setOpenId((prev) => (prev === id ? null : id));
    },
    [],
  );

  // Escape key collapses open card
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Staggered scroll entrance on the grid cards (once, not repeatedly)
  useGSAP(
    () => {
      const grid = gridRef.current;
      if (!grid || reducedMotion) return;
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.strat-card'));
      gsap.from(cards, {
        y: 36,
        opacity: 0,
        duration: 0.7,
        ease: 'expo.out',
        stagger: 0.06,
        scrollTrigger: {
          trigger: grid,
          start: 'top 82%',
          once: true,
        },
      });
    },
    { scope: sectionRef, dependencies: [reducedMotion] },
  );

  // Heading mask reveal (clip-path from bottom, not a fade-up)
  useGSAP(
    () => {
      const heading = headingRef.current;
      if (!heading || reducedMotion) return;
      gsap.from(heading, {
        clipPath: 'inset(0 0 100% 0)',
        opacity: 0,
        duration: 1.1,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: heading,
          start: 'top 88%',
          once: true,
        },
      });
    },
    { scope: sectionRef, dependencies: [reducedMotion] },
  );

  // Refresh ScrollTrigger when a card opens (height changes)
  useEffect(() => {
    ScrollTrigger.refresh();
  }, [openId]);

  return (
    <section
      id="strategies"
      ref={sectionRef}
      aria-labelledby="strategies-heading"
      style={{
        position: 'relative',
        background: S.bg,
        color: S.text,
        // Feather top + bottom edges into neighboring sections (no hard seam)
        maskImage:
          'linear-gradient(to bottom, transparent 0%, #000 4%, #000 96%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, #000 4%, #000 96%, transparent 100%)',
      }}
    >
      {/* Diffuse gold radial glow — off-canvas corners, very low opacity */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-30%',
            right: '-20%',
            width: '60vmax',
            height: '60vmax',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(195,162,104,0.07) 0%, rgba(154,117,57,0.04) 40%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-20%',
            left: '-15%',
            width: '50vmax',
            height: '50vmax',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(224,195,138,0.06) 0%, rgba(195,162,104,0.03) 40%, transparent 70%)',
          }}
        />
      </div>

      <div
        style={{
          position: 'relative',
          maxWidth: 1280,
          margin: '0 auto',
          padding: 'clamp(4rem, 8vw, 7rem) clamp(1rem, 4vw, 4rem)',
        }}
      >
        {/* ── Heading block ── */}
        <div style={{ marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
          {/* Label */}
          <p
            style={{
              fontFamily: 'var(--font-sans-body), system-ui, sans-serif',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: S.gold,
              marginBottom: '1.2rem',
            }}
          >
            {STRATEGIES_LABEL}
          </p>

          {/* H2 — mask reveal, not fade-up */}
          <h2
            id="strategies-heading"
            ref={headingRef}
            style={{
              fontFamily: 'var(--font-display-serif), Cormorant Garamond, Georgia, serif',
              fontSize: 'clamp(2.2rem, 5vw, 4rem)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1.05,
              color: S.text,
              marginBottom: '1rem',
            }}
          >
            {STRATEGIES_HEADLINE_PLAIN}
            <em
              style={{
                fontStyle: 'italic',
                background: `linear-gradient(135deg, ${S.goldBright} 0%, ${S.gold} 55%, ${S.goldDeep} 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
              }}
            >
              {STRATEGIES_HEADLINE_EM}
            </em>
          </h2>

          {/* Subline */}
          <p
            style={{
              fontFamily: 'var(--font-sans-body), system-ui, sans-serif',
              fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)',
              lineHeight: 1.7,
              color: S.muted,
              maxWidth: '52ch',
            }}
          >
            {STRATEGIES_SUBLINE}
          </p>
        </div>

        {/* ── Thin gold hairline ── */}
        <div
          aria-hidden
          style={{
            height: 1,
            marginBottom: 'clamp(2rem, 4vw, 3rem)',
            background: `linear-gradient(90deg, ${S.gold} 0%, rgba(195,162,104,0.25) 60%, transparent 100%)`,
          }}
        />

        {/* ── Card grid ── */}
        <div
          ref={gridRef}
          style={{
            display: 'grid',
            // 4 cols ≥1024, 2 cols ≥640, 1 col <640
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
            gap: 'clamp(0.75rem, 1.5vw, 1.25rem)',
          }}
          className="strategies-grid"
        >
          {STRATEGIES.map((strategy) => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              isOpen={openId === strategy.id}
              onToggle={() => handleToggle(strategy.id)}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>

        {/* ── Join block ── */}
        <div
          style={{
            marginTop: 'clamp(3rem, 6vw, 5rem)',
            textAlign: 'center',
          }}
        >
          {/* Thin gold hairline above join block */}
          <div
            aria-hidden
            style={{
              height: 1,
              marginBottom: 'clamp(2.5rem, 4vw, 3.5rem)',
              background: `linear-gradient(90deg, transparent, ${S.gold} 50%, transparent)`,
              opacity: 0.35,
            }}
          />

          <h3
            style={{
              fontFamily: 'var(--font-display-serif), Cormorant Garamond, Georgia, serif',
              fontSize: 'clamp(1.5rem, 3vw, 2.4rem)',
              fontWeight: 500,
              letterSpacing: '-0.015em',
              color: S.text,
              marginBottom: '0.85rem',
            }}
          >
            {STRATEGIES_JOIN_HEADLINE}
          </h3>

          <p
            style={{
              fontFamily: 'var(--font-sans-body), system-ui, sans-serif',
              fontSize: '0.95rem',
              lineHeight: 1.7,
              color: S.muted,
              maxWidth: '46ch',
              margin: '0 auto 2.25rem',
            }}
          >
            {STRATEGIES_JOIN_BODY}
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
          >
            {/* Primary — WhatsApp, gold gradient */}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="strat-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-sans-body), system-ui, sans-serif',
                fontWeight: 600,
                fontSize: '0.9rem',
                letterSpacing: '0.04em',
                padding: '13px 26px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                background: `linear-gradient(135deg, ${S.goldBright} 0%, ${S.gold} 55%, ${S.goldDeep} 100%)`,
                color: '#0E0F12',
              }}
            >
              Join WhatsApp Channel
            </a>

            {/* Secondary — Instagram, outline */}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="strat-btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-sans-body), system-ui, sans-serif',
                fontWeight: 600,
                fontSize: '0.9rem',
                letterSpacing: '0.04em',
                padding: '12px 26px',
                borderRadius: 999,
                cursor: 'pointer',
                textDecoration: 'none',
                background: 'transparent',
                color: S.goldBright,
                border: `1px solid rgba(195,162,104,0.6)`,
              }}
            >
              Follow on Instagram
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
