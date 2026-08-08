import { describe, expect, test } from 'vitest';
import { buildStandardFinalSurveyHTML } from '../standard-report-builder';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '../uiic-final-builder';
import { getDepreciationRate } from '@/lib/calculations/depreciation';
import type { ClaimData } from '@/types';
import type { AssessmentRow, PartType } from '@/types/assessment';

/**
 * IRDAI motor tariff, parts depreciation (private car package policy wording,
 * IRDAN134RP0003V01201819):
 *
 *   rubber / nylon / plastic, tyres, tubes, batteries, air bags ... 50%
 *   fibre glass components ................................……..... 30%
 *   all parts made of glass ....................................... Nil
 *   all other parts including wooden parts ........ by age of vehicle:
 *       ≤6m Nil | ≤1y 5% | ≤2y 10% | ≤3y 15% | ≤4y 25% | ≤5y 35% |
 *       ≤10y 40% | >10y 50%
 *
 * The engine encodes this. Each report builder used to keep a private copy of
 * the rate table, and every copy had dropped the fibre glass line — so a fibre
 * glass part was depreciated on the metal age scale instead, and the summary
 * block (engine) contradicted the detail table (copy) on the same page.
 */

function row(o: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`, particulars: 'Item', estimated: 10000, assessed: 10000,
    partType: 'metal', gst: 18, section: 'parts', allowed: true, isDisposal: false,
    disposalPercent: 50, ...o,
  } as AssessmentRow;
}

/** Registration 2023-04-11, accident 2026-06-14 → 38 months (>3y ≤4y → 25% metal). */
function claim(rows: AssessmentRow[], depreciationType: 'standard' | 'nil' = 'standard'): ClaimData {
  return {
    id: 'c1', reportNo: 'R1', reportDate: '2026-08-07',
    assessmentRows: rows, depreciationType,
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

/**
 * Assert on the money rather than the "NN%" label: the label pattern also
 * matches the GST column, and the builders format amounts differently
 * (1,234.00 vs 1234.00). Stripping commas makes one assertion work for all.
 */
function money(html: string): string {
  return html.replace(/,/g, '');
}

describe('report builders depreciate exactly as the tariff does', () => {
  test.each([
    ['fiberglass', 30],
    ['plastic', 50],
    ['glass', 0],
    ['metal', 25],
    ['labour', 0],
    ['paint', 0],
  ] as [PartType, number][])('engine rate for %s at 38 months is %i%%', (partType, expected) => {
    expect(getDepreciationRate(partType, 38, 'standard')).toBe(expected);
  });

  // The regression. A fibre glass part is 30% flat; the metal age scale would
  // put this 38-month vehicle at 25%, which is what every builder printed.
  test.each(BUILDERS)('%s depreciates a fibre glass part at 30%%', (_name, build) => {
    const html = money(build(claim([
      row({ partType: 'fiberglass', particulars: 'FENDER LINER', estimated: 10000, assessed: 10000 }),
    ])));

    expect(html).toContain('7000.00');      // 10000 × (1 − 0.30), the tariff
    expect(html).not.toContain('7500.00');  // 10000 × (1 − 0.25), the metal scale
  });

  test.each(BUILDERS)('%s applies nil depreciation to fibre glass', (_name, build) => {
    const html = money(build(claim([
      row({ partType: 'fiberglass', estimated: 10000, assessed: 10000 }),
    ], 'nil')));

    expect(html).toContain('10000.00');
    expect(html).not.toContain('7000.00');
  });

  test('labour and painting never take the age scale', () => {
    // The React-PDF copy of the rate table omitted the labour/paint guard
    // entirely, so a labour line was depreciated like a metal panel.
    for (const pt of ['labour', 'paint'] as PartType[]) {
      for (const age of [0, 7, 13, 25, 37, 49, 61, 121]) {
        expect(getDepreciationRate(pt, age, 'standard')).toBe(0);
      }
    }
  });
});
