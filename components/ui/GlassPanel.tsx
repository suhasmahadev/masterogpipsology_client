import React from 'react';
// ─── GlassPanel ───────────────────────────────────────────────────────────────
// Reusable glass material card — used in hero stat panel, floating CTA, etc.
// Same layered recipe as the glass nav bar.

import { type ReactNode } from 'react';
import clsx from 'clsx';

export interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  radius?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const radiusMap = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

export function GlassPanel({ children, className, radius = 'xl' }: GlassPanelProps): React.ReactElement {
  return (
    <div
      className={clsx(
        'glass overflow-hidden',
        radiusMap[radius],
        className,
      )}
    >
      {children}
    </div>
  );
}
