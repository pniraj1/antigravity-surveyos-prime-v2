import { describe, it, expect } from 'vitest';
import { billCheckUploadDocType, assessmentUploadDocType, asksDocumentKind, otherKind } from '../upload-doc-type';

describe('upload-doc-type', () => {
  it('files a Bill Check upload by mode', () => {
    expect(billCheckUploadDocType('final-bill')).toBe('invoice');
    expect(billCheckUploadDocType('estimate')).toBe('estimate');
  });
  it('files an Assessment upload by the claim base document', () => {
    expect(assessmentUploadDocType({ billCheck: { baseDocument: 'final-bill' } })).toBe('invoice');
    expect(assessmentUploadDocType({})).toBe('estimate');
    expect(assessmentUploadDocType(null)).toBe('estimate');
  });
  it('flips the answer for Undo', () => {
    expect(otherKind('estimate')).toBe('final-bill');
    expect(otherKind('final-bill')).toBe('estimate');
  });
  it('asks only on the first Assessment upload', () => {
    expect(asksDocumentKind({ assessmentRows: [] })).toBe(true);
    expect(asksDocumentKind({ assessmentRows: [{}] })).toBe(false);
    expect(asksDocumentKind({ assessmentRows: [], billCheck: { baseDocument: 'final-bill' } })).toBe(false);
    expect(asksDocumentKind({ assessmentRows: [], billCheck: { baseDocument: 'estimate' } })).toBe(false);
  });
});

import { docTypeForAnswer, shouldApplyUndo } from '../upload-doc-type';

describe('answer binding', () => {
  it('files the answer, not the current claim', () => {
    expect(docTypeForAnswer('final-bill')).toBe('invoice');
    expect(docTypeForAnswer('estimate')).toBe('estimate');
  });
  it('applies Undo only on the claim it was answered on', () => {
    expect(shouldApplyUndo('a', 'a')).toBe(true);
    expect(shouldApplyUndo('b', 'a')).toBe(false);
    expect(shouldApplyUndo(undefined, 'a')).toBe(false);
  });
});
