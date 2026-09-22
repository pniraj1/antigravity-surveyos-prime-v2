/** Pure operations on the claim's document index. Every function returns a new claim. */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument } from '@/types/documents';

export function newDocId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function claimDocuments(claim: Pick<ClaimData, 'documents'>): ClaimDocument[] {
  return Object.values(claim.documents ?? {}).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export function addDocuments(claim: ClaimData, docs: ClaimDocument[]): ClaimData {
  const documents = { ...(claim.documents ?? {}) };
  for (const d of docs) documents[d.id] = d;
  return { ...claim, documents };
}

export function removeDocument(claim: ClaimData, id: string): ClaimData {
  const documents = { ...(claim.documents ?? {}) };
  delete documents[id];
  return { ...claim, documents };
}

export function onThisDevice(doc: ClaimDocument, label: string): boolean {
  return doc.devices.includes(label);
}

/**
 * True when `old` is a stand-in this app wrote unprompted — the report HTML
 * saved at print time — and a real document of the same type is replacing it.
 * Only then may its file be deleted rather than kept as `(old)` (spec D8).
 * A surveyor's own file, and our own non-HTML outputs, are never discardable.
 */
export function isDiscardablePlaceholder(old: ClaimDocument, incomingMime: string): boolean {
  return old.source === 'generated'
    && old.mime === 'text/html'
    && incomingMime !== ''
    && !incomingMime.includes('text/html');
}
