import React from 'react';
import type { Metadata } from 'next';
import { IntelligenceHero } from '@/components/sections/IntelligenceHero';

export const metadata: Metadata = {
  title: 'The Next Layer of Intelligence',
  description:
    'A unified infrastructure platform to help teams build, ship, and scale AI systems with confidence.',
};

export default function IntelligencePage(): React.ReactElement {
  return (
    <main className="w-full min-h-screen bg-[#050505] overflow-hidden">
      <IntelligenceHero />
    </main>
  );
}
