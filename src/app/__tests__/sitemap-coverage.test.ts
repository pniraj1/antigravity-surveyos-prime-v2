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
  test('links to the pages that now exist', () => {
    const text = readFileSync('src/components/landing/LandingClient.tsx', 'utf8');
    for (const href of ['/privacy', '/terms', '/refund', '/contact', '/about', '/faq', '/pricing']) {
      expect(text).toContain(`href="${href}"`);
    }
  });
});
