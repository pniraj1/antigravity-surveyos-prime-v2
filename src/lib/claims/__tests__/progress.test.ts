import { describe, it, expect } from 'vitest';
import { createBlankClaim, type ClaimData } from '@/types/claim';
import type { ClaimDocument } from '@/types/documents';
import { claimProgress, tabMarks } from '../progress';

const doc = (type: ClaimDocument['type'], addedAt: string): ClaimDocument => ({
  id: `${type}-1`, type, relPath: `${type}.pdf`, mime: 'application/pdf', size: 1, addedAt, source: 'upload', devices: [],
});
const ids = (c: ClaimData) => claimProgress(c).steps.map((s) => s.id);
const allVerified = (c: ClaimData): ClaimData => ({
  ...c,
  documentVerification: Object.fromEntries(
    Object.entries(c.documentVerification).map(([k, v]) => [k, { ...v, status: 'YES' }]),
  ) as ClaimData['documentVerification'],
});

describe('claimProgress', () => {
  it('blank final claim: next is docs, done 0, total 11 (reinspection optional, portalReady na), no throw with documents undefined', () => {
    const c = createBlankClaim('final');
    expect(c.documents).toBeUndefined();
    const p = claimProgress(c);
    expect(p.next?.id).toBe('docs');
    expect(p.done).toBe(0);
    expect(p.total).toBe(11);
    expect(p.steps.find((s) => s.id === 'reinspection')?.status).toBe('optional');
    expect(p.steps.find((s) => s.id === 'portalReady')?.status).toBe('na');
  });

  it("blank checklist values '' do not count; all YES/N.A. makes docs done", () => {
    const c = createBlankClaim('final');
    const blank = {
      ...c,
      documentVerification: Object.fromEntries(
        Object.entries(c.documentVerification).map(([k, v]) => [k, { ...v, status: '' }]),
      ) as unknown as ClaimData['documentVerification'],
    };
    expect(claimProgress(blank).steps[0].status).toBe('waiting');
    expect(claimProgress(allVerified(c)).steps[0].status).toBe('done');
    const na = { ...c, documentVerification: { ...allVerified(c).documentVerification, fir: { status: 'N.A.', detail: '' } } } as ClaimData;
    expect(claimProgress(na).steps[0].status).toBe('done');
  });

  it('final waiting for bill: estimate document + printedAt.surveyReport → next.id === bill, since === surveyReport print time', () => {
    const c: ClaimData = {
      ...allVerified(createBlankClaim('final')),
      documents: { e: doc('estimate', '2026-11-01T10:00:00Z') },
      printedAt: { surveyReport: '2026-11-02T10:00:00Z' },
    };
    const p = claimProgress(c);
    expect(p.next?.id).toBe('bill');
    expect(p.since).toBe('2026-11-02T10:00:00Z');
  });

  it('reinspection is optional unless reinspectionNeeded; needed and unprinted → waiting', () => {
    const c = createBlankClaim('final');
    const st = (x: ClaimData) => claimProgress(x).steps.find((s) => s.id === 'reinspection')?.status;
    expect(st(c)).toBe('optional');
    expect(st({ ...c, reinspectionNeeded: true })).toBe('waiting');
    expect(st({ ...c, reinspectionNeeded: true, printedAt: { reinspectionReport: 'x' } })).toBe('done');
  });

  it('portalReady is na without uploadSet', () => {
    const p = claimProgress(createBlankClaim('final'));
    expect(p.steps.find((s) => s.id === 'portalReady')?.status).toBe('na');
  });

  it('spot claim never contains estimate/bill steps; total 9', () => {
    const c = createBlankClaim('spot');
    expect(ids(c)).not.toContain('estimate');
    expect(ids(c)).not.toContain('bill');
    expect(claimProgress(c).total).toBe(9);
  });

  it('valuation claim starts at inspection; total 8', () => {
    const p = claimProgress(createBlankClaim('valuation'));
    expect(p.next?.id).toBe('inspection');
    expect(p.total).toBe(8);
  });

  it('completedAt set → next is null', () => {
    const c = { ...createBlankClaim('final'), completedAt: '2026-11-20T00:00:00Z' };
    expect(claimProgress(c).next).toBeNull();
  });

  it("tabMarks: next tab marked 'next', fully done tab 'done'", () => {
    const c = allVerified(createBlankClaim('final'));
    const marks = tabMarks(claimProgress(c));
    expect(marks.documents).toBe('next');
    const p = claimProgress({ ...c, printedAt: { surveyReport: 'a', billCheckReport: 'b' }, documents: { e: doc('estimate', 'z') } });
    // reports tab: surveyPrinted + billCheckPrinted done
    expect(tabMarks(p).reports).toBe('done');
    expect(tabMarks(p).details).toBe('done');
  });

  it('estimate at is the earliest addedAt; assessmentRows and billTotal fallbacks; spot photo tag; billChecked at', () => {
    const f = allVerified(createBlankClaim('final'));
    const at = (c: ClaimData, id: string) => claimProgress(c).steps.find((s) => s.id === id);
    const two = { ...f, documents: { b: doc('estimate', '2026-11-05T00:00:00Z'), a: doc('estimate', '2026-11-01T00:00:00Z') } };
    expect(at(two, 'estimate')?.at).toBe('2026-11-01T00:00:00Z');
    const rows = { ...f, assessmentRows: [{}] as unknown as ClaimData['assessmentRows'] };
    expect(at(rows, 'estimate')?.status).toBe('done');
    expect(at({ ...f, billCheck: { ...f.billCheck, billTotal: 500 } }, 'bill')?.status).toBe('done');
    const checked = { ...f, billCheck: { ...f.billCheck, verifiedBySurveyor: true, verifiedAt: '2026-11-09T00:00:00Z' } };
    expect(at(checked, 'billChecked')?.at).toBe('2026-11-09T00:00:00Z');
    const spot = createBlankClaim('spot');
    const tagged = { ...spot, photos: [{ tag: 'spot' }] as unknown as ClaimData['photos'] };
    expect(claimProgress(tagged).steps.find((s) => s.id === 'spotPhotos')?.status).toBe('done');
  });

  it('portalReady: ignores unwritten boxes, needs a written box, stale waits', () => {
    const f = createBlankClaim('final');
    const box = (o: object) => ({ name: 'n', size: 1, pages: 1, sha256: 'x', sources: [], ...o });
    const withBoxes = (boxes: Record<string, object>): ClaimData =>
      ({ ...f, uploadSet: { boxes: Object.fromEntries(Object.entries(boxes).map(([k, v]) => [k, box(v)])) } as unknown as ClaimData['uploadSet'] });
    const pr = (c: ClaimData) => claimProgress(c).steps.find((s) => s.id === 'portalReady');
    expect(pr(withBoxes({}))?.status).toBe('waiting');
    const ok = withBoxes({ a: { reviewedAt: '2026-11-03T00:00:00Z' }, b: { written: false } });
    expect(pr(ok)?.status).toBe('done');
    expect(pr(ok)?.at).toBe('2026-11-03T00:00:00Z');
    expect(pr(withBoxes({ a: { reviewedAt: 'z' }, c: { reviewedAt: 'z', stale: true } }))?.status).toBe('waiting');
  });

  it('tabMarks: a tab with only optional/na steps gets no mark', () => {
    const marks = tabMarks(claimProgress(createBlankClaim('final')));
    expect(marks.reinspection).toBeUndefined();
  });
});

describe('claimProgress tolerance', () => {
  it('a bare { id, surveyType } claim does not throw and waits on docs', () => {
    const p = claimProgress({ id: 'x', surveyType: 'final' } as unknown as ClaimData);
    expect(p.next?.id).toBe('docs');
  });
  it('an unknown surveyType falls back to the final list', () => {
    const p = claimProgress({ id: 'x' } as unknown as ClaimData);
    expect(p.next?.id).toBe('docs');
  });
});
