import { describe, it, expect } from 'vitest';
import { billCheckUploadDocType, assessmentUploadDocType, asksDocumentKind, otherKind, assessmentSwitch } from '../upload-doc-type';
import type { ClaimData } from '@/types';

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
  it('asks on every Assessment upload', () => {
    expect(asksDocumentKind({ assessmentRows: [] })).toBe(true);
    expect(asksDocumentKind({ assessmentRows: [{}] })).toBe(true);
    expect(asksDocumentKind({ assessmentRows: [], billCheck: { baseDocument: 'final-bill' } })).toBe(true);
    expect(asksDocumentKind({ assessmentRows: [{}], billCheck: { baseDocument: 'estimate' } })).toBe(true);
    expect(asksDocumentKind(null)).toBe(false);
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

describe('assessmentSwitch', () => {
  const row = { id: 'r', allowed: true, estimated: 100, gst: 18, refSrNo: 3 };
  const claim = (baseDocument?: string) => ({ billCheck: { baseDocument }, assessmentRows: [row], extraBillItems: [] }) as unknown as ClaimData;

  it('is null when the answer is the claim base document', () => {
    expect(assessmentSwitch(claim('estimate'), 'estimate')).toBeNull();
    expect(assessmentSwitch(claim(undefined), 'estimate')).toBeNull();
    expect(assessmentSwitch(claim('final-bill'), 'final-bill')).toBeNull();
  });
  it('answer Final bill on an estimate claim files the OPPOSITE Bill Check upload kind (estimate)', () => {
    const r = assessmentSwitch(claim('estimate'), 'final-bill');
    expect(r?.upload).toBe('estimate');
    expect(r?.prompt).toContain('Switch to Estimate?');
  });
  it('answer Estimate on a from-bill claim files the final-bill upload kind', () => {
    const r = assessmentSwitch(claim('final-bill'), 'estimate');
    expect(r?.upload).toBe('final-bill');
    expect(r?.prompt).toContain('Switch to Final bill?');
  });
});
