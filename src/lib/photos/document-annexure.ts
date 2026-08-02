import type { DocumentAnnexureOptions } from '@/types/assessment';

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
