import { describe, expect, test } from 'vitest';
import { buildUIICBillCheckHTML } from '../uiic-final-builder';
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
    vehicle: { registrationNumber: 'MH39AD2416', dateOfRegistration: '2024-08-05', yearOfManufacture: 2024 },
    policy: {},
    accident: { dateAndTime: '2026-08-05T10:00' },
    driver: {},
    spotDetails: {},
    reinspection: {},
    feeBill: { salvageValue: 0, compulsoryExcess: 0, voluntaryExcess: 0, travelExpenses: 0 },
    billCheck: { billNo: 'B1', billDate: '2026-08-01', billTotal: 0 },
  } as unknown as ClaimData;
}

describe('Bill Check table format', () => {
  test('carries the specimen column headers', () => {
    const html = buildUIICBillCheckHTML(claim([row()]), null);
    expect(html).toContain('Part List');
    expect(html).toContain('Part<br/>Depreciation');
    expect(html).toContain('Parts<br/>Assessment');
    expect(html).toContain('Final amount<br/>With G.S.T');
  });

  test('drops the invented verification columns', () => {
    // These were built from a misreading and shipped to production once.
    const html = buildUIICBillCheckHTML(claim([row({ billStatus: 'in-bill', billRemarks: 'note' })]), null);
    expect(html).not.toContain('Bill Status');
    expect(html).not.toContain('Billed<br/>Amount');
    expect(html).not.toContain('IN BILL');
  });

  test('computes the row final as assessed less depreciation plus GST', () => {
    // Specimen rows, verbatim: 2811.86 → 3317.99 and 3080.51 → 3635.00.
    const html = buildUIICBillCheckHTML(claim([
      row({ particulars: 'FenderCompRH', assessed: 2811.86 }),
      row({ particulars: 'HeadLampRH', assessed: 3080.51 }),
    ]), null);
    expect(html).toContain('3317.99');
    expect(html).toContain('3635.00');
  });

  test('applies depreciation before GST', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ particulars: 'BonnetPanel', assessed: 10000, depOverride: 10 }),
    ]), null);
    expect(html).toContain('10620.00'); // 10000 × 0.90 × 1.18
  });

  test('specimen row 8581.36 lands a paisa below the specimen printout', () => {
    // 8581.36 × 1.18 = 10126.0048 → 10126.00. The specimen prints 10126.01,
    // so its 8581.36 is a rounded display of a slightly larger figure. 14 of
    // its 15 parts rows reproduce exactly; this one is its own rounding, not
    // a defect here. Pinned so the difference is deliberate, not a surprise.
    const html = buildUIICBillCheckHTML(claim([row({ particulars: 'DoorFrontLH', assessed: 8581.36 })]), null);
    expect(html).toContain('10126.00');
  });

  test('prints 0% when depreciation is nil, not N.D.', () => {
    // A zero rate and no rate on record used to print identically. The
    // Depreciation Amount column needs a real number beside every Dep% cell.
    const html = buildUIICBillCheckHTML(claim([row()]), null);
    expect(html).not.toContain('N.D.');
    expect(html).toContain('0%');
  });

  test('shows estimated and assessed as separate columns', () => {
    const html = buildUIICBillCheckHTML(
      claim([row({ particulars: 'FenderRH', estimated: 12000, assessed: 9000 })]),
      null
    );
    const rowHtml = html.split('FenderRH')[1].split('</tr>')[0];
    expect(rowHtml).toContain('12000.00');
    expect(rowHtml).toContain('9000.00');
  });

  test('emits one labour tax line per distinct rate', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ section: 'labour', partType: 'labour', assessed: 1000, gst: 18 }),
      row({ section: 'labour', partType: 'labour', assessed: 2000, gst: 5 }),
    ]), null);
    expect(html).toContain('TAX IN 5 % for Labour');
    expect(html).toContain('TAX IN 18 % for Labour');
  });

  test('excludes disallowed rows but keeps their serial gap', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ id: 'p1', particulars: 'BumperFront' }),
      row({ id: 'p2', particulars: 'GrilleUpper', allowed: false }),
      row({ id: 'p3', particulars: 'HeadlampLH' }),
    ]), null);
    expect(html).not.toContain('GrilleUpper');
    const headlampRow = html.split('HeadlampLH')[0].split('<tr>').pop() ?? '';
    expect(headlampRow).toContain('>3<');
  });

  test('labels plastic parts as Plastic / Rubber', () => {
    const html = buildUIICBillCheckHTML(claim([row({ partType: 'plastic' })]), null);
    expect(html).toContain('Plastic / Rubber');
  });

  test('classifies each row by job type', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ particulars: 'BumperFront' }),
      row({ particulars: 'DentPull', action: 'repair' }),
      row({ particulars: 'FitCharge', section: 'labour', partType: 'labour', assessed: 500 }),
      row({ particulars: 'SprayPanel', section: 'paint', partType: 'paint', assessed: 900 }),
    ]), null);

    const cellsOf = (name: string) => html.split(name)[1].split('</tr>')[0];
    expect(cellsOf('BumperFront')).toContain('>Replace<');
    expect(cellsOf('DentPull')).toContain('>Repair<');
    expect(cellsOf('FitCharge')).toContain('>Labour<');
    expect(cellsOf('SprayPanel')).toContain('>Paint<');
  });

  test('every row in the table spans exactly twelve columns', () => {
    // Adding or removing a column means revisiting a dozen colspans by hand.
    // This catches a miscount instead of leaving it to be spotted on paper.
    // Twelve, not eleven, since the Depreciation Amount column was added.
    const html = buildUIICBillCheckHTML(claim([
      row({ particulars: 'PartA' }),
      row({ particulars: 'LabA', section: 'labour', partType: 'labour', assessed: 500, gst: 18 }),
      row({ particulars: 'LabB', section: 'labour', partType: 'labour', assessed: 700, gst: 5 }),
      row({ particulars: 'PaintA', section: 'paint', partType: 'paint', assessed: 900 }),
    ]), null);

    const table = html.split('BILLS CHECK REPORT')[1].split('</table>')[0];
    const rows = table.split('<tr').slice(1);
    expect(rows.length).toBeGreaterThan(8);

    for (const tr of rows) {
      const cells = [...tr.matchAll(/<t[dh]\b[^>]*>/g)];
      const spans = cells.reduce((sum, c) => {
        const m = /colspan="(\d+)"/.exec(c[0]);
        return sum + (m ? Number(m[1]) : 1);
      }, 0);
      const label = tr.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
      expect(spans, `row "${label}" spans ${spans}, not 12`).toBe(12);
    }
  });
});

