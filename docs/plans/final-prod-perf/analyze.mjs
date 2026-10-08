import { readFileSync } from 'node:fs';
const f = process.argv[2];
const { geo, perf: P, metrics, res, trace } = JSON.parse(readFileSync(f, 'utf8'));
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
const M = P.marks;
console.log('file', f, geo);
for (const [a, b, label] of [['A', 'B', 'down'], ['B', 'C', 'up']]) {
  const raf = P.raf.slice(M[a].raf, M[b].raf);
  const s = P.samples.slice(M[a].s, M[b].s);
  const lag = s.map((x) => (x[2] < 0 ? 999 : Math.abs(x[1] - x[2])));
  const blank = s.filter((x) => x[2] === -2).length;
  const exact = lag.filter((x) => x === 0).length;
  const lt = P.longtasks.filter((x) => x[0] >= M[a].t && x[0] < M[b].t);
  const loaf = P.loaf.filter((x) => x.t >= M[a].t && x.t < M[b].t);
  console.log(`\n[${label}] rafs=${raf.length} mean=${(raf.reduce((p, c) => p + c, 0) / raf.length).toFixed(1)} p50=${pct(raf, 0.5)} p95=${pct(raf, 0.95)} p99=${pct(raf, 0.99)} max=${Math.max(...raf)} >20ms=${raf.filter((x) => x > 20).length} >33ms=${raf.filter((x) => x > 33).length} >50ms=${raf.filter((x) => x > 50).length}`);
  console.log(`  samples=${s.length} exactFrame=${exact} (${((exact / s.length) * 100).toFixed(0)}%) lagFrames p50=${pct(lag, 0.5)} p90=${pct(lag, 0.9)} p99=${pct(lag, 0.99)} lag>=5: ${lag.filter((x) => x >= 5).length} lag>=20: ${lag.filter((x) => x >= 20 && x < 999).length} blank=${blank}`);
  console.log(`  longtasks=${lt.length} total=${lt.reduce((p, c) => p + c[1], 0)}ms max=${Math.max(0, ...lt.map((x) => x[1]))}  loaf=${loaf.length}`);
  console.log(`  decodes=${M[b].cib - M[a].cib} draws=${M[b].draws - M[a].draws} drawMs=${(M[b].drawMs - M[a].drawMs).toFixed(0)} fetches=${M[b].fetches - M[a].fetches}`);
  loaf.sort((x, y) => y.d - x.d).slice(0, 6).forEach((l) => console.log('   LoAF', l.d, 'block', l.block, 'render', l.render, 'style', l.style, l.scripts.join(' | ')));
  const bySec = {}; for (const x of s) { const k = x[0]; (bySec[k] ??= []).push(x[2] < 0 ? 999 : Math.abs(x[1] - x[2])); }
  for (const k in bySec) console.log(`   sec ${k}: n=${bySec[k].length} p50=${pct(bySec[k], 0.5)} p90=${pct(bySec[k], 0.9)} max=${Math.max(...bySec[k].filter((x) => x < 999), 0)} blank=${bySec[k].filter((x) => x === 999).length}`);
}
console.log('\nload phase longtasks', P.longtasks.filter((x) => x[0] < M.A.t).map((x) => x[1]).join(','));
console.log('decode ms (createImageBitmap promise latency) p50', pct(P.cibMs, 0.5), 'p95', pct(P.cibMs, 0.95), 'max', Math.max(...P.cibMs), 'n', P.cibMs.length, 'redecode(>2 per blob)', P.redecode, 'inflightMax', P.cibInflightMax, 'fail', P.cibFail);
console.log('draws', P.draws, 'drawMs total', P.drawMs.toFixed(0), 'max', P.drawMax.toFixed(1), 'draws>4ms', P.drawsBig, 'canvasWidthSets', P.canvasResizes);
console.log('live bitmaps now', P.bmpLive, 'max', P.bmpLiveMax, 'MB now', (P.bmpBytes / 1048576).toFixed(0));
console.log('fetches', P.fetches, 'MB', (P.fetchBytes / 1048576).toFixed(1));
const m = Object.fromEntries(metrics.metrics.map((x) => [x.name, x.value]));
console.log('JSHeapUsed MB', (m.JSHeapUsedSize / 1048576).toFixed(0), 'LayoutCount', m.LayoutCount, 'RecalcStyleCount', m.RecalcStyleCount, 'LayoutDuration', m.LayoutDuration?.toFixed(2), 'RecalcStyleDuration', m.RecalcStyleDuration?.toFixed(2), 'ScriptDuration', m.ScriptDuration?.toFixed(2), 'TaskDuration', m.TaskDuration?.toFixed(2));
const agg = {}; for (const e of trace) { const a = (agg[e.n] ??= { n: 0, d: 0, max: 0 }); a.n++; a.d += e.d; a.max = Math.max(a.max, e.d); }
Object.entries(agg).sort((a, b) => b[1].d - a[1].d).slice(0, 18).forEach(([k, v]) => console.log(`  trace ${k}: n=${v.n} total=${(v.d / 1000).toFixed(0)}ms max=${(v.max / 1000).toFixed(1)}ms`));
const rt = res.map((x) => x[1]); console.log('frame resource latency p50', pct(rt, 0.5), 'p95', pct(rt, 0.95), 'max', Math.max(...rt), 'n', rt.length);
