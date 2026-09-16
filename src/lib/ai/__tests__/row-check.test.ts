import { describe, it, expect } from 'vitest';
import {
  rowCheck, tagRows, dropDuplicates, mergeBySerial, stripPageTags, toFindings, describeFinding, countRows,
} from '../row-check';

const row = (sr_no: number, total_amount: number, _page?: number, extra: object = {}) => ({ sr_no, total_amount, _page, ...extra });

/** DTC shape: one serial run across sections, 5 pages, rows reconcile to the gross. */
function dtc() {
  const spare_parts = Array.from({ length: 60 }, (_, i) => row(i + 1, 100, Math.floor(i / 20)));      // pages 0-2
  const labour_items = Array.from({ length: 15 }, (_, i) => row(61 + i, 50, 3));
  const painting_items = Array.from({ length: 5 }, (_, i) => row(76 + i, 20, 4));
  return { spare_parts, labour_items, painting_items, gross_amount: 60 * 100 + 15 * 50 + 5 * 20 };
}

describe('rowCheck — one serial run (DTC)', () => {
  it('clean 80-row read has no findings', () => {
    const c = rowCheck(dtc());
    expect(c).toEqual({ gaps: [], duplicates: [], serialsUsable: true, duplicatesDroppable: true });
  });
  it('a missing serial is a gap pinned to its page when neighbours agree', () => {
    const d = dtc();
    d.spare_parts = d.spare_parts.filter(r => r.sr_no !== 38);          // 37 and 39 both on page 1
    d.gross_amount -= 100;
    expect(rowCheck(d).gaps).toEqual([{ srNo: 38, pages: [1] }]);
  });
  it('a gap between pages names both pages', () => {
    const d = dtc();
    d.spare_parts = d.spare_parts.filter(r => r.sr_no !== 40);          // 39 on page 1, 41 on page 2
    d.gross_amount -= 100;
    expect(rowCheck(d).gaps).toEqual([{ srNo: 40, pages: [1, 2] }]);
  });
  it('a multi-page vision chunk widens the candidates', () => {
    const d = dtc();
    d.spare_parts = d.spare_parts.filter(r => r.sr_no !== 38);
    d.spare_parts = d.spare_parts.map(r => (r.sr_no === 37 || r.sr_no === 39) ? { ...r, _page: 1, _pageEnd: 2 } : r);
    d.gross_amount -= 100;
    expect(rowCheck(d).gaps).toEqual([{ srNo: 38, pages: [1, 2] }]);
  });
  it('a repeated serial is a duplicate', () => {
    const d = dtc();
    d.spare_parts.push(row(12, 100, 0));
    d.gross_amount += 0;   // sum now off by 100 — that is a real mismatch, but duplicates are reported regardless
    expect(rowCheck(d).duplicates).toEqual([12]);
    expect(rowCheck(d).duplicatesDroppable).toBe(true);
  });
  it('an unnumbered 3-page bill (model numbers 1..n itself per page) is not droppable and has no gaps', () => {
    // Pages 0, 1, 2 each independently numbered 1..25/1..25/1..20 — a heavily
    // duplicated union that is not a real duplicate, it is unknown numbering.
    const p1 = Array.from({ length: 25 }, (_, i) => row(i + 1, 10, 0));
    const p2 = Array.from({ length: 25 }, (_, i) => row(i + 1, 10, 1));
    const p3 = Array.from({ length: 20 }, (_, i) => row(i + 1, 10, 2));
    const gross = (25 + 25 + 20) * 10;
    const d = { spare_parts: [...p1, ...p2, ...p3], labour_items: [], painting_items: [], gross_amount: gross };
    const c = rowCheck(d);
    expect(c.duplicatesDroppable).toBe(false);
    expect(c.gaps).toEqual([]);
  });
});

describe('rowCheck — per-section serials', () => {
  it('detects gaps inside each section when sections restart at 1', () => {
    const d = {
      spare_parts: [row(1, 10, 0), row(2, 10, 0), row(4, 10, 0)],
      labour_items: [row(1, 5, 1), row(2, 5, 1)],
      painting_items: [],
      gross_amount: 40,
    };
    expect(rowCheck(d).gaps).toEqual([{ srNo: 3, pages: [0] }]);
    expect(rowCheck(d).duplicates).toEqual([]);     // 1 and 2 repeating across sections is not a duplicate here
    expect(rowCheck(d).duplicatesDroppable).toBe(true);
  });
});

