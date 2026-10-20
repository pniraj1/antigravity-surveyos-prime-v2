import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import type { ClaimDocument } from '@/types/documents';
import { claimDocuments, addDocuments, removeDocument, onThisDevice, newDocId, isDiscardablePlaceholder, addDeviceTo, replaceableEntries } from '../index-ops';

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

describe('addDeviceTo', () => {
  it('adds this device to an entry written elsewhere', () => {
    const c = addDocuments(createBlankClaim(), [doc({ id: 'a', devices: ['Office PC'] })]);
    const next = addDeviceTo(c, 'a', 'Laptop');
    expect(next.documents!.a.devices).toEqual(['Office PC', 'Laptop']);
  });
  it('is a no-op when the device is already listed or the id is unknown', () => {
    const c = addDocuments(createBlankClaim(), [doc({ id: 'a', devices: ['Office PC'] })]);
    expect(addDeviceTo(c, 'a', 'Office PC').documents!.a.devices).toEqual(['Office PC']);
    expect(addDeviceTo(c, 'nope', 'Laptop')).toEqual(c);
  });
});

describe('replaceableEntries', () => {
  const pol = (relPath: string, devices = ['Office PC']) => doc({ id: relPath, type: 'policy', relPath, devices });
  it('replaceableEntries keeps a surveyor-named file', () => {
    expect(replaceableEntries([pol('Policy.pdf'), pol('Documents.pdf')], 'policy', 'Office PC')).toEqual([]);
  });
  it('replaceableEntries returns SurveyOS-named files', () => {
    const got = replaceableEntries([pol('Policy Schedule.pdf'), pol('Policy Schedule 2.pdf'), pol('Policy.pdf'), doc({ relPath: 'RC Book.pdf' })], 'policy', 'Office PC');
    expect(got.map((d) => d.relPath)).toEqual(['Policy Schedule.pdf', 'Policy Schedule 2.pdf']);
  });
  it('replaceableEntries ignores other devices', () => {
    expect(replaceableEntries([pol('Policy Schedule.pdf', ['Laptop'])], 'policy', 'Office PC')).toEqual([]);
  });
});
