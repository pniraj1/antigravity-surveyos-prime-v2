import { describe, expect, test } from 'vitest';
import {
  OIC_INVOICE_COLUMNS,
  OIC_ITEM_COLUMNS,
  buildOicWorkbook,
  oicAssessmentRows,
  oicPaintingSummary,
} from '../oic-assessment-excel';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'Item',
    estimated: 10000,
    assessed: 10000,
    billedTaxable: 9000,
    partType: 'metal',
    gst: 18,
    section: 'parts',
    allowed: true,
    isDisposal: false,
    disposalPercent: 50,
    ...overrides,
  };
}

// 100 months old => 40% metal depreciation under the IRDAI scale.
const AGE = 100;

describe('oicAssessmentRows — parts & labour', () => {
  test('a metal part goes in with Metallic Parts and pre-depreciation assessed amount', () => {
    const rows = oicAssessmentRows([row({ assessed: 10000, partType: 'metal' })], AGE, 'standard', 'INV-01');
    expect(rows).toHaveLength(1);
    const [r] = rows;
    expect(r.invoiceNumber).toBe('INV-01');
    expect(r.itemDescription).toBe('Metallic Parts');
    expect(r.itemSubType).toBe('Item');
    expect(r.itemAmount).toBe(10000);
    expect(r.depreciationRate).toBe(40);
    expect(r.gstRate).toBe(18);
    expect(r.hsnCode).toBe('8512');
  });

  test('Item Amount is the Bill Check allowed amount when set, else assessed', () => {
    const rows = oicAssessmentRows(
      [row({ assessed: 10000, billAllowed: 9500 }), row({ assessed: 8000 }), row({ assessed: 4000, billAllowed: 0 })],
      AGE, 'standard', '1',
    );
    expect(rows.map((r) => r.itemAmount)).toEqual([9500, 8000]);
    const paint = oicPaintingSummary([row({ section: 'paint', assessed: 2000, billAllowed: 1600 })]);
    expect(paint.totalAssessed).toBe(1600);
  });

  test('Estimated Amount is the billed amount before GST (owner, 2026-11-10), else the estimate', () => {
    const rows = oicAssessmentRows(
      [row({ estimated: 3000, assessed: 3000, billAllowed: 3690.69, billedTaxable: 3690.69 }), row({ estimated: 700, assessed: 600, billedTaxable: undefined })],
      AGE, 'standard', '1',
    );
    expect(rows.map((r) => [r.itemAmount, r.estimatedAmount])).toEqual([[3690.69, 3690.69], [600, 700]]);
  });

  test('plastic, glass, fiberglass map to OIC dropdown categories', () => {
    const rows = oicAssessmentRows(
      [
        row({ particulars: 'Front Bumper', partType: 'plastic' }),
        row({ particulars: 'Windshield', partType: 'glass' }),
        row({ particulars: 'Fiber Fender', partType: 'fiberglass' }),
      ],
      AGE,
      'standard',
      '66',
    );
    expect(rows.map((r) => r.itemDescription)).toEqual([
      'Plastic',
      'Glass',
      'Non-Metalic Parts',
    ]);
    expect(rows.map((r) => r.depreciationRate)).toEqual([50, 0, 30]);
  });

  test('labour rows map to Labour Charge with 0% depreciation', () => {
    const [r] = oicAssessmentRows(
      [row({ section: 'labour', particulars: 'Denting Fender LH', assessed: 550, estimated: 500, billedTaxable: 900 })],
      AGE,
      'standard',
      '66',
    );
    expect(r.itemDescription).toBe('Labour Charge');
    expect(r.itemSubType).toBe('Denting Fender LH');
    expect(r.itemAmount).toBe(550);
    expect(r.depreciationRate).toBe(0);
    expect(r.gstRate).toBe(18);
    expect(r.estimatedAmount).toBe(900);
  });

  test('nil depreciation policy sets parts depreciation to 0%', () => {
    const rows = oicAssessmentRows(
      [
        row({ partType: 'metal', assessed: 16835 }),
        row({ partType: 'plastic', assessed: 11179 }),
      ],
      AGE,
      'nil',
      '66',
    );
    expect(rows[0].depreciationRate).toBe(0);
    expect(rows[1].depreciationRate).toBe(0);
  });

  // OIC owner rule 2026-11-10: a row with zero assessed amount (not allowed, or not billed) is left out of the Excel.
  test('leaves out disallowed and zero-assessed parts and labour', () => {
    const rows = oicAssessmentRows(
      [
        row({ particulars: 'Non-accidental Dent', allowed: false, estimated: 5000, assessed: 5000 }),
        row({ particulars: 'Not billed', estimated: 3000, assessed: 0 }),
        row({ section: 'labour', particulars: 'Not billed labour', estimated: 800, assessed: 0 }),
        row({ particulars: 'Not in bill', billStatus: 'not-in-bill', estimated: 2000, assessed: 2000 }),
        row({ section: 'labour', particulars: 'Bill not allowed', billStatus: 'not-allowed', estimated: 500, assessed: 500 }),
        row({ particulars: 'Bonnet', estimated: 4000, assessed: 3500, billStatus: 'in-bill' }),
      ],
      AGE,
      'standard',
      '66',
    );
    expect(rows.map((r) => r.itemSubType)).toEqual(['Bonnet']);
  });

  test('leaves out painting lines when no painting is assessed', () => {
    const paint = [
      row({ section: 'paint', estimated: 2000, assessed: 2000, allowed: false }),
      row({ section: 'paint', estimated: 1500, assessed: 1500, billStatus: 'not-in-bill' }),
    ];
    expect(oicAssessmentRows(paint, AGE, 'standard', '66')).toEqual([]);
    expect(oicAssessmentRows(paint, AGE, 'standard', '66', { paintingMode: 'net_single' })).toEqual([]);
    expect(oicAssessmentRows(paint, AGE, 'nil', '66')).toEqual([]);
  });
});

