'use client';
import { PDFViewer } from '@react-pdf/renderer';
import { DocumentAnnexureDocument } from './DocumentAnnexureDocument';

import type { ClaimData } from '@/types';
import { useProfileStore } from '@/stores/profile-store';

interface Props {
  claim: ClaimData;
}

export function DocumentAnnexurePreview({ claim }: Props) {
  const profile = useProfileStore(s => s.profile);

  const annexureProfile = {
    name: profile.name,
    // licenceNumber, NOT irdaiLicence: every other report prints licenceNumber
    // (report-utils.ts:78, SpotPrintReport.tsx:129, irdai-summary-builder.ts:243).
    // irdaiLicence is the registration-time field; using it here would put a
    // different licence number on the annexure than on the survey report filed
    // alongside it.
    irdaiLicence: profile.licenceNumber,
    iiislaNumber: profile.iiislaNumber,
    signatureDataUrl: profile.signatureDataUrl,
    stampDataUrl: profile.stampDataUrl,
  };

  return (
    <PDFViewer
      style={{
        width:        '100%',
        height:       '72vh',
        border:       'none',
        borderRadius: '6px',
      }}
      showToolbar
    >
      <DocumentAnnexureDocument claim={claim} profile={annexureProfile} />
    </PDFViewer>
  );
}
