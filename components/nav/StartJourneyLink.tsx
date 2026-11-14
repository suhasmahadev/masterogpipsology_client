'use client';
import React from 'react';
import { Button } from '@/components/ui/Button';
import { startJourney } from '@/lib/start-journey';
import { CTA_SECONDARY } from '@/lib/content';

interface Props {
  id?: string;
}

/** Outline "Start journey" CTA: smooth-scrolls to Crypto frame 0; href is the no-JS fallback. */
export function StartJourneyLink({ id }: Props): React.ReactElement {
  return (
    <Button
      as="a"
      href="#crypto-sequence"
      size="lg"
      variant="outline"
      id={id}
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        startJourney();
      }}
    >
      {CTA_SECONDARY}
    </Button>
  );
}

export default StartJourneyLink;
