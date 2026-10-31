import { describe, it, expect } from 'vitest';
import { readRows, parseMoney, tokensFromItems, type PdfToken } from '../row-parser';

const line = (y: number, cells: Array<[number, string]>): PdfToken[] =>
  cells.map(([x, s]) => ({ s, x, y, w: s.length * 5 }));

const rowsOf = (r: ReturnType<typeof readRows>) => {
  if ('declined' in r) throw new Error(r.declined);
  return r.rows;
};

describe('tokensFromItems', () => {
  it('splits multi-word items with estimated x', () => {
    const t = tokensFromItems([{ str: '206.78 206.78', transform: [1, 0, 0, 1, 100, 500], width: 65 }]);
    expect(t.map(k => [k.s, k.x])).toEqual([['206.78', 100], ['206.78', 135]]);
  });
});

describe('parseMoney', () => {
  it('parses Indian and plain amounts, rejects fragments', () => {
    expect(parseMoney('2,27,794.00')).toBe(227794);
    expect(parseMoney('1075.99')).toBe(1075.99);
    expect(parseMoney('0.00')).toBe(0);
    expect(parseMoney('8,845.')).toBeNull();
    expect(parseMoney('8708.99.00')).toBeNull();
  });
});

describe('readRows', () => {
  const header = (y = 700) => line(y, [[10, 'Srl'], [40, 'Part'], [70, 'Number'], [120, 'Description'], [220, 'Qty.'], [260, 'Rate'], [310, 'Taxable']]);

  it('maps single-line rows to header columns', () => {
    const page = [
      ...header(),
      ...line(680, [[10, '1'], [40, 'P-1'], [120, 'DOOR'], [235, '2'], [250, '100.00'], [315, '200.00']]),
      ...line(670, [[10, '2'], [120, 'LAMP'], [235, '1'], [255, '50.00'], [320, '50.00']]),
      ...line(660, [[10, '3'], [120, 'BOLT'], [235, '4'], [260, '5.00'], [320, '20.00']]),
    ];
    const rows = rowsOf(readRows([page]));
    expect(rows.map(r => r.sr)).toEqual([1, 2, 3]);
    expect(rows[0].cells).toMatchObject({ description: 'DOOR', quantity: '2', unit_price: '100.00', taxable_amount: '200.00', part_number: 'P-1' });
    expect(rows[2].cells.description).toBe('BOLT');
  });

  it('keeps wrapped description and split number with its row', () => {
    const page = [
      ...line(700, [[10, 'Srl'], [50, 'Description'], [200, 'Qty.'], [300, 'Total']]),
      ...line(606, [[50, 'CED'], [80, 'ASSY']]),
      ...line(603, [[295, '8,845.']]),
      ...line(600, [[10, '1'], [200, '1']]),
      ...line(597, [[300, '76']]),
      ...line(594, [[50, 'TAILGATE']]),
    ];
    const [row] = rowsOf(readRows([page]));
    expect(row.cells.total_amount).toBe('8,845.76');
    expect(row.cells.description).toBe('CED ASSY TAILGATE');
  });

  it('continues serials across pages', () => {
    const p0 = [...header(), ...line(680, [[10, '1'], [120, 'A']]), ...line(670, [[10, '2'], [120, 'B']])];
    const p1 = [...header(), ...line(680, [[10, '3'], [120, 'C']])];
    const rows = rowsOf(readRows([p0, p1]));
    expect(rows.map(r => [r.sr, r.page])).toEqual([[1, 0], [2, 0], [3, 1]]);
  });

  it('declines without a Qty header', () => {
    const page = [...line(700, [[10, 'Srl'], [120, 'Description']]), ...line(680, [[10, '1'], [120, 'A']])];
    const r = readRows([page]);
    expect('declined' in r && r.declined).toContain('header');
  });

  it('takes the rightmost non-zero cell when headers share a Field', () => {
    const page = [
      ...line(700, [[10, 'Srl'], [120, 'Description'], [200, 'Qty.'], [260, 'Ins.Amt'], [330, 'Amount']]),
      ...line(680, [[10, '1'], [120, 'A'], [275, '0.00'], [330, '500.00']]),
      ...line(670, [[10, '2'], [120, 'B'], [265, '300.00']]),
    ];
    const rows = rowsOf(readRows([page]));
    expect(rows.map(r => r.cells.total_amount)).toEqual(['500.00', '300.00']);
  });

  it('maps a bare Labor header to taxable_amount and reports non-item lines', () => {
    const page = [
      ...line(700, [[10, 'Srl'], [120, 'Description'], [200, 'Qty.'], [300, 'Labor']]),
      ...line(680, [[10, '1'], [120, 'PAINT'], [295, '900.00']]),
      ...line(600, [[120, 'Total'], [300, '900.00']]),
    ];
    const r = readRows([page]);
    if ('declined' in r) throw new Error(r.declined);
    expect(r.rows[0].cells.taxable_amount).toBe('900.00');
    expect(r.nonItemLines.some(l => l.text === 'Total 900.00' && l.nums[0] === 900)).toBe(true);
  });

  it('assigns a wide right-aligned amount by right edge, not centre', () => {
    const page = [
      ...line(700, [[10, 'Srl'], [120, 'Description'], [200, 'Qty.'], [260, 'Rate'], [330, 'Total']]),
      ...line(680, [[10, '1'], [120, 'A'], [300, '1,18,000.00']]),
    ];
    const [row] = rowsOf(readRows([page]));
    expect(row.cells.total_amount).toBe('1,18,000.00');
    expect(row.cells.unit_price).toBeUndefined();
  });
});
