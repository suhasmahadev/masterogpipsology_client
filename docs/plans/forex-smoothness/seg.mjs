// Per-segment metrics. Usage: node seg.mjs out.json [raw|unique]
// lag = |target - drawn| frames; hold = rAF samples where the scroll target moved but the picture did not change
// (same frame, or in raw layout a pulldown duplicate: local % 5 === 2 repeats local - 1).
import { readFileSync } from 'node:fs';
const [, , file, layout = 'raw'] = process.argv;
const U = layout === 'unique'; const PER = U ? 192 : 240; const END = PER * 3 - 1;
const { perf: P } = JSON.parse(readFileSync(file, 'utf8'));
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
const seg = (x) => (x[0] === 'c' ? 'crypto' : x[1] < PER ? 'forex' : x[1] < 2 * PER ? 'stock' : x[1] < END ? 'opp' : 'tail');
const content = (i) => (U || i < 0 ? i : (i % PER) % 5 === 2 ? i - 1 : i);
const M = P.marks;
for (const [a, b, label] of [['A', 'B', 'down'], ['B', 'C', 'up']]) {
  const s = P.samples.slice(M[a].s, M[b].s); const g = {};
  for (let i = 0; i < s.length; i++) {
    const k = seg(s[i]); const o = (g[k] ??= { lag: [], dt: [], blank: 0, moved: 0, hold: 0, dup: 0 });
    if (s[i][2] === -2) o.blank++;
    o.lag.push(s[i][2] < 0 ? 999 : Math.abs(s[i][1] - s[i][2]));
    if (i === 0 || seg(s[i - 1]) !== k || s[i][0] !== s[i - 1][0]) continue;
    o.dt.push(s[i][3] - s[i - 1][3]);
    if (k === 'tail' || s[i][1] === s[i - 1][1]) continue;
    o.moved++;
    if (content(s[i][2]) === content(s[i - 1][2])) { o.hold++; if (s[i][2] !== s[i - 1][2]) o.dup++; }
  }
  console.log(`[${label}]`);
  for (const [k, o] of Object.entries(g)) {
    const lag = o.lag.filter((x) => x < 999);
    const h = o.moved ? `hold=${((100 * o.hold) / o.moved).toFixed(0)}% (dup ${((100 * o.dup) / o.moved).toFixed(0)}%)` : 'hold=-';
    console.log(`  ${k.padEnd(6)} n=${o.lag.length} lag p50=${pct(lag, 0.5)} p90=${pct(lag, 0.9)} p99=${pct(lag, 0.99)} blank=${o.blank} rAF p50=${pct(o.dt, 0.5)} p95=${pct(o.dt, 0.95)} >33ms=${o.dt.filter((x) => x > 33).length} ${h}`);
  }
}
