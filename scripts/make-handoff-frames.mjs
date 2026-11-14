// Bakes the intelligence-layer.mp4 first frame (placed with the runtime lock geometry) into the last 12 opportunity frames.
// Writes ONLY to public/frames/handoff-v1/ and refuses to overwrite (cache rule). Run: npm run handoff
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { videoPlacement } from '../lib/frame-sequence/handoff.ts';
import { UNIQUE_LOCAL } from '../lib/frame-sequence/sources.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/frames/handoff-v1');
const T0 = path.join(ROOT, 'scripts/handoff/intelligence-t0.png');
const W = 1920;
const H = 1080;
const pad3 = (i) => String(i + 1).padStart(3, '0');
const smooth = (x) => x * x * (3 - 2 * x);
let bytes = 0;

async function write(file, pipeline) {
  if (fs.existsSync(file)) throw new Error(`refusing to overwrite ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = await pipeline.toBuffer();
  fs.writeFileSync(file, buf);
  bytes += buf.length;
}

const p = videoPlacement();
const vw = Math.round(1664 * p.k);
const vh = Math.round(1248 * p.k);
const left = Math.round(vw / 2 - 960 - p.dx);
const top = Math.round(vh / 2 - 540 - p.dy);
const locked = await sharp(T0)
  .resize(vw, vh, { kernel: 'lanczos3' })
  .extract({ left, top, width: W, height: H })
  .removeAlpha()
  .raw()
  .toBuffer();

const jpegOpts = { quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' };
const webpOpts = { quality: 78, effort: 5, smartSubsample: true };
const RAMP = UNIQUE_LOCAL.slice(180);

for (let j = 0; j < RAMP.length; j++) {
  const i = RAMP[j];
  const w = smooth((j + 1) / RAMP.length);
  const orig = await sharp(path.join(ROOT, `public/assets/opportunity/ezgif-frame-${pad3(i)}.jpg`)).removeAlpha().raw().toBuffer();
  const out = Buffer.alloc(orig.length);
  for (let k = 0; k < orig.length; k++) out[k] = Math.round(orig[k] * (1 - w) + locked[k] * w);
  const img = () => sharp(out, { raw: { width: W, height: H, channels: 3 } });
  const n = pad3(i);
  await write(path.join(OUT, `opportunity/1920/${n}.jpg`), img().jpeg(jpegOpts));
  await write(path.join(OUT, `opportunity/1280/${n}.webp`), img().resize({ width: 1280, kernel: 'lanczos3' }).webp(webpOpts));
  await write(path.join(OUT, `opportunity/p1080/${n}.webp`), img().extract({ left: 528, top: 0, width: 864, height: 1080 }).webp(webpOpts));
}

await write(path.join(OUT, 'intelligence-t0.jpg'), sharp(T0).resize(1664, 1248).jpeg(jpegOpts));

// Self-check: last written frame vs locked video frame at 480x270.
const small = { width: 480, height: 270, kernel: 'lanczos3' };
const a = await sharp(path.join(OUT, `opportunity/1920/${pad3(239)}.jpg`)).removeAlpha().resize(small).raw().toBuffer();
const b = await sharp(locked, { raw: { width: W, height: H, channels: 3 } }).resize(small).raw().toBuffer();
let s = 0;
for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]);
console.log(`self-check mean abs diff: ${(s / a.length).toFixed(2)} (expect < 2)`);
console.log(`total bytes written: ${bytes} (${(bytes / 1e6).toFixed(2)} MB)`);
