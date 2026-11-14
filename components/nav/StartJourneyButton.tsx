'use client';
import React from 'react';
import { ArrowDown } from 'lucide-react';
import { startJourney } from '@/lib/start-journey';

export const START_JOURNEY_LABEL = 'Start journey';

interface Props {
  size?: 'sm' | 'lg';
  className?: string;
  /** Runs first (e.g. close the mobile menu); the scroll starts after it has settled. */
  beforeScroll?: () => void;
}

export function StartJourneyButton({ size = 'sm', className, beforeScroll }: Props): React.ReactElement {
  const onClick = (): void => {
    if (beforeScroll) {
      beforeScroll();
      // Let the menu release its scroll lock (body overflow + Lenis stop) before scrolling.
      window.setTimeout(startJourney, 80);
    } else {
      startJourney();
    }
  };
  return (
    <button
      type="button"
      className={`cap-btn ${size === 'sm' ? 'cap-btn--sm' : 'cap-btn--lg'} ${className ?? ''}`}
      onClick={onClick}
    >
      <span className="cap-btn__fill" aria-hidden="true" />
      <span>{START_JOURNEY_LABEL}</span>
      <ArrowDown className="cap-btn__icon" aria-hidden="true" />
    </button>
  );
}

export default StartJourneyButton;
