import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { newUploadSet, markReviewed, invalidate, isReviewed, planSig, reviewDone, staleBoxes, unbuilt } from '../kit/review';
import { checklist } from '../kit/checklist';
import { RECIPES } from '../kit/recipes';
import type { Recipe } from '../kit/recipes/types';

describe('staleBoxes (I-5)', () => {
  const DEV = 'PC1';
  const nia = RECIPES.find((r) => r.portal === 'nia' && r.flow === 'nontieup')!;
  const doc = (id: string, type: DocType, over: Partial<ClaimDocument> = {}): ClaimDocument => ({
    id, type, relPath: `${id}.pdf`, mime: 'application/pdf', size: 1, addedAt: '2026-10-01T00:00:00Z',
    source: 'upload', devices: [DEV], pages: { 1: { type, by: 'surveyor', confirmed: true } }, ...over,
  });
  const claimOf = (docs: ClaimDocument[], over: Partial<ClaimData> = {}): ClaimData => {
    const c = createBlankClaim();
    return {
      ...c, policy: { ...c.policy, insurerName: 'New India Assurance', claimNumber: 'CL/77' },
      vehicle: { ...c.vehicle, registrationNumber: 'MH18AB1234' },
      documents: Object.fromEntries(docs.map((d) => [d.id, d])), ...over,
    };
  };
  const statesOf = (c: ClaimData) => checklist(nia, c, { device: DEV, identity: {} });
  /** A set built from `c` the way the hook builds it: every buildable box, written when ready. */
  const buildFrom = (c: ClaimData, ids = ['rc', 'dl']) => newUploadSet(nia, c, Object.fromEntries(statesOf(c)
    .filter((s) => ids.includes(s.box.id))
    .map((s) => [s.box.id, { name: `${s.box.id}.pdf`, size: 1, pages: 1, sha256: 'x', sources: s.parts.map((p) => p.docId), planSig: planSig(s), written: s.status === 'ready' }])));
  const base = () => claimOf([doc('rc1', 'rc'), doc('dl1', 'dl')]);
  const stale = (set: ReturnType<typeof buildFrom>, c: ClaimData) => staleBoxes(set, statesOf(c), c, DEV);

  it('reviewDone: every box ticked, none blocked now, and no ready box without a file (N-1, N-3)', () => {
    const c = base();
    const all = markReviewed(buildFrom(c), 'all', '2026-10-21T00:00:00Z');
    expect(reviewDone(all, statesOf(c), [])).toBe(true);
    // a page found not to match after the review: blocked now, so not reviewed, but nothing is persisted
    expect(reviewDone(all, statesOf(c), ['rc'])).toBe(false);
    expect(all.boxes.rc.reviewedAt).toBeDefined();
    // a ready box that failed to build has no file in the set
    const partial = markReviewed(buildFrom(c, ['dl']), 'all', '2026-10-21T00:00:00Z');
    expect(unbuilt(partial, statesOf(c))).toEqual(['rc']);
    expect(reviewDone(partial, statesOf(c), [])).toBe(false);
  });

  it('nothing is stale while the claim is as built', () => {
    const c = base();
    expect(stale(buildFrom(c), c)).toEqual([]);
  });

  it('a removed source makes its box stale', () => {
    const c = base();
    const rest = Object.fromEntries(Object.entries(c.documents!).filter(([id]) => id !== 'rc1'));
    expect(stale(buildFrom(c), { ...c, documents: rest })).toEqual(['rc']);
  });

  it('a replaced source (labels reset) makes its box stale', () => {
    const c = base();
    const next = { ...c, documents: { ...c.documents, rc1: { ...c.documents!.rc1, pages: undefined } } };
    expect(stale(buildFrom(c), next)).toEqual(['rc']);
  });

  it('a different chosen source makes its box stale', () => {
    const c = base();
    const next = { ...c, documents: { ...c.documents, rc2: doc('rc2', 'rc', { addedAt: '2026-10-09T00:00:00Z' }) } };
    expect(stale(buildFrom(c), next)).toEqual(['rc']);
  });

  it('a claim-field edit (even one made while the tab was closed) makes every box stale', () => {
    const c = base();
    expect(stale(buildFrom(c), { ...c, driver: { ...c.driver, name: 'Someone Else' } })).toEqual(['dl', 'rc']); // recipe order
    expect(stale(buildFrom(c), { ...c, policy: { ...c.policy, insurerName: 'NIA Pune' } })).toEqual([]); // not an identity field
  });

  it('a not-needed toggle makes the box stale', () => {
    const c = base();
    expect(stale(buildFrom(c), { ...c, notNeededBoxes: { 'nia-nontieup': ['dl'] } })).toEqual(['dl']);
  });

  it('a box built for preview (check) that is now ready must be rebuilt to reach the folder', () => {
    const guess = claimOf([doc('rc1', 'rc', { pages: { 1: { type: 'rc', by: 'text', confirmed: false } } })]);
    const set = buildFrom(guess, ['rc']);
    expect(set.boxes.rc.written).toBe(false);
    expect(stale(set, guess)).toEqual([]);
    expect(stale(set, claimOf([doc('rc1', 'rc')]))).toEqual(['rc']);
  });

  it('a box whose source is on another device only is not judged here', () => {
    const c = base();
    const elsewhere = { ...c, documents: { ...c.documents, rc1: { ...c.documents!.rc1, devices: ['Office PC'] } } };
    expect(stale(buildFrom(c), elsewhere)).toEqual([]);
  });

  it('a set from before signatures were stored is stale', () => {
    const c = base();
    const old = newUploadSet(nia, c, { rc: { name: 'rc.pdf', size: 1, pages: 1, sha256: 'x', sources: ['rc1'] } });
    expect(stale(old, c)).toEqual(['rc']);
  });

  it('already stale boxes are not listed again', () => {
    const c = base();
    expect(stale(invalidate(buildFrom(c), { boxIds: ['rc'] }), { ...c, notNeededBoxes: { 'nia-nontieup': ['rc'] } })).toEqual([]);
  });
});

