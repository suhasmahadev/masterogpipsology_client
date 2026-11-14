'use client';

import React, { useEffect, useRef } from 'react';
import type { CaptionFlow } from '@/lib/scroll-captions';
import {
  flowState,
  stepStyle,
  trackOffset,
  sparkStyle,
  stepTextPhase,
  FLOW_PREV_DIM,
  type FlowState,
  type StepStyle,
  type SparkStyle,
  type TextPhase,
} from '@/lib/caption-flow';
import { enterAt, leaveAt } from '@/lib/text-motion';
import { SplitWords } from '@/components/motion/SplitWords';
import { collectUnits, invalidateUnits, writeUnit, type ScrubUnit } from '@/components/motion/scrub-units';

/** Imperative driver: call with the host sequence progress (0..1) from its onUpdate. */
export type CaptionDriver = { current: ((progress: number) => void) | null };

const INK = '#0B0B0B';

interface Props {
  flow: CaptionFlow;
  driverRef: CaptionDriver;
  /** 'crypto' adds the word-by-word rise-and-lift motion and the Bodoni face; 'market' (Forex/Stock) adds ticker roll, track-in and glide in Cinzel. */
  variant?: 'default' | 'crypto' | 'market';
}

/**
 * Workflow rail. No React state: every node, connector, box and the spark are pure functions of the
 * host sequence progress, written (transform + opacity only) from the same tick that draws the frames.
 */
