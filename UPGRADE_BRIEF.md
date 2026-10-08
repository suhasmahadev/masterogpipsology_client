# Upgrade Brief: Master of Pipsology

You are upgrading "Master of Pipsology", a promo website for a 12-week live trading-education programme. It uses scroll-driven frame animations (videos converted to image frames). The theme is warm beige/cream with marble and gold accents, transitioning into dark as you scroll: a gold "Join the next cohort" button, a large serif headline "Education before execution", a marble arch and a glass candlestick-chart panel in the hero. Keep the theme, palette, copy and existing frame sequences intact. Elevate it to an ultra-luxury, award-level frontend. Every animation must be smooth at 60fps or higher.

## P1 Scroll-based 3D
Three.js (or R3F if React/Next) plus GSAP ScrollTrigger, with Lenis on one shared rAF clock. The hero glass chart panel becomes a real 3D glass object (MeshPhysicalMaterial transmission, gold edges, HDRI) that tilts and floats forward on scroll while the candlesticks grow with a gold glow. Add 3D parallax and a light sweep on the marble arch, a sparse cinematic gold particle field reacting to scroll velocity and mouse, 3D camera moves between sections as the palette goes beige to gold to dark, and one mid-page wow object (a gold coin or candlestick sculpture) that assembles and disperses on scroll. Cap DPR at 2, instance the particles, compress textures, pause rendering off-screen, and use a lighter fallback on mobile and for reduced motion.

## P2 Liquid glass navbar
A floating inset pill with backdrop blur and saturate, refraction of the content beneath (SVG feDisplacementMap or a shader), a gold specular edge and an inner glow. It shrinks after the hero, hides on scroll down and shows on scroll up. A liquid active-section indicator glides between links, links get a magnetic hover, and the CTA gets a liquid fill. On mobile, a full-screen glass menu with staggered reveals.

## P3 Smoothness
Find the real lag cause (mid-scroll decode, img src swapping, scroll-handler work, redundant redraws, layout thrash, oversized frames, competing scroll libraries). Preload and pre-decode frames with createImageBitmap, draw on one DPR-aware canvas, lerp progress inside the rAF loop, and draw only on frame change. Remove all fake metrics (hardcoded or random numbers, counters, stats or FPS readouts not backed by real data) and list what you removed.

## P4 Typography
A high-contrast display serif (Cormorant Garamond, Bodoni Moda or Playfair) paired with a refined sans (Manrope or Inter Tight), plus wide-tracked small caps for labels. Self-host as woff2, preload critical weights, use fluid clamp() sizes with no layout shift. Masked line-by-line headline reveals with character stagger (expo.out), a gold shimmer on key words, and scroll-scrubbed statements that fill from beige to gold.

## P5 Scroll effects
A continuous beige to gold to dark background, clip-path image reveals, parallax, one pinned horizontal showcase, film grain, gold light leaks, a gold monogram preloader tied to real loading progress, and a custom cursor on desktop.

## P6 Sections
Programme as a 12-week timeline drawing a gold line on scroll; Markets as 3D tilt glass cards; Faculty as an editorial gallery with hover-focus and a shared-element detail view; Results with only real content and a big serif testimonial; a creative gallery (choose and justify the concept); a refined CTA and footer with gold hairlines.

## P7 Frame quality
Give the user exact ffmpeg/cwebp commands for re-extracting at full quality, AI upscaling (Real-ESRGAN/Topaz), denoise/deband, optional RIFE interpolation, and WebP/AVIF at quality 80-85 in about 1920px and 1080px sets. Don't overwrite the originals.

## Rules
Animate only transform and opacity, lazy-load below the fold, be responsive, respect prefers-reduced-motion, target Lighthouse 90+, and verify there are no long tasks during fast scrolling.

## Working constraints
- Commit current state before editing so every change can be rolled back (snapshot commit `74ebc1e` on `main`; work happens on branch `luxury-upgrade`).
- Don't change the copy or delete assets.
- Don't deploy, push or publish anything.