const recipe = { portal: 'nia', flow: 'tieup', title: 'T', boxes: [] } as unknown as Recipe;
const built = () => newUploadSet(recipe, createBlankClaim(), {
  rc: { name: 'RC Book.pdf', size: 1, pages: 1, sha256: 'x', sources: ['d1'], written: true },
  kyc: { name: 'KYC.pdf', size: 1, pages: 2, sha256: 'y', sources: ['d2', 'd3'], written: true },
});
const NOW = '2026-10-20T10:00:00Z';

describe('review', () => {
  it('source change cancels box review', () => {
    const set = markReviewed(built(), 'all', NOW);
    const next = invalidate(set, { docIds: ['d3'] });
    expect(next.boxes.rc.reviewedAt).toBe(NOW);
    expect(next.boxes.kyc.reviewedAt).toBeUndefined();
    expect(set.boxes.kyc.reviewedAt).toBe(NOW); // input not mutated
  });

  it('invalidate marks affected boxes stale', () => {
    const next = invalidate(markReviewed(built(), 'rc', NOW), { docIds: ['d1'] });
    expect(next.boxes.rc.stale).toBe(true);
    expect(next.boxes.rc.reviewedAt).toBeUndefined();
    expect(next.boxes.kyc.stale).toBeUndefined(); // untouched box
    expect(invalidate(built(), { claimFields: true }).boxes.kyc.stale).toBe(true); // stale even if never reviewed
  });

  it('newUploadSet starts fresh', () => {
    expect(Object.values(built().boxes).some((b) => b.stale || b.reviewedAt)).toBe(false);
  });

  it('claimFields change cancels all', () => {
    const next = invalidate(markReviewed(built(), 'all', NOW), { claimFields: true });
    expect(Object.values(next.boxes).some((b) => b.reviewedAt)).toBe(false);
  });

  it('markReviewed all refused while a box is blocked', () => {
    const set = built();
    expect(markReviewed(set, 'all', NOW, ['kyc'])).toBe(set);
    expect(markReviewed(set, 'kyc', NOW, ['kyc'])).toBe(set);
    expect(markReviewed(set, 'rc', NOW, ['kyc']).boxes.rc.reviewedAt).toBe(NOW);
  });

  it('markReviewed refuses a stale box, and all while any box is stale (M-3)', () => {
    const set = invalidate(built(), { docIds: ['d1'] });
    expect(markReviewed(set, 'rc', NOW)).toBe(set);
    expect(markReviewed(set, 'all', NOW)).toBe(set);
    expect(markReviewed(set, 'kyc', NOW).boxes.kyc.reviewedAt).toBe(NOW);
  });

  it('markReviewed refuses a box that was built for preview only (not in the folder)', () => {
    const set = newUploadSet(recipe, createBlankClaim(), { rc: { name: 'RC.pdf', size: 1, pages: 1, sha256: 'x', sources: ['d1'], written: false } });
    expect(markReviewed(set, 'rc', NOW)).toBe(set);
    expect(markReviewed(set, 'all', NOW)).toBe(set);
  });

  it('invalidate by box id marks only those boxes stale', () => {
    const next = invalidate(markReviewed(built(), 'all', NOW), { boxIds: ['kyc'] });
    expect(next.boxes.kyc).toMatchObject({ stale: true });
    expect(next.boxes.rc.reviewedAt).toBe(NOW);
  });

  it('isReviewed only when every box reviewed', () => {
    const one = markReviewed(built(), 'rc', NOW);
    expect(isReviewed(one)).toBe(false);
    expect(isReviewed(markReviewed(one, 'kyc', NOW))).toBe(true);
  });
});
