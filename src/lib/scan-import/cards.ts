/** Which Documents-tab card a phone file belongs to. Pure: no React, no store. */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { FIELD_KEY_TO_DOC_TYPE } from '@/types/documents';
import { claimDocuments } from '@/lib/documents/index-ops';

/** DocType → card id; the inverse of FIELD_KEY_TO_DOC_TYPE without `other` (auth, load-challan). */
export const CARD_DOC_TYPES: Readonly<Partial<Record<DocType, string>>> = Object.fromEntries(
  Object.entries(FIELD_KEY_TO_DOC_TYPE)
    .filter(([, type]) => type !== 'other')
    .map(([cardId, type]) => [type, cardId]),
);

export function cardIdFor(type: DocType): string | null {
  return CARD_DOC_TYPES[type] ?? null;
}

/** The newest `'scan'` document of the card's type, or null. */
export function phoneFileFor(claim: Pick<ClaimData, 'documents'>, cardId: string): ClaimDocument | null {
  const type = FIELD_KEY_TO_DOC_TYPE[cardId];
  if (!type || type === 'other') return null;
  const hits = claimDocuments(claim).filter((d) => d.type === type && d.source === 'scan');
  return hits[hits.length - 1] ?? null; // claimDocuments sorts oldest first
}

/** What a card says about its phone file: unread card → 'fresh'; read card with a phone file newer than the read → 'newer'. */
export function cardPhoneState(phone: ClaimDocument | null, isRead: boolean, readAt?: string): 'fresh' | 'newer' | null {
  if (!phone) return null;
  if (!isRead) return 'fresh';
  // ponytail: no read time is stored on the claim yet, so a read card shows its plain read state; pass `readAt` once one is.
  return readAt && phone.addedAt > readAt ? 'newer' : null;
}

/** `'scan'` documents with no card, grouped by type in first-seen order (oldest first): the Phone files list. */
export function phoneListGroups(claim: Pick<ClaimData, 'documents'>): Array<{ type: DocType; docs: ClaimDocument[] }> {
  const groups = new Map<DocType, ClaimDocument[]>();
  for (const d of claimDocuments(claim)) {
    if (d.source !== 'scan' || cardIdFor(d.type)) continue;
    groups.set(d.type, [...(groups.get(d.type) ?? []), d]);
  }
  return [...groups].map(([type, docs]) => ({ type, docs }));
}
