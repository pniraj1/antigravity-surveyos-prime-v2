import { describe, test, expect } from 'vitest';
import { MARKETING_LINKS } from '../MarketingShell';

describe('MARKETING_LINKS', () => {
  test('covers every marketing and legal route', () => {
    const hrefs = MARKETING_LINKS.map((l) => l.href);
    for (const route of ['/pricing', '/features', '/about', '/contact', '/faq', '/privacy', '/terms', '/refund']) {
      expect(hrefs).toContain(route);
    }
  });

  test('uses /refund singular, matching the existing footer link', () => {
    const hrefs = MARKETING_LINKS.map((l) => l.href);
    expect(hrefs).toContain('/refund');
    expect(hrefs).not.toContain('/refunds');
  });
});
