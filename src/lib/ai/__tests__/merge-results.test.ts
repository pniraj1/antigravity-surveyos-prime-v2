import { describe, it, expect } from 'vitest';
import { asFragment, mergeAIResults } from '../merge-results';

describe('asFragment', () => {
  it('unwraps a one-element list holding a document', () => {
    expect(asFragment([{ spare_parts: [{ sr_no: 247 }], labour_items: [{ sr_no: 1 }], total_amount: 5 }]))
      .toEqual({ spare_parts: [{ sr_no: 247 }], labour_items: [{ sr_no: 1 }], total_amount: 5 });
  });
  it('merges two document-shaped objects', () => {
    expect(asFragment([{ spare_parts: [{ sr_no: 1 }] }, { spare_parts: [{ sr_no: 2 }], labour_items: [{ sr_no: 3 }] }]))
      .toEqual({ spare_parts: [{ sr_no: 1 }, { sr_no: 2 }], labour_items: [{ sr_no: 3 }] });
  });
  it('returns an object unchanged', () => {
    const o = { spare_parts: [] };
    expect(asFragment(o)).toBe(o);
  });
  it('leaves a bare row list alone', () => {
    const rows = [{ sr_no: 1, description: 'NUT' }];
    expect(asFragment(rows)).toBe(rows);
  });
  it('MH40BG5830 shape: no "0" key, last page rows kept', () => {
    const acc = { spare_parts: Array.from({ length: 246 }, (_, i) => ({ sr_no: i + 1 })) };
    const last = [{ spare_parts: [{ sr_no: 247 }], labour_items: [{ sr_no: 1 }, { sr_no: 2 }], painting_items: [{ sr_no: 37 }] }];
    const out = mergeAIResults(acc, asFragment(last));
    expect(out['0']).toBeUndefined();
    expect(out.spare_parts).toHaveLength(247);
    expect(out.labour_items).toHaveLength(2);
    expect(out.painting_items).toHaveLength(1);
  });
});

describe('asFragment — review fixes', () => {
  it('unwraps a one-element list holding a scalar-only document (RC)', () => {
    expect(asFragment([{ registration_number: 'MH40BG5830', owner_name: 'X' }]))
      .toEqual({ registration_number: 'MH40BG5830', owner_name: 'X' });
  });
  it('folds a mixed list: rows object plus a header-only object', () => {
    expect(asFragment([{ spare_parts: [{ sr_no: 1 }] }, { gross_amount: 5000, workshop_name: 'X' }]))
      .toEqual({ spare_parts: [{ sr_no: 1 }], gross_amount: 5000, workshop_name: 'X' });
  });
  it('leaves a one-row list alone', () => {
    const rows = [{ sr_no: 1, description: 'NUT', total_amount: 10 }];
    expect(asFragment(rows)).toBe(rows);
  });
});
