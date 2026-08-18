import { describe, expect, test } from 'vitest';
import { buildUIICFinalHTML } from '../uiic-final-builder';
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
    // Nil depreciation keeps the arithmetic readable: base == assessed.
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

/** Rows of the GST SUMMARY table that follows `heading`. */
function summaryRows(html: string, heading: string): string[] {
  const at = html.indexOf(heading);
  expect(at, `heading "${heading}" not found`).toBeGreaterThan(-1);
  const table = html.slice(at).split('<table')[1].split('</table>')[0];
  return table.split('<tr').slice(1);
}

describe('UIIC Final Report — GST SUMMARY is per rate, never hardcoded', () => {
  test('a mixed-rate parts claim gets one line per rate, not a single 18% line', () => {
    const html = buildUIICFinalHTML(claim([
      row({ assessed: 10000, gst: 18, hsnSac: '8708' }),
      row({ assessed: 10000, gst: 28, hsnSac: '4011' }),
    ]), null);
    expect(html).toContain('8708');
    expect(html).toContain('4011');
    expect(html).toContain('28.00');
    expect(html).not.toContain('(Part) 18.00');
  });

  test('the real HSN code prints instead of a placeholder', () => {
    const html = buildUIICFinalHTML(claim([row({ hsnSac: '8708' })]), null);
    expect(html).toContain('8708 18.00');
  });

  test('a claim with no 18% item never prints 18.00', () => {
    const html = buildUIICFinalHTML(claim([row({ assessed: 10000, gst: 28, hsnSac: '4011' })]), null);
    expect(html).toContain('4011 28.00');
    expect(html).not.toContain('18.00');
  });

  test('a placeholder is still used when the row carries no code', () => {
    const html = buildUIICFinalHTML(claim([row({ assessed: 10000, gst: 18 })]), null);
    expect(html).toContain('(Part) 18.00');
  });

  test('mixed-rate services get one SAC line per rate', () => {
    const html = buildUIICFinalHTML(claim([
      row({ section: 'labour', partType: 'labour', assessed: 1000, gst: 18, hsnSac: '998729' }),
      row({ section: 'paint', partType: 'paint', assessed: 2000, gst: 5, hsnSac: '998agf' }),
    ]), null);
    expect(html).toContain('998729 18.00');
    expect(html).toContain('998agf 5.00');
  });

  test('the parts CGST and SGST split each rate in half', () => {
    // 10000 at 28% under nil depreciation → 1400 each half
    const html = buildUIICFinalHTML(claim([row({ assessed: 10000, gst: 28, hsnSac: '4011' })]), null);
    expect(html).toContain('1400.00');
  });

  test('the parts GRAND TOTAL base agrees with the amount beside it', () => {
    // A disposal row lands in a 0% band. The base column used to exclude it
    // while the amount column included it, so the two disagreed on one line.
    const html = buildUIICFinalHTML(claim([
      row({ assessed: 10000, gst: 18 }),
      row({ assessed: 4000, gst: 18, isDisposal: true, disposalPercent: 50 }),
    ]), null);
    const rows = summaryRows(html, 'GST SUMMARY');
    const grand = rows.find(r => r.includes('GRAND TOTAL'));
    expect(grand, 'no GRAND TOTAL row in the parts GST SUMMARY').toBeDefined();
    // base 10000 + 2000 (disposal at 50%) = 12000
    expect(grand).toContain('12000.00');
  });
});
