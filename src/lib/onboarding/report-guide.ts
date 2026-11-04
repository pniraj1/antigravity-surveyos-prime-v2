import type { AppTab } from '@/stores/ui-store';

export interface ReportSectionItem {
  id: string;
  title: string;
  subtitle: string;
  purpose: string;
  fixTab: AppTab;
  fixLabel: string;
  tips?: string[];
}

export interface ReportGuide {
  reportType: 'spot' | 'survey' | 'valuation';
  title: string;
  description: string;
  sections: ReportSectionItem[];
}

export const REPORT_GUIDES: Record<'spot' | 'survey' | 'valuation', ReportGuide> = {
  survey: {
    reportType: 'survey',
    title: 'Final Survey Report (Standard & UIIC)',
    description: 'The statutory legal assessment submitted to the insurer. Every figure must reconcile back to the garage estimate and tax invoice.',
    sections: [
      {
        id: 'header',
        title: '1. Surveyor Credentials & Letterhead',
        subtitle: 'Header & Legal Identification',
        purpose: 'Displays your professional identity, IRDAI SLA licence number, IIISLA membership, validity, PAN, GSTIN, and contact details. Insurers reject reports without valid surveyor credentials.',
        fixTab: 'profile',
        fixLabel: 'Edit in My Profile',
        tips: [
          'Add your digital signature and official stamp in Profile to auto-stamp every page.',
          'Keep your SLA expiry date updated to prevent claim delays.',
        ],
      },
      {
        id: 'parties',
        title: '2. Insurer & Insured Particulars',
        subtitle: 'Policy, Division & Claim Linkage',
        purpose: 'Links the report directly to the insurer branch/division, policy number, claim number, insured name, address, IDV, and financial endorsement (HPA / Hypothecation bank).',
        fixTab: 'details',
        fixLabel: 'Edit in Claim Details',
        tips: [
          'Auto-populated if you upload the policy schedule PDF.',
          'Check HPA bank name carefully if the vehicle is financed.',
        ],
      },
      {
        id: 'vehicle',
        title: '3. Vehicle Identification & Particulars',
        subtitle: 'RC & Technical Specs',
        purpose: 'RC details: Registration number, engine number, chassis number punch, make, model, variant, date of registration, manufacturing year, and commercial permit/fitness.',
        fixTab: 'details',
        fixLabel: 'Edit in Claim Details',
        tips: [
          'Vehicle age is calculated from date of registration to date of accident to determine part depreciation.',
          'Verify chassis number punch matches physical stamp on vehicle.',
        ],
      },
      {
        id: 'dl',
        title: '4. Driver & Driving Licence Details',
        subtitle: 'Licence Verification',
        purpose: 'Driver name, DL number, issuing authority, licence class (MCWG, LMV, TRANS), and validity on date of loss. Crucial for insurer liability verification under Section 3 of MV Act.',
        fixTab: 'details',
        fixLabel: 'Edit in Claim Details',
        tips: [
          'DL validity must cover the exact date and time of accident.',
          'Badge number required for transport/commercial vehicles.',
        ],
      },
      {
        id: 'accident',
        title: '5. Accident Details & Cause of Loss',
        subtitle: 'Occurrence & Inspection',
        purpose: 'Date, time, exact place of accident, survey date, workshop location, and surveyor narration. Insurers compare this against the GD/FIR and insured claim form to verify authenticity.',
        fixTab: 'details',
        fixLabel: 'Edit in Claim Details',
        tips: [
          'Surveyor comments explain how the physical damage matches the stated cause of accident.',
          'Pinpoint workshop arrival date and inspection date.',
        ],
      },
      {
        id: 'preamble',
        title: '6. Report Preamble & Survey Observations',
        subtitle: 'Surveyor Narrative',
        purpose: 'The executive narrative placed directly above the assessment sheet. Details workshop attendance, joint inspection with garage, and basis of settlement.',
        fixTab: 'reports',
        fixLabel: 'Edit in Report Center',
        tips: [
          'Editable in the text box above the live preview on this tab.',
          'Can be reset anytime to auto-generated wording.',
        ],
      },
      {
        id: 'assessment',
        title: '7. Part-by-Part Assessment Sheet',
        subtitle: 'Parts, Labour & Depreciation',
        purpose: 'The core financial table itemizing every spare part (metal, plastic, glass, rubber), applicable age depreciation (0% to 50%), labour operations, and paint calculation.',
        fixTab: 'assessment',
        fixLabel: 'Edit in Assessment',
        tips: [
          'Ask the garage for original digital estimate PDFs (Maruti TMS, Tata DMS, etc.) for instant parsing.',
          'Use UIIC or Standard format toggle to match insurer requirements.',
        ],
      },
      {
        id: 'summary',
        title: '8. Loss Summary, Deductions & Net Assessed',
        subtitle: 'Financial Settlement & Words',
        purpose: 'Reconciles parts total, labour charges, GST, less salvage deduction, compulsory policy excess, and voluntary excess to derive the final net assessed loss.',
        fixTab: 'assessment',
        fixLabel: 'Check Summary in Assessment',
        tips: [
          'Compulsory excess auto-fills from the policy schedule (e.g. ₹1,000 for private cars up to 1500cc).',
          'Net assessed figure is automatically formatted in words in Indian Rupees.',
        ],
      },
    ],
  },
  spot: {
    reportType: 'spot',
    title: 'Spot Survey Report',
    description: 'Urgent preliminary inspection conducted immediately at the accident site or towing station before vehicle dismantling.',
    sections: [
      {
        id: 'spot_header',
        title: '1. Surveyor Letterhead & Spot Reference',
        subtitle: 'Identity & Spot Assignment',
        purpose: 'Your professional credentials, appointment authority, date and time of spot requisition, and insurer instruction details.',
        fixTab: 'profile',
        fixLabel: 'Edit in My Profile',
        tips: ['Ensures insurer claims desk can promptly authorize workshop shifting.'],
      },
      {
        id: 'spot_policy',
        title: '2. Insurer & Policy Reference',
        subtitle: 'Claim Verification',
        purpose: 'Policy number, cover note reference, insurer branch, insured details, and period of insurance coverage.',
        fixTab: 'details',
        fixLabel: 'Edit in Claim Details',
        tips: ['Confirm policy was in force at the moment of accident.'],
      },
      {
        id: 'spot_vehicle',
        title: '3. Vehicle & Driver Identification',
        subtitle: 'Spot Particulars',
        purpose: 'Vehicle registration, chassis number, engine number, driver details, and spot odometer reading.',
        fixTab: 'details',
        fixLabel: 'Edit in Claim Details',
        tips: ['Record odometer reading at spot to prevent mileage inflation during transit.'],
      },
      {
        id: 'spot_accident',
        title: '4. Spot Inspection & Accident Narrative',
        subtitle: 'Site Findings & Impact Correlation',
        purpose: 'Exact accident location, road condition, direction of impact, third-party damage or injuries, and initial findings.',
        fixTab: 'details',
        fixLabel: 'Edit in Claim Details',
        tips: ['Correlate vehicle damage with physical site marks (brake marks, guardrail impact).'],
      },
      {
        id: 'spot_parts',
        title: '5. Immediate Visible Damage List',
        subtitle: 'Observed Damage at Spot',
        purpose: 'List of external visible damages noted prior to dismantling. Prevents pre-existing or post-accident garage tampering.',
        fixTab: 'assessment',
        fixLabel: 'Edit in Assessment',
        tips: ['Only note external parts visibly damaged at spot; concealed parts are assessed in final survey.'],
      },
    ],
  },
  valuation: {
    reportType: 'valuation',
    title: 'Valuation & Break-in Inspection Report',
    description: 'Pre-insurance risk inspection or used vehicle valuation assessing fair market value, roadworthiness, and pre-existing flaws.',
    sections: [
      {
        id: 'val_header',
        title: '1. Valuer Letterhead & Identification',
        subtitle: 'Credentials & Inspection Date',
        purpose: 'Your certified surveyor/valuer credentials, inspection date, client/financier name, and valuation purpose.',
        fixTab: 'profile',
        fixLabel: 'Edit in My Profile',
        tips: ['Valuer registration / IRDAI licence details.'],
      },
      {
        id: 'val_vehicle',
        title: '2. Vehicle Specifications & Condition Matrix',
        subtitle: 'Physical Examination',
        purpose: 'Chassis verification, engine running condition, tyre tread depth, battery, electricals, upholstery, and body condition.',
        fixTab: 'details',
        fixLabel: 'Edit in Claim Details',
        tips: ['Inspect chassis stamp and glass etchings to confirm vehicle authenticity.'],
      },
      {
        id: 'val_valuation',
        title: '3. Market Valuation, Depreciation & IDV',
        subtitle: 'Financial Assessment',
        purpose: 'Calculates vehicle current market value, ex-showroom price, applicable age depreciation, and recommended IDV for insurance underwriting.',
        fixTab: 'details',
        fixLabel: 'Edit in Claim Details',
        tips: ['Recommends fair market value based on current zonal automotive market.'],
      },
    ],
  },
};

export function getReportGuide(reportType: 'spot' | 'survey' | 'valuation'): ReportGuide {
  return REPORT_GUIDES[reportType] ?? REPORT_GUIDES.survey;
}
