import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
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

/**
 * Registration date puts this vehicle at ~19 months (metal depreciation 10%).
 * Year of manufacture alone puts it at ~31 months (15%). Reproduces the real
 * claim where the summary box and the rows beneath it disagreed by exactly the
 * difference between those two brackets.
 */
function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2025-01-01', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 0 },
  } as unknown as ClaimData;
}

/**
 * Rows of the "8. ASSESSMENT SUMMARY" block, keyed by their label, each holding
 * [Estimated, Assessed after Dep., Incl. GST].
 *
 * Keyed rather than positional: an earlier version indexed into a flat list of
 * figures and broke the moment the material rows gained a third column.
 */
function summaryRows(html: string): Record<string, number[]> {
  const start = html.indexOf('8. ASSESSMENT SUMMARY');
  const end = html.indexOf('9. DETAILS OF ASSESSMENT', start);
  const block = html.slice(start, end > start ? end : start + 6000);

  const out: Record<string, number[]> = {};
  for (const tr of block.split('<tr')) {
    const label = tr
      .replace(/^[^>]*>/, '')          // discard the remainder of the opening <tr ...>
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .split(/₹/)[0]
      .replace(/↳/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!label) continue;
    const nums = [...tr.matchAll(/₹\s([\d,]+\.\d{2})/g)].map(m => Number(m[1].replace(/,/g, '')));
    if (nums.length) out[label] = nums;
  }
  return out;
}

describe('standard report assessment summary', () => {
  test('each material row carries a real Incl. GST figure summing to Spare Parts', () => {
    // Was a literal em-dash. Must be computed per row at that row's own rate,
    // never base × 1.18 — this claim deliberately mixes 18% and 28%.
    const html = buildStandardFinalSurveyHTML(
      claim([
        row({ partType: 'metal', assessed: 10000, estimated: 10000, gst: 18 }),
        row({ partType: 'plastic', assessed: 4000, estimated: 4000, gst: 28 }),
      ]),
      {} as never,
    );

    const r = summaryRows(html);
    expect(r['Metal']).toHaveLength(3);
    expect(r['Plastic / Rubber']).toHaveLength(3);
    expect(r['Metal'][2]).toBeCloseTo(r['Metal'][1] * 1.18, 2);
    expect(r['Plastic / Rubber'][2]).toBeCloseTo(r['Plastic / Rubber'][1] * 1.28, 2);
    expect(r['Metal'][2] + r['Plastic / Rubber'][2]).toBeCloseTo(r['Spare Parts'][2], 2);
  });

  test('Spare Parts equals the sum of its own material rows', () => {
    // The invariant that broke: the Spare Parts line came from a caller-supplied
    // summary while the material rows were computed inside the builder, so one
    // row contradicted the rows beneath it by the depreciation difference.
    const html = buildStandardFinalSurveyHTML(
      claim([
        row({ partType: 'metal', assessed: 10000, estimated: 10000 }),
        row({ partType: 'plastic', assessed: 4000, estimated: 4000 }),
        row({ partType: 'glass', assessed: 2000, estimated: 2000 }),
      ]),
      {} as never,
    );

    const r = summaryRows(html);
    expect(r['Metal'][1] + r['Plastic / Rubber'][1] + r['Glass'][1]).toBeCloseTo(r['Spare Parts'][1], 2);
  });

  test('depreciation follows the registration date, not the year of manufacture', () => {
    // 19 months by registration date → 10% on metal. Year-of-manufacture alone
    // would give 31 months → 15%, which is what the preview panel was feeding in.
    const html = buildStandardFinalSurveyHTML(
      claim([row({ partType: 'metal', assessed: 10000, estimated: 10000 })]),
      {} as never,
    );

    const r = summaryRows(html);
    expect(r['Spare Parts'][1]).toBeCloseTo(9000, 2);     // 10000 × 0.90
    expect(r['Spare Parts'][1]).not.toBeCloseTo(8500, 2); // not 10000 × 0.85
  });

  test('GRAND TOTAL assessed equals parts plus labour plus painting', () => {
    const html = buildStandardFinalSurveyHTML(
      claim([
        row({ partType: 'metal', assessed: 10000, estimated: 10000 }),
        row({ section: 'labour', partType: 'labour', assessed: 2000, estimated: 2000 }),
        row({ section: 'paint', partType: 'paint', assessed: 5000, estimated: 5000 }),
      ]),
      {} as never,
    );

    const r = summaryRows(html);
    expect(r['Spare Parts'][1] + r['Labour'][1] + r['Painting'][1]).toBeCloseTo(r['GRAND TOTAL'][1], 2);
  });
});
