import { describe, it, expect } from 'vitest';
import { readRows, parseMoney, tokensFromItems, parseEstimate, type PdfToken } from '../row-parser';
import { labourHead, partsHead, page } from './fixtures/vw-two-tables';

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

  it('a second estimate below the first grand total declines', () => {
    const second = [...head(540), ...item(530, 1, 'WING', '100.00'), ...item(520, 2, 'BULB', '50.00'),
      ...line(500, [[60, 'Total'], [100, 'Amount'], amt(295, '177')])];
    expect(reason(parseEstimate([[...kia(), ...second]]))).toContain('multiple');
  });

  it('a continuation page with no recognised header and a combined grand total declines', () => {
    const cont = [...item(680, 4, 'WING', '100.00', '998729'), ...item(670, 5, 'BULB', '50.00', '998729'),
      ...line(620, [[60, 'Sub'], [90, 'Total'], amt(295, '6118.00')]),
      ...line(600, [[60, 'Grand'], [100, 'Total'], amt(295, '12101')])];
    expect(reason(parseEstimate([kia(), cont]))).toContain('multiple');
  });

  it('computed totals: a gross off by 4 rupees declines, a rounded grand total (0.40) is accepted', () => {
    expect(parseEstimate([kia('4,092.00', '11928')]).ok).toBe(false);
    expect(parseEstimate([kia('4,092.00', '11924.64')]).ok).toBe(true);
  });

  it('a second estimate on the next page declines', () => {
    const second = [...head(700), ...item(680, 1, 'WING', '100.00'), ...line(620, [[60, 'Payable'], amt(295, '118')])];
    expect(reason(parseEstimate([kia(), second]))).toContain('multiple');
  });

  it('heading-less labour section after a parts subtotal line is classified by SAC', () => {
    const page = [...head(700), ...item(680, 1, 'DOOR', '100.00'), ...item(670, 2, 'LAMP', '200.00'),
      ...line(650, [[60, 'Parts'], [100, 'Total'], amt(295, '300.00')]),
      ...item(640, 1, 'DENTING', '400.00', '998729'), ...item(630, 2, 'FITTING', '100.00', '998729'),
      ...line(590, [[60, 'Sub'], [90, 'Total'], amt(295, '300.00'), amt(400, '500.00')]),
      ...line(570, [[60, 'Grand'], [100, 'Total'], amt(295, '944')])];
    const o = parseEstimate([page]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.spare_parts).toHaveLength(2);
    expect(o.data.labour_items).toHaveLength(2);
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

  it('Amount column printed before tax (Tax% as "18%") ties through taxable', () => {
    const page = [
      ...line(700, [[10, 'Srl'], [60, 'Description'], [200, 'Tax%'], [260, 'Qty.'], [330, 'Amount']]),
      ...line(680, [[10, '1'], [60, 'DOOR'], [200, '18%'], [262, '1.0'], amt(360, '100.00')]),
      ...line(670, [[10, '2'], [60, 'LAMP'], [200, '18%'], [262, '1.0'], amt(360, '200.00')]),
      ...line(620, [[60, 'Sub'], [90, 'Total'], amt(360, '300.00')]),
      ...line(600, [[60, 'Grand'], [100, 'Total'], amt(360, '354')]),
    ];
    const o = parseEstimate([page]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.spare_parts[0]).toMatchObject({ taxable_amount: 100, total_amount: 118, gst_percent: 18 });
  });

  it('a bare Tax column holding amounts gives taxable = total - tax', () => {
    const page = [
      ...line(700, [[20, 'Seq.'], [80, 'Description'], [300, 'Part'], [330, 'Amt'], [385, 'Qty'], [430, 'Tax'], [500, 'Total']]),
      ...line(680, [[20, '1'], [80, 'DOOR'], [302, '100.00'], [387, '1.0'], [430, '18.00'], [502, '118.00']]),
      ...line(670, [[20, '2'], [80, 'LAMP'], [302, '200.0'], [387, '1.0'], [430, '36.00'], [502, '236.00']]),
      ...line(620, [[20, 'Total'], [60, 'Amt'], [80, ':'], amt(300, '354.00')]),
    ];
    const o = parseEstimate([page]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.spare_parts[1]).toMatchObject({ taxable_amount: 200, total_amount: 236 });
  });

  describe('bare Tax value without a % sign', () => {
    const doc = (tax: string) => [
      ...line(700, [[20, 'Seq.'], [80, 'Description'], [300, 'Part'], [330, 'Amt'], [385, 'Qty'], [430, 'Tax'], [500, 'Total']]),
      ...line(680, [[20, '1'], [80, 'DOOR'], [302, '500.00'], [387, '1.0'], [430, tax], [502, '590.00']]),
      ...line(620, [[20, 'Total'], [60, 'Amt'], [80, ':'], amt(300, '590.00')]),
    ];
    it('a rate printed as "18" is read as the rate: taxable 500', () => {
      const o = parseEstimate([doc('18')]);
      if (!o.ok) throw new Error(o.reason);
      expect(o.data.spare_parts[0]).toMatchObject({ taxable_amount: 500, total_amount: 590, gst_percent: 18 });
    });
    it('an amount implying a GST rate (90 on 590) is read as the amount: taxable 500', () => {
      const o = parseEstimate([doc('90.00')]);
      if (!o.ok) throw new Error(o.reason);
      expect(o.data.spare_parts[0]).toMatchObject({ taxable_amount: 500, total_amount: 590, gst_percent: 18 });
    });
    it('a value that is neither a rate nor an amount for one (37) declines', () => {
      expect(parseEstimate([doc('37.00')]).ok).toBe(false);
    });
    it('a rate that is also an amount for a different rate (18 on 378) declines', () => {
      const page = doc('18');
      const amb = page.map(t => (t.s === '590.00' ? { ...t, s: '378.00' } : t));
      expect(parseEstimate([amb]).ok).toBe(false);
    });
  });

  it('a bare Tax column holding "18%" with a pre-tax Total ties through taxable', () => {
    const page = [
      ...line(700, [[20, 'Seq.'], [80, 'Description'], [300, 'Part'], [330, 'Amt'], [385, 'Qty'], [430, 'Tax'], [500, 'Total']]),
      ...line(680, [[20, '1'], [80, 'DOOR'], [302, '100.00'], [387, '1.0'], [430, '18%'], [502, '100.00']]),
      ...line(630, [[20, 'Sub'], [50, 'Total'], amt(300, '100.00')]),
      ...line(620, [[20, 'Grand'], [60, 'Total'], amt(300, '118.00')]),
    ];
    const o = parseEstimate([page]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.spare_parts[0]).toMatchObject({ taxable_amount: 100, total_amount: 118, gst_percent: 18 });
  });

  it('a SAC header keeps the SAC out of the Tax% column', () => {
    const page = [
      ...line(700, [[10, 'Srl'], [60, 'Description'], [150, 'SAC'], [200, 'Tax'], [220, '%'], [260, 'Qty.'], [330, 'Amount']]),
      ...line(680, [[10, '1'], [60, 'DENT'], [150, '998729'], [200, '18%'], [262, '1.0'], amt(360, '100.00')]),
      ...line(630, [[60, 'Sub'], [90, 'Total'], amt(360, '100.00')]),
      ...line(620, [[60, 'Grand'], [100, 'Total'], amt(360, '118')]),
    ];
    const o = parseEstimate([page]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.labour_items[0]).toMatchObject({ hsn_sac: '998729', gst_percent: 18 });
  });

  it('a subtotal printed 3pt below its label still counts as a labelled line', () => {
    const page = [
      ...line(700, [[10, 'Srl'], [60, 'Description'], [200, 'Qty.'], [260, 'Taxable'], [320, 'Tax%']]),
      ...line(680, [[10, '1'], [60, 'DOOR'], [205, '1'], amt(295, '100.00'), amt(340, '18')]),
      ...line(620, [[10, 'Part'], [40, 'Amt'], [100, 'Grand'], [140, 'Total'], amt(295, '118')]),
      ...line(617, [amt(200, '100.00')]),
    ];
    expect(parseEstimate([page]).ok).toBe(true);
  });

  it('rows above a repeated header on the same page continue the previous section', () => {
    const p0 = [...head(700), ...item(680, 1, 'DOOR', '100.00'), ...item(670, 2, 'LAMP', '200.00')];
    const p1 = [
      ...item(780, 3, 'WING', '100.00'), ...item(770, 4, 'BULB', '200.00'),
      ...line(740, [[60, 'Labour'], [100, 'Services']]),
      ...head(730), ...item(710, 1, 'DENT', '400.00', '998729'), ...item(700, 2, 'FIT', '100.00', '998729'),
      ...line(650, [[60, 'Sub'], [90, 'Total'], amt(295, '600.00'), amt(400, '500.00')]),
      ...line(630, [[60, 'Grand'], [100, 'Total'], amt(295, '1298')]),
    ];
    const o = parseEstimate([p0, p1]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.spare_parts.map(r => r.sr_no)).toEqual([1, 2, 3, 4]);
    expect(o.data.labour_items).toHaveLength(2);
  });

  it('continuation rows above a header with shifted columns use the earlier columns', () => {
    const shifted = line(730, [[10, 'Srl'], [60, 'Description'], [150, 'HSN'], [210, 'Qty.'], [300, 'Taxable'], [400, 'Tax%']]);
    const p0 = [...head(700), ...item(680, 1, 'DOOR', '100.00')];
    const p1 = [
      ...item(780, 2, 'WING', '200.00'),
      ...shifted, ...line(710, [[10, '1'], [60, 'DENT'], [150, '998729'], [220, '1'], amt(335, '300.00'), amt(420, '18')]),
      ...line(650, [[60, 'Sub'], [90, 'Total'], amt(295, '300.00'), amt(400, '300.00')]),
      ...line(630, [[60, 'Grand'], [100, 'Total'], amt(295, '708')]),
    ];
    const o = parseEstimate([p0, p1]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.spare_parts.map(r => r.taxable_amount)).toEqual([100, 200]);
  });

  it('a percentage printed beside the amount does not hide the amount', () => {
    const page = [
      ...line(700, [[10, 'Srl'], [60, 'Description'], [200, 'Tax%'], [260, 'Qty.'], [310, 'Ins'], [330, 'Share'], [350, 'Amount']]),
      ...line(680, [[10, '1'], [60, 'DOOR'], [200, '18%'], [262, '1.0'], [312, '100.00%'], amt(385, '100.00')]),
      ...line(620, [[60, 'Total'], amt(385, '100.00')]),
      ...line(600, [[60, 'Grand'], [100, 'Total'], amt(385, '118')]),
    ];
    const o = parseEstimate([page]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.gross_amount).toBe(118);
  });

  describe('Maruti: tax added under the section', () => {
    const maruti = (net: string, sub = '1,180.00') => [
      ...line(700, [[10, 'Srl.'], [60, 'Description'], [200, 'Qty.'], [250, 'Rate'], [300, 'Taxable'], [380, 'Labor']]),
      ...line(690, [[60, 'Parts']]),
      ...line(680, [[10, '1'], [60, 'BOLT'], amt(220, '2.000'), amt(270, '100.00'), amt(335, '200.00')]),
      ...line(670, [[10, '2'], [60, 'CLIP'], amt(220, '1.000'), amt(270, '100.00'), amt(335, '100.00')]),
      ...line(656, [[60, 'Labour']]),
      ...line(650, [[10, '1'], [60, 'DENTING'], amt(405, '1,000.00')]),
      ...line(620, [[60, 'Total'], [90, ':'], amt(335, '300.00'), amt(405, '1,000.00')]),
      ...line(610, [[200, 'CGST'], [230, '@'], [240, '9%'], amt(405, '90.00')]),
      ...line(600, [[200, 'Sub'], [230, 'Total'], amt(405, sub)]),
      ...line(590, [[60, 'Net'], [80, 'Estimate'], [130, 'Amounts'], amt(405, net)]),
    ];

    it('labour gets the one GST rate its with-tax subtotal implies; parts already include tax', () => {
      const o = parseEstimate([maruti('1,480.00')]);
      if (!o.ok) throw new Error(o.reason);
      expect(o.data.gross_amount).toBe(1480);
      expect(o.data.labour_items[0]).toMatchObject({ taxable_amount: 1000, total_amount: 1180, gst_percent: 18 });
      expect(o.data.spare_parts.map(r => [r.quantity, r.total_amount, r.gst_percent, r.taxable_amount])).toEqual([[2, 200, undefined, undefined], [1, 100, undefined, undefined]]);
    });

    it('no subtotal settling a rate declines', () => {
      expect(parseEstimate([maruti('1,480.00', '1,190.00')]).ok).toBe(false);
    });

    it('rows with no rate are not taken as tax-inclusive when no section shows tax being added', () => {
      const page = [
        ...line(700, [[10, 'Srl'], [60, 'Description'], [200, 'Qty.'], [300, 'Taxable']]),
        ...line(680, [[10, '1'], [60, 'BOLT'], amt(220, '1'), amt(335, '200.00')]),
        ...line(600, [[60, 'Gross'], [100, 'Amount'], amt(335, '200.00')]),   // may be pre-tax
      ];
      expect(reason(parseEstimate([page]))).toMatch(/no section shows tax/);
    });
  });

  it('Tata: headings stacked over several lines map amounts by where they right-align', () => {
    const page = [
      ...line(708, [[10, 'S']]),
      ...line(702, [[10, 'No'], [60, 'Particulars'], [200, 'Qty'], [250, 'Rate'], [300, 'Taxable'], [360, 'CGST'], [420, 'Total']]),
      ...line(696, [[305, 'Amt'], [345, 'Rate'], [370, 'Amount'], [420, 'Amt']]),
      ...line(690, [[346, '%'], [415, '(Incl.']]),
      ...line(684, [[415, 'Taxes)']]),
      ...line(660, [[10, '1'], [60, 'DOOR'], amt(215, '1'), amt(270, '100.00'), amt(335, '100.00'), amt(350, '9'), amt(400, '9.00'), amt(450, '118.00')]),
      ...line(640, [[10, '2'], [60, 'LAMP'], amt(215, '2'), amt(270, '50.00'), amt(335, '100.00'), amt(350, '9'), amt(400, '9.00'), amt(450, '118.00')]),
      ...line(600, [[60, 'Gross'], [100, 'Amount'], amt(450, '236.00')]),
    ];
    const o = parseEstimate([page]);
    if (!o.ok) throw new Error(o.reason);
    expect(o.data.spare_parts.map(r => [r.description, r.quantity, r.taxable_amount, r.total_amount, r.gst_percent])).toEqual([['DOOR', 1, 100, 118, 18], ['LAMP', 2, 100, 118, 18]]);
  });

  describe('Prabal Motors (BharatBenz DMS): stacked header, wrapped part no. and HSN', () => {
    // real pdf.js positions from the header and first two rows of a 13-page tax invoice
    const T = (a: Array<[string, number, number, number]>): PdfToken[] => a.map(([s, x, y, w]) => ({ s, x, y, w }));
    const page = T([["Parts",19.4,327.5,20],["Customer",269.3,316.7,28],["Total",308.5,316.7,14.3],["Unit",210.1,316.7,11.7],["HSN",143.6,313.3,12.7],["Customer",235.6,313.3,28],["Taxable",395.4,313.3,22.3],["Total",560.2,313.3,14.1],["Parts",577.1,313.3,14.1],["Bill",39.1,313.3,9.3],["Discount",366.8,313.3,25.7],["Description",95.1,313.3,31.7],["of",129.7,313.3,5.8],["Discount/",332.9,313.3,27.3],["UOM",183.2,310.7,14],["S.No.",20.2,309.9,15.3],["Part",62.8,309.9,11.5],["No.",77.2,309.9,8.6],["Unit",268.5,309.9,10.8],["Retail",282,309.9,16.2],["Retail",307.5,309.9,16.3],["CGST",434.2,309.9,16.7],["IGST",527,309.9,14],["Retail",207.7,309.9,16.3],["SGST/UTGST",468.9,309.9,38.3],["Qty.",165.8,309.1,11.7],["Code",142.4,306.5,15],["%",246.9,306.5,5.3],["Value",395.4,306.5,16],["Amount",564.3,306.5,22.7],["To",39.1,306.5,7.3],["%",377,306.5,5.3],["Goods",105.8,306.5,19],["Rebate",332.9,306.5,20],["Price",276,303.1,14.7],["Price",308.4,303.1,14.7],["Price",208.5,303.1,14.7],["Rate",423,293.2,13],["Rate",468.7,293.2,13],["Rate",514.1,293.2,13],["Amount",441,289.8,22.7],["Amount",486.6,289.8,22.7],["Amount",532.4,289.8,22.7],["(%)",424.8,286.3,9.3],["(%)",470.6,286.3,9.3],["(%)",515.9,286.3,9.3],
      ["HEX",94.4,277.2,12.1],["SCREW",110.6,277.2,20.2],["N000000005",57.1,270.4,34.4],["MBN",94.4,270.4,10.1],["10105-",107.9,270.4,20.2],["7318",143.2,270.4,13.3],["Piec",184.4,270.4,11.7],["1,686.4",398.2,270.4,20],["1",26.2,267,3.3],["PAID",39.1,267,14],["10",168.3,267,6.7],["168.64",211.1,267,18.3],["100",244.6,267,10],["0.00",286.8,267,11.7],["1,686.44",305.3,267,23.4],["0.00",342.5,267,11.7],["0",378,267,3.3],["9",427.8,267,3.3],["151.78",444.2,267,18.3],["9",473.6,267,3.3],["151.78",489.6,267,18.3],["0",518.9,267,3.3],["0.00",542.6,267,11.7],["1,990.00",568,267,23.4],["538",57.1,263.5,10],["M16X1,5X",94.4,263.5,25.6],["45-",123.2,263.5,9.6],["15",142.4,263.5,6],["00",151.4,263.5,6],["e",188.5,263.5,3.3],["4",414.9,263.5,3.3],["10.9",94.4,256.7,11.7],
      ["A401990215",57.1,246,34],["LU",94.4,246,7.9],["HEXAGON",106.2,246,27.5],["7318",143.2,246,13.3],["Piec",184.4,246,11.7],["2",26.2,242.6,3.3],["PAID",39.1,242.6,14],["5",170,242.6,3.3],["93.22",214.5,242.6,15],["100",244.6,242.6,10],["0.00",286.8,242.6,11.7],["466.10",310.3,242.6,18.3],["0.00",342.5,242.6,11.7],["0",378,242.6,3.3],["466.10",399.9,242.6,18.3],["9",427.8,242.6,3.3],["41.95",447.5,242.6,15],["9",473.6,242.6,3.3],["41.95",492.9,242.6,15],["0",518.9,242.6,3.3],["0.00",542.6,242.6,11.7],["550.00",573,242.6,18.3],["0",57.1,239.2,3.3],["NUT",94.4,239.2,9.5],["/",107.1,239.2,3.2],["M16X1.5",113.5,239.2,22.3],["16",142.4,239.2,6],["00",151.4,239.2,6],["e",188.5,239.2,3.3]]);

    it('keeps the Part No. column, the whole wrapped HSN and the row total apart', () => {
      const rows = rowsOf(readRows([page], true));
      expect(rows.map(r => [r.cells.part_number, r.cells.hsn_sac, r.cells.quantity, r.cells.taxable_amount, r.cells.total_amount])).toEqual([
        ['N000000005 538', '73181500', '10', '1,686.44', '1,990.00'],
        ['A401990215 0', '73181600', '5', '466.10', '550.00'],
      ]);
    });

    it('labour page: "Std Hrs" is the quantity, "SAC Code" the code, wrapped description stays whole', () => {
      const labour = T([["Labor",19.4,750.1,18.8],["and",42,750.1,11.3],["Job",57,750.1,11.3],["Work",72.1,750.1,15],["SAC",175.1,735.1,12.7],["Std",198.6,735.1,9.7],["Customer",234.5,735.1,28],["Customer",268.3,735.1,28],["Taxable",395.2,735.1,22.3],["Total",559.5,735.1,14.9],["Labor",577.3,735.1,14.9],["Bill",39.1,735.1,9.3],["Discount",366.5,735.1,25.7],["Discount/",331.9,735.1,27.3],["UOM",215,732.5,14],["S.No.",20.2,731.7,15.3],["Labor",58.2,731.7,16.7],["Code",78.2,731.7,13.3],["Total",300.2,731.7,14.5],["Rate",317.6,731.7,11.6],["CGST",434,731.7,16.7],["IGST",527.1,731.7,14],["Labor",104.7,731.7,15.6],["Description",123.4,731.7,34.3],["SGST/UTGST",468.7,731.7,38.3],["Code",174,728.3,15],["Hrs",198.5,728.3,10],["%",245.8,728.3,5.3],["Rate",275.8,728.3,13],["Value",395.2,728.3,16],["Amount",564.5,728.3,22.7],["To",39.1,728.3,7.3],["%",376.7,728.3,5.3],["Rebate",331.9,728.3,20],["Rate",422.8,714.3,13],["Rate",468.5,714.3,13],["Rate",514.2,714.3,13],["Amount",440.8,710.9,22.7],["Amount",486.4,710.9,22.7],["Amount",533,710.9,22.7],["(%)",424.6,707.5,9.3],["(%)",470.3,707.5,9.3],["(%)",516.1,707.5,9.3],
        ["Exhaust",95,695.4,20.8],["brake",118.8,695.4,14.9],["assembly",136.6,695.4,23.8],["Hou",216.5,695.4,11],["1",26.2,692,3.3],["PAID",39.1,692,14],["14202103",57.6,692,26.7],["998714",171.6,692,20],["1.2",199.3,692,8.3],["100",243.5,692,10],["660.00",279,692,18.3],["660.00",309.3,692,18.3],["0.00",341.9,692,11.7],["0.00",373.5,692,11.7],["660.00",399.7,692,18.3],["9",427.6,692,3.3],["59.40",447.3,692,15],["9",473.3,692,3.3],["59.40",492.7,692,15],["0",519.1,692,3.3],["0.00",543.2,692,11.7],["778.80",572.8,692,18.3],["Remove/install",95,688.6,37.3],["(on",135.1,688.6,8],["vehicle)",145.7,688.6,21.3],["rs",219.5,688.6,5],
        ["Hou",216.5,675.7,11],["Alternator",95,675.7,26.8],["Remove/install",124.5,675.7,37.5],["2",26.2,672.3,3.3],["PAID",39.1,672.3,14],["15101703",57.6,672.3,26.7],["998714",171.6,672.3,20],["1.5",199.3,672.3,8.3],["100",243.5,672.3,10],["825.00",279,672.3,18.3],["825.00",309.3,672.3,18.3],["0.00",341.9,672.3,11.7],["0.00",373.5,672.3,11.7],["825.00",399.7,672.3,18.3],["9",427.6,672.3,3.3],["74.25",447.3,672.3,15],["9",473.3,672.3,3.3],["74.25",492.7,672.3,15],["0",519.1,672.3,3.3],["0.00",543.2,672.3,11.7],["973.50",572.8,672.3,18.3],["rs",219.5,668.9,5],["(on",95,668.9,7.8],["vehicle)",105.4,668.9,20.7]]);
      const rows = rowsOf(readRows([page, labour], true)).filter(r => r.page === 1);
      expect(rows.map(r => [r.cells.description, r.cells.hsn_sac, r.cells.quantity, r.cells.taxable_amount, r.cells.total_amount])).toEqual([
        ['Exhaust brake assembly Remove/install (on vehicle)', '998714', '1.2', '660.00', '778.80'],
        ['Alternator Remove/install (on vehicle)', '998714', '1.5', '825.00', '973.50'],
      ]);
    });

    it('takes "Total Invoice Value" as the grand total', () => {
      const total = T([["Total",30,150,14],["Invoice",46,150,20],["Value(",68,150,18],["in",88,150,6],["figure):",96,150,20],["2,540.00",130,150,24],["Sub",30,180,10],["Total",42,180,14],["2,540.00",568,180,23.4]]);
      const o = parseEstimate([[...page, ...total]]);
      if (!o.ok) throw new Error(o.reason);
      expect(o.data.gross_amount).toBe(2540);
      expect(o.data.spare_parts.map(r => [r.part_number, r.hsn_sac, r.total_amount, r.gst_percent])).toEqual([['N000000005 538', '73181500', 1990, 18], ['A401990215 0', '73181600', 550, 18]]);
    });
  });

  it('joins "2,916.9" with a stray digit below, but not two one-decimal amounts', () => {
    const head = line(700, [[10, 'Srl'], [60, 'Description'], [200, 'Qty.'], [300, 'Total']]);
    const split = rowsOf(readRows([[...head, ...line(603, [[295, '2,916.9']]), ...line(600, [[10, '1'], [200, '1']]), ...line(597, [[325, '5']])]]));
    expect(split[0].cells.total_amount).toBe('2,916.95');
    const whole = rowsOf(readRows([[...head, ...line(603, [[10, '1'], [300, '496.0']]), ...line(594, [[10, '2'], [300, '992.0']])]]));
    expect(whole.map(r => r.cells.total_amount)).toEqual(['496.0', '992.0']);
  });

  it('joins "265.2"/"5" and "13,76"/"4.41" stacked at the same x, but not a lone "496.0" or a qty "1.5"', () => {
    const head = line(700, [[10, 'Srl'], [60, 'Description'], [200, 'Qty.'], [300, 'Total']]);
    const a = rowsOf(readRows([[...head, ...line(603, [[10, '1'], [300, '265.2']]), ...line(596, [[300, '5']])]]));
    expect(a[0].cells.total_amount).toBe('265.25');
    const b = rowsOf(readRows([[...head, ...line(603, [[10, '1'], [300, '13,76']]), ...line(596, [[300, '4.41']])]]));
    expect(b[0].cells.total_amount).toBe('13,764.41');
    const c = rowsOf(readRows([[...head, ...line(603, [[10, '1'], [200, '1.5'], [300, '496.0']]), ...line(583, [[10, '2'], [200, '1'], [300, '2']])]]));
    expect(c.map(r => [r.cells.quantity, r.cells.total_amount])).toEqual([['1.5', '496.0'], ['1', '2']]);
  });

  describe('Volkswagen Group: unnumbered estimate table with Type column', () => {
    const vwHead = (y = 700) => line(y, [
      [10, 'Type'], [50, 'Description'], [160, 'HSN\\SAC'], [230, 'Category'], [280, 'Qty'], [320, 'Unit Price'], [390, 'Amount'],
    ]);
    const vwRow = (y: number, type: string, desc: string, hsn: string, qty: string, price: string, amount: string) => line(y, [
      [10, type], [50, desc], [160, hsn], [230, 'Paid'], [285, qty], amt(360, price), amt(430, amount),
    ]);

    it('reads parts and labour when anchored by Type column without serial numbers', () => {
      const p0 = [
        ...vwHead(700),
        ...vwRow(680, 'Item', 'HOOD', '87089900', '1', '13733.05', '13733.05'),
        ...vwRow(660, 'Item', 'FENDER', '87089900', '1', '4517.80', '4517.80'),
        ...vwRow(640, 'Item', 'HEADLAMP', '85122010', '1', '8664.41', '8664.41'),
      ];
      const p1 = [
        ...vwRow(680, 'Labor', 'DENTING CHARGES', '00998729', '1', '2030.41', '2030.41'),
        ...vwRow(660, 'Labor', 'PAINTING CHARGES', '00998729', '1', '21191.03', '21191.03'),
        ...vwRow(640, 'Labor', 'REMOVING & REFITTING', '00998729', '1', '8304.89', '8304.89'),
        ...line(600, [[50, 'Service'], [90, 'Job'], [120, 'Total'], amt(430, '58441.59')]),
        ...line(580, [[50, 'Summary'], [100, 'Details']]),
        ...line(560, [[50, 'Details'], [100, 'Labor'], [130, 'Amount'], [170, 'Labor'], [200, 'Tax'], [240, 'Parts'], [270, 'Amount'], [310, 'Parts'], [340, 'Tax'], [380, 'Total']]),
        ...line(540, [[50, 'Jobs'], amt(140, '31526.33'), amt(210, '5674.74'), amt(280, '26915.26'), amt(350, '4844.75'), amt(430, '68961.08')]),
        ...line(520, [[50, 'Grand'], [90, 'Total'], amt(430, '68961.08')]),
      ];
      const o = parseEstimate([p0, p1]);
      if (!o.ok) throw new Error(o.reason);
      expect(o.data.spare_parts.length).toBe(3);
      expect(o.data.spare_parts[0]).toMatchObject({ description: 'HOOD', quantity: 1, taxable_amount: 13733.05, total_amount: 16205, gst_percent: 18 });
      expect(o.data.labour_items.length).toBe(2);
      expect(o.data.labour_items.map(r => r.description)).toEqual(['DENTING CHARGES', 'REMOVING & REFITTING']);
      expect(o.data.painting_items.length).toBe(1);
      expect(o.data.painting_items[0].description).toBe('PAINTING CHARGES');
      expect(o.data.gross_amount).toBe(68961.08);
    });

    it('reads all 33 rows from 2-page Volkswagen Dhule estimate (SOA2600192) and ties to exact grand total', () => {
      const p1Rows: Array<[string, string, string, string, string]> = [
        ['HOOD', '87089900', '1', '13733.05', '13733.05'],
        ['FENDER', '87089900', '1', '4517.80', '4517.80'],
        ['HEADLAMP', '85122010', '1', '8664.41', '8664.41'],
        ['MOUNTING', '87089900', '1', '404.24', '404.24'],
        ['MOUNTING', '87089900', '1', '417.80', '417.80'],
        ['COVER', '87081090', '1', '1790.68', '1790.68'],
        ['RETAINER', '87081090', '1', '1294.07', '1294.07'],
        ['CARRIER', '87089900', '1', '4354.24', '4354.24'],
        ['WHEEL HOUS', '87089900', '1', '665.25', '665.25'],
        ['WHEEL HOUS', '87089900', '1', '684.75', '684.75'],
        ['BEAM', '87089900', '1', '2930.51', '2930.51'],
        ['MEMBER', '87089900', '1', '1322.03', '1322.03'],
        ['BOLT', '73181500', '2', '41.53', '83.05'],
        ['BOLT', '73181500', '1', '43.22', '43.22'],
        ['BOLT', '73181500', '1', '56.78', '56.78'],
        ['HEADLIGHT', '85122010', '1', '2455.93', '2455.93'],
        ['HEADLIGHT', '85122010', '1', '2455.93', '2455.93'],
        ['COVER', '87081090', '1', '1238.14', '1238.14'],
        ['COVER', '87081090', '1', '1273.73', '1273.73'],
        ['GRILLE', '87089900', '1', '1914.41', '1914.41'],
        ['GRILLE', '87081090', '1', '1764.41', '1764.41'],
        ['WATER RES.', '87089900', '1', '949.15', '949.15'],
        ['PIPE HOLDE', '87089900', '1', '379.66', '379.66'],
        ['TENSIONER', '84835090', '1', '6417.80', '6417.80'],
        ['CLIP', '73182990', '4', '106.78', '427.12'],
        ['REPAIR KIT', '87089900', '1', '2131.36', '2131.36'],
        ['BOLT', '73181500', '15', '81.36', '1220.34'],
      ];
      const p0 = [
        ...vwHead(700),
        ...p1Rows.flatMap((r, idx) => vwRow(680 - idx * 15, 'Item', r[0], r[1], r[2], r[3], r[4])),
      ];

      const p2Items: Array<[string, string, string, string, string]> = [
        ['REPAIR KIT', '87089900', '1', '2131.36', '2131.36'],
        ['COVER', '87081090', '1', '105.93', '105.93'],
        ['COOLER', '87089900', '1', '2918.64', '2918.64'],
      ];
      const p2Labor: Array<[string, string, string, string, string]> = [
        ['DENTING CHARGES', '00998729', '1', '2030.41', '2030.41'],
        ['PAINTING CHARGES', '00998729', '1', '21191.03', '21191.03'],
        ['REMOVING & REFITTING', '00998729', '1', '8304.89', '8304.89'],
      ];
      const p1 = [
        ...p2Items.flatMap((r, idx) => vwRow(680 - idx * 15, 'Item', r[0], r[1], r[2], r[3], r[4])),
        ...p2Labor.flatMap((r, idx) => vwRow(635 - idx * 15, 'Labor', r[0], r[1], r[2], r[3], r[4])),
        ...line(560, [[50, 'Service'], [90, 'Job'], [120, 'Total'], amt(430, '100272.12')]),
        ...line(540, [[50, 'Summary'], [100, 'Details']]),
        ...line(520, [[50, 'Details'], [100, 'Labor'], [130, 'Amount'], [170, 'Labor'], [200, 'Tax'], [240, 'Parts'], [270, 'Amount'], [310, 'Parts'], [340, 'Tax'], [380, 'Total']]),
        ...line(500, [[50, 'Jobs'], amt(140, '31526.33'), amt(210, '5674.74'), amt(280, '68745.79'), amt(350, '12374.20'), amt(430, '118321.06')]),
        ...line(480, [[50, 'Grand'], [90, 'Total'], amt(430, '118321.06')]),
      ];

      const o = parseEstimate([p0, p1]);
      if (!o.ok) throw new Error(o.reason);
      expect(o.data.spare_parts.length).toBe(30);
      expect(o.data.labour_items.length).toBe(2);
      expect(o.data.painting_items.length).toBe(1);
      expect(o.data.painting_items[0].description).toBe('PAINTING CHARGES');
      expect(o.data.gross_amount).toBe(118321.06);
      const partsTaxableSum = o.data.spare_parts.reduce((s, r) => s + (r.taxable_amount ?? 0), 0);
      expect(Math.round(partsTaxableSum * 100) / 100).toBe(68745.79);
      const laborTaxableSum = o.data.labour_items.reduce((s, r) => s + (r.taxable_amount ?? 0), 0);
      expect(Math.round(laborTaxableSum * 100) / 100).toBe(10335.30);
      const paintingTaxableSum = o.data.painting_items.reduce((s, r) => s + (r.taxable_amount ?? 0), 0);
      expect(Math.round(paintingTaxableSum * 100) / 100).toBe(21191.03);
    });

  });
});

