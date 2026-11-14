import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const force = process.argv.includes('--force');
const SRC = 'public/background_image.png';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shouldWrite(out) {
  if (existsSync(out) && !force) {
    console.log('skip (exists):', out);
    return false;
  }
  mkdirSync(dirname(out), { recursive: true });
  return true;
}

const hero = () => sharp(SRC, { limitInputPixels: false });

async function main() {
  let out = 'public/hero/hero-3200.jpg';
  if (shouldWrite(out)) {
    await hero().resize({ width: 3200, kernel: 'lanczos3' }).jpeg({ quality: 88, mozjpeg: true }).toFile(out);
    console.log('wrote', out);
  }
  out = 'public/hero/hero-2560.webp';
  if (shouldWrite(out)) {
    await hero().resize({ width: 2560, kernel: 'lanczos3' }).webp({ quality: 85, effort: 6 }).toFile(out);
    console.log('wrote', out);
  }
  out = 'public/hero/hero-1600.webp';
  if (shouldWrite(out)) {
    await hero().resize({ width: 1600, kernel: 'lanczos3' }).webp({ quality: 82 }).toFile(out);
    console.log('wrote', out);
  }

  out = 'public/textures/grain-256.png';
  if (shouldWrite(out)) {
    const n = 256;
    const rnd = mulberry32(7);
    const buf = Buffer.alloc(n * n * 4);
    for (let i = 0; i < n * n; i++) {
      const v = Math.floor(rnd() * 256);
      buf[i * 4] = v;
      buf[i * 4 + 1] = v;
      buf[i * 4 + 2] = v;
      buf[i * 4 + 3] = Math.round(40 + v * 0.25);
    }
    await sharp(buf, { raw: { width: n, height: n, channels: 4 } }).png().toFile(out);
    console.log('wrote', out);
  }

  out = 'public/textures/glow-64.png';
  if (shouldWrite(out)) {
    const n = 64;
    const buf = Buffer.alloc(n * n * 4);
    const c = (n - 1) / 2;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const d = Math.min(1, Math.hypot(x - c, y - c) / c);
        const s = 1 - d;
        const a = Math.round(255 * s * s * (3 - 2 * s));
        const i = (y * n + x) * 4;
        buf[i] = 255;
        buf[i + 1] = 255;
        buf[i + 2] = 255;
        buf[i + 3] = a;
      }
    }
    await sharp(buf, { raw: { width: n, height: n, channels: 4 } }).png().toFile(out);
    console.log('wrote', out);
  }

  const logo = (n) => sharp('public/main_logo.png').resize(n, n, { kernel: 'lanczos3' }).png({ compressionLevel: 9 });
  for (const [name, n] of [['icon-192', 192], ['icon-512', 512], ['apple-icon-180', 180]]) {
    out = `public/brand/${name}.png`;
    if (shouldWrite(out)) {
      await logo(n).toFile(out);
      console.log('wrote', out);
    }
  }

  out = 'public/hero/hero-master-3840.jpg';
  if (shouldWrite(out)) {
    await sharp('hero.png', { limitInputPixels: false })
      .resize({ width: 3840, kernel: 'lanczos3', withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toFile(out);
    console.log('wrote', out);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
