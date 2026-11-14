'use client';

import { useEffect, type RefObject } from 'react';
import { slabPart, slabZone, type PartStyle, type SlabWindow } from '@/lib/crypto-slabs';
import { enterAt, leaveAt, TM_MAX_UNITS } from '@/lib/text-motion';
import { collectUnits, invalidateUnits, writeUnit, type ScrubUnit } from '@/components/motion/scrub-units';

/** Imperative driver: call with the slab coordinate s from the host frame tick. */
export type SlabDriver = { current: ((s: number) => void) | null };

/**
 * Shared scrub loop for slab texts (CryptoSlabs, MarketSlabs). No React state. Each `[data-slab="id"]` under root is shown
 * between its window's in/out spans; units are written (transform + opacity only) from the host tick. Reduced motion = still
 * crossfade per part. `name` prefixes the dev warning.
 */
export function useSlabScrub(
  rootRef: RefObject<HTMLElement | null>,
  ids: readonly string[],
  windows: Readonly<Record<string, SlabWindow>>,
  driverRef: SlabDriver,
  name: string,
): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const slabs: HTMLElement[] = [];
    const parts: HTMLElement[][] = [];
    const units: ScrubUnit[][] = [];
    for (const id of ids) {
      const el = root.querySelector<HTMLElement>(`[data-slab="${id}"]`);
      if (!el) return;
      slabs.push(el);
      parts.push(Array.from(el.querySelectorAll<HTMLElement>('[data-part]')));
      const list = collectUnits(el);
      if (process.env.NODE_ENV !== 'production' && list.length > TM_MAX_UNITS) {
        console.warn(`${name}: "${id}" has ${list.length} animated units (budget ${TM_MAX_UNITS})`);
      }
      units.push(list);
    }
    const lastPartO: string[][] = parts.map((p) => p.map(() => ''));
    const lastVis: string[] = slabs.map(() => '');
    const lastZone: number[] = slabs.map(() => -1);
    const fade: PartStyle = { opacity: 0, y: 0 };
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = mq.matches;
    let last = Number.NaN;

    const apply = (s: number, force?: boolean): void => {
      if (s === last && !force) return;
      last = s;
      for (let i = 0; i < ids.length; i++) {
        const w = windows[ids[i]];
        const zone = slabZone(s, w);
        if (!force && zone === lastZone[i] && (zone & 1) === 0) continue; // before / hold / after: nothing moves
        lastZone[i] = zone;
        let any = false;
        // Reduced: whole parts crossfade, units still. Full motion: parts stay at 1, units move.
        slabPart(s, w, 0, 1, true, fade);
        const po = reduced ? fade.opacity.toFixed(3) : '1';
        if (reduced && fade.opacity > 0.002) any = true;
        const pl = parts[i];
        for (let j = 0; j < pl.length; j++) if (lastPartO[i][j] !== po) { lastPartO[i][j] = po; pl[j].style.opacity = po; }
        const list = units[i];
        for (let k = 0; k < list.length; k++) {
          const u = list[k];
          const op = reduced
            ? writeUnit(u, 1, 0)
            : writeUnit(u, enterAt(s, w.inFrom, w.inTo, u.part, u.parts, u.unit, u.units), leaveAt(s, w.outFrom, w.outTo, u.part, u.parts, u.unit, u.units));
          if (!reduced && op > 0.002) any = true;
        }
        const vis = any ? 'visible' : 'hidden';
        if (vis !== lastVis[i]) { lastVis[i] = vis; slabs[i].style.visibility = vis; }
      }
    };

    const onMq = (e: MediaQueryListEvent): void => {
      reduced = e.matches;
      for (const l of units) invalidateUnits(l);
      for (const p of lastPartO) p.fill('');
      apply(last, true);
    };
    mq.addEventListener('change', onMq);
    driverRef.current = apply;
    apply(-1, true);
    return () => { driverRef.current = null; mq.removeEventListener('change', onMq); };
  }, [rootRef, ids, windows, driverRef, name]);
}
