/** The surveyor's review of a built upload set: nothing reaches a portal unreviewed. */
import type { ClaimData } from '@/types/claim';
import type { UploadSet } from '@/types/documents';
import type { Recipe } from './recipes/types';

type Built = Record<string, { name: string; size: number; pages: number; sha256: string; sources: string[] }>;

export function newUploadSet(recipe: Recipe, claim: ClaimData, built: Built): UploadSet {
  return { portal: recipe.portal, flow: recipe.flow, claimNo: claim.policy.claimNumber, builtAt: new Date().toISOString(), boxes: built };
}

const mapBoxes = (set: UploadSet, fn: (id: string, b: UploadSet['boxes'][string]) => UploadSet['boxes'][string]): UploadSet => ({
  ...set,
  boxes: Object.fromEntries(Object.entries(set.boxes).map(([id, b]) => [id, fn(id, b)])),
});

/** 'all' is refused (set returned unchanged) while any box is blocked; so is a blocked boxId. */
export function markReviewed(set: UploadSet, boxId: string | 'all', now: string, blocked: string[] = []): UploadSet {
  if (boxId === 'all' ? blocked.length > 0 : blocked.includes(boxId) || !set.boxes[boxId]) return set;
  return mapBoxes(set, (id, b) => (boxId === 'all' || id === boxId ? { ...b, reviewedAt: now } : b));
}

/** A changed source document clears the review of every box that used it and marks it stale; a claim-field change does so for all. */
export function invalidate(set: UploadSet, change: { docIds?: string[]; claimFields?: boolean }): UploadSet {
  const changed = new Set(change.docIds ?? []);
  return mapBoxes(set, (_id, b) => {
    if (!change.claimFields && !b.sources.some((s) => changed.has(s))) return b;
    const { reviewedAt: _dropped, ...rest } = b;
    return { ...rest, stale: true };
  });
}

export const isReviewed = (set: UploadSet): boolean => Object.values(set.boxes).every((b) => !!b.reviewedAt);
