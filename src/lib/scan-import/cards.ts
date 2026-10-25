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
