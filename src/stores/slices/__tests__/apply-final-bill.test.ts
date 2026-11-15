import { describe, expect, test } from 'vitest';
import { applyFinalBill, buildBillModePrompt } from '../aiDataSlice';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'FRONT BUMPER',
    partNumber: 'BP-1',
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

function claim(rows: AssessmentRow[], extras: ClaimData['extraBillItems'] = []): ClaimData {
  return { id: 'c1', assessmentRows: rows, extraBillItems: extras } as unknown as ClaimData;
}

const BILL = {
  bill_number: 'B1',
  bill_date: '2026-08-01',
  total_amount: 18880,
  spare_parts: [
    { description: 'FRONT BUMPER', part_number: 'BP-1', taxable_amount: 10000, total_amount: 11800, gst_percent: 18 },
    { description: 'RADIATOR ASSY', part_number: 'RD-9', taxable_amount: 6000, total_amount: 7080, gst_percent: 18 },
  ],
};

describe('applyFinalBill', () => {
  test('carries the taxable basis onto the matched row', () => {
    const r = row({ id: 'r1' });
    const out = applyFinalBill(claim([r]), BILL);
    const matched = out.assessmentRows.find(x => x.id === 'r1')!;
    expect(matched.billedTaxable).toBe(10000);
    expect(matched.billedAmount).toBe(11800);
    expect(matched.billStatus).toBe('in-bill');
  });

  test('keeps the full bill data on an unmatched item so it can be promoted', () => {
    const out = applyFinalBill(claim([row({ id: 'r1' })]), BILL);
    const extra = out.extraBillItems!.find(e => e.description === 'RADIATOR ASSY')!;
    expect(extra.taxableAmount).toBe(6000);
    expect(extra.gstPercent).toBe(18);
    expect(extra.partNumber).toBe('RD-9');
    expect(extra.section).toBe('parts');
  });

  test('re-uploading the same bill does not duplicate an extra', () => {
    // Wholesale overwrite plus a Date.now() id meant every upload produced a
    // fresh set. Ids are now content-derived, so a repeat is recognised.
    const first = applyFinalBill(claim([row({ id: 'r1' })]), BILL);
    const second = applyFinalBill(first as ClaimData, BILL);
    expect(second.extraBillItems).toHaveLength(1);
  });

  test('a second bill upload keeps the extras from the first', () => {
    // Split bills: page 2 must not wipe page 1's findings.
    const page1 = applyFinalBill(claim([row({ id: 'r1' })]), BILL);
    const page2 = {
      bill_number: 'B1',
      spare_parts: [{ description: 'FOG LAMP', part_number: 'FL-2', taxable_amount: 2000, total_amount: 2360, gst_percent: 18 }],
    };
    const merged = applyFinalBill(page1 as ClaimData, page2);
    const names = merged.extraBillItems!.map(e => e.description);
    expect(names).toContain('RADIATOR ASSY');
    expect(names).toContain('FOG LAMP');
  });

  test('an item already promoted to a row is not re-added as an extra', () => {
    // The damaging case, and it self-heals: promotion carries the part number,
    // so the next upload matches the row instead of flagging it again.
    const promoted = row({ id: 'r2', particulars: 'RADIATOR ASSY', partNumber: 'RD-9', assessed: 0, estimated: 0, allowed: false });
    const out = applyFinalBill(claim([row({ id: 'r1' }), promoted]), BILL);
    expect(out.extraBillItems).toHaveLength(0);
  });

  test('a newly appearing item is still added on re-upload', () => {
    const first = applyFinalBill(claim([row({ id: 'r1' })]), BILL);
    const withNew = {
      ...BILL,
      spare_parts: [...BILL.spare_parts, { description: 'FOG LAMP', part_number: 'FL-2', taxable_amount: 2000, total_amount: 2360, gst_percent: 18 }],
    };
    const second = applyFinalBill(first as ClaimData, withNew);
    expect(second.extraBillItems!.some(e => e.description === 'FOG LAMP')).toBe(true);
  });
});

