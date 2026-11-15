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

  describe('labour and paint by identical wording', () => {
    const lab = (o: Partial<AssessmentRow>) => row({ section: 'labour', ...o });

    test('identical labour wording matches, ignoring case and punctuation', () => {
      const rows = [lab({ id: 'r1', particulars: 'FRONT BUMPER R&R' })];
      const bill = buildBillItems({ labour_items: [{ sr_no: 4, description: 'front bumper r & r', total_amount: 500 }] });
      const m = matchBillItemsToRows(rows, bill).get('r1');
      expect(m?.reason).toBe('words');
      expect(m?.reasons).toEqual(['Same wording']);
      expect(m?.score).toBe(100);
      expect(m?.ambiguous).toBe(false);
      expect(m?.bill.srNo).toBe(4);
    });

    test('different wording stays unmatched', () => {
      const rows = [lab({ id: 'r1', particulars: 'R/R BUMPER FRT' })];
      const bill = buildBillItems({ labour_items: [{ description: 'BUMPER FRONT REMOVE & REFIT', total_amount: 500 }] });
      expect(matchBillItemsToRows(rows, bill).size).toBe(0);
    });

    test('parts are never matched by wording', () => {
      const rows = [row({ id: 'r1', particulars: 'FRONT BUMPER' })];
      const bill = buildBillItems({ spare_parts: [{ description: 'FRONT BUMPER', total_amount: 500 }] });
      expect(matchBillItemsToRows(rows, bill).size).toBe(0);
    });

    test('a labour row with a part number is not wording-matched', () => {
      const rows = [lab({ id: 'r1', particulars: 'FITTING', partNumber: 'X1' })];
      const bill = buildBillItems({ labour_items: [{ description: 'FITTING', total_amount: 500 }] });
      expect(matchBillItemsToRows(rows, bill).size).toBe(0);
    });

    test('repeated labour wording pairs in serial order', () => {
      const rows = [lab({ id: 'a', srNo: 3, particulars: 'LABOUR CHARGES' }), lab({ id: 'b', srNo: 9, particulars: 'LABOUR CHARGES' })];
      const bill = buildBillItems({ labour_items: [{ sr_no: 41, description: 'LABOUR CHARGES', total_amount: 1 }, { sr_no: 20, description: 'LABOUR CHARGES', total_amount: 1 }] });
      const m = matchBillItemsToRows(rows, bill);
      expect([m.get('a')?.bill.srNo, m.get('b')?.bill.srNo]).toEqual([20, 41]);
    });

    test('a line used by a part-number match is not reused by wording', () => {
      const rows = [
        lab({ id: 'p', partNumber: 'P1', particulars: 'PAINT WORK' }),
        lab({ id: 'w', particulars: 'PAINT WORK' }),
      ];
      const bill = buildBillItems({ labour_items: [{ sr_no: 1, part_number: 'P1', description: 'PAINT WORK', total_amount: 1 }] });
      const m = matchBillItemsToRows(rows, bill);
      expect(m.get('p')?.reason).toBe('part');
      expect(m.has('w')).toBe(false);
    });
  });
});
