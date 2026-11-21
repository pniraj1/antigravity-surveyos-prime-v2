import type { ClaimData } from '@/types/claim';
import type { AppTab } from '@/stores/ui-store';
import { getClaim, saveClaim } from '@/lib/storage/indexeddb';
import { useClaimStore } from '@/stores/claim-store';
import { claimProgress } from './progress';

/** Returns a copy of `claim` with `key` set to `value`, or removed when `value` is empty. */
function withOptional<K extends 'courieredAt' | 'portalUploadedAt' | 'heldNote'>(
  claim: ClaimData, key: K, value: string,
): ClaimData {
  const { [key]: _old, ...rest } = claim;
  return (value ? { ...rest, [key]: value } : rest) as ClaimData;
}

export const withCourieredAt = (claim: ClaimData, date: string): ClaimData =>
  withOptional(claim, 'courieredAt', date);

export const withPortalUploaded = (claim: ClaimData, uploaded: boolean, nowIso: string): ClaimData =>
  withOptional(claim, 'portalUploadedAt', uploaded ? nowIso : '');

export const withHeldNote = (claim: ClaimData, note: string): ClaimData =>
  withOptional(claim, 'heldNote', note.trim());

export interface ProgressSummary {
  label: string | null;
  done: number;
  total: number;
  since?: string;
  nextTab: AppTab | null;
}

export function progressSummary(claim: ClaimData): ProgressSummary {
  const p = claimProgress(claim);
  return {
    label: p.next ? `Waiting: ${p.next.label}` : null,
    done: p.done,
    total: p.total,
    since: p.since,
    nextTab: p.next?.tab ?? null,
  };
}

/** Applies `fn` to each stored claim, saves it, and broadcasts once. Returns the count saved. */
export async function applyToClaims(ids: string[], fn: (c: ClaimData) => ClaimData): Promise<number> {
  const now = new Date().toISOString();
  const open = useClaimStore.getState().currentClaim;
  let saved = 0;
  for (const id of ids) {
    const full = await getClaim(id);
    if (!full) continue;
    const next = { ...fn(full), updatedAt: now };
    await saveClaim(next);
    // Keep an open claim in step so it can't later overwrite the stored change.
    if (open?.id === id) useClaimStore.getState().updateClaim(next);
    saved++;
  }
  if (saved > 0) {
    const ch = new BroadcastChannel('surveyos_claims_sync');
    ch.postMessage('CLAIMS_UPDATED');
    ch.close();
  }
  return saved;
}
