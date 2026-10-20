import { single, type Recipe } from './types';

export const UIIC_CLAIMSURVEY: Recipe = {
  portal: 'uiic',
  flow: 'claimsurvey',
  title: 'UIIC ClaimSurvey',
  boxes: [
    single('surveyReport', 'Survey Report', true),
    single('billCheckReport', 'Assessment Details', true),
    single('estimate', 'Estimate', true),
    single('invoice', 'Invoice', true),
    single('reinspectionReport', 'Re-Inspection Report', true),
    single('dl', 'Driving License', false),
    single('rc', 'Registration Certificate', false),
    single('photoFront', 'Front Photograph', false),
    single('photoRear', 'Rear Photograph', false),
    single('photoLeft', 'Left Photograph', false),
    single('photoRight', 'Right Photograph', false),
    single('chassisPhoto', 'Chassis Number Photograph', false), // provisional per spec §8(d)
    single('permit', 'Permit', false),
    single('fitness', 'Fitness Certificate', false),
    single('fir', 'FIR', false),
    single('csr', 'CSR', false),
    single('pan', 'PAN Card', false),
    single('aadhaar', 'Aadhaar Card', false),
    single('cancelledCheque', 'Cancelled Cheque', false),
    single('claimForm', 'Claim Form', false),
    single('dischargeVoucher', 'Discharge Voucher', false),
    single('ckyc', 'CKYC', false),
    single('investigationReport', 'Investigation Report', false),
    single('feeBill', 'Other 1 (Fee Bill)', false),
  ],
};
