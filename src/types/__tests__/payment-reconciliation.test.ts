import { describe, it, expect } from 'vitest';
import type { PaymentAdvice, PaymentAdviceClaimItem, PaymentMatchResult } from '@/types/payment-reconciliation';
import type { FeeBill } from '@/types/assessment';

describe('Payment Reconciliation Types & Model', () => {
  it('supports expanded payment tracking fields on FeeBill', () => {
    const feeBill: FeeBill = {
      billDate: '2026-11-19',
      professionalFee: 1500,
      riFee: 0,
      travelExpenses: 300,
      travelNote: '',
      distanceKm: 30,
      ratePerKm: 10,
      tollCharges: 0,
      tollNote: '',
      photosCount: 12,
      photoRate: 15,
      postalCharges: 0,
      haltageCharges: 0,
      includeGST: false,
      advanceReceipt: '',
      cashReceived: '',
      salvageValue: 0,
      lessExcess: 0,
      compulsoryExcess: 0,
      voluntaryExcess: 0,
      towingCharges: 0,
      feePaid: true,
      // Enhanced fields
      paymentStatus: 'paid',
      amountReceived: 1800,
      tdsDeducted: 180,
      paymentDate: '2026-11-18',
      utrNumber: 'CMS93821019',
      paymentAdviceSource: 'New India Payment Advice',
    };

    expect(feeBill.paymentStatus).toBe('paid');
    expect(feeBill.amountReceived).toBe(1800);
    expect(feeBill.tdsDeducted).toBe(180);
    expect(feeBill.utrNumber).toBe('CMS93821019');
  });

  it('validates PaymentAdvice structure with multiple claims', () => {
    const advice: PaymentAdvice = {
      id: 'adv-123',
      insurerName: 'The New India Assurance Co. Ltd.',
      paymentDate: '2026-11-15',
      utrNumber: 'CMS93821019',
      totalAmount: 4500,
      totalTds: 500,
      netPaid: 4000,
      claims: [
        {
          claimNumber: '31010031240100001234',
          vehicleNumber: 'MH-12-AB-1234',
          grossFee: 2000,
          conveyance: 500,
          tdsAmount: 250,
          netPaid: 2250,
        },
      ],
      rawSource: 'PaymentAdvice_310100.pdf',
    };

    expect(advice.claims.length).toBe(1);
    expect(advice.claims[0].claimNumber).toBe('31010031240100001234');
  });
});
