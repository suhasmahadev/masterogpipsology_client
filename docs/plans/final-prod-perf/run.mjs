// Perf harness for docs/plans/final-prod.md. Usage: node run.mjs desktop|mobile out.json  (server on PERF_URL, default http://localhost:3100/)
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const [, , mode, outFile] = process.argv; // desktop | mobile
const mobile = mode === 'mobile';
const PORT = mobile ? 9334 : 9333;
const prof = mkdtempSync(join(tmpdir(), 'mop-perf-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--headless=new', '--no-first-run',
  '--no-default-browser-check', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch {}
  await sleep(250);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const trace = []; let traceDone;
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  else if (d.method === 'Tracing.dataCollected') {
    for (const e of d.params.value) {
      if (e.ph === 'X' && e.dur !== undefined && /GC|Decode|ImageDecode|FireAnimationFrame|UpdateLayoutTree|Layout|Paint|RunTask|HitTest|FunctionCall/.test(e.name)) trace.push({ n: e.name, ts: e.ts, d: e.dur, tid: e.tid, cat: e.cat });
    }
  } else if (d.method === 'Tracing.tracingComplete') traceDone?.();
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); })
  .then((d) => { if (d.error) console.error(method, d.error.message); return d.result; });
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Performance.enable');
await send('Emulation.setDeviceMetricsOverride', mobile
  ? { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
  : { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setCPUThrottlingRate', { rate: mobile ? 4 : 1 });
if (mobile) {
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
}
await send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(join(HERE, 'inject.js'), 'utf8') });
await send('Tracing.start', { categories: 'devtools.timeline,v8,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
await send('Page.navigate', { url: process.env.PERF_URL || 'http://localhost:3100/' });
await sleep(mobile ? 9000 : 6000);
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
const mark = (name) => ev(`(__perf.marks[${JSON.stringify(name)}]={raf:__perf.raf.length,s:__perf.samples.length,lt:__perf.longtasks.length,loaf:__perf.loaf.length,cib:__perf.cib,draws:__perf.draws,drawMs:__perf.drawMs,fetches:__perf.fetches,t:Math.round(performance.now())},1)`);
const geo = await ev(`(()=>{const c=document.getElementById('crypto-sequence').getBoundingClientRect(),f=document.getElementById('forex-sequence').getBoundingClientRect();return {cTop:Math.round(c.top+scrollY),cH:Math.round(c.height),fTop:Math.round(f.top+scrollY),fBottom:Math.round(f.bottom+scrollY),vh:innerHeight,lenis:!!document.documentElement.className.match(/lenis/)}})()`);
console.error('geo', geo);
console.error('after load', await ev(`({fetches:__perf.fetches,bytes:__perf.fetchBytes,cib:__perf.cib,lt:__perf.longtasks.length})`));
await mark('A');
const end = geo.fBottom - geo.vh;
const STEP = 150;
if (!mobile) {
  let y = 0; while (y < end + 300) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: STEP }); y += STEP; await sleep(16); }
} else {
  await ev(`new Promise(r=>{const step=()=>{window.scrollBy(0,55); if(scrollY < ${end+300} && scrollY+innerHeight < document.documentElement.scrollHeight) requestAnimationFrame(step); else r(1)}; requestAnimationFrame(step)})`);
}
await sleep(1500);
await mark('B');
console.error('scrollY after down', await ev('scrollY'));
const back = await ev('scrollY');
if (!mobile) {
  let y = back; while (y > geo.cTop) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: -STEP }); y -= STEP; await sleep(16); }
} else {
  await ev(`new Promise(r=>{const step=()=>{window.scrollBy(0,-55); if(scrollY > ${geo.cTop}) requestAnimationFrame(step); else r(1)}; requestAnimationFrame(step)})`);
}
await sleep(1500);
await mark('C');
const metrics = await send('Performance.getMetrics');
await new Promise(async (r) => { traceDone = r; await send('Tracing.end'); });
const perf = await ev('JSON.parse(JSON.stringify(__perf))');
const res = await ev(`performance.getEntriesByType('resource').filter(e=>/(assets|frames)\\//.test(e.name)).map(e=>[Math.round(e.startTime),Math.round(e.responseEnd-e.startTime),e.transferSize])`);
writeFileSync(outFile, JSON.stringify({ geo, perf, metrics, res, trace }));
ws.close(); chrome.kill();
console.error('done');
process.exit(0);
