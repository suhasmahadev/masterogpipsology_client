import { createRequire } from 'node:module';
// Read-only check: run from the repo root. Confirms every 5th frame (0-based i % 5 === 2) repeats i - 1.
const require = createRequire(process.cwd() + '/package.json');
const sharp = require('sharp');
const pad3 = (i) => String(i + 1).padStart(3, '0');
for (const seq of ['crypto', 'forex', 'stock_market', 'opportunity']) {
  let prev = null; const dup = []; const lowNonPattern = []; let maxPattern = 0; let minNonPattern = 1e9;
  for (let i = 0; i < 240; i++) {
    const buf = await sharp(`public/assets/${seq}/ezgif-frame-${pad3(i)}.jpg`).resize(320, 180).greyscale().raw().toBuffer();
    if (prev) {
      let s = 0; for (let k = 0; k < buf.length; k++) s += Math.abs(buf[k] - prev[k]); const d = s / buf.length;
      if (i % 5 === 2) maxPattern = Math.max(maxPattern, d); else minNonPattern = Math.min(minNonPattern, d);
      if (d < 0.08) dup.push(i);
    }
    prev = buf;
  }
  console.log(seq, 'dup count', dup.length, 'all i%5==2:', dup.every((i) => i % 5 === 2), 'pattern frames (i%5==2) max diff', maxPattern.toFixed(3), 'non-pattern min diff', minNonPattern.toFixed(3), 'nonpattern dups', dup.filter((i) => i % 5 !== 2).join(','));
}
