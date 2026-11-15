import { describe, it, expect } from 'vitest';
import { moveTarget, columnValues, planColumnFill } from '../grid-fill';
import type { AssessmentRow } from '@/types/assessment';

const row = (o: Partial<AssessmentRow> = {}): AssessmentRow =>
  ({ id: 'a', particulars: 'x', estimated: 0, assessed: 0, partType: 'metal', gst: 18, section: 'parts', allowed: true, ...o }) as AssessmentRow;
const ctx = { fromBill: false, autoDepRate: () => 30 };

describe('moveTarget', () => {
  const cells = [
    { row: 'a', col: 'gst' }, { row: 'a', col: 'billedTaxable' },
    { row: 'b', col: 'gst' },
    { row: 'c', col: 'gst' }, { row: 'c', col: 'billedTaxable' },
  ];
  it('moves down and up in the same column', () => {
    expect(moveTarget(cells, cells[0], 'ArrowDown')).toBe(2);
    expect(moveTarget(cells, cells[2], 'ArrowUp')).toBe(0);
  });
  it('skips a row missing the column', () => {
    expect(moveTarget(cells, cells[1], 'ArrowDown')).toBe(4);
    expect(moveTarget(cells, cells[4], 'ArrowUp')).toBe(1);
  });
  it('moves right and left within the row', () => {
    expect(moveTarget(cells, cells[0], 'ArrowRight')).toBe(1);
    expect(moveTarget(cells, cells[1], 'ArrowLeft')).toBe(0);
  });
  it('stays put at the ends', () => {
    expect(moveTarget(cells, cells[1], 'ArrowRight')).toBeNull();
    expect(moveTarget(cells, cells[2], 'ArrowLeft')).toBeNull();
    expect(moveTarget(cells, cells[0], 'ArrowUp')).toBeNull();
    expect(moveTarget(cells, cells[4], 'ArrowDown')).toBeNull();
  });
});

describe('columnValues', () => {
  it('splits Excel CRLF and drops one trailing empty line', () => {
    expect(columnValues('5\r\n6\r\n')).toEqual(['5', '6']);
  });
  it('is null without a line break', () => expect(columnValues('5')).toBeNull());
});

describe('planColumnFill', () => {
  it.each([['1,20,000', 120000], ['₹1,200.00', 1200], ['1 200', 1200]])('reads %s as a number', (v, n) => {
    const p = planColumnFill('billedTaxable', [v], [row()], 'a', ctx);
    expect(p.apply[0]?.updates.billedTaxable).toBe(n);
  });
  it('gst paste with comma-number keeps billedAmount at 141600 for 120000', () => {
    const p = planColumnFill('billedTaxable', ['1,20,000'], [row()], 'a', ctx);
    expect(p.apply[0].updates.billedAmount).toBe(141600);
  });
  it('skips and counts a value with a tab (several columns copied)', () => {
    const p = planColumnFill('billedTaxable', ['1	2'], [row()], 'a', ctx);
    expect(p).toMatchObject({ apply: [], filled: 0, skipped: 1 });
  });
  it('billedTaxable writes billedAmount and undoes both', () => {
    const r = row({ billedTaxable: 5, billedAmount: 6 });
    const p = planColumnFill('billedTaxable', ['1000'], [r], 'a', ctx);
    expect(p.apply).toEqual([{ id: 'a', updates: { billedTaxable: 1000, billedAmount: 1180 } }]);
    expect(p.undo).toEqual([{ id: 'a', updates: { billedTaxable: 5, billedAmount: 6 } }]);
    expect(p.filled).toBe(1);
  });
  it('writes nothing for a claim made from the bill', () => {
    const p = planColumnFill('billedTaxable', ['1000'], [row()], 'a', { ...ctx, fromBill: true });
    expect(p).toMatchObject({ apply: [], filled: 0, skipped: 1 });
  });
  it('skips billed on disallowed and not-in-bill rows', () => {
    const rows = [row({ allowed: false }), row({ id: 'b', billStatus: 'not-in-bill' })];
    expect(planColumnFill('billedTaxable', ['1', '2'], rows, 'a', ctx).skipped).toBe(2);
  });
  it('gst skips disposal rows', () => {
    expect(planColumnFill('gst', ['28'], [row({ isDisposal: true })], 'a', ctx).skipped).toBe(1);
  });
  it('gst recomputes billedAmount', () => {
    const p = planColumnFill('gst', ['28'], [row({ billedTaxable: 1000 })], 'a', ctx);
    expect(p.apply[0].updates).toEqual({ gst: 28, billedAmount: 1280 });
  });
  it('disposalPercent skips non-disposal rows', () => {
    expect(planColumnFill('disposalPercent', ['50'], [row()], 'a', ctx).skipped).toBe(1);
    expect(planColumnFill('disposalPercent', ['50'], [row({ isDisposal: true })], 'a', ctx).apply[0].updates).toEqual({ disposalPercent: 50 });
  });
  it('billAllowed never touches assessed', () => {
    const p = planColumnFill('billAllowed', ['900'], [row()], 'a', ctx);
    expect(p.apply[0].updates).toEqual({ billAllowed: 900 });
  });
  it('depOverride equal to the auto rate clears the override', () => {
    const p = planColumnFill('depOverride', ['30'], [row({ depOverride: 10 })], 'a', ctx);
    expect(p.apply[0].updates).toEqual({ depOverride: undefined });
    expect(p.undo[0].updates).toEqual({ depOverride: 10 });
  });
  it('depOverride skips disallowed rows', () => {
    expect(planColumnFill('depOverride', ['10'], [row({ allowed: false })], 'a', ctx).skipped).toBe(1);
  });
  it('treats allowed: undefined as locked for billAllowed, billedTaxable and depOverride', () => {
    const r = row({ allowed: undefined });
    for (const c of ['billAllowed', 'billedTaxable', 'depOverride'] as const) {
      expect(planColumnFill(c, ['10'], [r], 'a', ctx)).toMatchObject({ apply: [], skipped: 1 });
    }
  });
  it('gst undo restores gst and billedAmount', () => {
    const p = planColumnFill('gst', ['28'], [row({ billedTaxable: 1000, billedAmount: 1180 })], 'a', ctx);
    expect(p.undo[0].updates).toEqual({ gst: 18, billedAmount: 1180 });
  });
  it('billRemarks keeps text', () => {
    expect(planColumnFill('billRemarks', ['ok'], [row()], 'a', ctx).apply[0].updates).toEqual({ billRemarks: 'ok' });
  });
  it('skips unparseable numbers and values past the last row', () => {
    const p = planColumnFill('gst', ['abc', '5', '6'], [row()], 'a', ctx);
    expect(p).toMatchObject({ filled: 0, skipped: 3 });
  });
  it('an empty line leaves its row alone, uncounted', () => {
    const p = planColumnFill('gst', ['', '12'], [row(), row({ id: 'b' })], 'a', ctx);
    expect(p).toMatchObject({ filled: 1, skipped: 0 });
    expect(p.apply[0].id).toBe('b');
  });
});
