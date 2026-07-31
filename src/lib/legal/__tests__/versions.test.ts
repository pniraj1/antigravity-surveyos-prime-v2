import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TERMS_VERSION, PRIVACY_VERSION, buildConsentRecord } from '../versions';

describe('legal versions', () => {
  test('terms version matches the date printed on the page', () => {
    expect(TERMS_VERSION).toBe('2026-07-31');
    expect(readFileSync('src/app/terms/page.tsx', 'utf8')).toContain('Version 2026-07-31');
  });

  test('terms names the contracting party and Pune jurisdiction', () => {
    const text = readFileSync('src/app/terms/page.tsx', 'utf8');
    expect(text).toContain('SurveyOS, a sole proprietorship of Niraj Patil, Pune, India');
    expect(text).toContain('courts of Pune, Maharashtra');
  });

  test('a consent record captures all three versions', () => {
    const record = buildConsentRecord();
    expect(record.termsVersion).toBe(TERMS_VERSION);
    expect(record.privacyVersion).toBe(PRIVACY_VERSION);
    expect(record.acceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
