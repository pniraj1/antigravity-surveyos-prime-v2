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

/** The "9. DETAILS OF ASSESSMENT" table only. */
function section9(html: string): string {
  const start = html.indexOf('9. DETAILS OF ASSESSMENT');
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf('</table>', start);
  return html.slice(start, end);
}

/** Columns each <tr> spans, counting colspan. */
function rowSpans(table: string): number[] {
  return table
    .split('<tr')
    .slice(1)
    .map(tr => {
      const body = tr.slice(0, tr.indexOf('</tr>') + 1 || undefined);
      const cells = [...body.matchAll(/<t[dh]\b([^>]*)>/g)];
      return cells.reduce((sum, c) => {
        const m = /colspan="(\d+)"/.exec(c[1]);
        return sum + (m ? Number(m[1]) : 1);
      }, 0);
    })
    .filter(n => n > 0);
}

/** Declared percentage widths on the header row. */
function headerWidths(table: string): number[] {
  const headRow = table.split('<tr')[1] ?? '';
  return [...headRow.matchAll(/width:([\d.]+)%/g)].map(m => Number(m[1]));
}

const withFiberglass = [
  row({ partType: 'metal' }),
  row({ partType: 'plastic' }),
  row({ partType: 'glass' }),
  row({ partType: 'fiberglass' }),
  row({ section: 'labour', partType: 'labour', assessed: 2000, estimated: 2000 }),
  row({ section: 'paint', partType: 'paint', assessed: 5000, estimated: 5000 }),
];

const withoutFiberglass = withFiberglass.filter(r => r.partType !== 'fiberglass');

describe('standard report — section 9 fits the page', () => {
  // The regression this guards: adding the FbrGls column took the table to 12
  // columns while section headers, the labour/paint sub-header and both
  // sub-total rows still spanned 11, so cells landed under the wrong headings
  // and the table ran off the A4 sheet.
  test.each([
    ['with a fiberglass part', withFiberglass, 12],
    ['without a fiberglass part', withoutFiberglass, 11],
  ])('every row spans the same column count — %s', (_label, rows, expected) => {
    const table = section9(buildStandardFinalSurveyHTML(claim(rows), {} as never));
    const spans = rowSpans(table);

    expect(spans.length).toBeGreaterThan(6);
    expect([...new Set(spans)]).toEqual([expected]);
  });

  test('the FbrGls column appears only when the claim has fiberglass', () => {
    const present = section9(buildStandardFinalSurveyHTML(claim(withFiberglass), {} as never));
    const absent = section9(buildStandardFinalSurveyHTML(claim(withoutFiberglass), {} as never));

    expect(present).toContain('FbrGls ₹');
    expect(absent).not.toContain('FbrGls ₹');
  });

  test('declared widths fill exactly one page width in both layouts', () => {
    // Percentages under `table-layout:fixed` are what keep the table inside the
    // 186mm printable area. Anything over 100 overflows the sheet.
    for (const rows of [withFiberglass, withoutFiberglass]) {
      const table = section9(buildStandardFinalSurveyHTML(claim(rows), {} as never));
      const widths = headerWidths(table);
      expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
    }
  });

  test('the table uses a fixed layout and a wrapping description column', () => {
    const table = section9(buildStandardFinalSurveyHTML(claim(withFiberglass), {} as never));
    expect(table).toContain('table-layout:fixed');
    expect(table).toContain('overflow-wrap:anywhere');
    // `nowrap` under a fixed layout overflows the cell instead of widening it,
    // so no money cell may carry it — a six-figure amount has to wrap rather
    // than run off the sheet. Sr is the deliberate exception (see below): it
    // is two digits wide, and breaking those across two lines is worse than a
    // fractional overflow.
    const moneyCells = [...table.matchAll(/style="([^"]*text-align:right[^"]*)"/g)];
    expect(moneyCells.length).toBeGreaterThan(0);
    for (const [, style] of moneyCells) {
      expect(style).not.toContain('white-space:nowrap');
    }
  });

  test('the Sr column never breaks a two-digit serial across two lines', () => {
    // A 2.5%-wide Sr column left ~2pt of content space at the largest font
    // scale, and td9's `word-break:break-word` split "10" into "1" over "0".
    const table = section9(buildStandardFinalSurveyHTML(claim(withFiberglass), {} as never));
    const srCell = table.match(/<td style="([^"]*)"[^>]*>\s*1\s*<\/td>/);
    expect(srCell?.[1]).toContain('white-space:nowrap');
    expect(srCell?.[1]).not.toContain('word-break:break-word');

    const srWidth = headerWidths(table)[0];
    expect(srWidth).toBeGreaterThanOrEqual(4);
  });

  test('a long part description does not get its own column widened', () => {
    const long = row({ particulars: 'FRONT BUMPER ASSEMBLY WITH FOG LAMP HOUSING AND BRACKET SET COMPLETE' });
    const table = section9(buildStandardFinalSurveyHTML(claim([long]), {} as never));
    expect([...new Set(rowSpans(table))]).toEqual([11]);
    expect(headerWidths(table).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  });
});
