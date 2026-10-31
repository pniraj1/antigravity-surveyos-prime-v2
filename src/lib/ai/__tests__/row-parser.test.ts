import { describe, it, expect } from 'vitest';
import { readRows, parseMoney, tokensFromItems, parseEstimate, type PdfToken } from '../row-parser';

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

  it('keeps numeric words inside text columns', () => {
    const page = [
      ...line(700, [[10, 'Srl'], [100, 'Description'], [260, 'Qty.'], [300, 'Rate']]),
      ...line(680, [[10, '1'], [100, 'TYRE'], [160, '185'], [185, '65'], [210, 'R15'], [275, '2'], [295, '99.00']]),
    ];
    const [row] = rowsOf(readRows([page]));
    expect(row.cells.description).toBe('TYRE 185 65 R15');
    expect(row.cells.quantity).toBe('2');
    expect(row.cells.unit_price).toBe('99.00');
  });
});

describe('parseEstimate', () => {
  const amt = (right: number, s: string): [number, string] => [right - s.length * 5, s];
  const head = (y: number) => line(y, [[10, 'Srl'], [60, 'Description'], [150, 'HSN'], [210, 'Qty.'], [260, 'Taxable'], [320, 'Tax%']]);
  const item = (y: number, sr: number, desc: string, taxable: string, hsn = '87089900') =>
    line(y, [[10, String(sr)], [60, desc], [150, hsn], [220, '1'], amt(295, taxable), amt(340, '18')]);
  const totals = (grand: string | null, sub = ['4,137.28', '5,968.00']) => [
    ...line(590, [[60, 'Sub'], [90, 'Total'], amt(295, sub[0]), amt(400, sub[1])]),
    ...line(580, [[60, 'Total'], amt(295, '4,882.00'), amt(400, '7,042.24')]),
    ...(grand ? line(570, [[60, 'Grand'], [100, 'Total'], [150, '(Rounded)'], amt(295, grand)]) : []),
  ];
  const kia = (labour3 = '4,092.00', grand: string | null = '11924', sr = [1, 2, 3]) => [
    ...line(710, [[60, 'Part'], [90, 'Invoice']]),
    ...head(700),
    ...item(680, 1, 'DOOR', '2,738.98'),
    ...item(670, 2, 'LAMP', '1,398.30'),
    ...line(650, [[60, 'Labour'], [100, 'and'], [120, 'Services']]),
    ...item(640, 1, 'DENTING', '1,426.00', '998729'),
    ...item(630, 2, 'FITTING', '450.00', '998729'),
    ...item(620, sr[2], 'Painting Charges', labour3, '998729'),
    ...totals(grand),
  ];
  const reason = (o: ReturnType<typeof parseEstimate>) => (o.ok ? '' : o.reason);

  it('two sections tie to their subtotals and grand total', () => {
    const o = parseEstimate([kia()]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.spare_parts).toHaveLength(2);
    expect(o.data.labour_items).toHaveLength(2);
    expect(o.data.painting_items).toHaveLength(1);
    expect(o.data.painting_items[0]).toMatchObject({ sr_no: 3, taxable_amount: 4092, total_amount: 4828.56, gst_percent: 18, _page: 0 });
    expect(o.data.labour_items[0].description).toBe('DENTING');
    expect(o.data.gross_amount).toBe(11924);
  });

  it('numbered terms after the grand total do not decline', () => {
    const page = [...kia(), ...line(550, [[10, '1'], [60, 'All'], [90, 'disputes'], [150, 'subject']])];
    expect(parseEstimate([page]).ok).toBe(true);
  });

  it('letterhead text above the header does not classify a section', () => {
    const page = [...line(740, [[60, 'Authorised'], [130, 'Service'], [180, 'Centre']]), ...head(700), ...item(680, 1, 'DOOR', '100.00', '998729'),
      ...line(630, [[60, 'Sub'], [90, 'Total'], amt(295, '100.00')]), ...line(620, [[60, 'Grand'], [100, 'Total'], amt(295, '118')])];
    const o = parseEstimate([page]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.labour_items).toHaveLength(1);
  });

  it('section off by 2 rupees declines', () => {
    expect(reason(parseEstimate([kia('4,094.00')]))).toContain('section');
  });

  it('no grand total declines', () => {
    expect(reason(parseEstimate([kia('4,092.00', null)]))).toContain('grand total');
  });

  it('serial gap declines', () => {
    const page = [...head(700), ...item(680, 1, 'A', '100.00'), ...item(670, 2, 'B', '100.00'), ...item(660, 4, 'D', '100.00'),
      ...line(620, [[60, 'Grand'], [100, 'Total'], amt(295, '236')])];
    expect(reason(parseEstimate([page]))).toContain('gap');
  });

  it('item row with TOTAL in its description is not a labelled total', () => {
    const page = [...head(700), ...item(680, 1, 'TOTAL KIT', '1,000.00')];
    expect(reason(parseEstimate([page]))).toContain('grand total');
  });

  it('merged PDF of two estimates declines', () => {
    expect(parseEstimate([kia(), kia()]).ok).toBe(false);
  });

  it('stray integer in serial column does not create a row', () => {
    const page = [...head(700), ...item(680, 1, 'A', '100.00'), ...item(670, 2, 'B', '100.00'),
      ...line(660, [[10, '7']]), ...item(650, 3, 'C', '100.00'),
      ...line(615, [[60, 'Sub'], [90, 'Total'], amt(295, '300.00')]),
      ...line(610, [[60, 'Grand'], [100, 'Total'], amt(295, '354')])];
    const o = parseEstimate([page]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.spare_parts.map(r => r.sr_no)).toEqual([1, 2, 3]);
  });

  it('single-section doc classifies 9987 SAC as labour', () => {
    const page = [...head(700), ...item(680, 1, 'DOOR', '100.00'), ...item(670, 2, 'FIT', '200.00', '998729'),
      ...line(630, [[60, 'Sub'], [90, 'Total'], amt(295, '300.00')]),
      ...line(620, [[60, 'Grand'], [100, 'Total'], amt(295, '354')])];
    const o = parseEstimate([page]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.spare_parts).toHaveLength(1);
    expect(o.data.labour_items).toHaveLength(1);
  });

  it('printed total column is used as-is', () => {
    const page = [
      ...line(700, [[10, 'Srl'], [60, 'Description'], [210, 'Qty.'], [260, 'Taxable'], [320, 'Tax%'], [380, 'Total']]),
      ...line(680, [[10, '1'], [60, 'DOOR'], [220, '1'], amt(295, '100.00'), amt(340, '18'), amt(405, '119.00')]),
      ...line(620, [[60, 'Grand'], [100, 'Total'], amt(405, '119')]),
    ];
    const o = parseEstimate([page]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.spare_parts[0]).toMatchObject({ taxable_amount: 100, total_amount: 119 });
  });
});
