import { describe, it, expect } from 'vitest';
import { DOC_TYPE_LABEL } from '@/types/documents';
import type { DocType } from '@/types/documents';
import { docTypeFromRelPath, isScanSkippable } from '../naming';

const ALL_TYPES: DocType[] = [
  'rc', 'dl', 'policy', 'claimForm', 'estimate', 'supplementaryEstimate',
  'invoice', 'fir', 'puc', 'permit', 'fitness', 'cancelledCheque',
  'chassisPhoto', 'odometerPhoto', 'photoFront', 'photoRear', 'photoLeft', 'photoRight',
  'spotPhotos', 'damagePhotos',
  'surveyReport', 'billCheckReport', 'feeBill', 'reinspectionReport',
  'niaAssessmentExcel', 'insuredSummary',
  'workApproval', 'deliveryOrder', 'other',
  'aadhaar', 'pan', 'ckyc', 'kycOther', 'claimIntimation',
  'dischargeVoucher', 'csr', 'investigationReport', 'rcBack', 'dlBack',
];

describe('kit types', () => {
  it('every DocType has a label', () => {
    expect(ALL_TYPES).toHaveLength(39);
    for (const t of ALL_TYPES) expect(DOC_TYPE_LABEL[t]).toBeTruthy();
    expect(Object.keys(DOC_TYPE_LABEL)).toHaveLength(39);
  });

  it('docTypeFromRelPath recognises common words', () => {
    expect(docTypeFromRelPath('aadhar.pdf')).toBe('aadhaar');
    expect(docTypeFromRelPath('Aadhaar Card.pdf')).toBe('aadhaar');
    expect(docTypeFromRelPath('pan card.jpg')).toBe('pan');
    expect(docTypeFromRelPath('cancelled cheque.pdf')).toBe('cancelledCheque');
    expect(docTypeFromRelPath('RC.pdf')).toBe('rc');
    expect(docTypeFromRelPath('dl front.jpg')).toBe('dl');
    expect(docTypeFromRelPath('Scan_0001.pdf')).toBe('other');
    expect(docTypeFromRelPath('Fee Bill.pdf')).toBe('feeBill');
    expect(docTypeFromRelPath('Bill 2.pdf')).toBe('invoice');
  });

  it('Portal Upload is skipped', () => {
    expect(isScanSkippable('Portal Upload/New India/Driving Licence.pdf')).toBe(true);
    expect(isScanSkippable('RC Book.pdf')).toBe(false);
  });
});
