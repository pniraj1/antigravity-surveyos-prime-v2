import { describe, expect, test } from 'vitest';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '../uiic-final-builder';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { calculateAssessmentSummary } from '@/lib/calculations';
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
    const rows = [row({ assessed: 10000, estimated: 10000, gst: 28 })];
    const c = claim(rows);
    const summary = calculateAssessmentSummary(rows, 0, 'nil', 0, 0, 0);
    const html = buildStandardFinalSurveyHTML(c, summary, {} as never);
    // This builder's fa() adds thousands separators, unlike the UIIC one.
    expect(html).toContain('12,800.00');
    expect(html).not.toContain('11,800.00');
  });

  test('labour at a non-standard rate is totalled at that rate', () => {
    const rows = [row({ section: 'labour', partType: 'labour', assessed: 1000, estimated: 1000, gst: 5 })];
    const c = claim(rows);
    const summary = calculateAssessmentSummary(rows, 0, 'nil', 0, 0, 0);
    const html = buildStandardFinalSurveyHTML(c, summary, {} as never);
    expect(html).toContain('1,050.00');
  });
});
