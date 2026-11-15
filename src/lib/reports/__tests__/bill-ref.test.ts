import { describe, it, expect } from 'vitest';
import { printableRef, settleLegacyRefs } from '../bill-ref';
import type { AssessmentRow, ExtraBillItem } from '@/types/assessment';

describe('printableRef', () => {
  it('prints a clean ref', () => expect(printableRef({ refSrNo: 68, refStatus: 'clean' })).toBe(68));
  it('prints a manual ref', () => expect(printableRef({ refSrNo: '61, 65', refStatus: 'manual' })).toBe('61, 65'));
  it('legacy ref without status prints', () => expect(printableRef({ refSrNo: 12 })).toBe(12));
  it('hides a doubtful ref', () => expect(printableRef({ refSrNo: 146, refStatus: 'ambiguous' })).toBeUndefined());
});

describe('settleLegacyRefs', () => {
  const base = { id: 'r', particulars: 'X', estimated: 0, assessed: 0, partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50 } as AssessmentRow;
  const line = (partNumber: string): ExtraBillItem => ({ id: 'b', description: 'X', amount: 1, taxableAmount: 1, gstPercent: 18, section: 'parts', source: 'final-bill', partNumber });
  it('demotes a clean ref that links different part numbers', () => {
    const r: AssessmentRow = { ...base, partNumber: 'N910105006013', refSrNo: 146, refStatus: 'clean', refMatch: { bill: line('N910105008026'), score: 86, reasons: [] } };
    expect(settleLegacyRefs([r])).toEqual([{ id: 'r', updates: { refStatus: 'ambiguous' } }]);
  });
  it('marks a status-less ref as manual', () => {
    expect(settleLegacyRefs([{ ...base, refSrNo: 12 }])).toEqual([{ id: 'r', updates: { refStatus: 'manual' } }]);
  });
  it('leaves a clean same-part ref alone', () => {
    const r: AssessmentRow = { ...base, partNumber: 'A1', refSrNo: 5, refStatus: 'clean', refMatch: { bill: line('a-1'), score: 100, reasons: [] } };
    expect(settleLegacyRefs([r])).toEqual([]);
  });
});
