import React from 'react';
// ─── Page ─────────────────────────────────────────────────────────────────────
// Server Component. Pure composition — no logic here.
// The ArchitecturalScene wraps the core content sections (Markets, Gallery,
// Curriculum) to create the horizontal parallax / 3D camera-movement illusion.

import { LongTaskProbe } from '@/components/dev/LongTaskProbe';
import { GlassHeader } from '@/components/nav/GlassHeader';
import { Hero } from '@/components/sections/Hero';
import { CryptoMarketScroll } from '@/components/sections/CryptoMarketScroll';
import { ForexMarketScroll } from '@/components/sections/ForexMarketScroll';
import { HallmarkDial } from '@/components/sections/HallmarkDial';
import { Markets } from '@/components/sections/Markets';
import { MomentsReel } from '@/components/sections/MomentsReel';
import { LuxuryTeamGallery } from '@/components/sections/LuxuryTeamGallery';
import { Gallery } from '@/components/sections/Gallery';
import { Curriculum } from '@/components/sections/Curriculum';
import { Testimonial } from '@/components/sections/Testimonial';
import { MagicRingShowcase } from '@/components/art/MagicRingShowcase';
import { FinalCta } from '@/components/sections/FinalCta';
import { Footer } from '@/components/sections/Footer';
import { Preloader } from '@/components/fx/Preloader';
import { PaletteBackdrop } from '@/components/fx/PaletteBackdrop';
import { Grain } from '@/components/fx/Grain';
import { SectionSeam } from '@/components/fx/SectionSeam';
import { ForexFade } from '@/components/fx/ForexFade';

export default function Page(): React.ReactElement {
  return (
    <>
      <Preloader />
      <PaletteBackdrop />
      <Grain />
      {process.env.NODE_ENV !== 'production' && <LongTaskProbe />}
      {/* Fixed navigation */}
      <GlassHeader />

      {/* Page body — the scroll root for the theme system */}
      <div className="relative">
        <main id="main-content" style={{ color: 'var(--text)' }}>
          {/* Skip to main content link for keyboard users */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-body focus:font-medium"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
          >
            Skip to main content
          </a>

          {/* Hero — full-viewport background image */}
          <Hero />
          <SectionSeam tone="light" />

          {/* 240-frame sticky scroll sequence: "Let me introduce you to the market, first crypto" */}
          <CryptoMarketScroll />
          <ForexFade />

          {/* 720-frame sticky scroll sequence: Forex + Stock Market + Opportunity */}
          <ForexMarketScroll />

          {/* Hallmark dial: guilloché gold beat between Forex and the dark sections */}
          <HallmarkDial />
          <SectionSeam />

          {/* ── PERSISTENT LUXURY BLACK EFFECT (Stays black all the way to page end) ── */}
          <div data-nav-tone="dark" className="theme-black-section relative w-full text-[#F5EFEB]">
            {/* Three markets, 3D glass cards */}
            <Markets />
            <SectionSeam />

            {/* Faculty editorial gallery */}
            <LuxuryTeamGallery />
            <SectionSeam />

            {/* Atelier film strip: pinned horizontal moments reel */}
            <MomentsReel />
            <SectionSeam />

            {/* Programme curriculum (12-week timeline) */}
            <Curriculum />
            <SectionSeam />

            {/* Verified cohort records & certification awards */}
            <Gallery />
            <SectionSeam />

            <Testimonial />
            <MagicRingShowcase />
            <SectionSeam />
            <FinalCta />
            <Footer />
          </div>
        </main>
      </div>
    </>
  );
}
