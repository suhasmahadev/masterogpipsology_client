// ─── Master of Pipsology — Content Source of Truth ───────────────────────────
// All copy, stats, and structured data lives here. Swap numbers and quotes
// for real client data before launch.

export interface NavLink {
  label: string;
  href: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Market {
  id: string;
  heading: string;
  kicker: string;
  body: string;
  tags: string[];
}

export interface CurriculumChapter {
  number: string;
  title: string;
  description: string;
}

export interface Achievement {
  value: string;
  label: string;
}

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  cohort: string;
}

export interface FooterColumn {
  heading: string;
  links: { label: string; href: string }[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  title: string;
  pedigree: string;
  image: string;
  bio: string;
  quote: string;
  tags: string[];
}

export interface GalleryMoment {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  tag: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export const NAV_LINKS: NavLink[] = [
  { label: 'Programme', href: '#curriculum' },
  { label: 'Markets', href: '#markets' },
  { label: 'Strategies', href: '#strategies' },
  { label: 'Faculty', href: '#team' },
  { label: 'Results', href: '#gallery' },
];

export const CTA_PRIMARY = 'Join the team';
export const CTA_SECONDARY = 'Start journey';

// TODO: replace with the real invite links before launch.
export const TELEGRAM_URL = '#telegram';
export const WHATSAPP_URL = 'https://chat.whatsapp.com/Lelbvw3BQPB8n7fSVpniTY';
export const INSTAGRAM_URL = 'https://www.instagram.com/masterofpipsology/';

export interface JoinChannel { id: 'telegram' | 'whatsapp'; label: string; href: string }
export const JOIN_CHANNELS: JoinChannel[] = [
  { id: 'telegram', label: 'Join Telegram group', href: TELEGRAM_URL },
  { id: 'whatsapp', label: 'Join WhatsApp group', href: WHATSAPP_URL },
];

// Footer "Join now" capsules.
export interface JoinLink { id: 'whatsapp' | 'instagram' | 'telegram'; label: string; href: string }
export const JOIN_LINKS: JoinLink[] = [
  { id: 'whatsapp', label: 'WhatsApp', href: WHATSAPP_URL },
  { id: 'instagram', label: 'Instagram', href: INSTAGRAM_URL },
  { id: 'telegram', label: 'Telegram', href: TELEGRAM_URL },
];

// ─── Hero ─────────────────────────────────────────────────────────────────────

export const HERO_HEADLINE_LINES = [
  'Trade with the edge',
  'the institutions use',
  'every day.',
];

export const HERO_SUBLINE =
  'Education before execution. A 12-week live programme covering risk architecture, market structure, order flow and execution psychology. Built for traders who are serious about consistency.';

// ─── Marquee ──────────────────────────────────────────────────────────────────

export const MARQUEE_ITEMS = [
  'Risk First',
  'Position Sizing',
  'Market Structure',
  'Order Flow',
  'Liquidity Analysis',
  'Trade Journaling',
  'Execution Psychology',
  'Drawdown Management',
  'Session Timing',
  'Multi-timeframe Analysis',
];

// ─── Markets ──────────────────────────────────────────────────────────────────

export const MARKETS: Market[] = [
  {
    id: 'forex',
    heading: 'Forex',
    kicker: 'The global reserve market',
    body: 'The foreign exchange market moves $7.5 trillion a day. We teach you where institutions place their orders, how to read displacement from manipulation, and how to position for high-probability reversals at key structural levels.',
    tags: ['Major pairs', 'London & NY sessions', 'Interbank flow'],
  },
  {
    id: 'equities',
    heading: 'Equities',
    kicker: 'Individual stocks and indices',
    body: 'From single-name momentum plays to index futures, equities demand a firm grasp of relative strength and earnings catalysts. Our module covers gap theory, volume spread analysis and the unique risk dynamics of leveraged equity instruments.',
    tags: ['US indices', 'Sector rotation', 'Earnings plays'],
  },
  {
    id: 'crypto',
    heading: 'Crypto',
    kicker: 'Digital assets with structural logic',
    body: 'Crypto markets run 24/7 and exhibit textbook liquidity patterns — often more cleanly than traditional markets. The programme applies the same market-structure principles to Bitcoin, Ethereum and major altcoins, with sessions on on-chain signals.',
    tags: ['Bitcoin & Ethereum', 'On-chain data', 'Futures basis'],
  },
];

// ─── Gallery / Achievements ────────────────────────────────────────────────────

export const CERTIFICATE_NAME = 'Master of Pipsology';
export const CERTIFICATE_SUBTITLE = 'Professional Trading Certification';
export const AUDIT_BODY = 'Issued by Master of Pipsology';

// ─── Curriculum ───────────────────────────────────────────────────────────────

export const CURRICULUM_INTRO =
  'Live sessions, structured as six modules. Each builds directly on the last — skip one and you feel it.';

export const CURRICULUM_CHAPTERS: CurriculumChapter[] = [
  {
    number: '01',
    title: 'Risk architecture',
    description:
      'Position sizing, R-multiples, maximum drawdown parameters and portfolio heat. You will not place a live trade until this is internalised.',
  },
  {
    number: '02',
    title: 'Market structure',
    description:
      'Breaks of structure, changes of character, premium and discount zones. How to read a chart before you read a price.',
  },
  {
    number: '03',
    title: 'Order flow and liquidity',
    description:
      'Where stops accumulate, how institutions engineer liquidity, displacement versus manipulation. The lens that makes everything else click.',
  },
  {
    number: '04',
    title: 'Entries and execution',
    description:
      'Model-based entry criteria, confirmation timeframes, limit versus market orders. Precision over volume.',
  },
  {
    number: '05',
    title: 'Trade management',
    description:
      'Partial closes, trailing stops, re-entry after a stop-out, and when to walk away. The psychology of an open position.',
  },
  {
    number: '06',
    title: 'Review and compounding',
    description:
      'Building a trade journal that compounds your edge, not your losses. Monthly review protocol and how to raise risk as account equity grows.',
  },
];

export const PROGRAMME_PILLARS = CURRICULUM_CHAPTERS.slice(0, 4).map((c) => ({
  value: c.number,
  label: c.title,
}));

// ─── Testimonial ──────────────────────────────────────────────────────────────

export const TESTIMONIAL: Testimonial = {
  quote:
    'I had three losing months in a row before joining. By week four I understood why — I was chasing entries rather than waiting for structure. The programme does not give you a holy grail. It gives you a framework that makes the market legible.',
  name: 'Marcus Adeyemi',
  role: 'Full-time trader',
  cohort: 'Cohort 11',
};

// ─── Final CTA ────────────────────────────────────────────────────────────────

export const FINAL_CTA_HEADLINE = 'Education before execution.';

/** Closing statement over the Intelligence video at the end of the Forex journey. Line 2 renders gold italic. */
export const CLOSING_LINES: readonly [string, string] = ['Three markets. One discipline.', 'The opportunity is yours.'];

// ─── Crypto step slabs (components/sections/CryptoSlabs.tsx) ────────────────
export interface CryptoSlabCopy {
  /** Wide-tracked small-caps label. */
  label: string;
  /** Display serif title: [plain part, gold italic part]. */
  title: readonly [string, string];
  /** Optional paragraph. */
  body?: string;
  /** Optional path row, separated by gold diamonds. */
  path?: readonly string[];
  /** Optional chips (intro slab). */
  tags?: readonly string[];
}
/** Slab 1 (approach -> stop raw 112): who MOP is and why crypto comes first. */
export const CRYPTO_SLAB_INTRO: CryptoSlabCopy = {
  label: 'Master of Pipsology · Crypto',
  title: ['Learn the market', 'that never sleeps.'],
  body: 'Master of Pipsology is a trading academy in Mysore and Bengaluru. We begin with crypto, the clearest place to learn structure, liquidity and risk before real capital is on the line.',
  tags: ['BTC • BITCOIN', 'ETH • ETHEREUM', 'SOL • SOLANA'],
};
/** Slab 2 (frames 112 -> 139): how MOP teaches, from the basics to independent trading. */
export const CRYPTO_SLAB_TEACH: CryptoSlabCopy = {
  label: 'The MOP method',
  title: ['From the first chart', 'to the final call.'],
  body: 'Live sessions, one step at a time. We start at zero, then build structure, liquidity and risk until you can plan, take and manage a trade on your own.',
  path: ['Foundations', 'Structure', 'Risk', 'Execution'],
};
/** Slab 3 (stop raw 179, the hand-off): centred above the falling coin; Forex follows. */
export const CRYPTO_SLAB_CLOSE: CryptoSlabCopy = {
  label: 'Master of Pipsology',
  title: ['Crypto is chapter one.', 'Forex comes next.'],
};
// ─── Forex and Stock slabs (components/sections/MarketSlabs.tsx) ────────────
export type SlabCopy = CryptoSlabCopy;
/** Forex slab: in during the Crypto hand-off, held at Forex stops 0-3, out during the S1 glide before the folder cut. */
export const FOREX_SLAB: SlabCopy = {
  label: 'Master of Pipsology · Forex',
  title: ['Chapter two is forex.', 'The world, in pairs.'],
  body: 'Live sessions in Mysore and Bengaluru take you through the majors as London and New York trade. Same rules as crypto: structure first, risk defined, then the trade.',
  tags: ['EUR/USD • MAJOR', 'GBP/JPY • CROSS', 'XAU/USD • GOLD'],
};
/** Stock slab: in after the folder cut during the S1 glide, held at S1 and on native scroll, out before Opportunity. */
export const STOCK_SLAB: SlabCopy = {
  label: 'Master of Pipsology · Equities',
  title: ['Then the equity floor.', 'One stock to the index.'],
  body: 'Single stocks, the indices they build and the news that moves them, taught in the same live classroom. Read the chart, size the risk, plan the exit before the entry.',
  tags: ['S&P 500 • INDEX', 'NASDAQ • INDEX', 'GOLD • COMMODITY'],
};
/** Opportunity slab (in after the stock->opportunity cut, held at O1, out before O2). Copy unchanged from the old overlay. */
export const OPPORTUNITY_SLAB: SlabCopy = {
  label: 'Where it all converges',
  title: ['This is your moment,', 'the opportunity.'],
  body: 'Every market. Every asset class. Every edge. The complete picture of how institutional capital moves — and how you position yourself inside it.',
  tags: ['STRUCTURE • ORDER FLOW', 'RISK • PSYCHOLOGY', 'EXECUTION • CONSISTENCY'],
};
/** Crypto caption rail, one [label, text] per hold (lib/crypto-slabs.ts CRYPTO_RAIL_HOLDS_S: s = 0, 0.5, 1, 2, 3). */
export const CRYPTO_RAIL_LINES: readonly (readonly [string, string])[] = [
  ['Crypto', 'Open around the clock'],
  ['Master of Pipsology', 'Where the journey begins'],
  ['Foundations', 'Bitcoin, Ethereum, Solana'],
  ['Discipline', 'Risk first, then the trade'],
  ['Mysore · Bengaluru', 'Two cities, one standard'],
];

// ─── Hook box (components/sections/HookBox.tsx): one hook per step-scroll stop ─────
export interface HookCopy {
  /** Wide-tracked small-caps label (<= 32 chars). */
  label: string;
  /** [plain line, gold line]. */
  title: readonly [string, string];
  /** Frame behind the box: 'light' (cream frames, dark ink; default) or 'dark' (stock/opportunity frames, cream ink). */
  tone?: 'light' | 'dark';
}
/** Crypto stops raw 1, 112, 139, 179 (lib/hook-box.ts CRYPTO_HOOK_IDS order). */
export const CRYPTO_HOOKS: readonly HookCopy[] = [
  { label: 'Master of Pipsology · Crypto', title: ['Learn the market', 'that never sleeps.'] },
  { label: 'The MOP method', title: ['Structure first.', 'Risk defined.'] },
  { label: 'Live · Mysore & Bengaluru', title: ['From the first chart', 'to the final call.'] },
  { label: 'Master of Pipsology', title: ['Crypto is chapter one.', 'Forex comes next.'] },
];
/** Forex chain stops Y0, F1-F3, S1, S2, O1, O2 (lib/hook-box.ts MARKET_HOOK_IDS order). O3/V: CLOSING_LINES on the video. */
export const MARKET_HOOKS: readonly HookCopy[] = [
  { label: 'Master of Pipsology · Forex', title: ['Chapter two is forex.', 'The world, in pairs.'] },
  { label: 'Forex · Major pairs', title: ['Every pair is', 'two economies.'] },
  { label: 'Forex · London & NY sessions', title: ['Timing is a skill.', 'Sessions, taught live.'] },
  { label: 'Forex · Interbank flow', title: ['Follow the money', 'behind the move.'] },
  { label: 'Master of Pipsology · Equities', title: ['Then the equity floor.', 'One stock to the index.'], tone: 'dark' },
  { label: 'Equities · Indices & earnings', title: ['Bull or bear,', 'the plan comes first.'], tone: 'dark' },
  { label: 'Where it all converges', title: ['This is your moment,', 'the opportunity.'], tone: 'dark' },
  { label: 'Master of Pipsology', title: ['Education before', 'execution.'], tone: 'dark' },
];

// ─── Footer ───────────────────────────────────────────────────────────────────

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Programme',
    links: [
      { label: 'Curriculum', href: '#curriculum' },
      { label: 'Faculty & Leadership', href: '#team' },
      { label: 'Results', href: '#gallery' },
      { label: 'Apply now', href: '#cta' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About us', href: '#footer' },
      { label: 'Instructors', href: '#footer' },
      { label: 'Press', href: '#footer' },
      { label: 'Contact', href: 'mailto:hello@masterofpipsology.com' },
    ],
  },
  {
    heading: 'Locations',
    links: [
      { label: 'Mysore, India', href: '#' },
      { label: 'Bengaluru, India', href: '#' },
    ],
  },
];

export const RISK_DISCLAIMER =
  'Trading foreign exchange, equities and cryptocurrency involves substantial risk of loss and is not appropriate for all investors. Past performance is not indicative of future results. The programme is educational in nature and does not constitute financial advice. Always consult a qualified financial adviser before risking capital.';

export const BRAND_NAME = 'Master of Pipsology';
export const BRAND_TAGLINE = 'Trading education. No shortcuts.';

// ─── Team & Faculty ───────────────────────────────────────────────────────────

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'member-1',
    name: 'Kiran Nag',
    role: 'Founder, Master of Pipsology',
    title: 'Founder · Mysore Community',
    pedigree: '10+ Year Trader · Ex-Hedge Fund Manager, ProfitFX Dubai',
    image: '/team/founder.jpeg',
    bio: 'Founder of Master of Pipsology and the Mysore trading community. 10+ year experienced trader and former Hedge Fund Manager at ProfitFX Dubai Trading Company. Pioneered the institutional order flow framework.',
    quote: 'The market leaves footprint anomalies every second. Our discipline is learning how to read them without emotion.',
    tags: ['Order Flow', 'Macro Architecture', '10+ Years Trading'],
  },
  {
    id: 'member-2',
    name: 'Co-Founder',
    role: 'Co-Founder & Executive Director',
    title: 'Executive Director',
    pedigree: ' algo trader with 5+ years experience',
    image: '/team/co_founder_v2.jpeg',
    bio: 'Directs strategic growth, capital preservation mechanics, and institutional risk governance across desk cohorts.',
    quote: 'Risk is not a secondary calculation after the entry. Risk is the entire trade.',
    tags: ['Executive Desk', 'Portfolio Heat', 'Variance Control'],
  },
  {
    id: 'member-3',
    name: 'Trading Experience',
    role: 'Head of Quantitative Risk Architecture',
    title: 'Senior Desk Mentor',
    pedigree: 'Hedge Fund Manager · ProfitFX Dubai Trading Company',
    image: '/team/experience.png',
    bio: '10+ years of institutional floor and hedge fund trading experience at ProfitFX Dubai Trading Company. Specializes in session open auction dynamics, volume profiles, and liquidity sweeps.',
    quote: 'Tape reading is the language of participants who cannot hide their size.',
    tags: ['Hedge Fund Experience', 'Volume Profile', 'Session Timing'],
  },
  {
    id: 'member-4',
    name: 'Core Faculty & Team',
    role: 'Core Faculty & Trading Team',
    title: 'Senior Faculty',
    pedigree: 'Institutional Trading Group',
    image: '/team/team.jpeg',
    bio: 'Oversees multi-timeframe structural mapping, liquidity sweep identification, and collaborative desk execution.',
    quote: 'Structure gives you context. Context prevents you from becoming exit liquidity.',
    tags: ['Market Structure', 'Execution Team', 'Live Audits'],
  },
  {
    id: 'member-5',
    name: 'Accreditation & Licence',
    role: 'Regulatory Compliance & Licensure',
    title: 'Compliance & Standards',
    pedigree: 'Certified Institutional Standards',
    image: '/team/licence.jpeg',
    bio: 'Audited educational standards, proprietary methodology licensing, and adherence to verified risk protocols.',
    quote: 'Institutional credibility is established through transparency, compliance, and verified standards.',
    tags: ['Licensure', 'Compliance', 'Certified Standards'],
  },
  {
    id: 'member-6',
    name: 'Kiran Nag · Live Desk',
    role: 'Founder & Head of Trading Desk',
    title: 'Founder · Mysore Community',
    pedigree: '10+ Years Live Trading · ProfitFX Dubai',
    image: '/team/founder_img2.png',
    bio: 'Conducting live trading audits, structural market reviews, and execution masterclasses for Mysore community traders.',
    quote: 'Discipline in execution is what separates an amateur from a seasoned trader.',
    tags: ['Live Execution', 'Desk Leadership', 'Mysore Community'],
  },
];

