'use client';

// ─── Stepped frame scrolling ──────────────────────────────────────────────────
// Every wheel/trackpad/touch/key gesture moves at least one stop. Extra same-direction gestures extend the glide straight
// through stops (continuous velocity, brake only into the final stop); input during a hold is queued, never dropped. Fast
// streaks speed the glide up, a tap eases into the nearest reachable stop, an opposite gesture brakes and returns.
// Glides are driven per frame on the shared ticker (stepGlide, delta time). Policy and tunables: lib/step-scroll.ts.

import { useEffect, useState } from 'react';
import type Lenis from 'lenis';
import type { VirtualScrollData } from 'lenis';
import { addScrollGate, useLenis } from '@/components/providers/LenisProvider';
import type { SequenceLayout } from '@/components/hooks/useFrameSequence';
import { onEveryFrame } from '@/lib/frame-loop';
import { scrollStore } from '@/lib/scroll-store';
import {
  AUTO_ADVANCE_MS,
  HOLD_MIN_MS,
  KEY_ARROW_PX,
  KEY_PAGE_SHARE,
  MOMENTUM_WINDOW_MS,
  OVERFLOW_UNLOCK_MS,
  REST_SNAP_FRAMES,
  SETTLE_IDLE_MS,
  STEP_FPS,
  STEP_TUNING,
  STOP_TOL_PX,
  classifyTouchEnd,
  classifyWheel,
  createGlide,
  createStreak,
  createWheelGesture,
  decideStep,
  feedWheel,
  holdMs,
  nearestStop,
  nextStreak,
  pathFrames,
  pathY,
  pushPending,
  queuedHoldUntil,
  reversePlan,
  runTarget,
  runUsed,
  sectionProgressOf,
  speedMult,
  stepGlide,
  stopAt,
  stopCoord,
  streakLevelAt,
  tapTarget,
  touchAxis,
  type FrameMap,
  type GlideState,
  type InputDevice,
  type Pending,
  type StreakState,
} from '@/lib/step-scroll';

export interface StepScrollOptions {
  /** Stop list indices, ascending (Crypto [0, 89, 110, 142]; Forex chain [0, 50, 88, 154, 217]). */
  stops: readonly number[];
  /** Frame list length (Crypto 192). */
  total: number;
  /** Scroll progress <-> frame position of the sequence (Crypto: knot map, Forex: linear map). */
  map: FrameMap;
  /** Cruise speed in list frames per second. Default STEP_FPS. */
  fps?: number;
  /** Extra last stop at a scroll offset (not a frame): Crypto = ForexFade end, Forex frame 1 opaque. Frame there is not snapped. */
  tail?: (l: Readonly<SequenceLayout>) => number;
  /** Virtual list frames for the tail segment (last frame stop -> tail), so a glide there follows the speed rule even though no
   *  frame moves (Forex: the video hand-off). */
  tailFrames?: number;
  /** ys index whose landing from a downward glide auto-glides on to the next stop after the hold (Forex: O3 -> video). */
  autoAdvance?: number;
}

interface TouchState {
  active: boolean;
  multi: boolean;
  x0: number;
  y0: number;
  engaged: boolean;   // started inside the zone or while busy: moves are cancelled unless released
  decided: boolean;   // first move evaluated
  released: boolean;  // native for the rest of this touch (exit or horizontal)
  committed: boolean; // this touch already stepped (or must never step)
  lastEnd: number;    // performance.now() of the last touchend
  t0: number;         // performance.now() of the touchstart
  travel: number;     // max distance from the start point (px)
  moving: boolean;    // a glide was running or steps were pending at touchstart
}

type Timer = ReturnType<typeof setTimeout> | null;

// Both step-scroll controllers live on one page and share the scroll offset Y0 (Crypto's last stop = Forex's first stop).
const registry = new Set<StepScrollController>();
const motion = {
  owner: null as StepScrollController | null, // controller whose glide is running
  gliding: false,
  g: null as GlideState | null,
  stop: -1,              // owner's target stop index (ys index)
  extraSteps: 0,         // run continues this many stops into `next` after the owner's edge stop
  next: null as StepScrollController | null,
  dir: 1 as 1 | -1,
  lockSpeed: false,      // auto-advance glide: always 1x, never extended
  holdUntil: 0,          // one landing hold for all controllers
  landedAt: -1e12,
  device: 'wheel' as InputDevice,
  streak: createStreak() as StreakState,
  pending: { dir: 1, count: 0 } as Pending,     // queued during a hold
  dispatchTimer: null as Timer,
  autoArmed: false,
  lastCounted: null as Event | null,            // event de-dupe: every controller's gate sees the same event object
  lastQueued: null as Event | null,
  lastTap: null as Event | null,
  zoneOn: false,
};