describe('learned layout (stacked two-table bill the built-in rules do not know)', () => {
  const headWords = (toks: PdfToken[]) => { const bottom = Math.min(...toks.map(t => t.y)); return toks.map(t => ({ s: t.s, x: t.x, dy: t.y - bottom })); };
  const layout = [
    { words: headWords(labourHead), cols: [
      { field: 'sr_no' as const, x: 46, right: 51 }, { field: 'description' as const, x: 60, right: 95 }, { field: 'hsn_sac' as const, x: 293, right: 333 },
      { field: 'quantity' as const, x: 353, right: 373 }, { field: 'taxable_amount' as const, x: 433, right: 463 }, { field: 'total_amount' as const, x: 546, right: 576 }] },
    { words: headWords(partsHead), cols: [
      { field: 'sr_no' as const, x: 43, right: 48 }, { field: 'description' as const, x: 58, right: 78 }, { field: 'part_number' as const, x: 157, right: 207 },
      { field: 'hsn_sac' as const, x: 252, right: 292 }, { field: 'quantity' as const, x: 313, right: 333 }, { field: 'unit_price' as const, x: 337, right: 362 },
      { field: 'taxable_amount' as const, x: 424, right: 449 }, { field: 'total_amount' as const, x: 546, right: 571 }] },
  ];

  it('the built-in rules decline it', () => {
    expect(parseEstimate([page]).ok).toBe(false);
  });
  it('with the learned layout every row is read and ties, each table with its own columns', () => {
    const r = parseEstimate([page], layout);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.labour_items.map(i => [i.description, i.hsn_sac, i.taxable_amount, i.total_amount])).toEqual([['DENTING', '00998729', 100, 118], ['REFITTING', '00998729', 200, 236]]);
    expect(r.data.spare_parts.map(i => [i.description, i.part_number, i.hsn_sac, i.quantity, i.unit_price, i.total_amount])).toEqual([['HOOD', '6R0823031G', '87089900', 1, 50, 59], ['FENDER', '6RG821106J', '87089900', 2, 25, 59]]);
    expect(r.data.gross_amount).toBe(472);
  });
  it('a layout whose headings are not on the page reads nothing', () => {
    expect(parseEstimate([page], [{ ...layout[0], words: layout[0].words.map(w => ({ ...w, x: w.x + 50 })) }]).ok).toBe(false);
  });
});

