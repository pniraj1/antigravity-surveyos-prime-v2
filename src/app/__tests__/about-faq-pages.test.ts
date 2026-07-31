import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('about and faq', () => {
  test('both routes exist', () => {
    expect(existsSync('src/app/about/page.tsx')).toBe(true);
    expect(existsSync('src/app/faq/page.tsx')).toBe(true);
  });

  test('about names the proprietorship', () => {
    expect(readFileSync('src/app/about/page.tsx', 'utf8'))
      .toContain('SurveyOS, a sole proprietorship of Niraj Patil, Pune, India');
  });

  test('faq emits FAQPage structured data', () => {
    const text = readFileSync('src/app/faq/page.tsx', 'utf8');
    expect(text).toContain('FAQPage');
    expect(text).toContain('acceptedAnswer');
  });
});
