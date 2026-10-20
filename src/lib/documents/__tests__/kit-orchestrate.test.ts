import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, PageLabel } from '@/types/documents';
import type { BoxState } from '../kit/checklist';

const mocks = vi.hoisted(() => ({
  pageTexts: vi.fn(),
  pageCountOf: vi.fn(),
}));
vi.mock('../kit/page-text', () => ({ pageTexts: mocks.pageTexts, pageCountOf: mocks.pageCountOf }));

import {
  labelClaim, setPageLabels, confirmAllLabels, overrideLabel, invalidateIfReviewed, docIdsForPaths, buildable, blockedBoxes, identityMap, claimDrift,
} from '../kit/orchestrate';

const DEV = 'PC1';
const NOW = '2026-10-20T10:00:00Z';

function doc(id: string, over: Partial<ClaimDocument> = {}): ClaimDocument {
  return {
    id, type: 'other', relPath: `${id}.pdf`, mime: 'application/pdf', size: 1, addedAt: '2026-10-01T00:00:00Z',
    source: 'upload', adopted: true, devices: [DEV], ...over,
  };
}
function claimOf(docs: ClaimDocument[], over: Partial<ClaimData> = {}): ClaimData {
  return { ...createBlankClaim(), documents: Object.fromEntries(docs.map((d) => [d.id, d])), ...over };
}
const pdfBlob = () => Promise.resolve(new Blob(['x'], { type: 'application/pdf' }));
const label = (over: Partial<PageLabel> = {}): PageLabel => ({ type: 'rc', by: 'text', confirmed: false, ...over });

beforeEach(() => {
  mocks.pageTexts.mockReset();
  mocks.pageCountOf.mockReset();
});

