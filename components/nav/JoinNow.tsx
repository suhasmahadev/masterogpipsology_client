'use client';
import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Magnetic } from '@/components/fx/Magnetic';
import { JOIN_LINKS, type JoinLink } from '@/lib/content';

const ICONS: Record<JoinLink['id'], React.ReactElement> = {
  whatsapp: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.5L3 21z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.9-1-.9.7c-.9-.4-1.7-1.2-2.1-2.1l.7-.9-1-1.9L9 9.5z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 4L3 11l6 2.2L18 7l-7.5 7.5V19l3-3 4.5 3L21 4z" />
    </svg>
  ),
};

/** Outline "Join now" toggle that reveals WhatsApp / Instagram / Telegram capsules. */
export function JoinNow(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector('button')?.focus();
      }
    };
    const onPointer = (e: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="flex flex-col items-center gap-5">
      <Magnetic>
        <Button
          size="lg"
          variant="outline"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          Join now
        </Button>
      </Magnetic>
      <ul
        id={listId}
        className="flex flex-wrap justify-center gap-3 list-none p-0 m-0"
        hidden={!open}
      >
        {JOIN_LINKS.map((link, i) => (
          <li
            key={link.id}
            className="join-capsule"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-accent/40 px-5 py-2.5 text-sm font-body font-medium text-accent no-underline transition-colors duration-200 hover:bg-accent/10 hover:border-accent"
            >
              {ICONS[link.id]}
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <style>{`
        .join-capsule { animation: join-rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes join-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) { .join-capsule { animation: none; } }
      `}</style>
    </div>
  );
}

export default JoinNow;
