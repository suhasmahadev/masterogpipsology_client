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
  { label: 'Faculty', href: '#team' },
  { label: 'Results', href: '#gallery' },
];

export const CTA_PRIMARY = 'Join the team';
export const CTA_SECONDARY = 'See the curriculum';

// TODO: replace with the real invite links before launch.
export const TELEGRAM_URL = '#telegram';
export const WHATSAPP_URL = '#whatsapp';

export interface JoinChannel { id: 'telegram' | 'whatsapp'; label: string; href: string }
export const JOIN_CHANNELS: JoinChannel[] = [
  { id: 'telegram', label: 'Join Telegram group', href: TELEGRAM_URL },
  { id: 'whatsapp', label: 'Join WhatsApp group', href: WHATSAPP_URL },
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
  'Twelve weeks of live sessions, structured as six modules. Each builds directly on the last — skip one and you feel it.';

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
      { label: 'London, UK', href: '#' },
      { label: 'Dubai, UAE', href: '#' },
      { label: 'Lagos, Nigeria', href: '#' },
      { label: 'Online (global)', href: '#' },
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
    name: 'Founder',
    role: 'Founder & Chief Market Strategist',
    title: 'Managing Principal',
    pedigree: 'Ex-Barclays Capital · FX Flow Desk',
    image: '/team/founder.jpeg',
    bio: 'Pioneered the institutional order flow framework taught across 14 cohorts. Former senior liquidity architect in London and Dubai.',
    quote: 'The market leaves footprint anomalies every second. Our discipline is learning how to read them without emotion.',
    tags: ['Order Flow', 'Macro Architecture', 'FX Liquidity'],
  },
  {
    id: 'member-2',
    name: 'Co-Founder',
    role: 'Co-Founder & Executive Director',
    title: 'Executive Director',
    pedigree: 'Ex-Citadel Securities · Algorithmic Risk',
    image: '/team/co_founder.jpeg',
    bio: 'Directs strategic growth, capital preservation mechanics, and institutional risk governance across desk cohorts.',
    quote: 'Risk is not a secondary calculation after the entry. Risk is the entire trade.',
    tags: ['Executive Desk', 'Portfolio Heat', 'Variance Control'],
  },
  {
    id: 'member-3',
    name: 'Trading Experience',
    role: 'Head of Quantitative Risk Architecture',
    title: 'Senior Desk Mentor',
    pedigree: 'Chicago Board of Trade (CBOT) Veteran',
    image: '/team/experience.png',
    bio: 'Specializes in session open auction dynamics, institutional volume profiles, and multi-asset market experience.',
    quote: 'Tape reading is the language of participants who cannot hide their size.',
    tags: ['Index Auctions', 'Volume Profile', 'Session Timing'],
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
];

// ─── Desk & Cohort Moments ───────────────────────────────────────────────────

export const GALLERY_MOMENTS: GalleryMoment[] = [
  {
    id: 'moment-1',
    title: 'Founder & Principal',
    subtitle: 'Institutional order flow framework and executive vision',
    image: '/team/founder.jpeg',
    tag: 'Founder',
  },
  {
    id: 'moment-2',
    title: 'Co-Founder & Executive Desk',
    subtitle: 'Strategic operations, portfolio variance control and global desk expansion',
    image: '/team/co_founder.jpeg',
    tag: 'Co-Founder',
  },
  {
    id: 'moment-3',
    title: 'Institutional Experience & Track Record',
    subtitle: 'Decades of combined live floor experience and proprietary analytics',
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
];
