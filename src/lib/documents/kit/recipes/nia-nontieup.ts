import { DEFAULT_FORMATS, merge, single, type Recipe } from './types';

export const NIA_CLAIM_RELATED_DOCS = merge(
  'claimRelatedDocs', 'Claim Related Documents', true,
  ['policy', 'aadhaar', 'pan', 'ckyc', 'cancelledCheque', 'claimIntimation', 'kycOther'],
  ['aadhaar', 'policy'],
);

export const NIA_NONTIEUP: Recipe = {
  portal: 'nia',
  flow: 'nontieup',
  title: 'NIA Non-Tieup',
  boxes: [
    single('dl', 'Driving License', true),
    single('rc', 'Registration Certificate', true),
    single('claimForm', 'Claim Form', true),
    single('chassisPhoto', 'Chassis Number Photograph', true),
    single('odometerPhoto', 'Odometer Reading Photograph', true),
    NIA_CLAIM_RELATED_DOCS,
    single('estimate', 'Estimate', false, 'estimate', [...DEFAULT_FORMATS, '.xlsx']), // the NIA Excel
    single('puc', 'PUC', false),
    merge('spot', 'Spot Photograph and Spot Survey Report', false, ['spotPhotos']),
    merge('permitFitness', 'Permit-Fitness', false, ['permit', 'fitness']),
    single('fir', 'FIR and Police Records', false),
    single('cancelledCheque', 'Cancelled Cheque', false),
    merge('photos', 'Front/Rear/Side Photograph', false, ['photoFront', 'photoRear', 'photoLeft', 'photoRight']),
    single('reinspectionReport', 'Re-inspection', false),
    single('invoice', 'Invoice', false),
    merge('others', 'Others', false, ['surveyReport', 'billCheckReport', 'feeBill']),
  ],
};
