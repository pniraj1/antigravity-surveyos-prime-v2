'use client';
/**
 * Both imports below must stay STATIC and in this same chunk — see the
 * explanation at the top of PhotoSheetDownloadButton.tsx. The consumer wraps
 * this entire component in dynamic({ ssr: false }).
 */
import { PDFDownloadLink } from '@react-pdf/renderer';
import { DocumentAnnexureDocument } from './DocumentAnnexureDocument';

import type { ClaimData } from '@/types';
import { DownloadCloud, Loader2 } from 'lucide-react';
import { useProfileStore } from '@/stores/profile-store';

interface Props {
  claim: ClaimData;
}

export function DocumentAnnexureDownloadButton({ claim }: Props) {
  const profile = useProfileStore(s => s.profile);
  const fileName = `${claim?.vehicle?.registrationNumber || 'DRAFT'}-Document-Annexure.pdf`;

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
    <PDFDownloadLink
      document={<DocumentAnnexureDocument claim={claim} profile={annexureProfile} />}
      fileName={fileName}
    >
      {({ loading, error }) => {
        if (error) {
          return (
            <button
              disabled
              title={String(error)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-sm bg-destructive/20 text-destructive cursor-not-allowed shadow-sm"
            >
              <DownloadCloud size={16} /> PDF Error
            </button>
          );
        }
        return (
          <button
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-md font-semibold text-sm transition-all shadow-sm ${
              loading
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow'
            }`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
            {loading ? 'Preparing…' : 'Download Annexure'}
          </button>
        );
      }}
    </PDFDownloadLink>
  );
}
