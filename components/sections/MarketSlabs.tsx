'use client';

import React, { useRef } from 'react';
import { FOREX_SLAB, OPPORTUNITY_SLAB, STOCK_SLAB, type SlabCopy } from '@/lib/content';
import { MARKET_SLAB_WINDOWS } from '@/lib/market-slabs';
import { SplitWords } from '@/components/motion/SplitWords';
import { useSlabScrub, type SlabDriver } from '@/components/motion/useSlabScrub';

const IDS = ['forex', 'stock', 'opportunity'] as const;
const CHIP = 'tm-u px-3 py-1 rounded-md border border-[#D4AF37]/30 bg-[#FAF6ED]/90 text-[11px] font-mono text-[#38332B] shadow-xs';

function Slab({ id, copy, motion }: { id: 'forex' | 'stock' | 'opportunity'; copy: SlabCopy; motion: 'roll' | 'track' }): React.ReactElement {
  return (
    <div data-slab={id} className="mslab col-start-1 row-start-1 flex flex-col items-end text-right">
      <div data-part className="mslab__label flex items-center gap-2 text-xs font-mono text-[#8C6D23] uppercase tracking-widest mb-3">
        <span className="tm-mask"><span className="tm-u" data-u="glide">{copy.label}</span></span>
        <span className="mslab__rule block w-6 h-px bg-[#D4AF37]" data-u="line" />
      </div>
      <h2 className="mslab__title">
        <span className="sr-only">{copy.title[0]} {copy.title[1]}</span>
        <span aria-hidden="true">
          <span data-part><SplitWords text={copy.title[0]} kind="glide" /></span>
          <br />
          <em data-part>
            {motion === 'roll'
              ? <SplitWords text={copy.title[1]} kind="roll" letters />
              : <SplitWords text={copy.title[1]} kind="track" letters mask={false} />}
          </em>
        </span>
      </h2>
      {copy.body && (
        <p className="mt-4 md:mt-6 text-sm md:text-base font-body text-[#524C42] leading-relaxed max-w-md">
          <span className="sr-only">{copy.body}</span>
          <span data-part aria-hidden="true"><SplitWords text={copy.body} kind="glide" /></span>
        </p>
      )}
      {copy.tags && (
        <div data-part className="mt-6 flex flex-wrap justify-end gap-2.5">
          {copy.tags.map((t) => (
            <span key={t} className="tm-mask tm-mask--chip">
              <span className={CHIP} data-u="glide">{t}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The Forex and Stock slab texts (grid items inside the Forex overlay grid). No React state: scrubbed by the slab coordinate
 * (lib/market-slabs.ts marketSlabX) from the Forex frame tick. Forex = ticker roll, Stock = track-in, both with the glide wipe.
 */
export function MarketSlabs({ driverRef }: { driverRef: SlabDriver }): React.ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useSlabScrub(rootRef, IDS, MARKET_SLAB_WINDOWS, driverRef, 'MarketSlabs');
  return (
    <div ref={rootRef} className="contents">
      <Slab id="forex" copy={FOREX_SLAB} motion="roll" />
      <Slab id="stock" copy={STOCK_SLAB} motion="track" />
      <Slab id="opportunity" copy={OPPORTUNITY_SLAB} motion="track" />
    </div>
  );
}

export default MarketSlabs;
