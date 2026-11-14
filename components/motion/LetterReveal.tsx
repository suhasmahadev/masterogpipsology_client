'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';
import { rollDecoys } from '@/lib/text-motion';

export type LetterVariant = 'roll' | 'flip' | 'shimmer' | 'track' | 'bloom';

interface LetterRevealProps {
  as?: 'h2' | 'h3' | 'p';
  variant: LetterVariant;
  /** Text, <br />, and inline spans (e.g. <span className="italic lr-grad">). */
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  /** ScrollTrigger start. */
  start?: string;
}

const GRAD = 'linear-gradient(90deg, #F5E5C9 0%, #E2BE68 50%, #FAF1DE 100%)'; // keep in sync with .lr-grad

/** Per-letter gradient for chars inside .lr-grad (parent background-clip:text does not follow transformed children). Reads all rects first, then writes. */
function paintGradient(root: HTMLElement, chars: HTMLElement[]): void {
  root.querySelectorAll<HTMLElement>('.lr-grad').forEach((g) => {
    const gr = g.getBoundingClientRect();
    const inside = chars.filter((c) => g.contains(c));
    const rs = inside.map((c) => c.getBoundingClientRect()); // reads
    inside.forEach((c, i) => { // writes
      c.classList.add('lr-grad-c');
      c.style.backgroundImage = GRAD;
      c.style.backgroundSize = `${gr.width}px 100%`;
      c.style.backgroundPosition = `${gr.left - rs[i].left}px 0`;
    });
  });
}

/** Sets initial states and adds tweens. Only transform and opacity are animated. */
function buildVariant(
  v: LetterVariant,
  self: SplitText,
  chars: HTMLElement[],
  tl: gsap.core.Timeline,
): void {
  switch (v) {
    case 'roll': {
      const decoys: HTMLElement[] = [];
      chars.forEach((c) => {
        rollDecoys(c.textContent ?? '').forEach((d, i) => {
          const s = document.createElement('span');
          s.className = 'lr-roll-d';
          s.textContent = d;
          s.style.top = `${(i + 1) * 100}%`;
          c.appendChild(s);
          decoys.push(s);
        });
      });
      gsap.set(chars, { yPercent: -300 });
      tl.to(chars, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.035 })
        .set(decoys, { autoAlpha: 0 }); // hide the tape after it lands
      break;
    }
    case 'flip': {
      gsap.set(chars, { rotationX: -95, opacity: 0, transformOrigin: '50% 100%', transformPerspective: 700 });
      tl.to(chars, { rotationX: 0, opacity: 1, duration: 1.1, ease: 'back.out(1.4)', stagger: 0.03 });
      break;
    }
    case 'shimmer': {
      const golds = chars.map((c) => {
        const g = document.createElement('span');
        g.className = 'lr-gold';
        g.textContent = c.textContent;
        c.appendChild(g);
        return g;
      });
      gsap.set(chars, { opacity: 0.16, yPercent: 18 });
      tl.to(chars, { opacity: 1, yPercent: 0, duration: 0.6, ease: 'sine.out', stagger: 0.045 }, 0)
        .to(golds, { opacity: 1, duration: 0.2, ease: 'sine.out', stagger: 0.045 }, 0)
        .to(golds, { opacity: 0, duration: 0.8, ease: 'sine.in', stagger: 0.045 }, 0.25);
      break;
    }
    case 'track': {
      const xs = new Map<HTMLElement, number>();
      (self.lines as HTMLElement[]).forEach((line) => {
        const cs = Array.from(line.querySelectorAll<HTMLElement>('.lr-c'));
        if (!cs.length) return;
        const rs = cs.map((c) => c.getBoundingClientRect()); // reads only
        const mid = (rs[0].left + rs[rs.length - 1].right) / 2; // centre of the text, not the block line box
        cs.forEach((c, i) => xs.set(c, (rs[i].left + rs[i].width / 2 - mid) * 0.6));
      });
      gsap.set(chars, { x: (i: number) => xs.get(chars[i]) ?? 0, opacity: 0 });
      tl.to(chars, { x: 0, opacity: 1, duration: 1.5, ease: 'expo.out', stagger: { each: 0.025, from: 'center' } });
      break;
    }
    case 'bloom': {
      gsap.set(chars, { opacity: 0, scale: 1.45, yPercent: -14, transformOrigin: '50% 70%' });
      tl.to(chars, { opacity: 1, scale: 1, yPercent: 0, duration: 1.1, ease: 'power3.out', stagger: { amount: 2.2 } });
      break;
    }
  }
}

export function LetterReveal({
  as = 'h2',
  variant,
  children,
  className,
  style,
  id,
  start = 'top 82%',
}: LetterRevealProps): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const Tag = as as unknown as React.ComponentType<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;

  useGSAP(
    (_ctx, contextSafe) => {
      const el = ref.current;
      if (!el) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.classList.remove('lr-pending'); // static tier: final state
        return;
      }
      let cancelled = false;
      let played = false; // after first play, re-splits (autoSplit on resize/font swap) show the final state, never replay
      let split: SplitText | null = null;

      const onSplit = (self: SplitText): gsap.core.Timeline | undefined => {
        const chars = self.chars as HTMLElement[];
        el.classList.add('is-split');
        paintGradient(el, chars); // before any transform is set (measures untransformed rects)
        if (played) {
          el.classList.remove('lr-pending');
          return undefined;
        }
        const tl = gsap.timeline({
          onStart: () => { played = true; },
          scrollTrigger: { trigger: el, start, once: true },
        });
        buildVariant(variant, self, chars, tl);
        el.classList.remove('lr-pending'); // only after initial states are set: no flash
        return tl; // SplitText kills it on re-split/revert
      };

      const run = (): void => {
        if (cancelled) return;
        split = SplitText.create(el, {
          type: variant === 'track' ? 'lines,words,chars' : 'words,chars',
          linesClass: 'lr-l',
          wordsClass: 'lr-w',
          charsClass: 'lr-c',
          ...(variant === 'roll' ? { mask: 'chars' } : {}),
          aria: 'auto',
          autoSplit: true,
          onSplit,
        } as SplitText.Vars);
      };
      const begin = contextSafe ? contextSafe(run) : run;
      document.fonts.ready.then(begin, begin);

      return () => {
        cancelled = true;
        split?.revert();
        el.classList.remove('is-split');
      };
    },
    { scope: ref, dependencies: [variant, start] },
  );

  return (
    <Tag ref={ref} id={id} className={cn('lr', `lr--${variant}`, 'lr-pending', className)} style={style}>
      {children}
    </Tag>
  );
}

export default LetterReveal;
