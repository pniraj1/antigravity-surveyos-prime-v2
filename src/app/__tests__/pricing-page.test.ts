import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLANS } from '@/lib/subscription/plans';

const src = () => readFileSync('src/app/pricing/page.tsx', 'utf8');

describe('/pricing', () => {
  test('renders plans from the constant instead of hardcoded amounts', () => {
    const text = src();
    expect(text).toContain("from '@/lib/subscription/plans'");
    for (const plan of PLANS) {
      expect(text).not.toContain(String(plan.amount));
    }
  });

  test('states tax clarity, required before purchase', () => {
    expect(src()).toMatch(/No additional tax/i);
  });
});
