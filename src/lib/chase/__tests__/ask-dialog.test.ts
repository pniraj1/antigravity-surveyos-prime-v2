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
    for (const k of ['surveyReport', 'feeBill', 'niaAssessmentExcel', 'insuredSummary', 'billCheckReport']) expect(keys).not.toContain(k);
    expect(preTicked(claim(), 'insured')).toEqual([]);
  });
});

describe('stale Scan slots', () => {
  const doc = (type: string, addedAt: string) => ({ id: type + addedAt, type, addedAt, relPath: 'x', mime: '', size: 1, source: 'upload', devices: [] });
  const c = (docs: ReturnType<typeof doc>[]) => claim({
    documents: Object.fromEntries(docs.map((d) => [d.id, d])),
    scanChase: { importedAt: '2026-11-01T10:00:00.000Z', slotStates: { dl: 'missing', rc: 'missing', estimate: { state: 'rejected', reason: 'Blurry' } } },
  });
  it('drops a missing slot Prime got a document for after the import; rejected stays', () => {
    const keys = dialogDocs(c([doc('dl', '2026-11-01T11:00:00.000Z'), doc('rc', '2026-11-01T09:00:00.000Z'), doc('estimate', '2026-11-01T11:00:00.000Z')])).map((d) => d.key);
    expect(keys).toEqual(['rc', 'estimate']);
  });
});

describe('slot key normalisation', () => {
  const c = claim({ scanChase: { importedAt: 'x', slotStates: { 'invoice:Extra': 'missing', 'estimate (2)': 'missing', 'other:Bank letter': 'missing' } } });
  it('labels and keeps original keys', () => {
    expect(dialogDocs(c)).toEqual([
      { key: 'invoice:Extra', label: 'Invoice – Extra', reason: null },
      { key: 'estimate (2)', label: 'Estimate', reason: null },
      { key: 'other:Bank letter', label: 'Bank letter', reason: null },
    ]);
  });
  it('recipients by base type', () => {
    expect(preTicked(c, 'garage')).toEqual(['invoice:Extra', 'estimate (2)']);
    expect(preTicked(c, 'insured')).toEqual(['other:Bank letter']);
  });
});

describe('recipients / istNow', () => {
  it('Prime wins, Scan fills', () => {
    const c = claim({ policy: { insuredName: 'Ram', insuredMobile: '' }, scanChase: { importedAt: 'x', contacts: { insured: { name: 'Other', phone: '9822012345', email: 'a@b.in' } } } });
    expect(recipients(c)[0]).toEqual({ role: 'insured', name: 'Ram', phone: '9822012345', email: 'a@b.in' });
  });
  it('Scan number used when the Prime number is not WhatsApp-able', () => {
    const c = claim({ policy: { insuredMobile: '020 2553 1234' }, scanChase: { importedAt: 'x', contacts: { insured: { phone: '9822012345' } } } });
    expect(recipients(c)[0].phone).toBe('9822012345');
    const both = claim({ policy: { insuredMobile: '020 2553 1234' }, scanChase: { importedAt: 'x', contacts: { insured: { phone: '12' } } } });
    expect(recipients(both)[0].phone).toBe('020 2553 1234');
  });
  it('IST offset', () => expect(istNow(Date.UTC(2026, 10, 1, 0, 0, 0))).toBe('2026-11-01T05:30:00+05:30'));
});
