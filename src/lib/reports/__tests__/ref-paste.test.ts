import { describe, it, expect } from 'vitest';
import { parseRefPaste, planRefPaste } from '../ref-paste';
import type { AssessmentRow } from '@/types/assessment';

const r = (id: string, srNo?: number, partNumber?: string, refSrNo?: string): AssessmentRow => ({
  id, srNo, partNumber, refSrNo,
  particulars: id, estimated: 100, assessed: 100, section: 'parts', allowed: true,
} as AssessmentRow);

describe('planRefPaste', () => {
  const rows = [r('a', 1, 'BP-1'), r('b', 2, 'RD-9'), r('c', 3)];
  const lines = [{ srNo: 301, partNumber: 'BP-1' }, { srNo: 43, partNumber: 'XX-7' }];

  it('column fills down from the pasted row and skips blanks', () => {
    const p = planRefPaste({ kind: 'column', refs: ['301', ''] }, rows, 'a', null);
    expect(p.apply).toEqual([{ id: 'a', updates: { refSrNo: '301', refStatus: 'manual', refMatch: undefined } }]);
    expect(p.filled).toBe(1);
  });
  it('column values past the last row are skipped', () =>
    expect(planRefPaste({ kind: 'column', refs: ['1', '2'] }, rows, 'c', null).skipped).toBe(1));
  it('keyed goes by Sr No., not position', () => {
    const p = planRefPaste({ kind: 'keyed', pairs: [{ srNo: 2, ref: '43' }] }, rows, 'a', null);
    expect(p.apply.map(u => u.id)).toEqual(['b']);
  });
  it('keyed skips a Sr No. on two rows or none', () => {
    const dup = [...rows, r('d', 2)];
    expect(planRefPaste({ kind: 'keyed', pairs: [{ srNo: 2, ref: '1' }, { srNo: 9, ref: '1' }] }, dup, 'a', null).skipped).toBe(2);
  });
  it('a different part number on the read line flags the row', () => {
    const p = planRefPaste({ kind: 'column', refs: ['301', '43'] }, rows, 'a', lines);
    expect(p.apply[0].updates.refStatus).toBe('manual');      // BP-1 = BP-1
    expect(p.apply[1].updates.refStatus).toBe('ambiguous');   // RD-9 ≠ XX-7
    expect(p.flagged).toBe(1);
  });
  it('a serial not on the read document flags the row', () => {
    const p = planRefPaste({ kind: 'column', refs: ['999'] }, rows, 'c', lines);
    expect(p.apply[0].updates.refStatus).toBe('ambiguous');
    expect(p.notOnDocument).toBe(1);
  });
  it('refs with letters are not checked', () =>
    expect(planRefPaste({ kind: 'column', refs: ['E1-999'] }, rows, 'c', lines).apply[0].updates.refStatus).toBe('manual'));
  it('undo restores the previous ref, status and match', () => {
    const prev = { ...r('a', 1, 'BP-1', '12'), refStatus: 'clean' as const };
    const p = planRefPaste({ kind: 'column', refs: ['301'] }, [prev], 'a', null);
    expect(p.undo).toEqual([{ id: 'a', updates: { refSrNo: '12', refStatus: 'clean', refMatch: undefined } }]);
  });
  it('an unchanged ref is not touched', () =>
    expect(planRefPaste({ kind: 'column', refs: ['12'] }, [r('a', 1, 'BP-1', '12')], 'a', null).apply).toEqual([]));
});

describe('parseRefPaste', () => {
  it('a plain value is single', () => expect(parseRefPaste('301')).toEqual({ kind: 'single' }));
  it('an Excel column with CRLF and trailing newline', () =>
    expect(parseRefPaste('301\r\n\r\n43\r\n')).toEqual({ kind: 'column', refs: ['301', '', '43'] }));
  it('keeps refs as typed', () =>
    expect(parseRefPaste('61, 65, 71\nE1-301 / E2-43')).toEqual({ kind: 'column', refs: ['61, 65, 71', 'E1-301 / E2-43'] }));
  it('two columns with a header are keyed', () =>
    expect(parseRefPaste('Sr No\tEst No\n12\t301\n13.0\t43 \n')).toEqual({
      kind: 'keyed', pairs: [{ srNo: 12, ref: '301' }, { srNo: 13, ref: '43' }] }));
  it('a keyed pair with an empty ref is dropped', () =>
    expect(parseRefPaste('12\t\n13\t43')).toEqual({ kind: 'keyed', pairs: [{ srNo: 13, ref: '43' }] }));
  it('a non-numeric first column is invalid', () =>
    expect(parseRefPaste('BUMPER\t301\nDOOR\t43')).toEqual({ kind: 'invalid' }));
  it('three columns are invalid', () =>
    expect(parseRefPaste('12\tBUMPER\t301')).toEqual({ kind: 'invalid' }));
});
