// Scroll caption copy. Every string is derived from lib/content.ts (no new claims or numbers); the Crypto rail copy is CRYPTO_RAIL_LINES.
import {
  CRYPTO_RAIL_LINES,
  CURRICULUM_CHAPTERS,
  MARKETS,
  NAV_LINKS,
} from '@/lib/content';
import type { FlowWindow } from '@/lib/caption-flow';
import { forexRailSpec } from '@/lib/forex-rail';
import { cryptoRailSpec } from '@/lib/crypto-slabs';

/** Fully shown while start <= progress <= end; the connector to the next step draws between end and the next start. */
export interface ScrollCaption extends FlowWindow {
  /** Small-caps label above the line. */
  label: string;
  /** Display serif line. */
  text: string;
  /** Text motion for the 'market' rail variant (default glide). */
  kind?: 'roll' | 'track' | 'glide';
}

export interface CaptionFlow {
  from: number;
  to: number;
  steps: ScrollCaption[];
}

const market = (id: string) => MARKETS.find((m) => m.id === id)!;
const chapter = (n: number) => CURRICULUM_CHAPTERS[n - 1];
const programme = NAV_LINKS[0].label;
const chapterLabel = (n: number) => `${programme} ${chapter(n).number}`;

const forex = market('forex');
const equities = market('equities');

// Crypto: driven by the stop coordinate (CryptoMarketScroll passes railU(s)): one hold per stop, transitions only between stops.
const cryptoRail = cryptoRailSpec();
export const CRYPTO_FLOW: CaptionFlow = {
  from: cryptoRail.from,
  to: cryptoRail.to,
  steps: CRYPTO_RAIL_LINES.map(([label, text], i) => ({ label, text, start: cryptoRail.steps[i].start, end: cryptoRail.steps[i].end })),
};

// Forex/Stock/Opportunity: driven by forexRailU(stop coordinate), stepped end to end (lib/forex-rail.ts). Rows in order: forex x4,
// equities x4 (kicker at S1, three rows passing), Programme 02 (S2), Programmes 03-05 (passing), Programme 06 (O1).
const FOREX_LINES: Array<[string, string]> = [
  [forex.heading, forex.kicker],
  [forex.heading, forex.tags[0]],
  [forex.heading, forex.tags[1]],
  [forex.heading, forex.tags[2]],
  [equities.heading, equities.kicker],
  [equities.heading, equities.tags[0]],
  [equities.heading, equities.tags[1]],
  [equities.heading, equities.tags[2]],
  [chapterLabel(2), chapter(2).title],
  [chapterLabel(3), chapter(3).title],
  [chapterLabel(4), chapter(4).title],
  [chapterLabel(5), chapter(5).title],
  [chapterLabel(6), chapter(6).title],
];
const forexRail = forexRailSpec();
export const FOREX_FLOW: CaptionFlow = {
  from: forexRail.from,
  to: forexRail.to,
  steps: FOREX_LINES.map(([label, text], i) => ({
    label,
    text,
    kind: i < 4 ? 'roll' : i < 8 ? 'track' : 'glide',
    ...forexRail.steps[i],
  })),
};
