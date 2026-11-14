'use client';

import React, { useRef } from 'react';
import type { HookCopy } from '@/lib/content';
import type { HookWindow } from '@/lib/hook-box';
import { SplitWords } from '@/components/motion/SplitWords';
import { useSlabScrub, type SlabDriver } from '@/components/motion/useSlabScrub';

type Variant = 'crypto' | 'market';

interface Props {
  variant: Variant;
  ids: readonly string[];                          // module constant (lib/hook-box.ts)
  windows: Readonly<Record<string, HookWindow>>;   // module constant
  hooks: readonly HookCopy[];                      // same order and length as ids
  driverRef: SlabDriver;
}

/** One hook: label + rule, plain line, gold line. Crypto = Bodoni rise/tilt; market = Cinzel glide + ticker roll. */
function Hook({ id, copy, variant }: { id: string; copy: HookCopy; variant: Variant }): React.ReactElement {
  const market = variant === 'market';
  const tone = copy.tone === 'dark' ? ' hook--dark' : '';
  return (
    <div data-slab={id} className={`hook hook--${variant}${tone} col-start-1 row-start-1 flex flex-col items-end text-right`}>
      <div data-part className={market
        ? 'hook__label flex items-center gap-2 text-xs font-mono uppercase tracking-widest mb-3'
        : 'cslab__label hook__label'}>
        <span className="tm-mask"><span className="tm-u" data-u={market ? 'glide' : 'rise'}>{copy.label}</span></span>
        <span className="hook__rule" data-u="line" />
      </div>
      <h2 className={market ? 'mslab__title' : 'cslab__title cslab__title--intro'}>
        <span className="sr-only">{copy.title[0]} {copy.title[1]}</span>
        <span aria-hidden="true">
          <span data-part><SplitWords text={copy.title[0]} kind={market ? 'glide' : 'tilt'} /></span>
          <br />
          <em data-part><SplitWords text={copy.title[1]} kind={market ? 'roll' : 'tilt'} letters /></em>
        </span>
      </h2>
    </div>
  );
}

/**
 * The hook box: one top-right box per sequence whose text changes at every step-scroll stop. No React state: scrubbed by the
 * stop coordinate from the host frame tick (useSlabScrub, default cascade). Transform + opacity only.
 * market: grid items for the Forex overlay grid. crypto: its own absolute layer with the same container geometry.
 */
export function HookBox({ variant, ids, windows, hooks, driverRef }: Props): React.ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useSlabScrub(rootRef, ids, windows, driverRef, `HookBox(${variant})`);
  if (process.env.NODE_ENV !== 'production' && hooks.length !== ids.length) {
    console.warn(`HookBox(${variant}): ${hooks.length} hooks for ${ids.length} ids`);
  }
  const items = ids.map((id, i) => hooks[i] && <Hook key={id} id={id} copy={hooks[i]} variant={variant} />);
  if (variant === 'market') return <div ref={rootRef} className="contents">{items}</div>;
  return (
    <div ref={rootRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      <div className="w-full h-full max-w-7xl mx-auto px-5 sm:px-8 md:px-12 lg:px-16 flex flex-col justify-between py-10 md:py-14">
        <div className="grid grid-cols-1 justify-items-end text-right max-w-xl self-end">{items}</div>
      </div>
    </div>
  );
}

export default HookBox;
