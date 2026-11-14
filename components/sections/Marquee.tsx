import React from 'react';
// ─── Marquee Strip ────────────────────────────────────────────────────────────
// CSS-driven infinite horizontal scroll of discipline keywords.
// Paused under prefers-reduced-motion.
// Server Component — no client JS needed.

import { MARQUEE_ITEMS } from '@/lib/content';

export function Marquee(): React.ReactElement {
  // Double items for seamless loop
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

  return (
    <section
      aria-label="Trading disciplines"
      className="overflow-hidden py-5 md:py-6 border-t border-b"
      style={{ borderColor: 'var(--hairline)' }}
    >
      <div
        className="marquee-track flex gap-0 items-center"
        aria-hidden="true"
        role="presentation"
      >
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-0 flex-shrink-0">
            <span
              className="font-body font-medium text-sm tracking-wide px-5 whitespace-nowrap"
              style={{ color: 'var(--text-muted)' }}
            >
              {item}
            </span>
            {/* Brass diamond separator */}
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              aria-hidden="true"
              className="flex-shrink-0 opacity-60"
            >
              <rect
                x="4"
                y="0.5"
                width="5"
                height="5"
                rx="0.5"
                transform="rotate(45 4 4)"
                fill="var(--accent)"
              />
            </svg>
          </div>
        ))}
      </div>

      {/* Accessible text for screen readers */}
      <ul className="sr-only">
        {MARQUEE_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