describe('oicAssessmentRows — painting handling', () => {
  test('nil depreciation policy produces a single consolidated Labour Charge line at 0% dep', () => {
    const rows = oicAssessmentRows(
      [
        row({
          section: 'paint',
          particulars: 'Bumper & Hood Painting',
          estimated: 20000,
          assessed: 15000,
          gst: 18,
        }),
      ],
      AGE,
      'nil',
      '66',
    );
    expect(rows).toHaveLength(1);
    const [r] = rows;
    expect(r.itemDescription).toBe('Labour Charge');
    expect(r.itemSubType).toBe('TOTAL PAINTING CHARGES');
    expect(r.itemAmount).toBe(15000);
    expect(r.depreciationRate).toBe(0);
    expect(r.gstRate).toBe(18);
  });

  test('standard policy splits painting into 75% Labour (0% dep) and 25% Plastic (50% dep)', () => {
    const rows = oicAssessmentRows(
      [
        row({
          section: 'paint',
          particulars: 'Front Bumper Painting',
          estimated: 5000,
          assessed: 4000,
          gst: 18,
        }),
      ],
      AGE,
      'standard',
      '66',
    );
    expect(rows).toHaveLength(2);
    const [labourRow, matRow] = rows;

    // 75% Labour at 0%
    expect(labourRow.itemDescription).toBe('Labour Charge');
    expect(labourRow.itemSubType).toBe('PAINTING CHARGES (LABOUR 75%)');
    expect(labourRow.itemAmount).toBe(3000);
    expect(labourRow.depreciationRate).toBe(0);

    // 25% Material at 50%
    expect(matRow.itemDescription).toBe('Plastic');
    expect(matRow.itemSubType).toBe('PAINT MATERIAL (25% STATUTORY)');
    expect(matRow.itemAmount).toBe(1000);
    expect(matRow.depreciationRate).toBe(50);

    // Net check: 3000 + (1000 - 500) = 3500 (12.5% statutory deduction on 4000)
    const netAssessed =
      labourRow.itemAmount * (1 - labourRow.depreciationRate / 100) +
      matRow.itemAmount * (1 - matRow.depreciationRate / 100);
    expect(netAssessed).toBe(3500);
  });

  test('standard policy with net_single produces 1 line with 12.5% pre-deducted under Labour Charge', () => {
    const rows = oicAssessmentRows(
      [
        row({
          section: 'paint',
          particulars: 'Front Bumper Painting',
          estimated: 12000,
          assessed: 15000,
          billedTaxable: 20000,
          gst: 18,
        }),
      ],
      AGE,
      'standard',
      '66',
      { paintingMode: 'net_single' },
    );
    expect(rows).toHaveLength(1);
    const [r] = rows;
    expect(r.itemDescription).toBe('Labour Charge');
    expect(r.itemSubType).toBe('Painting charges (Net 12.5% Dep)');
    // 15000 * 0.875 = 13125
    expect(r.itemAmount).toBe(13125);
    expect(r.depreciationRate).toBe(0);
    expect(r.gstRate).toBe(18);
    expect(r.hsnCode).toBe('9987');
    expect(r.estimatedAmount).toBe(20000);
  });

  test('oicPaintingSummary calculates accurate totals', () => {
    const summary = oicPaintingSummary([
      row({ section: 'paint', estimated: 3000, assessed: 4000, billedTaxable: 5000, allowed: true }),
      row({ section: 'paint', estimated: 2000, assessed: 2000, allowed: false }),
      row({ section: 'paint', estimated: 900, assessed: 900, billStatus: 'not-in-bill' }),
    ]);
    // Disallowed and not-billed painting is left out entirely, estimate included.
    expect(summary.totalEstimated).toBe(5000);
    expect(summary.totalAssessed).toBe(4000);
    expect(summary.labourPart).toBe(3000);
    expect(summary.materialPart).toBe(1000);
    expect(summary.materialDepreciation).toBe(500);
    expect(summary.netAssessed).toBe(3500);
  });
});

