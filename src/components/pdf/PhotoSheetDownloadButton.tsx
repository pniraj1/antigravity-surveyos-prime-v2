'use client';
/**
 * PhotoSheetDownloadButton
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * @react-pdf/renderer's <PDFDownloadLink> requires its `document` prop to be
 * a *real* react-pdf <Document> element.  If PhotoSheetDocument is loaded via
 * Next.js `dynamic()` it becomes a React component wrapper — not a real
 * react-pdf Document — and PDFDownloadLink silently fails or throws.
 *
 * Fix: keep BOTH imports static here, then wrap *this entire component*
 * in a single `dynamic()` call (ssr:false) from the consumer (PhotosTab).
 */

// ── Static imports (both must live in the same bundle chunk) ─────────────────
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PhotoSheetDocument } from './PhotoSheetDocument';
// ─────────────────────────────────────────────────────────────────────────────

import type { ClaimData } from '@/types';
import type { PhotoSheetOptions } from '@/types/assessment';
import { DownloadCloud, Loader2 } from 'lucide-react';
import { useProfileStore } from '@/stores/profile-store';

interface Props {
  claim:   ClaimData;
  options: Partial<PhotoSheetOptions>;
}

export function PhotoSheetDownloadButton({ claim, options }: Props) {
  const surveyorName = useProfileStore(s => s.profile.name);
  const fileName =
    `${claim?.vehicle?.registrationNumber || 'DRAFT'}-Photo-Sheet.pdf`;

  return (
    <PDFDownloadLink
      document={<PhotoSheetDocument claim={claim} surveyorName={surveyorName} options={options} />}
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
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : <DownloadCloud size={16} />}
            {loading ? 'Preparing…' : 'Download PDF'}
          </button>
        );
      }}
    </PDFDownloadLink>
  );
}
