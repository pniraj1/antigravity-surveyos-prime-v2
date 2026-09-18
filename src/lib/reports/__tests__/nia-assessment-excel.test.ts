import { describe, expect, test } from 'vitest';
import { NIA_COLUMNS, buildNiaWorkbook, niaAssessmentRows, niaPainting } from '../nia-assessment-excel';
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

describe('niaAssessmentRows — parts', () => {
  test('a metal part goes in at its FULL pre-depreciation price', () => {
    // R1. The portal depreciates; we send the raw assessed figure.
    const [r] = niaAssessmentRows([row({ assessed: 10000, partType: 'metal' })], AGE, 'standard');
    expect(r.category).toBe('Spare Parts');
    expect(r.description).toBe('Parts at Agewise Depreciation');
    expect(r.serviceType).toBe('REPLACE');
    expect(r.assessedAmount).toBe('10000.00');
    expect(r.depreciationPercentage).toBe('40');
    expect(r.hsnCode).toBe('8512');
    expect(r.gstPercentage).toBe('18');
  });

  test('plastic, fibreglass and glass map to their descriptions', () => {
    const rows = niaAssessmentRows(
      [
        row({ partType: 'plastic' }),
        row({ partType: 'fiberglass' }),
        row({ partType: 'glass' }),
      ],
      AGE,
      'standard',
    );
    expect(rows.map((r) => r.description)).toEqual([
      'Parts at 50% Depreciation',
      'Parts at 30% Depreciation',
      'Parts at Cost',
    ]);
    expect(rows.map((r) => r.depreciationPercentage)).toEqual(['50', '30', '0']);
  });

  test('a disposal part is Parts at Cost at its allowed value, zero GST, scrap HSN', () => {
    // R5. 40% dep then 50% disposal => 10000 x 0.6 x 0.5 = 3000.
    const [r] = niaAssessmentRows(
      [row({ assessed: 10000, partType: 'metal', isDisposal: true, disposalPercent: 50 })],
      AGE,
      'standard',
    );
    expect(r.description).toBe('Parts at Cost');
    expect(r.assessedAmount).toBe('3000.00');
    expect(r.depreciationPercentage).toBe('0');
    expect(r.gstPercentage).toBe('0');
    expect(r.hsnCode).toBe('72041000');
  });

  test('a disallowed part is still emitted, as NOT ALLOWED with assessed 0', () => {
    // R8. The insurer sees what was claimed.
    const [r] = niaAssessmentRows([row({ allowed: false, estimated: 500 })], AGE, 'standard');
    expect(r.serviceType).toBe('NOT ALLOWED');
    expect(r.estimatedAmount).toBe('500.00');
    expect(r.assessedAmount).toBe('0.00');
  });

  test('HSN follows the GST rate: 28% is 8708, 0% is 72041000', () => {
    // R4
    const rows = niaAssessmentRows([row({ gst: 28 }), row({ gst: 0 })], AGE, 'standard');
    expect(rows.map((r) => r.hsnCode)).toEqual(['8708', '72041000']);
  });

  test('a surveyor override on depreciation is what goes in the file', () => {
    const [r] = niaAssessmentRows([row({ partType: 'metal', depOverride: 25 })], AGE, 'standard');
    expect(r.depreciationPercentage).toBe('25');
  });

  test('an IMT-23 row goes in at its halved effective assessed, disposal or not', () => {
    const rows = niaAssessmentRows(
      [
        row({ assessed: 10000, imt23: true }),
        row({ assessed: 10000, imt23: true, isDisposal: true, disposalPercent: 100 }),
      ],
      AGE,
      'standard',
    );
    expect(rows[0].assessedAmount).toBe('5000.00');
    // 5000 effective, 40% dep, 100% disposal factor => 3000
    expect(rows[1].assessedAmount).toBe('3000.00');
  });

  test('on a nil-depreciation policy every part goes out as Agewise with rate 0', () => {
    // The portal locks 50%/30% from the class descriptions; only Agewise reads our rate.
    const rows = niaAssessmentRows(
      [row({ partType: 'plastic' }), row({ partType: 'fiberglass' }), row({ partType: 'metal' })],
      AGE,
      'nil',
    );
    expect(rows.map((r) => r.description)).toEqual([
      'Parts at Agewise Depreciation',
      'Parts at Agewise Depreciation',
      'Parts at Agewise Depreciation',
    ]);
    expect(rows.map((r) => r.depreciationPercentage)).toEqual(['0', '0', '0']);
  });

  test('a depreciation override on a plastic part goes out as Agewise carrying the override', () => {
    const [r] = niaAssessmentRows([row({ partType: 'plastic', depOverride: 25 })], AGE, 'standard');
    expect(r.description).toBe('Parts at Agewise Depreciation');
    expect(r.depreciationPercentage).toBe('25');
  });

  test('a GST rate the portal does not accept throws, naming the row', () => {
    expect(() => niaAssessmentRows([row({ gst: 12, particulars: 'Odd Part' })], AGE, 'standard')).toThrow(
      /"Odd Part" has GST 12%/,
    );
  });
});

