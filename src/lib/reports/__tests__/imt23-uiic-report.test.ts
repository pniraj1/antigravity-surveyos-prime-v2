import { describe, it, expect } from 'vitest';
import { buildUIICFinalHTML } from '../uiic-final-builder';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow> = {}): AssessmentRow => ({
  id: Math.random().toString(36).slice(2),
  particulars: 'INDICATOR FR RH',
  estimated: 300,
  assessed: 300,
  partType: 'plastic',
  gst: 0,
  section: 'parts',
  allowed: true,
  isDisposal: false,
  disposalPercent: 50,
  ...o,
});

function claimWith(rows: AssessmentRow[], extra: Partial<ClaimData> = {}): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'nil',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2025-01-01', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 0 },
    ...extra,
  } as unknown as ClaimData;
}

const build = (c: ClaimData) => buildUIICFinalHTML(c, null);

describe('UIIC report — IMT-23', () => {
  it('prints a per-row Less Imt 23 line with the halved figure', () => {
    const html = build(claimWith([row({ imt23: true })]));
    expect(html).toContain('Less Imt 23');
    expect(html).toContain('150.00');
  });

  it('prints no per-row line for an untagged row', () => {
    const html = build(claimWith([row()]));
    expect(html).not.toContain('Less Imt 23');
  });

  it('prints the paint block with the effective rate, as this format does', () => {
    const html = build(claimWith(
      [row({ section: 'paint', partType: 'paint', assessed: 24000, imt23: true })],
      { depreciationType: 'standard', applyPaintMaterialDep: true } as Partial<ClaimData>,
    ));
    expect(html).toContain('LESS PAINT DEP: 12.5%');
    expect(html).toContain('12,000.00');
  });
});