// BharatBenz (Prabal) estimate: MRP-inclusive parts, then a LABOUR table on the same page
// whose rows already include 18% GST, each rounded to the rupee.
describe('tax-included estimate with a labour table under the parts total', () => {
  const amt = (right: number, s: string): [number, string] => [right - s.length * 5, s];
  const head = (y: number) => line(y, [[10, 'Sr'], [25, 'No'], [60, 'Part'], [85, 'No'], [140, 'Description'], [260, 'Qty'], [300, 'MRP'], [360, 'MRP'], [390, 'Total']]);
  const part = (y: number, sr: number, desc: string, total: string) =>
    line(y, [[10, String(sr)], [60, 'A40040' + sr], [140, desc], [262, '1'], amt(330, total), amt(420, total)]);
  const labour = (y: number, sr: number, desc: string, total: string) =>
    line(y, [[10, String(sr)], [60, '4311' + sr], [140, desc], amt(420, total)]);
  // bases 120, 220 … 820 at 18% print 142, 260 … 968: rows add to 4,440, the footer's 3,760 + 18% is 4,437
  const labourTotals = ['142', '260', '378', '496', '614', '732', '850', '968'];
  const doc = () => [
    ...line(720, [[10, 'PARTS']]),
    ...head(710),
    ...part(690, 1, 'WHEEL NUT', '1,000'),
    ...part(675, 2, 'VENT LINE', '590'),
    ...line(660, [[260, 'Total'], [290, 'Parts'], [320, 'Amt'], amt(420, '1590')]),
    ...line(600, [[10, 'LABOUR']]),
    ...head(590),
    ...labourTotals.flatMap((t, i) => labour(570 - i * 12, i + 1, 'REMOVE REFIT ' + (i + 1), t)),
    ...line(460, [[60, 'Total'], amt(330, '3,760'), amt(420, '4,437')]),
    ...line(445, [[60, 'Final'], [90, 'Amount'], amt(420, '6027')]),
  ];
  const reason = (o: ReturnType<typeof parseEstimate>) => (o.ok ? '' : o.reason);

  it('the last parts row does not take in the parts total printed under it', () => {
    const rows = rowsOf(readRows([doc()]));
    expect(rows[1].cells.total_amount).toBe('590');
  });

  it('reads both sections: rows include tax, shown by the labour footer adding 18% to its base', () => {
    const o = parseEstimate([doc()]);
    expect(reason(o)).toBe('');
    if (!o.ok) return;
    expect(o.data.spare_parts.map(r => r.total_amount)).toEqual([1000, 590]);
    expect(o.data.labour_items).toHaveLength(8);
    expect(o.data.labour_items[0]).toMatchObject({ sr_no: 1, total_amount: 142 });
    expect(o.data.labour_items[0].taxable_amount).toBeUndefined();
  });

  it('labour rows off the footer by more than rounding still decline', () => {
    const bad = doc().map(t => (t.s === '968' ? { ...t, s: '998' } : t));
    expect(parseEstimate([bad]).ok).toBe(false);
  });

  it('without a footer that shows tax being added, tax-free rows still decline', () => {
    const noTaxShown = doc().map(t => (t.s === '3,760' ? { ...t, s: '4,437' } : t));
    expect(reason(parseEstimate([noTaxShown]))).toContain('tax');
  });
});

