/** The surveyor's review of a built upload set: nothing reaches a portal unreviewed. */
import type { ClaimData } from '@/types/claim';
import type { UploadSet } from '@/types/documents';
import { onThisDevice } from '../index-ops';
import { planBox } from './build';
import type { BoxState } from './checklist';
import type { Recipe } from './recipes/types';

type Built = Record<string, { name: string; size: number; pages: number; sha256: string; sources: string[]; planSig?: string; written?: boolean }>;

/** The claim fields the identity checks compare against. */
export const identityFieldsKey = (claim: ClaimData): string =>
  [claim.vehicle.registrationNumber, claim.vehicle.chassisNumber, claim.driver.name,
    claim.policy.policyNumber, claim.policy.claimNumber, claim.policy.insuredName].join('|');

/** FNV-1a. ponytail: change detection only, not secrecy; the fields themselves are on the same claim. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

export const fieldsSig = (claim: ClaimData): string => hash(identityFieldsKey(claim));

/** The documents and pages a box's file is made from, as a string. */
export const planSig = (state: BoxState): string => planBox(state).map((p) => `${p.docId}:${p.pages.join(',')}`).join(';');

export function newUploadSet(recipe: Recipe, claim: ClaimData, built: Built): UploadSet {
  return {
    portal: recipe.portal, flow: recipe.flow, claimNo: claim.policy.claimNumber, builtAt: new Date().toISOString(),
    fieldsSig: fieldsSig(claim), boxes: built,
  };
}

const mapBoxes = (set: UploadSet, fn: (id: string, b: UploadSet['boxes'][string]) => UploadSet['boxes'][string]): UploadSet => ({
  ...set,
  boxes: Object.fromEntries(Object.entries(set.boxes).map(([id, b]) => [id, fn(id, b)])),
});

/** A box that can't be reviewed whatever the screen shows: changed since it was built, or never written to the folder. */
const unreviewable = (b: UploadSet['boxes'][string]): boolean => !!b.stale || b.written === false;

/** 'all' is refused (set returned unchanged) while any box is blocked, stale or unwritten; so is such a boxId. */
export function markReviewed(set: UploadSet, boxId: string | 'all', now: string, blocked: string[] = []): UploadSet {
  const refused = boxId === 'all'
    ? blocked.length > 0 || Object.values(set.boxes).some(unreviewable)
    : blocked.includes(boxId) || !set.boxes[boxId] || unreviewable(set.boxes[boxId]);
  if (refused) return set;
  return mapBoxes(set, (id, b) => (boxId === 'all' || id === boxId ? { ...b, reviewedAt: now } : b));
}

/**
 * A changed source document clears the review of every box that used it and marks it stale; so does naming the
 * box itself (`boxIds`); a claim-field change does so for all.
 */
export function invalidate(set: UploadSet, change: { docIds?: string[]; boxIds?: string[]; claimFields?: boolean }): UploadSet {
  const changed = new Set(change.docIds ?? []);
  return mapBoxes(set, (id, b) => {
    if (!change.claimFields && !change.boxIds?.includes(id) && !b.sources.some((s) => changed.has(s))) return b;
    const { reviewedAt: _dropped, ...rest } = b;
    return { ...rest, stale: true };
  });
}

/**
 * Boxes whose built file no longer is what the checklist would build now (I-5): another plan (a source removed,
 * replaced or swapped; marked not needed), an edited identity field, or a box built for preview that is now
 * ready and must be rebuilt to reach the folder. Judged only where the sources are (C3); `states` must be for
 * the set's own recipe.
 */
export function staleBoxes(set: UploadSet, states: BoxState[], claim: ClaimData, device: string): string[] {
  const fieldsChanged = set.fieldsSig !== fieldsSig(claim);
  return Object.entries(set.boxes).filter(([id, b]) => {
    if (b.stale) return false;
    if (fieldsChanged) return true;
    if (b.sources.some((s) => { const d = claim.documents?.[s]; return d && !onThisDevice(d, device); })) return false;
    const state = states.find((s) => s.box.id === id);
    if (!state || b.planSig !== planSig(state)) return true;
    return b.written === false && state.status === 'ready';
  }).map(([id]) => id);
}

export const isReviewed = (set: UploadSet): boolean => Object.values(set.boxes).every((b) => !!b.reviewedAt);

/** Ready boxes the set has no file for: their build failed, or they weren't ready when it was built. */
export const unbuilt = (set: UploadSet, states: BoxState[]): string[] =>
  states.filter((s) => s.status === 'ready' && !set.boxes[s.box.id]).map((s) => s.box.id);

/**
 * The whole set is reviewed only while every box is ticked, none is blocked now (a page found not to match
 * after the tick), and no ready box lacks a file. Derived, not stored, so a reload never cancels a review.
 */
export const reviewDone = (set: UploadSet, states: BoxState[], blocked: string[]): boolean =>
  isReviewed(set) && !blocked.length && !unbuilt(set, states).length;
