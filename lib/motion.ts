// ─── Shared Motion Tokens ─────────────────────────────────────────────────────
// One source of truth for all easing, spring configs and variant factories.
// Import from here — never define motion params inline in components.

import type { Variants } from 'framer-motion';

// ─── Spring configs ────────────────────────────────────────────────────────────
// framer-motion 13: SpringOptions no longer includes a 'type' field.

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass?: number;
}

/** Snappy interactive feedback — buttons, toggles, pill expansion */
export const SPRING_SNAPPY: SpringConfig = {
  stiffness: 380,
  damping: 36,
  mass: 0.9,
};

/**
 * Responsive and smooth — menu sheet, panel entrance, glass transitions.
 * High damping so it glides to rest without any bounce.
 */
export const SPRING_RESPONSIVE: SpringConfig = {
  stiffness: 160,
  damping: 28,
  mass: 0.85,
};

/**
 * Slow and weighty — hero orchestration, scroll colour trailing.
 * Very high damping means no oscillation; it eases gently like butter.
 */
export const SPRING_HEAVY: SpringConfig = {
  stiffness: 22,
  damping: 18,
  mass: 1.1,
};

/** Specular sheen sweep — mechanical glide */
export const SPRING_SLOW: SpringConfig = {
  stiffness: 50,
  damping: 32,
  mass: 1,
};

// ─── Duration-based easing (for CSS transitions and non-spring Framer Motion) ──

/** Smooth deceleration into rest — the workhorse easing curve */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/** Elegant slow-in slow-out — used for colour cross-fades and background transitions */
export const EASE_IN_OUT_QUART = [0.76, 0, 0.24, 1] as const;

// Keep this alias so existing imports don't break
export const EASE_OUT_QUART = EASE_OUT_EXPO;

// ─── Variant factories ─────────────────────────────────────────────────────────

/**
 * Reveal text from a clip mask (height mask — the line slides up into view).
 * Wrap each headline line in a div with overflow:hidden.
 * Uses EASE_OUT_EXPO for a premium editorial feel.
 */
export const maskRevealVariants: Variants = {
  hidden: { y: '108%', opacity: 0 },
  visible: (i: number = 0) => ({
    y: '0%',
    opacity: 1,
    transition: {
      duration: 0.75,
      ease: EASE_OUT_EXPO,
      delay: 0.05 + i * 0.14,
    },
  }),
};

/**
 * Fade and slide up — used sparingly for non-headline entrances.
 * Slightly longer duration for a luxurious feel.
 */
export const fadeUpVariants: Variants = {
  hidden: { y: 28, opacity: 0 },
  visible: (i: number = 0) => ({
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.7,
      ease: EASE_OUT_EXPO,
      delay: i * 0.09,
    },
  }),
};

/**
 * Container variant that staggers children.
 */
export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.18,
    },
  },
};

/**
 * Draw a path via pathLength.
 */
export const drawVariants: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i: number = 0) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        duration: 1.8,
        ease: EASE_OUT_EXPO,
        delay: i * 0.2,
      },
      opacity: { duration: 0.1, delay: i * 0.2 },
    },
  }),
};

/**
 * Scale up candlestick bars from origin.
 */
export const candleVariants: Variants = {
  hidden: { scaleY: 0, opacity: 0 },
  visible: (i: number = 0) => ({
    scaleY: 1,
    opacity: 1,
    transition: {
      ...SPRING_RESPONSIVE,
      delay: 1.2 + i * 0.1,
    },
  }),
};

/**
 * Staggered list items.
 */
export const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number = 0) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: EASE_OUT_EXPO,
      delay: i * 0.07,
    },
  }),
};

/**
 * Glass sheet full-screen menu — smooth upward rise.
 */
export const sheetVariants: Variants = {
  closed: { opacity: 0, y: '100%' },
  open: {
    opacity: 1,
    y: '0%',
    transition: SPRING_RESPONSIVE,
  },
};

/**
 * Brass rule draw-on animation.
 */
export const brassRuleVariants: Variants = {
  hidden: { scaleX: 0, originX: 0 },
  visible: {
    scaleX: 1,
    transition: {
      duration: 1.0,
      ease: EASE_OUT_EXPO,
      delay: 0.55,
    },
  },
};