export class StepScrollController {
  private readonly stops: readonly number[];
  private readonly total: number;
  private readonly map: FrameMap;
  private readonly fps: number;
  private readonly tail?: (l: Readonly<SequenceLayout>) => number;
  private readonly tailFrames?: number;
  private readonly autoAdvance?: number;

  private ys: number[] = [];
  private layout: SequenceLayout = { top: 0, height: 0, viewportH: 0 };
  private ready = false;
  private firstLayout = true;
  private lenis: Lenis | null = null;

  private fs: number[] = [];
  private wheelAcc = 0;
  private wheelDevice: InputDevice = 'wheel';
  private unTick: (() => void) | null = null;
  private lastWriteY = 0;
  private restStop = -1;
  private restIdx = -1;

  private wheel = createWheelGesture();
  private acted: { id: number; kind: 'consume' | 'pass' } = { id: 0, kind: 'pass' }; // wheel ids >= 1, key ids <= -1
  private keySeq = 0;
  private touch: TouchState = {
    active: false, multi: false, x0: 0, y0: 0, engaged: false, decided: false, released: false, committed: false, lastEnd: -1e12,
    t0: 0, travel: 0, moving: false,
  };

  private prevY = 0;
  private inCatch = false;
  private locked = false;
  private settleTimer: Timer = null;
  private unlockTimer: Timer = null;
  private autoTimer: Timer = null;

  constructor(options: StepScrollOptions) {
    this.stops = options.stops;
    this.total = options.total;
    this.map = options.map;
    this.fps = options.fps ?? STEP_FPS;
    this.tail = options.tail;
    this.tailFrames = options.tailFrames;
    this.autoAdvance = options.autoAdvance;
  }

  // ── Public API (called by the section) ──

  onLayout = (l: Readonly<SequenceLayout>): void => {
    this.layout = { top: l.top, height: l.height, viewportH: l.viewportH };
    const range = l.height - l.viewportH;
    const base = this.stops.map((i) => l.top + this.map.progress(i) * range);
    if (this.tail && base.length > 0) {
      const t = Math.min(l.top + range, this.tail(l));
      if (t > base[base.length - 1] + STOP_TOL_PX) base.push(t);
    }
    this.ys = base;
    const nf: number[] = [];
    for (let k = 0; k < base.length; k++) {
      let f = k < this.stops.length ? this.stops[k] : this.posAt(base[k]) + (this.tailFrames ?? 0);
      if (k > 0) f = Math.max(f, nf[k - 1] + 1e-3);
      nf.push(f);
    }
    this.fs = nf;
    this.ready = l.height > l.viewportH && this.ys.length > 0;
    if (!this.ready) return;
    if (!motion.gliding) {
      const y = this.y();
      if (this.restStop >= 0 && Math.abs(y - this.ys[this.restStop]) > STOP_TOL_PX) {
        this.jump(this.ys[this.restStop]); // a resize moved the stop
      } else if (this.firstLayout && this.inZone(y) && stopAt(this.ys, y, STOP_TOL_PX) < 0) {
        this.jump(this.ys[nearestStop(this.ys, y)]); // reload restored mid-zone
      }
    }
    this.firstLayout = false;
    this.prevY = this.y();
    this.refreshRest();
    const g = motion.g;
    if (motion.owner === this && g) {
      g.target = this.fs[motion.stop];
      if (motion.extraSteps > 0) this.setExtra(motion.extraSteps);
      if (Number.isFinite(g.limit)) g.limit = g.limit > g.x ? this.fs[this.fs.length - 1] : this.fs[0];
    }
  };

  /** Exact stop index while resting on it, else the computed position. */
  frameFor = (pos: number): number =>
    this.restIdx >= 0 && Math.abs(pos - this.restIdx) <= REST_SNAP_FRAMES ? this.restIdx : pos;

  /** Stop coordinate for a scroll offset (slab texts, rail). */
  coord = (scroll: number): number => {
    const n = this.ys.length;
    if (n === 0) return -1;
    const end = this.layout.top + (this.layout.height - this.layout.viewportH);
    const exit = this.ys.length > this.stops.length ? this.layout.viewportH : end - this.ys[n - 1]; // the hand-off fade
    return stopCoord(scroll, this.ys, this.layout.viewportH, exit);
  };

