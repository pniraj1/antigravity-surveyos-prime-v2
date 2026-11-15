import { describe, expect, test } from 'vitest';
import { matchBillItemsToRows, buildBillItems } from '../aiDataSlice';
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

describe('matchBillItemsToRows', () => {
  // D1 (Bill Check reference finder): a ref is written on an exact part number
  // only. Word, amount and section matching moved to the surveyor's panel.
  test('matches on part number regardless of formatting', () => {
    const rows = [row({ id: 'r1', partNumber: '56100-0R190' })];
    const bill = buildBillItems({ spare_parts: [{ part_number: '561000R190', total_amount: 11800 }] });
    expect(matchBillItemsToRows(rows, bill).get('r1')?.reason).toBe('part');
  });

  test('leaves a genuinely new item unmatched', () => {
    const rows = [row({ id: 'r1', particulars: 'FRONT BUMPER' })];
    const bill = buildBillItems({ spare_parts: [{ description: 'RADIATOR ASSY', taxable_amount: 6000, total_amount: 7080 }] });
    expect(matchBillItemsToRows(rows, bill).has('r1')).toBe(false);
  });

  test('words alone never match', () => {
    const rows = [row({ id: 'r1', particulars: 'FRONT BUMPER' })];
    const bill = buildBillItems({ spare_parts: [{ description: 'BUMPER FRONT', total_amount: 11800 }] });
    expect(matchBillItemsToRows(rows, bill).size).toBe(0);
  });

  test('different part numbers never match even with identical words', () => {
    const rows = [row({ id: 'r1', particulars: 'HEX SCREW', partNumber: 'N910105006013' })];
    const bill = buildBillItems({ spare_parts: [{ description: 'HEX SCREW', part_number: 'N910105008026', total_amount: 100 }] });
    expect(matchBillItemsToRows(rows, bill).size).toBe(0);
  });

  test('one row, three lines: first line plus also', () => {
    const rows = [row({ id: 'r1', partNumber: 'A0019901167' })];
    const bill = buildBillItems({ spare_parts: [61, 65, 71].map(sr_no => ({ sr_no, part_number: 'A0019901167', total_amount: 142 })) });
    const m = matchBillItemsToRows(rows, bill).get('r1')!;
    expect(m.bill.srNo).toBe(61);
    expect(m.also?.map(b => b.srNo)).toEqual([65, 71]);
  });

  test('two rows, one line: second row shares the ref, refOnly', () => {
    const rows = [row({ id: 'a', srNo: 36, partNumber: 'MBBC0076' }), row({ id: 'b', srNo: 193, partNumber: 'MBBC0076' })];
    const bill = buildBillItems({ spare_parts: [{ sr_no: 260, part_number: 'MBBC0076', total_amount: 2200 }] });
    const m = matchBillItemsToRows(rows, bill);
    expect(m.get('a')?.refOnly).toBeFalsy();
    expect(m.get('b')?.refOnly).toBe(true);
    expect(m.get('b')?.bill.srNo).toBe(260);
  });

  test('two rows, three lines: paired in order, third line unmatched', () => {
    const rows = [row({ id: 'a', srNo: 1, partNumber: 'P1' }), row({ id: 'b', srNo: 2, partNumber: 'P1' })];
    const bill = buildBillItems({ spare_parts: [10, 11, 12].map(sr_no => ({ sr_no, part_number: 'P1', total_amount: 1 })) });
    const m = matchBillItemsToRows(rows, bill);
    expect([m.get('a')?.bill.srNo, m.get('b')?.bill.srNo]).toEqual([10, 11]);
  });
});
