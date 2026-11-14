// Decode microbenchmark (needs sample encodes in ./enc/<variant>/). Evidence for docs/plans/final-prod.md section 2.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.argv[2];
const throttle = Number(process.argv[3] || 1);
const PORT = 9335;
const prof = mkdtempSync(join(HERE, 'prof-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [`--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, '--headless=new', '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets; for (let i = 0; i < 60; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.find((t) => t.type === 'page')) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }).then((d) => { if (d.error) console.error(method, d.error.message); return d.result; });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) console.error(r.exceptionDetails); return r.result.value; };
await send('Emulation.setCPUThrottlingRate', { rate: throttle });
const sets = {};
const jdir = join(REPO, 'public/assets/crypto');
sets.jpg1920 = { mime: 'image/jpeg', files: readdirSync(jdir).filter((f, i) => i % 8 === 0).slice(0, 30).map((f) => readFileSync(join(jdir, f)).toString('base64')) };
for (const k of ['webp1920q80', 'webp1280q78', 'webp960q75', 'avif1920q55']) {
  const d = join(HERE, 'enc', k); sets[k] = { mime: k.startsWith('webp') ? 'image/webp' : 'image/avif', files: readdirSync(d).sort().map((f) => readFileSync(join(d, f)).toString('base64')) };
}
await ev(`window.S = ${JSON.stringify(sets)}; 1`);
const cases = [
  ['jpg1920', 'none'], ['jpg1920', 'high1440'], ['jpg1920', 'medium1440'], ['jpg1920', 'low1440'], ['jpg1920', 'high499x1080'],
  ['webp1920q80', 'none'], ['webp1920q80', 'medium1440'], ['webp1280q78', 'none'], ['webp960q75', 'none'], ['avif1920q55', 'none'],
];
for (const [k, mode] of cases) {
  const r = await ev(`(async () => {
    const set = S['${k}']; const blobs = set.files.map(b => new Blob([Uint8Array.from(atob(b), c => c.charCodeAt(0))], { type: set.mime }));
    const opt = (bmpW) => {
      const m = '${mode}';
      if (m === 'none') return undefined;
      if (m === 'high499x1080') return { resizeWidth: 499, resizeHeight: 1080, resizeQuality: 'high' };
      const q = m.replace('1440',''); return { resizeWidth: 1440, resizeHeight: 900, resizeQuality: q };
    };
    const one = async (b) => { const o = opt(); const t = performance.now(); const bmp = o ? await createImageBitmap(b, o) : await createImageBitmap(b); const d = performance.now() - t; bmp.close(); return d; };
    for (const b of blobs.slice(0, 3)) await one(b); // warm
    const seq = []; for (const b of blobs) seq.push(await one(b));
    let gaps=[],lastT=0,run=true; const lp=(t)=>{if(lastT)gaps.push(t-lastT);lastT=t;if(run)requestAnimationFrame(lp)}; requestAnimationFrame(lp); await new Promise(r=>setTimeout(r,100)); let busy=0; const po=new PerformanceObserver(l=>l.getEntries().forEach(e=>busy+=e.duration)); po.observe({type:'long-animation-frame'}); const t0 = performance.now(); await Promise.all(blobs.map(one)); const par = performance.now() - t0; await new Promise(r=>setTimeout(r,100)); run=false; po.disconnect();
    seq.sort((a, b) => a - b);
    return { seqP50: +seq[seq.length >> 1].toFixed(1), seqP95: +seq[Math.floor(seq.length * 0.95)].toFixed(1), parallelFps: +(blobs.length / (par / 1000)).toFixed(0), maxRafGap: Math.round(Math.max(...gaps)), loafMs: Math.round(busy), hc: navigator.hardwareConcurrency, mem: navigator.deviceMemory };
  })()`);
  console.log(k.padEnd(12), mode.padEnd(13), JSON.stringify(r));
}
ws.close(); chrome.kill(); process.exit(0);
