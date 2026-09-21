/**
 * Claim Documents — the typed index that lives on the claim record.
 * Bytes live in the surveyor's folder (src/lib/documents/folder.ts); this
 * file is metadata only (spec D1).
 */

export type DocType =
  | 'rc' | 'dl' | 'policy' | 'claimForm' | 'estimate' | 'supplementaryEstimate'
  | 'invoice' | 'fir' | 'puc' | 'permit' | 'fitness' | 'cancelledCheque'
  | 'chassisPhoto' | 'odometerPhoto' | 'photoFront' | 'photoRear' | 'photoLeft' | 'photoRight'
  | 'spotPhotos' | 'damagePhotos'
  | 'surveyReport' | 'billCheckReport' | 'feeBill' | 'reinspectionReport'
  | 'niaAssessmentExcel' | 'insuredSummary'
  | 'workApproval' | 'deliveryOrder' | 'other';

export type PhotoTag = 'front' | 'rear' | 'left' | 'right' | 'chassis' | 'odometer' | 'spot' | 'damage';

export interface ClaimDocument {
  id: string;
  type: DocType;
  /** Relative to the claim folder, e.g. "RC Book.pdf" or "Damage Photos/Damage Photos 3.jpg". */
  relPath: string;
  mime: string;
  size: number;
  addedAt: string;
  source: 'upload' | 'generated' | 'photo';
  /** Labels of the devices whose folder holds the bytes (spec D5). */
  devices: string[];
}

/** Human label; doubles as the file stem, so keep it Windows-safe. */
export const DOC_TYPE_LABEL: Record<DocType, string> = {
  rc: 'RC Book',
  dl: 'Driving Licence',
  policy: 'Policy Schedule',
  claimForm: 'Claim Form',
  estimate: 'Estimate',
  supplementaryEstimate: 'Supplementary Estimate',
  invoice: 'Invoice',
  fir: 'FIR',
  puc: 'PUC',
  permit: 'Permit',
  fitness: 'Fitness Certificate',
  cancelledCheque: 'Cancelled Cheque',
  chassisPhoto: 'Chassis Number Photo',
  odometerPhoto: 'Odometer Photo',
  photoFront: 'Front Photo',
  photoRear: 'Rear Photo',
  photoLeft: 'Left Side Photo',
  photoRight: 'Right Side Photo',
  spotPhotos: 'Spot Photos',
  damagePhotos: 'Damage Photos',
  surveyReport: 'Final Survey Report',
  billCheckReport: 'Bill Check Report',
  feeBill: 'Fee Bill',
  reinspectionReport: 'Reinspection Report',
  niaAssessmentExcel: 'Primary Assessment Template',
  insuredSummary: 'Insured Summary',
  workApproval: 'Work Approval',
  deliveryOrder: 'Delivery Order',
  other: 'Other',
};

/** Types that hold many files in a subfolder; everything else is one file per claim. */
export const MULTI_FILE_TYPES: ReadonlySet<DocType> = new Set<DocType>(['damagePhotos', 'spotPhotos', 'other']);

/** DocumentsTab slot id → document type. Slots with no portal meaning go to `other`. */
export const FIELD_KEY_TO_DOC_TYPE: Record<string, DocType> = {
  rc: 'rc',
  dl: 'dl',
  policy: 'policy',
  claim: 'claimForm',
  fir: 'fir',
  'final-bill': 'invoice',
  permit: 'permit',
  auth: 'other',
  fitness: 'fitness',
  'load-challan': 'other',
};

const TAG_TO_DOC_TYPE: Record<PhotoTag, DocType> = {
  front: 'photoFront',
  rear: 'photoRear',
  left: 'photoLeft',
  right: 'photoRight',
  chassis: 'chassisPhoto',
  odometer: 'odometerPhoto',
  spot: 'spotPhotos',
  damage: 'damagePhotos',
};

export function tagToDocType(tag: PhotoTag | undefined): DocType {
  return TAG_TO_DOC_TYPE[tag ?? 'damage'];
}
