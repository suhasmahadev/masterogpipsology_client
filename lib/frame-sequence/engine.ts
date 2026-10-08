// FrameSequenceEngine: plain TypeScript (no React) frame-sequence loader and renderer.
//
//   fetch()  : compressed Blob cache for every frame, prioritised by distance to the
//              current frame plus a coarse-to-fine stride so a nearby fallback always exists.
//   decode() : createImageBitmap(blob) with NO options (crop/resize run on Chrome's main thread, R1),
//              into a velocity-aware, memory-budgeted, direction-biased bitmap cache shared across
//              engines. Anything outside is close()d. Bitmaps are source-sized, so resizes never re-decode.
//   draw()   : nearest decoded frame, cover-scaled on draw (GPU).

import {
  bitmapBudget,
  computeBackingSize,
  coverDest,
  decodeStride,
  decodeWindow,
  frameVelocity,
  lookahead,
  nearestAvailable,
  pickNextDecode,
  pickNextFetch,
  retryDelayMs,
  type Size,
} from './math';

export interface FrameSequenceEngineOptions {
  /** global index -> URL */
  urls: readonly string[];
  /** Same length as urls (e.g. original JPEGs). Used per frame on 404, or for the whole set if the very first decode fails (format unsupported). */
  fallbackUrls?: readonly string[] | null;
  /** fetched first, never evicted */
  pinned: readonly number[];
  /** Fetched right after pinned on start(), before the IO-triggered full fetch. */
  warm?: readonly number[];
  /** canvas clear colour */
  background: string;
  /** Bitmap size expected before the first decode (initial canvas backing and memory budget). Default 1920x1080. */
  expectedSize?: Size;
  maxConcurrentFetches?: number; // default 6
  maxConcurrentDecodes?: number; // default clamp(floor(hc / 2), 2, 4)
  nearWindow?: number; // default 24
  /** Called after a frame bitmap is successfully decoded. */
  onFrameReady?: (index: number) => void;
}

const FETCH_IDLE = 0;
const FETCH_INFLIGHT = 1;
const FETCH_READY = 2;
const FETCH_FAILED = 3;

const MAX_RETRIES = 4;
/** Typical decode latency: decode where the scroll will be when the bitmap is ready. */
const DECODE_LEAD_SEC = 0.12;
const DEFAULT_SRC: Size = { w: 1920, h: 1080 };

class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

/** Engines currently decoding; the bitmap budget is split evenly between them. */
const enabledEngines = new Set<FrameSequenceEngine>();

export class FrameSequenceEngine {
  readonly total: number;

  private urls: readonly string[];
  private readonly fallbackUrls: readonly string[] | null;
  private readonly warm: readonly number[];
  private readonly expected: Size;
  private readonly pinned: readonly number[];
  private readonly isPinned: Uint8Array;
  private readonly background: string;
  private readonly maxFetches: number;
  private readonly maxDecodes: number;
  private readonly nearWindow: number;
  private readonly onFrameReady?: (index: number) => void;
  private readonly coarse: boolean;
  private readonly mem: number | undefined;

  private fetchState: Uint8Array;
  private retries: Uint8Array;
  private retryAt: Float64Array;
  private perFrameFallback: Uint8Array;
  private blobs: (Blob | null)[];
  private bitmaps: (ImageBitmap | null)[];
  private hasBitmap: Uint8Array;
  private decoding: Uint8Array;
  private needs: Uint8Array;

  private inflightFetches = 0;
  private inflightDecodes = 0;
  private current = 0;
  private dir = 1;
  private src: Size | null = null;
  private backing: Size = { w: 1, h: 1 };
  private budget = 16;
  private fullFetch = false;
  private decodeEnabled = false;
  private started = false;
  private dirty = true;
  private lastDrawn: ImageBitmap | null = null;
  private drawnIdx = -1;
  private destroyed = false;
  private pumpQueued = false;
  private usingFallback = false;
  private decodedAny = false;
  private epoch = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimerAt = Infinity;
  private paused = false;
  private velocity = 0;
  private lastUpdateMs = -1;
  private liveCount = 0;
  private center = 0;

  private css: Size = { w: 0, h: 0 };
  private dpr = 1;

