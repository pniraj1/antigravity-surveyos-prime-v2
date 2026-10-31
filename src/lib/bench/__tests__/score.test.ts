import { describe, it, expect } from 'vitest';
import { toBenchRows, selfCheck, compareToReference, passes } from '../score';
import type { BenchRow, PdfProfile } from '../types';

const row = (o: Partial<BenchRow>): BenchRow => ({ section: 'spare_parts', srNo: 1, description: 'Front bumper', qty: 1, rate: 100, amount: 100, page: 1, ...o });
const profile = (o: Partial<PdfProfile> = {}): PdfProfile => ({
  id: 'p', fileName: 'a.pdf', kind: 'digital', pageCount: 4, confirmed: true, unreadablePages: [],
  estimates: [{ label: 'E1', firstPage: 1, lastPage: 4, grandTotal: null }], ...o,
});

describe('toBenchRows', () => {
  it('maps fields and 1-bases the page', () => {
    const r = toBenchRows({ labour_items: [{ sr_no: 2, description: 'Fit', quantity: 2, unit_price: 50, total_amount: 100, _page: 2 }], spare_parts: [{ sr_no: 1, description: 'X', amount: 7, _page: 0 }] });
    expect(r).toContainEqual({ section: 'labour_items', srNo: 2, description: 'Fit', qty: 2, rate: 50, amount: 100, page: 3 });
    expect(r.find(x => x.section === 'spare_parts')).toMatchObject({ amount: 7, page: 1, qty: null });
  });
  it('tolerates junk', () => { expect(toBenchRows(null)).toEqual([]); });
});

describe('selfCheck', () => {
  it('totals off by 2 -> totals_mismatch; within 1 passes', () => {
    const p = profile({ estimates: [{ label: 'E1', firstPage: 1, lastPage: 4, grandTotal: 202 }] });
    expect(selfCheck([row({ amount: 100, rate: 100 }), row({ srNo: 2, amount: 100, rate: 100 })], p).map(e => e.type)).toEqual(['totals_mismatch']);
    expect(selfCheck([row({}), row({ srNo: 2 })], profile({ estimates: [{ label: 'E1', firstPage: 1, lastPage: 4, grandTotal: 201 }] }))).toEqual([]);
  });
  it('restarted serials per section are not gaps', () => {
    const rows = [row({ srNo: 1 }), row({ srNo: 2 }), row({ section: 'labour_items', srNo: 1 }), row({ section: 'labour_items', srNo: 2 })];
    expect(selfCheck(rows, profile())).toEqual([]);
  });
  it('empty page passes', () => {
    expect(selfCheck([row({ srNo: 1, page: 1 }), row({ srNo: 2, page: 3 })], profile())).toEqual([]);
  });
  it('two estimates numbered from 1 are not duplicates', () => {
    const p = profile({ estimates: [{ label: 'E1', firstPage: 1, lastPage: 2, grandTotal: null }, { label: 'E2', firstPage: 3, lastPage: 4, grandTotal: null }] });
    expect(selfCheck([row({ srNo: 1, page: 1 }), row({ srNo: 1, page: 3 })], p)).toEqual([]);
  });
  it('flags gap and duplicate serials and qty x rate', () => {
    const t = selfCheck([row({ srNo: 1 }), row({ srNo: 3 }), row({ srNo: 3, amount: 500 })], profile());
    expect(t.map(e => e.type).sort()).toEqual(['duplicated', 'missed', 'wrong_amount']);
  });
  it('row on unreadable page -> no error', () => {
    const p = profile({ unreadablePages: [2], estimates: [{ label: 'E1', firstPage: 1, lastPage: 4, grandTotal: 100 }] });
    expect(selfCheck([row({}), row({ srNo: 9, page: 2, amount: 9999 })], p)).toEqual([]);
  });
});

describe('compareToReference', () => {
  const ref = [row({ srNo: 1, description: 'Bumper', amount: 100, page: 1 }), row({ srNo: 2, description: 'Door', amount: 200, page: 2 })];
  it('identical -> none', () => { expect(compareToReference(ref, ref, profile())).toEqual([]); });
  it('missing row -> missed with page and serial', () => {
    const e = compareToReference([ref[0]], ref, profile());
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ type: 'missed', page: 2, srNo: 2 });
  });
  it('extra row -> invented; repeat -> duplicated', () => {
    expect(compareToReference([...ref, row({ srNo: 3, description: 'Wheel', amount: 5, page: 2 })], ref, profile()).map(e => e.type)).toEqual(['invented']);
    expect(compareToReference([...ref, ref[1]], ref, profile()).map(e => e.type)).toEqual(['duplicated']);
  });
  it('same description, different amount -> wrong_amount', () => {
    expect(compareToReference([ref[0], { ...ref[1], amount: 250 }], ref, profile()).map(e => e.type)).toEqual(['wrong_amount']);
  });
  it('swapped page blocks -> wrong_order', () => {
    const swapped = [{ ...ref[1] }, { ...ref[0] }];
    expect(compareToReference(swapped, ref, profile()).map(e => e.type)).toEqual(['wrong_order']);
  });
  it('unreadable page rows ignored', () => {
    expect(compareToReference([ref[0]], ref, profile({ unreadablePages: [2] }))).toEqual([]);
  });
});

describe('passes', () => {
  it('ignores rate_limited and unreadable', () => {
    const e = (type: 'rate_limited' | 'unreadable' | 'missed') => ({ type, estimate: 'E1', page: null, srNo: null, detail: '' });
    expect(passes([e('rate_limited'), e('unreadable')])).toBe(true);
    expect(passes([e('rate_limited'), e('missed')])).toBe(false);
  });
});
