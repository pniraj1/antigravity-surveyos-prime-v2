import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '../uiic-final-builder';
import { calculateAssessmentSummary } from '@/lib/calculations';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

/**
 * Labour and Paint carry no automatic depreciation, but a surveyor may set a
 * manual `depOverride`. Every builder used to compute those rows straight from
 * `r.assessed`, so an override showed on screen and in the Dep% column while
 * the money beside it ignored it.
 */

function row(o: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`, particulars: 'Item', estimated: 12000, assessed: 10000,
    partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false,
    disposalPercent: 50, ...o,
  } as AssessmentRow;
}

/** Registration 2023-04-11, accident 2026-06-14 → 38 months (metal 25%). */
function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1', reportNo: 'R1', reportDate: '2026-08-10',
    assessmentRows: rows, depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2023-04-11', yearOfManufacture: 2023 },
    policy: { idv: '650000' },
    accident: { dateAndTime: '2026-06-14T18:30' },
    driver: {}, spotDetails: {}, reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: {},
  } as unknown as ClaimData;
}

const BUILDERS: [string, (c: ClaimData) => string][] = [
  ['standard final survey', c => buildStandardFinalSurveyHTML(c, {} as never)],
  ['UIIC final', c => buildUIICFinalHTML(c, null)],
  ['UIIC bill check', c => buildUIICBillCheckHTML(c, null)],
];

/** Amounts are formatted with thousands separators in some builders, not others. */
function money(html: string): string {
  return html.replace(/,/g, '');
}

/**
 * One labour/paint row, assessed 10000, override 30%, GST 18%:
 *
 *   base after depreciation  7000.00
 *   with GST                 8260.00
 *   WRONG (dep ignored)     10000.00 base, 11800.00 with GST
 *
 * The discriminating assertion is the NEGATIVE one. Every builder already
 * derives some figures from the depreciation-aware `aggregateGst`, so 7000.00
 * and 8260.00 appear in the summary blocks whether or not the per-row cells
 * are fixed — asserting only their presence passes for the wrong reason. What
 * changes is that the undepreciated figure stops being printed as an amount.
 *
 * The builders differ in which column carries the money, so the wrong number
 * differs too: the standard and UIIC final reports print the row with GST
 * added; UIIC bill check prints the bare depreciated base.
 */
describe('Labour and Paint honour a manual depreciation override', () => {
  const labour = () => claim([row({ section: 'labour', partType: 'labour', depOverride: 30 })]);
  const paint = () => claim([row({ section: 'paint', partType: 'paint', depOverride: 30 })]);

  test('standard final survey depreciates a labour row', () => {
    const html = money(buildStandardFinalSurveyHTML(labour(), {} as never));
    expect(html).not.toContain('11800.00');
    expect(html).toContain('8260.00');
  });

  test('standard final survey depreciates a paint row', () => {
    const html = money(buildStandardFinalSurveyHTML(paint(), {} as never));
    expect(html).not.toContain('11800.00');
    expect(html).toContain('8260.00');
  });

  test('UIIC final depreciates a labour row', () => {
    const html = money(buildUIICFinalHTML(labour(), null));
    expect(html).not.toContain('11800.00');
    expect(html).toContain('8260.00');
  });

  test('UIIC final depreciates a paint row', () => {
    const html = money(buildUIICFinalHTML(paint(), null));
    expect(html).not.toContain('11800.00');
    expect(html).toContain('8260.00');
  });

  // Bill check prints the bare base in its amount column, and leaves the
  // Assessed column blank for service rows — so the raw 10000.00 appearing at
  // all means the amount column ignored the override.
  test('UIIC bill check depreciates a labour row', () => {
    const html = money(buildUIICBillCheckHTML(labour(), null));
    expect(html).not.toContain('10000.00');
    expect(html).toContain('7000.00');
  });

  test('UIIC bill check depreciates a paint row', () => {
    const html = money(buildUIICBillCheckHTML(paint(), null));
    expect(html).not.toContain('10000.00');
    expect(html).toContain('7000.00');
  });

  test('the engine agrees with the builders on the labour base', () => {
    const rows = [row({ section: 'labour', partType: 'labour', depOverride: 30 })];
    const summary = calculateAssessmentSummary(rows, 38, 'standard', 0, 0, 0);
    // The engine already applied the override before this change; the builders
    // are what had to catch up.
    expect(summary.labourBase).toBeCloseTo(7000, 2);
  });
});

describe('regression floor: no override changes nothing', () => {
  const rows = [
    row({ particulars: 'Bumper', partType: 'plastic' }),
    row({ particulars: 'Fitting', section: 'labour', partType: 'labour', assessed: 4000 }),
    row({ particulars: 'Painting', section: 'paint', partType: 'paint', assessed: 6000 }),
  ];

  test.each(BUILDERS)('%s still prints the undepreciated labour and paint amounts', (_name, build) => {
    const html = money(build(claim(rows)));
    // Auto rate for labour and paint is 0, so the base is the assessed figure.
    expect(html).toContain('4000.00');
    expect(html).toContain('6000.00');
  });
});
