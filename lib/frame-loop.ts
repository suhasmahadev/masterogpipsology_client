'use client';

import { gsap } from '@/lib/gsap';

export type FrameStep = 'update' | 'render';
export type FrameCallback = (timestampMs: number, deltaMs: number) => void;

const update = new Set<FrameCallback>();
const render = new Set<FrameCallback>();
let installed = false;

function master(time: number, deltaTime: number): void {
  const ts = time * 1000;
  for (const cb of Array.from(update)) cb(ts, deltaTime);
  for (const cb of Array.from(render)) cb(ts, deltaTime);
}

function install(): void {
  if (installed) return;
  installed = true;
  gsap.ticker.add(master);
}

/** Runs cb every frame on the single gsap.ticker rAF. Returns unsubscribe. */
export function onEveryFrame(cb: FrameCallback, step: FrameStep): () => void {
  install();
  const set = step === 'update' ? update : render;
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}
