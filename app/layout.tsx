import type { Metadata } from 'next';
import { Bodoni_Moda, Cinzel, Cormorant_Garamond, Italiana, Manrope, Playfair_Display } from 'next/font/google';
import './globals.css';
import { LenisProvider } from '@/components/providers/LenisProvider';
import { cn } from "@/lib/utils";

// ─── Fonts ────────────────────────────────────────────────────────────────────

const display = Cormorant_Garamond({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-display-serif',
  display: 'swap',
});

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans-body',
  display: 'swap',
});

// Crypto step-scroll display face (CryptoSlabs + Crypto caption rail). Variable: wght + opsz (optical size follows font-size).
const lux = Bodoni_Moda({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-lux-display',
  display: 'swap',
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Master of Pipsology — Professional Trading Education',
  icons: {
    icon: [
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/brand/apple-icon-180.png',
  },
  description:
    'Education before execution. A 12-week live trading programme covering risk architecture, market structure, order flow and execution psychology. Forex, equities and crypto.',
  keywords: [
    'trading education',
    'forex trading',
    'market structure',
    'order flow',
    'trading psychology',
    'risk management',
    'trading course',
  ],
  authors: [{ name: 'Master of Pipsology' }],
  creator: 'Master of Pipsology',
  metadataBase: new URL('https://masterofpipsology.com'),
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://masterofpipsology.com',
    title: 'Master of Pipsology — Professional Trading Education',
    description:
      'Education before execution. A 12-week live trading programme.',
    siteName: 'Master of Pipsology',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Master of Pipsology — Professional Trading Education',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Master of Pipsology — Professional Trading Education',
    description:
      'Education before execution. A 12-week live trading programme covering risk, structure, order flow and execution.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

// ─── Layout ───────────────────────────────────────────────────────────────────

// Forex and Stock display face (MarketSlabs + Forex caption rail). Below the fold: no preload, so it never competes with the hero LCP.
const mkt = Cinzel({
  subsets: ['latin'],
  variable: '--font-mkt-display',
  display: 'swap',
  preload: false,
});

// Curriculum headline face. Below the fold: no preload.
const playfair = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
  preload: false,
});

// Results headline face (thin Didone). Below the fold: no preload.
const italiana = Italiana({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-italiana',
  display: 'swap',
  preload: false,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(display.variable, sans.variable, lux.variable, mkt.variable, playfair.variable, italiana.variable)}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <LenisProvider>
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}
