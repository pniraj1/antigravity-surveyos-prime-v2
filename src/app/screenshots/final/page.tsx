'use client';

import { UIICPrintReport } from '@/components/print/UIICPrintReport';
import { MOCK_CLAIM, MOCK_PROFILE } from '../_mock-data';
import type { AssessmentSummary } from '@/types';

// Calculated from MOCK_CLAIM.assessmentRows
// Metal: bonnet 15500 + R/H fender 8600 = 24100
// Plastic: bumper 7800 + ORVM 3500 + grille 2200 + grille support 1600 = 15100
// Glass: headlamp 11000 + windscreen 9200 = 20200
// Labour: denting 5000 + painting 10500 = 15500
const MOCK_SUMMARY: AssessmentSummary & {
  netInWords: string;
  partsCGST: number;
  partsSGST: number;
  partsBase: number;
  partsTotal: number;
  labourBase: number;
  labourGST: number;
  labourTotal: number;
} = {
  metalTotal: 24100,
  plasticTotal: 15100,
  glassTotal: 20200,
  fiberglassTotal: 0,
  partsBase: 59400,
  partsCGST: 5346,
  partsSGST: 5346,
  partsTotal: 70092,
  labourBase: 15500,
  labourGST: 2790,
  labourTotal: 18290,
  grandTotal: 88382,
  salvage: 0,
  compulsoryExcess: 1000,
  voluntaryExcess: 0,
  excess: 1000,
  netAssessedLoss: 87382,
  netInWords: 'Rupees Eighty Seven Thousand Three Hundred Eighty Two Only',
  totalEstimated: 97500,
  estimatePartsBase: 67700,
  estimateMetalBase: 42000,
  estimatePlasticBase: 18700,
  estimateGlassBase: 5000,
  estimateFiberglassBase: 2000,
  estimatePartsGST: 10494,
  estimatePartsTotal: 78194,
  estimateLabourBase: 17500,
  estimateLabourGST: 3150,
  estimateLabourTotal: 20650,
  estimateGrossTotal: 98844,
};

export default function FinalScreenshotPage() {
  return (
    <div style={{ background: '#fff', padding: '20px' }}>
      <UIICPrintReport claim={MOCK_CLAIM} summary={MOCK_SUMMARY} profile={MOCK_PROFILE} />
    </div>
  );
}
