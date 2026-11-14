import { getLenis } from '@/components/providers/LenisProvider';
import { planJourney } from '@/lib/journey-math';

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Smooth-scroll to Crypto frame 0 (#crypto-sequence top = Crypto progress 0; frame 0 is pinned, so it is always crisp).
 * From far below (or far above) it cuts to half a viewport above Crypto and glides in, instead of rewinding the page.
 */
export function startJourney(): void {
  const el = document.getElementById('crypto-sequence');
  if (!el) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lenis = getLenis();
  if (lenis) {
    const target = el.getBoundingClientRect().top + window.scrollY;
    if (reduced) {
      lenis.scrollTo(target, { immediate: true, force: true });
      return;
    }
    const plan = planJourney(lenis.animatedScroll, target, window.innerHeight);
    if (plan.cutTo !== null) lenis.scrollTo(plan.cutTo, { immediate: true, force: true });
    lenis.scrollTo(target, { duration: plan.duration, easing: easeInOutCubic, lock: true, force: true });
  } else {
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
}
