import { describe, it, expect } from 'vitest';
import { billCheckHoldReasons, CASH_LOSS_NO_BILL_CHECK } from '@/hooks/useBillCheckPrintGate';
import type { ClaimData } from '@/types/claim';

const claim = (o: Record<string, unknown>) => o as unknown as ClaimData;

describe('billCheckHoldReasons', () => {
  it('cash loss on gives the cash-loss message', () => {
    expect(billCheckHoldReasons(claim({ cashLoss: { enabled: true, notionalPercent: null }, assessmentRows: [] })))
      .toContain('This claim is settled on cash loss basis — no bill check');
    expect(CASH_LOSS_NO_BILL_CHECK).toContain('no bill check');
  });
  it('a K.O. row gives the K.O. message', () => {
    const r = billCheckHoldReasons(claim({ assessmentRows: [{ id: 'a', particulars: 'Headlamp', keptOpen: true }] }));
    expect(r).toHaveLength(1);
    expect(r[0]).toContain('Headlamp');
  });
  it('neither gives none', () => {
    expect(billCheckHoldReasons(claim({ assessmentRows: [{ id: 'a', particulars: 'Bumper', allowed: true }] }))).toEqual([]);
  });
});