  private readonly abort = new AbortController();
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor(opts: FrameSequenceEngineOptions) {
    this.urls = opts.urls;
    this.total = opts.urls.length;
    this.pinned = opts.pinned.filter((p) => p >= 0 && p < opts.urls.length);
    this.background = opts.background;
    this.maxFetches = opts.maxConcurrentFetches ?? 6;
    const hc = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    this.maxDecodes = opts.maxConcurrentDecodes ?? Math.min(4, Math.max(2, Math.floor(hc / 2)));
    this.nearWindow = opts.nearWindow ?? 24;
    this.onFrameReady = opts.onFrameReady;
    this.fallbackUrls = opts.fallbackUrls && opts.fallbackUrls.length === opts.urls.length ? opts.fallbackUrls : null;
    this.warm = (opts.warm ?? []).filter((p) => p >= 0 && p < opts.urls.length);
    this.expected = opts.expectedSize ?? DEFAULT_SRC;
    this.coarse =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    this.mem =
      typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined;

    const n = this.total;
    this.isPinned = new Uint8Array(n);
    for (const p of this.pinned) this.isPinned[p] = 1;
    this.fetchState = new Uint8Array(n);
    this.retries = new Uint8Array(n);
    this.retryAt = new Float64Array(n);
    this.perFrameFallback = new Uint8Array(n);
    this.blobs = new Array<Blob | null>(n).fill(null);
    this.bitmaps = new Array<ImageBitmap | null>(n).fill(null);
    this.hasBitmap = new Uint8Array(n);
    this.decoding = new Uint8Array(n);
    this.needs = new Uint8Array(n);
    this.budget = bitmapBudget(this.expected, this.mem, n, this.coarse);
  }

  attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.prepareContext();
  }

  /** Begin fetching pinned frames (call from an idle callback). */
  start(): void {
    if (this.destroyed || this.started) return;
    this.started = true;
    this.pump();
  }

  /** Once true stays true. */
  setFullFetch(on: boolean): void {
    if (on && !this.fullFetch) {
      this.fullFetch = true;
      this.schedulePump();
    }
  }

  setDecodeEnabled(on: boolean): void {
    if (this.destroyed || on === this.decodeEnabled) return;
    this.decodeEnabled = on;
    if (!on) {
      enabledEngines.delete(this);
      for (let i = 0; i < this.total; i++) {
        if (this.hasBitmap[i] && !this.isPinned[i]) this.releaseBitmap(i);
      }
    } else {
      enabledEngines.add(this);
    }
    this.markDirty();
    // Budgets are shared: re-split across every enabled engine.
    enabledEngines.forEach((e) => e.markDirty());
  }

  markDirty(): void {
    this.dirty = true;
    this.schedulePump();
  }

  /** A paused engine starts no new fetches or decodes (hidden tab). */
  setPaused(p: boolean): void {
    this.paused = p;
    if (!p) this.schedulePump();
  }

  /** No re-decode: bitmaps are source-sized and drawn cover-scaled. */
  resize(cssW: number, cssH: number, dpr: number): void {
    if (this.destroyed || cssW <= 0 || cssH <= 0) return;
    this.css = { w: cssW, h: cssH };
    this.dpr = dpr;
    this.applyCanvasSize();
  }

  /** Returns the index actually shown, -1 if none. */
  update(frame: number): number {
    if (this.destroyed || this.total === 0) return -1;
    const f = Math.min(this.total - 1, Math.max(0, Math.round(frame)));
    const now = performance.now();
    if (this.lastUpdateMs >= 0) {
      this.velocity = frameVelocity(this.velocity, f - this.current, (now - this.lastUpdateMs) / 1000);
    }
    this.lastUpdateMs = now;
    if (f !== this.current) {
      this.dir = f > this.current ? 1 : -1;
      this.current = f;
      this.dirty = true;
    } else if (Math.abs(this.velocity) > 1) {
      this.dirty = true; // rebalance the window as speed decays
    }
    if (this.dirty) {
      this.dirty = false;
      this.pump();
    }
    const shown = nearestAvailable(this.hasBitmap, f);
    if (shown >= 0) {
      const bmp = this.bitmaps[shown];
      // Never replace what is on screen with a frame that is further from the target.
      if (bmp && bmp !== this.lastDrawn && (this.drawnIdx < 0 || Math.abs(shown - f) <= Math.abs(this.drawnIdx - f))) {
        this.draw(bmp);
        this.lastDrawn = bmp;
        this.drawnIdx = shown;
      }
    }
    return shown;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abort.abort();
    enabledEngines.delete(this);
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    for (let i = 0; i < this.total; i++) {
      const b = this.bitmaps[i];
      if (b) b.close();
      this.bitmaps[i] = null;
      this.hasBitmap[i] = 0;
    }
    this.blobs.fill(null);
    this.lastDrawn = null;
    this.canvas = null;
    this.ctx = null;
  }

  // ── Canvas ────────────────────────────────────────────────────────────────

  private prepareContext(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.backing.w, this.backing.h);
  }

  private applyCanvasSize(): void {
    const canvas = this.canvas;
    if (!canvas || this.css.w <= 0) return;
    const next = computeBackingSize(this.css, this.src ?? this.expected, this.dpr);
    if (next.w === this.backing.w && next.h === this.backing.h && canvas.width === next.w && canvas.height === next.h) {
      return;
    }
    this.backing = next;
    canvas.width = next.w;
    canvas.height = next.h;
    this.prepareContext();
    // Redraw immediately (cover-fit from whatever is decoded) so there is no flash.
    this.lastDrawn = null;
    this.drawnIdx = -1;
    const idx = nearestAvailable(this.hasBitmap, this.current);
    const bmp = idx >= 0 ? this.bitmaps[idx] : null;
    if (bmp) {
      this.draw(bmp);
      this.lastDrawn = bmp;
      this.drawnIdx = idx;
    }
  }

  private recomputeBudget(): void {
    this.budget = bitmapBudget(this.src ?? this.expected, this.mem, this.total, this.coarse);
  }

  private effectiveBudget(): number {
    return Math.max(16, Math.floor(this.budget / Math.max(1, enabledEngines.size)));
  }

  private draw(bmp: ImageBitmap): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const b = this.backing;
    const d = coverDest({ w: bmp.width, h: bmp.height }, b);
    if (bmp.width === b.w && bmp.height === b.h && d.x === 0 && d.y === 0 && d.w === b.w && d.h === b.h) {
      ctx.drawImage(bmp, 0, 0);
    } else {
      ctx.drawImage(bmp, d.x, d.y, d.w, d.h);
    }
  }

  // ── Bitmap bookkeeping ────────────────────────────────────────────────────

  private releaseBitmap(i: number): void {
    const b = this.bitmaps[i];
    this.bitmaps[i] = null;
    this.hasBitmap[i] = 0;
    if (b) {
      if (!this.isPinned[i]) this.liveCount = Math.max(0, this.liveCount - 1);
      if (b === this.lastDrawn) {
        this.lastDrawn = null;
      }
      b.close();
    }
  }

  private score(j: number): number {
    const delta = j - this.center;
    const raw = Math.abs(delta);
    return delta * (this.dir >= 0 ? 1 : -1) < 0 ? raw * 2 : raw;
  }

  /** Free the decoded, non-pinned frame furthest from the target if it is further than frame i. */
  private evictFarther(i: number): boolean {
    let worst = -1;
    let worstScore = -1;
    for (let j = 0; j < this.total; j++) {
      if (!this.hasBitmap[j] || this.isPinned[j]) continue;
      const sc = this.score(j);
      if (sc > worstScore) {
        worstScore = sc;
        worst = j;
      }
    }
    if (worst >= 0 && worstScore > this.score(i)) {
      this.releaseBitmap(worst);
      return true;
    }
    return false;
  }

  // ── Scheduling ────────────────────────────────────────────────────────────

  private schedulePump(): void {
    if (this.pumpQueued || this.destroyed) return;
    this.pumpQueued = true;
    queueMicrotask(() => {
      this.pumpQueued = false;
      this.pump();
    });
  }

  private pump(): void {
    if (this.destroyed) return;

    // 1. Fetches
    const now = performance.now();
    if (this.started && !this.paused) {
      while (this.inflightFetches < this.maxFetches) {
        const i = pickNextFetch(
          this.fetchState,
          this.pinned,
          this.current,
          this.dir,
          this.nearWindow,
          this.fullFetch,
          this.warm,
          this.retryAt,
          now,
        );
        if (i < 0) break;
        this.startFetch(i);
      }
    }
    if (this.paused) return;

    // 2. Decodes
    let lo = 1;
    let hi = 0; // empty window unless decoding is enabled (pinned frames are still decoded)
    let stride = 1;
    let w = 0;
    this.center = this.current;
    if (this.decodeEnabled) {
      w = Math.max(8, this.effectiveBudget() - this.pinned.length);
      const speed = Math.abs(this.velocity);
      const { ahead, behind } = lookahead(speed, w);
      stride = decodeStride(speed, ahead);
      const lead = Math.round(speed * DECODE_LEAD_SEC);
      this.center = Math.min(this.total - 1, Math.max(0, this.current + this.dir * lead));
      [lo, hi] = decodeWindow(this.current, this.dir, this.total, ahead * stride + lead, behind);
      let live = 0;
      for (let i = 0; i < this.total; i++) {
        if (!this.hasBitmap[i] || this.isPinned[i]) continue;
        if (i < lo || i > hi) this.releaseBitmap(i);
        else live++;
      }
      this.liveCount = live;
    }

    const needs = this.needs;
    for (let i = 0; i < this.total; i++) {
      needs[i] = this.fetchState[i] === FETCH_READY && !this.decoding[i] && !this.hasBitmap[i] ? 1 : 0;
    }
    while (this.inflightDecodes < this.maxDecodes) {
      const i = pickNextDecode(needs, this.pinned, this.center, this.dir, lo, hi, stride);
      if (i < 0) break;
      if (!this.isPinned[i] && this.liveCount + this.inflightDecodes >= w && !this.evictFarther(i)) break;
      needs[i] = 0;
      this.startDecode(i);
    }
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────

  private startFetch(i: number): void {
    this.fetchState[i] = FETCH_INFLIGHT;
    this.inflightFetches++;
    const epoch = this.epoch;
    const url = this.perFrameFallback[i] && this.fallbackUrls ? this.fallbackUrls[i] : this.urls[i];
    const high = this.isPinned[i] === 1 || Math.abs(i - this.current) <= this.nearWindow;
    const init = {
      signal: this.abort.signal,
      cache: 'force-cache',
      priority: high ? 'high' : 'low',
    } as RequestInit;

    fetch(url, init)
      .then((res) => {
        if (!res.ok) throw new HttpError(res.status);
        return res.blob();
      })
      .then((blob) => {
        if (this.destroyed || epoch !== this.epoch) return;
        this.blobs[i] = blob;
        this.fetchState[i] = FETCH_READY;
      })
      .catch((err: unknown) => {
        if (this.destroyed || epoch !== this.epoch || (err instanceof DOMException && err.name === 'AbortError')) return;
        const s = err instanceof HttpError ? err.status : 0;
        if (s === 404 && this.fallbackUrls && !this.perFrameFallback[i]) {
          this.perFrameFallback[i] = 1;
          this.fetchState[i] = FETCH_IDLE;
        } else if ((s === 0 || s === 408 || s === 429 || s >= 500) && this.retries[i] < MAX_RETRIES) {
          this.retries[i]++;
          this.retryAt[i] = performance.now() + retryDelayMs(this.retries[i]);
          this.fetchState[i] = FETCH_IDLE;
          this.scheduleRetry(this.retryAt[i]);
        } else {
          this.fetchState[i] = FETCH_FAILED;
        }
      })
      .finally(() => {
        this.inflightFetches--;
        this.dirty = true;
        this.schedulePump();
      });
  }

  /** One timer, for the earliest pending retry. */
  private scheduleRetry(at: number): void {
    if (this.destroyed || (this.retryTimer !== null && at >= this.retryTimerAt)) return;
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimerAt = at;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.retryTimerAt = Infinity;
      this.markDirty();
    }, Math.max(0, at - performance.now()));
  }

  /** The very first decode failed (format unsupported): restart the whole set from the fallback URLs. */
  private switchToFallback(): void {
    if (!this.fallbackUrls) return;
    this.usingFallback = true;
    this.epoch++;
    this.urls = this.fallbackUrls;
    this.fetchState.fill(0);
    this.retries.fill(0);
    this.retryAt.fill(0);
    this.perFrameFallback.fill(0);
    this.blobs.fill(null);
    for (let i = 0; i < this.total; i++) {
      if (this.hasBitmap[i]) this.releaseBitmap(i);
    }
    this.src = null;
    this.liveCount = 0;
    this.markDirty();
  }

  // ── Decode ────────────────────────────────────────────────────────────────

  private startDecode(i: number): void {
    const blob = this.blobs[i];
    if (!blob) return;
    const epoch = this.epoch;
    this.decoding[i] = 1;
    this.inflightDecodes++;

    // No crop/resize options: they run on the renderer main thread in Chrome and make decoding
    // 5-20x slower while blocking rAF (R1). Scaling happens on draw instead (GPU).
    createImageBitmap(blob)
      .then((bmp) => {
        if (this.destroyed || epoch !== this.epoch || (!this.decodeEnabled && !this.isPinned[i])) {
          bmp.close();
          return;
        }
        this.decodedAny = true;
        if (!this.src) {
          this.src = { w: bmp.width, h: bmp.height };
          this.applyCanvasSize();
          this.recomputeBudget();
        }
        const old = this.bitmaps[i];
        this.bitmaps[i] = bmp;
        if (!old && !this.isPinned[i]) this.liveCount++;
        this.hasBitmap[i] = 1;
        if (old) {
          if (old === this.lastDrawn) this.lastDrawn = null;
          old.close();
        }
        this.onFrameReady?.(i);
      })
      .catch(() => {
        if (this.destroyed || epoch !== this.epoch) return;
        if (!this.decodedAny && !this.usingFallback && this.fallbackUrls) {
          this.switchToFallback();
        } else if (this.fallbackUrls && !this.perFrameFallback[i]) {
          this.perFrameFallback[i] = 1;
          this.blobs[i] = null;
          this.fetchState[i] = FETCH_IDLE;
        } else {
          this.fetchState[i] = FETCH_FAILED;
        }
      })
      .finally(() => {
        this.decoding[i] = 0;
        this.inflightDecodes--;
        this.dirty = true;
        this.schedulePump();
      });
  }
}
