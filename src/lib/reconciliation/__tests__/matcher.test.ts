import { describe, it, expect } from 'vitest';
import { matchPaymentAdvicesToClaims, normalizeClaimNumber, normalizeVehicleNumber } from '../matcher';
import type { PaymentAdviceClaimItem } from '@/types/payment-reconciliation';

describe('Payment Matcher', () => {
  it('normalizes claim numbers by stripping special characters and spaces', () => {
    expect(normalizeClaimNumber('310100/31/24/01/00001234')).toBe('31010031240100001234');
    expect(normalizeClaimNumber('CL-2024-9988')).toBe('CL20249988');
    expect(normalizeClaimNumber(' 3101 / 24 ')).toBe('310124');
    expect(normalizeClaimNumber('')).toBe('');
    expect(normalizeClaimNumber(null)).toBe('');
    expect(normalizeClaimNumber(undefined)).toBe('');
  });

  it('normalizes vehicle numbers to uppercase alphanumeric', () => {
    expect(normalizeVehicleNumber('mh-12-ab-1234')).toBe('MH12AB1234');
    expect(normalizeVehicleNumber('DL 1C AA 9999')).toBe('DL1CAA9999');
    expect(normalizeVehicleNumber('  GJ-01-XY-0001  ')).toBe('GJ01XY0001');
    expect(normalizeVehicleNumber('')).toBe('');
    expect(normalizeVehicleNumber(null)).toBe('');
    expect(normalizeVehicleNumber(undefined)).toBe('');
  });

  it('matches by exact normalized claim number', () => {
    const claims = [
      { id: 'c1', claimNo: '310100/31/24/01/00001234', vehicleNo: 'MH-12-AB-1234', feeTotal: 2000, reportNo: 'R-01' },
      { id: 'c2', claimNo: '310100/31/24/01/00005678', vehicleNo: 'MH-14-CD-5678', feeTotal: 2500, reportNo: 'R-02' },
    ];
    const item: PaymentAdviceClaimItem = {
      claimNumber: '31010031240100001234',
      vehicleNumber: '',
      grossFee: 2000,
      netPaid: 1800,
      tdsAmount: 200,
    };

    const matches = matchPaymentAdvicesToClaims([item], claims as any, 'CMS123', '2026-11-15', 'The New India Assurance');
    expect(matches.length).toBe(1);
    expect(matches[0].status).toBe('matched');
    expect(matches[0].matchedClaimId).toBe('c1');
    expect(matches[0].confidence).toBe('exact_claim_no');
    expect(matches[0].utrNumber).toBe('CMS123');
    expect(matches[0].insurerName).toBe('The New India Assurance');
    expect(matches[0].billedTotal).toBe(2000);
    expect(matches[0].reportNo).toBe('R-01');
  });

  it('matches by exact vehicle number when claim number does not match or is absent', () => {
    const claims = [
      { id: 'c1', claimNo: '310100/31/24/01/00001234', vehicleNo: 'MH-12-AB-1234', feeTotal: 2000, reportNo: 'R-01' },
    ];
    const item: PaymentAdviceClaimItem = {
      claimNumber: '',
      vehicleNumber: 'MH 12 AB 1234',
      grossFee: 2000,
      netPaid: 1800,
      tdsAmount: 200,
    };

    const matches = matchPaymentAdvicesToClaims([item], claims as any, 'CMS123', '2026-11-15', 'United India');
    expect(matches.length).toBe(1);
    expect(matches[0].status).toBe('matched');
    expect(matches[0].matchedClaimId).toBe('c1');
    expect(matches[0].confidence).toBe('exact_vehicle_no');
  });

  it('matches by vehicle number when claim number is non-matching', () => {
    const claims = [
      { id: 'c1', claimNo: '310100/31/24/01/00001234', vehicleNo: 'MH-12-AB-1234', feeTotal: 2000, reportNo: 'R-01' },
    ];
    const item: PaymentAdviceClaimItem = {
      claimNumber: 'NON_MATCHING_CLAIM',
      vehicleNumber: 'MH12-AB-1234',
      grossFee: 2000,
      netPaid: 1800,
      tdsAmount: 200,
    };

    const matches = matchPaymentAdvicesToClaims([item], claims as any, 'CMS123', '2026-11-15', 'United India');
    expect(matches.length).toBe(1);
    expect(matches[0].status).toBe('matched');
    expect(matches[0].matchedClaimId).toBe('c1');
    expect(matches[0].confidence).toBe('exact_vehicle_no');
  });

  it('NEVER matches by amount alone — leaves transaction as unmatched', () => {
    const claims = [
      { id: 'c1', claimNo: '310100/31/24/01/00001234', vehicleNo: 'MH-12-AB-1234', feeTotal: 1500, reportNo: 'R-01' },
      { id: 'c2', claimNo: '310100/31/24/01/00005678', vehicleNo: 'MH-14-CD-5678', feeTotal: 1500, reportNo: 'R-02' },
    ];
    // Payment advice has matching amount (1500) but unknown/unrecognized claim and vehicle
    const item: PaymentAdviceClaimItem = {
      claimNumber: 'UNKNOWN/9999',
      vehicleNumber: 'KA-01-XX-0000',
      grossFee: 1500,
      netPaid: 1350,
      tdsAmount: 150,
    };

    const matches = matchPaymentAdvicesToClaims([item], claims as any, 'CMS123', '2026-11-15', 'New India');
    expect(matches.length).toBe(1);
    expect(matches[0].status).toBe('unmatched');
    expect(matches[0].matchedClaimId).toBeUndefined();
    expect(matches[0].confidence).toBeUndefined();
    expect(matches[0].billedTotal).toBe(0);
  });

  it('handles empty items array gracefully', () => {
    const matches = matchPaymentAdvicesToClaims([], [], 'CMS123', '2026-11-15', 'New India');
    expect(matches).toEqual([]);
  });
});
