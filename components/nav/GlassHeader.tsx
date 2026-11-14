'use client';
import React from 'react';

// ─── Liquid Glass Header ──────────────────────────────────────────────────────
// Floating glass pill. One backdrop-filter layer (.lg-pill::before). Tone,
// compact, hide/show and the liquid indicator are driven by ScrollTrigger and
// the shared frame loop; only transform/opacity animate.

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { NAV_LINKS } from '@/lib/content';
import { MobileMenuSheet } from './MobileMenuSheet';
import { LiquidGlassFilter } from './LiquidGlassFilter';
import { StartJourneyButton } from './StartJourneyButton';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { onEveryFrame } from '@/lib/frame-loop';
import { scrollStore } from '@/lib/scroll-store';
import { getLenis } from '@/components/providers/LenisProvider';

type ChromiumNav = Navigator & { userAgentData?: { brands: { brand: string }[] } };

export function GlassHeader(): React.ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileOpenRef = useRef(false);
  const wrapRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const ulRef = useRef<HTMLUListElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const bandRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    mobileOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  const closeMenu = useCallback(() => {
    setMobileOpen(false);
    burgerRef.current?.focus();
  }, []);

  // Close sheet on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const pill = pillRef.current;
    const ul = ulRef.current;
    if (!wrap || !pill || !ul) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isChromium = (navigator as ChromiumNav).userAgentData?.brands?.some((b) => b.brand === 'Chromium');
    if (isChromium) pill.classList.add('lg-refract');

    const cleanups: Array<() => void> = [];
    const ctx = gsap.context(() => {
      // Tone: toggle dark class over dark sections.
      document.querySelectorAll<HTMLElement>('[data-nav-tone="dark"]').forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 48px',
          end: 'bottom 48px',
          toggleClass: { targets: pill, className: 'lg-dark' },
        });
      });

      // Shrink after hero.
      const hero = document.getElementById('hero');
      if (hero) {
        ScrollTrigger.create({
          trigger: hero,
          start: 'bottom 80px',
          onEnter: () => pill.classList.add('lg-compact'),
          onLeaveBack: () => pill.classList.remove('lg-compact'),
        });
      }

      // Hide / show on scroll direction (shared clock).
      let heroH = hero ? hero.offsetHeight : 0;
      const onRefresh = (): void => { heroH = hero ? hero.offsetHeight : 0; };
      ScrollTrigger.addEventListener('refresh', onRefresh);
      cleanups.push(() => ScrollTrigger.removeEventListener('refresh', onRefresh));
      const scrollFn = ScrollTrigger.getScrollFunc(window) as () => number;
      let hidden = false;
      cleanups.push(
        onEveryFrame(() => {
          const y = getLenis()?.scroll ?? scrollFn();
          let next = hidden;
          if (scrollStore.direction === 1 && y > heroH) next = true;
          else if (scrollStore.direction === -1) next = false;
          if (next && (mobileOpenRef.current || wrap.contains(document.activeElement))) next = false;
          if (next !== hidden) {
            hidden = next;
            wrap.classList.toggle('lg-hidden', hidden);
          }
        }, 'render'),
      );

      // Gold chips: active state.
      const links = Array.from(ul.querySelectorAll<HTMLAnchorElement>('a.lg-link'));
      let active = -1;
      const setActive = (i: number): void => {
        if (active >= 0) { links[active]?.classList.remove('is-active'); links[active]?.removeAttribute('aria-current'); }
        active = i;
        if (i >= 0) { links[i]?.classList.add('is-active'); links[i]?.setAttribute('aria-current', 'location'); }
      };
      NAV_LINKS.forEach((link, i) => {
        const section = document.querySelector(link.href);
        if (!section) return;
        ScrollTrigger.create({
          trigger: section,
          start: 'top 55%',
          end: 'bottom 55%',
          onToggle: (self) => {
            if (self.isActive) setActive(i);
            else if (active === i) setActive(-1);
          },
        });
      });

      // Specular sweep across the glass every 5 s (1.4 s motion + 3.6 s rest).
      const band = bandRef.current;
      if (band && !reduced) {
        const sheen = gsap.timeline({ repeat: -1, repeatDelay: 3.6, delay: 1.5 });
        sheen.fromTo(band, { xPercent: -130 }, { xPercent: 390, duration: 1.4, ease: 'power2.inOut' });
        const onVis = (): void => {
          if (document.hidden) sheen.pause();
          else sheen.resume();
        };
        document.addEventListener('visibilitychange', onVis);
        cleanups.push(() => document.removeEventListener('visibilitychange', onVis));
      }
    });

    return () => {
      cleanups.forEach((fn) => fn());
      ctx.revert();
    };
  }, []);

  return (
    <>
      <LiquidGlassFilter />
      <header
        ref={wrapRef}
        className="lg-wrap fixed top-3 inset-x-0 z-50 flex justify-center pointer-events-none"
        role="banner"
      >
        <div ref={pillRef} className="lg-pill pointer-events-auto">
          <span className="lg-sheen" aria-hidden="true">
            <span ref={bandRef} className="lg-sheen__band" />
          </span>
          <nav
            className="lg-content relative flex items-center justify-between px-4 sm:px-5 py-2"
            aria-label="Primary navigation"
          >
            {/* Logo + MASTER OF PIPSOLOGY */}
            <Link
              href="/"
              className="flex items-center gap-2.5 no-underline flex-shrink-0 group lg-text"
              aria-label="MASTER OF PIPSOLOGY — home"
            >
              <div className="relative rounded-full p-0.5 border border-white/25 shadow-sm overflow-hidden flex-shrink-0">
                <Image
                  src="/main_logo.png"
                  alt="Master of Pipsology logo"
                  width={38}
                  height={38}
                  className="rounded-full object-contain"
                  priority
                />
              </div>
              <span
                className="lg-wordmark md:max-lg:hidden font-display font-bold text-xs sm:text-sm tracking-wider uppercase ml-0.5"
                style={{ letterSpacing: '0.07em' }}
              >
                MASTER OF PIPSOLOGY
              </span>
            </Link>

            {/* Desktop nav links */}
            <ul ref={ulRef} className="relative hidden md:flex items-center gap-1.5 lg:gap-2.5" role="list">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="lg-link font-body font-medium no-underline text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            {/* Right side — CTA + hamburger */}
            <div className="flex items-center gap-3">
              <div className="hidden md:block"><StartJourneyButton size="sm" /></div>

              <button
                ref={burgerRef}
                type="button"
                className="lg-burger md:hidden flex flex-col gap-[5px] p-2 rounded-lg"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
              >
                <span className="lg-bar" />
                <span className="lg-bar" />
                <span className="lg-bar" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile fullscreen menu sheet */}
      <MobileMenuSheet isOpen={mobileOpen} onClose={closeMenu} />
    </>
  );
}