// BharatBenz prints descriptions starting under the Part No heading: "A4004014172 LU WHEEL" | "NUT / M22X2.5X33"
describe('part number cell with description words', () => {
  const amt = (right: number, s: string): [number, string] => [right - s.length * 5, s];
  const head = line(700, [[10, 'Srl'], [60, 'Part'], [85, 'No'], [200, 'Description'], [320, 'Qty'], [380, 'Taxable'], [440, 'Tax%']]);
  const row = (y: number, sr: number, pnWords: string[], desc: string, taxable: string) =>
    line(y, [[10, String(sr)], ...pnWords.map((w, i): [number, string] => [60 + i * 40, w]), [200, desc], [322, '1'], amt(415, taxable), amt(460, '18')]);
  const parse = (rows: PdfToken[]) => {
    const o = parseEstimate([[...head, ...rows, ...line(600, [[60, 'Grand'], [100, 'Total'], amt(460, '354')])]]);
    if (!o.ok) throw new Error(o.reason);
    return o.data.spare_parts;
  };

  it('moves plain words beside a single code into the description', () => {
    const [a, b] = parse([...row(680, 1, ['A4004014172', 'LU', 'WHEEL'], 'NUT', '100.00'), ...row(670, 2, ['Reverse', '58508097'], 'CAMERA', '200.00')]);
    expect(a).toMatchObject({ part_number: 'A4004014172', description: 'LU WHEEL NUT' });
    expect(b).toMatchObject({ part_number: '58508097', description: 'Reverse CAMERA' });
  });

  it('leaves a spaced part number and a number with several digit pieces alone', () => {
    const [a, b] = parse([...row(680, 1, ['A', '0009892603'], 'SEAL', '100.00'), ...row(670, 2, ['N913023', 'M6'], 'NUT', '200.00')]);
    expect(a.part_number).toBe('A 0009892603');
    expect(b).toMatchObject({ part_number: 'N913023 M6', description: 'NUT' });
  });
});
