import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildFingerprint,
  matchScore,
  shouldSkip,
  extractLabel,
  nearbyHeading,
} from '../src/lib/observer.js';

describe('shouldSkip', () => {
  it('skips non-input tags (div, span, button)', () => {
    const div = { tagName: 'DIV', closest: () => null };
    const btn = { tagName: 'BUTTON', type: 'button', closest: () => null };
    expect(shouldSkip(div)).toBe(true);
    expect(shouldSkip(btn)).toBe(true);
  });

  it('skips password and hidden input types', () => {
    const pwd = { tagName: 'INPUT', type: 'password', closest: () => null };
    const hid = { tagName: 'INPUT', type: 'hidden', closest: () => null };
    expect(shouldSkip(pwd)).toBe(true);
    expect(shouldSkip(hid)).toBe(true);
  });

  it('skips disabled or readonly fields', () => {
    const dis = { tagName: 'INPUT', type: 'text', disabled: true, closest: () => null };
    const ro = { tagName: 'INPUT', type: 'text', readOnly: true, closest: () => null };
    expect(shouldSkip(dis)).toBe(true);
    expect(shouldSkip(ro)).toBe(true);
  });

  it('skips elements inside login, captcha, or OTP forms', () => {
    const loginInput = {
      tagName: 'INPUT',
      type: 'text',
      closest: (sel) => (sel.includes('login') ? {} : null),
    };
    expect(shouldSkip(loginInput)).toBe(true);

    const captchaInput = {
      tagName: 'INPUT',
      type: 'text',
      closest: (sel) => (sel.includes('captcha') ? {} : null),
    };
    expect(shouldSkip(captchaInput)).toBe(true);
  });

  it('skips elements inside #sx-panel', () => {
    const panelInput = {
      tagName: 'INPUT',
      type: 'text',
      closest: (sel) => (sel.includes('#sx-panel') ? {} : null),
    };
    expect(shouldSkip(panelInput)).toBe(true);
  });

  it('accepts valid unmapped text inputs', () => {
    const textInput = {
      tagName: 'INPUT',
      type: 'text',
      readOnly: false,
      disabled: false,
      closest: () => null,
    };
    expect(shouldSkip(textInput)).toBe(false);
  });
});

describe('buildFingerprint and matchScore', () => {
  it('builds fingerprint with label, name, type, and maxLength', () => {
    const mockEl = {
      tagName: 'INPUT',
      type: 'text',
      id: 'driverLicenseNoOne',
      maxLength: 4,
      getAttribute: (attr) => {
        if (attr === 'name') return 'dlPrefix';
        if (attr === 'placeholder') return 'e.g. MH12';
        if (attr === 'aria-label') return 'DL Prefix';
        return null;
      },
      parentElement: {
        querySelectorAll: () => [mockEl],
        parentElement: null,
      },
      closest: () => null,
    };

    const fp = buildFingerprint(mockEl);
    expect(fp.name).toBe('dlPrefix');
    expect(fp.inputType).toBe('text');
    expect(fp.maxLength).toBe(4);
    expect(fp.idHint).toBe('#driverLicenseNoOne');
    expect(fp.placeholder).toBe('e.g. MH12');
  });

  it('scores 100% for an exact fingerprint match', () => {
    const mockEl = {
      tagName: 'INPUT',
      type: 'text',
      id: 'driverLicenseNoOne',
      maxLength: 4,
      getAttribute: (attr) => {
        if (attr === 'name') return 'dlPrefix';
        if (attr === 'placeholder') return 'e.g. MH12';
        if (attr === 'aria-label') return 'DL Prefix';
        return null;
      },
      parentElement: {
        querySelectorAll: () => [mockEl],
        parentElement: null,
      },
      closest: () => null,
    };

    const fp = buildFingerprint(mockEl);
    const score = matchScore(mockEl, fp);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('scores low for completely different elements', () => {
    const mockEl = {
      tagName: 'INPUT',
      type: 'text',
      id: 'chassisNumber',
      maxLength: 30,
      getAttribute: (attr) => {
        if (attr === 'name') return 'chassis';
        return null;
      },
      parentElement: null,
      closest: () => null,
    };

    const targetFp = {
      label: 'Survey Place',
      name: 'placeOfSurvey',
      inputType: 'text',
      maxLength: 50,
      nearbyText: 'Inspection Details',
      placeholder: 'City',
      ariaLabel: '',
      idHint: '#surveyPlace',
      siblingIndex: 1,
    };

    const score = matchScore(mockEl, targetFp);
    expect(score).toBeLessThan(40);
  });
});