  attach(lenis: Lenis | null): () => void {
    this.lenis = lenis;
    registry.add(this);
    this.prevY = this.ready ? this.y() : 0;
    const offs: Array<() => void> = [];
    if (lenis) {
      offs.push(addScrollGate(this.onInput));
      offs.push(lenis.on('scroll', this.onScroll));
    } else {
      // Reduced motion (no Lenis): own non-passive listeners, same policy, instant jumps.
      const onWheel = (e: WheelEvent): void => {
        const m = e.deltaMode === 1 ? 100 / 6 : e.deltaMode === 2 ? window.innerHeight : 1; // same as Lenis VirtualScroll
        this.onInput({ deltaX: e.deltaX * m, deltaY: e.deltaY * m, event: e });
      };
      const onTouch = (e: TouchEvent): void => {
        this.onInput({ deltaX: 0, deltaY: 0, event: e });
      };
      const opt: AddEventListenerOptions = { passive: false };
      const onScroll = (): void => this.onScroll();
      window.addEventListener('wheel', onWheel, opt);
      window.addEventListener('touchstart', onTouch, opt);
      window.addEventListener('touchmove', onTouch, opt);
      window.addEventListener('touchend', onTouch, opt);
      window.addEventListener('scroll', onScroll, { passive: true });
      offs.push(() => {
        window.removeEventListener('wheel', onWheel, opt);
        window.removeEventListener('touchstart', onTouch, opt);
        window.removeEventListener('touchmove', onTouch, opt);
        window.removeEventListener('touchend', onTouch, opt);
        window.removeEventListener('scroll', onScroll);
      });
    }
    if (lenis) {
      const guard: AddEventListenerOptions = { passive: false };
      window.addEventListener('touchmove', this.onTouchMoveGuard, guard);
      offs.push(() => window.removeEventListener('touchmove', this.onTouchMoveGuard, guard));
    }
    window.addEventListener('keydown', this.onKey);
    offs.push(() => window.removeEventListener('keydown', this.onKey));
    this.refreshRest();
    return () => {
      for (const off of offs) off();
      if (motion.owner === this) this.abortGlide();
      if (this.unTick) {
        this.unTick();
        this.unTick = null;
      }
      registry.delete(this);
      if (registry.size === 0) {
        if (motion.dispatchTimer) clearTimeout(motion.dispatchTimer);
        motion.dispatchTimer = null;
        document.documentElement.classList.remove('step-zone');
        motion.zoneOn = false;
      }
      if (this.settleTimer) clearTimeout(this.settleTimer);
      if (this.unlockTimer) clearTimeout(this.unlockTimer);
      if (this.autoTimer) clearTimeout(this.autoTimer);
      this.settleTimer = this.unlockTimer = this.autoTimer = null;
      if (this.locked) {
        this.locked = false;
        document.documentElement.style.overflow = '';
      }
      this.lenis = null;
    };
  }

  // ── Helpers ──

  private y(): number {
    return this.lenis ? this.lenis.animatedScroll : window.scrollY;
  }

  private busy(): boolean {
    return motion.gliding || performance.now() < motion.holdUntil;
  }

  private inZone(y: number): boolean {
    const n = this.ys.length;
    return n > 0 && y >= this.ys[0] - STOP_TOL_PX && y <= this.ys[n - 1] + STOP_TOL_PX;
  }

  /** true if y lies inside another registered controller's stop zone. */
  private foreign(y: number): boolean {
    for (const c of registry) if (c !== this && c.ready && c.inZone(y)) return true;
    return false;
  }

  private posAt(y: number): number {
    return this.map.pos(sectionProgressOf(y, this.layout.top, this.layout.height, this.layout.viewportH));
  }

  private refreshRest(): void {
    const L = this.lenis;
    const moving = motion.gliding || (L !== null && L.isScrolling !== false);
    const k = moving || !this.ready ? -1 : stopAt(this.ys, this.y(), STOP_TOL_PX);
    if (k >= 0 && this.restStop < 0) {
      const now = performance.now(); // landing / catch / settle / jump: default hold (land() overwrites it)
      if (now + HOLD_MIN_MS > motion.holdUntil) {
        motion.holdUntil = now + HOLD_MIN_MS;
        motion.landedAt = now;
      }
    }
    this.restStop = k;
    this.restIdx = k >= 0 && k < this.stops.length ? this.stops[k] : -1;
  }

  private jump(Y: number): void {
    if (this.lenis) this.lenis.scrollTo(Y, { immediate: true, force: true });
    else window.scrollTo({ top: Y, behavior: 'instant' });
    this.refreshRest();
  }

