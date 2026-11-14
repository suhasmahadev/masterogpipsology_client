'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';
import { onIntroDone } from '@/lib/intro';

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'span';

interface RevealTextProps {
  as?: Tag;
  children: React.ReactNode;
  mode?: 'lines' | 'chars';
  trigger?: 'intro' | 'scroll';
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export function RevealText({
  as = 'h2',
  children,
  mode = 'lines',
  trigger = 'scroll',
  delay = 0,
  className,
  style,
  id,
}: RevealTextProps): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const Tag = as as unknown as React.ComponentType<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;

  useGSAP(
    (_ctx, contextSafe) => {
      const el = ref.current;
      if (!el) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        el.classList.remove('rt-pending');
        return;
      }
      let cancelled = false;
      let split: SplitText | null = null;
      let offIntro: (() => void) | null = null;

      const start = (): void => {
        if (cancelled || !el) return;
        split = SplitText.create(el, {
          type: mode === 'chars' ? 'lines,chars' : 'lines',
          mask: 'lines',
          linesClass: 'rt-line',
          aria: 'auto',
          autoSplit: true,
          ignore: '.gold-shimmer',
          onSplit(self: SplitText) {
            const ignored = Array.from(el.querySelectorAll('.gold-shimmer'));
            const targets = mode === 'chars' ? [...self.chars, ...ignored] : self.lines;
            gsap.set(targets, { yPercent: 110, opacity: 0 });
            el.classList.remove('rt-pending');
            const tween = gsap.to(targets, {
              yPercent: 0,
              opacity: 1,
              duration: 1.1,
              ease: 'expo.out',
              stagger: mode === 'chars' ? 0.018 : 0.09,
              delay,
              ...(trigger === 'scroll'
                ? { scrollTrigger: { trigger: el, start: 'top 85%', once: true } }
                : {}),
            });
            return tween;
          },
        } as SplitText.Vars);
      };

      const begin = contextSafe ? contextSafe(start) : start;
      const run = (): void => {
        if (trigger === 'intro') offIntro = onIntroDone(begin);
        else begin();
      };
      document.fonts.ready.then(run, run);

      return () => {
        cancelled = true;
        offIntro?.();
        split?.revert();
      };
    },
    { scope: ref, dependencies: [mode, trigger, delay] },
  );

  return (
    <Tag ref={ref} id={id} className={cn('rt-pending', className)} style={style}>
      {children}
    </Tag>
  );
}
