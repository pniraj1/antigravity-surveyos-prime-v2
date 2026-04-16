'use client';

/**
 * SandboxInit.tsx
 *
 * Only rendered when NEXT_PUBLIC_SANDBOX_MODE=true.
 * Seeds the Zustand store with a pre-built CTL test claim so the
 * sandbox visitor lands directly in a claim where the 75% IDV
 * threshold is already breached and Total Loss mode is active.
 *
 * Uses createBlankClaim() as base — avoids TypeScript errors from
 * missing required fields in the mock object.
 *
 * REMOVE from layout.tsx before shipping to production.
 */

import { useEffect } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { createBlankClaim } from '@/types';
import { logger } from '@/lib/utils/logger';

const SANDBOX_CLAIM = (() => {
  const base = createBlankClaim('final', 'private');
  return {
    ...base,
    id: 'sandbox-ctl-demo',
    reportNo: 'SB/CTL/2026/001',
    reportDate: '2026-04-01',
    isSpotCompleted: true,

    vehicle: {
      ...base.vehicle,
      registrationNumber: 'MH-12-AB-1234',
      make: 'Maruti',
      model: 'Swift Dzire',
      yearOfManufacture: 2019,
      chassisNumber: 'MA3FJEB1S00123456',
      engineNumber: 'K12MN1234567',
      cubicCapacity: '1197',
      colour: 'Pearl Blue',
      bodyType: 'Sedan',
      classOfVehicle: 'LMV',
      fuel: 'Petrol',
      dateOfRegistration: '2019-06-15',
      hypothecation: 'HDFC Bank Ltd',
      hpa: 'HDFC Bank Ltd',
      odometer: '42000',
      preAccidentCondition: 'Good',
      condition: 'Good',
      registrationType: 'Private',
      registeringAuthority: 'Pune RTO',
      registrationValidUpTo: '2034-06-14',
      seatingCapacity: '5',
    },

    driver: {
      ...base.driver,
      name: 'Rajesh Kumar',
      parentName: 'Suresh Kumar',
      fatherHusbandName: 'Suresh Kumar',
      relationType: 'S/o' as const,
      licenceType: 'LMV',
      licenceNumber: 'MH0120190012345',
      licenseNumber: 'MH0120190012345',
      dateOfBirth: '1985-03-20',
      dob: '1985-03-20',
      dateOfIssue: '2010-03-20',
      address: '12, Shivaji Nagar, Pune - 411005',
      issuingAuthority: 'Pune RTO',
      vehicleClasses: 'LMV',
      vehicleClass: 'LMV',
      validityNonTransport: '2030-03-19',
      verificationStatus: 'verified' as const,
      authorisedToDrive: 'Yes',
    },

    policy: {
      ...base.policy,
      policyNumber: 'OG-26-1234-1801-00001234',
      claimNumber: 'C/2024/1234/001234',
      insurerName: 'United India Insurance Co. Ltd.',
      insuredName: 'Rajesh Kumar',
      insuredAddress: '12, Shivaji Nagar, Pune - 411005',
      insuredMobile: '9876543210',
      idv: '100000',
      policyType: 'Package',
      periodFrom: '2025-06-15',
      periodTo: '2026-06-14',
      policyIssuingOffice: 'UIIC Pune Division',
      appointingOffice: 'Pune DO-II',
      hpaWith: 'HDFC Bank Ltd',
      hpa: 'HDFC Bank Ltd',
    },

    accident: {
      ...base.accident,
      dateAndTime: '2026-03-15T14:30:00',
      placeOfAccident: 'Katraj Ghat, Pune',
      placeOfSurvey: 'M/s Accurate Motors, Pune',
      causeOfAccident: 'Lost control on ghat section — vehicle skidded and hit road divider',
      thirdPartyDetails: 'Nil',
      policeStation: 'Katraj Police Station',
      firNumber: '45/2026',
    },

    // Assessment rows: total ~₹80,750 > 75% of IDV ₹1,00,000
    assessmentRows: [
      { id: 'r1', section: 'parts' as const, particulars: 'Front Bumper Assembly',   estimated: 8500,  assessed: 8500,  allowed: true, partType: 'metal'  as const, gst: 18, billedAmount: 0, billStatus: 'not-in-bill' as const },
      { id: 'r2', section: 'parts' as const, particulars: 'Bonnet Panel',             estimated: 12000, assessed: 12000, allowed: true, partType: 'metal'  as const, gst: 18, billedAmount: 0, billStatus: 'not-in-bill' as const },
      { id: 'r3', section: 'parts' as const, particulars: 'Left Front Door',          estimated: 14000, assessed: 14000, allowed: true, partType: 'metal'  as const, gst: 18, billedAmount: 0, billStatus: 'not-in-bill' as const },
      { id: 'r4', section: 'parts' as const, particulars: 'Right Front Door',         estimated: 13500, assessed: 13500, allowed: true, partType: 'metal'  as const, gst: 18, billedAmount: 0, billStatus: 'not-in-bill' as const },
      { id: 'r5', section: 'parts' as const, particulars: 'Windshield Glass',         estimated: 6500,  assessed: 6500,  allowed: true, partType: 'glass'  as const, gst: 18, billedAmount: 0, billStatus: 'not-in-bill' as const },
      { id: 'r6', section: 'parts' as const, particulars: 'Radiator & Condenser',     estimated: 9000,  assessed: 9000,  allowed: true, partType: 'metal'  as const, gst: 18, billedAmount: 0, billStatus: 'not-in-bill' as const },
      { id: 'r7', section: 'labour' as const, particulars: 'Panel Beating & Denting', estimated: 8500,  assessed: 8500,  allowed: true, partType: 'labour' as const, gst: 18, billedAmount: 0, billStatus: 'not-in-bill' as const },
      { id: 'r8', section: 'paint'  as const, particulars: 'Full Body Re-painting',   estimated: 8750,  assessed: 8750,  allowed: true, partType: 'paint'  as const, gst: 18, billedAmount: 0, billStatus: 'not-in-bill' as const },
    ],

    documentVerification: {
      rc:         { status: 'verified',   detail: '' },
      dl:         { status: 'verified',   detail: '' },
      permit:     { status: 'n/a',        detail: '' },
      loadChallan:{ status: 'n/a',        detail: '' },
      fitness:    { status: 'n/a',        detail: '' },
      fireReport: { status: 'n/a',        detail: '' },
      fir:        { status: 'submitted',  detail: 'FIR No. 45/2026 — Katraj PS' },
    },

    // CTL is already ON with sample salvage values — surveyor can edit/toggle
    isTotalLoss: true,
    totalLossDetails: {
      salvageWithRC: 15000,
      salvageWithoutRC: 8000,
      towingExpenses: 1200,
      workshopRent: 500,
      remarks: 'Based on the significant damage to the chassis and engine assembly, the estimated repair cost reaches 80.75% of the IDV. Hence, constructive total loss is recommended for settlement.'
    },
  };
})();

export function SandboxInit() {
  const { currentClaim, loadClaim } = useClaimStore();

  useEffect(() => {
    if (!currentClaim) {
      loadClaim(SANDBOX_CLAIM);
      logger.log('[SandboxInit] CTL demo claim loaded.');
    }
  }, [currentClaim, loadClaim]);

  return null;
}
