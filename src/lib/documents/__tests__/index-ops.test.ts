import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import type { ClaimDocument } from '@/types/documents';
import { claimDocuments, addDocuments, removeDocument, onThisDevice, newDocId, isDiscardablePlaceholder } from '../index-ops';

const doc = (p: Partial<ClaimDocument>): ClaimDocument => ({
  id: p.id ?? newDocId(), type: 'rc', relPath: 'RC Book.pdf', mime: 'application/pdf', size: 10,
  addedAt: '2026-09-21T10:00:00Z', source: 'upload', devices: ['Office PC'], ...p,
});

describe('index-ops', () => {
  it('claimDocuments is [] on old claims and sorted by addedAt', () => {
    const c = createBlankClaim();
    expect(claimDocuments(c)).toEqual([]);
    const c2 = addDocuments(c, [doc({ id: 'b', addedAt: '2026-09-21T11:00:00Z' }), doc({ id: 'a', addedAt: '2026-09-21T09:00:00Z' })]);
    expect(claimDocuments(c2).map((d) => d.id)).toEqual(['a', 'b']);
  });
  it('addDocuments does not mutate and keys by id', () => {
    const c = createBlankClaim();
    const c2 = addDocuments(c, [doc({ id: 'x' })]);
    expect(c.documents).toBeUndefined();
    expect(c2.documents?.x.type).toBe('rc');
  });
  it('removeDocument drops one id', () => {
    const c = addDocuments(createBlankClaim(), [doc({ id: 'a' }), doc({ id: 'b' })]);
    expect(Object.keys(removeDocument(c, 'a').documents!)).toEqual(['b']);
  });
  it('onThisDevice', () => {
    expect(onThisDevice(doc({}), 'Office PC')).toBe(true);
    expect(onThisDevice(doc({}), 'Laptop')).toBe(false);
  });
  it('newDocId is unique-ish and prefixed', () => {
    expect(newDocId()).toMatch(/^doc-\d+-[a-z0-9]{6}$/);
    expect(newDocId()).not.toBe(newDocId());
  });
});

describe('isDiscardablePlaceholder', () => {
  const html = (over: Partial<ClaimDocument> = {}) =>
    doc({ type: 'surveyReport', relPath: 'Final Survey Report.html', mime: 'text/html', source: 'generated', ...over });

  it('a generated HTML report replaced by a PDF is discardable', () => {
    expect(isDiscardablePlaceholder(html(), 'application/pdf')).toBe(true);
  });
  it('a re-print (HTML replaced by HTML) is not discardable', () => {
    expect(isDiscardablePlaceholder(html(), 'text/html')).toBe(false);
  });
  it('an uploaded HTML file is never discardable', () => {
    expect(isDiscardablePlaceholder(html({ source: 'upload' }), 'application/pdf')).toBe(false);
  });
  it('a generated non-HTML file (the NIA Excel) is never discardable', () => {
    const xlsx = html({ type: 'niaAssessmentExcel', relPath: 'Primary Assessment Template.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(isDiscardablePlaceholder(xlsx, 'application/pdf')).toBe(false);
  });
  it('an empty incoming mime does not discard anything', () => {
    expect(isDiscardablePlaceholder(html(), '')).toBe(false);
  });
  it('a re-print with a charset param is still not discardable', () => {
    expect(isDiscardablePlaceholder(html(), 'text/html; charset=utf-8')).toBe(false);
  });
});
