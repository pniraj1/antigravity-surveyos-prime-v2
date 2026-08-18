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

// Column positions in the twelve-column Final Report item table:
//   1 SR | 2 Part Name | 3 Part Type | 4 Job Type | 5 Part List W/o Tax
//   6 Dep% | 7 Dep Amt | 8 Parts Assess | 9 GST% | 10 Part with GST
//   11 Labour with GST | 12 Paint with GST
const COLS = 12;
const PART_WITH_GST = 9;    // zero-based index of column 10
const LABOUR_WITH_GST = 10; // zero-based index of column 11
const PAINT_WITH_GST = 11;  // zero-based index of column 12

/** Total spans of a row, counting colspan — must equal COLS for every row. */
function spansOf(tr: string): number {
  return [...tr.matchAll(/<t[dh]\b[^>]*>/g)].reduce((sum, c) => {
    const m = /colspan="(\d+)"/.exec(c[0]);
    return sum + (m ? Number(m[1]) : 1);
  }, 0);
}

describe('UIIC Final Report — each section books money to its own column', () => {
  test('a parts row uses the parts column only', () => {
    // 10000 metal at 24 months → 10% dep → 9000 × 1.18 = 10620.00
    const html = buildUIICFinalHTML(claim([row({ particulars: 'BonnetPanel', assessed: 10000 })]), null);
    const cells = cellsOfRow(html, 'BonnetPanel');
    expect(cells).toHaveLength(COLS);
    expect(cells[PART_WITH_GST]).toContain('10620.00');
    expect(cells[LABOUR_WITH_GST]).toBe('');
    expect(cells[PAINT_WITH_GST]).toBe('');
  });

  test('a labour row uses the labour column only', () => {
    // 1000 assessed, labour attracts no automatic depreciation → 1000 × 1.18 = 1180.00
    const html = buildUIICFinalHTML(
      claim([row({ particulars: 'FitCharge', section: 'labour', partType: 'labour', assessed: 1000, gst: 18 })]),
      null,
    );
    const cells = cellsOfRow(html, 'FitCharge');
    expect(cells).toHaveLength(COLS);
    expect(cells[PART_WITH_GST]).toBe('');
    expect(cells[LABOUR_WITH_GST]).toContain('1180.00');
    expect(cells[PAINT_WITH_GST]).toBe('');
  });

  test('a paint row uses the paint column only', () => {
    const html = buildUIICFinalHTML(
      claim([row({ particulars: 'SprayPanel', section: 'paint', partType: 'paint', assessed: 2000, gst: 18 })]),
      null,
    );
    const cells = cellsOfRow(html, 'SprayPanel');
    expect(cells).toHaveLength(COLS);
    expect(cells[PART_WITH_GST]).toBe('');
    expect(cells[LABOUR_WITH_GST]).toBe('');
    expect(cells[PAINT_WITH_GST]).toContain('2360.00'); // 2000 × 1.18
  });

  test('a disallowed row is flagged in its own section column', () => {
    const html = buildUIICFinalHTML(
      claim([row({ particulars: 'RejectedFit', section: 'labour', partType: 'labour', assessed: 1000, allowed: false })]),
      null,
    );
    expect(cellsOfRow(html, 'RejectedFit')[LABOUR_WITH_GST]).toContain('Not');
  });

  test('all three money column headers say what they hold', () => {
    const html = buildUIICFinalHTML(claim([row()]), null);
    expect(html).toContain('Part<br/>with GST');
    expect(html).toContain('Labour<br/>with GST');
    expect(html).toContain('Paint<br/>with GST');
  });

  test('GROSS TOTAL books labour and paint to their own columns', () => {
    const html = buildUIICFinalHTML(claim([
      row({ particulars: 'BonnetPanel', assessed: 10000 }),
      row({ particulars: 'FitCharge', section: 'labour', partType: 'labour', assessed: 1000, gst: 18 }),
      row({ particulars: 'SprayPanel', section: 'paint', partType: 'paint', assessed: 2000, gst: 18 }),
    ]), null);
    const cells = cellsOfRow(html, 'GROSS TOTAL');
    // colspan(10) label + labour + paint
    expect(cells[cells.length - 2]).toContain('1180.00');
    expect(cells[cells.length - 1]).toContain('2360.00');
  });

  test('every row in the item table spans exactly twelve columns', () => {
    // Adding a column means revisiting a dozen colspans by hand. This catches
    // a miscount instead of leaving it to be spotted on paper.
    const html = buildUIICFinalHTML(claim([
      row({ particulars: 'PartA', assessed: 10000 }),
      row({ particulars: 'LabA', section: 'labour', partType: 'labour', assessed: 500, gst: 18 }),
      row({ particulars: 'PaintA', section: 'paint', partType: 'paint', assessed: 900, gst: 18 }),
      row({ particulars: 'RejectedPart', assessed: 400, allowed: false }),
    ]), null);
    const table = html.split('DETAILS OF ASSESSMENT')[1].split('</table>')[0];
    const rows = table.split('<tr').slice(1);
    expect(rows.length).toBeGreaterThan(6);
    for (const tr of rows) {
      const label = tr.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
      expect(spansOf(tr), `row "${label}" spans ${spansOf(tr)}, not ${COLS}`).toBe(COLS);
    }
  });

  test('the item table uses a fixed layout so a long figure cannot widen a column off the A4 page', () => {
    const html = buildUIICFinalHTML(claim([row()]), null);
    const table = html.split('DETAILS OF ASSESSMENT')[1].split('>')[1];
    expect(html.split('DETAILS OF ASSESSMENT')[1].slice(0, 400)).toContain('table-layout:fixed');
    expect(table).toBeDefined();
  });
});
