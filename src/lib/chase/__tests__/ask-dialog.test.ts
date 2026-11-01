import { describe, it, expect } from 'vitest';
import type { ClaimData } from '@/types';
import { dialogDocs, preTicked, recipients, istNow } from '../ask-dialog';
import { waNumber } from '../ask-message';

const scan = { importedAt: 'x', slotStates: { rc: 'received', dl: 'missing', estimate: { state: 'rejected', reason: 'Blurry' } } } as const;
const claim = (extra: object = {}) => ({ policy: {}, accident: {}, ...extra }) as unknown as ClaimData;

describe('waNumber (vectors from Scan ContactsTest)', () => {
  it('forms', () => {
    expect(waNumber('+91 98220 12345')).toBe('919822012345');
    expect(waNumber('09822012345')).toBe('919822012345');
    expect(waNumber('98220-12345')).toBe('919822012345');
    expect(waNumber('020 2553 1234')).toBeNull();
    expect(waNumber('')).toBeNull();
  });
});

describe('dialogDocs / preTicked', () => {
  it('scan path: missing + rejected only, ticked by recipient', () => {
    const c = claim({ scanChase: scan });
    expect(dialogDocs(c)).toEqual([
      { key: 'dl', label: 'Driving Licence', reason: null },
      { key: 'estimate', label: 'Estimate', reason: 'Blurry' },
    ]);
    expect(preTicked(c, 'insured')).toEqual(['dl']);
    expect(preTicked(c, 'garage')).toEqual(['estimate']);
  });
  it('non-scan path: all non-photo types, nothing ticked', () => {
    const keys = dialogDocs(claim()).map((d) => d.key);
    expect(keys).toContain('rc');
    expect(keys).not.toContain('photoFront');
    expect(preTicked(claim(), 'insured')).toEqual([]);
  });
});

describe('recipients / istNow', () => {
  it('Prime wins, Scan fills', () => {
    const c = claim({ policy: { insuredName: 'Ram', insuredMobile: '' }, scanChase: { importedAt: 'x', contacts: { insured: { name: 'Other', phone: '9822012345', email: 'a@b.in' } } } });
    expect(recipients(c)[0]).toEqual({ role: 'insured', name: 'Ram', phone: '9822012345', email: 'a@b.in' });
  });
  it('IST offset', () => expect(istNow(Date.UTC(2026, 10, 1, 0, 0, 0))).toBe('2026-11-01T05:30:00+05:30'));
});