// ─── Desk & Cohort Moments ───────────────────────────────────────────────────

export const GALLERY_MOMENTS: GalleryMoment[] = [
  {
    id: 'moment-1',
    title: 'Kiran Nag · Founder',
    subtitle: 'Founder of Master of Pipsology & Mysore community · 10+ year experienced trader',
    image: '/team/founder.jpeg',
    tag: 'Founder',
  },
  {
    id: 'moment-2',
    title: 'Co-Founder & Executive Desk',
    subtitle: 'Strategic operations, portfolio variance control and global desk expansion',
    image: '/team/co_founder_v2.jpeg',
    tag: 'Co-Founder',
  },
  {
    id: 'moment-3',
    title: 'Institutional Experience & Track Record',
    subtitle: '10+ years experience · Hedge Fund Manager at ProfitFX Dubai Trading Company',
    image: '/team/experience.png',
    tag: 'Experience',
  },
  {
    id: 'moment-4',
    title: 'Core Faculty & Execution Team',
    subtitle: 'Live session tape readers, quantitative risk mentors and cohort directors',
    image: '/team/team.jpeg',
    tag: 'Team',
  },
  {
    id: 'moment-5',
    title: 'Official Licensure & Accreditations',
    subtitle: 'Institutional certification, compliance and verified regulatory standards',
    image: '/team/licence.jpeg',
    tag: 'Licence',
  },
  {
    id: 'moment-6',
    title: 'Kiran Nag · Live Desk Session',
    subtitle: '10+ years experience · Founder guiding live order flow execution in Mysore',
    image: '/team/founder_img2.png',
    tag: 'Founder',
  },
];

