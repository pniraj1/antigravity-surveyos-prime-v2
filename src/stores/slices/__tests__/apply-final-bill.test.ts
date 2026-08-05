import { describe, expect, test } from 'vitest';
import { applyFinalBill } from '../aiDataSlice';
import type { ClaimData } from '@/types';
import type { AssessmentRow } from '@/types/assessment';

function row(overrides: Partial<AssessmentRow> = {}): AssessmentRow {
  return {
    id: `r${Math.random()}`,
    particulars: 'FRONT BUMPER',
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
