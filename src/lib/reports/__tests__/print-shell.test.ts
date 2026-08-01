import { describe, expect, test } from 'vitest';
import { buildPrintShell, escapeCssString, footerFromProfile } from '../print-shell';
import type { SurveyorProfile } from '@/types/vehicle';

const profile = (over: Partial<SurveyorProfile>) => over as SurveyorProfile;

describe('footerFromProfile', () => {
  test('joins name and qualification', () => {
    expect(footerFromProfile(profile({ name: 'Niraj Patil', qualifications: 'B.E. (Mech)' })))
      .toBe('Niraj Patil, B.E. (Mech)');
  });

  test('omits the comma when no qualification is recorded', () => {
    expect(footerFromProfile(profile({ name: 'Niraj Patil', qualifications: '' })))
      .toBe('Niraj Patil');
  });

  test('returns empty for a missing profile rather than a stray comma', () => {
    expect(footerFromProfile(null)).toBe('');
    expect(footerFromProfile(profile({ name: '', qualifications: 'B.E.' }))).toBe('');
  });
});

describe('escapeCssString', () => {
  test('escapes a quote that would otherwise terminate content: "..." early', () => {
    // An unescaped quote ends the CSS string and breaks every rule after it.
    expect(escapeCssString('R. K. "Raj" Sharma')).toBe('R. K. \\"Raj\\" Sharma');
  });

  test('escapes backslashes and flattens newlines', () => {
    expect(escapeCssString('A\\B')).toBe('A\\\\B');
    expect(escapeCssString('one\ntwo')).toBe('one two');
  });
});

describe('buildPrintShell', () => {
  const shell = (footer: string) =>
    buildPrintShell('<p>body</p>', { title: 'T', footerLeft: footer });

  test('emits both margin boxes with Page N and the surveyor line', () => {
    const html = shell('Niraj Patil, B.E. (Mech)');
    expect(html).toContain('@bottom-right');
    expect(html).toContain('content: "Page " counter(page)');
    expect(html).toContain('content: "Niraj Patil, B.E. (Mech)"');
  });

  test('never emits counter(pages) — "Page N" only, by design', () => {
    // NUMPAGES/counter(pages) is the part that goes stale in Word.
    expect(shell('X')).not.toContain('counter(pages)');
  });

  test('omits the left box entirely when there is no profile name', () => {
    // An empty content string would still paint an empty box.
    expect(shell('')).not.toContain('@bottom-left');
  });

  test('reserves bottom margin for the footer', () => {
    expect(shell('X')).toContain('margin: 10mm 12mm 16mm 12mm');
  });

  test('keeps the body fragment untouched', () => {
    expect(shell('X')).toContain('<p>body</p>');
  });
});