// ─── 8 Strategies ─────────────────────────────────────────────────────────────
// PLACEHOLDER COPY — client to replace with approved descriptions

export interface Strategy {
  id: number;
  name: string;
  teaser: string;
}

export const STRATEGIES: Strategy[] = [
  {
    id: 1,
    name: 'Indecision Strategy',
    teaser:
      'Learn to recognise the moments when the market is undecided, and why standing aside is a position. Understand how competing buyers and sellers create the conditions that precede a decisive move.',
  },
  {
    id: 2,
    name: '50% Correction Zone',
    teaser:
      'Discover how price repeatedly returns to the midpoint of a prior range before committing to direction. Learn the zone where institutional orders tend to cluster for high-probability entries.',
  },
  {
    id: 3,
    name: 'Third Dimension',
    teaser:
      'Explore the layer of market context that most traders ignore — the broader structural narrative that determines whether a setup has real confluence or is simply noise.',
  },
  {
    id: 4,
    name: 'Fourth Dimension',
    teaser:
      'Learn how time itself functions as a filter, and why the same setup carries different weight at different points in the trading session or cycle.',
  },
  {
    id: 5,
    name: 'Wick – Body Formation',
    teaser:
      "Understand what the relationship between a candle's wick and its body reveals about the intent of participants — and how this single piece of data can confirm or invalidate a setup.",
  },
  {
    id: 6,
    name: 'Candle Analysis',
    teaser:
      'Move beyond patterns and learn to read individual candles as a record of the battle between buyers and sellers, building the contextual judgment that separates reactive traders from prepared ones.',
  },
  {
    id: 7,
    name: 'Sentiment Analysis',
    teaser:
      'Learn how to gauge the dominant mood of the market across different participant groups, and how prevailing sentiment shapes the environment in which your technical setups play out.',
  },
  {
    id: 8,
    name: 'Geopolitical Issues',
    teaser:
      'Understand the mechanisms by which major geopolitical events move markets, and how to position your risk before, during and after high-impact macro catalysts.',
  },
];

export const STRATEGIES_LABEL = 'The framework';
export const STRATEGIES_HEADLINE_PLAIN = 'The ';
export const STRATEGIES_HEADLINE_EM = '8 Strategies';
export const STRATEGIES_SUBLINE =
  'One framework, applied across forex, crypto and the share market.';
export const STRATEGIES_JOIN_HEADLINE = 'Get the full strategies in the channel';
export const STRATEGIES_JOIN_BODY =
  'Every strategy is taught live, with annotated charts and live Q&A. Join the WhatsApp channel to access the full lesson library.';
