'use client';

import { Fragment, useRef } from 'react';
import { cn } from '@/lib/utils';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';

interface FillStatementProps {
  as?: 'h1' | 'h2' | 'h3' | 'p';
  /** Plain string; "\n" renders a line break. */
  children: string;
  className?: string;
  style?: React.CSSProperties;
  tone?: 'dark' | 'light';
  id?: string;
}

/** Scroll-scrubbed word-by-word gold fill (opacity only). */
export function FillStatement({
  as = 'h2',
  children,
  className,
  style,
  tone = 'dark',
  id,
}: FillStatementProps): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const Tag = as as unknown as React.ComponentType<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      let cancelled = false;
      let split: SplitText | null = null;
      const run = (): void => {
        if (cancelled) return;
        split = SplitText.create(el, {
          type: 'words',
          wordsClass: 'fs-word',
          aria: 'auto',
          autoSplit: true,
          onSplit(self: SplitText) {
            const golds = self.words.map((w) => {
              const g = document.createElement('span');
              g.className = 'fs-gold';
              g.setAttribute('aria-hidden', 'true');
              g.textContent = w.textContent;
              w.appendChild(g);
              return g;
            });
            return gsap.to(golds, {
              opacity: 1,
              stagger: 0.08,
              ease: 'none',
              scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
            });
          },
        } as SplitText.Vars);
      };
      document.fonts.ready.then(run, run);
      return () => {
        cancelled = true;
        split?.revert();
      };
    },
    { scope: ref },
  );

  const parts = children.split('\n');
  return (
    <Tag
      ref={ref}
      id={id}
      className={cn('fill-statement', tone === 'light' && 'fill-statement--light', className)}
      style={style}
    >
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {p}
        </Fragment>
      ))}
    </Tag>
  );
}
