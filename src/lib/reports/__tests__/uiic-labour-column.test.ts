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

/** The eleven <td> contents of the item-table row containing `needle`. */
function cellsOfRow(html: string, needle: string): string[] {
  const at = html.indexOf(needle);
  expect(at, `row containing "${needle}" not found`).toBeGreaterThan(-1);
  const start = html.lastIndexOf('<tr>', at);
  const end = html.indexOf('</tr>', at);
  const tr = html.slice(start, end);
  return [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
}

// Column positions in the eleven-column Final Report item table:
//   1 SR | 2 Part Name | 3 Part Type | 4 Job Type | 5 Part List W/o Tax
//   6 Dep% | 7 Dep Amt | 8 Parts Assess | 9 GST% | 10 Part with GST
//   11 Labour with GST
const PART_WITH_GST = 9;   // zero-based index of column 10
const LABOUR_WITH_GST = 10; // zero-based index of column 11

describe('UIIC Final Report — services money belongs in the Labour column', () => {
  test('a labour row puts its money in the Labour column, not the parts column', () => {
    // 1000 assessed, labour attracts no automatic depreciation → 1000 × 1.18 = 1180.00
    const html = buildUIICFinalHTML(
      claim([row({ particulars: 'FitCharge', section: 'labour', partType: 'labour', assessed: 1000, gst: 18 })]),
      null,
    );
    const cells = cellsOfRow(html, 'FitCharge');
    expect(cells).toHaveLength(11);
    expect(cells[PART_WITH_GST]).toBe('');
    expect(cells[LABOUR_WITH_GST]).toContain('1180.00');
  });

  test('a paint row already puts its money there, and still does', () => {
    const html = buildUIICFinalHTML(
      claim([row({ particulars: 'SprayPanel', section: 'paint', partType: 'paint', assessed: 2000, gst: 18 })]),
      null,
    );
    const cells = cellsOfRow(html, 'SprayPanel');
    expect(cells).toHaveLength(11);
    expect(cells[PART_WITH_GST]).toBe('');
    expect(cells[LABOUR_WITH_GST]).toContain('2360.00'); // 2000 × 1.18
  });

  test('a parts row keeps its money in the parts column', () => {
    // 10000 metal at 24 months → 10% dep → 9000 × 1.18 = 10620.00
    const html = buildUIICFinalHTML(claim([row({ particulars: 'BonnetPanel', assessed: 10000 })]), null);
    const cells = cellsOfRow(html, 'BonnetPanel');
    expect(cells).toHaveLength(11);
    expect(cells[PART_WITH_GST]).toContain('10620.00');
  });

  test('a disallowed labour row is still flagged Not Allowed', () => {
    const html = buildUIICFinalHTML(
      claim([row({ particulars: 'RejectedFit', section: 'labour', partType: 'labour', assessed: 1000, allowed: false })]),
      null,
    );
    const cells = cellsOfRow(html, 'RejectedFit');
    expect(cells[LABOUR_WITH_GST]).toContain('Not');
  });

  test('the two money column headers say what they hold', () => {
    const html = buildUIICFinalHTML(claim([row()]), null);
    expect(html).toContain('Part with<br/>GST');
    expect(html).toContain('Labour with<br/>GST');
  });
});
