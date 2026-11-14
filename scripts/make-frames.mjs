// Generates the versioned WebP frame sets from the original JPEGs. Never writes inside public/assets.
//   public/frames/v1/<seq>/1280/NNN.webp   (1280x720, lite)
//   public/frames/v1/<seq>/p1080/NNN.webp  (864x1080 centre crop, portrait)
import sharp from 'sharp';
import os from 'node:os';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VERSION = 'v1';
const SEQS = ['crypto', 'forex', 'stock_market', 'opportunity'];
const COUNT = 240;
const force = process.argv.includes('--force');
const OUT = join('public', 'frames', VERSION);
const pad3 = (i) => String(i + 1).padStart(3, '0');
const srcPath = (seq, i) => join('public', 'assets', seq, `ezgif-frame-${pad3(i)}.jpg`);

const SETS = {
  1280: { w: 1280, h: 720, make: (s) => s.resize({ width: 1280, kernel: 'lanczos3' }) },
  p1080: { w: 864, h: 1080, make: (s) => s.extract({ left: 528, top: 0, width: 864, height: 1080 }) },
};

function fail(msg) {
  console.error('ERROR:', msg);
  process.exit(1);
}

async function checkInputs() {
  for (const seq of SEQS) {
    const dir = join('public', 'assets', seq);
    if (!existsSync(dir)) fail(`missing ${dir}`);
    const n = readdirSync(dir).filter((f) => /^ezgif-frame-\d{3}\.jpg$/.test(f)).length;
    if (n !== COUNT) fail(`${dir}: expected ${COUNT} frames, found ${n}`);
    for (const i of [0, COUNT - 1]) {
      const m = await sharp(srcPath(seq, i)).metadata();
      if (m.width !== 1920 || m.height !== 1080) fail(`${srcPath(seq, i)} is ${m.width}x${m.height}, expected 1920x1080`);
    }
  }
}

async function main() {
  await checkInputs();
  const jobs = [];
  for (const seq of SEQS) {
    for (const [name, set] of Object.entries(SETS)) {
      mkdirSync(join(OUT, seq, name), { recursive: true });
      for (let i = 0; i < COUNT; i++) jobs.push({ seq, name, set, i });
    }
  }
  let next = 0;
  let written = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const { seq, name, set, i } = jobs[next++];
      const out = join(OUT, seq, name, `${pad3(i)}.webp`);
      if (existsSync(out) && !force) continue;
      await set.make(sharp(srcPath(seq, i))).webp({ quality: 78, effort: 5, smartSubsample: true }).toFile(out);
      if (++written % 100 === 0) console.log('written', written);
    }
  };
  await Promise.all(Array.from({ length: os.availableParallelism() }, worker));

  const sets = {};
  for (const [name, set] of Object.entries(SETS)) {
    let count = 0;
    let bytes = 0;
    for (const seq of SEQS) {
      const dir = join(OUT, seq, name);
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.webp')) continue;
        count++;
        bytes += statSync(join(dir, f)).size;
      }
      for (const i of [0, COUNT - 1]) {
        const m = await sharp(join(dir, `${pad3(i)}.webp`)).metadata();
        if (m.width !== set.w || m.height !== set.h) fail(`${dir}/${pad3(i)}.webp is ${m.width}x${m.height}`);
      }
    }
    if (count !== SEQS.length * COUNT) fail(`set ${name}: ${count} files, expected ${SEQS.length * COUNT}`);
    sets[name] = { w: set.w, h: set.h, count, bytes };
    console.log(`${name}: ${count} files, ${(bytes / 1048576).toFixed(1)} MB`);
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ version: VERSION, generated: new Date().toISOString(), sets }, null, 2));
  console.log('wrote manifest');
}

main().catch((e) => fail(e.stack || String(e)));
