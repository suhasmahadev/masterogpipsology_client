// Deterministic guilloche path builders (1000x1000 viewBox, centre 500,500). Pure, no imports.

const C = 500;
const f = (n: number): string => n.toFixed(2);

/** n radial ticks; every majorEvery-th tick starts at rMajor (longer). Angle i*2π/n - π/2. */
export function tickRing(n: number, rInner: number, rOuter: number, rMajor: number, majorEvery: number): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n - Math.PI / 2;
    const r0 = i % majorEvery === 0 ? rMajor : rInner;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    d += `M ${f(C + r0 * cs)} ${f(C + r0 * sn)} L ${f(C + rOuter * cs)} ${f(C + rOuter * sn)} `;
  }
  return d;
}

/** count circles of radius rCircle, centres on a circle of radius rCentre. */
export function roseRing(count: number, rCentre: number, rCircle: number): string {
  let d = '';
  const r = f(rCircle);
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    const cx = C + rCentre * Math.cos(a);
    const cy = C + rCentre * Math.sin(a);
    d += `M ${f(cx + rCircle)} ${f(cy)} A ${r} ${r} 0 1 0 ${f(cx - rCircle)} ${f(cy)} A ${r} ${r} 0 1 0 ${f(cx + rCircle)} ${f(cy)} `;
  }
  return d;
}

/** lines radial wavy polylines r0 -> r1; angle offset amp*sin(waves*π*u), u in 0..1, steps points each. */
export function sunburst(lines: number, r0: number, r1: number, amp: number, waves: number, steps: number): string {
  let d = '';
  for (let j = 0; j < lines; j++) {
    const base = (j * 2 * Math.PI) / lines;
    for (let s = 0; s < steps; s++) {
      const u = steps > 1 ? s / (steps - 1) : 0;
      const r = r0 + (r1 - r0) * u;
      const a = base + amp * Math.sin(waves * Math.PI * u);
      d += `${s === 0 ? 'M' : 'L'} ${f(C + r * Math.cos(a))} ${f(C + r * Math.sin(a))} `;
    }
  }
  return d;
}

export function circlePath(r: number): string {
  return `M ${f(C + r)} ${f(C)} A ${f(r)} ${f(r)} 0 1 0 ${f(C - r)} ${f(C)} A ${f(r)} ${f(r)} 0 1 0 ${f(C + r)} ${f(C)} `;
}

export function subpathCount(d: string): number {
  let n = 0;
  for (let i = 0; i < d.length; i++) if (d[i] === 'M') n++;
  return n;
}
