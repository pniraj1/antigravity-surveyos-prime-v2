import { describe, expect, test } from 'vitest';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '../uiic-final-builder';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { estimateTotalInclGst } from '../final-survey-preamble';
import { calculateAssessmentSummary } from '@/lib/calculations/assessment';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
    estimated: 10000,
    assessed: 10000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'nil',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 0 },
  } as unknown as ClaimData;
}

describe('per-item GST in the PDF builders', () => {
  test('Final Report prints a 28% row at 28%, not 18%', () => {
    // A tyre at 28% showed 12,800 on screen and printed 11,800 labelled 18.
    const html = buildUIICFinalHTML(claim([row({ particulars: 'TyreRadial', gst: 28 })]), null);
    expect(html).toContain('12800.00');
    expect(html).not.toContain('11800.00');
  });

  test('Final Report shows the row own rate in the GST% column', () => {
    const html = buildUIICFinalHTML(claim([row({ particulars: 'TyreRadial', gst: 28 })]), null);
    const cell = html.split('TyreRadial')[1].split('</tr>')[0];
    expect(cell).toContain('>28<');
  });

  test('Final Report is unchanged for an all-18% claim', () => {
    const html = buildUIICFinalHTML(claim([row({ gst: 18 })]), null);
    expect(html).toContain('11800.00');
  });

  test('Bill Check prints a 28% row at 28%', () => {
    const html = buildUIICBillCheckHTML(claim([row({ particulars: 'TyreRadial', gst: 28 })]), null);
    expect(html).toContain('12800.00');
  });

  test('labour honours its own rate', () => {
    const html = buildUIICFinalHTML(
      claim([row({ particulars: 'FitCharge', section: 'labour', partType: 'labour', assessed: 1000, estimated: 1000, gst: 5 })]),
      null
    );
    expect(html).toContain('1050.00');
  });
});

describe('standard report ASSESSMENT SUMMARY', () => {
  test('a 28% part is totalled at 28%, not 18%', () => {
    // pb * 0.09 hardcoded 18% in the block behind section 8, ignoring the
    // correctly-computed summary the builder is already handed.
    const html = buildStandardFinalSurveyHTML(claim([row({ assessed: 10000, estimated: 10000, gst: 28 })]), {} as never);
    // This builder's fa() adds thousands separators, unlike the UIIC one.
    expect(html).toContain('12,800.00');
    expect(html).not.toContain('11,800.00');
  });

  test('labour at a non-standard rate is totalled at that rate', () => {
    const html = buildStandardFinalSurveyHTML(claim([row({ section: 'labour', partType: 'labour', assessed: 1000, estimated: 1000, gst: 5 })]), {} as never);
    expect(html).toContain('1,050.00');
  });
});

describe('a surveyor-set 0% GST is honoured, not replaced by 18%', () => {
  // `r.gst || 18` treats a deliberate 0 as "missing" and charges 18% anyway.
  const zeroLabour = row({ particulars: 'FitCharge', section: 'labour', partType: 'labour', assessed: 1000, estimated: 1000, gst: 0 });

  test('standard report prices a 0% labour row at 1,000.00', () => {
    const html = buildStandardFinalSurveyHTML(claim([zeroLabour]), {} as never);
    expect(html).toContain('1,000.00');
    expect(html).not.toContain('1,180.00');
  });

  test('standard report prints 0% in the GST% column', () => {
    const html = buildStandardFinalSurveyHTML(claim([zeroLabour]), {} as never);
    const cell = html.split('FitCharge')[1].split('</tr>')[0];
    expect(cell).toContain('>0%<');
    expect(cell).not.toContain('>18%<');
  });

  test('assessment summary estimate carries no GST on a 0% row', () => {
    const s = calculateAssessmentSummary([zeroLabour], 0, 'nil');
    expect(s.totalEstimated).toBeCloseTo(1000, 2);
  });

  test('preamble estimate total carries no GST on a 0% row', () => {
    expect(estimateTotalInclGst([zeroLabour])).toBeCloseTo(1000, 2);
  });
});
