import type {
  DocumentAnnexureOptions,
  PhotoItem,
  DocumentLayout,
} from '@/types/assessment';

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

// ─── A4 constants (points) ──────────────────────────────
// A4 portrait 595 x 842, landscape 842 x 595.
export const DOC_HEADER_H = 45;
export const DOC_FOOTER_H = 25;
/**
 * The attestation strip reserves a FIXED height whenever `verified` is on,
 * regardless of which optional lines are enabled. Sizing it to its content
 * would make every cell dimension depend on the licence and place/date
 * checkboxes, so ticking a checkbox would silently reflow the annexure.
 */
export const DOC_STRIP_H = 95;

export interface DocLayoutConfig {
  cols: number;
  rows: number;
  /** Cell width in points. */
  cellW: number;
  /** Cell height in points. */
  cellH: number;
  gap: number;
  perPage: number;
  pagePortrait: boolean;
}

type LayoutOpts = Pick<
  DocumentAnnexureOptions,
  'pagePadding' | 'cellGap' | 'verified'
>;

/**
 * Build the annexure grid. Mirrors buildLayout() in PhotoSheetDocument, but
 * documents are fitted with objectFit:'contain' rather than 'fill' — a
 * stretched document under a signed VERIFIED stamp is altered evidence.
 */
export function buildDocLayout(
  layout: DocumentLayout,
  opts: LayoutOpts,
  pagePortrait: boolean,
): DocLayoutConfig {
  const pad = opts.pagePadding;
  const g = opts.cellGap;

  const pageW = pagePortrait ? 595 : 842;
  const pageH = pagePortrait ? 842 : 595;

  const gridW = pageW - pad * 2;
  const gridH =
    pageH - pad * 2 - DOC_HEADER_H - DOC_FOOTER_H - (opts.verified ? DOC_STRIP_H : 0);

  const cols = layout === 1 ? 1 : 2;
  const rows = layout === 4 ? 2 : 1;

  return {
    cols,
    rows,
    cellW: (gridW - g * (cols - 1)) / cols,
    cellH: (gridH - g * (rows - 1)) / rows,
    gap: g,
    perPage: layout,
    pagePortrait,
  };
}