describe('buildOicWorkbook — structure & ExcelJS verification', () => {
  test('creates Invoice and Items sheets with exact column headers and formulas', () => {
    const rows = oicAssessmentRows(
      [
        row({ particulars: 'Front Bumper', partType: 'plastic', assessed: 10000, estimated: 10000 }),
        row({ section: 'labour', particulars: 'Labour Fitting', assessed: 2000, estimated: 2000 }),
      ],
      AGE,
      'standard',
      'INV-100',
    );

    const wb = buildOicWorkbook({
      invoiceNumber: 'INV-100',
      invoiceDate: '10-08-2026',
      gstType: 'CGST/SGST',
      rows,
    });

    const invoiceWs = wb.getWorksheet('Invoice');
    expect(invoiceWs).toBeDefined();
    expect(invoiceWs?.name).toBe('Invoice');

    const itemsWs = wb.getWorksheet('Items');
    expect(itemsWs).toBeDefined();
    expect(itemsWs?.name).toBe('Items');

    // Header checks
    const invoiceHeader = invoiceWs?.getRow(1).values as string[];
    expect(invoiceHeader.slice(1)).toEqual([...OIC_INVOICE_COLUMNS]);

    const itemsHeader = itemsWs?.getRow(1).values as string[];
    expect(itemsHeader.slice(1)).toEqual([...OIC_ITEM_COLUMNS]);

    // Items Row 2 Formula Check
    const itemRow2 = itemsWs?.getRow(2);
    expect(itemRow2?.getCell(1).value).toBe('INV-100');
    expect(itemRow2?.getCell(2).value).toBe('Plastic');
    expect(itemRow2?.getCell(5).value).toBe(10000);
    expect(itemRow2?.getCell(6).value).toBe(50);
    expect(itemRow2?.getCell(7).value).toBe(18);

    // Col K Formula
    const k2 = itemRow2?.getCell(11).value as { formula: string };
    expect(k2.formula).toBe('ROUND((E2-(E2*F2/100))*(G2/100),2)');

    // Invoice Row 2 Check
    const invRow2 = invoiceWs?.getRow(2);
    expect(invRow2?.getCell(1).value).toBe('INV-100');
    expect(invRow2?.getCell(2).value).toBe('10-08-2026');
    expect(invRow2?.getCell(3).value).toBe('CGST/SGST');
    expect(invRow2?.getCell(4).value).toBe(12000); // 10000 + 2000
    expect(invRow2?.getCell(5).value).toBe(1260); // (5000*0.18=900) + (2000*0.18=360) = 1260
  });
});