  /** The mobile menu, the gallery modal, or another locked glide such as Start journey take precedence. */
  private blocked(): boolean {
    const L = this.lenis;
    return !!L && (L.isStopped || L.isLocked);
  }

  private onTouchMoveGuard = (e: TouchEvent): void => {
    const t = this.touch;
    if (t.active && !t.multi && t.engaged && t.decided && !t.released && !this.blocked() && e.cancelable) e.preventDefault();
  };

  private autoStop(dir: 1 | -1): number {
    return dir > 0 && this.autoAdvance !== undefined ? this.autoAdvance : -1;
  }

  private edgeIdx(dir: 1 | -1): number {
    return dir > 0 ? this.ys.length - 1 : 0;
  }

  private neighbour(dir: 1 | -1): StepScrollController | null {
    const opp: 1 | -1 = dir > 0 ? -1 : 1;
    for (const c of registry) {
      if (c !== this && c.ready && stopAt(c.ys, this.ys[this.edgeIdx(dir)], STOP_TOL_PX) === c.edgeIdx(opp)) return c;
    }
    return null;
  }

  // ── Motion ──

  private glideTo(k: number, o: { auto?: boolean; extraSteps?: number } = {}): void {
    const Y = this.ys[k];
    this.restStop = -1;
    this.restIdx = -1;
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
    motion.autoArmed = false;
    const y0 = this.y();
    const dir: 1 | -1 = Y >= y0 ? 1 : -1;
    if (!this.lenis) {
      // Reduced motion: jump straight to the run's final stop, then land (same hold / queue rules).
      const nb = o.extraSteps ? this.neighbour(dir) : null;
      if (o.extraSteps && nb) {
        const r = runTarget(nb.ys.length, nb.edgeIdx(dir > 0 ? -1 : 1), dir, o.extraSteps, nb.autoStop(dir));
        nb.jump(nb.ys[r.stop]);
        nb.land(r.stop, dir);
        return;
      }
      this.jump(Y);
      this.land(k, dir);
      return;
    }
    const x0 = pathFrames(y0, this.ys, this.fs);
    if (Math.abs(this.fs[k] - x0) < 1e-3 && !o.extraSteps) {
      this.jump(Y);
      this.land(k, dir);
      return;
    }
    const now = performance.now();
    const m = o.auto ? 1 : speedMult(streakLevelAt(motion.streak, now), motion.device);
    motion.owner = this;
    motion.gliding = true;
    motion.stop = k;
    motion.dir = dir;
    motion.lockSpeed = !!o.auto;
    motion.extraSteps = 0;
    motion.next = null;
    motion.g = createGlide(x0, this.fs[k], m);
    if (o.extraSteps) this.setExtra(o.extraSteps);
    this.lastWriteY = y0;
    StepScrollController.syncZone(y0);
    if (!this.unTick) this.unTick = onEveryFrame(this.tick, 'update');
  }

  /** Owner: the run continues `steps` stops into the neighbour controller. */
  private setExtra(steps: number): boolean {
    const g = motion.g;
    const dir = motion.dir;
    const reset = (): boolean => {
      motion.extraSteps = 0;
      motion.next = null;
      if (g) g.extra = 0;
      return false;
    };
    if (!g || steps <= 0 || motion.stop !== this.edgeIdx(dir)) return reset();
    const nb = this.neighbour(dir);
    if (!nb) return reset();
    const e0 = nb.edgeIdx(dir > 0 ? -1 : 1);
    const r = runTarget(nb.ys.length, e0, dir, steps, nb.autoStop(dir));
    const got = Math.abs(r.stop - e0);
    motion.extraSteps = got;
    motion.next = got > 0 ? nb : null;
    g.extra = got > 0 ? Math.abs(nb.fs[r.stop] - nb.fs[e0]) : 0;
    return got > 0;
  }

  /** Owner, same-direction gesture while gliding: move the target one stop further (capped). */
  private extendRun(maxUsed: number): void {
    const g = motion.g;
    if (!g || motion.lockSpeed) return;
    const dir = motion.dir;
    if (runUsed(this.fs, g.x, dir, motion.stop, motion.extraSteps) >= maxUsed) return;
    if (motion.extraSteps > 0) {
      this.setExtra(motion.extraSteps + 1);
      return;
    }
    const r = runTarget(this.ys.length, motion.stop, dir, 1, this.autoStop(dir));
    if (r.stop !== motion.stop) {
      motion.stop = r.stop;
      g.target = this.fs[r.stop];
      return;
    }
    if (r.rest > 0) this.setExtra(1); // otherwise: at O3 or an exit edge, absorbed
  }