describe('labelClaim', () => {
  it('labelClaim labels new entries once', async () => {
    mocks.pageCountOf.mockResolvedValue(2);
    mocks.pageTexts.mockResolvedValue(['Registration Certificate of vehicle', 'nothing useful here']);
    const read = vi.fn(pdfBlob);
    const c = claimOf([doc('a')]);
    const out = await labelClaim(c, read, DEV);
    expect(read).toHaveBeenCalledTimes(1);
    expect(out.claim.documents!.a.pageCount).toBe(2);
    expect(out.claim.documents!.a.pages![1]).toMatchObject({ type: 'rc', by: 'text', confirmed: false });
    expect(out.claim.documents!.a.pages![2]).toBeUndefined();
    expect(out.texts.a).toEqual(['Registration Certificate of vehicle', 'nothing useful here']);
    expect(c.documents!.a.pages).toBeUndefined(); // input not mutated
  });

  it('labelClaim skips fully labelled entries', async () => {
    const full = doc('a', { pageCount: 1, pages: { 1: label({ confirmed: true }) } });
    const read = vi.fn(pdfBlob);
    const c = claimOf([full]);
    const out = await labelClaim(c, read, DEV);
    expect(read).not.toHaveBeenCalled();
    expect(out.claim).toBe(c);
    expect(out.texts).toEqual({});
  });

  it('labelClaim ignores entries not on this device', async () => {
    const read = vi.fn(pdfBlob);
    const out = await labelClaim(claimOf([doc('a', { devices: ['Other PC'] })]), read, DEV);
    expect(read).not.toHaveBeenCalled();
    expect(out.texts).toEqual({});
  });

  it('labelClaim returns the same claim when nothing changed, and survives a failed read', async () => {
    mocks.pageCountOf.mockResolvedValue(1);
    mocks.pageTexts.mockResolvedValue(['unrelated words']);
    const c = claimOf([doc('a'), doc('b')]);
    const read = vi.fn((d: ClaimDocument) => (d.id === 'a' ? Promise.reject(new Error('locked')) : pdfBlob()));
    const out = await labelClaim(c, read, DEV);
    expect(out.claim.documents!.a).toBe(c.documents!.a);
    expect(out.claim.documents!.b.pageCount).toBe(1); // a count is a change, so b was written
    expect(Object.keys(out.texts)).toEqual(['b']);
  });

  it('labelClaim leaves Word and html files alone', async () => {
    const read = vi.fn(pdfBlob);
    const out = await labelClaim(claimOf([
      doc('w', { relPath: 'Estimate.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      doc('h', { relPath: 'Report.html', mime: 'text/html' }),
    ]), read, DEV);
    expect(read).not.toHaveBeenCalled();
    expect(out.texts).toEqual({});
  });

  it('labelClaim with cached() reads a fully labelled entry once for its text, then not again', async () => {
    mocks.pageCountOf.mockResolvedValue(1);
    mocks.pageTexts.mockResolvedValue(['Registration Certificate']);
    const full = doc('a', { pageCount: 1, pages: { 1: label({ confirmed: true }) } });
    const c = claimOf([full]);
    const read = vi.fn(pdfBlob);
    const first = await labelClaim(c, read, DEV, () => undefined);
    expect(read).toHaveBeenCalledTimes(1);
    expect(first.claim).toBe(c);
    expect(first.texts.a).toEqual(['Registration Certificate']);
    const second = await labelClaim(c, read, DEV, (d) => first.texts[d.id]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(second.texts).toEqual({});
  });

  it('labelClaim with cached() relabels an unlabelled entry from the cached text without reading the file', async () => {
    const c = claimOf([doc('a', { pageCount: 2 })]);
    const read = vi.fn(pdfBlob);
    const out = await labelClaim(c, read, DEV, () => ['Registration Certificate of vehicle', 'nothing useful']);
    expect(read).not.toHaveBeenCalled();
    expect(mocks.pageTexts).not.toHaveBeenCalled();
    expect(out.claim.documents!.a.pages![1]).toMatchObject({ type: 'rc', by: 'text', confirmed: false });
    expect(out.claim.documents!.a.pages![2]).toBeUndefined();
    expect(out.texts).toEqual({});
  });

  it('labelClaim with cached() treats an all-null cache as no text layer (name labelling still works)', async () => {
    const c = claimOf([doc('a', { relPath: 'RC Book.pdf', pageCount: 1 })]);
    const out = await labelClaim(c, vi.fn(pdfBlob), DEV, () => [null]);
    expect(out.claim.documents!.a.pages![1]).toMatchObject({ type: 'rc', by: 'name' });
  });
});

describe('label edits', () => {
  const set = { portal: 'nia', flow: 'nontieup', claimNo: 'x', builtAt: NOW, boxes: {
    rc: { name: 'RC.pdf', size: 1, pages: 1, sha256: 'x', sources: ['a'], reviewedAt: NOW },
    dl: { name: 'DL.pdf', size: 1, pages: 1, sha256: 'y', sources: ['b'], reviewedAt: NOW },
  } };

  it('setPageLabels confirms the pages as the surveyor and cancels the review of boxes that used the file', () => {
    const c = claimOf([doc('a', { pages: { 1: label() } })], { uploadSet: set });
    const patch = setPageLabels(c, 'a', [1, 2], 'dl')!;
    expect(patch.documents!.a.pages).toEqual({
      1: { type: 'dl', by: 'surveyor', confirmed: true },
      2: { type: 'dl', by: 'surveyor', confirmed: true },
    });
    expect(patch.uploadSet!.boxes.rc.reviewedAt).toBeUndefined();
    expect(patch.uploadSet!.boxes.dl.reviewedAt).toBe(NOW);
  });

  it('setPageLabels leaves uploadSet out when there is no review to cancel', () => {
    const patch = setPageLabels(claimOf([doc('a')]), 'a', [1], 'rc')!;
    expect(patch).not.toHaveProperty('uploadSet');
    expect(setPageLabels(claimOf([]), 'nope', [1], 'rc')).toBeNull();
  });

  it('confirmAllLabels confirms text/name labels on this device only', () => {
    const c = claimOf([
      doc('a', { pages: { 1: label(), 2: label({ by: 'name' }), 3: label({ by: 'known', confirmed: true }) } }),
      doc('b', { devices: ['Other PC'], pages: { 1: label() } }),
    ]);
    const patch = confirmAllLabels(c, DEV)!;
    expect(Object.values(patch.documents!.a.pages!).every((p) => p.confirmed)).toBe(true);
    expect(patch.documents!.b.pages![1].confirmed).toBe(false);
    expect(confirmAllLabels(claimOf([doc('z', { pages: { 1: label({ confirmed: true }) } })]), DEV)).toBeNull();
  });

  it('overrideLabel stamps overrideAt on that page and cancels its reviews', () => {
    const c = claimOf([doc('b', { pages: { 1: label({ type: 'dl' }) } })], { uploadSet: set });
    const patch = overrideLabel(c, 'b', 1, NOW)!;
    expect(patch.documents!.b.pages![1].overrideAt).toBe(NOW);
    expect(patch.uploadSet!.boxes.dl.reviewedAt).toBeUndefined();
    expect(patch.uploadSet!.boxes.rc.reviewedAt).toBe(NOW);
    expect(overrideLabel(c, 'b', 9, NOW)).toBeNull();
  });

  it('invalidateIfReviewed is null when nothing was reviewed', () => {
    const unreviewed = { ...set, boxes: { rc: { ...set.boxes.rc, reviewedAt: undefined } } };
    expect(invalidateIfReviewed(unreviewed, { claimFields: true })).toBeNull();
    expect(invalidateIfReviewed(set, { claimFields: true })!.boxes.rc.reviewedAt).toBeUndefined();
  });

  it('docIdsForPaths maps relPaths to ids', () => {
    const c = claimOf([doc('a', { relPath: 'x/RC.pdf' }), doc('b', { relPath: 'DL.pdf' })]);
    expect(docIdsForPaths(c, ['x/RC.pdf'])).toEqual(['a']);
  });
});

describe('build helpers', () => {
  const st = (id: string, status: BoxState['status'], parts: BoxState['parts']): BoxState =>
    ({ box: { id } as BoxState['box'], status, parts, missingTypes: [], reasons: [], alternatives: 0 });
  const states = [
    st('rc', 'ready', [{ docId: 'a', pages: [1] }]),
    st('dl', 'check', [{ docId: 'b', pages: [1] }]),
    st('kyc', 'missing', []),
    st('x', 'ready', []),
  ];

  it('buildable keeps ready and check boxes that have parts', () => {
    expect(buildable(states).map((s) => s.box.id)).toEqual(['rc', 'dl']);
  });

  it('blockedBoxes lists built boxes that are now check', () => {
    expect(blockedBoxes(states, ['rc', 'dl', 'kyc'])).toEqual(['dl']);
    expect(blockedBoxes(states, [])).toEqual([]);
  });
});

describe('identityMap', () => {
  it('checks each labelled page against its own text, memory only', () => {
    const c = claimOf([doc('a', { pages: { 1: label({ type: 'rc' }), 2: label({ type: 'dl' }) } })]);
    c.vehicle.registrationNumber = 'MH-18-AB-1234';
    const m = identityMap(c, DEV, { a: ['Registration Certificate MH 18 AB 1234 chassis and more padding text to pass the minimum length', null] });
    expect(m.a[1].status).toBe('match');
    expect(m.a[2].status).toBe('cantCheck');
  });
});

describe('claimDrift', () => {
  const started = claimOf([doc('a')]);
  it('same while the documents are the ones the work started from', () => {
    expect(claimDrift(started, started)).toBe('same');
    expect(claimDrift(started, { ...started, notNeededBoxes: {} })).toBe('same'); // only documents matter
  });
  it('edited when documents were replaced meanwhile (a label write, a scan)', () => {
    expect(claimDrift(started, { ...started, documents: { ...started.documents } })).toBe('edited');
  });
  it('switched when the current claim is another one or none', () => {
    expect(claimDrift(started, { ...started, id: 'other' })).toBe('switched');
    expect(claimDrift(started, null)).toBe('switched');
  });
});
