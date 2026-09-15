import { describe, it, expect } from 'vitest';
import { jobForDocType, JOB_TIMEOUT_MS, JOB_NEEDS_VISION } from '../jobs';

describe('jobForDocType', () => {
  it('estimates, bills and bank statements are heavy', () => {
    for (const k of ['estimate', 'final-bill', 'bank-statement']) expect(jobForDocType(k)).toBe('heavy');
  });
  it('identity and policy documents are light', () => {
    for (const k of ['rc', 'dl', 'policy', 'claim', 'permit', 'auth', 'fitness', 'lok-challan', 'fir', 'photos']) expect(jobForDocType(k)).toBe('light');
  });
  it('unknown doc types default to light (vision, fast)', () => {
    expect(jobForDocType('something-new')).toBe('light');
  });
});

describe('job constants', () => {
  it('heavy waits 120s, others 30s', () => {
    expect(JOB_TIMEOUT_MS).toEqual({ heavy: 120_000, light: 30_000, text: 30_000 });
  });
  it('only text does not need vision', () => {
    expect(JOB_NEEDS_VISION).toEqual({ heavy: true, light: true, text: false });
  });
});
