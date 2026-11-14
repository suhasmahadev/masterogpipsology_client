'use client';

// TEMP debug HUD. Dev-only (never rendered in production builds): delete this file plus the lines tagged "TEMP debug HUD" in
// useFrameSequence.ts and app/page.tsx once the start/end frames are chosen.

import { useEffect, useRef } from 'react';

export interface HudSample {
  seq: string; // 'Crypto' | 'Forex'
  shown: number; // list index into the (deduplicated) URL list
  total: number; // list length
  pos: number;
  progress: number;
  folder: string; // source folder: crypto | forex | stock_market | opportunity
  raw: number; // raw source frame number 1..rawTotal (matches ezgif-frame-NNN / NNN.webp)
  rawTotal: number;
  listIdx: number; // index inside this folder's list
  listTotal: number;
  ended: boolean; // sequence finished (Forex hand-off/video tail)
  file: string;
  tier: string; // sticky frame class (+ portrait crop)
  fallback: string; // '' | 'whole set JPEG fallback' | 'per-frame JPEG fallback'
}

const FOLDER_NAME: Record<string, string> = { crypto: 'Crypto', forex: 'Forex', stock_market: 'Stock', opportunity: 'Opportunity' };

let el: HTMLPreElement | null = null;
let enabled = false;
let lastText = '';
const samples = new Map<string, HudSample>();
const active = new Set<string>();
const marks: string[] = [];

function block(s: HudSample, hint: string): string {
  let t = `${FOLDER_NAME[s.folder] ?? s.seq}  ${hint}\n`;
  t += `frames: ${s.tier}${s.fallback ? ' / ' + s.fallback : ''}\n`;
  if (s.ended) t += `frames ended at ${s.rawTotal} - hand-off/video\n`;
  else t += `${s.folder}  frame ${s.raw} / ${s.rawTotal}\n`;
  const folderPct = s.listTotal > 1 ? Math.round((s.listIdx / (s.listTotal - 1)) * 100) : 0;
  t += `  list ${s.listIdx} / ${s.listTotal}  pos ${s.pos.toFixed(2)} (chain ${s.total - 1})\n  folder ${folderPct}%  section ${Math.round(s.progress * 100)}%  ${s.file}`;
  return t;
}

/** The sequence whose frame is the one being looked at: Forex once it has started or Crypto is covered, else Crypto. */
function primary(): HudSample | null {
  const c = active.has('Crypto') ? samples.get('Crypto') : undefined;
  const f = active.has('Forex') ? samples.get('Forex') : undefined;
  if (c && f) return f.progress > 0 || c.progress >= 1 ? f : c;
  return f ?? c ?? null;
}

function render(): void {
  if (!el) return;
  const c = active.has('Crypto') ? samples.get('Crypto') : undefined;
  const f = active.has('Forex') ? samples.get('Forex') : undefined;
  const parts: string[] = [];
  if (c) parts.push(block(c, f ? (c.progress >= 1 ? '[covered by Forex]' : '[on screen, Forex fading in over it]') : '[on screen]'));
  if (f) parts.push(block(f, c && c.progress < 1 ? '[fading in over Crypto]' : '[on screen]'));
  const text = parts.join('\n--\n') + (marks.length ? `\nmarks (M add, C copy):\n${marks.join(', ')}` : '\nM mark, C copy marks');
  if (text !== lastText) {
    lastText = text;
    el.textContent = text;
  }
  const display = parts.length ? 'block' : 'none';
  if (el.style.display !== display) el.style.display = display;
}

/** Called every frame tick by useFrameSequence. Cheap: string compare, no layout reads. */
export function hudTick(s: HudSample): void {
  if (!enabled || !el) return;
  samples.set(s.seq, s);
  active.add(s.seq);
  render();
}

export function hudActive(seq: string, on: boolean): void {
  if (!enabled) return;
  if (on) active.add(seq);
  else active.delete(seq);
  render();
}

export function FrameDebugHud(): React.ReactElement | null {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const on = process.env.NODE_ENV === 'development';
    if (!on || !ref.current) return;
    el = ref.current;
    enabled = true;
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const cur = primary();
      if (k === 'm' && cur) {
        const m = `${cur.folder}:${cur.raw} [pos ${cur.pos.toFixed(2)}]`;
        marks.push(m);
        console.log('[frame mark]', m, '| all:', marks.join(', '));
        render();
      } else if (k === 'c' && marks.length) {
        void navigator.clipboard?.writeText(marks.join(', ')).then(() => console.log('[frame marks copied]', marks.join(', ')));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      enabled = false;
      el = null;
      samples.clear();
      active.clear();
    };
  }, []);

  return (
    <pre
      ref={ref}
      aria-hidden="true"
      style={{
        display: 'none',
        position: 'fixed',
        top: 80,
        right: 12,
        zIndex: 99999,
        margin: 0,
        padding: '8px 10px',
        maxWidth: 'min(320px, 60vw)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        color: '#e8e8e8',
        background: 'rgba(0,0,0,0.65)',
        borderRadius: 4,
        pointerEvents: 'none',
      }}
    />
  );
}
