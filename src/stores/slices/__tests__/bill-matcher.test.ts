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
  test('matches regardless of word order', () => {
    // The reported bug: the workshop writes BUMPER FRONT, the estimate says
    // FRONT BUMPER, and the item was reported as never assessed.
    const rows = [row({ id: 'r1', particulars: 'FRONT BUMPER', estimated: 0, assessed: 0 })];
    const bill = buildBillItems({ spare_parts: [{ description: 'BUMPER FRONT', total_amount: 11800 }] });
    const m = matchBillItemsToRows(rows, bill);
    expect(m.has('r1')).toBe(true);
  });

  test('matches on part number regardless of formatting', () => {
    const rows = [row({ id: 'r1', partNumber: '56100-0R190' })];
    const bill = buildBillItems({ spare_parts: [{ part_number: '561000R190', total_amount: 11800 }] });
    expect(matchBillItemsToRows(rows, bill).get('r1')?.reason).toBe('part');
  });

  test('still matches when the AI files a part under labour', () => {
    const rows = [row({ id: 'r1', particulars: 'FRONT BUMPER', section: 'parts' })];
    const bill = buildBillItems({ labour_items: [{ description: 'FRONT BUMPER', taxable_amount: 10000, total_amount: 11800 }] });
    expect(matchBillItemsToRows(rows, bill).has('r1')).toBe(true);
  });

  test('one bill item never matches two rows', () => {
    const rows = [
      row({ id: 'r1', particulars: 'FRONT BUMPER' }),
      row({ id: 'r2', particulars: 'FRONT BUMPER' }),
    ];
    const bill = buildBillItems({ spare_parts: [{ description: 'FRONT BUMPER', taxable_amount: 10000, total_amount: 11800 }] });
    const m = matchBillItemsToRows(rows, bill);
    expect([m.has('r1'), m.has('r2')].filter(Boolean)).toHaveLength(1);
  });

  test('flags an ambiguous match without mutating the bill item', () => {
    const rows = [row({ id: 'r1', particulars: 'UNRELATED TEXT', estimated: 10000 })];
    const bill = buildBillItems({
      spare_parts: [
        { description: 'SOMETHING ELSE', taxable_amount: 10000, total_amount: 11800 },
        { description: 'ANOTHER THING', taxable_amount: 10000, total_amount: 11800 },
      ],
    });
    const frozen = JSON.stringify(bill);
    const m = matchBillItemsToRows(rows, bill);
    expect(m.get('r1')?.ambiguous).toBe(true);
    expect(JSON.stringify(bill)).toBe(frozen);
  });

  test('leaves a genuinely new item unmatched', () => {
    const rows = [row({ id: 'r1', particulars: 'FRONT BUMPER' })];
    const bill = buildBillItems({ spare_parts: [{ description: 'RADIATOR ASSY', taxable_amount: 6000, total_amount: 7080 }] });
    expect(matchBillItemsToRows(rows, bill).has('r1')).toBe(false);
  });
});
