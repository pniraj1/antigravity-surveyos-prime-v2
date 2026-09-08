import { describe, it, expect } from 'vitest';
import { buildUIICFinalHTML } from '../uiic-final-builder';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow> = {}): AssessmentRow => ({
  id: Math.random().toString(36).slice(2),
  particulars: 'PAINT PANEL',
  estimated: 0, assessed: 0, partType: 'paint', gst: 0,
  section: 'paint', allowed: true, isDisposal: false, disposalPercent: 50,
  ...o,
});

const claim = {
  id: 'c1',
  depreciationType: 'standard',
  applyPaintMaterialDep: true,
  vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2025-01-01', yearOfManufacture: 2024 },
  policy: {},
  accident: { dateAndTime: '2026-08-05T10:00' },
  driver: {}, spotDetails: {}, reinspection: {},
  feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
  billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 0 },
  assessmentRows: [
    row({ particulars: 'PANEL A', assessed: 10000 }),
    row({ particulars: 'PANEL B', assessed: 5000, depOverride: 0 }),
  ],
} as unknown as ClaimData;

describe('UIIC LESS PAINT DEP — respects depOverride', () => {
  it('bases the 12.5% only on rows that actually took the auto rate', () => {
    const html = buildUIICFinalHTML(claim, null);
    const amount = html.match(/LESS PAINT DEP: 12\.5%<\/td><td[^>]*>([\d,.]+)</)?.[1];
    // Only PANEL A (10,000) took the 12.5%; PANEL B was overridden to 0.
    expect(amount).toBe('1,250.00');
  });
});
