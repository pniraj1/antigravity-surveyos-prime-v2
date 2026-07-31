import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const IDENTITY = 'SurveyOS, a sole proprietorship of Niraj Patil, Pune, India';

describe('legal pages', () => {
  test('the footer-linked routes exist', () => {
    expect(existsSync('src/app/refund/page.tsx')).toBe(true);
    expect(existsSync('src/app/contact/page.tsx')).toBe(true);
  });

  test('contact publishes the legal identity and grievance officer', () => {
    const text = readFileSync('src/app/contact/page.tsx', 'utf8');
    expect(text).toContain(IDENTITY);
    expect(text).toMatch(/Grievance Officer/);
    expect(text).toMatch(/Data Protection Board/);
  });

  test('refund policy states the cancellation rule', () => {
    const text = readFileSync('src/app/refund/page.tsx', 'utf8');
    expect(text).toMatch(/non-refundable/i);
    expect(text).toMatch(/cancel/i);
  });
});