describe('applyFinalBill — reference finder rules', () => {
  const line = (sr_no: number, part_number: string, taxable_amount: number, total_amount: number) =>
    ({ sr_no, description: 'X', part_number, taxable_amount, total_amount, gst_percent: 18 });

  test('manual row untouched and its line not re-listed', () => {
    const held = { id: 'extra-parts-P12-1062', description: 'X', amount: 1062, taxableAmount: 900, gstPercent: 18, section: 'parts' as const, source: 'final-bill' as const, partNumber: 'P12', srNo: 12 };
    const r = row({ id: 'r1', partNumber: 'P12', refStatus: 'manual', refSrNo: 12, billedAmount: 500, billStatus: 'in-bill', refMatch: { bill: held, score: 100, reasons: ['Linked by you'] } });
    const out = applyFinalBill(claim([r]), { spare_parts: [line(12, 'P12', 900, 1062), line(13, 'Q13', 50, 59)] });
    expect(out.assessmentRows[0]).toEqual(r);
    expect(out.extraBillItems!.map(e => e.srNo)).toEqual([13]);
  });

  test('one row, three lines: amounts summed, serials joined', () => {
    const r = row({ id: 'r1', partNumber: 'A0019901167' });
    const out = applyFinalBill(claim([r]), { spare_parts: [61, 65, 71].map(sr => line(sr, 'A0019901167', 142, 168)) });
    const m = out.assessmentRows[0];
    expect(m.billedTaxable).toBe(426);
    expect(m.billedAmount).toBe(504);
    expect(m.refSrNo).toBe('61, 65, 71');
    expect(out.extraBillItems).toEqual([]);
  });

  test('refOnly row gets the ref and no billed figures', () => {
    const a = row({ id: 'a', srNo: 36, partNumber: 'MBBC0076' });
    const b = row({ id: 'b', srNo: 193, partNumber: 'MBBC0076', billStatus: 'pending' });
    const out = applyFinalBill(claim([a, b]), { spare_parts: [line(260, 'MBBC0076', 2200, 2596)] });
    const second = out.assessmentRows.find(x => x.id === 'b')!;
    expect(second.refSrNo).toBe(260);
    expect(second.billedAmount).toBeUndefined();
    expect(second.billStatus).toBe('pending');
  });

  test('no part numbers → no row billed, every line unmatched', () => {
    const r = row({ id: 'r1', partNumber: undefined, billStatus: 'pending' });
    const out = applyFinalBill(claim([r]), { spare_parts: [{ description: 'FRONT BUMPER', taxable_amount: 10000, total_amount: 11800 }, { description: 'GRILLE', taxable_amount: 500, total_amount: 590 }] });
    expect(out.assessmentRows[0].billStatus).toBe('pending');
    expect(out.extraBillItems).toHaveLength(2);
  });
});

describe('applyFinalBill — review fixes', () => {
  const line = (sr_no: number, part_number: string, taxable_amount: number, total_amount: number) =>
    ({ sr_no, description: 'X', part_number, taxable_amount, total_amount, gst_percent: 18 });
  const held = (id: string, partNumber: string, srNo: number) =>
    ({ id, description: 'X', amount: 1, taxableAmount: 1, gstPercent: 18, section: 'parts' as const, source: 'final-bill' as const, partNumber, srNo });

  test("a manual row's line is not given to a sibling row", () => {
    const a = row({ id: 'a', srNo: 36, partNumber: 'MBBC0076', refStatus: 'manual', refSrNo: 260, refMatch: { bill: held('extra-parts-MBBC0076-2596', 'MBBC0076', 260), score: 100, reasons: [] } });
    const b = row({ id: 'b', srNo: 193, partNumber: 'MBBC0076', billStatus: 'pending' });
    const out = applyFinalBill(claim([a, b]), { spare_parts: [line(260, 'MBBC0076', 2200, 2596)] });
    const sib = out.assessmentRows.find(x => x.id === 'b')!;
    expect(sib.billedAmount).toBeUndefined();
    expect(sib.refSrNo).toBeUndefined();
    expect(out.extraBillItems).toEqual([]);
  });

  test('a typed ref without its line does not hide a different line', () => {
    const r = row({ id: 'r1', partNumber: 'P1', refStatus: 'manual', refSrNo: 12 });
    const out = applyFinalBill(claim([r]), { spare_parts: [line(12, 'Q13', 50, 59)] });
    expect(out.extraBillItems!.map(e => e.srNo)).toEqual([12]);
  });

  test('the allowed row takes the money before a disallowed duplicate', () => {
    const d = row({ id: 'd', srNo: 1, partNumber: 'P', allowed: false });
    const a = row({ id: 'a', srNo: 2, partNumber: 'P' });
    const out = applyFinalBill(claim([d, a]), { spare_parts: [line(9, 'P', 100, 118)] });
    expect(out.assessmentRows.find(x => x.id === 'a')!.billedAmount).toBe(118);
    expect(out.assessmentRows.find(x => x.id === 'd')!.billedAmount).toBeUndefined();
  });

  test('refMatch keeps every line of a repeated part, and marks refOnly', () => {
    const one = applyFinalBill(claim([row({ id: 'r1', partNumber: 'A0019901167' })]), { spare_parts: [61, 65, 71].map(sr => line(sr, 'A0019901167', 142, 168)) });
    expect(one.assessmentRows[0].refMatch?.also?.map(b => b.srNo)).toEqual([65, 71]);
    const two = applyFinalBill(claim([row({ id: 'a', srNo: 1, partNumber: 'M' }), row({ id: 'b', srNo: 2, partNumber: 'M' })]), { spare_parts: [line(260, 'M', 1, 1)] });
    expect(two.assessmentRows.find(x => x.id === 'b')!.refMatch?.refOnly).toBe(true);
  });
});

