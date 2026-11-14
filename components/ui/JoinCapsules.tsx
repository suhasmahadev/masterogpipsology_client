import React from 'react';
import clsx from 'clsx';
import { Send, MessageCircle } from 'lucide-react';
import { JOIN_CHANNELS } from '@/lib/content';

interface JoinCapsulesProps {
  tone?: 'light' | 'dark';
  size?: 'sm' | 'lg';
  className?: string;
  capClassName?: string;
  idPrefix?: string;
  onNavigate?: () => void;
}

export function JoinCapsules({
  tone,
  size = 'lg',
  className,
  capClassName,
  idPrefix,
  onNavigate,
}: JoinCapsulesProps): React.ReactElement {
  return (
    <div className={clsx('join-caps', className ?? 'flex flex-wrap items-center gap-3')} data-tone={tone}>
      {JOIN_CHANNELS.map((c) => {
        const Icon = c.id === 'telegram' ? Send : MessageCircle;
        return (
          <a
            key={c.id}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            id={idPrefix ? `${idPrefix}-${c.id}` : undefined}
            className={clsx('cap-btn', size === 'sm' ? 'cap-btn--sm' : 'cap-btn--lg', capClassName)}
          >
            <span className="cap-btn__fill" aria-hidden="true" />
            <Icon className="cap-btn__icon" aria-hidden="true" />
            <span>{c.label}</span>
          </a>
        );
      })}
    </div>
  );
}

export default JoinCapsules;
