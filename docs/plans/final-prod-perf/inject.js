(() => {
  // LAYOUT 'raw' = 240 frames/seq (before forex-smoothness), 'unique' = 192 frames/seq (pulldown duplicates i%5==2 dropped).
  const U = (window.__LAYOUT || 'raw') === 'unique';
  const PER = U ? 192 : 240; const FP = U ? 5 / 7 : 0.7; const FT = PER * 3;
  const loc = (r) => (U ? (r % 5 === 2 ? -1 : r - Math.floor((r + 2) / 5)) : r);
  const P = (window.__perf = {
    raf: [], longtasks: [], loaf: [], draws: 0, drawMs: 0, drawMax: 0, drawsBig: 0,
    cib: 0, cibMs: [], cibFail: 0, redecode: 0, fetches: 0, fetchFail: 0, fetchBytes: 0,
    samples: [], marks: {}, cibInflight: 0, cibInflightMax: 0, canvasResizes: 0, bmpBytes: 0, bmpLive: 0, bmpLiveMax: 0,
  });
  const blobUrl = new WeakMap(); const decCount = new WeakMap(); const bmpUrl = new WeakMap();
  const origBlob = Response.prototype.blob;
  Response.prototype.blob = function () {
    const u = this.url;
    return origBlob.call(this).then((b) => { if (/\/(assets|frames)\//.test(u)) { blobUrl.set(b, u); P.fetches++; P.fetchBytes += b.size; } return b; });
  };
  const origClose = ImageBitmap.prototype.close;
  ImageBitmap.prototype.close = function () { if (bmpUrl.has(this) && this.width) { P.bmpLive--; P.bmpBytes -= this.width * this.height * 4; } return origClose.call(this); };
  const origCIB = window.createImageBitmap;
  window.createImageBitmap = function (src, ...rest) {
    const t0 = performance.now(); const u = src instanceof Blob ? blobUrl.get(src) : undefined;
    if (src instanceof Blob) { const c = (decCount.get(src) || 0) + 1; decCount.set(src, c); if (c > 2) P.redecode++; }
    P.cibInflight++; P.cibInflightMax = Math.max(P.cibInflightMax, P.cibInflight);
    return origCIB.call(this, src, ...rest).then((bmp) => {
      P.cib++; P.cibInflight--; P.cibMs.push(Math.round(performance.now() - t0));
      if (u) { bmpUrl.set(bmp, u); P.bmpLive++; P.bmpBytes += bmp.width * bmp.height * 4; P.bmpLiveMax = Math.max(P.bmpLiveMax, P.bmpLive); }
      return bmp;
    }, (e) => { P.cibInflight--; P.cibFail++; throw e; });
  };
  const wDesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
  Object.defineProperty(HTMLCanvasElement.prototype, 'width', { get: wDesc.get, set(v) { P.canvasResizes++; wDesc.set.call(this, v); }, configurable: true });
  const frameOf = (u) => {
    if (!u) return -1;
    const m = u.match(/assets\/(\w+)\/ezgif-frame-(\d+)/) || u.match(/frames\/v\d+\/(\w+)\/\w+\/(\d+)\./);
    if (!m) return -1;
    const off = { crypto: 0, forex: 0, stock_market: PER, opportunity: 2 * PER }[m[1]];
    const l = loc((+m[2]) - 1); return l < 0 ? -1 : off + l;
  };
  const lastDrawn = new WeakMap();
  const origDraw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...rest) {
    const t0 = performance.now(); const r = origDraw.call(this, img, ...rest); const d = performance.now() - t0;
    P.draws++; P.drawMs += d; if (d > P.drawMax) P.drawMax = d; if (d > 4) P.drawsBig++;
    lastDrawn.set(this.canvas, frameOf(bmpUrl.get(img))); return r;
  };
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => P.longtasks.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch {}
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => {
      P.loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), block: Math.round(e.blockingDuration), render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0), style: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0),
        scripts: (e.scripts || []).slice(0, 4).map((s) => `${Math.round(s.duration)}ms fl=${Math.round(s.forcedStyleAndLayoutDuration)} ${s.invoker} ${(s.sourceURL || '').split('/').pop()}:${s.sourceCharPosition} ${s.sourceFunctionName}`) });
    })).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
  let last = 0;
  const loop = (t) => {
    if (last) P.raf.push(Math.round((t - last) * 10) / 10); last = t;
    const vh = innerHeight;
    for (const [id, map] of [['crypto-sequence', (p) => Math.round(p * (PER - 1))], ['forex-sequence', (p) => (p < FP ? Math.min(FT - 1, U ? Math.round((p / FP) * (FT - 1)) : Math.floor((p / FP) * FT)) : FT - 1)]]) {
      const s = document.getElementById(id); if (!s) continue;
      const r = s.getBoundingClientRect(); if (r.top > 0 || r.bottom < vh) continue;
      const p = Math.min(1, Math.max(0, -r.top / (r.height - vh)));
      const c = s.querySelector('canvas'); const drawn = c && lastDrawn.has(c) ? lastDrawn.get(c) : -2;
      P.samples.push([id[0], map(p), drawn, Math.round(t)]);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