describe('applyFinalBill — claim built from the bill (estimate upload)', () => {
  const fromBill = (c: ClaimData): ClaimData => ({
    ...c,
    billCheck: { baseDocument: 'final-bill', billNo: 'B-REAL', billDate: '2026-05-01', billTotal: 99999 },
  } as ClaimData);
  // Line amounts differ from the row's own figures, so a pass proves the row's were kept.
  const EST = {
    bill_number: 'E1',
    total_amount: 1,
    spare_parts: [
      { description: 'FRONT BUMPER', part_number: 'BP-1', taxable_amount: 9000, total_amount: 10620, gst_percent: 18 },
      { description: 'RADIATOR ASSY', part_number: 'RD-9', taxable_amount: 6000, total_amount: 7080, gst_percent: 18 },
    ],
  };

  test('an estimate upload writes the ref but not the billed figures', () => {
    const out = applyFinalBill(fromBill(claim([row({ id: 'r1', billedTaxable: 10000, billedAmount: 11800 })])), EST);
    const m = out.assessmentRows[0];
    expect(m.refSrNo).toBeDefined();
    expect(m.refStatus).toBe('clean');
    expect(m.billedTaxable).toBe(10000);
    expect(m.billedAmount).toBe(11800);
  });

  test('an estimate upload leaves the bill no., date and total', () => {
    const out = applyFinalBill(fromBill(claim([row({ id: 'r1' })])), EST);
    expect(out.billCheck?.billNo).toBe('B-REAL');
    expect(out.billCheck?.billDate).toBe('2026-05-01');
    expect(out.billCheck?.billTotal).toBe(99999);
  });

  test('a disallowed row matched by an estimate gets only the ref', () => {
    const out = applyFinalBill(fromBill(claim([row({ id: 'r1', allowed: false })])), EST);
    expect(out.assessmentRows[0].refSrNo).toBeDefined();
    expect(out.assessmentRows[0].billStatus).toBeUndefined();
    expect(out.assessmentRows[0].billRemarks).toBeUndefined();
  });

  test('continue in from-bill mode keeps refs already set and matches the rest', () => {
    const a = row({ id: 'A', partNumber: 'ZZ-0', refSrNo: '7', refStatus: 'clean' });
    const b = row({ id: 'B', partNumber: 'RD-9' });
    const out = applyFinalBill(fromBill(claim([a, b])), EST, 'continue');
    expect(out.assessmentRows.find(r => r.id === 'A')!.refSrNo).toBe('7');
    expect(out.assessmentRows.find(r => r.id === 'B')!.refSrNo).toBe(2);
  });

  test('buildBillModePrompt counts rows with refs in from-bill mode', () => {
    const c = fromBill(claim([row({ id: 'a', refSrNo: '1' }), row({ id: 'b', billedAmount: 500 }), row({ id: 'c' })]));
    expect(buildBillModePrompt(c)).toEqual({ billNo: '', billedRows: 1 });
    expect(buildBillModePrompt(fromBill(claim([row()])))).toBeNull();
  });

  test('an estimate match records the amount of the estimate', () => {
    const out = applyFinalBill(fromBill(claim([row({ id: 'r1' })])), EST);
    expect(out.assessmentRows[0].estimateAmount).toBe(9000);
    const two = applyFinalBill(fromBill(claim([row({ id: 'r1' }), row({ id: 'r2' })])), EST);
    const withAmt = two.assessmentRows.filter(r => r.estimateAmount !== undefined);
    expect(withAmt).toHaveLength(1);
    expect(two.assessmentRows.find(r => r.refMatch?.refOnly)!.estimateAmount).toBeUndefined();
  });

  test('an estimate upload clears confirmed estimate heads', () => {
    const c = fromBill(claim([row({ id: 'r1' })]));
    const withHeads = { ...c, billCheck: { ...c.billCheck!, estimateHeads: { metal: 1, plastic: 0, glass: 0, fiberglass: 0, labour: 0, paint: 0 } } };
    expect(applyFinalBill(withHeads, EST).billCheck?.estimateHeads).toBeUndefined();
  });

  test('a metal/plastic/glass line category survives onto its extra', () => {
    const out = applyFinalBill(fromBill(claim([])), {
      spare_parts: [{ description: 'HEAD LAMP', part_number: 'HL-1', taxable_amount: 100, total_amount: 118, category: 'Plastic' }],
    });
    expect(out.extraBillItems![0].material).toBe('plastic');
  });
});
