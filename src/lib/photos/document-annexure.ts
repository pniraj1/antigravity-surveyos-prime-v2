import type { DocumentAnnexureOptions, PhotoItem } from '@/types/assessment';

/**
 * Default is 2-up portrait, not 1-up. Because images are fitted with
 * objectFit:'contain', a tall phone screenshot (aspect ~0.45) is height-limited
 * in a wide cell: at 1-up portrait it renders 287pt wide, at 2-up 273pt — a 5%
 * legibility gain for double the paper. See the design spec for the full table.
 */
export const DEFAULT_DOCUMENT_ANNEXURE_OPTIONS: DocumentAnnexureOptions = {
  layout: 2,
  pageOrientation: 'portrait',
  verified: false,
  showLicence: true,
  showDatePlace: true,
  place: '',
  verifiedDate: '',
  pagePadding: 20,
  cellGap: 8,
  showBorder: true,
  borderColor: '#E5E7EB',
};

/**
 * Read a claim's annexure options, filling anything absent from the defaults.
 * Claims created before this feature have no `documentAnnexure` at all, and
 * older persisted claims may carry only some of its fields, so every consumer
 * must go through here rather than reading `claim.documentAnnexure` directly.
 */
export function resolveAnnexureOptions(
  stored: Partial<DocumentAnnexureOptions> | undefined,
): DocumentAnnexureOptions {
  return { ...DEFAULT_DOCUMENT_ANNEXURE_OPTIONS, ...stored };
}

/** A photo paired with its index into the claim's full `photos` array. */
export interface IndexedPhoto {
  item: PhotoItem;
  /**
   * Index into `claim.photos`. Always pass THIS to deletePhoto /
   * updatePhotoName / replacePhotoImage — never the filtered position, or you
   * will mutate the wrong image.
   */
  index: number;
}

/**
 * Split a claim's photos into the damage sheet's items and the annexure's,
 * keeping each item's real array index. Single source of truth for the
 * kind filter, so the two PDF documents can never disagree about ownership.
 */
export function partitionPhotos(photos: readonly PhotoItem[]): {
  damage: IndexedPhoto[];
  documents: IndexedPhoto[];
} {
  const damage: IndexedPhoto[] = [];
  const documents: IndexedPhoto[] = [];

  photos.forEach((item, index) => {
    if (item.kind === 'document') {
      documents.push({ item, index });
    } else {
      damage.push({ item, index });
    }
  });

  return { damage, documents };
}