describe('rowCheck — serials unusable', () => {
  it('skips the gap check when fewer than 80 % of rows have a serial', () => {
    const d = { spare_parts: [row(1, 10), { total_amount: 10 }, { total_amount: 10 }], labour_items: [], painting_items: [], gross_amount: 30 };
    expect(rowCheck(d)).toEqual({ gaps: [], duplicates: [], serialsUsable: false, duplicatesDroppable: false });
  });
});

describe('rowCheck — gross', () => {
  it('rows not adding up to the gross is a mismatch in vision mode (no page texts)', () => {
    const d = dtc(); d.gross_amount += 500;
    expect(rowCheck(d).grossMismatch).toEqual({ rows: 6850, printed: 7350 });
  });
  it('in text mode a gross whose digits are not printed anywhere is ignored', () => {
    const d = dtc(); d.gross_amount += 500;
    expect(rowCheck(d, ['no money here', 'nor here']).grossMismatch).toBeUndefined();
  });
  it('in text mode a printed gross (Indian comma format) is trusted', () => {
    const d = dtc(); d.gross_amount = 2_26_860.85;
    expect(rowCheck(d, ['GRAND TOTAL 2,26,860.85']).grossMismatch).toEqual({ rows: 6850, printed: 226860.85 });
  });
  it('falls back to total_amount when gross_amount is absent', () => {
    const d = { ...dtc(), gross_amount: undefined, total_amount: 6850 };
    expect(rowCheck(d).grossMismatch).toBeUndefined();
  });
  it('tolerates 0.1 % rounding', () => {
    const d = dtc(); d.gross_amount = 6855;
    expect(rowCheck(d).grossMismatch).toBeUndefined();
  });
});

describe('helpers', () => {
  it('tagRows tags every row in every section; _pageEnd only for multi-page chunks', () => {
    const f = { spare_parts: [{ sr_no: 1 }], labour_items: [{ sr_no: 2 }], painting_items: [], gross_amount: 1 };
    expect(tagRows(f, 2, 2).spare_parts[0]).toEqual({ sr_no: 1, _page: 2 });
    expect(tagRows(f, 2, 3).labour_items[0]).toEqual({ sr_no: 2, _page: 2, _pageEnd: 3 });
    expect(f.spare_parts[0]).toEqual({ sr_no: 1 });   // immutable
  });
  it('dropDuplicates keeps the first copy per section', () => {
    const d = { spare_parts: [row(1, 10), row(2, 10), row(1, 99)], labour_items: [], painting_items: [] };
    expect(dropDuplicates(d).spare_parts.map(r => r.total_amount)).toEqual([10, 10]);
  });
  it('mergeBySerial inserts only serials still missing, never replaces', () => {
    const d = { spare_parts: [row(1, 10), row(3, 10)], labour_items: [row(2, 5)], painting_items: [] };
    const frag = { spare_parts: [row(2, 99), row(4, 10)], labour_items: [row(1, 99)] };
    const m = mergeBySerial(d, frag);
    expect(m.spare_parts.map(r => r.sr_no)).toEqual([1, 3, 4]);   // 2 exists in labour → not inserted
    expect(m.labour_items.map(r => r.sr_no)).toEqual([2]);
    expect(d.spare_parts).toHaveLength(2);                         // immutable
  });
  it('stripPageTags removes _page/_pageEnd from every row', () => {
    const d = { spare_parts: [row(1, 10, 0, { _pageEnd: 1 })], labour_items: [], painting_items: [], gross_amount: 10 };
    expect(stripPageTags(d)).toEqual({ spare_parts: [{ sr_no: 1, total_amount: 10 }], labour_items: [], painting_items: [], gross_amount: 10 });
  });
  it('toFindings groups all gaps into one finding and adds gross', () => {
    const f = toFindings({ gaps: [{ srNo: 38, pages: [2] }, { srNo: 52, pages: [2, 3] }], duplicates: [], serialsUsable: true, duplicatesDroppable: true, grossMismatch: { rows: 1, printed: 2 } });
    expect(f).toEqual([{ kind: 'gap', srNos: [38, 52], pages: [2, 3] }, { kind: 'gross', rows: 1, printed: 2 }]);
  });
  it('describeFinding speaks plain surveyor language with 1-based pages', () => {
    expect(describeFinding({ kind: 'gap', srNos: [38], pages: [2] })).toBe('Row 38 looks missing (page 3)');
    expect(describeFinding({ kind: 'gap', srNos: [38, 52], pages: [2, 3] })).toBe('Rows 38 and 52 look missing (pages 3, 4)');
    expect(describeFinding({ kind: 'gross', rows: 225100, printed: 226860 })).toBe('Rows add up to ₹2,25,100 but the bill says ₹2,26,860');
  });
  it('countRows sums the three sections', () => { expect(countRows(dtc())).toBe(80); });
});
