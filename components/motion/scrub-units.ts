import { unitStyle, unitTransform, type UnitKind, type UnitStyle } from '@/lib/text-motion';

export interface ScrubUnit {
  el: HTMLElement; kind: UnitKind; dir: number;
  part: number; parts: number; unit: number; units: number;
  t: string; o: string; // last written transform / opacity
}

/** Mount-time only: [data-u] units grouped by their [data-part] under root, both in DOM order. */
export function collectUnits(root: ParentNode): ScrubUnit[] {
  const partEls = Array.from(root.querySelectorAll<HTMLElement>('[data-part]'));
  const out: ScrubUnit[] = [];
  partEls.forEach((p, pi) => {
    const us = Array.from(p.querySelectorAll<HTMLElement>('[data-u]'));
    us.forEach((el, ui) => {
      out.push({ el, kind: (el.dataset.u as UnitKind) ?? 'rise', dir: el.dataset.dir === '-1' ? -1 : 1,
        part: pi, parts: partEls.length, unit: ui, units: us.length, t: '', o: '' });
    });
  });
  return out;
}

export function invalidateUnits(list: ScrubUnit[]): void { for (const u of list) { u.t = ''; u.o = ''; } }

const st: UnitStyle = { opacity: 0, y: 0, rot: 0, x: 0, scale: 1 };
/** Writes one unit (cached; transform + opacity only). Returns its opacity. Reduced motion: call with (1, 0). */
export function writeUnit(u: ScrubUnit, vin: number, vout: number): number {
  unitStyle(u.kind, vin, vout, st, u.kind === 'track' ? u.unit - (u.units - 1) / 2 : 0);
  const t = unitTransform(u.kind, st, u.dir);
  const o = st.opacity.toFixed(3);
  if (t !== u.t) { u.t = t; u.el.style.transform = t; }
  if (o !== u.o) { u.o = o; u.el.style.opacity = o; }
  return st.opacity;
}
