import { describe, it, expect, beforeEach } from 'vitest';
import { useClaimStore } from '@/stores/claim-store';
import { rowsToMarkNotInBill } from '../useBillCheckPrintGate';

describe('useBillCheckPrintGate logic', () => {
  beforeEach(() => {
    useClaimStore.getState().newClaim('final', 'private');
  });

  it('detects unverified invoice when billNo or billDate is empty', () => {
    const claim = useClaimStore.getState().currentClaim;
    expect(claim).toBeDefined();

    const bc = claim?.billCheck || { billNo: '', billDate: '', billTotal: 0 };
    const isInvoiceVerified =
      Boolean(bc.billNo?.trim()) &&
      Boolean(bc.billDate?.trim()) &&
      Boolean(bc.billTotal && bc.billTotal > 0) &&
      bc.verifiedBySurveyor === true;

    expect(isInvoiceVerified).toBe(false);
  });

  it('detects verified invoice when all fields are present and verifiedBySurveyor is true', () => {
    useClaimStore.getState().updateClaim({
      billCheck: {
        billNo: 'INV-2024-99',
        billDate: '2026-11-06',
        billTotal: 45000,
        verifiedBySurveyor: true,
        verifiedAt: new Date().toISOString(),
      },
    });

    const claim = useClaimStore.getState().currentClaim;
    const bc = claim?.billCheck;
    const isInvoiceVerified =
      Boolean(bc?.billNo?.trim()) &&
      Boolean(bc?.billDate?.trim()) &&
      Boolean(bc?.billTotal && bc.billTotal > 0) &&
      bc?.verifiedBySurveyor === true;

    expect(isInvoiceVerified).toBe(true);
  });
});

describe('rowsToMarkNotInBill', () => {
  it('skips a pending row that carries a sure ref (it shares a billed line)', () => {
    const base = { particulars: 'X', estimated: 1, assessed: 1, partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50 } as const;
    const rows = [
      { ...base, id: 'shared', billStatus: 'pending', refSrNo: 260, refStatus: 'clean' },
      { ...base, id: 'none', billStatus: 'pending' },
    ];
    expect(rowsToMarkNotInBill(rows as never).map(r => r.id)).toEqual(['none']);
  });

  it('skips a pending row with a typed (manual) ref but marks one with no ref (F2)', () => {
    const base = { particulars: 'X', estimated: 1, assessed: 1, partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50 } as const;
    const rows = [
      { ...base, id: 'typed', billStatus: 'pending', refSrNo: '12', refStatus: 'manual' },
      { ...base, id: 'none' },
    ];
    expect(rowsToMarkNotInBill(rows as never).map(r => r.id)).toEqual(['none']);
  });

  it('marks nothing in a claim built from the bill', () => {
    const base = { particulars: 'X', estimated: 1, assessed: 1, partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false, disposalPercent: 50 } as const;
    const rows = [{ ...base, id: 'p', billStatus: 'pending' }];
    expect(rowsToMarkNotInBill(rows as never, true)).toEqual([]);
  });
});