  private tick = (_ts: number, deltaMs: number): void => {
    const g = motion.g;
    const L = this.lenis;
    if (!g || !L || motion.owner !== this || !motion.gliding) {
      if (this.unTick) {
        this.unTick();
        this.unTick = null;
      }
      return;
    }
    if (L.isStopped || L.isLocked || Math.abs(L.targetScroll - this.lastWriteY) > 1) {
      this.abortGlide();
      return;
    }
    if (!motion.lockSpeed) g.multTarget = speedMult(streakLevelAt(motion.streak, performance.now()), motion.device);
    const res = stepGlide(g, deltaMs / 1000);
    if (res === 'edge') {
      this.handover();
      return;
    }
    this.write(res === 'land' ? this.ys[motion.stop] : pathY(g.x, this.ys, this.fs));
    if (res === 'land') this.land(motion.stop, motion.dir);
  };

  private write(y: number): void {
    const L = this.lenis;
    if (!L) return;
    const prev = this.y();
    L.scrollTo(y, { immediate: true, force: true });
    this.lastWriteY = y;
    scrollStore.velocity = y - prev;
    scrollStore.direction = y > prev ? 1 : y < prev ? -1 : 0;
  }

  /** Owner's glide passed its edge stop with extra > 0: hand the glide state to the neighbour (same frames/s velocity). */
  private handover(): void {
    const g = motion.g!;
    const nb = motion.next;
    const dir = motion.dir;
    if (!nb) {
      g.extra = 0;
      this.write(this.ys[motion.stop]);
      this.land(motion.stop, dir);
      return;
    }
    const over = Math.abs(g.x - g.target);
    const e0 = nb.edgeIdx(dir > 0 ? -1 : 1);
    const r = runTarget(nb.ys.length, e0, dir, motion.extraSteps, nb.autoStop(dir));
    g.x = nb.fs[e0] + dir * over;
    g.target = nb.fs[r.stop];
    g.extra = 0;
    g.limit = NaN;
    motion.owner = nb;
    motion.stop = r.stop;
    motion.extraSteps = 0;
    motion.next = null;
    if (this.unTick) {
      this.unTick();
      this.unTick = null;
    }
    nb.lastWriteY = this.lastWriteY;
    nb.unTick = onEveryFrame(nb.tick, 'update');
    nb.write(pathY(g.x, nb.ys, nb.fs));
  }

  private land(k: number, dir: 1 | -1): void {
    const now = performance.now();
    motion.gliding = false;
    motion.owner = null;
    motion.g = null;
    motion.extraSteps = 0;
    motion.next = null;
    if (this.unTick) {
      this.unTick();
      this.unTick = null;
    }
    if (this.lenis && Math.abs(this.y() - this.ys[k]) > 0.5) this.lenis.scrollTo(this.ys[k], { immediate: true, force: true });
    scrollStore.velocity = 0;
    scrollStore.direction = 0;
    for (const c of registry) c.refreshRest();
    const level = streakLevelAt(motion.streak, now);
    motion.landedAt = now;
    if (this.autoAdvance === k && dir > 0) {
      motion.pending = { dir: 1, count: 0 };
      motion.holdUntil = now + HOLD_MIN_MS;
      motion.autoArmed = true;
      this.armAuto(k);
      StepScrollController.syncZone(this.y());
      return;
    }
    motion.holdUntil = now + holdMs(level, motion.pending.count > 0, motion.device);
    StepScrollController.scheduleDispatch();
    StepScrollController.syncZone(this.y());
  }

  private abortGlide(): void {
    motion.gliding = false;
    motion.owner = null;
    motion.g = null;
    motion.extraSteps = 0;
    motion.next = null;
    motion.pending = { dir: motion.pending.dir, count: 0 };
    if (this.unTick) {
      this.unTick();
      this.unTick = null;
    }
    scrollStore.velocity = 0;
    for (const c of registry) c.refreshRest();
  }

  /** Owner: an opposite-direction gesture while gliding. Brake, then return to the nearest stop behind. */
  private reverse(dir: 1 | -1): void {
    const g = motion.g;
    if (!g) return;
    const plan = reversePlan(this.fs, g.x, g.v, dir);
    motion.stop = plan.stop;
    motion.dir = dir;
    g.target = this.fs[plan.stop];
    g.limit = plan.limit;
    g.extra = 0;
    motion.extraSteps = 0;
    motion.next = null;
    motion.pending = { dir, count: 0 };
    motion.lockSpeed = false;
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
    motion.autoArmed = false;
  }

