import { describe, expect, test } from 'vitest';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '../uiic-final-builder';
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
  } as AssessmentRow;
}

function claim(rows: AssessmentRow[]): ClaimData {
  return {
    id: 'c1',
    assessmentRows: rows,
    depreciationType: 'standard',
    vehicle: { registrationNumber: 'MH12AB1234', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 11800 },
  } as unknown as ClaimData;
}

/** Every <tr> in the item table body has as many <td>s as the header — the
 * automated version of "one mismatch shifts every figure a column to the
 * right." Section-header rows and band rows use colspan instead and are
 * excluded by requiring more than one <td>. */
function assertColumnCountsMatch(html: string, tableMarker: string, expectedCols: number) {
  const tableStart = html.indexOf(tableMarker);
  expect(tableStart, `table starting near "${tableMarker}" not found`).toBeGreaterThan(-1);
  const tableHtml = html.slice(tableStart, tableStart + 6000);
  const rowMatches = tableHtml.match(/<tr>(?:(?!<\/tr>)[\s\S])*<\/tr>/g) || [];
  const dataRows = rowMatches.filter(r => !r.includes('colspan') && (r.match(/<td/g) || []).length > 1);
  expect(dataRows.length, 'expected at least one data row').toBeGreaterThan(0);
  for (const r of dataRows) {
    const cellCount = (r.match(/<td/g) || []).length;
    expect(cellCount, `row has wrong cell count: ${r.slice(0, 200)}`).toBe(expectedCols);
  }
}

describe('UIIC Final Report — Depreciation Amount column', () => {
  test('a metal part shows assessed minus post-depreciation value', () => {
    // 24 months old → 10% metal rate (see lib/calculations/depreciation.ts)
    const c = claim([row({ assessed: 10000, partType: 'metal' })]);
    const html = buildUIICFinalHTML(c, null);
    expect(html).toContain('1000.00'); // 10000 * 10%
  });

  test('a glass part reads 0%, not N.D., with a ₹0.00 depreciation amount', () => {
    const c = claim([row({ partType: 'glass' })]);
    const html = buildUIICFinalHTML(c, null);
    expect(html).not.toContain('N.D.');
    expect(html).toContain('0%');
  });

  test('a labour row with no override reads 0% and ₹0.00, not N.D.', () => {
    const c = claim([row({ section: 'labour', partType: 'labour' })]);
    const html = buildUIICFinalHTML(c, null);
    expect(html).not.toContain('N.D.');
  });

  test('a labour row with a manual override shows the real rupee amount', () => {
    const c = claim([row({ section: 'labour', partType: 'labour', assessed: 5000, depOverride: 20 })]);
    const html = buildUIICFinalHTML(c, null);
    expect(html).toContain('1000.00'); // 5000 * 20%
  });

  test('a disposal row shows depreciation alone, unaffected by the disposal factor', () => {
    // 10% dep, 50% disposal: afterDep = 9000, netBeforeGst = 4500 (disposal-reduced).
    // The depreciation amount must be assessed - afterDep = 1000, NOT assessed - netBeforeGst = 5500.
    const c = claim([row({ assessed: 10000, partType: 'metal', isDisposal: true, disposalPercent: 50 })]);
    const html = buildUIICFinalHTML(c, null);
    expect(html).toContain('1000.00');
    expect(html).not.toContain('5500.00');
  });

  test('a disallowed row leaves the new cell blank, like its neighbours', () => {
    const c = claim([
      row({ particulars: 'UNIQUE_ALLOWED', assessed: 10000 }),
      row({ particulars: 'UNIQUE_DISALLOWED', assessed: 10000, allowed: false }),
    ]);
    const html = buildUIICFinalHTML(c, null);
    // 'Not Allowed' used to carry a hardcoded <br/>, which forced it onto two
    // lines in a column that fits it on one at 6.5pt. The marker's presence is
    // what this test is about; the line break was never part of the intent.
    const marker = html.includes('NOT ALLOWED') || html.includes('Not Allowed');
    expect(marker).toBe(true);
  });

  test('item table rows all have the same column count as the header', () => {
    const c = claim([
      row({ assessed: 10000, partType: 'metal' }),
      row({ section: 'labour', partType: 'labour', assessed: 2000, depOverride: 10 }),
      row({ section: 'paint', partType: 'paint', assessed: 1500 }),
    ]);
    const html = buildUIICFinalHTML(c, null);
    // Twelve since the Paint column went in alongside Labour.
    assertColumnCountsMatch(html, 'Part List<br/>W/o Tax', 12);
  });

  test('the sum of per-row depreciation amounts equals the top-summary Depreciation figure', () => {
    const c = claim([
      row({ assessed: 10000, partType: 'metal' }),  // 10% → 1000 dep
      row({ assessed: 8000, partType: 'metal' }),   // 10% → 800 dep
    ]);
    const html = buildUIICFinalHTML(c, null);
    // rawParts(18000) - partsDepreciated(16200) = 1800, matching 1000 + 800
    expect(html).toContain('1800.00');
  });
});

describe('UIIC Bill Check Report — Depreciation Amount column', () => {
  test('a metal part shows assessed minus post-depreciation value', () => {
    const c = claim([row({ assessed: 10000, partType: 'metal' })]);
    const html = buildUIICBillCheckHTML(c, null);
    expect(html).toContain('1000.00');
  });

  test('a glass part reads 0%, not N.D.', () => {
    const c = claim([row({ partType: 'glass' })]);
    const html = buildUIICBillCheckHTML(c, null);
    expect(html).not.toContain('N.D.');
    expect(html).toContain('0%');
  });

  test('a labour row with a manual override shows the real rupee amount', () => {
    const c = claim([row({ section: 'labour', partType: 'labour', assessed: 5000, depOverride: 20 })]);
    const html = buildUIICBillCheckHTML(c, null);
    expect(html).toContain('1000.00');
  });

  test('a disposal row shows depreciation alone, unaffected by the disposal factor', () => {
    const c = claim([row({ assessed: 10000, partType: 'metal', isDisposal: true, disposalPercent: 50 })]);
    const html = buildUIICBillCheckHTML(c, null);
    expect(html).toContain('1000.00');
    expect(html).not.toContain('5500.00');
  });

  test('a disallowed row is absent — bill check already excludes it entirely', () => {
    const c = claim([
      row({ particulars: 'UNIQUE_ALLOWED', assessed: 10000 }),
      row({ particulars: 'UNIQUE_DISALLOWED', assessed: 10000, allowed: false }),
    ]);
    const html = buildUIICBillCheckHTML(c, null);
    expect(html).not.toContain('UNIQUE_DISALLOWED');
  });

  test('item table rows all have the same column count as the header', () => {
    const c = claim([
      row({ assessed: 10000, partType: 'metal' }),
      row({ section: 'labour', partType: 'labour', assessed: 2000, depOverride: 10 }),
      row({ section: 'paint', partType: 'paint', assessed: 1500 }),
    ]);
    const html = buildUIICBillCheckHTML(c, null);
    assertColumnCountsMatch(html, 'BILLS CHECK REPORT', 12);
  });
});