describe('niaAssessmentRows — labour and paint', () => {
  test('labour rows are Labor Charges / ALLOW with zero depreciation', () => {
    const [r] = niaAssessmentRows(
      [row({ section: 'labour', partType: 'labour', assessed: 737.5 })],
      AGE,
      'standard',
    );
    expect(r.category).toBe('Labor Charges');
    expect(r.description).toBe('Labor charges for Removing and Refitting');
    expect(r.serviceType).toBe('ALLOW');
    expect(r.depreciationPercentage).toBe('0');
    expect(r.assessedAmount).toBe('737.50');
  });

  test('paint rows are excluded from the sheet', () => {
    // R7. Painting is typed into the portal separately.
    const rows = niaAssessmentRows(
      [row({ section: 'parts' }), row({ section: 'paint', partType: 'paint' })],
      AGE,
      'standard',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('Spare Parts');
  });

  test('billedAmount is the billed taxable figure, or 0 when absent', () => {
    // R10
    const rows = niaAssessmentRows(
      [row({ billedTaxable: 9645.76 }), row({ billedTaxable: undefined })],
      AGE,
      'standard',
    );
    expect(rows.map((r) => r.billedAmount)).toEqual(['9645.76', '0.00']);
  });
});

describe('niaAssessmentRows — shape', () => {
  test('SlNo runs 1..n and every key is in the portal order with no empty cell', () => {
    // R9. The portal counts keys on row 1 and rejects any blank.
    const rows = niaAssessmentRows(
      [row(), row({ section: 'labour', partType: 'labour' }), row({ allowed: false })],
      AGE,
      'standard',
    );
    expect(rows.map((r) => r.SlNo)).toEqual([1, 2, 3]);
    for (const r of rows) {
      expect(Object.keys(r)).toEqual([...NIA_COLUMNS]);
      for (const v of Object.values(r)) expect(String(v)).not.toBe('');
    }
  });

  test('partName is trimmed and cut at 100 characters', () => {
    const [r] = niaAssessmentRows([row({ particulars: '  ' + 'x'.repeat(150) + '  ' })], AGE, 'standard');
    expect(r.partName).toHaveLength(100);
    expect(r.partName.startsWith('x')).toBe(true);
  });

  test('partName drops the characters the portal rejects and collapses the gaps', () => {
    const [r] = niaAssessmentRows([row({ particulars: 'Bumper Assy & Grill | L/R <RH>' })], AGE, 'standard');
    expect(r.partName).toBe('Bumper Assy Grill L/R RH');
  });
});

describe('niaPainting', () => {
  test('sums estimate over all paint rows and assessed over allowed ones, pre-dep', () => {
    // R7. The Tigor figures. Estimate sums every paint row, disallowed included: 20000 + 8003.76 + 1000.
    const p = niaPainting([
      row({ section: 'paint', partType: 'paint', estimated: 20000, assessed: 17000, depOverride: 12.5 }),
      row({ section: 'paint', partType: 'paint', estimated: 8003.76, assessed: 6732 }),
      row({ section: 'paint', partType: 'paint', estimated: 1000, assessed: 900, allowed: false }),
      row({ section: 'parts', estimated: 5000, assessed: 5000 }),
    ]);
    expect(p.estimate).toBeCloseTo(29003.76, 2);
    expect(p.assessed).toBeCloseTo(23732, 2);
  });
});

describe('buildNiaWorkbook', () => {
  test('one sheet named Primary_Assessment_Template, header row is the portal columns, amounts are text', () => {
    const rows = niaAssessmentRows([row({ assessed: 1234.5 })], AGE, 'standard');
    const wb = buildNiaWorkbook(rows);

    expect(wb.worksheets.map((w) => w.name)).toEqual(['Primary_Assessment_Template']);
    const ws = wb.getWorksheet('Primary_Assessment_Template')!;

    const header = ws.getRow(1).values as unknown[];
    expect(header.slice(1)).toEqual([...NIA_COLUMNS]); // ExcelJS row values are 1-based

    const first = ws.getRow(2);
    expect(first.getCell(1).value).toBe(1); // SlNo stays numeric
    expect(first.getCell(8).value).toBe('1234.50'); // assessedAmount, a string
    expect(typeof first.getCell(8).value).toBe('string');
    expect(ws.rowCount).toBe(2);
  });
});

describe('niaAssessmentRows — nil-dep painting row', () => {
  const paintRows = [
    row({ section: 'paint', partType: 'paint', estimated: 20000, assessed: 17000, billedTaxable: 16500 }),
    row({ section: 'paint', partType: 'paint', estimated: 8003.76, assessed: 6732, billedTaxable: 6732 }),
    row({ section: 'paint', partType: 'paint', estimated: 1000, assessed: 900, billedTaxable: 900, allowed: false }),
  ];

  test('on a nil-dep policy painting goes in as one final labour row the portal cannot depreciate', () => {
    // R11. The portal's 50% on paint material is hardcoded; a labour row is
    // the only place painting passes through untouched.
    const rows = niaAssessmentRows([row({ partType: 'metal' }), ...paintRows], AGE, 'nil');
    expect(rows).toHaveLength(2);
    const p = rows[1];
    expect(p.SlNo).toBe(2);
    expect(p.category).toBe('Labor Charges');
    expect(p.description).toBe('Other Labor Charges');
    expect(p.partName).toBe('Painting Charges');
    expect(p.serviceType).toBe('ALLOW');
    expect(p.estimatedAmount).toBe('29003.76');
    expect(p.billedAmount).toBe('23232.00');
    expect(p.assessedAmount).toBe('23732.00');
    expect(p.depreciationPercentage).toBe('0');
    expect(p.hsnCode).toBe('8512');
    expect(p.gstPercentage).toBe('18');
  });

  test('on a nil-dep policy with no paint rows, no painting row is added', () => {
    const rows = niaAssessmentRows([row({ partType: 'metal' })], AGE, 'nil');
    expect(rows).toHaveLength(1);
  });

  test('on a standard policy no painting row is added, whatever the paint rows', () => {
    // R7. Standard-policy painting is typed into the Painting section.
    const rows = niaAssessmentRows([row({ partType: 'metal' }), ...paintRows], AGE, 'standard');
    expect(rows).toHaveLength(1);
    expect(rows.some((r) => r.partName === 'Painting Charges')).toBe(false);
  });

  test('niaPainting also sums the billed figure over allowed paint rows', () => {
    const p = niaPainting(paintRows);
    expect(p.billed).toBeCloseTo(23232, 2);
  });
});
