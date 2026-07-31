import { describe, test, expect } from 'vitest';
import { needsReaccept } from '../TermsReacceptGate';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions';

describe('needsReaccept', () => {
  test('an existing surveyor with no consent record must accept', () => {
    expect(needsReaccept(undefined)).toBe(true);
  });

  test('an outdated terms version must be re-accepted', () => {
    expect(needsReaccept({ termsVersion: '2026-06-19', privacyVersion: PRIVACY_VERSION })).toBe(true);
  });

  test('an outdated privacy version must be re-accepted', () => {
    expect(needsReaccept({ termsVersion: TERMS_VERSION, privacyVersion: '2026-06-19' })).toBe(true);
  });

  test('current versions need no prompt', () => {
    expect(needsReaccept({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION })).toBe(false);
  });
});
