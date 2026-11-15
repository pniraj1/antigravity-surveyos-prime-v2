import { describe, it, expect } from 'vitest';
import { parseRefPaste } from '../ref-paste';

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
