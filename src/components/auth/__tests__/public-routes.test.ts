import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MARKETING_LINKS } from '@/components/marketing/MarketingShell';

/**
 * A marketing page missing from AuthGate's publicRoutes still serves correct
 * static HTML, then React replaces it with the landing page on hydration.
 * The page looks right for a moment and then vanishes — for logged-out
 * visitors only, which is every prospect.
 */
describe('AuthGate public routes', () => {
  const src = readFileSync('src/components/auth/AuthGate.tsx', 'utf8');

  test('every marketing and legal route bypasses the auth gate', () => {
    for (const link of MARKETING_LINKS) {
      expect(src).toContain(`'${link.href}'`);
    }
  });

  test('the landing page itself is still public', () => {
    expect(src).toContain("'/landing'");
  });
});
