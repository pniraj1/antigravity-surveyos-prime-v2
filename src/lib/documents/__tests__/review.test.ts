import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import { newUploadSet, markReviewed, invalidate, isReviewed } from '../kit/review';
import type { Recipe } from '../kit/recipes/types';

const recipe = { portal: 'nia', flow: 'tieup', title: 'T', boxes: [] } as unknown as Recipe;
const built = () => newUploadSet(recipe, createBlankClaim(), {
  rc: { name: 'RC Book.pdf', size: 1, pages: 1, sha256: 'x', sources: ['d1'] },
  kyc: { name: 'KYC.pdf', size: 1, pages: 2, sha256: 'y', sources: ['d2', 'd3'] },
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

  it('isReviewed only when every box reviewed', () => {
    const one = markReviewed(built(), 'rc', NOW);
    expect(isReviewed(one)).toBe(false);
    expect(isReviewed(markReviewed(one, 'kyc', NOW))).toBe(true);
  });
});
