import React from 'react';
// ─── StatRow ──────────────────────────────────────────────────────────────────
// Three-up or four-up stat display, divided by hairlines.

import { Hairline } from './Hairline';
import type { Stat } from '@/lib/content';

export interface StatRowProps {
  stats: Stat[];
  className?: string;
}

export function StatRow({ stats, className }: StatRowProps): React.ReactElement {
  return (
    <div
      className={`flex items-stretch gap-0 ${className ?? ''}`}
      role="list"
    >
      {stats.map((stat, i) => (
        <div key={stat.label} className="flex items-stretch gap-0 flex-1">
          {i > 0 && <Hairline orientation="vertical" className="mx-4 md:mx-6" />}
          <div
            role="listitem"
            className="flex flex-col gap-0.5 py-2"
          >
            <span
              className="font-display font-medium text-xl md:text-2xl text-accent leading-none"
              aria-label={`${stat.value} ${stat.label}`}
            >
              {stat.value}
            </span>
            <span className="text-sm text-text-muted font-body leading-tight">
              {stat.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
