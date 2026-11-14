'use client';
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CTA_PRIMARY } from '@/lib/content';
import { JoinCapsules } from '@/components/ui/JoinCapsules';

// Disclosure pattern (not role="menu"): "Join the team" trigger + panel with two capsules.
export function JoinMenu(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = (): void => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const hoverOpen = (): void => {
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    clearTimer();
    setOpen(true);
  };
  const hoverClose = (): void => {
    clearTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };
  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      setOpen(false);
      btn.current?.focus();
    }
  };
  const onBlur = (e: React.FocusEvent): void => {
    if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <div
      ref={root}
      className="join-menu-root relative"
      onPointerEnter={hoverOpen}
      onPointerLeave={hoverClose}
      onKeyDown={onKey}
      onBlur={onBlur}
    >
      <button
        ref={btn}
        type="button"
        className="cap-btn cap-btn--sm join-trigger"
        aria-expanded={open}
        aria-controls="join-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="cap-btn__fill" aria-hidden="true" />
        {CTA_PRIMARY}
        <ChevronDown className="join-trigger__chev" aria-hidden="true" />
      </button>
      <div id="join-menu" className="join-menu" data-open={open ? '' : undefined}>
        <JoinCapsules size="sm" className="flex flex-col gap-2" capClassName="w-full" onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );
}

export default JoinMenu;