  /** Owner: a tap while gliding. Ease into the nearest stop that can be reached on the brake curve. */
  private tapRetarget(): void {
    const g = motion.g;
    if (!g) return;
    const j = tapTarget(this.fs, g.x, g.v, g.mult);
    if (j >= 0 && motion.dir * (j - motion.stop) <= 0) {
      motion.stop = j;
      g.target = this.fs[j];
      g.extra = 0;
      motion.extraSteps = 0;
      motion.next = null;
    } else if (j < 0 && motion.extraSteps > 1) {
      this.setExtra(1);
    }
  }

  private armAuto(k: number): void {
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null;
      if (!this.ready || motion.gliding || this.blocked() || this.touch.active || stopAt(this.ys, this.y(), STOP_TOL_PX) !== k) {
        motion.autoArmed = false;
        return;
      }
      this.glideTo(k + 1, { auto: true });
    }, AUTO_ADVANCE_MS);
  }

  /** Wheel and keys, entry: ease into an edge stop with Lenis's own lerp. */
  private catchTo(k: number): void {
    const Y = this.ys[k];
    const L = this.lenis;
    if (!L) {
      this.jump(Y);
      return;
    }
    if (L.targetScroll !== Y) L.scrollTo(Y, { programmatic: false, lerp: L.options.lerp, force: true });
  }

  // ── Shared (static) helpers ──

  private static count(e: Event, dir: 1 | -1, device: InputDevice, now: number, repeat: boolean): void {
    if (motion.lastCounted === e) return;
    motion.lastCounted = e;
    motion.device = device;
    if (!repeat) motion.streak = nextStreak(motion.streak, now, dir);
  }

  private static enqueue(e: Event, dir: 1 | -1, repeat: boolean, now: number): void {
    if (motion.lastQueued === e) return;
    motion.lastQueued = e;
    motion.pending = pushPending(motion.pending, dir, repeat);
    motion.holdUntil = queuedHoldUntil(motion.holdUntil, motion.landedAt, now, streakLevelAt(motion.streak, now), motion.device);
    StepScrollController.scheduleDispatch();
  }

  private static scheduleDispatch(): void {
    if (motion.dispatchTimer) clearTimeout(motion.dispatchTimer);
    motion.dispatchTimer = null;
    if (motion.pending.count <= 0 || motion.gliding) return;
    motion.dispatchTimer = setTimeout(StepScrollController.dispatch, Math.max(0, motion.holdUntil - performance.now()));
  }

  private static dispatch = (): void => {
    motion.dispatchTimer = null;
    if (motion.gliding || motion.pending.count <= 0) return;
    if (performance.now() < motion.holdUntil - 1) {
      StepScrollController.scheduleDispatch();
      return;
    }
    const { dir, count } = motion.pending;
    motion.pending = { dir, count: 0 }; // cleared before gliding: reduced-motion land() is synchronous
    for (const c of registry) if (c.tryPending(dir, count)) return;
  };

  private static tapStop(e: Event): void {
    if (motion.lastTap === e) return;
    motion.lastTap = e;
    motion.pending = { dir: motion.pending.dir, count: 0 };
    if (motion.dispatchTimer) clearTimeout(motion.dispatchTimer);
    motion.dispatchTimer = null;
    motion.streak = createStreak();
    if (motion.gliding) motion.owner?.tapRetarget();
  }

  private static syncZone(y: number): void {
    let on = motion.gliding;
    if (!on) for (const c of registry) if (c.ready && c.inZone(y)) { on = true; break; }
    if (on === motion.zoneOn) return;
    motion.zoneOn = on;
    document.documentElement.classList.toggle('step-zone', on);
  }

  private tryPending(dir: 1 | -1, count: number): boolean {
    if (!this.ready || this.blocked()) return false;
    const y = this.y();
    const a = decideStep(this.ys, STOP_TOL_PX, { y, target: y + dir, dir, fresh: true, acted: null, foreign: this.foreign(y), busy: false });
    if (a.kind !== 'glide') return false;
    const r = runTarget(this.ys.length, a.stop, dir, count - 1, this.autoStop(dir));
    this.glideTo(r.stop, { extraSteps: r.rest });
    return true;
  }

  /** The gesture core. true = let the event through (native). */
  private gesture(dir: 1 | -1, device: InputDevice, e: Event, target: number,
    o: { id?: number; repeat?: boolean; noPrevent?: boolean } = {}): boolean {
    const now = performance.now();
    const consume = (): boolean => {
      if (o.id !== undefined) this.acted = { id: o.id, kind: 'consume' };
      if (!o.noPrevent && e.cancelable) e.preventDefault();
      return false;
    };
    if (motion.gliding) {
      if (motion.owner !== this) {
        if (o.id !== undefined) this.acted = { id: o.id, kind: 'consume' };
        return true;
      }
      StepScrollController.count(e, dir, device, now, !!o.repeat);
      if (dir === motion.dir) this.extendRun(o.repeat ? 1 : STEP_TUNING.queue.max);
      else this.reverse(dir);
      return consume();
    }
    const y = this.y();
    const a = decideStep(this.ys, STOP_TOL_PX, { y, target, dir, fresh: true, acted: null, foreign: this.foreign(y), busy: false });
    if (a.kind === 'pass') {
      if (o.id !== undefined) this.acted = { id: o.id, kind: 'pass' };
      return true;
    }
    if (a.kind === 'catch') {
      this.catchTo(a.stop);
      return consume();
    }
    if (a.kind === 'swallow') return consume();
    if (motion.autoArmed && dir > 0) return consume();
    StepScrollController.count(e, dir, device, now, !!o.repeat);
    if (now < motion.holdUntil || motion.pending.count > 0) {
      StepScrollController.enqueue(e, dir, !!o.repeat, now);
      return consume();
    }
    this.glideTo(a.stop);
    return consume();
  }

  // ── Input ──

  /** The Lenis gate; the native (no-Lenis) adapter calls it too. */
  private onInput = (data: VirtualScrollData): boolean => {
    const e = data.event;
    if (e.type === 'wheel') {
      const we = e as WheelEvent;
      if (we.ctrlKey || data.deltaY === 0) return true; // pinch-zoom / horizontal
      const fresh = feedWheel(this.wheel, we.timeStamp, data.deltaY); // always fed: keeps gesture timing exact
      if (fresh) {
        this.wheelAcc = 0;
        this.wheelDevice = classifyWheel(we.deltaMode, we.deltaY);
      }
      this.wheelAcc += Math.abs(data.deltaY);
      if (!this.ready || this.blocked()) return true;
      const id = this.wheel.id;
      if (this.acted.id === id) {
        if (this.acted.kind === 'pass') return true;
        if (we.cancelable) we.preventDefault();
        return false;
      }
      const L = this.lenis;
      const y = this.y();
      const dir: 1 | -1 = data.deltaY > 0 ? 1 : -1;
      if (this.wheelAcc < STEP_TUNING.devices[this.wheelDevice].minPx && (motion.gliding || this.inZone(y))) {
        if (we.cancelable) we.preventDefault();
        return false;
      }
      return this.gesture(dir, this.wheelDevice, we, (L ? L.targetScroll : y) + data.deltaY, { id });
    }
    if (!this.ready || this.blocked()) return true;
    return this.onTouch(e as TouchEvent);
  };

  private onTouch(e: TouchEvent): boolean {
    const t = this.touch;
    if (e.type === 'touchstart') {
      if (e.touches.length > 1) {
        t.multi = true;
        return true;
      }
      t.active = true;
      t.multi = false;
      t.x0 = e.touches[0].clientX;
      t.y0 = e.touches[0].clientY;
      t.t0 = performance.now();
      t.travel = 0;
      t.decided = false;
      t.released = false;
      t.committed = false;
      t.moving = motion.gliding || motion.pending.count > 0;
      t.engaged = t.moving || performance.now() < motion.holdUntil || this.inZone(this.y());
      return true; // never cancel a touchstart: taps and links must work
    }
    if (e.type === 'touchmove') {
      if (!t.active || t.multi || e.touches.length > 1) {
        t.multi = true;
        return true;
      }
      const dx = e.touches[0].clientX - t.x0;
      const up = t.y0 - e.touches[0].clientY; // positive = scroll down
      t.travel = Math.max(t.travel, Math.hypot(dx, up));
      if (t.released || !t.engaged) return true; // native scroll is fine; the entry catch happens in onScroll
      if (!t.decided) {
        const ax = touchAxis(dx, up);
        if (ax === null) return true;
        t.decided = true;
        if (!motion.gliding) {
          if (ax === 'h') {
            t.released = true;
            return true;
          }
          const y = this.y();
          if (decideStep(this.ys, STOP_TOL_PX, { y, target: y + up, dir: up >= 0 ? 1 : -1, fresh: true, acted: null, foreign: this.foreign(y), busy: false }).kind === 'pass') {
            t.released = true; // exit at stop 0 up or the last stop down: native scroll and momentum work
            return true;
          }
        }
      }
      if (e.cancelable) e.preventDefault();
      if (!t.committed && Math.abs(up) >= STEP_TUNING.devices.touch.minPx) {
        t.committed = true;
        this.gesture(up > 0 ? 1 : -1, 'touch', e, this.y() + up);
      }
      return false;
    }
    if (e.type === 'touchend') {
      if (t.active && !t.multi && t.engaged && !t.released && !t.committed && e.changedTouches.length > 0) {
        const p = e.changedTouches[0];
        const dx = p.clientX - t.x0;
        const up = t.y0 - p.clientY;
        const kind = classifyTouchEnd(
          Math.max(t.travel, Math.hypot(dx, up)),
          up,
          performance.now() - t.t0,
          t.moving || motion.gliding || motion.pending.count > 0,
        );
        if (kind === 'swipe' && touchAxis(dx, up) !== 'h') {
          t.committed = true;
          this.gesture(up > 0 ? 1 : -1, 'touch', e, this.y() + up, { noPrevent: true });
        } else if (kind === 'tap') {
          StepScrollController.tapStop(e);
        }
      }
      t.active = false;
      t.lastEnd = performance.now();
      if (e.touches.length === 0) t.multi = false;
      if (this.locked) this.unlockSoon();
    }
    return true;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (!this.ready || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || this.blocked()) return;
    let dir: 1 | -1;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) dir = 1;
    else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1;
    else return; // Home and End included
    const el = e.target instanceof HTMLElement ? e.target : null;
    if (el) {
      if (el.isContentEditable || el.closest('input, textarea, select')) return;
      if (e.key === ' ' && el.closest('button, a[href], summary, [role="button"]')) return;
    }
    if (!e.repeat) this.keySeq -= 1;
    const id = this.keySeq;
    const step = e.key.startsWith('Arrow') ? KEY_ARROW_PX : KEY_PAGE_SHARE * this.layout.viewportH;
    const y = this.y();
    if (e.repeat && this.acted.id === id && this.acted.kind === 'pass') return;
    this.gesture(dir, 'key', e, y + dir * step, { id, repeat: e.repeat && this.acted.id === id });
  };

  /** Lenis 'scroll' event, or window scroll when there is no Lenis. */
  private onScroll = (): void => {
    if (!this.ready || this.inCatch) return;
    const y = this.y();
    const L = this.lenis;
    const native = !L || L.isScrolling === 'native';
    if (native && !motion.gliding) {
      const n = this.ys.length;
      const first = this.ys[0];
      const last = this.ys[n - 1];
      const touchy = this.touch.active || performance.now() - this.touch.lastEnd < MOMENTUM_WINDOW_MS;
      if (touchy) {
        if (this.prevY < first - STOP_TOL_PX && y >= first - STOP_TOL_PX) { if (!this.foreign(this.prevY)) { this.touchCatch(0); return; } }
        if (this.prevY > last + STOP_TOL_PX && y <= last + STOP_TOL_PX) { if (!this.foreign(this.prevY)) { this.touchCatch(n - 1); return; } }
      } else if (y > first + STOP_TOL_PX && y < last - STOP_TOL_PX) {
        this.armSettle();
      }
    }
    this.prevY = y;
    StepScrollController.syncZone(y);
    this.refreshRest();
  };

  private touchCatch(k: number): void {
    this.inCatch = true;
    if (!this.locked) {
      this.locked = true;
      document.documentElement.style.overflow = 'hidden';
    }
    this.prevY = this.ys[k];
    this.jump(this.ys[k]);
    this.inCatch = false;
    const t = this.touch;
    t.engaged = true;
    t.decided = true;
    t.released = false;
    t.committed = true;
    if (!t.active) this.unlockSoon();
  }

  private unlockSoon(): void {
    if (this.unlockTimer) clearTimeout(this.unlockTimer);
    this.unlockTimer = setTimeout(() => {
      this.unlockTimer = null;
      if (this.touch.active) return;
      this.locked = false;
      document.documentElement.style.overflow = '';
    }, OVERFLOW_UNLOCK_MS);
  }

  private armSettle(): void {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(this.settle, SETTLE_IDLE_MS);
  }

  private settle = (): void => {
    this.settleTimer = null;
    if (!this.ready || motion.gliding || this.touch.active || this.blocked()) return;
    const y = this.y();
    if (this.inZone(y) && stopAt(this.ys, y, STOP_TOL_PX) < 0) this.glideTo(nearestStop(this.ys, y));
  };
}

export function useStepScroll(options: StepScrollOptions): StepScrollController {
  const [ctl] = useState(() => new StepScrollController(options));
  const lenis = useLenis();
  useEffect(() => ctl.attach(lenis), [ctl, lenis]);
  return ctl;
}