describe('GST SUMMARY', () => {
  test('prints a parts block keyed by HSN code', () => {
    const html = buildUIICBillCheckHTML(claim([row({ hsnSac: '8708' })]), null);
    expect(html).toContain('GST SUMMARY');
    expect(html).toContain('HSN CODE');
    expect(html).toContain('DEPRECIATED AMOUNT');
    expect(html).toContain('8708');
  });

  test('prints a service block keyed by accounting code', () => {
    const html = buildUIICBillCheckHTML(
      claim([row({ section: 'labour', partType: 'labour', assessed: 1000, hsnSac: '998729' })]),
      null
    );
    expect(html).toContain('SERVICE ACCOUNTING CODE');
    expect(html).toContain('998729');
  });

  test('bands a mixed-rate claim into separate lines', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ assessed: 10000, gst: 18, hsnSac: '8708' }),
      row({ assessed: 10000, gst: 28, hsnSac: '4011' }),
    ]), null);
    expect(html).toContain('4011');
    expect(html).toContain('8708');
    expect(html).toContain('1400.00'); // 28% half
    expect(html).toContain('900.00');  // 18% half
  });

  test('reproduces the specimen GST figures', () => {
    const html = buildUIICBillCheckHTML(claim([row({ assessed: 41435.59, gst: 18 })]), null);
    expect(html).toContain('3729.20');
    expect(html).toContain('48894.00');
  });

  test('falls back to (Part) and (Labour) when no code is recorded', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ assessed: 1000 }),
      row({ section: 'labour', partType: 'labour', assessed: 500 }),
    ]), null);
    expect(html).toContain('(Part) 18.00');
    expect(html).toContain('(Labour) 18.00');
  });
});

describe('Bill Check financial summary', () => {
  test('carries the same heads as the standard report block', () => {
    const html = buildUIICBillCheckHTML(claim([row()]), null);
    expect(html).toContain('ASSESSMENT SUMMARY');
    expect(html).toContain('Assessed (after Dep.)');
    expect(html).toContain('Incl. GST');
    expect(html).toContain('GRAND TOTAL');
    expect(html).toContain('NET ASSESSED LOSS');
  });

  test('breaks spare parts down by material', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ partType: 'metal', assessed: 10000, estimated: 10000 }),
      row({ partType: 'plastic', assessed: 4000, estimated: 4000 }),
    ]), null);
    expect(html).toContain('Metal');
    expect(html).toContain('Plastic / Rubber');
  });

  test('prints the net in words', () => {
    const html = buildUIICBillCheckHTML(claim([row({ assessed: 10000, estimated: 10000 })]), null);
    expect(html).toContain('RUPEES');
  });

  test('omits a material with no rows', () => {
    const html = buildUIICBillCheckHTML(claim([row({ partType: 'metal' })]), null);
    expect(html).not.toContain('Fibre Glass');
  });

  test('shows labour and painting as separate heads', () => {
    const html = buildUIICBillCheckHTML(claim([
      row({ section: 'labour', partType: 'labour', assessed: 2000, estimated: 2000 }),
      row({ section: 'paint', partType: 'paint', assessed: 5000, estimated: 5000 }),
    ]), null);
    expect(html).toContain('2360.00'); // labour 2000 × 1.18
    expect(html).toContain('5900.00'); // paint 5000 × 1.18
  });
});

describe('summary reconciliation', () => {
  test('Cost of Parts equals the SPARE PARTS subtotal on a mixed-rate claim', () => {
    // The guard for rewiring the summary block's inputs: one page must not
    // contradict itself when a 28% item is present.
    const html = buildUIICBillCheckHTML(claim([
      row({ assessed: 10000, gst: 18 }),
      row({ assessed: 10000, gst: 28 }),
    ]), null);
    // 11800 + 12800 = 24600
    const occurrences = html.split('24600.00').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2); // summary + subtotal
  });
});
