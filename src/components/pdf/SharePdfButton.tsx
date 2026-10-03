'use client';

import { Share2 } from 'lucide-react';
import { canSharePdf, sharePdf } from '@/lib/share/share-pdf';

/**
 * Rendered inside PDFDownloadLink's <a download>, so it must stop the click
 * from also triggering the download.
 */
export function SharePdfButton({ blob, fileName }: { blob: Blob | null; fileName: string }) {
  if (!blob || !canSharePdf()) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void sharePdf(blob, fileName);
      }}
      className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md font-semibold text-sm border border-border bg-card hover:bg-muted shadow-sm"
    >
      <Share2 size={16} /> Share
    </button>
  );
}
