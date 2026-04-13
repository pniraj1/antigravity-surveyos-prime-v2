'use client';
/**
 * PhotoSheetPreview
 *
 * Renders a live, in-browser PDF preview of the photo sheet using react-pdf's
 * PDFViewer (iframe-based).  Both imports are STATIC here for the same reason
 * as PhotoSheetDownloadButton — PDFViewer requires a real react-pdf Document
 * tree, not a Next.js dynamic wrapper.
 *
 * Usage: dynamically import this whole component with ssr:false in the consumer.
 */

// ── Static imports (same bundle chunk) ──────────────────────────────────────
import { PDFViewer } from '@react-pdf/renderer';
import { PhotoSheetDocument } from './PhotoSheetDocument';
// ─────────────────────────────────────────────────────────────────────────────

import type { ClaimData } from '@/types';
import type { PhotoSheetOptions } from '@/types/assessment';
import { useProfileStore } from '@/stores/profile-store';

interface Props {
  claim:   ClaimData;
  options: Partial<PhotoSheetOptions>;
}

export function PhotoSheetPreview({ claim, options }: Props) {
  const surveyorName = useProfileStore(s => s.profile.name);

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
      <PhotoSheetDocument claim={claim} surveyorName={surveyorName} options={options} />
    </PDFViewer>
  );
}
