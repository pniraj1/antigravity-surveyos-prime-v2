import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import sitemap from '@/app/sitemap';
import { MARKETING_LINKS } from '@/components/marketing/MarketingShell';

describe('sitemap', () => {
  test('lists every marketing route', () => {
    const paths = sitemap().map((e) => new URL(e.url).pathname.replace(/\/$/, '') || '/');
    for (const link of MARKETING_LINKS) {
      expect(paths).toContain(link.href);
    }
  });
});

describe('landing footer', () => {
  // Must assert against src/app/landing/page.tsx — the page actually rendered.
  // components/landing/LandingClient.tsx is imported by nothing, so asserting
  // there passes while real users see no links at all.
  test('the rendered landing page links to every marketing and legal page', () => {
    const text = readFileSync('src/app/landing/page.tsx', 'utf8');
    for (const href of ['/privacy', '/terms', '/refund', '/contact', '/about', '/faq', '/pricing', '/features']) {
      expect(text).toContain(`'${href}'`);
    }
  });
});
