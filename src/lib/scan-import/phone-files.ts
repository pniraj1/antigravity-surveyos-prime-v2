/** Phone (`'scan'`) files offered by the Use phone files pickers. Pure: no React, no store. */
import type { ClaimData } from '@/types/claim';
import type { PhotoItem } from '@/types/assessment';
import type { ClaimDocument, DocType, PhotoTag } from '@/types/documents';
import { DOC_TYPE_LABEL, DOC_TYPE_TO_TAG } from '@/types/documents';
import { claimDocuments } from '@/lib/documents/index-ops';

type Claim = Pick<ClaimData, 'documents'>;

/** `'scan'` documents of the given types, newest first. */
export function phoneFilesOfTypes(claim: Claim, types: readonly DocType[]): ClaimDocument[] {
  return claimDocuments(claim).filter((d) => d.source === 'scan' && types.includes(d.type)).reverse();
}

/** Photo groups in the order the Phone photos dialog shows them. No `riPhotos` DocType exists yet. */
const PHOTO_GROUPS: readonly DocType[] = [
  'damagePhotos', 'spotPhotos', 'photoFront', 'photoRear', 'photoLeft', 'photoRight', 'chassisPhoto', 'odometerPhoto',
];

export interface PhotoGroup { type: DocType; label: string; tag?: PhotoTag; docs: ClaimDocument[] }

/** `'scan'` photos grouped by type (oldest first within a group: capture order); empty groups are left out. */
export function photoGroups(claim: Claim): PhotoGroup[] {
  const scans = claimDocuments(claim).filter((d) => d.source === 'scan');
  return PHOTO_GROUPS.map((type) => ({
    type,
    label: type === 'damagePhotos' ? 'Final Photos' : DOC_TYPE_LABEL[type],
    tag: DOC_TYPE_TO_TAG[type],
    docs: scans.filter((d) => d.type === type),
  })).filter((g) => g.docs.length > 0);
}

/** Name a photo gets on the sheet from its file name (the Gallery / Browse rule). */
export const photoNameOf = (fileName: string): string => fileName.split('.')[0].substring(0, 30);

/** Sheet tag for a group. Final Photos are ordinary damage photos: no tag, like the sheet's "Damage" choice. */
export const tagFromGroup = (group: Pick<PhotoGroup, 'tag'>): PhotoTag | undefined =>
  group.tag === 'damage' ? undefined : group.tag;

/** Phone photos not yet on the sheet: matched by source doc id, or by name for photos stored without one. */
export function skipsAlreadyAdded(docs: readonly ClaimDocument[], photos: readonly PhotoItem[]): ClaimDocument[] {
  const ids = new Set(photos.map((p) => p.sourceDocId).filter(Boolean));
  const names = new Set(photos.filter((p) => !p.sourceDocId && p.kind !== 'document').map((p) => p.name));
  return docs.filter((d) => !ids.has(d.id) && !names.has(photoNameOf(d.relPath.split('/').pop() ?? d.relPath)));
}
