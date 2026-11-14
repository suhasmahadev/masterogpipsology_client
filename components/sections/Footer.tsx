import React from 'react';
// ─── Footer ───────────────────────────────────────────────────────────────────
// Brand, navigation columns, contact, risk disclaimer.
// Server Component — no event handlers, CSS hover only.

import { FOOTER_COLUMNS, RISK_DISCLAIMER, BRAND_NAME, BRAND_TAGLINE, TELEGRAM_URL, WHATSAPP_URL, INSTAGRAM_URL } from '@/lib/content';
import { Hairline } from '@/components/ui/Hairline';

const SOCIAL_LINKS = [
  {
    id: 'telegram',
    label: 'Telegram',
    href: TELEGRAM_URL,
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 4L3 11l6 2.2L18 7l-7.5 7.5V19l3-3 4.5 3L21 4z" />
      </svg>
    ),
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: WHATSAPP_URL,
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.5L3 21z" />
        <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.9-1-.9.7c-.9-.4-1.7-1.2-2.1-2.1l.7-.9-1-1.9L9 9.5z" />
      </svg>
    ),
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: INSTAGRAM_URL,
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" />
      </svg>
    ),
  },
] as const;

export function Footer(): React.ReactElement {
  const year = new Date().getFullYear();

  return (
    <footer
      id="footer"
      role="contentinfo"
      className="px-4 md:px-8 lg:px-16 pt-16 pb-8 md:pt-20 md:pb-12"
    >
      <div className="max-w-7xl mx-auto">
        {/* Top row — brand + columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <svg
                width="24"
                height="24"
                viewBox="0 0 28 28"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="14" cy="14" r="12" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
                <polyline
                  points="6,16 10,12 14,17 18,10 22,13"
                  stroke="var(--accent-bright)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <circle cx="14" cy="14" r="1.5" fill="var(--accent)" />
              </svg>
              <span
                className="font-display font-medium text-md tracking-tight"
                style={{ color: 'var(--text)' }}
              >
                {BRAND_NAME}
              </span>
            </div>
            <p
              className="text-sm font-body leading-relaxed mb-5"
              style={{ color: 'var(--text-muted)', maxWidth: '24ch' }}
            >
              {BRAND_TAGLINE}
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3" aria-label="Social channels">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.id}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="footer-social-icon inline-flex items-center justify-center w-8 h-8 rounded-full border transition-colors duration-200"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3
                className="label-caps mb-4"
                style={{ color: '#D4AF37' }}
              >
                {col.heading}
              </h3>
              <ul className="flex flex-col gap-2.5" role="list">
                {col.links.map((link) => (
                  <li key={link.label} role="listitem">
                    <a
                      href={link.href}
                      className="footer-link text-sm font-body no-underline"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Hairline variant="gold" />

        {/* Social icon hover — CSS-only to keep this a Server Component */}
        <style>{`.footer-social-icon:hover { border-color: var(--accent) !important; color: var(--accent) !important; }`}</style>

        {/* Risk disclaimer */}
        <p
          className="text-xs font-body leading-relaxed mt-6 mb-6"
          style={{ color: 'var(--text-muted)', maxWidth: '80ch', opacity: 0.7 }}
        >
          {RISK_DISCLAIMER}
        </p>

        <Hairline variant="gold" />

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <span
            className="text-xs font-body"
            style={{ color: 'var(--text-muted)', opacity: 0.6 }}
          >
            &copy; {year} {BRAND_NAME}. All rights reserved.
          </span>
          <div className="flex items-center gap-4">
            <a
              href="/privacy"
              className="footer-link text-xs font-body no-underline"
              style={{ color: 'var(--text-muted)', opacity: 0.6 }}
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="footer-link text-xs font-body no-underline"
              style={{ color: 'var(--text-muted)', opacity: 0.6 }}
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