export function ScrollCaptions({ flow, driverRef, variant = 'default' }: Props): React.ReactElement {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const sparkRef = useRef<HTMLSpanElement | null>(null);
  const rowRefs = useRef<Array<HTMLElement | null>>([]);
  const nodeRefs = useRef<Array<HTMLElement | null>>([]);
  const plateRefs = useRef<Array<HTMLElement | null>>([]);
  const lineRefs = useRef<Array<HTMLElement | null>>([]);
  const motion = variant !== 'default';
  const steps = flow.steps;
  const n = steps.length;

  useEffect(() => {
    const track = trackRef.current;
    const spark = sparkRef.current;
    if (!track || !spark) return;
    const rows = rowRefs.current;
    const nodes = nodeRefs.current;
    const plates = plateRefs.current;
    const lines = lineRefs.current;

    const count = flow.steps.length;
    const units: ScrubUnit[][] = motion ? rows.map((r) => (r ? collectUnits(r) : [])) : [];
    const tp: TextPhase = { vin: 0, vout: 0 };
    const rowTop = new Float64Array(count);
    let nodeY = 0;
    let measured = false;
    let painted = false;
    let lastP = 0;
    let disposed = false;

    const st: FlowState = { index: 0, draw: 0, advance: 0, enter: 0, exit: 0 };
    const ss: StepStyle = { presence: 0, node: 0, nodeScale: 0, plate: 0, plateX: 0, line: 0, lineOpacity: 0 };
    const sp: SparkStyle = { y: 0, opacity: 0 };

    const mk = (): string[] => new Array<string>(count).fill('');
    const cVis = mk();
    const cNodeO = mk();
    const cNodeT = mk();
    const cPlateO = mk();
    const cPlateT = mk();
    const cLineT = mk();
    const cLineO = mk();
    let cTrack = '';
    let cSparkT = '';
    let cSparkO = '';
    const invalidate = (): void => {
      for (const c of [cVis, cNodeO, cNodeT, cPlateO, cPlateT, cLineT, cLineO]) c.fill('');
      cTrack = '';
      cSparkT = '';
      cSparkO = '';
      for (const l of units) invalidateUnits(l);
    };

    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const shortMq = window.matchMedia('(max-height: 700px)');
    let reduced = reduceMq.matches;
    let prevDim = shortMq.matches ? 0 : FLOW_PREV_DIM;

    const put = (el: HTMLElement | null, cache: string[], idx: number, value: string, write: (e: HTMLElement, v: string) => void): void => {
      if (!el || cache[idx] === value) return;
      cache[idx] = value;
      write(el, value);
    };
    const setVis = (e: HTMLElement, v: string): void => { e.style.visibility = v; };
    const setOpacity = (e: HTMLElement, v: string): void => { e.style.opacity = v; };
    const setTransform = (e: HTMLElement, v: string): void => { e.style.transform = v; };

    const apply = (p: number, force = false): void => {
      if (!force && painted && p === lastP) return;
      lastP = p;
      if (!measured) return;
      painted = true;
      flowState(p, flow, reduced, st);
      for (let j = 0; j < count; j++) {
        stepStyle(j, st, prevDim, ss);
        put(rows[j], cVis, j, ss.presence > 0.0005 ? 'visible' : 'hidden', setVis);
        put(nodes[j], cNodeO, j, ss.node.toFixed(3), setOpacity);
        put(nodes[j], cNodeT, j, `rotate(45deg) scale(${ss.nodeScale.toFixed(4)})`, setTransform);
        put(plates[j], cPlateO, j, ss.plate.toFixed(3), setOpacity);
        put(plates[j], cPlateT, j, `translate3d(${ss.plateX.toFixed(2)}px,0,0)`, setTransform);
        if (j < count - 1) {
          put(lines[j], cLineT, j, `scaleY(${ss.line.toFixed(4)})`, setTransform);
          put(lines[j], cLineO, j, ss.lineOpacity.toFixed(3), setOpacity);
        }
        if (motion) {
          stepTextPhase(j, st, tp);
          const list = units[j];
          for (let k = 0; k < list.length; k++) {
            const u = list[k];
            if (reduced) writeUnit(u, 1, 0);
            else writeUnit(u, enterAt(tp.vin, 0, 1, u.part, u.parts, u.unit, u.units), leaveAt(tp.vout, 0, 1, u.part, u.parts, u.unit, u.units));
          }
        }
      }
      const t = `translate3d(0,${(-trackOffset(rowTop, st)).toFixed(2)}px,0)`;
      if (t !== cTrack) { cTrack = t; track.style.transform = t; }
      sparkStyle(rowTop, nodeY, st, sp);
      const sT = `translate3d(0,${sp.y.toFixed(2)}px,0)`;
      if (sT !== cSparkT) { cSparkT = sT; spark.style.transform = sT; }
      const sO = (reduced ? 0 : sp.opacity).toFixed(3);
      if (sO !== cSparkO) { cSparkO = sO; spark.style.opacity = sO; }
    };

    // The only layout read; runs on resize / fonts / media change, never per tick.
    const measure = (): void => {
      for (let j = 0; j < count; j++) rowTop[j] = rows[j]?.offsetTop ?? 0;
      const n0 = nodes[0];
      nodeY = n0 ? n0.offsetTop + n0.offsetHeight / 2 : 0;
      prevDim = shortMq.matches ? 0 : FLOW_PREV_DIM;
      measured = true;
      invalidate();
      apply(lastP, true);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(track);
    void document.fonts?.ready.then(() => { if (!disposed) measure(); });

    const onReduce = (e: MediaQueryListEvent): void => {
      reduced = e.matches;
      invalidate();
      apply(lastP, true);
    };
    const onShort = (): void => measure();
    reduceMq.addEventListener('change', onReduce);
    shortMq.addEventListener('change', onShort);

    driverRef.current = (p: number): void => apply(p);
    measure();

    return () => {
      disposed = true;
      driverRef.current = null;
      ro.disconnect();
      reduceMq.removeEventListener('change', onReduce);
      shortMq.removeEventListener('change', onShort);
    };
  }, [flow, driverRef, motion]);

  return (
    <div
      aria-hidden="true"
      className={`wf ${motion ? `wf--${variant} ` : ''}absolute inset-x-0 z-40 pointer-events-none`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--wf-focus))', height: 0 }}
    >
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8 md:px-12 lg:px-16">
        <div className="relative">
          <div ref={trackRef} className="wf__track">
            {steps.map((c, i) => (
              <div key={`${c.label}-${c.text}-${i}`} ref={(el) => { rowRefs.current[i] = el; }} className="wf__step">
                {i < n - 1 && <span ref={(el) => { lineRefs.current[i] = el; }} className="wf__line" />}
                <span ref={(el) => { nodeRefs.current[i] = el; }} className="wf__node" />
                <div
                  ref={(el) => { plateRefs.current[i] = el; }}
                  className="wf__plate w-fit max-w-[88%] md:max-w-md rounded-sm px-4 py-3 md:px-5 md:py-3.5"
                  style={{
                    background: 'rgba(250,246,237,0.82)',
                    border: '1px solid rgba(212,175,55,0.55)',
                    color: INK,
                  }}
                >
                  <div data-part className="text-[10px] md:text-[11px] font-body uppercase tracking-[0.28em] font-semibold" style={{ color: INK, fontVariant: 'small-caps' }}>
                    {motion ? <span className="tm-mask"><span className="tm-u" data-u={variant === 'market' ? 'glide' : 'rise'}>{c.label}</span></span> : c.label}
                  </div>
                  <div data-part className="wf__text mt-1 font-medium leading-tight text-xl md:text-2xl" style={{ color: INK }}>
                    {variant === 'crypto'
                      ? <SplitWords text={c.text} kind="tilt" />
                      : variant === 'market'
                        ? <SplitWords text={c.text} kind={c.kind ?? 'glide'} letters={c.kind === 'roll' || c.kind === 'track'} mask={c.kind !== 'track'} />
                        : c.text}
                  </div>
                </div>
              </div>
            ))}
            <span ref={sparkRef} className="wf__spark" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScrollCaptions;
