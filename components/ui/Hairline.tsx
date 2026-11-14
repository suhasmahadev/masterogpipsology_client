'use client';
import React, { useRef } from 'react';
// ─── Hairline ─────────────────────────────────────────────────────────────────
// 1px rule consuming --hairline CSS var. Optionally renders as a brass gradient.
// variant="gold" draws a gold fade-out line (scaleX 0 to 1 once on enter).

import clsx from 'clsx';
import { gsap, useGSAP } from '@/lib/gsap';

export interface HairlineProps {
  orientation?: 'horizontal' | 'vertical';
  brass?: boolean;
  variant?: 'default' | 'gold';
  className?: string;
}

export function Hairline({
  orientation = 'horizontal',
  brass = false,
  variant = 'default',
  className,
}: HairlineProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (variant !== 'gold' || !ref.current) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.from(ref.current, {
        scaleX: 0,
        duration: 1.4,
        ease: 'expo.out',
        scrollTrigger: { trigger: ref.current, start: 'top 92%', once: true },
      });
    },
    { scope: ref, dependencies: [variant] },
  );

  if (variant === 'gold') {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={clsx('h-px w-full', className)}
        style={{ background: 'linear-gradient(90deg, transparent, #D4AF37 50%, transparent)' }}
      />
    );
  }

  if (orientation === 'vertical') {
    return (
      <div
        aria-hidden="true"
        className={clsx(
          'w-px self-stretch',
          brass ? 'brass-rule' : 'bg-hairline',
          className,
        )}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={clsx(
        'h-px w-full',
        brass ? 'brass-rule' : 'bg-hairline',
        className,
      )}
    />
  );
}
