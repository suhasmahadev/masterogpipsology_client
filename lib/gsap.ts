'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
