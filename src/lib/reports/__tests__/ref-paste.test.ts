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

describe('planRefPaste keyed on the serial the grid shows', () => {
  it('uses serialOf, not the estimate srNo', () => {
    const rows = [r('a', 50), r('b', 60)];
    const shown = new Map([['a', 1], ['b', 2]]);
    const p = planRefPaste({ kind: 'keyed', pairs: [{ srNo: 2, ref: '43' }] }, rows, 'a', null, id => shown.get(id));
    expect(p.apply.map(u => u.id)).toEqual(['b']);
  });
});

describe('review fixes', () => {
  const lab = (id: string, srNo?: number, refSrNo?: string): AssessmentRow =>
    ({ ...r(id, srNo, undefined, refSrNo), section: 'labour' } as AssessmentRow);

  it('C-1: a two-column paste that repeats a serial spans sections and is refused', () =>
    expect(parseRefPaste('1\t301\n2\t302\n1\t112')).toEqual({ kind: 'invalid' }));

  it('C-1: a labour pair pasted into a labour cell never lands on the parts row with that serial', () => {
    const parts7 = r('p7', 7);
    const labour7 = lab('l7', 7, '90');                       // has a ref, so "needs a ref" hides it
    const labour9 = lab('l9', 9);
    const p = planRefPaste({ kind: 'keyed', pairs: [{ srNo: 7, ref: '112' }] },
      [parts7, labour9], 'l9', null, undefined, [parts7, labour7, labour9]);
    expect(p.apply).toEqual([]);
    expect(p.skipped).toBe(1);
  });

  it('I-1: only lines of the row\'s own section are checked', () => {
    const lines = [{ srNo: 12, partNumber: 'XX-7', section: 'parts' }, { srNo: 12, section: 'labour' }];
    const p = planRefPaste({ kind: 'column', refs: ['12'] }, [r('a', 1, 'BP-1')], 'a', lines);
    expect(p.apply[0].updates.refStatus).toBe('ambiguous');
  });

  it('I-2: a one-column paste drops a header line with no digit', () =>
    expect(parseRefPaste('Est No\n301\n43')).toEqual({ kind: 'column', refs: ['301', '43'] }));

  it('I-3: a changed ref releases the line its old match held', () => {
    const bill = { id: 'extra-parts-BP-1-100', srNo: 12, partNumber: 'BP-1' } as never;
    const row = { ...r('a', 1, 'BP-1', '12'), refStatus: 'clean' as const, refMatch: { bill, score: 100, reasons: [] } } as AssessmentRow;
    expect(planRefPaste({ kind: 'column', refs: ['301'] }, [row], 'a', null).released).toEqual([bill]);
    const refOnly = { ...row, refMatch: { bill, score: 100, reasons: [], refOnly: true } } as AssessmentRow;
    expect(planRefPaste({ kind: 'column', refs: ['301'] }, [refOnly], 'a', null).released).toEqual([]);
  });
});

describe('planRefPaste estimateAmount (I2a)', () => {
  it('apply clears estimateAmount and undo restores it', () => {
    const row = { ...r('a', 1), estimateAmount: 900 } as AssessmentRow;
    const p = planRefPaste({ kind: 'column', refs: ['5'] }, [row], 'a', null);
    expect(p.apply[0].updates).toHaveProperty('estimateAmount', undefined);
    expect(p.undo[0].updates.estimateAmount).toBe(900);
  });
});
