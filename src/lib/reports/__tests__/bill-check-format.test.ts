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

  test('prints N.D. when depreciation is nil', () => {
    const html = buildUIICBillCheckHTML(claim([row()]), null);
    expect(html).toContain('N.D.');
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
});
