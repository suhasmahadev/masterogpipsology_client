'use client';

import { useSyncExternalStore } from 'react';
import { computeTier, type Tier } from '@/lib/device-tier-core';

export type { Tier };

let webgl2Cache: boolean | null = null;
function probeWebgl2(): boolean {
  if (webgl2Cache !== null) return webgl2Cache;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    webgl2Cache = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2Cache = false;
  }
  return webgl2Cache;
}

function compute(): Tier {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return computeTier({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    width: window.innerWidth,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    deviceMemory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    saveData: nav.connection?.saveData,
    webgl2: probeWebgl2(),
  });
}

let current: Tier | null = null;
const listeners = new Set<() => void>();
let mqls: MediaQueryList[] = [];

function recompute(): void {
  const next = compute();
  if (next !== current) {
    current = next;
    listeners.forEach((l) => l());
  }
}

function subscribe(cb: () => void): () => void {
  if (listeners.size === 0) {
    mqls = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(max-width: 767px)'),
    ];
    mqls.forEach((m) => m.addEventListener('change', recompute));
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      mqls.forEach((m) => m.removeEventListener('change', recompute));
      mqls = [];
    }
  };
}

function getSnapshot(): Tier {
  if (current === null) current = compute();
  return current;
}

function getServerSnapshot(): Tier {
  return 'static';
}

export function useDeviceTier(): Tier {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
